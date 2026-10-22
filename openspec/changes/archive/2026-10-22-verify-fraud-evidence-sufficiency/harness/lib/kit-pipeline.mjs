import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { command, inside } from "./io.mjs";
import { readIdentity } from "./identity.mjs";
import { installService } from "./install.mjs";
import { runtimeFacts } from "./runtime-facts.mjs";
import { preparePermissions } from "./database-permissions.mjs";

export function approvedRepository({ repo, approvedHead, dryRun }) {
  const root = resolve(repo || command({ program: "git", args: ["rev-parse", "--show-toplevel"] }).trim());
  const git = (args) => command({ program: "git", args, cwd: root }).trim();
  assert.equal(git(["status", "--porcelain"]), "", "kit pipeline requires a clean tree");
  const head = git(["rev-parse", "HEAD"]);
  if (!dryRun) assert.match(approvedHead, /^[0-9a-f]{40}$/);
  if (approvedHead) assert.equal(head, approvedHead, "HEAD must equal approved head");
  return { repo: root, approvedHead: head };
}

export function deleteScratch({ scratch, databaseScratch = false }) {
  rmSync(scratch, { recursive: true, force: true });
  assert(!existsSync(scratch), "scratch deletion failed");
  // Removing the ancestor also proves recursive absence of any host database.
  return { root: scratch, recursively_absent: !existsSync(scratch), includes: ["evaluation-kit", "own-service", "archive", "logs", ...(databaseScratch ? ["host-database"] : [])] };
}

export function finalizeScratch({ result, scratch, databaseScratch, remove = deleteScratch }) {
  try {
    result.scratch_deletion = remove({ scratch, databaseScratch });
  } catch (error) {
    result.scratch_deletion = { root: scratch, recursively_absent: false };
    result.invalidations.push({ message: `scratch deletion failed: ${error.message}` });
  }
  return result;
}

export async function scratchSession({ result, scratch, databaseScratch, work }) {
  try {
    await work();
  } catch (error) {
    result.invalidations.push({ message: error.message });
  } finally {
    finalizeScratch({ result, scratch, databaseScratch });
  }
  return result;
}

export async function kitPipeline(options, consume = async () => null) {
  const approved = approvedRepository(options);
  const scratch = mkdtempSync(join(realpathSync(tmpdir()), "bloodtrail-stage-p-"));
  const result = { dry_run: options.dryRun, approved_head: approved.approvedHead, driver: options.driver, executed_file_hashes: "not applicable: dry run", invalidations: [] };
  const log = (label, text) => writeFileSync(join(scratch, "logs", `${label}.log`), text);
  return scratchSession({ result, scratch, databaseScratch: options.databaseScratch, work: async () => {
    inside({ root: realpathSync(tmpdir()), path: scratch });
    assert(!scratch.startsWith(approved.repo + "/"));
    mkdirSync(join(scratch, "logs"));
    Object.assign(result, runtimeFacts({ scratch }));
    const kit = join(scratch, "evaluation-kit");
    const service = join(scratch, "own-service");
    log("builder", command({ program: process.execPath, args: ["packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs", "--dest", kit], cwd: approved.repo }));
    Object.assign(result, readIdentity({ kit, ...approved }));
    result.install = installService({ kit, service, identity: result.identity, log });
    const permissions = preparePermissions({ databaseScratch: options.databaseScratch, scratch, service, repo: approved.repo });
    result.permission_flags = permissions.flags;
    writeFileSync(join(scratch, "provenance.json"), JSON.stringify(result, null, 2) + "\n");
    if (!options.dryRun) result.observations = await consume({ ...approved, scratch, service, database: permissions.database, provenance: result });
  } });
}
