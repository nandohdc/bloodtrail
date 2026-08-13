/**
 * Activation, bootstrap, and merge identity.
 *
 * Activation begins at a dedicated commit A whose sole parent is exactly the
 * protected-mainline merge commit M. A never records its own hash — a commit
 * cannot contain its own identifier — so everything A binds is something that
 * already existed when A was written.
 *
 * Squash and rebase are prohibited for the governed merge for a mechanical
 * reason, not a stylistic one: both replace the reviewed objects with new ones,
 * after which there is no reviewed technical commit left for A to bind.
 */

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isAncestor, objectAtPath, objectType, parentsOf, resolveCommit, splitNull, treeOf, tryGit } from "./git.mjs";
import { matchesAny } from "./paths.mjs";
import { requireCompleteHistory } from "./ancestry.mjs";

export function activationState(repositoryRoot, policy, sink) {
  const relativePath = policy.activation?.record_path;
  if (typeof relativePath !== "string") {
    sink.fail("protected-mainline-evidence-absent", "openspec/governance/design-pattern-policy.json",
      "policy declares no activation record path");
    return { active: false, record: null, path: null };
  }
  const absolute = resolve(repositoryRoot, relativePath);
  try {
    statSync(absolute);
  } catch {
    return { active: false, record: null, path: relativePath };
  }
  let record;
  try {
    record = JSON.parse(readFileSync(absolute, "utf8"));
  } catch (error) {
    sink.fail("activation-record-invalid", relativePath,
      `activation record JSON did not parse: ${String(error?.message ?? error).slice(0, 160)}`);
    return { active: false, record: null, path: relativePath };
  }
  return { active: true, record, path: relativePath };
}

/**
 * Normal enforcement. Called once an activation record exists in protected
 * history; every binding it declares is re-derived from Git rather than trusted.
 */
export function verifyActivation(record, recordPath, context, sink) {
  const { cwd, policy } = context;
  if (!requireCompleteHistory(cwd, sink)) return;

  for (const forbidden of ["activation_commit", "own_commit", "self_hash"]) {
    if (record[forbidden] !== undefined) {
      sink.fail("activation-self-reference", recordPath,
        `activation record must not bind its own hash via ${forbidden}`);
    }
  }

  const merge = resolveCommit(record.merge_commit, cwd);
  if (merge === null) {
    sink.fail("activation-commit-absent", recordPath, `bound merge commit ${String(record.merge_commit)} is not in this history`);
    return;
  }

  const activationCommit = findActivationCommit(recordPath, merge, cwd);
  if (activationCommit === null) {
    sink.fail("activation-commit-absent", recordPath,
      "no commit introducing the activation record was found in protected history");
    return;
  }

  const parents = parentsOf(activationCommit, cwd) ?? [];
  if (parents.length !== 1) {
    sink.fail("activation-parent", recordPath,
      `the activation commit must have exactly one parent, found ${parents.length}`);
  } else if (parents[0] !== merge) {
    sink.fail("activation-parent", recordPath,
      `the activation commit's parent is ${parents[0].slice(0, 12)}, not the bound merge commit ${merge.slice(0, 12)}`);
  }

  const mergeTree = treeOf(merge, cwd);
  if (mergeTree !== record.merge_tree) {
    sink.fail("activation-hash-mismatch", recordPath,
      `bound merge tree ${String(record.merge_tree)} does not match the merge commit's tree ${String(mergeTree)}`);
  }

  verifyMergeStrategy(record, merge, cwd, recordPath, sink);
  verifyBoundCommits(record, merge, cwd, recordPath, sink);
  verifyBoundBlobs(record, cwd, recordPath, sink);
  verifyActivationScope(record, activationCommit, merge, policy, cwd, recordPath, sink);
  verifyRequiredCheck(record.required_check, recordPath, sink);
}

function findActivationCommit(recordPath, merge, cwd) {
  // The activation commit is the child of M that introduces the record. Deriving
  // it from history rather than reading it from the record is the whole point:
  // the record cannot name it.
  const candidates = childCommitsIntroducing(recordPath, merge, cwd);
  return candidates.length === 1 ? candidates[0] : null;
}

function childCommitsIntroducing(path, merge, cwd) {
  const result = [];
  const objectAtMerge = objectAtPath(merge, path, cwd);
  const head = resolveCommit("HEAD", cwd);
  if (head === null) return result;
  const objectAtHead = objectAtPath(head, path, cwd);
  if (objectAtHead === null) return result;
  if (objectAtMerge !== null) return result; // present already at M: not introduced after it
  // Walk the first-parent chain forward from M looking for the introduction.
  const chain = firstParentChain(head, merge, cwd);
  for (const commit of chain) {
    const parents = parentsOf(commit, cwd) ?? [];
    const before = parents.length === 1 ? objectAtPath(parents[0], path, cwd) : null;
    const after = objectAtPath(commit, path, cwd);
    if (before === null && after !== null) result.push(commit);
  }
  return result;
}

function firstParentChain(head, stopAt, cwd) {
  const chain = [];
  let current = head;
  for (let guard = 0; guard < 10_000 && current && current !== stopAt; guard += 1) {
    chain.push(current);
    const parents = parentsOf(current, cwd);
    if (!parents || parents.length === 0) break;
    current = parents[0];
  }
  return chain.reverse();
}

function verifyMergeStrategy(record, merge, cwd, recordPath, sink) {
  const parents = parentsOf(merge, cwd) ?? [];
  const strategy = record.merge_strategy;
  if (strategy === "merge_commit") {
    if (parents.length < 2) {
      // A squash merge produces exactly this shape: a commit recorded as a merge
      // that has one parent, with the reviewed commits nowhere in the graph.
      sink.fail("merge-strategy-squash", recordPath,
        `merge commit ${merge.slice(0, 12)} is recorded as a merge commit but has ${parents.length} parent(s); squash merge does not preserve reviewed identities`);
    }
  } else if (strategy !== "fast_forward") {
    sink.fail("merge-strategy-unsupported", recordPath, `unsupported merge strategy ${String(strategy)}`);
  }
}

function verifyBoundCommits(record, merge, cwd, recordPath, sink) {
  for (const [field, id] of [
    ["technical_commit", "technical-commit-absent"],
    ["signed_record_commit", "signed-record-commit-absent"],
  ]) {
    const commit = resolveCommit(record[field], cwd);
    if (commit === null) {
      sink.fail(id, recordPath, `bound ${field} ${String(record[field])} is not in this history`);
      continue;
    }
    if (!isAncestor(commit, merge, cwd)) {
      // Rebase merge rewrites the commit and leaves the original unreachable, so
      // this is where a rebased history is caught.
      sink.fail(id === "technical-commit-absent" ? "merge-strategy-rebase" : id, recordPath,
        `bound ${field} ${commit.slice(0, 12)} is not an ancestor of the merge commit; its identity was not preserved`);
    }
  }

  const contentObject = record.signed_record_content_object;
  if (typeof contentObject === "string" && objectType(contentObject, cwd) === null) {
    sink.fail("signed-record-content-absent", recordPath,
      `the signed record's reviewed content object ${contentObject.slice(0, 12)} is not present in this repository`);
  }
}

function verifyBoundBlobs(record, cwd, recordPath, sink) {
  const technical = resolveCommit(record.technical_commit, cwd);
  if (technical === null) return;
  for (const [path, expected] of Object.entries(record.bound_blobs ?? {})) {
    const actual = objectAtPath(technical, path, cwd);
    if (actual === null) {
      sink.fail("activation-hash-mismatch", path, "bound artifact is absent from the technical commit");
      continue;
    }
    if (actual === expected) continue;
    const id = path.endsWith("check-design-pattern-governance.mjs")
      ? "checker-blob-mismatch"
      : (path.endsWith("design-pattern-policy.json") ? "policy-blob-mismatch" : "activation-hash-mismatch");
    sink.fail(id, path, `bound blob ${expected.slice(0, 12)} differs from the technical commit's ${actual.slice(0, 12)}`);
  }
}

function verifyActivationScope(record, activationCommit, merge, policy, cwd, recordPath, sink) {
  const allowlist = record.allowlisted_activation_paths ?? [];
  const mergeTree = treeOf(merge, cwd);
  const activationTree = treeOf(activationCommit, cwd);
  if (mergeTree === activationTree) {
    sink.fail("activation-empty", recordPath, "the activation commit changes nothing relative to the merge commit");
    return;
  }
  const changed = changedBetweenTrees(merge, activationCommit, cwd);
  for (const path of changed) {
    if (matchesAny(path, allowlist)) continue;
    sink.fail("activation-unrelated-change", path,
      "the activation commit changes a path outside the activation allowlist");
  }
  void policy;
}

function changedBetweenTrees(from, to, cwd) {
  const result = tryGit(["diff", "--no-renames", "--name-only", "-z", "--diff-filter=ACDMRTUXB", from, to, "--"], { cwd });
  return result.ok ? splitNull(result.value) : [];
}

export function verifyRequiredCheck(check, recordPath, sink) {
  if (!check || typeof check !== "object") {
    sink.fail("required-check-evidence-absent", recordPath, "activation evidence records no required-check proof");
    return;
  }
  if (check.verified !== true) {
    sink.fail("required-check-unverified", recordPath,
      "required-status enforcement for the protected reference is not verified; activation remains incomplete");
  }
  const contexts = check.verified_contexts ?? [];
  if (!contexts.includes(check.context)) {
    sink.fail("required-check-context-absent", recordPath,
      `required check ${String(check.context)} does not appear in the verified contexts`);
  }
  if (typeof check.evidence_digest !== "string" || !/^sha256:[0-9a-f]{64}$/.test(check.evidence_digest)) {
    sink.fail("required-check-evidence-absent", recordPath, "required-check evidence has no verifiable digest");
  }
}

/**
 * One-time bootstrap. It exists only for the window before an activation record
 * has ever existed, and it must become permanently unavailable afterwards —
 * otherwise it is a second, weaker path to activation that could be re-entered
 * to replace a record someone did not like.
 */
export function verifyBootstrap(context, sink) {
  const { repositoryRoot, policy, cwd } = context;
  const state = activationState(repositoryRoot, policy, sink);
  if (state.active) {
    sink.fail("bootstrap-re-entry", state.path,
      "an activation record already exists; bootstrap has ended permanently and cannot be re-entered");
    return;
  }
  if (policy.activation?.bootstrap_available !== true) {
    sink.fail("bootstrap-unavailable", "openspec/governance/design-pattern-policy.json",
      "policy does not make bootstrap available");
    return;
  }
  if (!requireCompleteHistory(cwd, sink)) return;

  const check = policy.protected_mainline?.required_check;
  if (check?.verified !== true) {
    sink.fail("required-check-evidence-absent", "openspec/governance/design-pattern-policy.json",
      "bootstrap requires verified required-status enforcement for the protected reference; activation remains incomplete");
  }
}
