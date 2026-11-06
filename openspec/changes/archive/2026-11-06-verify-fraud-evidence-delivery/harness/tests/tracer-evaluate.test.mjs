import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonFile } from "../lib/io.mjs";
import { evaluateCases } from "../tracer/evaluate.mjs";
import { validateExpectations } from "../tracer/expectations.mjs";

const EXPECTATIONS = validateExpectations(jsonFile(new URL("../expectations/tracer.v1.json", import.meta.url)));
const HASH = "a".repeat(64);

// What an honest tracer run reports: one occurrence, acknowledged on its first attempt and persisted.
function honest() {
  return {
    sender: {
      calls: [{ label: "authenticationSucceeded", ok: true, value: { status: "accepted" } }],
      deliveries: { "e-1": { status: "acknowledged", attempts: 1 } },
      exchanges: [{ event_id: "e-1", attempt: 0, body_sha256: HASH }],
      callbacks: { scheduled: [], exhausted: [], admitted: [[1, 4]], rejected_overload: [], released: [[0, 4]] },
      shutdown_report: { accepted: 1, completed: 1, abandoned: 0 },
      controls: { loopback_guard: { holds: true }, write_outside_grant: { planted_refused: true, holds: true }, synthetic_data: { holds: true } },
      guard_violations: [{ host: "192.0.2.1", stage: "before_connect" }],
    },
    ingress: {
      records: [{ event_id: "e-1", occurrence: 1, attempt: 0, action: "acknowledge", status: 202, outcome: { kind: "persisted" }, body_sha256: HASH }],
      read_back: [{ event_id: "e-1", persisted: true, stored_body_sha256: HASH }],
      controls: { write_outside_grant: { holds: true } },
    },
  };
}

const mismatched = (result) => result.evaluations.filter((entry) => !entry.matched).map((entry) => entry.case_id);

test("null control: an honest run matches every case", () => {
  const result = evaluateCases({ observations: honest(), expectations: EXPECTATIONS });
  assert.deepEqual(mismatched(result), []);
  assert.deepEqual(result.verdict, { matched: 7, mismatched: 0 });
});

test("planted defect: a silently dropped occurrence breaks the accounting identity and persistence", () => {
  const observations = honest();
  observations.ingress.read_back = [{ event_id: "e-1", persisted: false, storage_result: "not_found" }];
  const result = evaluateCases({ observations, expectations: EXPECTATIONS });
  assert.deepEqual(mismatched(result), ["T-02", "T-04", "T-05"]);
  assert.deepEqual(result.evaluations[1].observed.counts.unexplained, 1);
});

test("planted defect: an occurrence the SDK never handed to the composition is unexplained", () => {
  const observations = honest();
  observations.sender.calls = [{ label: "authenticationSucceeded", ok: false, error: { code: "SDK_SEMANTIC_VALIDATION_FAILED" } }];
  observations.sender.deliveries = {};
  observations.sender.exchanges = [];
  observations.ingress.records = [];
  observations.ingress.read_back = [];
  const result = evaluateCases({ observations, expectations: EXPECTATIONS });
  assert.deepEqual(result.evaluations[1].observed.counts.unexplained, 1);
  assert.equal(result.evaluations[1].observed.missing, 1);
  assert.equal(result.evaluations[1].observed.accounting_holds, false);
});

test("a persisted occurrence the sender reported undelivered is kept as a disagreement", () => {
  const observations = honest();
  observations.sender.deliveries["e-1"].status = "exhausted";
  const observed = evaluateCases({ observations, expectations: EXPECTATIONS }).evaluations[1].observed;
  assert.deepEqual(observed.disagreements, [{ event_id: "e-1", delivery: "exhausted" }]);
  assert.equal(observed.counts.persisted, 1);
});

test("planted defect: one changed stored byte fails byte identity, and the changed copy no longer explains the occurrence", () => {
  const observations = honest();
  observations.ingress.read_back[0].stored_body_sha256 = "b".repeat(64);
  const result = evaluateCases({ observations, expectations: EXPECTATIONS });
  assert.deepEqual(mismatched(result), ["T-02", "T-05"]);
  assert.deepEqual(result.evaluations[1].observed.unexplained, ["e-1"]);
});

test("planted defect: a conflicting copy persisted under another scope does not stand in for the sender's lost copy", () => {
  const observations = honest();
  observations.ingress.read_back = [
    { event_id: "e-1", scope: { kind: "tenant", tenantId: "syn-tenant-0000000a" }, persisted: false, storage_result: "not_found" },
    { event_id: "e-1", scope: { kind: "tenant", tenantId: "syn-tenant-0000000b" }, persisted: true, stored_body_sha256: "c".repeat(64) },
  ];
  const observed = evaluateCases({ observations, expectations: EXPECTATIONS }).evaluations[1].observed;
  assert.equal(observed.counts.persisted, 0);
  assert.equal(observed.accounting_holds, false);
});

test("planted defect: an unreported retry breaks the delay identity", () => {
  const observations = honest();
  observations.sender.deliveries["e-1"].attempts = 2;
  observations.sender.exchanges.push({ event_id: "e-1", attempt: 1, body_sha256: HASH });
  const result = evaluateCases({ observations, expectations: EXPECTATIONS });
  assert.equal(result.evaluations[1].observed.delay_identity_holds, false);
  assert(mismatched(result).includes("T-02"));
});

test("planted defect: a guard that did not fire fails the control case", () => {
  const observations = honest();
  observations.sender.controls.loopback_guard.holds = false;
  observations.sender.guard_violations = [];
  assert.deepEqual(mismatched(evaluateCases({ observations, expectations: EXPECTATIONS })), ["T-07"]);
});

test("a run with no observations matches nothing and is reported, not corrected", () => {
  const result = evaluateCases({ observations: null, expectations: EXPECTATIONS });
  assert.deepEqual(result.verdict, { matched: 0, mismatched: 7 });
  for (const entry of result.evaluations) assert.equal(entry.observed, null);
});
