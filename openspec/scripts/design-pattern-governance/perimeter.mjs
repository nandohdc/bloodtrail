/**
 * The actor-neutral governance perimeter.
 *
 * Classification reads what a change does, not what it is called and not who
 * made it. The same changed paths and the same evidence produce the same result
 * for a human typing in an editor, for an agent, for a direct commit, for a pull
 * request, and for a script. There is no actor-conditional branch in this file,
 * and there must never be one.
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { carriesRelocatedArtifact } from "./archive-relocation.mjs";
import { longestMatch, matchesAny, matchesSegmentPattern } from "./paths.mjs";
import { blobAt, changedPaths, commitsBetween, pathsChangedByCommit, untrackedPaths } from "./git.mjs";

export const UNCLASSIFIED = "unclassified";

const DATED_ARCHIVE_PATH = /^openspec\/changes\/archive\/(\d{4}-\d{2}-\d{2}-[^/]+)\//;

/**
 * Path classes are minimum floors. The most specific declared pattern wins, and a
 * path matching nothing is unclassified — which fails closed rather than being
 * waved through as "probably harmless".
 */
export function classifyPath(path, policy) {
  let best = null;
  for (const entry of policy.path_classes ?? []) {
    const matched = longestMatch(path, entry.patterns ?? []);
    if (matched === null) continue;
    if (best === null || matched.length > best.pattern.length) {
      best = { pattern: matched, class: entry.class };
    }
  }
  return best?.class ?? UNCLASSIFIED;
}

export function classifyPaths(paths, policy) {
  const byClass = new Map();
  for (const path of paths) {
    const cls = classifyPath(path, policy);
    if (!byClass.has(cls)) byClass.set(cls, []);
    byClass.get(cls).push(path);
  }
  return byClass;
}

export function isGovernanceCore(paths, policy) {
  return paths.some((path) => classifyPath(path, policy) === "governance_core");
}

export function isGovernanceRecordOnly(paths, policy) {
  if (paths.length === 0) return false;
  return paths.every((path) => classifyPath(path, policy) === "governance_record_only");
}

export function touchesNormativePath(paths, policy) {
  return paths.some((path) => matchesAny(path, policy.normative_paths ?? [])
    && classifyPath(path, policy) !== "governance_record_only");
}

/**
 * Returns whether a path requires active-change ownership association.
 *
 * Classification happens before the planning-artifact carve-out. This is
 * intentionally different from flattening all governed patterns into one
 * include list: a narrow governance-record-only rule must outrank a broad
 * governance-core parent, while nearby policy/checker paths remain associated.
 */
export function requiresOpenSpecAssociation(path, policy) {
  const cls = classifyPath(path, policy);
  if (cls !== "governance_core" && cls !== "governed_implementation") return false;
  return !(policy.planning_artifact_patterns ?? []).some((pattern) => matchesSegmentPattern(path, pattern));
}

/**
 * Signals that a supporting path carries implementation behaviour.
 *
 * Tests, build files, scripts, and configuration are where implementation hides
 * when a change wants a lower classification. These patterns look for the shape
 * of exported behaviour rather than for keywords in a commit message, because the
 * message is the part the author controls.
 */
const IMPLEMENTATION_SIGNALS = Object.freeze([
  /^\+\s*export\s+(async\s+)?function\s+/m,
  /^\+\s*export\s+class\s+/m,
  /^\+\s*export\s+const\s+\w+\s*=\s*(async\s*)?\(/m,
  /^\+\s*module\.exports\s*=/m,
  /^\+\s*exports\.\w+\s*=/m,
]);

const SUPPORTING_PATH = /(^|\/)(tests?|__tests__|scripts?|build|config)(\/|$)|\.(config|conf)\.(mjs|cjs|js|ts|json|ya?ml)$/;

export function looksLikeSupportingPath(path) {
  return SUPPORTING_PATH.test(path);
}

/**
 * Inspects the material commit range as a whole.
 *
 * Splitting one material change across several commits is the cheapest way to
 * make each individual commit look small. Evaluating the range removes that
 * option: the classification is of the work, not of its finest slice.
 */
export function collectRangePaths(base, head, cwd, sink) {
  const commits = commitsBetween(base, head, cwd);
  if (commits === null) {
    sink.fail("history-unavailable", base, `cannot enumerate commits between ${base} and ${head}`);
    return null;
  }
  const paths = new Set();
  const perCommit = new Map();
  for (const commit of commits) {
    const changed = pathsChangedByCommit(commit, cwd);
    if (changed === null) {
      sink.fail("history-unavailable", commit, "cannot enumerate the paths a commit changed");
      return null;
    }
    perCommit.set(commit, changed);
    for (const path of changed) paths.add(path);
  }

  // Uncommitted work counts too. CI sees a pushed range and would classify these
  // paths; a local run that ignored them would be the weaker gate, and a gate
  // that is weaker where it is actually run is the one that lets things through.
  for (const path of changedPaths(base, null, cwd) ?? []) paths.add(path);
  for (const path of untrackedPaths(cwd)) paths.add(path);

  return { commits, paths: [...paths].sort(), perCommit };
}

/**
 * Implementation behaviour appearing under a classification below implementation.
 *
 * Scoped to paths the classification treats as *less* than governed — a
 * governance-core script is supposed to contain exported behaviour, and flagging
 * it would be noise that trains people to ignore the diagnostic. What this
 * catches is behaviour arriving where the class says there should be none.
 */
export function checkHiddenImplementation({ paths, byClass, base, head, cwd, sink }) {
  const lowerClassified = new Set([
    ...(byClass.get("documentation_only") ?? []),
    ...(byClass.get("governance_record_only") ?? []),
  ]);
  for (const path of paths) {
    if (!lowerClassified.has(path)) continue;
    const added = addedContent(base, head, path, cwd);
    if (added === null) continue;
    if (IMPLEMENTATION_SIGNALS.some((signal) => signal.test(added))) {
      sink.fail("hidden-implementation", path,
        "a path classified below implementation introduces exported implementation behaviour; behaviour overrides the classification");
    }
  }
}

/**
 * Lines present now that were not present at the base, marked as additions.
 *
 * Reads the working tree when the path is not yet committed. An earlier revision
 * of this function read only from HEAD, which meant every untracked file — the
 * exact state a contributor is in when they run the checker locally — was skipped
 * silently. A check that cannot fire on the common case is not a check.
 */
function addedContent(base, head, path, cwd) {
  const content = blobAt(head ?? "HEAD", path, cwd) ?? readWorkingTree(cwd, path);
  if (content === null) return null;
  const before = blobAt(base, path, cwd);
  if (before === null) return content.split("\n").map((line) => `+${line}`).join("\n");
  const beforeLines = new Set(before.split("\n"));
  return content.split("\n").filter((line) => !beforeLines.has(line)).map((line) => `+${line}`).join("\n");
}

function readWorkingTree(cwd, path) {
  try {
    return readFileSync(resolve(cwd, path), "utf8");
  } catch {
    return null;
  }
}

/**
 * Every governed implementation path must be covered by an OpenSpec change that
 * owns the modified capability.
 *
 * Coverage is derived from what the changed paths themselves show: a change
 * directory that the range touches, whose assessment declares a capability. An
 * OpenSpec change that exists but describes something else does not cover the
 * work — that is the "unrelated change" case, and accepting it would make the
 * association a formality satisfied by having any change open at all.
 */
export function checkOpenSpecAssociation(governedPaths, changes, sink) {
  if (governedPaths.length === 0) return;

  if (changes.length === 0) {
    sink.fail("openspec-association-absent", governedPaths[0],
      `${governedPaths.length} governed implementation path(s) change with no applicable OpenSpec change in the same range`);
    return;
  }

  const covered = new Set(changes.filter((change) => change.capabilities.length > 0)
    .flatMap((change) => change.ownedPaths));
  for (const path of governedPaths) {
    if (matchesAny(path, [...covered])) continue;
    sink.fail("openspec-association-unrelated", path,
      "no OpenSpec change in this range owns or describes this governed implementation path");
  }
}

/**
 * Change ids whose dated archive directory appears in the range, keyed to the
 * archive-directory prefixes recognised as genuine relocations.
 *
 * R15 preserves the signed record across an archive relocation only when the
 * archived artifacts are the exact objects history carried at the active change
 * path, and R24 requires the governed archive step to exist. The association
 * check must recognise what the contract recognises, or no governed change
 * could ever be archived while enforcement is active: after the move nothing
 * active owns the dated archive path. The recognition is the same
 * byte-identical-relocation rule review freshness applies; a planted or decoy
 * archive directory is not recognised and stays uncovered, failing closed as
 * unrelated work.
 */
export function collectRelocatedChangeIds(paths, cwd, sink) {
  const relocated = new Map();
  for (const path of paths) {
    const match = DATED_ARCHIVE_PATH.exec(path);
    if (!match) continue;
    const archiveName = match[1];
    const id = archiveName.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    if (!carriesRelocatedArtifact(archiveName, id, { cwd, sink, historyUnavailableId: "history-unavailable" })) continue;
    const archiveDir = `openspec/changes/archive/${archiveName}`;
    if (!relocated.has(id)) relocated.set(id, new Set());
    relocated.get(id).add(archiveDir);
  }
  return relocated;
}

/**
 * The OpenSpec changes that could cover this range, with what each declares it
 * owns.
 *
 * Both the changes the range touches *and* the active changes on disk count. An
 * implementation commit often touches no change directory at all — the proposal
 * landed earlier — so requiring the change to appear in the range would reject
 * correctly governed work for having tidy commits. A recognised archive
 * relocation also counts, but only for the relocation itself: the relocated
 * change owns its archived evidence and the move, while further work on the
 * capability it used to own requires a new active change — keeping the
 * association from becoming a formality satisfied by any finished change.
 *
 * `ownedPaths` comes from each change's own assessment. A change that declares
 * nothing owns nothing, which is what keeps the association from being satisfied
 * by merely having some change open.
 */
export function collectOpenSpecChanges(paths, readAssessment, activeChangeIds = [], relocated = new Map()) {
  const ids = new Set(activeChangeIds);
  for (const path of paths) {
    const match = /^openspec\/changes\/([^/]+)\//.exec(path);
    if (match && match[1] !== "archive") ids.add(match[1]);
  }
  for (const id of relocated.keys()) ids.add(id);
  return [...ids].sort().map((id) => {
    const assessment = readAssessment(id);
    const capabilities = assessment?.applicability?.capabilities ?? [];
    return {
      id,
      capabilities,
      ownedPaths: ownedPathsFor(id, assessment, capabilities, relocated.get(id)),
    };
  });
}

/** The paths a change owns, scoped to its active form or its recognised relocation. */
function ownedPathsFor(id, assessment, capabilities, archivedDirs) {
  const paths = [`openspec/changes/${id}/`];
  for (const archiveDir of archivedDirs ?? []) paths.push(`${archiveDir}/`);
  // A relocated change keeps its archived capability declaration for the
  // association's capability gate, but the declaration no longer covers
  // canonical spec paths or its former owned paths: further work on anything
  // but the relocation itself requires a new active change.
  if (archivedDirs) return paths;
  paths.push(...(assessment?.owned_paths ?? []));
  paths.push(...capabilities.map((capability) => `openspec/specs/${capability}/`));
  return paths;
}

export function checkUnclassifiedPaths(byClass, emergencyPaths, sink) {
  const unclassified = byClass.get(UNCLASSIFIED) ?? [];
  for (const path of unclassified) {
    if (emergencyPaths.has(path)) continue;
    sink.fail("path-unclassified", path,
      "path matches no declared classification; an unclassified path fails closed rather than passing");
  }
}
