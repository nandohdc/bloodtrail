import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProbe } from "../p-e/evaluate.mjs";
import { resultIssues } from "../p-e/result-shapes.mjs";
import { assertionIssues } from "../p-e/assertions.mjs";
import { oraclePlan } from "./p-e-evaluator-oracle.mjs";
import { fixtureObservations } from "./p-e-evaluator-records.mjs";

// Public type shapes: delivery-classes.ts:203-223; errors.ts:41-58;
// sdk.ts:86-107; operations.ts:31-46. Literal ids below are fixture observations,
// never frozen expected runtime values.
const RESULTS = [
  { plan: { variant: "accepted" }, raw: { ok: true, value: { status: "accepted" } } },
  { plan: { variant: "sdk_value" }, raw: { ok: true, value: { state: "committed", commit_state: "committed" } } },
  { plan: { variant: "observation" }, raw: { macrotask_turns: 1 } },
  { plan: { variant: "thrown" }, raw: { name: "Error", message: "synthetic callback fault" }, kind: "thrown", accepted: false },
  { plan: { variant: "already_delivered" }, raw: { status: "already_delivered", event_id: "pe-event-fixture", transaction_id: "pe-txn-fixture" } },
  { plan: { variant: "committed_and_durable" }, raw: { status: "committed_and_durable", event_id: "pe-event-fixture", transaction_id: "pe-txn-fixture" } },
  { plan: { variant: "refused", code: "delivery_class_mismatch" }, accepted: false,
    diagnostic: { code: "delivery_class_mismatch" }, raw: { status: "refused", code: "delivery_class_mismatch", event_id: "pe-event-fixture" } },
  { plan: { variant: "failed_closed", code: "audit_durability_unreachable", commitGateInvoked: true, durabilityAttempted: true },
    raw: { status: "failed_closed", code: "audit_durability_unreachable", event_id: "pe-event-fixture", commitGateInvoked: true, durabilityAttempted: true } },
];
const METADATA_DAMAGE = [
  (record) => { record.exchange_attempts[0].body_bytes = -1; },
  (record) => { record.exchange_attempts[0].request_attempt = 1; },
  (record) => { record.exchange_attempts[0].method = "GET"; },
  (record) => { record.exchange_attempts[0].path = "/other"; },
  (record) => { record.exchange_attempts[0].outcome = null; },
  (record) => { record.exchange_attempts[0].outcome.raw.status = 999; },
  (record) => { record.exchange_attempts[0].exchange_ordinal = 0; },
];
const RELATIONS = [
  { path: "raw.event_id", op: "same", peer: { step_id: "P-E-1b/emit", path: "raw.event_id" } },
  { path: "raw.event_id", op: "different", peer: { step_id: "P-E-1b/emit", path: "raw.event_id" } },
  { path: "position", op: "before", peer: { step_id: "P-E-1b/emit", path: "position" } },
];

for (const fixture of RESULTS) {
  test(`result shape ${fixture.plan.variant} matches its independent public type fixture`, () => {
    const record = { kind: "returned", accepted: true, ...fixture };
    assert.deepEqual(resultIssues(fixture.plan, record), []);
    delete record.raw;
    assert(resultIssues(fixture.plan, record).length > 0);
  });
}
for (const damage of METADATA_DAMAGE) {
  test(`exchange metadata mutation ${METADATA_DAMAGE.indexOf(damage)} is local`, () => {
    const observations = fixtureObservations();
    damage(observations[0].records.find((row) => row.step_id === "P-E-2/deliver"));
    const result = evaluateProbe({ observations, expectations: oraclePlan() });
    assert.deepEqual(result.evaluations.filter((row) => !row.matched).map((row) => row.case_id), ["P-E-2"]);
  });
}

test("missing/duplicate relation peers and absent peer fields never compare as matching undefined", () => {
  for (const rule of RELATIONS) {
    for (const records of [[], [{ step_id: "P-E-1b/emit" }], [{ step_id: "P-E-1b/emit" }, { step_id: "P-E-1b/emit" }]]) {
      assert(assertionIssues({ assertions: [rule], actual: {}, records }).length > 0);
    }
  }
});

test("accounting and derived records are routed to owners; unowned summaries are retained explicitly", () => {
  const observations = fixtureObservations();
  observations[0].accounting.push({ case_id: "unowned-summary", steps: [] });
  const result = evaluateProbe({ observations, expectations: oraclePlan() });
  const own = result.evaluations.find((row) => row.case_id === "P-E-g");
  assert.equal(own.accounting[0], observations[0].accounting[10]);
  assert(own.aggregates.some((row) => row.step_id === "P-E-g/read"));
  assert(own.matched);
  const unowned = result.evaluations.at(-1);
  assert.equal(unowned.matched, false);
  assert.deepEqual(unowned.accounting, [observations[0].accounting.at(-1)]);
  assert(!unowned.mismatches[0].includes("unknown step"));
});

test("malformed accounting inventory mismatches locally without suppressing other aggregate verdicts", () => {
  const observations = fixtureObservations();
  observations[0].accounting[0].steps = null;
  const result = evaluateProbe({ observations, expectations: oraclePlan() });
  assert.deepEqual(result.evaluations.filter((row) => !row.matched).map((row) => row.case_id), ["P-E-1b"]);
  assert.equal(result.evaluations.find((row) => row.case_id === "P-E-g").matched, true);
});
