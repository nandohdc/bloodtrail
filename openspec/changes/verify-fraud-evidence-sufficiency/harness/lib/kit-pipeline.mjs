import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { command, inside } from "./io.mjs";
import { readIdentity } from "./identity.mjs";
import { installService } from "./install.mjs";
import { runtimeFacts } from "./runtime-facts.mjs";

export function approvedRepository({ repo, approvedHead, dryRun }) {
  const root = resolve(repo || command({ program: "git", args: ["rev-parse", "--show-toplevel"] }).trim());
  const git = (args) => command({ program: "git", args, cwd: root }).trim();
  assert.equal(git(["status", "--porcelain"]), "", "kit pipeline requires a clean tree");
  const head = git(["rev-parse", "HEAD"]);
  if (!dryRun) assert.match(approvedHead, /^[0-9a-f]{40}$/);
  if (approvedHead) assert.equal(head, approvedHead, "HEAD must equal approved head");
  return { repo: root, approvedHead: head };
}

export function deleteScratch({ scratch }) {
  rmSync(scratch, { recursive: true, force: true });
  assert(!existsSync(scratch), "scratch deletion failed");
  // Removing the ancestor proves recursive absence of kit, service, archive and logs.
  return { root: scratch, recursively_absent: !existsSync(scratch), includes: ["evaluation-kit", "own-service", "archive", "logs"] };
}

export function finalizeScratch({ result, scratch, remove = deleteScratch }) {
  try {
    result.scratch_deletion = remove({ scratch });
  } catch (error) {
    result.scratch_deletion = { root: scratch, recursively_absent: false };
    result.invalidations.push({ message: `scratch deletion failed: ${error.message}` });
  }
  return result;
}

export async function kitPipeline(options, consume = async () => null) {
  const approved = approvedRepository(options);
  const scratch = mkdtempSync(join(realpathSync(tmpdir()), "bloodtrail-stage-p-"));
  const result = { dry_run: options.dryRun, approved_head: approved.approvedHead, driver: options.driver, executed_file_hashes: "not applicable: dry run", invalidations: [] };
  const log = (label, text) => writeFileSync(join(scratch, "logs", `${label}.log`), text);
  try {
    inside({ root: realpathSync(tmpdir()), path: scratch });
    assert(!scratch.startsWith(approved.repo + "/"));
    mkdirSync(join(scratch, "logs"));
    Object.assign(result, runtimeFacts({ scratch }));
    const kit = join(scratch, "evaluation-kit");
    const service = join(scratch, "own-service");
    log("builder", command({ program: process.execPath, args: ["packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs", "--dest", kit], cwd: approved.repo }));
    Object.assign(result, readIdentity({ kit, ...approved }));
    result.install = installService({ kit, service, identity: result.identity, log });
    result.permission_flags = ["--permission", `--allow-fs-read=${service}`];
    writeFileSync(join(scratch, "provenance.json"), JSON.stringify(result, null, 2) + "\n");
    if (!options.dryRun) result.observations = await consume({ ...approved, service, provenance: result });
  } catch (error) {
    result.invalidations.push({ message: error.message });
  } finally {
    finalizeScratch({ result, scratch });
  }
  return result;
}
