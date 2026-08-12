/**
 * Why a value is not usable as a repository-relative path, or null when it is.
 * The reason is a bounded fragment naming the rule, never the caller's data.
 *
 * Directories are permitted, which is why this is not shared with
 * `check-changed-paths.mjs`'s reviewed-source-path rules: those must reject a
 * directory, and folding the two together would weaken that gate.
 *
 * The rules are a table rather than a ladder of returns. Both spellings are the
 * same policy, but the ladder carried one decision point per rule, which put the
 * function at the code-health complexity threshold on its own and degraded the
 * mean complexity of whichever file held it. A table adds rules without adding
 * branches, so the next rule costs nothing.
 *
 * Each rule is an object, not a positional pair. A pair widens to
 * `string | function` on destructuring, which made `repositoryPathProblem` look
 * like it returned a reason, a predicate, or null, and raised Sonar S3800.
 * Naming the members keeps the return type `string | null`; do not fold the
 * table back into tuples.
 */
const RULES = Object.freeze([
  Object.freeze({ reason: "must not contain a null byte", violates: (path) => path.includes("\0") }),
  Object.freeze({ reason: "must not contain path traversal", violates: (path) => path.includes("..") }),
  Object.freeze({ reason: "must be repository-relative, not absolute", violates: isAbsolute }),
  Object.freeze({ reason: "must use forward slashes", violates: (path) => path.includes("\\") }),
  Object.freeze({ reason: "must not end with a path separator", violates: (path) => path.endsWith("/") }),
  Object.freeze({ reason: "must not contain glob characters", violates: (path) => /[*?[{]/.test(path) }),
]);

export function repositoryPathProblem(path) {
  if (!isNonEmptyString(path)) return "must be a non-empty string";
  for (const { reason, violates } of RULES) {
    if (violates(path)) return reason;
  }
  return null;
}

function isNonEmptyString(value) {
  if (typeof value !== "string") return false;
  return value.length > 0;
}

function isAbsolute(path) {
  if (path.startsWith("/")) return true;
  return /^[A-Za-z]:[\\/]/.test(path);
}
