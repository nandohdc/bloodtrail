import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { recoveryFixture } from "./p-e-recovery-fixtures.mjs";

// Force exhaustion at a later retry/replay boundary and inside deferred sink
// entry. Public-shape doubles may contain callback errors; the shared ledger
// must still stop the workload and SQLite finally cleanup must still run.
const EXHAUSTION = [["P-E-10b", 18], ["P-E-10b(v)", 18], ["P-E-10c", 13], ["P-E-10d", 18], ["P-E-9c", 10]];

for (const [caseId, budget] of EXHAUSTION) {
  test(`${caseId} retains sticky budget exhaustion and removes every native database`, async (t) => {
    const fixture = recoveryFixture(t, { budget });
    await assert.rejects(fixture.run(caseId), /budget exhausted/);
    assert.equal(fixture.state.ledger.report().exhausted, true);
    assert.throws(() => fixture.state.ledger.assertAvailable(), /budget exhausted/);
    assert.deepEqual(readdirSync(fixture.directory), []);
  });
}
