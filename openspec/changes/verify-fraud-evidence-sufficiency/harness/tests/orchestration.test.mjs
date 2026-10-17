import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runSession } from "../p-ids/orchestrate.mjs";
import { deleteScratch } from "../lib/kit-pipeline.mjs";
import { jsonFile } from "../lib/io.mjs";
import { serializeResults } from "../lib/results.mjs";
import { fixtureResult } from "./results-fixture.mjs";
import { emissions } from "../p-ids/workload.mjs";
import { callRecorder } from "../lib/observe.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";

const EXPECTATIONS = jsonFile(new URL("../expectations/p-ids.v1.json", import.meta.url));
const STOPS = ["setup", "core-A", "core-B"];

for (const stoppedRole of STOPS) {
  test(`fixture refusal at ${stoppedRole} stops future roles, cleans before writing and returns nonzero`, async () => {
    const scratch = mkdtempSync(join(tmpdir(), "pids-stop-fixture-"));
    const spawned = [];
    let written;
    const pipeline = async (consume) => {
      const provenance = { invalidations: [] };
      try {
        provenance.observations = await consume({});
      } finally {
        provenance.scratch_deletion = deleteScratch({ scratch });
      }
      return provenance;
    };
    const prepare = () => ({ role, budget }) => {
      spawned.push(role);
      return { role, outcomes: [{ accepted: role !== stoppedRole }], invalidations: role === stoppedRole ? ["fixture precondition refused"] : [], ledger: { budget, occurrence_count: 1 } };
    };
    const write = ({ observations, invalidations, provenance, occurrence_count }) => {
      assert(!existsSync(scratch), "cleanup must precede results write");
      written = JSON.parse(serializeResults(fixtureResult({ provenance, invalidations, occurrenceCount: occurrence_count, cases: [{ case_id: "fixture", raw: observations, matched: false, notes: [] }] })));
    };
    const session = await runSession({ pipeline, prepare, expectations: EXPECTATIONS, write });
    assert.equal(session.exitCode, 1);
    assert.equal(spawned.at(-1), stoppedRole);
    assert.equal(written.invalidations.length, 1);
    assert.equal(written.cases[0].raw.length, spawned.length);
    assert(written.scratch_deletion.recursively_absent);
  });
}

test("every P-ids-01 refusal stops the local sequence at its first failed call", async () => {
  for (const refusedAt of [0, 50, 99]) {
    const ledger = occurrenceLedger({ budget: 100 });
    const state = { ledger, recorder: callRecorder({ ledger }), invalidations: [] };
    let calls = 0;
    const sdk = { authenticationFailed: async () => calls++ === refusedAt ? { ok: false, error: { code: "FIXTURE_REFUSED", category: "validation", path: "/fixture" } } : { ok: true, value: { status: "accepted" } } };
    const passed = await emissions({ state, sdk, input: {}, count: 100, stopOnRefusal: true });
    assert.equal(passed, false);
    assert.equal(calls, refusedAt + 1);
    assert.equal(state.invalidations.length, 1);
  }
});

test("fixture mismatches are findings and do not fail an otherwise valid session", async () => {
  let written;
  const session = await runSession({
    expectations: EXPECTATIONS,
    pipeline: async () => ({ invalidations: [], observations: { observations: [], invalidations: [], occurrence_count: 0 } }),
    prepare: () => { throw new Error("fixture must not spawn"); },
    write: (result) => {
      written = fixtureResult({ ...result, cases: [{ case_id: "P-ids-01", raw: {}, matched: false, notes: ["fixture mismatch"] }] });
    },
  });
  assert.equal(session.exitCode, 0);
  assert.equal(written.cases[0].matched, false);
  assert.deepEqual(written.invalidations, []);
});

test("orchestration imports have no automatic execution or kit imports", () => {
  const source = readFileSync(new URL("../p-ids/run-p-ids.mjs", import.meta.url), "utf8");
  assert(source.includes("await runApprovedSession({"));
  assert(source.includes("process.exitCode = session.exitCode;"));
  assert(!source.includes("cases.some("));
  assert(!source.includes('from "@bloodtrail/'));
});
