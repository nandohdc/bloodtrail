import assert from "node:assert/strict";
import test from "node:test";
import { fixtureState } from "./process-fixture.mjs";
import { ROLES } from "../p-ids/roles.mjs";
import { measureRole } from "../p-ids/measure.mjs";
import { captureState } from "../p-ids/workload.mjs";
import { evaluateCases } from "../p-ids/evaluate.mjs";
import { runRoles } from "../p-ids/orchestrate.mjs";
import { jsonFile } from "../lib/io.mjs";

const EXPECTATIONS = jsonFile(new URL("../expectations/p-ids.v1.json", import.meta.url));
const ORDINARY = [
  { role: "core-E", refusalAt: 1, caseIndex: 4 },
  { role: "core-G", refusalAt: 2, caseIndex: 5 },
];
const CONTAINED = [
  { role: "core-C", budget: 3, plan: { operations: 1, randomProvider: true }, label: "beginOperation" },
  { role: "core-H", budget: 7, plan: { emissions: 1, randomProvider: true }, label: "authenticationFailed" },
];

async function observeFixture({ role, budget, patch = () => {}, plan = ROLES.find((entry) => entry.role === role) }) {
  const state = fixtureState({ role, budget });
  patch(state);
  await measureRole({ state, plan });
  return captureState({ state });
}

function refuseFactory({ state, refusalAt }) {
  const original = state.core.createSecurityAuditSdk;
  let calls = 0;
  state.core.createSecurityAuditSdk = (config) => {
    calls += 1;
    if (calls === refusalAt) throw Object.assign(new Error("fixture factory refusal"), { code: "FIXTURE_REFUSED", category: "configuration", path: "/fixture" });
    return original(config);
  };
}

for (const scenario of ORDINARY) {
  test(`ordinary ${scenario.role} factory refusal is a mismatch, not a run invalidation`, async () => {
    const result = await runRoles({ expectations: EXPECTATIONS, spawn: ({ role, budget }) => observeFixture({ role, budget,
      patch: (state) => { if (role === scenario.role) refuseFactory({ state, refusalAt: scenario.refusalAt }); },
    }) });
    assert.deepEqual(result.invalidations, []);
    assert.deepEqual(result.observations.map((entry) => entry.role), ROLES.map((entry) => entry.role));
    const observed = result.observations.find((entry) => entry.role === scenario.role);
    assert.equal(observed.outcomes.at(-1).raw.code, "FIXTURE_REFUSED");
    assert.equal(observed.refusals.length, 1);
    const evaluated = evaluateCases({ observations: result.observations, expectations: EXPECTATIONS });
    assert.equal(evaluated[scenario.caseIndex].matched, false);
    assert.match(evaluated[scenario.caseIndex].notes[0], /factory refused/);
  });
}

for (const scenario of CONTAINED) {
  test(`contained provider exhaustion in ${scenario.label} remains a global harness fault`, async () => {
    const result = await runRoles({ expectations: EXPECTATIONS, spawn: ({ role, budget }) => {
      if (role === scenario.role) return observeFixture({ role, budget: scenario.budget, plan: scenario.plan });
      return observeFixture({ role, budget });
    } });
    assert.deepEqual(result.invalidations, ["process occurrence budget exhausted in provider callback"]);
    const observed = result.observations.at(-1);
    assert.equal(observed.role, scenario.role);
    assert.equal(observed.ledger.occurrence_count, scenario.budget);
    assert.equal(observed.ledger.exhausted, true);
    const triggering = observed.outcomes.at(-1);
    assert.equal(triggering.label, scenario.label);
    assert.equal(triggering.raw.error.code, "SDK_INVALID_IDENTIFIER", "double contains callback throw");
    assert.equal(triggering.attribution, "harness_fault");
    assert(!Object.hasOwn(triggering, "diagnostic"), "not an SDK finding");
    assert.deepEqual(observed.refusals, []);
  });
}

for (const role of ["core-A", "core-B"]) {
  test(`${role} precondition factory refusal still invalidates globally`, async () => {
    const result = await runRoles({ expectations: EXPECTATIONS, spawn: (request) => observeFixture({ ...request,
      patch: (state) => { if (state.role === role) refuseFactory({ state, refusalAt: 1 }); },
    }) });
    assert.equal(result.observations.at(-1).role, role);
    assert.deepEqual(result.invalidations, ["measured factory refused"]);
  });
}
