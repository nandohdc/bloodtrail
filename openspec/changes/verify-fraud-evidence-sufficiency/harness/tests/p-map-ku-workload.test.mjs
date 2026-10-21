import assert from "node:assert/strict";
import test from "node:test";
import { LOCKOUT_CASES, UNLOCK_CASES } from "../p-map/lock-cases.mjs";
import { lockoutWorkload } from "../p-map/lockout-workload.mjs";
import { unlockWorkload } from "../p-map/unlock-workload.mjs";
import { observations } from "../p-map/runtime.mjs";
import { assertOracle } from "./p-map-lm-oracle.mjs";
import { KU_ORACLE } from "./p-map-ku-oracle.mjs";
import { kuFixture } from "./p-map-ku-fixtures.mjs";

async function runFamilies(options) {
  const fixture = kuFixture(options);
  const lock = await lockoutWorkload(fixture.state);
  await unlockWorkload(fixture.state, lock);
  return { ...fixture, lock };
}

function assertPlan(state, entry) {
  const accounting = state.accounting.find((row) => row.case_id === entry.case_id);
  assert.equal(accounting.public_calls, entry.predicted_calls, entry.case_id);
  assert.deepEqual(accounting.notes, []);
  assert.deepEqual(accounting.steps, entry.steps.map((id) => `${entry.case_id}/${id}`));
  for (const row of accounting.variants) assert.equal(row.public_calls, row.predicted_calls, `${entry.case_id}/${row.variant_id}`);
  assert.equal(accounting.variants.reduce((sum, row) => sum + row.public_calls, 0), entry.predicted_calls);
}

for (const entry of [...LOCKOUT_CASES, ...UNLOCK_CASES]) test(`P-map ${entry.case_id} matches source-cited independent oracle and counts`, async () => {
  const { state } = await runFamilies();
  for (const row of KU_ORACLE.filter((item) => item.step_id.startsWith(`${entry.case_id}/`))) {
    assertOracle(state.records.find((record) => record.step_id === row.step_id), row);
  }
  assertPlan(state, entry);
  assert.deepEqual(state.case_aborts, []);
  assert.deepEqual(state.invalidations, []);
});

for (const identityOffset of [0, 900]) test(`P-map K/U structural identities and immutable captures survive dynamic IDs ${identityOffset}`, async () => {
  const { state } = await runFamilies({ identityOffset });
  assert.equal(state.ledger.report().occurrence_count, 142);
  assert.equal(state.records.length, 34);
  assert.equal(new Set(state.records.map((row) => row.step_id)).size, state.records.length);
  for (const record of state.records) {
    assert.equal(record.sink_count, record.captures.length);
    for (const capture of record.captures) {
      assert.equal(capture.frozen, true);
      assert(Object.isFrozen(capture.event));
    }
  }
  for (const row of KU_ORACLE) assertOracle(state.records.find((record) => record.step_id === row.step_id), row);
  assert.doesNotThrow(() => JSON.stringify(observations(state)));
});

const MUTATIONS = [
  { id: "K1/attempt", mutate: (row) => { row.signal.target_absent = false; } },
  { id: "K2a/policy", mutate: (row) => { row.signal.authorization_decision = "deny"; } },
  { id: "K4/tenantless", mutate: (row) => { row.diagnostic.path = "/resource"; } },
  { id: "U1/scheduled", mutate: (row) => { row.occurrence.commit_state = "not_applicable"; } },
  { id: "U2/same-instance", mutate: (row) => { row.occurrence.outcome = "success"; } },
  { id: "U2/copied", mutate: (row) => { row.accepted = true; } },
];
for (const { id, mutate } of MUTATIONS) test(`P-map independent K/U oracle rejects mutation ${id}`, async () => {
  const { state } = await runFamilies();
  const record = structuredClone(state.records.find((row) => row.step_id === id));
  mutate(record);
  assert.throws(() => assertOracle(record, KU_ORACLE.find((row) => row.step_id === id)), assert.AssertionError);
});

for (const aborted of ["K1", "U1"]) test(`P-map ${aborted} case abort remains local and later K/U work continues`, async () => {
  const { state } = kuFixture();
  const construct = state.c;
  state.c = (name, ...args) => {
    if (state.current === aborted) throw new Error("fixture-ku-construction-abort");
    return construct(name, ...args);
  };
  const lock = await lockoutWorkload(state);
  await unlockWorkload(state, lock);
  const row = state.accounting.find((item) => item.case_id === aborted);
  assert.equal(row.matched, false);
  assert.equal(row.case_aborted, true);
  assert(state.records.some((record) => record.step_id === `${aborted}/aborted`));
  const later = KU_ORACLE.find((item) => item.step_id === "U2/same-instance");
  assertOracle(state.records.find((record) => record.step_id === later.step_id), later);
  assert.deepEqual(state.invalidations, []);
});

test("P-map failed K2a prerequisite contains the U2 dependency fault while independent unlock still proceeds", async () => {
  const { state } = kuFixture();
  const construct = state.c;
  state.c = (name, ...args) => {
    if (state.current === "K2a") throw new Error("fixture-lock-prerequisite-abort");
    return construct(name, ...args);
  };
  const lock = await lockoutWorkload(state);
  await unlockWorkload(state, lock);
  assert.equal(lock, undefined);
  assert.deepEqual(state.case_aborts, ["K2a", "U2"]);
  assertPlan(state, UNLOCK_CASES[0]);
  assert.deepEqual(state.invalidations, []);
});

test("P-map K2a absent live dependency aborts only U2, without synthesizing a lock", async () => {
  const { state } = kuFixture();
  await unlockWorkload(state, undefined, [UNLOCK_CASES[1], UNLOCK_CASES[0]]);
  assert.equal(state.accounting[0].case_aborted, true);
  assert.equal(state.accounting[0].public_calls, 0);
  assertPlan(state, UNLOCK_CASES[0]);
  assert.deepEqual(state.invalidations, []);
});

test("P-map K/U sticky exhaustion stops remaining cases", async () => {
  const { state } = kuFixture({ budget: 10 });
  await assert.rejects(() => lockoutWorkload(state), /occurrence budget exhausted/);
  assert.throws(() => state.ledger.assertAvailable(), /occurrence budget exhausted/);
  assert(!state.accounting.some((row) => row.case_id === "K4"));
});
