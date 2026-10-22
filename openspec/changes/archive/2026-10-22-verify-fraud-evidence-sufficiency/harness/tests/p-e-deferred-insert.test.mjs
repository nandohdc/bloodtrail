import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { withHostDatabase } from "../p-e/host.mjs";
import { beginHostTransaction, finishHostTransaction, outboxEmit, outboxSetup, outboxTransition } from "../p-e/outbox-steps.mjs";
import { mutateRecovery, recoveryFixture, recoveryRecord } from "./p-e-recovery-fixtures.mjs";

// Independent oracle: abcbefa sdk.ts:208-245,279-296,299-338 invokes sink
// synchronously but awaits its promise. A sink's own first await defers its
// insert. These assertions use native SQLite (no SDK or kit execution).
const VARIANTS = [["rollback", 0], ["commit", 1]];

function assertDeferred(fixture, branch, business) {
  const emit = recoveryRecord(fixture.state, "P-E-9c", `${branch.option}:emit`);
  assert.equal(emit.accepted, true);
  assert.equal(emit.sink_ran_before_await, true);
  assert.equal(emit.inserts_before_await, 0);
  assert.equal(emit.transaction_open_after_await, false);
  const sink = emit.host_sink[0];
  assert.equal(sink.is_transaction, true);
  assert.equal(sink.inserted_is_transaction, false);
  assert.equal(sink.deferred, true);
  assert.deepEqual(branch.host_order.map((entry) => entry.op), ["begin", "business_insert", branch.option, "outbox_insert"]);
  assert(sink.inserted_at_ms >= branch.host_order[2].at_ms);
  assert.deepEqual(branch.database.counts, { business_change: business, audit_outbox: 1 });
  assert.equal(branch.database.row_facts[0].commit_state, "committed");
  assert.equal(branch.database.row_facts[0].body_matches_capture, true);
  assert.deepEqual(branch.sink_counts, { entries: 1, inserts: 1, faults: 0 });
}

for (const [terminal, business] of VARIANTS) {
  test(`P-E-9c ${terminal}: synchronous terminal SQL, deferred autocommit insert, settled cleanup`, async (t) => {
    const fixture = recoveryFixture(t);
    const row = await fixture.run("P-E-9c");
    assertDeferred(fixture, row.branches.find((entry) => entry.option === terminal), business);
    assert.equal(row.public_calls, 24);
    assert.deepEqual(row.actual, { probe: 0, gate: 0, exchange: 0, sink: 2, business_commits: 1 });
  });
}

test("delaying the outer SDK call mutation loses synchronous sink entry and fails the independent oracle", async (t) => {
  const modules = mutateRecovery((sdk) => ({ ...sdk, mfaRemoved: async (input) => {
    await Promise.resolve();
    return sdk.mfaRemoved(input);
  } }));
  const fixture = recoveryFixture(t, { modules });
  const row = await fixture.run("P-E-9c");
  assert.throws(() => assertDeferred(fixture, row.branches[0], 0));
  assert.equal(recoveryRecord(fixture.state, "P-E-9c", "rollback:emit").sink_ran_before_await, false);
});

const SINK_MODES = [false, true];
for (const deferred of SINK_MODES) {
  test(`host terminal failure settles pending work before close/delete (deferred=${deferred})`, async (t) => {
    const fixture = recoveryFixture(t);
    let setup;
    await withHostDatabase({ directory: fixture.directory, name: "pe-terminal-failure", work: async (host) => {
      setup = outboxSetup(fixture.state, { host, caseId: "pe-cleanup", sinkOptions: { deferred } });
      beginHostTransaction(fixture.state, setup);
      await outboxTransition(fixture.state, setup, { id: "mark", method: "markCommitted" });
      const record = await outboxEmit(fixture.state, setup, { terminal: () => {
        finishHostTransaction(fixture.state, setup, "rollback");
        throw new Error("synthetic terminal observation failure");
      } });
      assert.equal(record.kind, "thrown");
      assert.equal(setup.sink.counts.inserts, 1, "pending insert settled BEFORE work returns");
      assert.equal(record.host_sink[0].inserted_is_transaction, !deferred);
      assert.equal(host.counts().audit_outbox, deferred ? 1 : 0);
    } });
    assert.equal(setup.host.closed, true);
    assert.equal(setup.host.isOpen, false);
    assert.deepEqual(readdirSync(fixture.directory), []);
  });
}
