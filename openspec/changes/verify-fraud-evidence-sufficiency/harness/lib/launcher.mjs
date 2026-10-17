import assert from "node:assert/strict";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { command, inside, sha256 } from "./io.mjs";

export function verifyFileBytes({ bytes, committed }) {
  assert.equal(sha256(bytes), sha256(committed), "executed file differs from approved Git blob");
  return sha256(bytes);
}

export function copyApprovedFiles({ repo, approvedHead, service, paths, prefix }) {
  const hashes = {};
  for (const path of paths) {
    assert(path.startsWith(prefix + "/"));
    const blob = command({ program: "git", args: ["rev-parse", `${approvedHead}:${path}`], cwd: repo }).trim();
    const committed = command({ program: "git", args: ["cat-file", "blob", blob], cwd: repo, encoding: null });
    const bytes = readFileSync(join(repo, path));
    hashes[path] = { git_blob: blob, sha256: verifyFileBytes({ bytes, committed }) };
    const target = join(service, "harness", path.slice(prefix.length + 1));
    inside({ root: service, path: target });
    mkdirSync(dirname(target), { recursive: true });
    writeFileSync(target, bytes);
    assert.equal(sha256(readFileSync(target)), hashes[path].sha256);
  }
  return hashes;
}

export function assertResolution({ service, resolvedCore }) {
  assert(resolvedCore.startsWith("file:"), "core must resolve to a file URL");
  inside({ root: realpathSync(service), path: realpathSync(fileURLToPath(resolvedCore)) });
}

export function launchProbe({ service, role, budget, flags, run = command }) {
  assert.deepEqual(flags, ["--permission", `--allow-fs-read=${service}`], "unexpected permission grant");
  const script = join(service, "harness/p-ids/probe-process.mjs");
  const observed = JSON.parse(run({ program: process.execPath, args: [...flags, script, "--role", role, "--budget", String(budget)], cwd: service }));
  assertResolution({ service, resolvedCore: observed.resolved_core });
  assert.equal(observed.role, role);
  assert(observed.ledger.occurrence_count <= budget, "process exceeded assigned budget");
  return observed;
}
