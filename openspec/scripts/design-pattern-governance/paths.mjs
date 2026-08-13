/**
 * Repository-relative path handling.
 *
 * Governance inputs are untrusted repository data. A path that is absolute,
 * escapes the repository, carries a NUL, or uses backslashes is rejected rather
 * than normalised into something plausible — normalising an attacker-shaped path
 * into a valid one is how traversal checks are defeated.
 */

const PATH_RULES = Object.freeze([
  Object.freeze([(path) => typeof path !== "string" || path.length === 0, () => "must be a non-empty string"]),
  Object.freeze([(path) => path.includes("\0"), () => "contains a null byte"]),
  Object.freeze([(path) => path.split("/").includes(".."), () => "must not contain path traversal"]),
  Object.freeze([isAbsolutePath, () => "must be repository-relative, not absolute"]),
  Object.freeze([(path) => path.includes("\\"), () => "must use forward slashes"]),
  Object.freeze([(path) => /[*?[\]{}]/.test(path), () => "must not contain glob characters"]),
  Object.freeze([(path) => path.startsWith("./") || path.startsWith("/"), () => "must not be prefixed with a path marker"]),
]);

export function isAbsolutePath(path) {
  if (typeof path !== "string") return false;
  if (path.startsWith("/")) return true;
  return /^[A-Za-z]:[\\/]/.test(path);
}

/** Returns null when the path is well formed, otherwise the reason it is not. */
export function pathProblem(path) {
  for (const [violates, describe] of PATH_RULES) {
    if (violates(path)) return describe(path);
  }
  return null;
}

export function isWellFormedPath(path) {
  return pathProblem(path) === null;
}

/**
 * Prefix matching where a pattern ending in "/" matches a directory subtree and
 * anything else matches the exact path. "a/bc" must not match the pattern "a/b".
 */
export function matchesPattern(path, pattern) {
  if (pattern.endsWith("/")) return path.startsWith(pattern);
  return path === pattern || path.startsWith(`${pattern}/`);
}

export function matchesAny(path, patterns) {
  return patterns.some((pattern) => matchesPattern(path, pattern));
}

/**
 * Prefix matching with a single `*` standing for exactly one path segment, so
 * `openspec/changes/*​/design.md` names every change's design without also
 * naming everything beneath a change directory.
 */
export function matchesSegmentPattern(path, pattern) {
  if (!pattern.includes("*")) return matchesPattern(path, pattern);
  const trailingDirectory = pattern.endsWith("/");
  const patternSegments = (trailingDirectory ? pattern.slice(0, -1) : pattern).split("/");
  const pathSegments = path.split("/");
  if (trailingDirectory ? pathSegments.length < patternSegments.length : pathSegments.length !== patternSegments.length) {
    return false;
  }
  return patternSegments.every((segment, index) => segment === "*" || segment === pathSegments[index]);
}

/**
 * `include` minus `exclude`. Both sides accept the single-segment wildcard, so a
 * caller can name a broad governed prefix and carve planning artifacts back out
 * of it without restating the prefix.
 */
export function matchesSelection(path, selection) {
  const include = Array.isArray(selection) ? selection : (selection.include ?? []);
  const exclude = Array.isArray(selection) ? [] : (selection.exclude ?? []);
  if (exclude.some((pattern) => matchesSegmentPattern(path, pattern))) return false;
  return include.some((pattern) => matchesSegmentPattern(path, pattern));
}

/**
 * The most specific pattern wins, measured by pattern length. Without this a
 * broad `packages/` entry would silently outrank a precise
 * `packages/…/verification-lifecycle.json` entry depending on declaration order,
 * which would make classification depend on how the policy file is sorted.
 */
export function longestMatch(path, patterns) {
  let best = null;
  for (const pattern of patterns) {
    if (!matchesPattern(path, pattern)) continue;
    if (best === null || pattern.length > best.length) best = pattern;
  }
  return best;
}
