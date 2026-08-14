/**
 * R1-R5 and R8 — applicability, candidate comparison, decision structure,
 * catalog binding, and security classification.
 *
 * Every case is a one-relation mutation of a seeded assessment that passes. If
 * the seed stopped passing, all of these would fail for that reason instead of
 * for the relation each is named after, which is why the first test asserts the
 * seed.
 */

import { after, describe, it } from "node:test";

import { ASSESSMENT, createRepository } from "./support/disposable-repo.mjs";
import { assertDiagnostic, assertPasses, assertWarning, runChecker } from "./support/harness.mjs";

const repositories = [];
function fixture(mutate) {
  const repository = createRepository();
  repositories.push(repository);
  if (mutate) repository.mutateJson(ASSESSMENT, mutate);
  return repository;
}
const check = (repository) => runChecker(repository, { phase: "assessment" });
after(() => {
  for (const repository of repositories) repository.dispose();
});

/** The alternative the seed rejects, reusable when a case needs to move it. */
const ALTERNATIVE = "approach-composed-specifications";
const DIRECT = "approach-direct-functions";

describe("R2 candidate approaches", () => {
  it("accepts direct implementation with a plausible force-matching alternative", () => {
    assertPasses(check(fixture()));
  });

  it("rejects a full assessment with no alternative evaluated", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.candidate_approaches = assessment.candidate_approaches.filter((entry) => entry.kind !== "alternative");
      assessment.rejected_alternative_ids = [];
      assessment.rejection_reasons = {};
      return assessment;
    })), "candidate-alternative-absent");
  });

  it("rejects a full assessment that omits direct implementation", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.candidate_approaches = assessment.candidate_approaches.filter((entry) => entry.kind !== "direct_implementation");
      assessment.selected_approach_id = ALTERNATIVE;
      assessment.rejected_alternative_ids = [DIRECT];
      return assessment;
    })), "candidate-direct-absent");
  });

  it("rejects a best-practice assertion as a rejection reason", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.rejection_reasons[ALTERNATIVE].reason =
        "Best practice in this ecosystem is to avoid this pattern, so it is not used here at all.";
      return assessment;
    })), "rejection-not-force-based");
  });

  it("rejects a rejection that cites no architectural force", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.rejection_reasons[ALTERNATIVE].forces = [];
      return assessment;
    })), "rejection-not-force-based");
  });

  it("rejects candidates enumerated as boilerplate, which cannot cite an identified force", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.candidate_approaches.push({
        id: "approach-transactional-outbox",
        kind: "alternative",
        summary: "Listed for completeness because the catalog contains it, not because it answers anything here.",
        forces_addressed: ["Some force this assessment never identified."],
      });
      assessment.rejected_alternative_ids.push("approach-transactional-outbox");
      assessment.rejection_reasons["approach-transactional-outbox"] = {
        forces: ["Some force this assessment never identified."],
        reason: "Not applicable to this change, listed only to show that the catalog was consulted in full.",
      };
      return assessment;
    })), "candidate-forces-irrelevant");
  });

  it("rejects an approach that is both selected and rejected", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.rejected_alternative_ids.push(DIRECT);
      assessment.rejection_reasons[DIRECT] = {
        forces: ["Governance verdicts must be reproducible from committed bytes and Git history alone, independent of actor and wall clock."],
        reason: "Contradictory record used to prove the checker rejects a decision that selects and rejects one approach.",
      };
      return assessment;
    })), "selected-approach-also-rejected");
  });

  it("rejects a rejection reason naming an approach that was never a candidate", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.rejection_reasons["approach-never-considered"] = {
        forces: ["Governance verdicts must be reproducible from committed bytes and Git history alone, independent of actor and wall clock."],
        reason: "A reason recorded against an approach that appears nowhere in the candidate list at all.",
      };
      return assessment;
    })), "rejection-reason-unknown-approach");
  });
});

describe("R3 direct implementation is first-class", () => {
  it("rejects a direct decision that carries selected pattern IDs", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.selected_pattern_ids = ["pattern-specification"];
      return assessment;
    })), "direct-implementation-selected-pattern");
  });

  it("rejects a direct decision that claims catalog conformance", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.catalog_binding = {
        catalog_version: "1.0.0",
        pattern_id: "pattern-specification",
        required_invariant_ids: ["pattern-specification-pure-predicate"],
        conditional_invariant_ids: [],
        non_applicable_invariants: [],
      };
      return assessment;
    })), "direct-implementation-claims-catalog-conformance");
  });

  it("rejects a direct decision that records no implementation invariants", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.implementation_invariant_ids = [];
      assessment.invariant_evidence = {};
      return assessment;
    })), "implementation-invariants-absent");
  });
});

describe("R4 and R5 named-pattern selection binds the catalog", () => {
  /** Turns the seed into a named-pattern decision, so each case mutates one relation from there. */
  function namedPattern(assessment) {
    assessment.decision = "named_pattern";
    assessment.selected_approach_id = ALTERNATIVE;
    assessment.rejected_alternative_ids = [DIRECT];
    assessment.rejection_reasons = {
      [DIRECT]: {
        forces: ["The rule system has one owner in one repository and no independently variable rule provider."],
        reason: "Direct implementation was evaluated and rejected because the predicate family is genuinely independently owned here.",
      },
    };
    assessment.selected_pattern_ids = ["pattern-specification"];
    assessment.implementation_invariant_ids = [];
    assessment.catalog_binding = {
      catalog_version: "1.0.0",
      pattern_id: "pattern-specification",
      required_invariant_ids: [
        "pattern-specification-pure-predicate",
        "pattern-specification-composition-is-total",
        "pattern-specification-no-side-effects",
      ],
      conditional_invariant_ids: [],
      non_applicable_invariants: [],
    };
    assessment.invariant_evidence = {
      "pattern-specification-pure-predicate": { task_ids: ["5.4"], evidence_ids: ["purity test"] },
      "pattern-specification-composition-is-total": { task_ids: ["5.4"], evidence_ids: ["composition test"] },
      "pattern-specification-no-side-effects": { task_ids: ["5.4"], evidence_ids: ["no-io test"] },
    };
    return assessment;
  }

  it("accepts a complete named-pattern binding", () => {
    assertPasses(check(fixture(namedPattern)));
  });

  it("rejects a named pattern that never evaluates direct implementation", () => {
    assertDiagnostic(check(fixture((assessment) => {
      namedPattern(assessment);
      assessment.candidate_approaches = assessment.candidate_approaches.filter((entry) => entry.kind !== "direct_implementation");
      assessment.rejected_alternative_ids = [];
      assessment.rejection_reasons = {};
      return assessment;
    })), "candidate-direct-absent");
  });

  it("rejects a named pattern whose required invariant is unaccounted for", () => {
    assertDiagnostic(check(fixture((assessment) => {
      namedPattern(assessment);
      assessment.catalog_binding.required_invariant_ids = ["pattern-specification-pure-predicate"];
      delete assessment.invariant_evidence["pattern-specification-composition-is-total"];
      delete assessment.invariant_evidence["pattern-specification-no-side-effects"];
      return assessment;
    })), "required-invariant-unaccounted");
  });

  it("rejects a required invariant with no test evidence", () => {
    assertDiagnostic(check(fixture((assessment) => {
      namedPattern(assessment);
      assessment.invariant_evidence["pattern-specification-pure-predicate"] = { task_ids: ["5.4"], evidence_ids: [] };
      return assessment;
    })), "schema-cardinality");
  });

  it("rejects an invariant ID absent from the catalog version", () => {
    assertDiagnostic(check(fixture((assessment) => {
      namedPattern(assessment);
      assessment.catalog_binding.required_invariant_ids.push("pattern-specification-invented-invariant");
      assessment.invariant_evidence["pattern-specification-invented-invariant"] = { task_ids: ["5.4"], evidence_ids: ["invented test"] };
      return assessment;
    })), "unknown-invariant");
  });

  it("rejects an invariant belonging to a different pattern", () => {
    assertDiagnostic(check(fixture((assessment) => {
      namedPattern(assessment);
      assessment.catalog_binding.required_invariant_ids.push("pattern-state-explicit-transition-table");
      assessment.invariant_evidence["pattern-state-explicit-transition-table"] = { task_ids: ["5.4"], evidence_ids: ["transition test"] };
      return assessment;
    })), "unrelated-invariant");
  });

  it("rejects a catalog version the registry does not supply", () => {
    assertDiagnostic(check(fixture((assessment) => {
      namedPattern(assessment);
      assessment.catalog_binding.catalog_version = "9.9.9";
      return assessment;
    })), "catalog-version-mismatch");
  });

  it("rejects a required invariant declared non-applicable", () => {
    assertDiagnostic(check(fixture((assessment) => {
      namedPattern(assessment);
      assessment.catalog_binding.required_invariant_ids = [
        "pattern-specification-pure-predicate",
        "pattern-specification-composition-is-total",
      ];
      delete assessment.invariant_evidence["pattern-specification-no-side-effects"];
      assessment.catalog_binding.non_applicable_invariants = [{
        invariant_id: "pattern-specification-no-side-effects",
        forces: ["The rule system has one owner in one repository and no independently variable rule provider."],
        reason: "Claiming a required invariant does not apply, which the catalog permits only for conditional invariants.",
        acknowledged_in_signed_record: true,
      }];
      return assessment;
    })), "required-invariant-declared-non-applicable");
  });

  it("rejects a non-applicable invariant that the signed record does not acknowledge", () => {
    assertDiagnostic(check(fixture((assessment) => {
      namedPattern(assessment);
      assessment.catalog_binding.pattern_id = "pattern-strategy";
      assessment.selected_pattern_ids = ["pattern-strategy"];
      assessment.catalog_binding.required_invariant_ids = [
        "pattern-strategy-stable-contract",
        "pattern-strategy-observable-variation",
        "pattern-strategy-no-shared-mutable-state",
      ];
      assessment.catalog_binding.conditional_invariant_ids = [];
      assessment.catalog_binding.non_applicable_invariants = [{
        invariant_id: "pattern-strategy-selection-is-explicit",
        forces: ["The rule system has one owner in one repository and no independently variable rule provider."],
        reason: "Selection is fixed at construction, so the runtime-selection condition this invariant guards never arises.",
        acknowledged_in_signed_record: false,
      }];
      assessment.invariant_evidence = {
        "pattern-strategy-stable-contract": { task_ids: ["5.4"], evidence_ids: ["contract test"] },
        "pattern-strategy-observable-variation": { task_ids: ["5.4"], evidence_ids: ["variation test"] },
        "pattern-strategy-no-shared-mutable-state": { task_ids: ["5.4"], evidence_ids: ["isolation test"] },
      };
      return assessment;
    })), "non-applicable-invariant-unacknowledged");
  });
});

describe("R8 security classification", () => {
  it("rejects security_sensitive false with no justification", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.security_sensitive = false;
      assessment.applicability.triggers_matched = ["governance_core_path"];
      return assessment;
    })), "security-false-unjustified");
  });

  it("rejects security_sensitive false contradicted by a concurrency trigger", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.security_sensitive = false;
      assessment.applicability.triggers_matched = ["concurrency"];
      assessment.security_justification = Object.fromEntries(
        ["trust_boundary", "authority_provenance", "authentication_or_authorization", "audit_integrity",
          "confidentiality", "mutation_ownership", "fail_posture", "error_disclosure", "concurrency",
          "lifecycle", "resource_retention", "retry_or_redelivery", "cryptography", "privacy_transformation",
          "external_security_integration"].map((dimension) => [dimension, "This dimension was considered and does not apply here."]),
      );
      return assessment;
    })), "security-false-contradicted");
  });

  it("rejects a justification naming a dimension that does not exist", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.security_sensitive = false;
      assessment.applicability.triggers_matched = [];
      assessment.security_justification = { invented_dimension: "This dimension is not one of the fifteen." };
      return assessment;
    })), "security-dimension-unknown");
  });

  it("accepts a positive declaration without any justification", () => {
    assertPasses(check(fixture((assessment) => {
      assessment.security_sensitive = true;
      delete assessment.security_justification;
      return assessment;
    })));
  });
});

describe("R1 applicability vocabulary", () => {
  it("rejects an abbreviated assessment that matches a full trigger", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.assessment_level = "abbreviated";
      assessment.applicability.full_trigger_absence_proof =
        "This change is one bounded correction that introduces no abstraction and touches no governed path.";
      return assessment;
    })), "abbreviated-with-full-trigger");
  });

  it("rejects an abbreviated assessment with no absence proof", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.assessment_level = "abbreviated";
      assessment.applicability.triggers_matched = [];
      return assessment;
    })), "abbreviated-absence-proof-absent");
  });

  it("rejects a material capability modification assessed only in the abbreviated form", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.assessment_level = "abbreviated";
      assessment.applicability.triggers_matched = [];
      assessment.applicability.full_trigger_absence_proof =
        "Claiming no full trigger applies while still declaring a material capability modification.";
      assessment.applicability.material_capability_modification = true;
      return assessment;
    })), "material-modification-requires-full");
  });

  it("rejects a trigger outside the controlled set", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.applicability.triggers_matched = ["non_trivial"];
      return assessment;
    })), "controlled-value-unknown");
  });

  it("rejects an unknown field, because the schema is closed", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.materiality = "non-trivial";
      return assessment;
    })), "schema-unknown-field");
  });
});

describe("R10 retrospective exceptions are human-owned", () => {
  it("warns rather than passing silently when one is in effect", () => {
    const repository = fixture((assessment) => {
      assessment.retrospective_exception = {
        owner: "Fernando Homem da Costa (nandohdc)",
        reason: "Ordering for this grandfathered work predates the governance perimeter and cannot be reconstructed.",
        commits: ["0000000000000000000000000000000000000000"],
        paths: ["packages/security-audit-sdk-core/src/sdk.ts"],
        residual_risk: "The assessment was written after the implementation and did not constrain it.",
        reduced_assurance_acknowledged: true,
        eligibility: "grandfathered",
      };
      return assessment;
    });
    const result = runChecker(repository, { phase: "implementation" });
    assertWarning(result, "retrospective-exception-in-effect");
  });

  it("rejects one that does not acknowledge reduced assurance", () => {
    assertDiagnostic(check(fixture((assessment) => {
      assessment.retrospective_exception = {
        owner: "Fernando Homem da Costa (nandohdc)",
        reason: "Ordering for this grandfathered work predates the governance perimeter and cannot be reconstructed.",
        commits: ["0000000000000000000000000000000000000000"],
        paths: ["packages/security-audit-sdk-core/src/sdk.ts"],
        residual_risk: "The assessment was written after the implementation and did not constrain it.",
        reduced_assurance_acknowledged: false,
        eligibility: "grandfathered",
      };
      return assessment;
    })), "retrospective-exception-unacknowledged");
  });
});
