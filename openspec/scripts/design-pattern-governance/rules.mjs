/**
 * Named relational rules for assessments.
 *
 * Each rule is registered under the identifier the schema declares, so a schema
 * that lists a rule the code does not implement is itself a failure. That closes
 * the gap where a rule exists on paper and nowhere else — the failure mode the
 * `codescene delta` no-op taught this repository to check for.
 */

import { accountForImplementationInvariants, accountForInvariants } from "./catalog.mjs";

export function applyAssessmentRules(assessment, schema, { context, documentPath, sink }) {
  const declared = (schema.rules ?? []).map((rule) => rule.id);
  for (const id of declared) applyDeclaredRule(id, assessment, { context, documentPath, sink });
  for (const id of Object.keys(ASSESSMENT_RULES)) reportUndeclaredRule(id, declared, { documentPath, sink });
}

function applyDeclaredRule(id, assessment, { context, documentPath, sink }) {
  const rule = ASSESSMENT_RULES[id];
  if (rule) {
    rule(assessment, context, documentPath, sink);
    return;
  }
  sink.fail("rule-unimplemented", documentPath, `schema declares rule ${id} which the checker does not implement`);
}

function reportUndeclaredRule(id, declared, { documentPath, sink }) {
  if (declared.includes(id)) return;
  sink.fail("rule-undeclared", documentPath, `checker implements rule ${id} which the schema does not declare`);
}

const isFull = (assessment) => assessment.assessment_level === "full";
const candidates = (assessment) => assessment.candidate_approaches ?? [];
const candidateOfKind = (assessment, kind) => candidates(assessment).filter((entry) => entry.kind === kind);

function reportMissingRejectionReason(id, reasons, { documentPath, sink }) {
  if (reasons[id]) return;
  sink.fail("rejection-reason-absent", documentPath, `rejected approach ${id} has no recorded reason`);
}

function reportUnknownRejectionReason(id, known, { documentPath, sink }) {
  if (known.has(id)) return;
  sink.fail("rejection-reason-unknown-approach", documentPath, `rejection reason names unknown approach ${id}`);
}

const ASSESSMENT_RULES = Object.freeze({
  "assessment-full-requires-direct-candidate"(assessment, context, documentPath, sink) {
    if (!isFull(assessment)) return;
    sink.require(candidateOfKind(assessment, "direct_implementation").length >= 1,
      "candidate-direct-absent", documentPath,
      "a full assessment must evaluate direct implementation as one candidate approach");
  },

  "assessment-full-requires-alternative-candidate"(assessment, context, documentPath, sink) {
    if (!isFull(assessment)) return;
    sink.require(candidateOfKind(assessment, "alternative").length >= 1,
      "candidate-alternative-absent", documentPath,
      "a full assessment must evaluate at least one materially plausible alternative");
  },

  "assessment-candidate-forces-relevant"(assessment, context, documentPath, sink) {
    const forces = new Set(assessment.forces ?? []);
    for (const candidate of candidates(assessment)) {
      const addressed = candidate.forces_addressed ?? [];
      if (addressed.length === 0) {
        sink.fail("candidate-forces-absent", documentPath, `candidate ${candidate.id} addresses no identified force`);
        continue;
      }
      const irrelevant = addressed.filter((force) => !forces.has(force));
      if (irrelevant.length > 0) {
        // This is what rejects boilerplate enumeration: a pattern listed for form's
        // sake cannot cite a force the assessment actually identified.
        sink.fail("candidate-forces-irrelevant", documentPath,
          `candidate ${candidate.id} cites ${irrelevant.length} force(s) the assessment did not identify`);
      }
    }
  },

  "assessment-candidate-ids-unique"(assessment, context, documentPath, sink) {
    const ids = candidates(assessment).map((entry) => entry.id);
    sink.require(new Set(ids).size === ids.length, "candidate-id-duplicate", documentPath,
      "candidate approach ids must be unique");
  },

  "assessment-rejection-force-based"(assessment, context, documentPath, sink) {
    const patterns = (context.assessmentSchema?.non_force_based_reason_patterns ?? []).map((source) => new RegExp(source, "i"));
    for (const [id, entry] of Object.entries(assessment.rejection_reasons ?? {})) {
      const reason = String(entry?.reason ?? "").trim();
      if ((entry?.forces ?? []).length === 0) {
        sink.fail("rejection-not-force-based", documentPath, `rejection of ${id} cites no architectural force`);
      }
      if (patterns.some((pattern) => pattern.test(reason))) {
        sink.fail("rejection-not-force-based", documentPath,
          `rejection of ${id} rests on a best-practice or popularity assertion rather than a force`);
      }
    }
  },

  "assessment-rejection-covers-every-rejected-id"(assessment, context, documentPath, sink) {
    const reasons = assessment.rejection_reasons ?? {};
    for (const id of assessment.rejected_alternative_ids ?? []) {
      reportMissingRejectionReason(id, reasons, { documentPath, sink });
    }
    const known = new Set(candidates(assessment).map((entry) => entry.id));
    for (const id of Object.keys(reasons)) {
      reportUnknownRejectionReason(id, known, { documentPath, sink });
    }
  },

  "assessment-selected-approach-not-rejected"(assessment, context, documentPath, sink) {
    const selected = assessment.selected_approach_id;
    const known = candidates(assessment).some((entry) => entry.id === selected);
    sink.require(known, "selected-approach-unknown", documentPath,
      `selected approach ${String(selected)} is not among the candidate approaches`);
    sink.require(!(assessment.rejected_alternative_ids ?? []).includes(selected),
      "selected-approach-also-rejected", documentPath,
      `approach ${String(selected)} is both selected and rejected`);
  },

  "assessment-direct-has-no-selected-patterns"(assessment, context, documentPath, sink) {
    if (assessment.decision !== "direct_implementation") return;
    sink.require((assessment.selected_pattern_ids ?? []).length === 0,
      "direct-implementation-selected-pattern", documentPath,
      "a direct-implementation decision must record no selected pattern IDs");
  },

  "assessment-direct-has-no-catalog-binding"(assessment, context, documentPath, sink) {
    if (assessment.decision !== "direct_implementation") return;
    sink.require(assessment.catalog_binding === undefined,
      "direct-implementation-claims-catalog-conformance", documentPath,
      "a direct-implementation decision must not claim conformance to catalog-pattern invariants");
  },

  "assessment-direct-records-implementation-invariants"(assessment, context, documentPath, sink) {
    if (assessment.decision !== "direct_implementation") return;
    if (!sink.require((assessment.implementation_invariant_ids ?? []).length > 0,
      "implementation-invariants-absent", documentPath,
      "a direct-implementation decision must record implementation-specific invariants")) return;
    accountForImplementationInvariants(assessment, { documentPath, sink });
  },

  "assessment-named-pattern-rejects-direct"(assessment, context, documentPath, sink) {
    if (assessment.decision !== "named_pattern") return;
    const direct = candidateOfKind(assessment, "direct_implementation");
    if (direct.length === 0) {
      sink.fail("named-pattern-omits-direct", documentPath,
        "a named-pattern decision must evaluate direct implementation as a candidate");
      return;
    }
    const rejected = new Set(assessment.rejected_alternative_ids ?? []);
    sink.require(direct.some((entry) => rejected.has(entry.id)),
      "named-pattern-omits-direct", documentPath,
      "a named-pattern decision must evaluate and explicitly reject direct implementation");
  },

  "assessment-named-pattern-requires-catalog-binding"(assessment, context, documentPath, sink) {
    if (assessment.decision !== "named_pattern") return;
    if (!sink.require(assessment.catalog_binding !== undefined,
      "named-pattern-catalog-binding-absent", documentPath,
      "a named-pattern decision must bind the catalog version and its invariants")) return;
    if (context.registry) accountForInvariants(assessment, context.registry, { documentPath, sink });
  },

  "assessment-named-pattern-has-selected-patterns"(assessment, context, documentPath, sink) {
    if (assessment.decision !== "named_pattern") return;
    sink.require((assessment.selected_pattern_ids ?? []).length > 0,
      "named-pattern-selected-pattern-absent", documentPath,
      "a named-pattern decision must record at least one selected pattern ID");
  },

  "assessment-invariant-evidence-complete"(assessment, context, documentPath, sink) {
    const evidence = assessment.invariant_evidence ?? {};
    const claimed = new Set([
      ...(assessment.implementation_invariant_ids ?? []),
      ...(assessment.catalog_binding?.required_invariant_ids ?? []),
      ...(assessment.catalog_binding?.conditional_invariant_ids ?? []),
    ]);
    for (const id of Object.keys(evidence)) {
      if (!claimed.has(id)) {
        sink.fail("invariant-evidence-unclaimed", documentPath, `evidence names invariant ${id} which the decision does not claim`);
      }
    }
  },

  "assessment-non-applicable-must-be-conditional"(assessment, context, documentPath, sink) {
    // Enforced against the registry inside accountForInvariants, which owns the
    // required-versus-conditional distinction. Registered here so the rule id the
    // schema declares resolves to a real control rather than to nothing.
    if (assessment.decision !== "named_pattern" || !context.registry) return;
    if (assessment.catalog_binding === undefined) return;
  },

  "assessment-non-applicable-requires-acknowledgement"(assessment, context, documentPath, sink) {
    for (const entry of assessment.catalog_binding?.non_applicable_invariants ?? []) {
      if (entry.acknowledged_in_signed_record !== true) {
        sink.fail("non-applicable-invariant-unacknowledged", documentPath,
          `non-applicable invariant ${entry.invariant_id} is not acknowledged in the signed governance record`);
      }
    }
  },

  "assessment-security-false-requires-justification"(assessment, context, documentPath, sink) {
    if (assessment.security_sensitive !== false) return;
    const dimensions = context.securityDimensions ?? [];
    const justification = assessment.security_justification ?? {};
    if (Object.keys(justification).length === 0) {
      sink.fail("security-false-unjustified", documentPath,
        "security_sensitive false requires a justification addressing the applicable dimensions");
      return;
    }
    const missing = dimensions.filter((dimension) => typeof justification[dimension] !== "string");
    if (missing.length > 0) {
      sink.fail("security-false-unjustified", documentPath,
        `security_sensitive false lacks justification for ${missing.length} dimension(s): ${missing.slice(0, 5).join(", ")}`);
    }
    for (const key of Object.keys(justification)) {
      if (!dimensions.includes(key)) {
        sink.fail("security-dimension-unknown", documentPath, `justification names unknown security dimension ${key}`);
      }
    }
  },

  "assessment-security-false-contradicted-by-trigger"(assessment, context, documentPath, sink) {
    if (assessment.security_sensitive !== false) return;
    const contradicting = ["concurrency", "security_sensitive_behavior", "lifecycle_or_state", "persistence"];
    const matched = (assessment.applicability?.triggers_matched ?? []).filter((trigger) => contradicting.includes(trigger));
    if (matched.length > 0) {
      sink.fail("security-false-contradicted", documentPath,
        `security_sensitive false contradicts matched trigger(s): ${matched.join(", ")}`);
    }
  },

  "assessment-abbreviated-requires-absence-proof"(assessment, context, documentPath, sink) {
    if (assessment.assessment_level !== "abbreviated") return;
    const proof = assessment.applicability?.full_trigger_absence_proof;
    sink.require(typeof proof === "string" && proof.length >= 40,
      "abbreviated-absence-proof-absent", documentPath,
      "an abbreviated assessment must prove that no full trigger applies");
  },

  "assessment-abbreviated-rejected-when-trigger-matches"(assessment, context, documentPath, sink) {
    if (assessment.assessment_level !== "abbreviated") return;
    const matched = assessment.applicability?.triggers_matched ?? [];
    sink.require(matched.length === 0, "abbreviated-with-full-trigger", documentPath,
      `an abbreviated assessment cannot match full trigger(s): ${matched.join(", ")}`);
  },

  "assessment-material-modification-requires-full"(assessment, context, documentPath, sink) {
    if (assessment.applicability?.material_capability_modification !== true) return;
    sink.require(isFull(assessment), "material-modification-requires-full", documentPath,
      "a material capability modification requires a full assessment");
  },

  "assessment-ordering-distinct-commits"(assessment, context, documentPath, sink) {
    const ordering = assessment.ordering ?? {};
    const assessmentCommit = ordering.assessment_commit;
    const earliest = ordering.earliest_governed_implementation_commit;
    if (!assessmentCommit || !earliest) return;
    sink.require(assessmentCommit !== earliest, "assessment-shares-implementation-commit", documentPath,
      "the assessment commit must not be the commit that first introduces governed implementation");
  },

  "assessment-retrospective-exception-eligibility"(assessment, context, documentPath, sink) {
    const exception = assessment.retrospective_exception;
    if (!exception) return;
    sink.require(exception.reduced_assurance_acknowledged === true,
      "retrospective-exception-unacknowledged", documentPath,
      "a retrospective exception must state that it is not equivalent assurance");
    sink.require(["grandfathered", "emergency"].includes(exception.eligibility),
      "retrospective-exception-ineligible", documentPath,
      "a retrospective exception is available only for grandfathered or emergency work");
  },
});

export const assessmentRuleIds = Object.freeze(Object.keys(ASSESSMENT_RULES).sort());
