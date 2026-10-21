import assert from "node:assert/strict";
import test from "node:test";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { approvalRecord } from "../lib/approval.mjs";
import { runApprovedSession } from "../lib/orchestrate.mjs";
import { command, sha256 } from "../lib/io.mjs";
import { CHANGE } from "../lib/results.mjs";
import { setApproval } from "./approval-fixture.mjs";
import { HEAD, OPENED, APPROVAL_URL, approvalBody, approvalArgs, withApproved } from "./p-map-runner-fixtures.mjs";

const APPROVAL_FAULTS = [
  ["probe", (options) => { options.probe = "P-E"; }, /approval line/],
  ["ticket", (options) => { options.ticket = 803; }, /approval line/],
  ["head", (options) => { options.approvedHead = "b".repeat(40); }, /approval line/],
  ["URL", (options) => { options.url = APPROVAL_URL.replace("/804#", "/803#"); }, /URL/],
  ["hash", (options) => { options.bodySha256 = "0".repeat(64); }, /sha256/],
  ["edited comment", (options) => { options.updatedAt = "2026-10-17T02:22:48Z"; }, /edited/],
  ["invalid timestamp", (options) => { options.createdAt = options.updatedAt = "2026-10-17T25:22:47Z"; }, /timestamp/],
  ["before window", (options) => { options.createdAt = options.updatedAt = "2026-10-16T02:22:47Z"; }, /predates/],
  ["expired window", (options) => { options.now += 7 * 86400000; }, /expired/],
  ["run cap", (options) => { options.runNumber = 11; }, /authorization/],
];
for (const [label, patch, message] of APPROVAL_FAULTS) {
  test(`P-map exact approval rejects wrong ${label} offline`, () => {
    const options = approvalArgs();
    patch(options);
    assert.throws(() => approvalRecord(options), message);
  });
}

test("P-map exact #804 delegated approval records G39, hash and timestamp/window without a request", () => {
  const args = approvalArgs();
  assert.deepEqual(approvalRecord(args), { url: APPROVAL_URL, createdAt: OPENED, updatedAt: OPENED,
    body_sha256: sha256(args.body), window_opened_at: OPENED, delegation: "G39" });
  args.body = args.body.replace("Delegated S1 under G39", "Delegated S1 under G39 extra");
  args.bodySha256 = sha256(args.body);
  assert.equal(approvalRecord(args).delegation, null, "an inexact marker cannot claim delegation");
});

function wrongHead(fixture) {
  fixture.options.approvedHead = HEAD;
  setApproval({ options: fixture.options, body: approvalBody(HEAD) });
}
function hiddenTrackedMutation(fixture) {
  const path = `${CHANGE}/harness/lib/parent.mjs`;
  command({ program: "git", args: ["update-index", "--assume-unchanged", path], cwd: fixture.options.repo });
  writeFileSync(join(fixture.options.repo, path), "// hidden fixture mutation\n");
}
const PREFLIGHT_FAULTS = [
  ["dirty checkout", (f) => writeFileSync(join(f.options.repo, "unexpected"), "fixture\n"), /clean tree/],
  ["wrong head", wrongHead, /HEAD must equal/],
  ["external checkout", (f) => { f.entrypoint = import.meta.url; }, /executing checkout/],
  ["occupied results", (f) => writeFileSync(f.options.results, "fixture\n"), /already exists/],
  ["in-repo marker", (f) => { f.options["once-marker"] = join(f.options.repo, f.options["approval-sha256"]); }, /outside repository/],
  ["wrong marker name", (f) => { f.options["once-marker"] += "wrong"; }, /basename/],
  ["hidden tracked mutation", hiddenTrackedMutation, /differs from approved Git blob/],
  ["runtime precondition", (f) => { f.runtimeCheck = () => { throw new Error("fixture runtime precondition"); }; }, /runtime precondition/],
  ["approval hash", (f) => { f.options["approval-sha256"] = "f".repeat(64); }, /sha256/],
];
for (const [label, patch, message] of PREFLIGHT_FAULTS) {
  test(`P-map ${label} refuses before durable claim and launch`, () => withApproved(async (fixture) => {
    patch(fixture);
    let refusal;
    const result = await runApprovedSession({ ...fixture, session: () => assert.fail("launch forbidden"),
      failure: () => assert.fail("claim forbidden"), refuse: (reason) => { refusal = reason; } });
    assert.equal(result.exitCode, 1);
    assert.match(refusal, message);
    assert.equal(existsSync(fixture.options["once-marker"]), false);
  }));
}

test("P-map complete tracked-blob inventory precedes a durable once-only delegated claim", () => withApproved(async (fixture) => {
  let entries;
  const execute = () => runApprovedSession({ ...fixture, session: (approval, hashes) => {
    assert.equal(approval.delegation, "G39");
    entries = Object.entries(hashes);
    assert.equal(readFileSync(fixture.options["once-marker"], "utf8"), `${fixture.options.approvedHead}\n`);
    return { exitCode: 0 };
  }, failure: () => assert.fail("no failure"), refuse: (reason) => ({ reason }) });
  assert.equal((await execute()).exitCode, 0);
  assert.equal(entries.length, 2, "EVERY tracked fixture harness file, not only entrypoint");
  for (const [path, evidence] of entries) {
    assert.match(evidence.git_blob, /^[0-9a-f]{40}$/);
    assert.equal(evidence.sha256, sha256(readFileSync(join(fixture.options.repo, path))));
  }
  const repeated = await execute();
  assert.equal(repeated.exitCode, 1);
  assert(existsSync(fixture.options["once-marker"]), "refusal must not remove the previous claim");
}));
