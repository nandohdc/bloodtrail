/**
 * Fail-closed policy loading.
 *
 * Every distinguishable way the policy can be unusable gets its own diagnostic
 * identifier, because the failure this guards against is the quiet one: a missing
 * or unreadable policy read as "no applicable rules" and therefore as success.
 * Absence of evidence denies. It never permits, never skips, and never reports a
 * clean run.
 */

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { isWellFormedPath, matchesAny, pathProblem } from "./paths.mjs";

export const POLICY_SCHEMA = "bloodtrail.design-pattern-governance.policy";

const REQUIRED_TOP_LEVEL = Object.freeze([
  "policy_schema_version",
  "supported_policy_schema_versions",
  "controlled_values",
  "controlled_value_counts",
  "definitions",
  "full_assessment_triggers",
  "abbreviated_criteria",
  "security_dimensions",
  "path_classes",
  "governance_core_artifacts",
  "normative_paths",
  "governance_record_only_paths",
  "review_freshness",
  "protected_history_roots",
  "actor_neutral_documents",
  "protected_mainline",
  "merge",
  "activation",
  "catalog",
  "invariant_registry",
  "schemas",
  "checker",
]);

const REQUIRED_FAMILIES = Object.freeze([
  "assessment_level",
  "checker_phase",
  "decision",
  "emergency_disposition",
  "grandfathering_class",
  "lifecycle_state",
  "merge_strategy",
  "path_class",
  "review_path_kind",
  "security_declaration",
]);

/**
 * @returns {{ policy: object|null }} — `policy` is null whenever any diagnostic
 * was raised. A partially valid policy is not returned: a caller that received
 * one would have to decide which half to trust, and that decision is exactly
 * where fail-open creeps in.
 */
export function loadPolicy(repositoryRoot, relativePath, sink) {
  const before = sink.count;
  const absolute = resolve(repositoryRoot, relativePath);
  const stats = policyStats(absolute, relativePath, sink);
  if (stats === null) return { policy: null };
  const text = readPolicyText(absolute, relativePath, stats, sink);
  if (text === null) return { policy: null };
  const parsed = parsePolicyText(text, relativePath, sink);
  if (parsed === null) return { policy: null };
  if (!validatePolicyIdentity(parsed, relativePath, sink)) return { policy: null };

  return validateStructure(parsed, relativePath, sink, before);
}

function policyStats(absolute, relativePath, sink) {
  let stats;
  try {
    stats = statSync(absolute);
  } catch {
    sink.fail("policy-absent", relativePath, "policy file does not exist; absence never means no applicable changes");
    return null;
  }
  if (stats.isFile()) return stats;
  sink.fail("policy-absent", relativePath, "policy path is not a regular file");
  return null;
}

function readPolicyText(absolute, relativePath, stats, sink) {
  if (stats.size === 0) {
    sink.fail("policy-empty", relativePath, "policy file has zero bytes");
    return null;
  }
  let text;
  try {
    text = readFileSync(absolute, "utf8");
  } catch (error) {
    sink.fail("policy-unreadable", relativePath, `policy file could not be read: ${String(error?.message ?? error)}`);
    return null;
  }
  if (text.trim().length > 0) return text;
  sink.fail("policy-empty", relativePath, "policy file contains only whitespace");
  return null;
}

function parsePolicyText(text, relativePath, sink) {
  try {
    return JSON.parse(text);
  } catch (error) {
    const id = looksTruncated(text) ? "policy-truncated" : "policy-invalid-json";
    sink.fail(id, relativePath, `policy JSON did not parse: ${String(error?.message ?? error).slice(0, 160)}`);
    return null;
  }
}

function validatePolicyIdentity(parsed, relativePath, sink) {
  if (!isRecord(parsed)) {
    sink.fail("policy-invalid-json", relativePath, "policy must be a JSON object");
    return false;
  }
  if (parsed.schema === POLICY_SCHEMA) return true;
  sink.fail("policy-invalid-json", relativePath, `policy schema must be ${POLICY_SCHEMA}`);
  return false;
}

function isRecord(value) {
  if (value === null) return false;
  if (typeof value !== "object") return false;
  return !Array.isArray(value);
}

function validateStructure(parsed, relativePath, sink, before) {
  if (typeof parsed.policy_schema_version !== "string") {
    sink.fail("schema-version-absent", relativePath, "policy lacks policy_schema_version");
    return { policy: null };
  }

  validateRequiredTopLevel(parsed, relativePath, sink);
  if (sink.count !== before) return { policy: null };

  validateVersions(parsed, relativePath, sink);
  validateVocabulary(parsed, relativePath, sink);
  validatePathSets(parsed, relativePath, sink);
  validateReviewFreshness(parsed, relativePath, sink);
  validateProtectedMainline(parsed, relativePath, sink);
  validateCheckerCompatibility(parsed, relativePath, sink);

  return { policy: sink.count === before ? Object.freeze(parsed) : null };
}

function validateRequiredTopLevel(parsed, relativePath, sink) {
  for (const key of REQUIRED_TOP_LEVEL) {
    if (parsed[key] === undefined) {
      sink.fail("policy-incomplete", relativePath, `policy lacks required section ${key}`);
    }
  }
}

function validateVersions(parsed, relativePath, sink) {
  const supported = parsed.supported_policy_schema_versions;
  if (!Array.isArray(supported) || supported.length === 0) {
    sink.fail("policy-incomplete", relativePath, "supported_policy_schema_versions must be a non-empty array");
    return;
  }
  if (!supported.includes(parsed.policy_schema_version)) {
    sink.fail("checker-policy-incompatible", relativePath, `policy_schema_version ${parsed.policy_schema_version} is not in its own supported set`);
  }
  const compatibility = parsed.schema_compatibility;
  if (!compatibility || typeof compatibility !== "object") {
    sink.fail("policy-incomplete", relativePath, "policy lacks schema_compatibility");
    return;
  }
  validateSchemaCompatibility(compatibility, relativePath, sink);
}

function validateSchemaCompatibility(compatibility, relativePath, sink) {
  for (const key of ["current", "supported", "minor_rule", "major_rule", "unknown_newer", "unsupported_older", "id_reuse"]) {
    if (compatibility[key] === undefined) {
      sink.fail("policy-incomplete", relativePath, `schema_compatibility lacks ${key}`);
    }
  }
  if (compatibility.id_reuse !== "prohibited") {
    sink.fail("policy-weakened", relativePath, "schema_compatibility.id_reuse must remain prohibited");
  }
}

function validateVocabulary(parsed, relativePath, sink) {
  const families = parsed.controlled_values;
  if (!isRecord(families)) {
    sink.fail("policy-incomplete", relativePath, "controlled_values must be an object of families");
    return;
  }
  const beforeFamilies = sink.count;
  for (const family of REQUIRED_FAMILIES) {
    if (!Array.isArray(families[family]) || families[family].length === 0) {
      sink.fail("controlled-vocabulary-incomplete", relativePath, `controlled value family ${family} is missing or empty`);
    }
  }
  // Counting a vocabulary that is already known incomplete would report a second,
  // derived failure and bury the first. Anything failing earlier is unrelated to
  // whether the families themselves are well formed, so it must not stop the count.
  if (sink.count !== beforeFamilies) return;

  validateVocabularyCounts(families, parsed.controlled_value_counts ?? {}, relativePath, sink);
  validateVocabularyUniqueness(families, relativePath, sink);
}

function validateVocabularyCounts(families, declared, relativePath, sink) {
  const memberships = Object.values(families).reduce((total, values) => total + values.length, 0);
  const unique = new Set(Object.values(families).flat()).size;
  const familyCount = Object.keys(families).length;
  sink.require(familyCount === declared.families, "controlled-vocabulary-count", relativePath,
    `declared ${declared.families} families, found ${familyCount}`);
  sink.require(memberships === declared.memberships, "controlled-vocabulary-count", relativePath,
    `declared ${declared.memberships} family memberships, found ${memberships}`);
  sink.require(unique === declared.unique_values, "controlled-vocabulary-count", relativePath,
    `declared ${declared.unique_values} unique controlled values, found ${unique}`);
}

function validateVocabularyUniqueness(families, relativePath, sink) {
  for (const family of Object.keys(families)) {
    const values = families[family];
    if (new Set(values).size === values.length) continue;
    sink.fail("controlled-vocabulary-duplicate", relativePath, `family ${family} repeats a value`);
  }
}

function validatePathSets(parsed, relativePath, sink) {
  const classes = parsed.path_classes;
  if (!Array.isArray(classes) || classes.length === 0) {
    sink.fail("path-classification-absent", relativePath, "path_classes must be a non-empty array");
    return;
  }
  const known = new Set(parsed.controlled_values?.path_class ?? []);
  for (const entry of classes) validatePathClass(entry, known, relativePath, sink);

  validateRequiredPathSets(parsed, relativePath, sink);

  const roots = parsed.protected_history_roots;
  if (!Array.isArray(roots) || roots.length === 0) {
    sink.fail("protected-root-absent", relativePath, "protected_history_roots must be a non-empty array");
  }
}

function validatePathClass(entry, known, relativePath, sink) {
  if (!isRecord(entry)) {
    sink.fail("path-classification-absent", relativePath, "each path class entry must be an object");
    return;
  }
  if (!known.has(entry.class)) {
    sink.fail("path-classification-absent", relativePath, `path class ${String(entry.class)} is not a controlled value`);
  }
  if (!Array.isArray(entry.patterns) || entry.patterns.length === 0) {
    sink.fail("path-classification-absent", relativePath, `path class ${String(entry.class)} declares no patterns`);
    return;
  }
  for (const pattern of entry.patterns) validatePathPattern(entry.class, pattern, relativePath, sink);
}

function validatePathPattern(pathClass, pattern, relativePath, sink) {
  const candidate = pattern.endsWith("/") ? pattern.slice(0, -1) : pattern;
  if (isWellFormedPath(candidate)) return;
  sink.fail("path-classification-malformed", relativePath,
    `path class ${String(pathClass)} has a malformed pattern ${String(pattern)}`);
}

function validateRequiredPathSets(parsed, relativePath, sink) {
  for (const [key, id] of [
    ["normative_paths", "policy-incomplete"],
    ["governance_record_only_paths", "policy-incomplete"],
    ["governance_core_artifacts", "policy-incomplete"],
    ["actor_neutral_documents", "actor-neutral-document-absent"],
  ]) {
    const values = parsed[key];
    if (!Array.isArray(values) || values.length === 0) {
      sink.fail(id, relativePath, `${key} must be a non-empty array`);
    }
  }
}

/**
 * The one closed source the signed-review verifier reads. The record path must
 * sit inside the governance-record-only allowlist, because a signed record
 * stored on any other path would change reviewed content by the act of signing,
 * which is the exact self-reference R15 forbids.
 */
function validateReviewFreshness(parsed, relativePath, sink) {
  const section = parsed.review_freshness;
  if (!isRecord(section)) {
    sink.fail("policy-incomplete", relativePath, "review_freshness must be an object");
    return;
  }
  const recordPath = section.record_path;
  if (typeof recordPath !== "string" || recordPath.length === 0) {
    sink.fail("policy-incomplete", relativePath, "review_freshness.record_path must be a non-empty string");
    return;
  }
  const problem = pathProblem(recordPath);
  if (problem !== null) {
    sink.fail("policy-incomplete", relativePath, `review_freshness.record_path ${problem}`);
    return;
  }
  if (!matchesAny(recordPath, parsed.governance_record_only_paths ?? [])) {
    sink.fail("review-freshness-record-path-unprotected", relativePath,
      `review_freshness.record_path ${recordPath} is not covered by governance_record_only_paths; the signed-record source must sit inside the closed allowlist`);
  }
}

function validateProtectedMainline(parsed, relativePath, sink) {
  const mainline = parsed.protected_mainline;
  if (!isRecord(mainline)) {
    sink.fail("protected-mainline-evidence-absent", relativePath, "protected_mainline is missing");
    return;
  }
  if (typeof mainline.reference !== "string" || !mainline.reference.startsWith("refs/heads/")) {
    sink.fail("protected-mainline-evidence-absent", relativePath, "protected_mainline.reference must be a fully qualified ref");
  }
  if (mainline.branch_name_is_not_protection_evidence !== true) {
    sink.fail("policy-weakened", relativePath, "protected_mainline must continue to state that a branch name is not protection evidence");
  }
  const check = mainline.required_check;
  if (!isRecord(check)) {
    sink.fail("protected-mainline-evidence-absent", relativePath, "protected_mainline.required_check is missing");
    return;
  }
  validateRequiredCheckFields(check, relativePath, sink);
}

function validateRequiredCheckFields(check, relativePath, sink) {
  for (const key of ["context", "evidence_method", "evidence_command", "verified", "verified_contexts"]) {
    if (check[key] !== undefined) continue;
    sink.fail("protected-mainline-evidence-absent", relativePath, `required_check lacks ${key}`);
  }
}

function validateCheckerCompatibility(parsed, relativePath, sink) {
  const checker = parsed.checker;
  if (!checker || typeof checker !== "object") {
    sink.fail("policy-incomplete", relativePath, "checker section is missing");
    return;
  }
  const supported = checker.supported_policy_schema_versions;
  if (!Array.isArray(supported) || supported.length === 0) {
    sink.fail("checker-policy-incompatible", relativePath, "checker.supported_policy_schema_versions must be a non-empty array");
    return;
  }
  if (!supported.includes(parsed.policy_schema_version)) {
    sink.fail("checker-policy-incompatible", relativePath,
      `checker supports ${supported.join(", ")} but the policy declares ${parsed.policy_schema_version}`);
  }
}

/**
 * Distinguishes a file cut short from one that is syntactically wrong. Both fail;
 * they fail with different identifiers so a fixture can tell them apart, and so a
 * human reading CI knows whether to look at the writer or the content.
 */
function looksTruncated(text) {
  const trimmed = text.trimEnd();
  if (trimmed.length === 0) return false;
  const opens = (trimmed.match(/[[{]/g) ?? []).length;
  const closes = (trimmed.match(/[\]}]/g) ?? []).length;
  return opens > closes;
}
