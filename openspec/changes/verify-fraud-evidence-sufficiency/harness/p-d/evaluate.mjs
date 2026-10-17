import { isDeepStrictEqual } from "node:util";
import { diagnosticPath, marker } from "./markers.mjs";
import { caseCounts, countResult } from "./accounting.mjs";

export function readPath(value, path) {
  return path.split("/").filter(Boolean).reduce((cursor, key) => cursor?.[key], value);
}

export function materialize(value) {
  if (value?.marker_recipe) return marker(value.marker_recipe);
  if (value?.path_recipe) return diagnosticPath(value.path_recipe);
  if (value?.object_recipe) return { [marker(value.object_recipe.key)]: value.object_recipe.value };
  return value;
}

function expectedValue({ value, records }) {
  if (value?.same_as) {
    const [id, variant, ...path] = value.same_as.split("/");
    const source = records.find((record) => record.step_id === `${id}/${variant}`);
    return readPath(source, path.join("/"));
  }
  return materialize(value);
}

function difference({ path, observed, expected }) {
  if (isDeepStrictEqual(observed, expected)) return [];
  return [`${path}: observed ${JSON.stringify(observed)}; expected ${JSON.stringify(expected)}`];
}

function assertionDifference({ planned, path, value, observed, records }) {
  const expected = expectedValue({ value, records });
  if (value?.same_as && expected === undefined) return [`same_as source missing: ${value.same_as}`];
  return difference({ path: `${planned.step_id}/${path}`, observed: readPath(observed, path), expected });
}

function compareStep({ planned, observed, records }) {
  const notes = [];
  for (const [path, value] of Object.entries(planned.assertions)) {
    notes.push(...assertionDifference({ planned, path, value, observed, records }));
  }
  if (planned.diagnostic) {
    const expected = { ...planned.diagnostic, path: materialize(planned.diagnostic.path) };
    notes.push(...difference({ path: `${planned.step_id}/diagnostic`, observed: observed.diagnostic, expected }));
    if (planned.assertions.surface === "thrown-sdk") notes.push(...difference({ path: `${planned.step_id}/json`, observed: observed.json, expected }));
  }
  return notes;
}

function evaluateCase({ entry, records }) {
  const observations = records.filter((record) => record.step_id.startsWith(`${entry.case_id}/`));
  const notes = [];
  for (const planned of entry.expected) {
    const matches = observations.filter((record) => record.step_id === planned.step_id);
    if (matches.length !== 1) notes.push(`${planned.step_id}: observed ${matches.length} records; expected 1`);
    else notes.push(...compareStep({ planned, observed: matches[0], records }));
  }
  const allowed = new Set(entry.expected.map((planned) => planned.step_id));
  for (const record of observations) if (!allowed.has(record.step_id)) notes.push(`observed unexpected step ${record.step_id}; expected only ${JSON.stringify([...allowed])}`);
  return { case_id: entry.case_id, matched: notes.length === 0, notes, observations };
}

export function evaluateCases({ observations, expectations }) {
  const records = observations.flatMap((process) => process.records);
  const counts = caseCounts({ observations, predictions: expectations.planned_occurrence_budget.calls_by_case });
  const results = expectations.cases.map((entry) => countResult({ result: evaluateCase({ entry, records }), counts }));
  const known = new Set(expectations.cases.map((entry) => entry.case_id));
  for (const record of records) {
    const id = record.step_id.split("/")[0];
    if (!known.has(id)) results.push({ case_id: id, matched: false, notes: [`observed unknown ${record.step_id}; expected a frozen case id`], observations: [record] });
  }
  return results;
}
