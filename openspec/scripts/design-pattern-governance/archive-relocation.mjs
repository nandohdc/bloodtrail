/**
 * R15 archive-relocation recognition, shared by review freshness and the
 * association perimeter.
 *
 * A dated archive directory counts as the genuine relocation of a change only
 * when one of its two relocation artifacts — assessment.json or proposal.md —
 * is the exact object that repository history carried at the active change
 * path. A planted decoy directory, or one whose content differs from what
 * history carried, would re-open the dangling-binding hole this check closes,
 * so it is not recognised. A byte-for-byte copy of a real historical artifact
 * is indistinguishable from a genuine relocation at this level;
 * archive-movement attestations remain the higher authority for that residual
 * (R15).
 */

import { objectAtPath, splitLines, tryGit } from "./git.mjs";

const HISTORY_UNAVAILABLE = Symbol("history-unavailable");

export const RELOCATION_ARTIFACTS = Object.freeze(["assessment.json", "proposal.md"]);

/** Whether the archived directory carries at least one relocated artifact. */
export function carriesRelocatedArtifact(archiveName, id, cwd, sink, historyUnavailableId = "signed-review-history-unavailable") {
  const archivedPath = `openspec/changes/archive/${archiveName}`;
  for (const artifact of RELOCATION_ARTIFACTS) {
    const relocated = artifactWasRelocated({ archivedPath, id, artifact, cwd, sink, historyUnavailableId });
    if (relocated === HISTORY_UNAVAILABLE) return false;
    if (relocated) return true;
  }
  return false;
}

/** Whether an archived artifact is the exact object history carried at the active path. */
function artifactWasRelocated({ archivedPath, id, artifact, cwd, sink, historyUnavailableId }) {
  const archivedObject = objectAtPath("HEAD", `${archivedPath}/${artifact}`, cwd);
  if (archivedObject === null) return false;
  const activePath = `openspec/changes/${id}/${artifact}`;
  const carried = historyCarriesObjectAt(activePath, archivedObject, cwd);
  if (carried === null) {
    sink.fail(historyUnavailableId, archivedPath,
      `cannot enumerate the history of ${activePath}; archive relocation cannot be verified`);
    return HISTORY_UNAVAILABLE;
  }
  return carried;
}

/** True when some commit reachable from HEAD carried `object` at `path`; null when history is unreadable. */
function historyCarriesObjectAt(path, object, cwd) {
  const touched = tryGit(["rev-list", "HEAD", "--", path], { cwd });
  if (!touched.ok) return null;
  for (const commit of splitLines(touched.value)) {
    if (objectAtPath(commit, path, cwd) === object) return true;
  }
  return false;
}
