/**
 * R26 — the declared classification must cover the tracked repository.
 *
 * `checkUnclassifiedPaths` asks whether every path a change *touched* carries a
 * class. That is the right question for a change and the wrong one for the
 * policy: a tracked path matching no pattern stays invisible until some
 * unrelated change happens to touch it, and then fails that change for a gap it
 * did not create. This module asks the repository-scoped question instead, so
 * the gap fails the change that introduces it.
 *
 * Emergency records are deliberately not consulted. An R21 record binds one
 * exact change and ends when that change merges or is abandoned; a tracked file
 * outlives every change, so an emergency record can satisfy the range-scoped
 * rule and must never satisfy this one.
 */

import { byCodePoint } from "./diagnostics.mjs";
import { trackedPaths } from "./git.mjs";
import { UNCLASSIFIED, classifyPath } from "./perimeter.mjs";

/**
 * Returns the number of tracked paths classified, or null when the tracked set
 * could not be read. A null return has already recorded its own diagnostic.
 */
export function checkClassificationCompleteness({ cwd, policy, sink }) {
  const tracked = trackedPaths(cwd);
  if (tracked === null) {
    sink.fail("tracked-paths-unavailable", ".",
      "cannot enumerate tracked paths; classification completeness fails closed rather than treating an unreadable repository as fully classified");
    return null;
  }

  const uncovered = tracked
    .filter((path) => classifyPath(path, policy) === UNCLASSIFIED)
    .sort(byCodePoint);

  // Every uncovered path is named, not just the first. A diagnostic that stops
  // at one turns a single edit into a sequence of rediscoveries as each newly
  // first path surfaces.
  for (const path of uncovered) {
    sink.fail("path-classification-incomplete", path,
      "tracked path matches no declared classification; the declared classification must cover the tracked repository");
  }

  return tracked.length;
}
