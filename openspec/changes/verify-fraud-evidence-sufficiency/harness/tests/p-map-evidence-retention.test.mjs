import assert from "node:assert/strict";
import test from "node:test";
import { existsSync } from "node:fs";
import { runApprovedSession } from "../lib/orchestrate.mjs";
import { writeSession } from "../lib/probe-runner.mjs";
import { jsonFile } from "../lib/io.mjs";
import { CHANGE } from "../lib/results.mjs";
import { OPENED, withApproved, capturedPlan } from "./p-map-runner-fixtures.mjs";
import { retainedSession, RAW_PROCESS } from "./p-map-retention-fixtures.mjs";

const STAGES = ["build", "identity", "install", "launch", "evaluation", "cleanup", "write"];
for (const stage of STAGES) {
  test(`P-map claimed ${stage} failure keeps identity/install, approval marker and every available observation`, () => withApproved(async (fixture) => {
    let retained;
    await runApprovedSession({ ...fixture, session: async (approval, hashes) => {
      retained = await retainedSession({ fixture, approval, hashes, stage });
      return retained.session;
    }, failure: () => assert.fail("injected failure must be retained"), refuse: () => assert.fail("valid approval") });
    const { evidence, session } = retained;
    assert.equal(session.exitCode, 1);
    assert(existsSync(fixture.options["once-marker"]));
    assert.equal(evidence.approval.delegation, "G39");
    assert.equal(evidence.kit_identity.commit, fixture.options.approvedHead);
    assert.equal(evidence.kit_identity.distributable, true);
    assert.deepEqual(evidence.install.single_core, { npm_ls_paths: ["fixture/core"], filesystem_paths: ["fixture/core"] });
    assert.equal(Object.keys(evidence.executed_file_hashes).length, 2);
    assert(evidence.invalidations.length > 0);
    const expected = ["evaluation", "cleanup", "write"].includes(stage) ? [RAW_PROCESS] : [];
    assert.deepEqual(evidence.process_observations, expected);
    if (stage === "write") assert.deepEqual(retained.fallback, evidence, "stderr fallback keeps the ENTIRE result");
  }));
}

test("P-map shared writeSession retains raw process and baseline ownership if evaluation unexpectedly throws", () => withApproved(async (fixture) => {
  const { plan } = await capturedPlan();
  const context = { options: fixture.options, plan: { ...plan, evaluate: () => { throw new Error("fixture evaluation defect"); } },
    started: OPENED, expectationsPath: `${CHANGE}/harness/expectations/p-map.v1.json`, expectationHash: "e".repeat(64),
    hashes: { "p-map/fixture": "retained" }, approval: { delegation: "G39" }, expectations: {}, attempted: false };
  const invalidations = [];
  assert.equal(writeSession(context, { provenance: { identity: { commit: fixture.options.approvedHead }, install: { fixture: true } },
    observations: [RAW_PROCESS], invalidations, occurrence_count: 1 }), true);
  assert.equal(context.attempted, true);
  const written = jsonFile(fixture.options.results);
  assert.deepEqual(written.process_observations, [RAW_PROCESS]);
  assert.equal(written.kit_identity.commit, fixture.options.approvedHead);
  assert.deepEqual(written.install, { fixture: true });
  assert.equal(invalidations[0].attribution, "harness_fault");
  assert.match(invalidations[0].message, /evaluation fault/);
}));
