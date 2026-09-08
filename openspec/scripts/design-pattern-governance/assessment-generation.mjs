import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(__dirname, "../../..");
export const changesRoot = resolve(repositoryRoot, "openspec/changes");

/** Canonical 15 security dimension keys defined in design-pattern-policy.json */
export const SECURITY_DIMENSIONS = Object.freeze([
  "audit_integrity",
  "authentication_or_authorization",
  "authority_provenance",
  "concurrency",
  "confidentiality",
  "cryptography",
  "error_disclosure",
  "external_security_integration",
  "fail_posture",
  "lifecycle",
  "mutation_ownership",
  "privacy_transformation",
  "resource_retention",
  "retry_or_redelivery",
  "trust_boundary"
]);

/** Standard negative justifications (>= 20 chars, <= 600 chars) for non-security-sensitive changes */
export const DEFAULT_SECURITY_JUSTIFICATIONS = Object.freeze({
  audit_integrity: "Generated assessment artifacts preserve all required governance assertions and audit trail records without omission.",
  authentication_or_authorization: "Does not modify, bypass, or interact with any authentication or authorization mechanisms.",
  authority_provenance: "Derives public change metadata only; no cryptographic signing or identity authority logic is altered.",
  concurrency: "Purely synchronous file I/O operations with no shared memory, concurrent workers, or race conditions.",
  confidentiality: "Operates solely on public change planning metadata and repository commit hashes; handles no sensitive data.",
  cryptography: "Does not introduce, alter, or rely upon cryptographic operations or secret management.",
  error_disclosure: "Reports descriptive file diff and schema mismatch diagnostics without disclosing system secrets or credentials.",
  external_security_integration: "Operates independently without external network connections, APIs, or third-party security services.",
  fail_posture: "Fails closed upon syntax errors, missing source files, invalid schema structures, or byte-for-byte drift.",
  lifecycle: "Bounded to one-shot CLI execution during change planning or CI verification phases.",
  mutation_ownership: "Emits assessment artifacts strictly within the targeted change directory; enforces read-only verification in check mode.",
  privacy_transformation: "Does not process user telemetry, personal data, or sensitive operational payloads.",
  resource_retention: "Retains no in-memory buffers, persistent file handles, or network sockets beyond script termination.",
  retry_or_redelivery: "Deterministic idempotency; re-running generator produces identical bytes with no side effects.",
  trust_boundary: "Tool operates strictly within local developer and CI environments; modifies no trust boundary or security perimeter."
});

/**
 * Deterministically formats an object as JSON with 2-space indentation and a trailing newline.
 */
export function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

/**
 * Extracts capability names from proposal.md if available.
 */
export function extractCapabilities(changeDir) {
  const proposalFile = resolve(changeDir, "proposal.md");
  try {
    const content = readFileSync(proposalFile, "utf8");
    const capSection = content.match(/## Capabilities[\s\S]*?(?:## |$)/)?.[0];
    if (!capSection) return ["software-design-pattern-governance"];
    const matches = Array.from(capSection.matchAll(/`([a-z0-9][a-z0-9-]{2,99})`/g), (m) => m[1]);
    const unique = Array.from(new Set(matches));
    return unique.length > 0 ? unique : ["software-design-pattern-governance"];
  } catch {
    return ["software-design-pattern-governance"];
  }
}

function extractTasksFromFile(tasksFile) {
  try {
    const content = readFileSync(tasksFile, "utf8");
    return Array.from(content.matchAll(/- \[[ xX]\] (\d+\.\d+)/g), (m) => m[1]);
  } catch {
    return [];
  }
}

function extractTasksFromEvidence(invariantEvidence) {
  if (!invariantEvidence) return [];
  const taskIds = [];
  for (const entry of Object.values(invariantEvidence)) {
    const ids = Array.isArray(entry?.task_ids) ? entry.task_ids : [];
    taskIds.push(...ids);
  }
  return taskIds;
}

/**
 * Extracts verification task IDs from tasks.md or defaults from invariant evidence.
 */
export function extractVerificationTaskIds(changeDir, source) {
  if (Array.isArray(source.verification_task_ids) && source.verification_task_ids.length > 0) {
    return [...source.verification_task_ids].sort();
  }
  const taskIds = new Set([
    ...extractTasksFromFile(resolve(changeDir, "tasks.md")),
    ...extractTasksFromEvidence(source.invariant_evidence)
  ]);
  const sorted = Array.from(taskIds).sort();
  return sorted.length > 0 ? sorted : ["1.1"];
}

function buildApplicability(source, changeDir) {
  const app = source.applicability ?? {};
  const assessmentLevel = source.assessment_level ?? "full";
  const result = {
    triggers_matched: app.triggers_matched ?? source.triggers_matched ?? [],
    material_capability_modification: Boolean(app.material_capability_modification ?? source.material_capability_modification),
    capabilities: app.capabilities ?? source.capabilities ?? extractCapabilities(changeDir)
  };
  if (assessmentLevel === "abbreviated") {
    result.full_trigger_absence_proof =
      app.full_trigger_absence_proof ??
      source.full_trigger_absence_proof ??
      "A bounded change satisfying all five abbreviated criteria and proving no full trigger applies.";
  }
  return result;
}

function buildCandidateApproaches(source, changeId) {
  const candidateApproaches = source.candidate_approaches ?? [];
  const defaultApproachId = candidateApproaches[0]?.id ?? `approach-direct-${changeId}`;
  return {
    candidateApproaches,
    selectedApproachId: source.selected_approach_id ?? defaultApproachId,
    rejectedAlternativeIds: source.rejected_alternative_ids ?? candidateApproaches.slice(1).map((a) => a.id),
    rejectionReasons: source.rejection_reasons ?? {}
  };
}

function buildSecurityJustification(source) {
  if (source.security_sensitive) {
    return null;
  }
  const custom = source.security_justification ?? {};
  const justification = {};
  for (const dim of SECURITY_DIMENSIONS) {
    justification[dim] = custom[dim] ?? DEFAULT_SECURITY_JUSTIFICATIONS[dim];
  }
  return justification;
}

function buildOrdering(source) {
  const orderingSource = source.ordering ?? {};
  const proposalBaseline = orderingSource.proposal_baseline_commit;
  if (typeof proposalBaseline !== "string" || !/^[0-9a-f]{40}$/.test(proposalBaseline)) {
    throw new Error(
      "assessment.source.json must declare ordering.proposal_baseline_commit as a 40-character Git commit ID"
    );
  }

  const ordering = { proposal_baseline_commit: proposalBaseline };
  if (orderingSource.assessment_commit) {
    ordering.assessment_commit = orderingSource.assessment_commit;
  }
  if (orderingSource.earliest_governed_implementation_commit) {
    ordering.earliest_governed_implementation_commit = orderingSource.earliest_governed_implementation_commit;
  }
  if (orderingSource.final_technical_commit) {
    ordering.final_technical_commit = orderingSource.final_technical_commit;
  }
  return ordering;
}

function loadSource(changeDir, sourceInput) {
  if (sourceInput) return sourceInput;
  const sourcePath = resolve(changeDir, "assessment.source.json");
  return JSON.parse(readFileSync(sourcePath, "utf8"));
}

/**
 * Generates the full assessment object from assessment.source.json and change metadata.
 */
export function generateAssessment(changeDir, sourceInput = null, repoRoot = repositoryRoot) {
  const changeId = basename(changeDir);
  const source = loadSource(changeDir, sourceInput);

  const applicability = buildApplicability(source, changeDir);
  const approaches = buildCandidateApproaches(source, changeId);
  const securityJustification = buildSecurityJustification(source);
  const ordering = buildOrdering(source);
  const verificationTaskIds = extractVerificationTaskIds(changeDir, source);

  const assessment = {
    schema_version: "1.1",
    change_id: changeId,
    assessment_level: source.assessment_level ?? "full",
    decision: source.decision ?? "direct_implementation",
    forces: source.forces ?? [],
    applicability
  };

  if (Array.isArray(source.owned_paths) && source.owned_paths.length > 0) {
    assessment.owned_paths = source.owned_paths;
  }

  assessment.candidate_approaches = approaches.candidateApproaches;
  assessment.selected_approach_id = approaches.selectedApproachId;
  assessment.rejected_alternative_ids = approaches.rejectedAlternativeIds;
  assessment.rejection_reasons = approaches.rejectionReasons;
  assessment.selected_pattern_ids = source.selected_pattern_ids ?? [];

  if (source.catalog_binding) {
    assessment.catalog_binding = source.catalog_binding;
  }

  assessment.implementation_invariant_ids = source.implementation_invariant_ids ?? [];
  assessment.invariant_evidence = source.invariant_evidence ?? {};
  assessment.security_sensitive = Boolean(source.security_sensitive);

  if (securityJustification) {
    assessment.security_justification = securityJustification;
  }

  assessment.ordering = ordering;

  if (source.retrospective_exception) {
    assessment.retrospective_exception = source.retrospective_exception;
  }

  assessment.verification_task_ids = verificationTaskIds;

  return assessment;
}

/**
 * Checks for drift between assessment.json and assessment.source.json.
 */
export function checkAssessmentSourceDrift(repoRoot, changeId, diagnostics) {
  const changeDir = resolve(repoRoot, `openspec/changes/${changeId}`);
  const sourceFile = resolve(changeDir, "assessment.source.json");
  if (!existsSync(sourceFile)) return;

  const assessmentFile = resolve(changeDir, "assessment.json");
  const relativePath = `openspec/changes/${changeId}/assessment.json`;
  try {
    const expected = generateAssessment(changeDir, null, repoRoot);
    const actualContent = readFileSync(assessmentFile, "utf8");
    if (actualContent !== stableJson(expected)) {
      diagnostics.fail(
        "assessment-generated-drift",
        relativePath,
        `assessment.json has diverged from assessment.source.json; run node openspec/scripts/generate-assessment.mjs --change ${changeId}`
      );
    }
  } catch (err) {
    diagnostics.fail(
      "assessment-generation-failed",
      relativePath,
      `failed to regenerate assessment from assessment.source.json: ${err.message}`
    );
  }
}

function buildScaffoldTemplate(changeId) {
  return {
    decision: "direct_implementation",
    forces: [
      "<force 1: what architectural force this design must answer; concrete description >= 8 chars>",
      "<force 2: second force if applicable>"
    ],
    candidate_approaches: [
      {
        id: `approach-direct-${changeId}`,
        kind: "direct_implementation",
        summary: "<what building this directly looks like; >= 20 chars>",
        forces_addressed: [
          "<force 1: what architectural force this design must answer; concrete description >= 8 chars>"
        ]
      },
      {
        id: `approach-alternative-${changeId}`,
        kind: "alternative",
        summary: "<what an alternative approach looks like; >= 20 chars>",
        forces_addressed: [
          "<force 1: what architectural force this design must answer; concrete description >= 8 chars>"
        ]
      }
    ],
    selected_approach_id: `approach-direct-${changeId}`,
    rejected_alternative_ids: [
      `approach-alternative-${changeId}`
    ],
    rejection_reasons: {
      [`approach-alternative-${changeId}`]: {
        forces: [
          "<force 1: what architectural force this design must answer; concrete description >= 8 chars>"
        ],
        reason: "<why this alternative does not answer the forces better; >= 40 chars>"
      }
    },
    implementation_invariant_ids: [
      `implementation-${changeId}`
    ],
    invariant_evidence: {
      [`implementation-${changeId}`]: {
        task_ids: ["1.1"],
        evidence_ids: ["<fixture or test proving this invariant>"]
      }
    },
    ordering: {
      proposal_baseline_commit: "<40-character Git commit ID at proposal baseline>"
    },
    security_sensitive: false
  };
}

/**
 * Creates an authored template assessment.source.json.
 */
export function scaffoldSource(changeDir) {
  const changeId = basename(changeDir);
  const target = resolve(changeDir, "assessment.source.json");
  if (existsSync(target)) {
    throw new Error(`${target} already exists`);
  }
  const template = buildScaffoldTemplate(changeId);
  writeFileSync(target, stableJson(template), "utf8");
  return target;
}

function hasSourceJson(dir) {
  return existsSync(resolve(dir, "assessment.source.json"));
}

/**
 * Finds all active changes that contain assessment.source.json.
 */
export function discoverManagedChanges(changesDir = changesRoot, filterName = null) {
  try {
    const entries = readdirSync(changesDir, { withFileTypes: true });
    return entries
      .filter((e) => e.isDirectory() && e.name !== "archive" && (!filterName || e.name === filterName))
      .map((e) => resolve(changesDir, e.name))
      .filter(hasSourceJson);
  } catch {
    return [];
  }
}
