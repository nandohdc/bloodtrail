import { readFileSync } from "node:fs";
import { materialize, readPath } from "../p-d/evaluate.mjs";

export const EXPECTATIONS = JSON.parse(readFileSync(new URL("../expectations/p-d.v1.json", import.meta.url), "utf8"));

export function assignPath(target, path, value) {
  const keys = path.split("/");
  let cursor = target;
  for (const [index, key] of keys.slice(0, -1).entries()) {
    if (cursor[key] === undefined) cursor[key] = /^\d+$/.test(keys[index + 1]) ? [] : {};
    cursor = cursor[key];
  }
  cursor[keys.at(-1)] = value;
}

const plannedSteps = () => EXPECTATIONS.cases.flatMap((entry) => entry.expected);

function fixtureRecord(planned) {
  const record = { step_id: planned.step_id, events: [], facts: {} };
  for (const [path, value] of Object.entries(planned.assertions)) if (!value?.same_as) assignPath(record, path, materialize(value));
  if (planned.diagnostic) record.diagnostic = { ...planned.diagnostic, path: materialize(planned.diagnostic.path) };
  if (record.surface === "thrown-sdk") record.json = { ...record.diagnostic };
  return record;
}

function linkRecord({ planned, records }) {
  const record = records.find((item) => item.step_id === planned.step_id);
  for (const [path, value] of Object.entries(planned.assertions)) {
    if (!value?.same_as) continue;
    const [id, variant, ...keys] = value.same_as.split("/");
    const source = records.find((item) => item.step_id === `${id}/${variant}`);
    assignPath(record, path, readPath(source, keys.join("/")));
  }
}

export function positiveRecords() {
  const records = plannedSteps().map(fixtureRecord);
  const baseline = records.find((record) => record.step_id === "PD-00/main");
  baseline.events[0].event.id = "evt_fixture_opaque";
  const removal = records.find((record) => record.step_id === "PD-01/main");
  removal.facts = { operation_id: "op_fixture", transaction_id: "txn_fixture", correlation_id: "cor_fixture" };
  for (const planned of plannedSteps()) linkRecord({ planned, records });
  return records;
}

export function predictedLedger() {
  const calls = Object.entries(EXPECTATIONS.planned_occurrence_budget.calls_by_case).flatMap(([id, count]) => Array.from({ length: count }, () => ({ label: `${id}:fixture` })));
  return { calls, occurrence_count: calls.length, budget: EXPECTATIONS.planned_occurrence_budget.total, exhausted: false };
}

export const observationFixture = (records = positiveRecords()) => ({ observations: [{ records, ledger: predictedLedger() }], expectations: EXPECTATIONS });
