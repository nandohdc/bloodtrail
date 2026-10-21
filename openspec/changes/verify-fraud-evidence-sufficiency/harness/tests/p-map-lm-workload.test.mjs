import assert from "node:assert/strict";
import test from "node:test";
import { LOGOUT_CASES } from "../p-map/logout-cases.mjs";
import { MFA_CASES } from "../p-map/mfa-cases.mjs";
import { logoutWorkload } from "../p-map/logout-workload.mjs";
import { mfaWorkload } from "../p-map/mfa-workload.mjs";
import { observations } from "../p-map/runtime.mjs";
import { LM_ORACLE, assertOracle } from "./p-map-lm-oracle.mjs";
import { lmFixture } from "./p-map-lm-fixtures.mjs";

const FAMILIES = [
  { name: "logout", cases: LOGOUT_CASES, run: logoutWorkload, calls: 118, aborted: "L1", later: "L2/no-handle" },
  { name: "MFA", cases: MFA_CASES, run: mfaWorkload, calls: 56, aborted: "M1", later: "M2/resolved-subject" },
];

function oracleFor(case_id) {
  return LM_ORACLE.filter((row) => row.step_id.startsWith(`${case_id}/`));
}

function assertAccounting(state, entry) {
  const row = state.accounting.find((item) => item.case_id === entry.case_id);
  assert.equal(row.public_calls, entry.predicted_calls);
  assert.deepEqual(row.notes, []);
  assert.deepEqual(row.steps, entry.steps.map((id) => `${entry.case_id}/${id}`));
  for (const variant of row.variants) assert.equal(variant.public_calls, variant.predicted_calls, variant.variant_id);
  assert.equal(row.variants.reduce((sum, variant) => sum + variant.public_calls, 0), row.public_calls);
}

for (const family of FAMILIES) {
  for (const entry of family.cases) test(`P-map ${entry.case_id} observes independently cited public outcomes and call predictions`, async () => {
    const { state } = lmFixture();
    await family.run(state, [entry]);
    assert.deepEqual(state.case_aborts, []);
    for (const row of oracleFor(entry.case_id)) assertOracle(state.records.find((record) => record.step_id === row.step_id), row);
    assertAccounting(state, entry);
    assert.deepEqual(state.invalidations, []);
  });

  test(`P-map ${family.name} retains unique owned steps, frozen captures and complete counters`, async () => {
    const { state } = lmFixture();
    await family.run(state);
    assert.equal(state.ledger.report().occurrence_count, family.calls);
    assert.equal(new Set(state.records.map((record) => record.step_id)).size, state.records.length);
    for (const record of state.records) {
      assert.equal(record.sink_count, record.captures.length);
      for (const capture of record.captures) {
        assert.equal(capture.frozen, true);
        assert(Object.isFrozen(capture.event));
      }
    }
    assert.doesNotThrow(() => JSON.stringify(observations(state)));
  });

  test(`P-map ${family.name} contains unexpected construction abort and continues the next case`, async () => {
    const { state } = lmFixture();
    const construct = state.c;
    state.c = (name, ...args) => {
      if (state.current === family.aborted) throw new Error("fixture-unexpected-construction-abort");
      return construct(name, ...args);
    };
    await family.run(state);
    assert.deepEqual(state.case_aborts, [family.aborted]);
    const row = state.accounting.find((item) => item.case_id === family.aborted);
    assert.equal(row.matched, false);
    assert.equal(row.case_aborted, true);
    assert(state.records.some((record) => record.step_id === `${family.aborted}/aborted`));
    const later = LM_ORACLE.find((item) => item.step_id === family.later);
    assertOracle(state.records.find((record) => record.step_id === family.later), later);
    assert.deepEqual(state.invalidations, []);
  });
}

const MUTATIONS = [
  { step_id: "L5a/denied-no-handle", mutate: (record) => { record.diagnostic.path = "/event/commit_state"; } },
  { step_id: "M1/tenantless", mutate: (record) => { record.signal.subject_present = true; } },
];

for (const mutation of MUTATIONS) test(`P-map independent oracle rejects negative mutation ${mutation.step_id}`, async () => {
  const { state } = lmFixture();
  await logoutWorkload(state);
  await mfaWorkload(state);
  const row = LM_ORACLE.find((item) => item.step_id === mutation.step_id);
  const record = structuredClone(state.records.find((item) => item.step_id === mutation.step_id));
  mutation.mutate(record);
  assert.throws(() => assertOracle(record, row), assert.AssertionError);
});
