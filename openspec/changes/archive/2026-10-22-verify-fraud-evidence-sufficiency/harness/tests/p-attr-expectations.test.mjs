import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateExpectations, CASE_ORDER, CORRECTED_AT, DRAFT_COMMIT, COMMENT_IDS } from "../p-attr/expectations-validate.mjs";
import { DECLARED_PAIRS, P_ATTR_BUDGET } from "../p-attr/linkage-cases.mjs";
import { planBudget } from "../lib/ledger.mjs";

// The frozen expectations, loaded as data only. Never a results file or a
// ledger row: US-008 freezes v1; later stories must not change it.
const EXPECTATIONS = JSON.parse(readFileSync(new URL("../expectations/p-attr.v1.json", import.meta.url), "utf8"));
const DIGEST = /^[0-9a-f]{64}$/;

function baseText(path) {
  return execFileSync("git", ["show", `${CORRECTED_AT}:${path}`], { encoding: "utf8" });
}

test("frozen expectations validate and pin every required header field", () => {
  assert.equal(validateExpectations(EXPECTATIONS), EXPECTATIONS);
  assert.equal(EXPECTATIONS.probe, "P-attr");
  assert.equal(EXPECTATIONS.version, 1);
  assert.equal(EXPECTATIONS.corrected_at, CORRECTED_AT);
  assert.equal(EXPECTATIONS.drafted_from.commit, DRAFT_COMMIT);
  assert.equal(EXPECTATIONS.drafted_from.issue, 802);
  for (const id of COMMENT_IDS) {
    assert(EXPECTATIONS.drafted_from.comments.some((comment) => comment.includes(`#issuecomment-${id}`)));
  }
  assert.deepEqual(EXPECTATIONS.declared_join_pairs, DECLARED_PAIRS);
  assert.deepEqual(planBudget(EXPECTATIONS.planned_occurrence_budget),
    { processes: P_ATTR_BUDGET.processes, total: P_ATTR_BUDGET.total, limit: 5000 });
  assert.equal(EXPECTATIONS.predicted_total, P_ATTR_BUDGET.predicted_total);
  assert(P_ATTR_BUDGET.total <= 5000 && P_ATTR_BUDGET.total === 2 * P_ATTR_BUDGET.predicted_total);
});

test("every drafted/review-added case and implementer-default AF-F4 is present in documented order", () => {
  assert.deepEqual(EXPECTATIONS.cases.map((entry) => entry.case_id), CASE_ORDER);
  assert.equal(EXPECTATIONS.cases.length, 73);
  const manifest = EXPECTATIONS.counting_manifest;
  assert.deepEqual({ case_ids: 73, drafted_case_ids: 62, review_added_case_ids: 10, implementer_default_case_ids: 1 },
    { case_ids: manifest.case_ids, drafted_case_ids: manifest.drafted_case_ids,
      review_added_case_ids: manifest.review_added_case_ids, implementer_default_case_ids: manifest.implementer_default_case_ids });
  assert.match(manifest.distinction, /56\+9|section/);
  assert.equal(new Set(EXPECTATIONS.cases.flatMap((entry) => entry.expected.map((step) => step.step_id))).size,
    EXPECTATIONS.cases.flatMap((entry) => entry.expected).length);
});

test("per-case predictions sum to predicted_total and the explicit allowance is about twice it", () => {
  const matrix = EXPECTATIONS.cases.reduce((sum, entry) => sum + entry.predicted_calls, 0);
  assert.equal(matrix, P_ATTR_BUDGET.matrix_predicted);
  assert.equal(EXPECTATIONS.predicted_total, P_ATTR_BUDGET.predicted_total);
  assert.equal(P_ATTR_BUDGET.total, 2 * P_ATTR_BUDGET.predicted_total);
  assert.equal(EXPECTATIONS.planned_occurrence_budget.predicted_total, P_ATTR_BUDGET.predicted_total);
});

function allTargets(cases) {
  return cases.flatMap((entry) => entry.expected.flatMap((step) =>
    step.axes.targets.map((target) => ({ step: step.step_id, target }))));
}

test("HMAC handling forbids serialized keys, key-derived ids and frozen digests", () => {
  const hmac = EXPECTATIONS.hmac_key_handling;
  assert.equal(hmac.key_source, "crypto.randomBytes");
  assert.match(hmac.key_storage, /in-memory/);
  assert.match(hmac.key_id_derivation, /never derived from the key/);
  assert.equal(hmac.expectations_hold_digests, false);
  for (const { step, target } of allTargets(EXPECTATIONS.cases)) {
    if (target.keyed !== undefined) assert(!Object.hasOwn(target, "value"), `${step}: keyed target must not freeze a digest`);
    else assert(!DIGEST.test(String(target.value)), `${step}: plain target must not hold a 64-hex digest`);
  }
});

function correctedCases() {
  return EXPECTATIONS.cases.filter((entry) => entry.corrected_from);
}

test("the correction table covers every skeptic correction and each corrected_from carries old text and reason", () => {
  const required = ["AF-B", "AF-C1", "AF-C3", "AF-C7a", "AF-C8", "AF-C6s", "AS-C3", "AS-C5", "AS-C7a",
    "AS-X2", "PR-C7a", "RA-C7a", "RA-C9", "RA-B", "RA-C5", "RA-CR"];
  for (const id of required) {
    const entry = EXPECTATIONS.cases.find((candidate) => candidate.case_id === id);
    assert(entry.corrected_from, `${id}: corrected_from required`);
    assert(entry.corrected_from.old_text.length > 0 && entry.corrected_from.reason.length > 0);
  }
  for (const entry of correctedCases()) {
    assert(entry.corrected_from.old_text.length > 0, entry.case_id);
    assert(entry.corrected_from.reason.length > 0, entry.case_id);
  }
  assert(correctedCases().length >= 16);
});

function citationRanges(cases) {
  return cases.flatMap((entry) => entry.basis.flatMap((citation) =>
    citation.split(":")[1].split(",").map((range) => ({ citation, path: citation.split(":")[0], range }))));
}

test("every basis citation is re-derived at the base: paths exist and line ranges are non-empty", () => {
  for (const { citation, path, range } of citationRanges(EXPECTATIONS.cases)) {
    const lines = baseText(path).trimEnd().split("\n");
    const [start, end = start] = range.split("-").map(Number);
    assert(start > 0, citation);
    assert(end >= start, citation);
    assert(end <= lines.length, citation);
    assert(lines.slice(start - 1, end).join("\n").trim().length > 0, citation);
  }
});

test("every open-question choice is recorded as an implementer default unless a cited decision binds it", () => {
  const defaults = EXPECTATIONS.decisions.implementer_defaults;
  for (const key of ["AF-C0r", "AS-C5", "message carrier", "AF-X1..X3 scope", "tenant discrepancy",
    "two-copy install", "Node factory", "supplied purpose/effective tenant", "display-name misuse"]) {
    assert(typeof defaults[key] === "string" && defaults[key].length > 0, key);
  }
  const f4 = EXPECTATIONS.cases.find((entry) => entry.case_id === "AF-F4");
  assert.equal(f4.added_by, "implementer default");
  assert(f4.drafting_question.includes("outcome_reason.message"));
});

test("linkage L1-L3 rows are frozen as per-row aggregates with declared join pairs", () => {
  const { L1, L2, L3 } = EXPECTATIONS.linkage_expectations;
  assert.equal(L1.length, 25);
  assert.equal(L2.length, 9);
  assert.equal(L3.length, 4);
  for (const row of [...L1, ...L2, ...L3]) {
    assert.equal(row.ex.target_coverage.numerator + row.ex.target_coverage.denominator >= row.ex.target_coverage.denominator, true);
    assert.equal(row.nx.linkage.numerator, 0, `${row.from}: no nx-to-success linkage anywhere`);
    if (row.declared_pair === null) assert.equal(row.ex.linkage.numerator, 0, row.from);
  }
  const c5 = L1.find((row) => row.from === "AF-C5/main");
  assert.deepEqual(c5.ex.linkage, { numerator: 15, denominator: 15 });
  assert.deepEqual(c5.nx.target_coverage, { numerator: 0, denominator: 15 });
  const c6s = L1.find((row) => row.from === "AF-C6s/main");
  assert.deepEqual(c6s.nx.groups, [5, 5, 5]);
  assert.equal(c6s.nx.linkage.numerator, 0);
  const mirror = L2.find((row) => row.to === "AS-C2/keyed-mirror");
  assert.equal(mirror.ex.linkage.numerator, 0);
  assert(mirror.note.includes("keyed under authentication_succeeded"));
  assert.deepEqual(EXPECTATIONS.linkage_inventory.declared_slot_count, 801);
});

const MUTATIONS = [
  ["removed case", (value) => { value.cases.shift(); }],
  ["duplicated case", (value) => { value.cases.splice(1, 0, structuredClone(value.cases[0])); }],
  ["wrong surface", (value) => { value.cases[0].expected[0].kind = "thrown"; }],
  ["wrong diagnostic", (value) => { const refused = value.cases.find((entry) => entry.case_id === "AF-C8").expected[0];
    refused.diagnostic.path = "/altered"; }],
  ["wrong axes", (value) => { value.cases.find((entry) => entry.case_id === "AF-C1").expected[0].axes.resource_rule = "invalid"; }],
  ["missing corrected_from", (value) => { delete value.cases.find((entry) => entry.case_id === "AS-C5").corrected_from; }],
  ["altered join pair", (value) => { value.declared_join_pairs[0] = { ...value.declared_join_pairs[0], from: "altered.id" }; }],
  ["inconsistent budget", (value) => { value.cases[0].predicted_calls += 1; }],
  ["allowance beyond cap", (value) => { value.planned_occurrence_budget.total = 5001; }],
  ["keyed target freezes a digest", (value) => { const target = value.cases.find((entry) => entry.case_id === "AF-C2").expected[0].axes.targets[0];
    target.keyed = undefined; target.value = "a".repeat(64); }],
  ["missing expected steps", (value) => { value.cases[0].expected = []; }],
  ["frozen linkage digest", (value) => { value.linkage_expectations.L1[0].ex.target_coverage.numerator = "15"; }],
];
for (const [label, mutate] of MUTATIONS) {
  test(`validator rejects ${label} instead of accepting an edited freeze`, () => {
    const edited = JSON.parse(JSON.stringify(EXPECTATIONS));
    mutate(edited);
    assert.throws(() => validateExpectations(edited), undefined, label);
  });
}

const TARGET_MUTATIONS = [
  ["missing path", (targets) => targets.pop()],
  ["extra path", (targets) => targets.push({ path: "subject.id", kind: "resolved_account", value: "acct-extra" })],
  ["duplicate path", (targets) => targets.push(structuredClone(targets[0]))],
  ["wrong kind", (targets) => { targets[0].kind = "resolved_account"; }],
  ["wrong plain value", (targets) => { targets[0].value = "acct-altered"; }],
  ["plain replacing keyed", (targets) => { delete targets[4].keyed; targets[4].value = "plain"; }],
  ["wrong key scope", (targets) => { targets[4].keyed.key_scope.tenant = "tnt-a01"; }],
  ["wrong input origin", (targets) => { targets[4].keyed.input_origin = "SR"; }],
  ["wrong digest format", (targets) => { targets[4].keyed.digest_format = "sha256-raw"; }],
  ["wrong matches boolean", (targets) => { targets[4].keyed.matches_declared_input = false; }],
];
for (const [label, mutate] of TARGET_MUTATIONS) {
  test(`prepared carrier cross-check rejects ${label}`, () => {
    const edited = structuredClone(EXPECTATIONS);
    const step = edited.cases.find((entry) => entry.case_id === "AS-C3").expected[0];
    mutate(step.axes.targets);
    assert.throws(() => validateExpectations(edited), /AS-C3\/ex: axes.targets must match prepared carrier descriptors/);
  });
}

test("the frozen JSON contains no export-shaped or prohibited content and ends with a final newline", () => {
  const text = readFileSync(new URL("../expectations/p-attr.v1.json", import.meta.url), "utf8");
  assert.equal(text.endsWith("\n"), true);
  assert(!/^import |^export |module\.exports/.test(text));
  assert(!/\b(SECRET|Bearer |sk-)\b/i.test(text));
});
