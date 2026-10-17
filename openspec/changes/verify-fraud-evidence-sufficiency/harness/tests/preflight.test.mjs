import assert from "node:assert/strict";
import test from "node:test";
import { chmodSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runApprovedSession } from "../p-ids/orchestrate.mjs";
import { writeResults } from "../lib/results.mjs";
import { fixtureResult } from "./results-fixture.mjs";
import { approvalBody, preflightFixture, setApproval } from "./approval-fixture.mjs";

const REFUSALS = [
  ["dirty", ({ options }) => writeFileSync(join(options.repo, "dirty"), "fixture\n"), /clean tree/],
  ["wrong checkout head", ({ options }) => { options.approvedHead = "1".repeat(40); setApproval({ options }); }, /HEAD must equal/],
  ["invalid head", ({ options }) => { options.approvedHead = "invalid"; setApproval({ options }); }, /invalid approved head/],
  ["existing results", ({ options }) => writeFileSync(options.results, "preserve fixture\n"), /already exists/],
  ["missing results parent", ({ options }) => { options.results = join(options.control, "missing/results"); }, /ENOENT/],
  ["unwritable results parent", ({ options }) => {
    const parent = join(options.control, "locked"); mkdirSync(parent); chmodSync(parent, 0o555); options.results = join(parent, "results");
  }, /EACCES/],
  ["marker basename", ({ options }) => { options["once-marker"] = join(options.control, "wrong"); }, /basename/],
  ["inside marker", ({ options }) => { options["once-marker"] = join(options.repo, options["approval-sha256"]); }, /outside repository/],
  ["symlink marker", ({ options }) => {
    const alias = join(options.control, "alias"); symlinkSync(options.repo, alias); options["once-marker"] = join(alias, options["approval-sha256"]);
  }, /outside repository/],
  ["negated body", ({ options }) => setApproval({ options, body: `NOT approving ${options.approvedHead}` }), /approval line/],
  ["other body", ({ options }) => setApproval({ options, body: `text ${approvalBody({ head: options.approvedHead })}` }), /approval line/],
  ["wrong run", ({ options }) => setApproval({ options, body: approvalBody({ head: options.approvedHead, run: 2 }) }), /approval line/],
  ["wrong approval head", ({ options }) => setApproval({ options, body: approvalBody({ head: "2".repeat(40) }) }), /approval line/],
  ["edited", ({ options }) => { options["approval-updated-at"] = "2026-10-16T00:00:01.000Z"; }, /edited/],
  ["predates window", ({ options }) => { options["window-opened-at"] = "2026-10-16T00:00:01.000Z"; }, /predates/],
  ["expired window", (fixture) => { fixture.now += 7 * 86400000; }, /expired/],
  ["other executing checkout", (fixture) => {
    const directory = join(fixture.options.control, "other"); mkdirSync(directory); fixture.entrypoint = preflightFixture({ directory }).entrypoint;
  }, /executing checkout/],
];

for (const [label, patch, message] of REFUSALS) {
  test(`preclaim refusal: ${label} leaves marker/results absent or unchanged`, async () => {
    const directory = mkdtempSync(join(tmpdir(), "pids-preflight-fixture-"));
    try {
      const fixture = preflightFixture({ directory });
      patch(fixture);
      let refusal;
      const result = await runApprovedSession({ ...fixture,
        session: () => assert.fail("must not claim"), failure: () => assert.fail("must not enter failure handler"),
        refuse: (reason) => { refusal = reason; },
      });
      assert.equal(result.exitCode, 1);
      assert.match(refusal, message);
      assert(!existsSync(fixture.options["once-marker"]));
      checkExistingResult({ label, path: fixture.options.results });
    } finally {
      const locked = join(directory, "locked");
      if (existsSync(locked)) chmodSync(locked, 0o755);
      rmSync(directory, { recursive: true, force: true });
    }
  });
}

function checkExistingResult({ label, path }) {
  if (label === "existing results") assert.equal(readFileSync(path, "utf8"), "preserve fixture\n");
  else assert(!existsSync(path));
}

test("post-claim failure retains marker and writes a structured invalidation", async () => {
  const directory = mkdtempSync(join(tmpdir(), "pids-claimed-fixture-"));
  try {
    const fixture = preflightFixture({ directory });
    const result = await runApprovedSession({ ...fixture,
      session: () => { throw new Error("fixture post-claim failure"); },
      failure: ({ error, approval }) => writeResults({ path: fixture.options.results, result: fixtureResult({ approval, invalidations: [error.message] }) }),
      refuse: () => assert.fail("preflight must pass"),
    });
    assert.equal(result.exitCode, 1);
    assert(existsSync(fixture.options["once-marker"]));
    assert.deepEqual(JSON.parse(readFileSync(fixture.options.results, "utf8")).invalidations, ["fixture post-claim failure"]);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
