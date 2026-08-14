/**
 * Read-only Git access.
 *
 * Every subcommand used here inspects; none writes. The allowlist is not defence
 * against this file's own callers — it is a tripwire, so that adding a mutating
 * command to a checker that documents itself as read-only has to be deliberate.
 */

import { execFileSync } from "node:child_process";

const READ_ONLY_SUBCOMMANDS = new Set([
  "cat-file",
  "diff",
  "diff-tree",
  "log",
  "ls-files",
  "ls-tree",
  "merge-base",
  "rev-list",
  "rev-parse",
  "show",
  "show-ref",
]);

export class GitUnavailableError extends Error {
  constructor(message) {
    super(message);
    this.name = "GitUnavailableError";
  }
}

export function git(args, options = {}) {
  const subcommand = args[0];
  if (!READ_ONLY_SUBCOMMANDS.has(subcommand)) {
    throw new Error(`refusing to run non-read-only git subcommand: ${subcommand}`);
  }
  try {
    return execFileSync("git", args, {
      cwd: options.cwd ?? process.cwd(),
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    });
  } catch (error) {
    throw new GitUnavailableError(`git ${args.join(" ")} failed: ${String(error?.stderr ?? error?.message ?? error).trim().slice(0, 240)}`);
  }
}

export function tryGit(args, options = {}) {
  try {
    return { ok: true, value: git(args, options) };
  } catch (error) {
    return { ok: false, error };
  }
}

export function splitNull(output) {
  return output.split("\0").filter((entry) => entry.length > 0);
}

export function splitLines(output) {
  return output.split("\n").map((line) => line.trim()).filter((line) => line.length > 0);
}

/**
 * A shallow clone cannot prove ancestry, and ancestry is what ordering,
 * activation, and grandfathering rest on. Treating "I could not see it" as
 * "it is not there" is exactly the fail-open this policy exists to prevent.
 */
export function historyIsComplete(cwd) {
  const shallow = tryGit(["rev-parse", "--is-shallow-repository"], { cwd });
  if (!shallow.ok) return false;
  return shallow.value.trim() === "false";
}

export function commitExists(revision, cwd) {
  return tryGit(["rev-parse", "--verify", "--quiet", `${revision}^{commit}`], { cwd }).ok;
}

export function resolveCommit(revision, cwd) {
  const result = tryGit(["rev-parse", "--verify", `${revision}^{commit}`], { cwd });
  return result.ok ? result.value.trim() : null;
}

export function isAncestor(ancestor, descendant, cwd) {
  return tryGit(["merge-base", "--is-ancestor", ancestor, descendant], { cwd }).ok;
}

export function parentsOf(commit, cwd) {
  const result = tryGit(["rev-list", "--parents", "-n", "1", commit], { cwd });
  if (!result.ok) return null;
  const fields = result.value.trim().split(/\s+/);
  return fields.slice(1);
}

export function treeOf(revision, cwd) {
  const result = tryGit(["rev-parse", `${revision}^{tree}`], { cwd });
  return result.ok ? result.value.trim() : null;
}

/** Object id a path resolves to inside a revision, or null when the path is absent. */
export function objectAtPath(revision, path, cwd) {
  const result = tryGit(["rev-parse", `${revision}:${path}`], { cwd });
  return result.ok ? result.value.trim() : null;
}

export function objectType(object, cwd) {
  const result = tryGit(["cat-file", "-t", object], { cwd });
  return result.ok ? result.value.trim() : null;
}

export function blobAt(revision, path, cwd) {
  const result = tryGit(["show", `${revision}:${path}`], { cwd });
  return result.ok ? result.value : null;
}

/** Paths changed between two revisions, or between a revision and the working tree. */
export function changedPaths(from, to, cwd) {
  const args = ["diff", "--no-renames", "--name-only", "-z", "--diff-filter=ACDMRTUXB", from];
  if (to) args.push(to);
  args.push("--");
  const result = tryGit(args, { cwd });
  return result.ok ? splitNull(result.value) : null;
}

export function commitsBetween(from, to, cwd) {
  const result = tryGit(["rev-list", "--reverse", `${from}..${to}`], { cwd });
  return result.ok ? splitLines(result.value) : null;
}

export function pathsChangedByCommit(commit, cwd) {
  const result = tryGit([
    "diff-tree", "--no-commit-id", "--no-renames", "--name-only", "-r", "-z", commit,
  ], { cwd });
  return result.ok ? splitNull(result.value) : null;
}

/**
 * Paths a commit changed, where a merge commit counts only the content it adds
 * beyond every parent.
 *
 * A plain `diff-tree` on a merge reports nothing, so the merge's own edits would
 * be invisible; `-m` against every parent reports the whole merged line and
 * would flag an identity-preserving merge for carrying content that individual
 * range commits already account for. Only paths whose content at the merge
 * differs from *every* parent are new work the merge itself introduced.
 */
export function pathsChangedByCommitIncludingMerges(commit, cwd) {
  const parents = parentsOf(commit, cwd);
  if (parents === null) return null;
  if (parents.length <= 1) return pathsChangedByCommit(commit, cwd);
  const candidates = new Set();
  for (const parent of parents) {
    const result = tryGit(["diff", "--no-renames", "--name-only", "-z", parent, commit], { cwd });
    if (!result.ok) return null;
    for (const path of splitNull(result.value)) candidates.add(path);
  }
  const genuinelyNew = [];
  for (const path of candidates) {
    const atCommit = objectAtPath(commit, path, cwd);
    if (parents.every((parent) => objectAtPath(parent, path, cwd) !== atCommit)) {
      genuinelyNew.push(path);
    }
  }
  return genuinelyNew.sort();
}

export function untrackedPaths(cwd) {
  const result = tryGit(["ls-files", "--others", "--exclude-standard", "-z"], { cwd });
  return result.ok ? splitNull(result.value) : [];
}
