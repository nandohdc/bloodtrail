import assert from "node:assert/strict";
import test from "node:test";
import { assertRecoveryDiagnostic, mutateRecovery, recoveryFixture, recoveryRecord } from "./p-e-recovery-fixtures.mjs";

// Independent oracle from abcbefa sdk.ts:86-107,248-266,475-483,498-545;
// events.ts:55-70,134-149,190-225; operations.ts:108-112,176-186;
// semantic.ts:227-253 and catalog contract.generated.ts:656-681.
// Full replay is intentional: markCompensated must NOT be omitted to make ii pass.
const OPTIONS = [
  { id: "i", calls: 21, business: 1, outbox: 1, sink: 2, identity: [false, false, false, false, false] },
  { id: "ii", calls: 18, business: 1, outbox: 0, sink: 1, diagnostic: ["PREMATURE_SUCCESS", "validation", "/event/commit_state"] },
  { id: "iii-sdk", calls: 19, business: 1, outbox: 1, sink: 2, identity: [true, true, true, true, true] },
  { id: "iii-named", calls: 19, business: 1, outbox: 1, sink: 2, identity: [true, true, true, true, true] },
  { id: "iv", calls: 18, business: 1, outbox: 0, sink: 1, diagnostic: ["SDK_INVALID_IDENTIFIER", "validation", "/operation/operation_id"] },
];
const RETAINED_OPTIONS = ["iii-sdk", "iii-named"];
const REPLAY = ["mark", "emit", "snapshot", "reemit", "markNot", "markCancelled", "markCommitted", "markCompensated"];
const IDENTITY_FIELDS = ["same_event_id", "same_operation_id", "same_transaction_id", "same_correlation_id", "same_body"];

function assertBranch(fixture, row, expected) {
  const branch = row.branches.find((entry) => entry.option === expected.id);
  assert.equal(branch.compensated_before_branch, true);
  assert.equal(branch.retained_frozen, true);
  assert.deepEqual(branch.rollback.counts, { business_change: 0, audit_outbox: 0 });
  assert.deepEqual(branch.database.counts, { business_change: expected.business, audit_outbox: expected.outbox });
  assert.equal(branch.actual.sink, expected.sink);
  assert.equal(branch.public_calls, expected.calls);
  const steps = fixture.state.records.filter((entry) => entry.step_id.startsWith(`P-E-10b/${expected.id}:rollback:`));
  assert.deepEqual(steps.map((entry) => entry.step_id.split(":").at(-1)), REPLAY);
  assert.equal(steps.at(-1).handle.state, "compensated");
  if (expected.identity) {
    assert.deepEqual(IDENTITY_FIELDS.map((field) => branch.identity[field]), expected.identity);
    const emit = recoveryRecord(fixture.state, "P-E-10b", `${expected.id}:retry:emit`);
    assert.equal(emit.accepted, true);
    assert.equal(emit.host_sink[0].inserted_is_transaction, true);
    assert(branch.database.row_facts.every((fact) => fact.body_matches_capture));
  } else {
    const id = expected.id === "iv" ? "beginOperation" : "emit";
    assertRecoveryDiagnostic(recoveryRecord(fixture.state, "P-E-10b", `${expected.id}:retry:${id}`), expected.diagnostic);
    assert.equal(branch.identity, null);
  }
  const calls = fixture.state.calls.filter((entry) => entry.label.startsWith("P-E-10b:"));
  assert.equal(calls.length, 95);
}

for (const expected of OPTIONS) {
  test(`P-E-10b ${expected.id}: fresh rollback/compensation setup, exact public result and durable retry rows`, async (t) => {
    const fixture = recoveryFixture(t);
    const row = await fixture.run("P-E-10b");
    assertBranch(fixture, row, expected);
    assert.equal(row.public_calls, 95);
    assert.deepEqual(row.actual, { probe: 0, gate: 0, exchange: 0, sink: 8, business_commits: 5 });
    assert.equal(new Set(row.steps).size, row.steps.length);
  });
}

test("P-E-10b retry/redelivery call facts link their own independently retained rolled-back occurrence", async (t) => {
  const fixture = recoveryFixture(t);
  await fixture.run("P-E-10b");
  const prior = recoveryRecord(fixture.state, "P-E-10b", "ii:rollback:emit").captures[0].event;
  const retry = recoveryRecord(fixture.state, "P-E-10b", "ii:retry:emit");
  assert.deepEqual(retry.input.retry, { retry_attempt: 1, original_event_id: prior.event.id });
  assert.equal(retry.input.handle_state_at_call, "compensated");
  for (const option of RETAINED_OPTIONS) {
    const original = recoveryRecord(fixture.state, "P-E-10b", `${option}:rollback:emit`).captures[0].event;
    const record = recoveryRecord(fixture.state, "P-E-10b", `${option}:retry:emit`);
    assert.equal(record.input.redelivery_event_id, original.event.id);
    assert.equal(record.input.redelivery_frozen, true);
  }
});

test("P-E-10b(v) fresh operation may reuse transaction/correlation ids but not the operation id", async (t) => {
  const fixture = recoveryFixture(t);
  const row = await fixture.run("P-E-10b(v)");
  const branch = row.branches[0];
  assert.equal(branch.compensated_before_branch, true);
  assert.deepEqual(IDENTITY_FIELDS.map((field) => branch.identity[field]), [false, false, true, true, false]);
  assert.equal(branch.database.row_facts[0].transaction_id_matches_handle, true);
  assert.equal(branch.database.row_facts[0].correlation_id_matches_handle, true);
  assert.equal(branch.database.row_facts[0].commit_state, "committed");
  assert.deepEqual(branch.database.counts, { business_change: 1, audit_outbox: 1 });
  assert.equal(row.public_calls, 21);
});

test("compensated bounded retry acceptance mutation stays an explicit observation, not a rewritten setup", async (t) => {
  const modules = mutateRecovery((sdk) => ({ ...sdk, mfaRemoved: (input) => {
    if (input.retry) return Promise.resolve({ ok: true, value: { status: "accepted" } });
    return sdk.mfaRemoved(input);
  } }));
  const fixture = recoveryFixture(t, { modules });
  const row = await fixture.run("P-E-10b");
  const record = recoveryRecord(fixture.state, "P-E-10b", "ii:retry:emit");
  assert.equal(record.unexpected_acceptance, true);
  assert.throws(() => assertRecoveryDiagnostic(record, OPTIONS[1].diagnostic));
  assert.equal(row.branches[1].compensated_before_branch, true);
  assert.equal(row.branches.at(-1).option, "iv", "unrelated branches still run");
});
