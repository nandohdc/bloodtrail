import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { scratchSession } from "../lib/kit-pipeline.mjs";
import { launchProbe } from "../lib/launcher.mjs";
import { runSession } from "../lib/orchestrate.mjs";
import { fixtureResult } from "./results-fixture.mjs";
import { launchFixture, observedFixture, permissionFixture } from "./p-e-permission-fixtures.mjs";

const EXPECTATIONS = { planned_occurrence_budget: { total: 4, processes: { first: 2, second: 2 } } };
const ROLES = [{ role: "first" }, { role: "second" }];
const PHASES = ["success", "preparation", "launch"];

function spawnFixture(fixture, phase) {
  return ({ role, budget }) => launchProbe({ ...launchFixture(fixture), role, budget, run: () => {
    if (phase === "launch" && role === "second") throw new Error("opaque launch failure");
    return JSON.stringify({ ...observedFixture(fixture), role });
  } });
}

function prepareFixture(fixture, phase) {
  if (phase === "preparation") throw new Error("opaque preparation failure");
  return spawnFixture(fixture, phase);
}

for (const phase of PHASES) {
  test(`database ancestor removed after ${phase}, keeping permissions, install and prior observations`, async (t) => {
    const f = permissionFixture(t);
    writeFileSync(join(f.database.directory, "opaque.sqlite"), "synthetic fixture");
    const provenance = { ...fixtureResult().kit_identity, install: { fixture: true }, permission_flags: f.flags, invalidations: [] };
    let written;
    const session = await runSession({
      probe: "P-E", ticket: 803, roles: ROLES, expectations: EXPECTATIONS,
      pipeline: (consume) => scratchSession({ scratch: f.scratch, result: provenance, work: async () => {
        provenance.observations = await consume({ scratch: f.scratch, database: f.database, provenance });
      } }),
      prepare: ({ scratch, database }) => {
        assert.equal(scratch, f.scratch);
        assert.equal(database.directory, f.database.directory);
        return prepareFixture(f, phase);
      },
      write: (input) => { written = fixtureResult({ ...input, occurrenceCount: input.occurrence_count, cases: input.observations }); },
    });
    assert.equal(existsSync(f.scratch), false);
    assert.equal(provenance.scratch_deletion.recursively_absent, true);
    assert.deepEqual(written.permission_flags, ["--permission", `--allow-fs-read=${f.service}`, `--allow-fs-write=${f.database.directory}`]);
    assert.deepEqual(written.install, { fixture: true });
    checkOutcome({ phase, session, written });
  });
}

function checkOutcome({ phase, session, written }) {
  if (phase === "success") {
    assert.equal(session.exitCode, 0);
    assert.equal(written.cases.length, 2);
    return;
  }
  assert.equal(session.exitCode, 1);
  assert.match(written.invalidations[0].message, new RegExp(`opaque ${phase} failure`));
  if (phase === "launch") assert.deepEqual(written.cases[0].outcomes, [{ raw: "opaque-observation" }]);
}
