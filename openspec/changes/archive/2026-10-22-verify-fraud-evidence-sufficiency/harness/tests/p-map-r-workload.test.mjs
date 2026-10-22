import assert from "node:assert/strict";
import test from "node:test";
import { ROTATION_CASES } from "../p-map/rotation-cases.mjs";
import { rotationWorkload } from "../p-map/rotation-workload.mjs";
import { observations } from "../p-map/runtime.mjs";
import { contactWorkload } from "../p-map/contact-workload.mjs";
import { CONTACT_CASES } from "../p-map/contact-cases.mjs";
import { CX_ORACLE } from "./p-map-cx-oracle.mjs";
import { assertOracle } from "./p-map-lm-oracle.mjs";
import { R_ORACLE } from "./p-map-r-oracle.mjs";
import { rotationFixture } from "./p-map-r-fixtures.mjs";

async function builtRotation(options) {
  const fixture = rotationFixture(options);
  await rotationWorkload(fixture.state);
  return fixture;
}

function assertCount(state, entry) {
  const accounting = state.accounting.find((row) => row.case_id === entry.case_id);
  assert.equal(accounting.public_calls, entry.predicted_calls, entry.case_id);
  assert.deepEqual(accounting.notes, []);
  assert.deepEqual(accounting.steps, entry.steps.map((id) => `${entry.case_id}/${id}`));
  assert.equal(accounting.variants.reduce((sum, row) => sum + row.public_calls, 0), entry.predicted_calls);
  for (const row of accounting.variants) assert.equal(row.public_calls, row.predicted_calls, row.variant_id);
}

for (const entry of ROTATION_CASES) test(`P-map ${entry.case_id} independent source oracle, owned steps and counted predictions`, async () => {
  const { state } = await builtRotation();
  const rows = R_ORACLE.filter((row) => row.step_id.startsWith(`${entry.case_id}/`));
  for (const row of rows) assertOracle(state.records.find((record) => record.step_id === row.step_id), row);
  assertCount(state, entry);
  assert.deepEqual(state.case_aborts, []);
  assert.deepEqual(state.invalidations, []);
});

for (const identityOffset of [0, 740]) test(`P-map R dynamic identities ${identityOffset} never enter expected literals`, async () => {
  const { state, inputs } = await builtRotation({ identityOffset });
  assert.equal(state.ledger.report().occurrence_count, 125);
  assert.equal(state.records.length, 30);
  assert.equal(inputs.length, 12);
  assert.equal(new Set(state.records.map((row) => row.step_id)).size, 30);
  for (const row of R_ORACLE) assertOracle(state.records.find((record) => record.step_id === row.step_id), row);
  for (const row of state.records) for (const capture of row.captures) {
    assert.equal(capture.frozen, true);
    assert(Object.isFrozen(capture.event));
  }
  assert.doesNotThrow(() => JSON.stringify(observations(state)));
});

const MUTATIONS = [
  { id: "R1/unlinked", mutate: (row) => { row.diagnostic.path = "/event/commit_state"; } },
  { id: "R2/pair-completed", mutate: (row) => { row.causality.original_event_matches_original = false; } },
  { id: "R3/completed", mutate: (row) => { row.causality.shared_operation_id = true; } },
  { id: "R4/service", mutate: (row) => { row.signal.resource_type = "account"; } },
  { id: "R5a/human", mutate: (row) => { row.sink_count = 1; } },
  { id: "R5b/administrator", mutate: (row) => { row.signal.actor_type = "authenticated_human"; } },
];
for (const { id, mutate } of MUTATIONS) test(`P-map R source oracle rejects negative mutation ${id}`, async () => {
  const { state } = await builtRotation();
  const record = structuredClone(state.records.find((row) => row.step_id === id));
  mutate(record);
  assert.throws(() => assertOracle(record, R_ORACLE.find((row) => row.step_id === id)), assert.AssertionError);
});

const PRECURSORS = [{ case_id: "R2", step: "pair-request" }, { case_id: "R3", step: "login" }];
for (const { case_id, step } of PRECURSORS) for (const kind of ["throw", "refuse", "no-capture"]) {
  test(`P-map ${case_id} ${kind} precursor stays local; later rotation and unrelated family continue`, async () => {
    const { state, inputs } = await builtRotation({ fault: { case_id, index: 0, kind } });
    const accounting = state.accounting.find((row) => row.case_id === case_id);
    assert.equal(accounting.matched, false);
    assert.equal(accounting.case_aborted, true);
    assert(state.records.some((row) => row.step_id === `${case_id}/aborted`));
    assert(state.records.some((row) => row.step_id === `${case_id}/${step}`));
    assert(!inputs.some((row) => row.case_id === case_id && row.method === "passwordResetCompleted"));
    const forbidden = case_id === "R2" ? "pair-mark" : "begin";
    assert(!state.records.some((row) => row.step_id === `${case_id}/${forbidden}`));
    assertCount(state, ROTATION_CASES.find((row) => row.case_id === "R4"));
    const oracle = R_ORACLE.find((row) => row.step_id === "R5b/administrator");
    assertOracle(state.records.find((row) => row.step_id === oracle.step_id), oracle);
    await contactWorkload(state, [CONTACT_CASES[0]]);
    assertCount(state, CONTACT_CASES[0]);
    const contact = CX_ORACLE.find((row) => row.step_id === "C1/email");
    assertOracle(state.records.find((row) => row.step_id === contact.step_id), contact);
    assert.deepEqual(state.invalidations, []);
  });
}

test("P-map R sticky exhaustion halts cases instead of becoming an ordinary aborted precursor", async () => {
  const { state } = rotationFixture({ budget: 14 });
  await assert.rejects(() => rotationWorkload(state), /occurrence budget exhausted/);
  assert.throws(() => state.ledger.assertAvailable(), /occurrence budget exhausted/);
  assert(!state.accounting.some((row) => row.case_id === "R4"));
});
