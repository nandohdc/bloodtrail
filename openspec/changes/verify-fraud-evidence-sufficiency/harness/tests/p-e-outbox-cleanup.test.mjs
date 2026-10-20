import assert from "node:assert/strict";
import test from "node:test";
import { readdirSync } from "node:fs";
import { peDouble } from "./p-e-case-fixtures.mjs";
import { outboxFixture } from "./p-e-outbox-fixtures.mjs";

const EXHAUSTED_BUDGETS = [8, 10, 12, 25, 38, 42];
const NO_FACTORY = () => { throw new Error("pe-factory-fault"); };

test("all three independent cases remove their files on normal completion", async (t) => {
  const fixture = outboxFixture(t);
  const rows = await fixture.run();
  assert.equal(rows.length, 3);
  assert.deepEqual(readdirSync(fixture.directory), []);
});

test("host file is removed when injected SDK construction throws", async (t) => {
  const modules = peDouble();
  modules.node.createNodeSecurityAuditSdk = NO_FACTORY;
  const fixture = outboxFixture(t, { modules });
  const rows = await fixture.run();
  assert.deepEqual(rows, [], "every case aborts instead of accounting when SDK construction throws");
  assert.deepEqual(fixture.state.case_aborts, ["P-E-9", "P-E-9b", "P-E-10"]);
  const aborts = fixture.state.records.filter((record) => record.variant === "case_aborted");
  assert.equal(aborts.length, 3);
  for (const record of aborts) {
    assert.match(record.message, /pe-factory-fault/);
    assert.equal(record.step_id, `${record.current}/aborted`);
  }
  assert.deepEqual(readdirSync(fixture.directory), []);
});

test("sticky budget faults clean open transactions, inserted rows and later-case files", async (t) => {
  for (const budget of EXHAUSTED_BUDGETS) {
    const fixture = outboxFixture(t, { budget });
    await assert.rejects(fixture.run, /budget/i);
    assert.equal(fixture.state.ledger.report().exhausted, true);
    assert.deepEqual(readdirSync(fixture.directory), []);
  }
});
