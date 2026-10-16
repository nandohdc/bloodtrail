import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deliverResults } from "../lib/results.mjs";
import { finalizeScratch } from "../lib/kit-pipeline.mjs";
import { jsonFile } from "../lib/io.mjs";
import { runApprovedSession, runSession } from "../p-ids/orchestrate.mjs";
import { fixtureResult } from "./results-fixture.mjs";
import { preflightFixture } from "./approval-fixture.mjs";

const EXPECTATIONS = jsonFile(new URL("../expectations/p-ids.v1.json", import.meta.url));

function evidenceFixture() {
  const record = fixtureResult();
  return {
    identity: { ...record.kit_identity }, install: record.install, invalidations: [],
    observations: { observations: [{ role: "fixture", outcomes: [{ raw: "opaque observation" }] }], invalidations: [], occurrence_count: 1 },
  };
}

function evidenceRecord({ provenance, observations, invalidations, occurrence_count }) {
  return fixtureResult({ provenance, invalidations, occurrenceCount: occurrence_count,
    cases: [{ case_id: "fixture", raw: observations, matched: false, notes: [] }],
  });
}

test("post-claim exclusive-write failure emits complete JSON once, retains marker and exits nonzero", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pids-write-fixture-"));
  try {
    const fixture = preflightFixture({ directory });
    const provenance = evidenceFixture();
    let attempts = 0;
    let stderr;
    const outcome = await runApprovedSession({ ...fixture,
      session: () => runSession({ expectations: EXPECTATIONS, pipeline: async () => provenance,
        prepare: () => assert.fail("no real pipeline"),
        write: (result) => deliverResults({ path: fixture.options.results, result: evidenceRecord(result),
          write: () => { attempts += 1; throw new Error("fixture disk failure"); }, stderr: (text) => { stderr = text; },
        }),
      }),
      failure: () => assert.fail("write failure must not escape and retry"), refuse: () => assert.fail("fixture preflight must pass"),
    });
    assert.equal(outcome.exitCode, 1);
    assert.equal(attempts, 1);
    assert(existsSync(fixture.options["once-marker"]));
    assert(!existsSync(fixture.options.results));
    const record = JSON.parse(stderr);
    assert.deepEqual(record.install, provenance.install);
    assert.deepEqual(record.cases[0].raw, provenance.observations.observations);
    assert.deepEqual(record.kit_identity.artifacts, provenance.identity.artifacts);
    assert.match(record.invalidations[0], /results write failed: fixture disk failure/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("scratch deletion failure invalidates the same evidence object without replacing observations or install", async () => {
  const provenance = evidenceFixture();
  const original = structuredClone(provenance);
  let written;
  const outcome = await runSession({ expectations: EXPECTATIONS, prepare: () => assert.fail("no kit pipeline"),
    pipeline: async () => finalizeScratch({ result: provenance, scratch: "/fixture/scratch", remove: () => { throw new Error("fixture remover failure"); } }),
    write: (result) => { written = evidenceRecord(result); },
  });
  assert.equal(outcome.exitCode, 1);
  assert.equal(outcome.result.provenance, provenance);
  assert.deepEqual(provenance.observations, original.observations);
  assert.deepEqual(written.install, original.install);
  assert.deepEqual(written.kit_identity.artifacts, original.identity.artifacts);
  assert.equal(written.scratch_deletion.recursively_absent, false);
  assert.equal(written.invalidations[0].message, "scratch deletion failed: fixture remover failure");
});
