import assert from "node:assert/strict";
import test from "node:test";
import { assertRecoveryDiagnostic, mutateRecovery, recoveryFixture, recoveryRecord } from "./p-e-recovery-fixtures.mjs";

// Independent expected precedence, abcbefa sdk.ts:248-266,475-545 (duplicate
// before build; explicit failure/retry bypass it), events.ts:190-225 (default
// success; direct not_committed conflicts with compensated BEFORE semantics),
// semantic.ts:227-253 (#812 consistency follows catalog membership),
// contract.generated.ts:656-681 (no partial outcome or compensated commit).
const DIAGNOSTICS = [
  ["a", "SDK_DUPLICATE_SUCCESS", "lifecycle", "/operation/state"],
  ["b", "SDK_SEMANTIC_VALIDATION_FAILED", "validation", "/event/commit_state"],
  ["c", "PREMATURE_SUCCESS", "validation", "/event/commit_state"],
  ["d", "PREMATURE_SUCCESS", "validation", "/event/commit_state"],
];

for (const [option, ...diagnostic] of DIAGNOSTICS) {
  test(`P-E-10d ${option}: exact source-derived refusal; no compensation record or sink event`, async (t) => {
    const fixture = recoveryFixture(t);
    const row = await fixture.run("P-E-10d");
    const record = recoveryRecord(fixture.state, "P-E-10d", `${option}:compensation:emit`);
    assertRecoveryDiagnostic(record, diagnostic);
    assert.equal(record.handle.state, "compensated");
    assert.deepEqual(record.host_sink, []);
    const branch = row.branches.find((entry) => entry.option === option);
    assert.equal(branch.compensated_before_branch, true);
    assert.equal(branch.new_sink_events, 0);
    assert.deepEqual(branch.database.counts, { business_change: 0, audit_outbox: 0 });
    assert.deepEqual(branch.actual, { probe: 0, gate: 0, exchange: 0, sink: 1, business_commits: 0 });
    assert.equal(row.public_calls, 72);
    assert.equal(row.actual.sink, 4);
    const replays = fixture.state.records.filter((entry) => entry.step_id.endsWith(":rollback:markCompensated"));
    assert.equal(replays.length, 4, "each variant independently replays final compensation");
  });
}

test("wrong compensated-failure diagnostic mutation is distinguishable from premature-success", async (t) => {
  const modules = mutateRecovery((sdk) => ({ ...sdk, mfaRemoved: async (input) => {
    const result = await sdk.mfaRemoved(input);
    if (result.ok) return result;
    if (result.error.code !== "SDK_SEMANTIC_VALIDATION_FAILED") return result;
    return { ...result, error: { ...result.error, code: "PREMATURE_SUCCESS" } };
  } }));
  const fixture = recoveryFixture(t, { modules });
  const row = await fixture.run("P-E-10d");
  const record = recoveryRecord(fixture.state, "P-E-10d", "b:compensation:emit");
  assert.throws(() => assertRecoveryDiagnostic(record, DIAGNOSTICS[1].slice(1)));
  assert.equal(row.branches.length, 4);
  assert.equal(record.counters.sink, 0);
});
