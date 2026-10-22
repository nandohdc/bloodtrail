import assert from "node:assert/strict";
import { accessSync, constants, lstatSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, sep } from "node:path";
import { approvedRepository } from "./kit-pipeline.mjs";
import { executingCheckout, harnessInventory } from "./repository.mjs";
import { CHANGE } from "./results.mjs";
import { assertRuntimePrerequisites } from "./runtime-facts.mjs";

function assertAbsent(path) {
  try {
    lstatSync(path);
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  throw new Error("results path already exists");
}

export function resultsDestination({ path }) {
  assertAbsent(path);
  const parent = dirname(path);
  assert(statSync(parent).isDirectory(), "results parent must be a directory");
  accessSync(parent, constants.W_OK);
}

export function markerDestination({ path, repo, bodySha256 }) {
  assert.match(bodySha256, /^[0-9a-f]{64}$/);
  assert.equal(basename(path), bodySha256, "once-marker basename must equal approval body sha256");
  const rel = relative(realpathSync(repo), realpathSync(dirname(path)));
  const outside = rel === ".." || rel.startsWith(`..${sep}`) || isAbsolute(rel);
  assert(outside, "once-marker parent must be outside repository");
}

export function sessionPreflight({ options, approval, entrypoint, runtimeCheck = assertRuntimePrerequisites }) {
  runtimeCheck();
  const approved = approvedRepository(options);
  executingCheckout({ entrypoint, repo: approved.repo });
  resultsDestination({ path: options.results });
  markerDestination({ path: options["once-marker"], repo: approved.repo, bodySha256: approval.body_sha256 });
  return harnessInventory({ ...approved, prefix: `${CHANGE}/harness` });
}
