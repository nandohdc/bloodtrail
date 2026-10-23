import assert from "node:assert/strict";
import { readFileSync, realpathSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { command } from "./io.mjs";
import { verifyFileBytes } from "./launcher.mjs";

export function executingCheckout({ entrypoint, repo }) {
  const cwd = dirname(fileURLToPath(entrypoint));
  const root = command({ program: "git", args: ["rev-parse", "--show-toplevel"], cwd }).trim();
  assert.equal(realpathSync(root), realpathSync(repo), "executing checkout must equal approved repository");
}

export function harnessInventory({ repo, approvedHead, prefix }) {
  const listing = command({ program: "git", args: ["ls-tree", "-r", "--name-only", "-z", approvedHead, "--", prefix], cwd: repo });
  const paths = listing.split("\0").filter(Boolean);
  assert(paths.length > 0, "approved harness inventory is empty");
  return Object.fromEntries(paths.map((path) => {
    const blob = command({ program: "git", args: ["rev-parse", `${approvedHead}:${path}`], cwd: repo }).trim();
    const committed = command({ program: "git", args: ["cat-file", "blob", blob], cwd: repo, encoding: null });
    const bytes = readFileSync(join(repo, path));
    return [path, { git_blob: blob, sha256: verifyFileBytes({ bytes, committed }) }];
  }));
}
