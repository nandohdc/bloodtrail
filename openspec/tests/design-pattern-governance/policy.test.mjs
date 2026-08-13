/**
 * R13 — missing or weakened governance evidence fails closed.
 *
 * Each case asserts its own diagnostic identifier. Collapsing them into "the
 * checker failed" would hide the case this requirement is really about: a policy
 * that is absent or unreadable being taken for a policy with nothing to say.
 */

import { after, describe, it } from "node:test";

import { createRepository } from "./support/disposable-repo.mjs";
import { POLICY_PATH, assertDiagnostic, assertPasses, runChecker } from "./support/harness.mjs";

const repositories = [];
function fixture() {
  const repository = createRepository();
  repositories.push(repository);
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

describe("R13 fail-closed policy loading", () => {
  it("passes on the seeded policy, so every mutation below is the only difference", () => {
    assertPasses(runChecker(fixture(), { phase: "assessment" }));
  });

  it("fails with policy-absent when the policy file is removed", () => {
    const repository = fixture();
    repository.remove(POLICY_PATH);
    assertDiagnostic(runChecker(repository), "policy-absent");
  });

  it("fails with policy-empty when the policy file has no bytes", () => {
    const repository = fixture();
    repository.write(POLICY_PATH, "");
    assertDiagnostic(runChecker(repository), "policy-empty");
  });

  it("fails with policy-empty when the policy file is only whitespace", () => {
    const repository = fixture();
    repository.write(POLICY_PATH, "   \n\n  \n");
    assertDiagnostic(runChecker(repository), "policy-empty");
  });

  it("fails with policy-truncated when the policy file stops mid-record", () => {
    const repository = fixture();
    const text = repository.read(POLICY_PATH);
    repository.write(POLICY_PATH, text.slice(0, Math.floor(text.length / 2)));
    assertDiagnostic(runChecker(repository), "policy-truncated");
  });

  it("fails with policy-invalid-json on syntactically invalid JSON", () => {
    const repository = fixture();
    repository.write(POLICY_PATH, '{ "schema": "bloodtrail.design-pattern-governance.policy",, }\n');
    assertDiagnostic(runChecker(repository), "policy-invalid-json");
  });

  it("fails with schema-version-absent when the policy declares no version", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      delete policy.policy_schema_version;
      return policy;
    });
    assertDiagnostic(runChecker(repository), "schema-version-absent");
  });

  it("fails with checker-policy-incompatible when the checker does not support the policy version", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.checker.supported_policy_schema_versions = ["0.9"];
      return policy;
    });
    assertDiagnostic(runChecker(repository), "checker-policy-incompatible");
  });

  it("fails with path-classification-absent when governed classifications are removed", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.path_classes = [];
      return policy;
    });
    assertDiagnostic(runChecker(repository), "path-classification-absent");
  });

  it("fails with protected-root-absent when a protected history root is removed", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.protected_history_roots = [];
      return policy;
    });
    assertDiagnostic(runChecker(repository), "protected-root-absent");
  });

  it("fails with protected-mainline-evidence-absent when required-check evidence is removed", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      delete policy.protected_mainline.required_check;
      return policy;
    });
    assertDiagnostic(runChecker(repository), "protected-mainline-evidence-absent");
  });

  it("fails with policy-weakened when a branch name is redefined as protection evidence", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.protected_mainline.branch_name_is_not_protection_evidence = false;
      return policy;
    });
    assertDiagnostic(runChecker(repository), "policy-weakened");
  });

  it("fails with policy-weakened when invariant ID reuse is permitted", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.schema_compatibility.id_reuse = "permitted";
      return policy;
    });
    assertDiagnostic(runChecker(repository), "policy-weakened");
  });

  it("fails with controlled-vocabulary-count when a family loses a value without updating the counts", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.controlled_values.lifecycle_state = policy.controlled_values.lifecycle_state.slice(1);
      return policy;
    });
    assertDiagnostic(runChecker(repository), "controlled-vocabulary-count");
  });

  it("fails with controlled-vocabulary-incomplete when a whole family is removed", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      delete policy.controlled_values.merge_strategy;
      return policy;
    });
    assertDiagnostic(runChecker(repository), "controlled-vocabulary-incomplete");
  });

  it("never reports success when the policy is unreadable", () => {
    const repository = fixture();
    repository.remove(POLICY_PATH);
    const result = runChecker(repository);
    // The point of the requirement, stated as an assertion: absence is not a
    // clean run, is not "nothing applicable", and is not a skip.
    assertDiagnostic(result, "policy-absent");
  });
});
