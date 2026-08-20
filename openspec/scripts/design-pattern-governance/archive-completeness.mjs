/**
 * R25 archive-relocation completeness.
 *
 * A relocation that adds the dated archive directory without removing the active
 * one leaves the change present twice. The association perimeter does not catch
 * it: the archived directory is legitimately covered as a recognised relocation,
 * and nothing there asks whether the directory it replaced is gone.
 *
 * Completeness is resolved at `HEAD` through Git, never through the filesystem.
 * The cheaper version — `existsSync` on the active directory — is the exact
 * blind spot this control closes: `collectRangePaths` folds working-tree and
 * untracked paths into the range, so a local run where the deletion was
 * performed but never staged reads as complete while the commit contains only
 * the addition.
 *
 * Two conditions must both hold, and each rules out a different false positive:
 *
 * 1. The range introduced the relocation. Editing a directory archived by an
 *    earlier range is not this range's relocation to complete.
 * 2. A relocated artifact is *still at the active path* at `HEAD`. Directory
 *    existence alone is not enough: a change id may be archived completely and
 *    re-opened as new work in the same range, and that active directory is a new
 *    change that merely shares a name. What distinguishes the incomplete move is
 *    that the very object the archive carries is also still where it was moved
 *    from.
 *
 * `HEAD` is spelled literally rather than taken as a parameter because the
 * recogniser that produces the relocation map resolves its artifacts against
 * `HEAD` too; parameterising only this side would let the map and the
 * completeness test disagree about which revision they describe.
 */

import { RELOCATION_ARTIFACTS } from "./archive-relocation.mjs";
import { byCodePoint } from "./diagnostics.mjs";
import { objectAtPath } from "./git.mjs";

export function checkRelocationCompleteness({ relocated, base, cwd, sink }) {
  for (const [id, archiveDirs] of relocated) {
    for (const archiveDir of [...archiveDirs].sort(byCodePoint)) {
      if (carriesArtifactAt(base, archiveDir, cwd)) continue;
      const artifact = relocatedArtifactStillActive(id, archiveDir, cwd);
      if (artifact === null) continue;
      sink.fail("archive-relocation-incomplete", archiveDir,
        `${activeDirectory(id)}/${artifact} still holds the relocated object at HEAD;`
        + " an archive move must commit the removal as well as the addition");
    }
  }
}

/** The active change directory a relocation of `id` must have removed. */
function activeDirectory(id) {
  return `openspec/changes/${id}`;
}

/**
 * The first relocated artifact the archive and the active path still share.
 *
 * Comparing objects rather than testing for the directory is what separates an
 * unfinished move from a re-opened id. A `null` archived object is skipped
 * rather than compared: two unreadable paths would otherwise both answer `null`
 * and match each other, reporting an incomplete relocation of a directory that
 * is not there at all.
 */
function relocatedArtifactStillActive(id, archiveDir, cwd) {
  for (const artifact of RELOCATION_ARTIFACTS) {
    const archived = objectAtPath("HEAD", `${archiveDir}/${artifact}`, cwd);
    if (archived === null) continue;
    if (objectAtPath("HEAD", `${activeDirectory(id)}/${artifact}`, cwd) === archived) return artifact;
  }
  return null;
}

/**
 * Whether the archive directory already carried a relocation artifact at `base`.
 *
 * One artifact is enough. The recogniser accepts a relocation on either
 * `assessment.json` or `proposal.md`, so requiring both here would classify a
 * pre-existing archive as newly introduced whenever the other file was absent.
 */
function carriesArtifactAt(base, archiveDir, cwd) {
  return RELOCATION_ARTIFACTS.some((artifact) => objectAtPath(base, `${archiveDir}/${artifact}`, cwd) !== null);
}
