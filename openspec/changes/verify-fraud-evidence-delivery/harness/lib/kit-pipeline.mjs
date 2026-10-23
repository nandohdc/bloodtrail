import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { command, inside } from "./io.mjs";
import { readIdentity } from "./identity.mjs";
import { installService } from "./install.mjs";
import { runtimeFacts } from "./runtime-facts.mjs";
import { prepareStorage, roleFlags } from "./permissions.mjs";
import { invalidationOf } from "./results.mjs";

export function approvedRepository({ repo, approvedHead, dryRun }) {
  const root = resolve(repo || command({ program: "git", args: ["rev-parse", "--show-toplevel"] }).trim());
  const git = (args) => command({ program: "git", args, cwd: root }).trim();
  assert.equal(git(["status", "--porcelain"]), "", "kit pipeline requires a clean tree");
  const head = git(["rev-parse", "HEAD"]);
  if (!dryRun) assert.match(approvedHead, /^[0-9a-f]{40}$/);
  if (approvedHead) assert.equal(head, approvedHead, "HEAD must equal approved head");
  return { repo: root, approvedHead: head };
}

// Removing the scratch ancestor proves the kit, own service, collector storage and logs are all gone.
export function deleteScratch({ scratch }) {
  rmSync(scratch, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  assert(!existsSync(scratch), "scratch deletion failed");
  return { root: scratch, recursively_absent: !existsSync(scratch), includes: ["evaluation-kit", "own-service", "collector-storage", "logs"] };
}

export function finalizeScratch({ result, scratch, remove = deleteScratch }) {
  try {
    result.scratch_deletion = remove({ scratch });
  } catch (error) {
    result.scratch_deletion = { root: scratch, recursively_absent: false };
    result.invalidations.push(invalidationOf(`scratch deletion failed: ${error.message}`));
  }
  return result;
}

export async function scratchSession({ result, scratch, work }) {
  try {
    await work();
  } catch (error) {
    result.invalidations.push(invalidationOf(error));
  } finally {
    finalizeScratch({ result, scratch });
  }
  return result;
}

function buildAndInstall({ approved, scratch, result, log }) {
  const kit = join(scratch, "evaluation-kit");
  const service = join(scratch, "own-service");
  log("builder", command({ program: process.execPath, args: ["packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs", "--dest", kit], cwd: approved.repo }));
  Object.assign(result, readIdentity({ kit, ...approved }));
  result.install = installService({ kit, service, identity: result.identity, log });
  return service;
}

export async function kitPipeline(options, consume = async () => null) {
  const approved = approvedRepository(options);
  const scratch = mkdtempSync(join(realpathSync(tmpdir()), "bloodtrail-stage-2-"));
  const result = { dry_run: options.dryRun === true, approved_head: approved.approvedHead, driver: options.driver, invalidations: [] };
  // An approved run's executed-file hashes are recorded by the runner, from the approved inventory.
  if (options.dryRun) result.executed_file_hashes = "not applicable: dry run";
  const log = (label, text) => writeFileSync(join(scratch, "logs", `${label}.log`), text);
  return scratchSession({ result, scratch, work: async () => {
    inside({ root: realpathSync(tmpdir()), path: scratch });
    assert(!scratch.startsWith(approved.repo + "/"));
    mkdirSync(join(scratch, "logs"));
    Object.assign(result, runtimeFacts({ scratch }));
    const service = buildAndInstall({ approved, scratch, result, log });
    const storage = prepareStorage({ scratch, repo: approved.repo, service });
    result.permission_flags = { sender: roleFlags({ role: "sender", service, storage }), ingress: roleFlags({ role: "ingress", service, storage }) };
    writeFileSync(join(scratch, "provenance.json"), JSON.stringify(result, null, 2) + "\n");
    if (!options.dryRun) result.observations = await consume({ ...approved, scratch, service, storage, provenance: result });
  } });
}
