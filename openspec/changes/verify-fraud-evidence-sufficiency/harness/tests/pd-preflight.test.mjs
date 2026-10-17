import assert from "node:assert/strict";
import { test } from "node:test";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runApprovedSession } from "../lib/orchestrate.mjs";
import { preflightFixture, setApproval } from "./approval-fixture.mjs";

async function withApproval(fn) {
  const directory = mkdtempSync(join(tmpdir(), "pd-preflight-"));
  try {
    const fixture = preflightFixture({ directory });
    const body = `S1 approval: P-D run 1 for #801 at ${fixture.options.approvedHead}\nDelegated S1 under G39`;
    setApproval({ options: fixture.options, body });
    fixture.options["approval-url"] = "https://github.com/nandohdc/bloodtrail/issues/801#issuecomment-1";
    return await fn({ ...fixture, probe: "P-D", ticket: 801 });
  } finally { rmSync(directory, { recursive: true, force: true }); }
}

const FAULTS = [
  ["dirty tree", (f) => writeFileSync(join(f.options.repo, "dirty"), "fixture\n"), /clean tree/],
  ["head", (f) => { f.options.approvedHead = "1".repeat(40); }, /approval line/],
  ["results", (f) => writeFileSync(f.options.results, "existing\n"), /already exists/],
  ["marker name", (f) => { f.options["once-marker"] += "wrong"; }, /basename/],
  ["marker location", (f) => { f.options["once-marker"] = join(f.options.repo, f.options["approval-sha256"]); }, /outside repository/],
  ["window", (f) => { f.now += 7 * 86400000; }, /expired/],
  ["checkout", (f) => { f.entrypoint = import.meta.url; }, /executing checkout/],
];
for (const [label, mutate, message] of FAULTS) {
  test(`P-D ${label} refuses before claiming`, () => withApproval(async (fixture) => {
    mutate(fixture);
    let reason;
    await runApprovedSession({ ...fixture, session: () => assert.fail("no claim"), failure: () => assert.fail("no post-claim failure"), refuse: (text) => { reason = text; } });
    assert.match(reason, message);
    assert.equal(existsSync(fixture.options["once-marker"]), false);
  }));
}

test("P-D full tracked inventory precedes claim, delegated marker survives and cannot repeat", () => withApproval(async (fixture) => {
  let inventory;
  const session = await runApprovedSession({ ...fixture,
    session: (approval, hashes) => { assert.equal(approval.delegation, "G39"); inventory = hashes; return { exitCode: 0 }; },
    failure: () => assert.fail("no failure"), refuse: () => assert.fail("must approve"),
  });
  assert.equal(session.exitCode, 0);
  assert.equal(Object.keys(inventory).length, 2);
  assert(existsSync(fixture.options["once-marker"]));
  let reason;
  await runApprovedSession({ ...fixture, session: () => assert.fail("never reuse approval"), failure: () => assert.fail("preclaim"), refuse: (text) => { reason = text; } });
  assert.match(reason, /once-marker already exists/);
}));
