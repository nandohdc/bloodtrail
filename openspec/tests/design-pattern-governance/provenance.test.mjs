/**
 * R19-R21 — grandfathering classes, opt-in and withdrawal, and exact-change
 * emergency classification.
 */

import { after, describe, it } from "node:test";

import { createRepository } from "./support/disposable-repo.mjs";
import { POLICY_PATH, assertDiagnostic, assertPasses, assertWarning, runChecker } from "./support/harness.mjs";

const repositories = [];
function fixture(mutate) {
  const repository = createRepository();
  repositories.push(repository);
  if (mutate) {
    repository.mutateJson(POLICY_PATH, mutate);
    repository.commit("chore: record provenance evidence");
  }
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

const check = (repository) => runChecker(repository, { phase: "final" });

function mainlinePresentEntry(repository) {
  return {
    change: "example-grandfathered-change",
    class: "mainline_present",
    proposal_path: "openspec/changes/example-grandfathered-change/proposal.md",
    proposal_blob: repository.git(["rev-parse", "HEAD:openspec/changes/example-grandfathered-change/proposal.md"]).trim(),
    proposal_baseline_commit: repository.head(),
    bounded_paths: ["openspec/changes/example-grandfathered-change/", "packages/example/src/"],
    bounded_scope: "The example correction as recorded in its proposal, and nothing beyond the bounded paths listed above.",
  };
}

function seedGrandfatheredChange(repository) {
  repository.write("openspec/changes/example-grandfathered-change/proposal.md", "# Example\n\nAn active change present in mainline.\n");
  repository.commit("docs: seed a grandfathered change");
}

describe("R19 grandfathering has two provenance classes", () => {
  it("accepts a complete mainline-present entry", () => {
    const repository = fixture();
    seedGrandfatheredChange(repository);
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.grandfathering = [mainlinePresentEntry(repository)];
      return policy;
    });
    repository.commit("chore: record mainline-present grandfathering");
    assertPasses(check(repository));
  });

  it("rejects a mainline-present entry whose proposal is absent from mainline", () => {
    const repository = fixture();
    seedGrandfatheredChange(repository);
    const entry = mainlinePresentEntry(repository);
    repository.remove("openspec/changes/example-grandfathered-change");
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.grandfathering = [entry];
      return policy;
    });
    repository.commit("chore: record an entry whose change no longer exists");
    assertDiagnostic(check(repository), "grandfathering-not-in-mainline");
  });

  it("rejects a mainline-present entry whose recorded blob does not match", () => {
    const repository = fixture();
    seedGrandfatheredChange(repository);
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.grandfathering = [{ ...mainlinePresentEntry(repository), proposal_blob: "0".repeat(40) }];
      return policy;
    });
    repository.commit("chore: record a mismatched proposal blob");
    assertDiagnostic(check(repository), "grandfathering-proposal-blob-mismatch");
  });

  it("rejects an external-in-flight entry for a change that is present in mainline", () => {
    const repository = fixture();
    seedGrandfatheredChange(repository);
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.grandfathering = [{
        change: "example-grandfathered-change",
        class: "external_in_flight",
        remote_branch_reference: "refs/remotes/origin/feat/example",
        branch_head: repository.head(),
        proposal_baseline_commit: repository.head(),
        proposal_blob: repository.git(["rev-parse", "HEAD:openspec/changes/example-grandfathered-change/proposal.md"]).trim(),
        openspec_metadata_hash: `sha256:${"b".repeat(64)}`,
        owner_rationale: "Recorded as external while the change is in fact present in the mainline tree, which is the contradiction under test.",
        bounded_paths: ["openspec/changes/example-grandfathered-change/"],
        bounded_scope: "The example correction as recorded in its proposal, and nothing beyond the bounded paths listed above.",
      }];
      return policy;
    });
    repository.commit("chore: record a contradictory provenance class");
    assertDiagnostic(check(repository), "grandfathering-class-mismatch");
  });

  it("rejects two entries for one change", () => {
    const repository = fixture();
    seedGrandfatheredChange(repository);
    repository.mutateJson(POLICY_PATH, (policy) => {
      const entry = mainlinePresentEntry(repository);
      policy.grandfathering = [entry, { ...entry }];
      return policy;
    });
    repository.commit("chore: record duplicate grandfathering entries");
    assertDiagnostic(check(repository), "grandfathering-duplicate");
  });
});

describe("R20 opt-in and withdrawal are exact and bounded", () => {
  it("rejects an opt-in bound to a commit that is not in this history", () => {
    const repository = fixture((policy) => {
      policy.opt_ins = [{
        change: "example-grandfathered-change",
        commit: "0".repeat(40),
        owner_governance_commit: "1".repeat(40),
        scope_paths: ["packages/example/src/"],
      }];
      return policy;
    });
    assertDiagnostic(check(repository), "optin-commit-unresolvable");
  });

  it("rejects a withdrawal that matches no recorded opt-in", () => {
    const repository = fixture((policy) => {
      policy.withdrawals = [{
        change: "example-grandfathered-change",
        withdraws_opt_in_commit: "0".repeat(40),
        owner_governance_commit: "1".repeat(40),
        reason: "Withdrawing an opt-in that was never recorded, which the checker must reject rather than accept.",
      }];
      return policy;
    });
    assertDiagnostic(check(repository), "withdrawal-without-optin");
  });

  it("rejects a silent withdrawal, where the opt-in simply disappears", () => {
    const repository = fixture();
    repository.writeJson("openspec/governance/activation-record.json", {
      schema_version: "1.1",
      opted_in_changes: ["example-grandfathered-change"],
    });
    repository.commit("chore: record a prior opt-in in activation evidence");
    assertDiagnostic(check(repository), "withdrawal-silent");
  });
});

describe("R21 emergency classification is exact-change and path-bounded", () => {
  function emergencyRecord(repository, overrides = {}) {
    return {
      change: "example-emergency-change",
      proposal_baseline_commit: repository.head(),
      affected_paths: ["unclassified-territory/urgent.mjs"],
      conservative_path_class: "governed_implementation",
      disposition: "conservative_full_assessment",
      reason: "An urgent operational correction on a path the classification does not yet cover at all.",
      incident_reference: "INC-1",
      follow_up: "issue-99",
      owner_governance_commit: repository.head(),
      terminated_by: "pending",
      ...overrides,
    };
  }

  it("warns distinctly and proceeds under a conservative full assessment", () => {
    const repository = fixture();
    // The record's change must actually be active: a pending record for a change
    // that does not exist is itself a failure, which is a different case.
    repository.write("openspec/changes/example-emergency-change/proposal.md", "# Emergency\n");
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.emergency_records = [emergencyRecord(repository)];
      return policy;
    });
    repository.commit("chore: record an emergency classification");
    const result = check(repository);
    assertWarning(result, "emergency-classification-in-effect");
    assertPasses(result);
  });

  it("rejects a record missing a required field", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      const record = emergencyRecord(repository);
      delete record.incident_reference;
      policy.emergency_records = [record];
      return policy;
    });
    repository.commit("chore: record an incomplete emergency classification");
    assertDiagnostic(check(repository), "schema-missing-field");
  });

  it("rejects a record that declares a wall-clock expiry", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.emergency_records = [emergencyRecord(repository, { expires_at: "2026-12-31" })];
      return policy;
    });
    repository.commit("chore: record a clock-based emergency classification");
    assertDiagnostic(check(repository), "emergency-clock-based");
  });

  it("rejects a record that downgrades the assessment", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.emergency_records = [emergencyRecord(repository, { disposition: "abbreviated" })];
      return policy;
    });
    repository.commit("chore: record an emergency classification that downgrades assessment");
    assertDiagnostic(check(repository), "controlled-value-unknown");
  });

  it("rejects reuse of one emergency record by two changes", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.emergency_records = [emergencyRecord(repository), emergencyRecord(repository)];
      return policy;
    });
    repository.commit("chore: record a reused emergency classification");
    assertDiagnostic(check(repository), "emergency-record-reused");
  });

  it("exempts only the paths the record names, so an unrelated unclassified path still fails", () => {
    const repository = fixture();
    const base = repository.head();
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.emergency_records = [emergencyRecord(repository)];
      return policy;
    });
    repository.write("unclassified-territory/urgent.mjs", "export const urgent = 1;\n");
    repository.write("elsewhere-unclassified/other.mjs", "export const other = 1;\n");
    repository.commit("feat: an emergency path and an unrelated one");

    const result = runChecker(repository, { phase: "implementation", base });
    assertDiagnostic(result, "path-unclassified");
  });
});
