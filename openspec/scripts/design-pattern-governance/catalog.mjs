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
  try {
    statSync(absolute);
  } catch {
    sink.fail("invariant-registry-absent", relativePath, "invariant registry does not exist");
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(absolute, "utf8"));
  } catch (error) {
    sink.fail("invariant-registry-invalid", relativePath, `registry JSON did not parse: ${String(error?.message ?? error).slice(0, 160)}`);
    return null;
  }
  if (parsed?.schema !== REGISTRY_SCHEMA) {
    sink.fail("invariant-registry-invalid", relativePath, `registry must declare ${REGISTRY_SCHEMA}`);
    return null;
  }
  if (parsed.id_policy?.reuse !== "prohibited") {
    sink.fail("invariant-id-reuse-permitted", relativePath, "registry must continue to prohibit invariant ID reuse");
  }

  const seen = new Set();
  for (const [patternId, pattern] of Object.entries(parsed.patterns ?? {})) {
    if (!/^pattern-[a-z0-9][a-z0-9-]*$/.test(patternId)) {
      sink.fail("invariant-registry-invalid", relativePath, `pattern id ${patternId} is malformed`);
    }
    const invariants = pattern?.invariants ?? {};
    if (Object.keys(invariants).length === 0) {
      sink.fail("catalog-entry-missing-invariant-ids", relativePath, `pattern ${patternId} declares no invariants`);
    }
    for (const [invariantId, invariant] of Object.entries(invariants)) {
      if (seen.has(invariantId)) {
        sink.fail("invariant-id-duplicate", relativePath, `invariant id ${invariantId} appears more than once`);
      }
      seen.add(invariantId);
      if (!invariantId.startsWith(`${patternId}-`)) {
        sink.fail("invariant-registry-invalid", relativePath, `invariant ${invariantId} is not namespaced under ${patternId}`);
      }
      if (!["required", "conditional"].includes(invariant?.kind)) {
        sink.fail("invariant-registry-invalid", relativePath, `invariant ${invariantId} has an unknown kind`);
      }
      if (invariant?.kind === "conditional" && typeof invariant.condition !== "string") {
        sink.fail("invariant-registry-invalid", relativePath, `conditional invariant ${invariantId} must declare its condition`);
      }
      if (typeof invariant?.statement !== "string" || invariant.statement.length < 20) {
        sink.fail("invariant-registry-invalid", relativePath, `invariant ${invariantId} lacks a substantive statement`);
      }
    }
  }

  return sink.count === before ? Object.freeze(parsed) : null;
}

export function loadCatalog(repositoryRoot, relativePath, expectedEntryCount, registry, sink) {
  const before = sink.count;
  const absolute = resolve(repositoryRoot, relativePath);
  let text;
  try {
    text = readFileSync(absolute, "utf8");
  } catch {
    sink.fail("catalog-absent", relativePath, "catalog document does not exist");
    return null;
  }

  const entries = [...text.matchAll(/^### (\d+)\. (.+)$/gm)].map((match) => ({
    index: Number(match[1]),
    name: match[2].trim(),
  }));

  sink.require(entries.length === expectedEntryCount, "catalog-entry-count", relativePath,
    `expected exactly ${expectedEntryCount} catalog entries, found ${entries.length}`);

  const patternIds = [...text.matchAll(/\*\*Pattern ID:\*\* `(pattern-[a-z0-9-]+)`/g)].map((match) => match[1]);
  sink.require(patternIds.length === entries.length, "catalog-entry-missing-invariant-ids", relativePath,
    `${entries.length} entries but ${patternIds.length} pattern IDs`);
  sink.require(new Set(patternIds).size === patternIds.length, "catalog-entry-duplicate", relativePath,
    "a pattern ID appears in more than one catalog entry");

  for (const field of REQUIRED_ENTRY_FIELDS) {
    const occurrences = text.split(`**${field}**`).length - 1;
    sink.require(occurrences === expectedEntryCount, "catalog-entry-incomplete", relativePath,
      `field "${field}" appears ${occurrences} times, expected ${expectedEntryCount}`);
  }

  // A catalog presented as the only permissible set of designs would turn
  // "compare candidate approaches" into "choose from this list", which is the
  // cargo-culting the policy exists to prevent.
  sink.require(/not\s+exhaustive/i.test(text), "catalog-claims-exhaustive", relativePath,
    "the catalog must state that it is not exhaustive");
  for (const claim of [/only\s+catalog\s+entries\s+may/i, /must\s+select\s+a\s+catalog\s+pattern/i]) {
    if (claim.test(text)) {
      sink.fail("catalog-claims-exhaustive", relativePath, "the catalog must not claim that only its entries may be used");
    }
  }

  if (registry) {
    const registered = new Set(Object.keys(registry.patterns ?? {}));
    for (const id of patternIds) {
      if (!registered.has(id)) {
        sink.fail("catalog-registry-divergence", relativePath, `catalog pattern ${id} is absent from the invariant registry`);
      }
    }
    for (const id of registered) {
      if (!patternIds.includes(id)) {
        sink.fail("catalog-registry-divergence", relativePath, `registry pattern ${id} is absent from the catalog`);
      }
    }
    const knownInvariants = invariantIndex(registry);
    for (const cited of text.matchAll(/`(pattern-[a-z0-9-]+-[a-z0-9-]+)`/g)) {
      if (!knownInvariants.has(cited[1]) && !registered.has(cited[1])) {
        sink.fail("unknown-invariant", relativePath, `catalog cites unknown invariant ${cited[1]}`);
      }
    }
    for (const invariantId of knownInvariants.keys()) {
      if (!text.includes(`\`${invariantId}\``)) {
        sink.fail("catalog-registry-divergence", relativePath, `registry invariant ${invariantId} is not cited in the catalog`);
      }
    }
  }

  return sink.count === before ? Object.freeze({ entries: Object.freeze(entries), patternIds: Object.freeze(patternIds), text }) : null;
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
export function accountForInvariants(assessment, registry, documentPath, sink) {
  const binding = assessment.catalog_binding;
  if (!binding) return;

  if (binding.catalog_version !== registry.catalog_version) {
    sink.fail("catalog-version-mismatch", documentPath,
      `assessment records catalog version ${binding.catalog_version} but the registry supplies ${registry.catalog_version}`);
    return;
  }

  const pattern = registry.patterns?.[binding.pattern_id];
  if (!pattern) {
    sink.fail("unknown-pattern", documentPath, `pattern ${binding.pattern_id} is absent from catalog version ${binding.catalog_version}`);
    return;
  }

  const invariants = pattern.invariants ?? {};
  const required = Object.entries(invariants).filter(([, value]) => value.kind === "required").map(([id]) => id);
  const conditional = Object.entries(invariants).filter(([, value]) => value.kind === "conditional").map(([id]) => id);

  const declaredRequired = new Set(binding.required_invariant_ids ?? []);
  const declaredConditional = new Set(binding.conditional_invariant_ids ?? []);
  const nonApplicable = binding.non_applicable_invariants ?? [];
  const nonApplicableIds = new Set(nonApplicable.map((entry) => entry.invariant_id));

  const index = invariantIndex(registry);
  for (const id of [...declaredRequired, ...declaredConditional, ...nonApplicableIds]) {
    const known = index.get(id);
    if (!known) {
      sink.fail("unknown-invariant", documentPath, `invariant ${id} is absent from catalog version ${binding.catalog_version}`);
      continue;
    }
    if (known.patternId !== binding.pattern_id) {
      sink.fail("unrelated-invariant", documentPath,
        `invariant ${id} belongs to ${known.patternId}, not the selected pattern ${binding.pattern_id}`);
    }
  }

  for (const id of required) {
    if (declaredRequired.has(id)) continue;
    if (nonApplicableIds.has(id)) {
      sink.fail("required-invariant-declared-non-applicable", documentPath,
        `invariant ${id} is required and cannot be declared non-applicable; only catalog-declared conditional invariants may be`);
      continue;
    }
    sink.fail("required-invariant-unaccounted", documentPath, `required invariant ${id} is not accounted for`);
  }

  for (const entry of nonApplicable) {
    if (!conditional.includes(entry.invariant_id)) continue;
    if (entry.acknowledged_in_signed_record !== true) {
      sink.fail("non-applicable-invariant-unacknowledged", documentPath,
        `conditional invariant ${entry.invariant_id} is declared non-applicable without acknowledgement in the signed governance record`);
    }
  }

  const evidence = assessment.invariant_evidence ?? {};
  for (const id of declaredRequired) {
    const entry = evidence[id];
    if (!entry || (entry.task_ids ?? []).length === 0 || (entry.evidence_ids ?? []).length === 0) {
      sink.fail("invariant-evidence-absent", documentPath,
        `required invariant ${id} has no implementation task or verification evidence`);
    }
  }
}

export function accountForImplementationInvariants(assessment, documentPath, sink) {
  const evidence = assessment.invariant_evidence ?? {};
  for (const id of assessment.implementation_invariant_ids ?? []) {
    const entry = evidence[id];
    if (!entry || (entry.task_ids ?? []).length === 0 || (entry.evidence_ids ?? []).length === 0) {
      sink.fail("invariant-evidence-absent", documentPath,
        `implementation invariant ${id} has no implementation task or verification evidence`);
    }
  }
}
