// US-013: the frozen 32-case P-E plan and the evidence-aware handoff. Reads
// expectations/p-e.v1.json as data; validates it strictly, cross-checks it
// against the independent source-cited oracle (p-e-evaluator-oracle.mjs),
// evaluates a full offline fixture measure against it, applies one negative
// mutation per family, and pins the header/tick/handoff facts. No probe, SDK
// package, network or real pipeline is involved.
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluateProbe } from "../p-e/evaluate.mjs";
import { validateExpectations } from "../p-e/expectations-validate.mjs";
import { measure } from "../p-e/workload.mjs";
import { authenticationFailed } from "./p-e-concurrency-fixtures.mjs";
import { oraclePlan } from "./p-e-evaluator-oracle.mjs";
import { recoveryDouble } from "./p-e-recovery-fixtures.mjs";
import { fixtureState } from "./p-e-runtime-fixtures.mjs";

const TEXT = readFileSync(new URL("../expectations/p-e.v1.json", import.meta.url), "utf8");
const EXPECTATIONS = JSON.parse(TEXT);
const BASE = "abcbefa03d5b0afc610deb712d7f4ded5a9e82be";
const CASE = (id) => EXPECTATIONS.cases.find((entry) => entry.case_id === id);
const STEP = (id, step) => CASE(id).expected.find((entry) => entry.step_id === `${id}/${step}`);

// #803 comment 6137619745 transcription order, including every appended
// review case; P-E-10b(v) keeps its parentheses because the comment's heading
// is the identity. One entry per heading, uniquely keyed steps per variant.
const COMMENT_ORDER = ["P-E-1a", "P-E-1b", "P-E-1c", "P-E-1d", "P-E-1e", "P-E-1f", "P-E-2", "P-E-2b",
  "P-E-3a", "P-E-3b", "P-E-4", "P-E-4b", "P-E-5", "P-E-6", "P-E-6b", "P-E-7", "P-E-8", "P-E-9", "P-E-9b",
  "P-E-10", "P-E-10b", "P-E-10c", "P-E-x1", "P-E-2c", "P-E-x2", "P-E-g", "P-E-adm", "P-E-6c", "P-E-10b(v)",
  "P-E-10d", "P-E-9c", "P-E-x3"];
const REVIEW_ADDED = ["P-E-2c", "P-E-x2", "P-E-g", "P-E-adm", "P-E-6c", "P-E-10b(v)", "P-E-10d", "P-E-9c", "P-E-x3"];
const CORRECTED = {
  "P-E-1f": "#797", "P-E-4": "review correction", "P-E-10b": "compensated", "P-E-adm": "#797",
};
const FINDINGS = ["P-E-x2", "P-E-9c", "P-E-6c", "P-E-3a"];
const FAMILIES = ["construction", "ordering", "redelivery", "concurrency", "outbox", "guarantees"];
// Independent oracle rows per family (two each), with the frozen step whose
// result variant the oracle transcription must agree on.
const ORACLE_PEERS = {
  construction: [["P-E-1b", "direct", "emit"], ["P-E-1f", "handleless-failure", "emit"]],
  ordering: [["P-E-2", "deliver", "deliver"], ["P-E-3b", "deliver", "deliver"]],
  redelivery: [["P-E-5", "initial", "deliver"], ["P-E-2c", "probe-false/first", "first"]],
  concurrency: [["P-E-6", "d2", "d2"], ["P-E-6b", "second", "second"]],
  outbox: [["P-E-9", "emit", "emit"], ["P-E-9c", "rollback:emit", "rollback:emit"]],
  guarantees: [["P-E-g", "read", "read"], ["P-E-7", "b2-deliver", "b2-deliver"]],
};
// One negative mutation per family: a deliberate transcription defect that
// must surface as a mismatch on exactly that case, never another case.
const NEGATIVES = {
  construction: (entry) => { entry.expected.find((step) => step.step_id === "P-E-1a/followup").counters.sink = 0; },
  ordering: (entry) => { entry.expected.find((step) => step.step_id === "P-E-2/deliver").result = { variant: "already_delivered" }; },
  redelivery: (entry) => { entry.expected.find((step) => step.step_id === "P-E-5/settle").result = { variant: "failed_closed", code: "audit_durability_unreachable", commitGateInvoked: true, durabilityAttempted: true }; },
  concurrency: (entry) => { entry.expected.find((step) => step.step_id === "P-E-6/d2").result = { variant: "already_delivered" }; },
  outbox: (entry) => { entry.expected.find((step) => step.step_id === "P-E-9/emit").assertions.push({ path: "host_sink.0.inserted_is_transaction", op: "equal", value: false }); },
  guarantees: (entry) => { entry.expected.find((step) => step.step_id === "P-E-g/read").assertions.push({ path: "raw.public_keys", op: "equal", value: ["deliver"] }); },
};
const VOLATILE = [/[a-f0-9]{64}/, /\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/i];

function fullModules() {
  const modules = recoveryDouble();
  const factory = modules.node.createNodeSecurityAuditSdk;
  modules.core.observedSource = (input) => Object.freeze(structuredClone(input));
  modules.node.createNodeSecurityAuditSdk = (config) => Object.freeze({ ...factory(config),
    authenticationFailed: authenticationFailed(config.sink) });
  return modules;
}

async function withDirectory(fn) {
  const directory = mkdtempSync(join(tmpdir(), "p-e-frozen-"));
  try { return await fn(directory); } finally { rmSync(directory, { recursive: true, force: true }); }
}

// Offline full-measure observations: baselines first, then every family case,
// produced by the public-shape doubles under the sticky ledger allowance.
async function measuredObservations() {
  return withDirectory(async (directory) => {
    const state = fixtureState({ budget: 5000, ...fullModules() });
    const observed = await measure({ state, directory });
    assert.deepEqual(observed.invalidations, []);
    assert.equal(observed.accounting.length, 32);
    return observed;
  });
}

function evaluated(observations, expectations = EXPECTATIONS) {
  return evaluateProbe({ observations: [observations], expectations });
}

test("the frozen plan holds exactly the 32 #803 cases in comment order, one entry per heading", () => {
  assert.deepEqual(EXPECTATIONS.cases.map((entry) => entry.case_id), COMMENT_ORDER);
  for (const id of REVIEW_ADDED) assert.equal(CASE(id).added_by, "review", `${id} must carry its review provenance`);
  const families = new Set(EXPECTATIONS.cases.map((entry) => entry.family));
  assert.deepEqual([...families].sort(), [...FAMILIES].sort());
  const ids = EXPECTATIONS.cases.flatMap((entry) => entry.expected.map((step) => step.step_id));
  assert.equal(new Set(ids).size, ids.length, "every planned step is uniquely owned");
});

test("the frozen plan passes the strict validator with a fixture-derived budget", () => {
  assert.equal(validateExpectations(EXPECTATIONS), EXPECTATIONS);
  const sum = EXPECTATIONS.cases.reduce((total, entry) => total + entry.predicted_calls, 0);
  assert.equal(sum, 802);
  assert.equal(EXPECTATIONS.predicted_total, 802);
  const budget = EXPECTATIONS.planned_occurrence_budget;
  assert.equal(budget.predicted_total, 802);
  assert.equal(budget.processes.sequential, 1604);
  assert.equal(budget.total, 1604);
  assert(budget.total >= 2 * sum - 1 && budget.total <= 2 * sum, "allowance stays about twice the prediction");
  assert(budget.total <= budget.limit && budget.limit === 5000);
});

test("the header pins the draft comment, the corrected base, k=3 and the exact database grants", () => {
  assert.equal(EXPECTATIONS.probe, "P-E");
  assert.equal(EXPECTATIONS.version, 1);
  assert.equal(EXPECTATIONS.drafted_from.commit, "5d931ad");
  assert.equal(EXPECTATIONS.drafted_from.comment, "https://github.com/nandohdc/bloodtrail/issues/803#issuecomment-6137619745");
  assert.equal(EXPECTATIONS.corrected_at, BASE);
  assert.equal(EXPECTATIONS.redelivery_k, 3);
  assert.deepEqual(EXPECTATIONS.database_handling.permission_flags,
    ["--permission", "--allow-fs-read=<own-service>", "--allow-fs-write=<pipeline-scratch>/host-database"]);
  assert.equal(EXPECTATIONS.database_handling.ownership,
    "harness-local synthetic host database, not Bloodtrail storage or outbox");
  assert.equal(EXPECTATIONS.database_handling.cleanup, "deleted with scratch in finally");
  assert(EXPECTATIONS.decisions.some((decision) => decision.text.includes("k = 3")));
  assert(EXPECTATIONS.decisions.some((decision) => decision.text.includes("delegate S1")));
});

test("every outcome correction records its old expectation and its reason", () => {
  for (const [id, fragment] of Object.entries(CORRECTED)) {
    const correction = CASE(id).corrected_from;
    assert.notEqual(correction, undefined, `${id} must carry corrected_from`);
    assert(correction.old_text.length > 0);
    assert(correction.reason.length > 0);
    assert(correction.old_text.includes(fragment) || correction.reason.includes(fragment)
      || correction.reason.includes(fragment[0].toUpperCase() + fragment.slice(1)),
      `${id} correction must name its provenance`);
  }
  assert.equal(CASE("P-E-1f").expected[0].result.diagnostic.code, "PREMATURE_SUCCESS",
    "the #797 refusal is frozen, not the draft's accepted side observation");
  assert.equal(STEP("P-E-10b", "ii:retry:emit").result.diagnostic.code, "PREMATURE_SUCCESS",
    "10b(ii) on the compensated handle is frozen as refused, not accepted");
  assert.equal(STEP("P-E-4", "fresh").result.variant, "sdk_value",
    "P-E-4's corrective-linkage follow-up is frozen");
  assert(CASE("P-E-adm").setup.includes("truthful order"), "adm's setup correction drops the P-E-1f dependency");
});

test("the four named findings and the durability note are represented, never as cases", () => {
  assert.deepEqual(EXPECTATIONS.findings.map((finding) => finding.case_id).sort(), [...FINDINGS].sort());
  for (const finding of EXPECTATIONS.findings) {
    assert(finding.finding.length > 0);
    assert.match(CASE(finding.case_id).classification, /Expected finding/);
  }
  assert(EXPECTATIONS.notes.some((note) => note.note.includes("durabilityAttempted")
    && note.note.includes("not as a case")));
  assert(!COMMENT_ORDER.includes("P-E-findings"), "findings stay data, not case ids");
});

// Volatile-value hygiene: an `equal` assertion must never pin a runtime
// identity, digest, UUID or clock value, and refusal/failed-closed results
// stay self-describing through a non-empty diagnostic code.
function frozenRuntimeLiterals(step) {
  return step.assertions.filter((assertion) => assertion.op === "equal"
    && VOLATILE.some((pattern) => pattern.test(JSON.stringify(assertion.value))));
}

function assertStepHygiene(step) {
  assert.deepEqual(frozenRuntimeLiterals(step), [], `${step.step_id} freezes a runtime literal`);
  if (step.result.variant === "sdk_refusal") assert(step.result.diagnostic.code.length > 0);
  if (step.result.variant === "refused" || step.result.variant === "failed_closed") {
    assert.equal(step.result.code.length > 0, true);
  }
}

function assertNoFrozenRuntimeIdentifiers(entry) {
  for (const step of entry.expected) assertStepHygiene(step);
  assert.doesNotMatch(JSON.stringify(entry.expected), /"event_id":\s*"pe-/, `${entry.case_id} freezes a concrete event id`);
}

test("no assertion freezes runtime identities, digests, UUIDs or clock values", () => {
  for (const entry of EXPECTATIONS.cases) assertNoFrozenRuntimeIdentifiers(entry);
});

test("the independent source-cited oracle agrees with the frozen rows for two cases per family", () => {
  const oracle = new Map(oraclePlan().cases.map((entry) => [entry.case_id, entry]));
  for (const [family, peers] of Object.entries(ORACLE_PEERS)) {
    for (const [id, stepName, oracleStepName] of peers) {
      const frozen = CASE(id);
      const expected = oracle.get(id);
      assert.notEqual(expected, undefined, `${id} must exist in the independent oracle`);
      const frozenStep = STEP(id, stepName);
      const oracleStep = expected.expected.find((step) => step.step_id === `${id}/${oracleStepName}`);
      assert.notEqual(oracleStep, undefined, `${id}/${oracleStepName} must exist in the oracle`);
      assert.deepEqual(frozenStep.result.variant, oracleStep.result.variant, `${id}/${stepName} result variant agrees`);
      const cited = expected.basis.map((citation) => citation.split(":")[0]);
      assert(cited.every((module) => frozen.basis.some((citation) => citation.startsWith(module))),
        `${id} re-derives every module the oracle cites`);
    }
  }
});

test("the full offline measure matches every frozen expectation with no plan notes", async () => {
  const observations = await measuredObservations();
  const result = evaluated(observations);
  assert.deepEqual(result.notes, [], "the frozen plan itself is well formed");
  assert.equal(result.evaluations.length, 32);
  for (const row of result.evaluations) {
    assert.equal(row.matched, true, `${row.case_id}: ${row.mismatches.join("; ")}`);
  }
  assert(result.verdict.guarantees.length === 5 && result.verdict.contract.length > 0);
});

for (const [family, mutate] of Object.entries(NEGATIVES)) {
  test(`a ${family} transcription defect is a mismatch on that case and on no other case`, async () => {
    const observations = await measuredObservations();
    const plan = structuredClone(EXPECTATIONS);
    const entry = plan.cases.find((row) => row.family === family);
    mutate(entry);
    const result = evaluated(observations, plan);
    const damaged = result.evaluations.find((row) => row.case_id === entry.case_id);
    assert.equal(damaged.matched, false, `${entry.case_id} must catch the ${family} defect`);
    const others = result.evaluations.filter((row) => row !== damaged && row.matched === false);
    assert.deepEqual(others, [], "the defect never voids an unrelated case");
  });
}

function assertRunTaskState({ tasks, hasResult }) {
  assert.match(tasks, hasResult ? /^- \[x\] 4\.2 /m : /^- \[ \] 4\.2 /m);
}

for (const hasResult of [false, true]) {
  test(`task 4.2 state follows run-4 result existence (${hasResult})`, () => {
    const tasks = `- [${hasResult ? "x" : " "}] 4.2 Run the approved probe\n`;
    assertRunTaskState({ tasks, hasResult });
    assert.throws(() => assertRunTaskState({ tasks, hasResult: !hasResult }), assert.AssertionError);
  });
}

test("the P-E handoff keeps task 4.1 ticked, tracks the run-4 tick against its results, and keeps the seven owned_paths", () => {
  const tasks = readFileSync(new URL("../../tasks.md", import.meta.url), "utf8");
  assert.match(tasks, /- \[x\] 4\.1/);
  assertRunTaskState({ tasks, hasResult: existsSync(new URL("../results/p-e-run-4.json", import.meta.url)) });
  // Verification (group 8) may close only after the close-out groups 6 and 7.
  if (/^- \[x\] 8\.\d /m.test(tasks)) assert.doesNotMatch(tasks, /^- \[ \] [67]\.\d /m);
  const assessment = JSON.parse(readFileSync(new URL("../../assessment.source.json", import.meta.url), "utf8"));
  assert.equal(assessment.owned_paths.length, 7, "owned_paths stays the seven planning entries");
  const readme = readFileSync(new URL("../README.md", import.meta.url), "utf8");
  assert.match(readme, /S1 approval: P-E run <N> for #803 at <HEAD>/);
  assert.match(readme, /--allow-fs-read=<own-service>/);
  assert.match(readme, /4\.2.*not executed|has not executed/);
  assert.match(readme, /run-29cdaf98-9cf3-4d7b-9633-059867ffa795/);
});
