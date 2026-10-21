import assert from "node:assert/strict";
import test from "node:test";
import { BRAND_CASES, CONTACT_CASES } from "../p-map/contact-cases.mjs";
import { brandWorkload, contactWorkload } from "../p-map/contact-workload.mjs";
import { observations } from "../p-map/runtime.mjs";
import { assertOracle } from "./p-map-lm-oracle.mjs";
import { CX_ORACLE } from "./p-map-cx-oracle.mjs";
import { cxFixture } from "./p-map-cx-fixtures.mjs";

const FAMILIES = [
  { cases: CONTACT_CASES, run: contactWorkload, calls: 149 },
  { cases: BRAND_CASES, run: brandWorkload, calls: 11 },
];

function checkPlan(state, entry) {
  const accounting = state.accounting.find((row) => row.case_id === entry.case_id);
  assert.equal(accounting.public_calls, entry.predicted_calls);
  assert.deepEqual(accounting.notes, []);
  assert.deepEqual(accounting.steps, entry.steps.map((step) => `${entry.case_id}/${step}`));
  for (const variant of accounting.variants) assert.equal(variant.public_calls, variant.predicted_calls, variant.variant_id);
  assert.equal(accounting.variants.reduce((sum, row) => sum + row.public_calls, 0), accounting.public_calls);
}

for (const family of FAMILIES) {
  for (const entry of family.cases) test(`P-map ${entry.case_id} matches independent source-cited C/X oracle and predictions`, async () => {
    const { state } = cxFixture();
    await family.run(state, [entry]);
    assert.deepEqual(state.case_aborts, []);
    for (const row of CX_ORACLE.filter((item) => item.step_id.startsWith(`${entry.case_id}/`))) {
      assertOracle(state.records.find((item) => item.step_id === row.step_id), row);
    }
    checkPlan(state, entry);
    assert.deepEqual(state.invalidations, []);
  });

  test(`P-map ${family.cases[0].case_id} family records all counted public calls and frozen captures`, async () => {
    const { state } = cxFixture();
    await family.run(state);
    assert.equal(state.ledger.report().occurrence_count, family.calls);
    assert.equal(new Set(state.records.map((row) => row.step_id)).size, state.records.length);
    for (const row of state.records) {
      assert.equal(row.sink_count, row.captures.length);
      for (const capture of row.captures) {
        assert.equal(capture.frozen, true);
        assert(Object.isFrozen(capture.event));
      }
    }
    assert.doesNotThrow(() => JSON.stringify(observations(state)));
  });
}

const MUTATIONS = [
  { step_id: "C2a/object-kind", mutate: (row) => { row.signal.categories_preserved = false; } },
  { step_id: "C2a/bytes-8193", mutate: (row) => { row.diagnostic.path = "/resource/change_categories"; } },
  { step_id: "C2b/items-17", mutate: (row) => { row.sink_count = 1; } },
  { step_id: "C5/enrolled", mutate: (row) => { row.replacement.shared_transaction_id = false; } },
  { step_id: "X1/spread", mutate: (row) => { row.diagnostic.code = "DUPLICATE_AUTHORITY"; } },
];

for (const mutation of MUTATIONS) test(`P-map independent C/X oracle rejects mutation ${mutation.step_id}`, async () => {
  const { state } = cxFixture();
  await contactWorkload(state);
  await brandWorkload(state);
  const row = CX_ORACLE.find((item) => item.step_id === mutation.step_id);
  const record = structuredClone(state.records.find((item) => item.step_id === row.step_id));
  mutation.mutate(record);
  assert.throws(() => assertOracle(record, row), assert.AssertionError);
});

for (const aborted of ["C1", "X1"]) test(`P-map ${aborted} unexpected construction fault stays owned and next case proceeds`, async () => {
  const { state } = cxFixture();
  const construct = state.c;
  state.c = (name, ...args) => {
    if (state.current === aborted) throw new Error("fixture-cx-construction-abort");
    return construct(name, ...args);
  };
  await brandWorkload(state);
  await contactWorkload(state);
  const accounting = state.accounting.find((row) => row.case_id === aborted);
  assert.equal(accounting.matched, false);
  assert.equal(accounting.case_aborted, true);
  assert(state.records.some((row) => row.step_id === `${aborted}/aborted`));
  const later = CX_ORACLE.find((row) => row.step_id === "C2b/items-17");
  assertOracle(state.records.find((row) => row.step_id === later.step_id), later);
  assert.deepEqual(state.invalidations, []);
});
