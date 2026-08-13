/**
 * Catalog and invariant registry.
 *
 * Selecting a catalog pattern binds it: every required invariant of the recorded
 * catalog version must be accounted for. The registry is the authority on which
 * invariants exist and which are conditional; the catalog document is the prose
 * that must agree with it. Where they disagree, that disagreement is a failure,
 * not a preference for one of them.
 */

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";

export const REGISTRY_SCHEMA = "bloodtrail.design-pattern-governance.invariant-registry";

const REQUIRED_ENTRY_FIELDS = Object.freeze([
  "Intent.",
  "Use when.",
  "Avoid when.",
  "TypeScript / Node.js shape.",
  "Security implications.",
  "Concurrency implications.",
  "Minimum verification.",
  "Misuse.",
  "Related patterns.",
]);

export function loadRegistry(repositoryRoot, relativePath, sink) {
  const before = sink.count;
  const absolute = resolve(repositoryRoot, relativePath);
  if (!registryFileExists(absolute, relativePath, sink)) return null;
  const parsed = parseRegistryFile(absolute, relativePath, sink);
  if (parsed === null) return null;
  if (!validateRegistryIdentity(parsed, relativePath, sink)) return null;
  if (parsed.id_policy?.reuse !== "prohibited") {
    sink.fail("invariant-id-reuse-permitted", relativePath, "registry must continue to prohibit invariant ID reuse");
  }

  validateRegistryPatterns(parsed, relativePath, sink);
  return sink.count === before ? Object.freeze(parsed) : null;
}

function registryFileExists(absolute, relativePath, sink) {
  try {
    statSync(absolute);
    return true;
  } catch {
    sink.fail("invariant-registry-absent", relativePath, "invariant registry does not exist");
    return false;
  }
}

function parseRegistryFile(absolute, relativePath, sink) {
  try {
    return JSON.parse(readFileSync(absolute, "utf8"));
  } catch (error) {
    sink.fail("invariant-registry-invalid", relativePath,
      `registry JSON did not parse: ${String(error?.message ?? error).slice(0, 160)}`);
    return null;
  }
}

function validateRegistryIdentity(parsed, relativePath, sink) {
  if (parsed?.schema === REGISTRY_SCHEMA) return true;
  sink.fail("invariant-registry-invalid", relativePath, `registry must declare ${REGISTRY_SCHEMA}`);
  return false;
}

function validateRegistryPatterns(parsed, relativePath, sink) {
  const seen = new Set();
  for (const [patternId, pattern] of Object.entries(parsed.patterns ?? {})) {
    validatePatternId(patternId, relativePath, sink);
    const invariants = pattern?.invariants ?? {};
    validatePatternHasInvariants(patternId, invariants, relativePath, sink);
    for (const [invariantId, invariant] of Object.entries(invariants)) {
      validateInvariant(patternId, invariantId, invariant, { seen, relativePath, sink });
    }
  }
}

function validatePatternId(patternId, relativePath, sink) {
  if (/^pattern-[a-z0-9][a-z0-9-]*$/.test(patternId)) return;
  sink.fail("invariant-registry-invalid", relativePath, `pattern id ${patternId} is malformed`);
}

function validatePatternHasInvariants(patternId, invariants, relativePath, sink) {
  if (Object.keys(invariants).length > 0) return;
  sink.fail("catalog-entry-missing-invariant-ids", relativePath, `pattern ${patternId} declares no invariants`);
}

function validateInvariant(patternId, invariantId, invariant, { seen, relativePath, sink }) {
  validateInvariantIdentity(patternId, invariantId, { seen, relativePath, sink });
  validateInvariantKind(invariantId, invariant, relativePath, sink);
  validateInvariantStatement(invariantId, invariant, relativePath, sink);
}

function validateInvariantIdentity(patternId, invariantId, { seen, relativePath, sink }) {
  if (seen.has(invariantId)) {
    sink.fail("invariant-id-duplicate", relativePath, `invariant id ${invariantId} appears more than once`);
  }
  seen.add(invariantId);
  if (!invariantId.startsWith(`${patternId}-`)) {
    sink.fail("invariant-registry-invalid", relativePath, `invariant ${invariantId} is not namespaced under ${patternId}`);
  }
}

function validateInvariantKind(invariantId, invariant, relativePath, sink) {
  if (!["required", "conditional"].includes(invariant?.kind)) {
    sink.fail("invariant-registry-invalid", relativePath, `invariant ${invariantId} has an unknown kind`);
  }
  if (invariant?.kind === "conditional" && typeof invariant.condition !== "string") {
    sink.fail("invariant-registry-invalid", relativePath, `conditional invariant ${invariantId} must declare its condition`);
  }
}

function validateInvariantStatement(invariantId, invariant, relativePath, sink) {
  if (typeof invariant?.statement === "string" && invariant.statement.length >= 20) return;
  sink.fail("invariant-registry-invalid", relativePath, `invariant ${invariantId} lacks a substantive statement`);
}

export function loadCatalog(repositoryRoot, relativePath, { expectedEntryCount, registry, sink }) {
  const before = sink.count;
  const absolute = resolve(repositoryRoot, relativePath);
  const text = readCatalog(absolute, relativePath, sink);
  if (text === null) return null;

  const entries = [...text.matchAll(/^### (\d+)\. (.+)$/gm)].map((match) => ({
    index: Number(match[1]),
    name: match[2].trim(),
  }));

  const patternIds = [...text.matchAll(/\*\*Pattern ID:\*\* `(pattern-[a-z0-9-]+)`/g)].map((match) => match[1]);
  validateCatalogShape({ text, entries, patternIds, expectedEntryCount, relativePath, sink });
  validateCatalogClaims(text, relativePath, sink);
  if (registry) validateCatalogRegistry({ text, patternIds, registry, relativePath, sink });

  return sink.count === before ? Object.freeze({ entries: Object.freeze(entries), patternIds: Object.freeze(patternIds), text }) : null;
}

function readCatalog(absolute, relativePath, sink) {
  try {
    return readFileSync(absolute, "utf8");
  } catch {
    sink.fail("catalog-absent", relativePath, "catalog document does not exist");
    return null;
  }
}

function validateCatalogShape({ text, entries, patternIds, expectedEntryCount, relativePath, sink }) {
  sink.require(entries.length === expectedEntryCount, "catalog-entry-count", relativePath,
    `expected exactly ${expectedEntryCount} catalog entries, found ${entries.length}`);
  sink.require(patternIds.length === entries.length, "catalog-entry-missing-invariant-ids", relativePath,
    `${entries.length} entries but ${patternIds.length} pattern IDs`);
  sink.require(new Set(patternIds).size === patternIds.length, "catalog-entry-duplicate", relativePath,
    "a pattern ID appears in more than one catalog entry");
  for (const field of REQUIRED_ENTRY_FIELDS) {
    const occurrences = text.split(`**${field}**`).length - 1;
    sink.require(occurrences === expectedEntryCount, "catalog-entry-incomplete", relativePath,
      `field "${field}" appears ${occurrences} times, expected ${expectedEntryCount}`);
  }
}

function validateCatalogClaims(text, relativePath, sink) {
  // A catalog presented as the only permissible set of designs would turn
  // "compare candidate approaches" into "choose from this list", which is the
  // cargo-culting the policy exists to prevent.
  sink.require(/not\s+exhaustive/i.test(text), "catalog-claims-exhaustive", relativePath,
    "the catalog must state that it is not exhaustive");
  for (const claim of [/only\s+catalog\s+entries\s+may/i, /must\s+select\s+a\s+catalog\s+pattern/i]) {
    if (!claim.test(text)) continue;
    sink.fail("catalog-claims-exhaustive", relativePath,
      "the catalog must not claim that only its entries may be used");
  }
}

function validateCatalogRegistry({ text, patternIds, registry, relativePath, sink }) {
  const registered = new Set(Object.keys(registry.patterns ?? {}));
  compareCatalogPatternIds(patternIds, registered, relativePath, sink);
  const knownInvariants = invariantIndex(registry);
  validateCatalogInvariantCitations(text, registered, knownInvariants, { relativePath, sink });
}

function compareCatalogPatternIds(patternIds, registered, relativePath, sink) {
  validateCatalogPatternsRegistered(patternIds, registered, relativePath, sink);
  validateRegisteredPatternsCataloged(patternIds, registered, relativePath, sink);
}

function validateCatalogPatternsRegistered(patternIds, registered, relativePath, sink) {
  for (const id of patternIds) {
    if (registered.has(id)) continue;
    sink.fail("catalog-registry-divergence", relativePath, `catalog pattern ${id} is absent from the invariant registry`);
  }
}

function validateRegisteredPatternsCataloged(patternIds, registered, relativePath, sink) {
  for (const id of registered) {
    if (patternIds.includes(id)) continue;
    sink.fail("catalog-registry-divergence", relativePath, `registry pattern ${id} is absent from the catalog`);
  }
}

function validateCatalogInvariantCitations(text, registered, knownInvariants, { relativePath, sink }) {
  validateCitedInvariantsKnown(text, registered, knownInvariants, relativePath, sink);
  validateKnownInvariantsCited(text, knownInvariants, relativePath, sink);
}

function validateCitedInvariantsKnown(text, registered, knownInvariants, relativePath, sink) {
  for (const cited of text.matchAll(/`(pattern-[a-z0-9-]+-[a-z0-9-]+)`/g)) {
    if (knownInvariants.has(cited[1]) || registered.has(cited[1])) continue;
    sink.fail("unknown-invariant", relativePath, `catalog cites unknown invariant ${cited[1]}`);
  }
}

function validateKnownInvariantsCited(text, knownInvariants, relativePath, sink) {
  for (const invariantId of knownInvariants.keys()) {
    if (text.includes(`\`${invariantId}\``)) continue;
    sink.fail("catalog-registry-divergence", relativePath,
      `registry invariant ${invariantId} is not cited in the catalog`);
  }
}

export function invariantIndex(registry) {
  const index = new Map();
  for (const [patternId, pattern] of Object.entries(registry.patterns ?? {})) {
    for (const [invariantId, invariant] of Object.entries(pattern.invariants ?? {})) {
      index.set(invariantId, { ...invariant, patternId });
    }
  }
  return index;
}

/**
 * Invariant accounting for a named-pattern decision.
 *
 * "Accounted for" means named *and* evidenced. A required invariant listed
 * without a task and a verification evidence id is a claim, not a control, so it
 * fails with its own identifier rather than passing on the strength of the list.
 */
export function accountForInvariants(assessment, registry, { documentPath, sink }) {
  const binding = assessment.catalog_binding;
  if (!binding) return;

  if (!catalogVersionMatches(binding, registry, documentPath, sink)) return;
  const pattern = selectedPattern(binding, registry, documentPath, sink);
  if (pattern === null) return;

  const invariants = pattern.invariants ?? {};
  const required = invariantIdsByKind(invariants, "required");
  const conditional = invariantIdsByKind(invariants, "conditional");
  const declarations = declaredInvariants(binding);
  const nonApplicable = binding.non_applicable_invariants ?? [];
  const nonApplicableIds = new Set(nonApplicable.map((entry) => entry.invariant_id));

  const index = invariantIndex(registry);
  for (const id of [...declarations.required, ...declarations.conditional, ...nonApplicableIds]) {
    validateDeclaredInvariant(id, binding, index, { documentPath, sink });
  }
  for (const id of required) {
    validateRequiredInvariant(id, declarations.required, nonApplicableIds, { documentPath, sink });
  }
  for (const entry of nonApplicable) {
    validateNonApplicableInvariant(entry, conditional, { documentPath, sink });
  }
  for (const id of declarations.required) {
    validateInvariantEvidence(id, assessment.invariant_evidence ?? {}, "required", { documentPath, sink });
  }
}

function catalogVersionMatches(binding, registry, documentPath, sink) {
  if (binding.catalog_version === registry.catalog_version) return true;
  sink.fail("catalog-version-mismatch", documentPath,
    `assessment records catalog version ${binding.catalog_version} but the registry supplies ${registry.catalog_version}`);
  return false;
}

function selectedPattern(binding, registry, documentPath, sink) {
  const pattern = registry.patterns?.[binding.pattern_id];
  if (pattern) return pattern;
  sink.fail("unknown-pattern", documentPath,
    `pattern ${binding.pattern_id} is absent from catalog version ${binding.catalog_version}`);
  return null;
}

function invariantIdsByKind(invariants, kind) {
  return Object.entries(invariants).filter(([, value]) => value.kind === kind).map(([id]) => id);
}

function declaredInvariants(binding) {
  return {
    required: new Set(binding.required_invariant_ids ?? []),
    conditional: new Set(binding.conditional_invariant_ids ?? []),
  };
}

function validateDeclaredInvariant(id, binding, index, { documentPath, sink }) {
  const known = index.get(id);
  if (!known) {
    sink.fail("unknown-invariant", documentPath,
      `invariant ${id} is absent from catalog version ${binding.catalog_version}`);
    return;
  }
  if (known.patternId === binding.pattern_id) return;
  sink.fail("unrelated-invariant", documentPath,
    `invariant ${id} belongs to ${known.patternId}, not the selected pattern ${binding.pattern_id}`);
}

function validateRequiredInvariant(id, declaredRequired, nonApplicableIds, { documentPath, sink }) {
  if (declaredRequired.has(id)) return;
  if (nonApplicableIds.has(id)) {
    sink.fail("required-invariant-declared-non-applicable", documentPath,
      `invariant ${id} is required and cannot be declared non-applicable; only catalog-declared conditional invariants may be`);
    return;
  }
  sink.fail("required-invariant-unaccounted", documentPath, `required invariant ${id} is not accounted for`);
}

function validateNonApplicableInvariant(entry, conditional, { documentPath, sink }) {
  if (!conditional.includes(entry.invariant_id)) return;
  if (entry.acknowledged_in_signed_record === true) return;
  sink.fail("non-applicable-invariant-unacknowledged", documentPath,
    `conditional invariant ${entry.invariant_id} is declared non-applicable without acknowledgement in the signed governance record`);
}

function validateInvariantEvidence(id, evidence, kind, { documentPath, sink }) {
  const entry = evidence[id];
  if (hasCompleteInvariantEvidence(entry)) return;
  sink.fail("invariant-evidence-absent", documentPath,
    `${kind} invariant ${id} has no implementation task or verification evidence`);
}

function hasCompleteInvariantEvidence(entry) {
  if (!entry) return false;
  if (!((entry.task_ids ?? []).length > 0)) return false;
  return (entry.evidence_ids ?? []).length > 0;
}

export function accountForImplementationInvariants(assessment, { documentPath, sink }) {
  const evidence = assessment.invariant_evidence ?? {};
  for (const id of assessment.implementation_invariant_ids ?? []) {
    validateInvariantEvidence(id, evidence, "implementation", { documentPath, sink });
  }
}
