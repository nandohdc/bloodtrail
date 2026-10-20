import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { writeSession } from "../lib/probe-runner.mjs";
import { fixtureObservations } from "./p-e-evaluator-records.mjs";

function faultyEvaluation() {
  throw new Error("synthetic evaluator fault");
}

test("shared guard invalidates an injected evaluator fault and writes every raw P-E process record", () => {
  const directory = mkdtempSync(join(tmpdir(), "pe-evaluation-retention-"));
  try {
    const results = join(directory, "result.json");
    const observations = fixtureObservations();
    const invalidations = [{ message: "prior fixture note", attribution: "harness_pipeline" }];
    const context = { plan: { probe: "P-E", ticket: 803, retainProcesses: true, evaluate: faultyEvaluation },
      options: { results, "run-number": "1", approvedHead: "a".repeat(40), driver: { harness: "fixture" } },
      started: "2026-10-20T00:00:00Z", expectations: {}, expectationHash: "b".repeat(64),
      expectationsPath: "fixture-only", approval: { delegation: "G39" }, hashes: {}, attempted: false };
    assert.equal(writeSession(context, { provenance: {}, observations, invalidations, occurrence_count: 0 }), true);
    const written = JSON.parse(readFileSync(results, "utf8"));
    assert.deepEqual(written.process_observations, observations);
    assert.deepEqual(written.cases, { evaluations: [], verdict: null });
    assert.equal(invalidations.length, 2);
    assert.match(invalidations[1].message, /evaluation fault: synthetic evaluator fault/);
    assert.equal(invalidations[1].attribution, "harness_fault");
    assert.deepEqual(written.invalidations, invalidations);
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
