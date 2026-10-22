import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { approvalRecord, approvalFromArgs } from "../lib/approval.mjs";
import { resultRecord } from "../lib/results.mjs";
import { runRoles, runSession } from "../lib/orchestrate.mjs";
import { runProbe } from "../lib/probe-runner.mjs";
import { launchProbe } from "../lib/launcher.mjs";

const SYNC_APIS = [["approval record", approvalRecord], ["approval arguments", approvalFromArgs], ["result record", resultRecord]];
const ASYNC_APIS = [["roles", runRoles], ["session", runSession], ["probe", runProbe]];
const MISSING_IDENTITY = [[{ ticket: 801 }, /probe is required/], [{ probe: "P-D" }, /ticket is required/]];
for (const [label, fn] of SYNC_APIS) {
  test(`generic ${label} never infers probe identity`, () => {
    for (const [input, reason] of MISSING_IDENTITY) assert.throws(() => fn(input), reason);
  });
}
for (const [label, fn] of ASYNC_APIS) {
  test(`generic ${label} validates identity and roles before side effects`, async () => {
    for (const [input, reason] of MISSING_IDENTITY) await assert.rejects(() => fn(input), reason);
    await assert.rejects(() => fn({ probe: "P-D", ticket: 801 }), /roles are required/);
  });
}

const BAD_DIRECTORIES = ["../p-d", "p-d/next", "P-D", "p-123", "p-d.mjs", "p-"];
test("launcher accepts a new inventory-approved directory without a hard-coded allowlist", () => {
  const service = mkdtempSync(join(tmpdir(), "pd-launcher-"));
  try {
    mkdirSync(join(service, "fixture"));
    const core = join(service, "fixture/core.mjs");
    writeFileSync(core, "// opaque fixture, never imported\n");
    const prefix = "approved/harness";
    const inventory = { [`${prefix}/p-next/probe-process.mjs`]: { git_blob: "fixture", sha256: "fixture" } };
    const observed = { role: "fixture", resolved_core: pathToFileURL(core).href, ledger: { occurrence_count: 1 } };
    let calls = 0;
    const input = { service, role: "fixture", budget: 2, flags: ["--permission", `--allow-fs-read=${service}`], probeDirectory: "p-next", prefix, inventory,
      run: ({ args }) => {
        calls += 1;
        assert.equal(args[2], join(service, "harness/p-next/probe-process.mjs"));
        return JSON.stringify(observed);
      },
    };
    assert.deepEqual(launchProbe(input), observed);
    for (const probeDirectory of BAD_DIRECTORIES) assert.throws(() => launchProbe({ ...input, probeDirectory }), /invalid probe directory/);
    assert.throws(() => launchProbe({ ...input, probeDirectory: "p-absent" }), /absent from approved tracked inventory/);
    assert.throws(() => launchProbe({ ...input, inventory: {} }), /absent from approved tracked inventory/);
    assert.throws(() => launchProbe({ ...input, flags: [...input.flags, "--allow-fs-write=*"] }), /unexpected permission grant/);
    assert.equal(calls, 1, "all refusals precede spawn");
  } finally { rmSync(service, { recursive: true, force: true }); }
});
