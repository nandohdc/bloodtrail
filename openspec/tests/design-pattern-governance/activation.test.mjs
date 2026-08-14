/**
 * R16-R18 — merge identity, activation, and one-time bootstrap.
 *
 * The graphs here are built with real merges, real squashes, and real rebases,
 * because what these requirements assert is precisely that those strategies are
 * distinguishable after the fact.
 */

import { after, describe, it } from "node:test";

import { createRepository } from "./support/disposable-repo.mjs";
import { POLICY_PATH, assertDiagnostic, assertNoDiagnostic, assertPasses, runChecker } from "./support/harness.mjs";

const ACTIVATION_PATH = "openspec/governance/activation-record.json";
const CHECKER_PATH = "openspec/scripts/check-design-pattern-governance.mjs";

const repositories = [];
function fixture() {
  const repository = createRepository();
  repositories.push(repository);
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

const check = (repository) => runChecker(repository, { phase: "activation" });

/**
 * Builds the governed sequence: technical commit T on a branch, the signed
 * record S after it, an identity-preserving merge M, and the activation record A
 * as M's direct child.
 */
function buildGovernedHistory(repository, options = {}) {
  repository.branch("feat/governance");
  repository.write("packages/example/src/feature.mjs", "export const feature = 1;\n");
  const technical = repository.commit("feat: the reviewed technical commit");

  repository.write("openspec/governance/records/signed.json", JSON.stringify({ binds: technical }, null, 2) + "\n");
  const signed = repository.commit("docs: the signed governance record");

  repository.checkout("main");
  if (options.strategy === "squash") {
    repository.git(["merge", "--squash", "feat/governance"]);
    repository.commit("feat: squashed governance");
  } else if (options.strategy === "rebase") {
    // main must advance first, or the rebase is a no-op that preserves every
    // hash — and the fixture would "pass" the rebase case without rebasing.
    repository.write("docs/moved-on.md", "# main advanced\n");
    repository.commit("docs: advance main so the rebase rewrites");
    repository.checkout("feat/governance");
    repository.git(["rebase", "main"]);
    repository.checkout("main");
    repository.git(["merge", "--ff-only", "feat/governance"]);
  } else {
    repository.git(["merge", "--no-ff", "feat/governance", "-m", "Merge governance"]);
  }
  const merge = repository.head();

  const record = {
    schema_version: "1.1",
    protected_reference: "refs/heads/main",
    merge_commit: merge,
    merge_tree: repository.git(["rev-parse", `${merge}^{tree}`]).trim(),
    merge_strategy: "merge_commit",
    technical_commit: options.technicalCommit ?? technical,
    signed_record_commit: signed,
    signed_record_content_object: repository.git(["rev-parse", `${technical}^{tree}`]).trim(),
    bound_blobs: {
      [CHECKER_PATH]: repository.git(["rev-parse", `${technical}:${CHECKER_PATH}`]).trim(),
      [POLICY_PATH]: repository.git(["rev-parse", `${technical}:${POLICY_PATH}`]).trim(),
    },
    required_check: {
      context: "design-pattern-governance",
      evidence_method: "github-branch-protection-api",
      evidence_digest: `sha256:${"a".repeat(64)}`,
      verified: true,
      verified_contexts: ["design-pattern-governance"],
    },
    supported_schema_versions: ["1.0", "1.1"],
    grandfathered_entries: [],
    allowlisted_activation_paths: [ACTIVATION_PATH],
  };

  return { technical, signed, merge, record };
}

function commitActivation(repository, record, extra) {
  repository.writeJson(ACTIVATION_PATH, record);
  if (extra) extra(repository);
  return repository.commit("chore: activate design-pattern governance");
}

describe("R17 the activation record is M's dedicated direct child", () => {
  it("accepts the complete governed sequence", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, record);
    assertPasses(check(repository));
  });

  it("rejects an activation commit whose parent is not the merge commit", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    repository.write("docs/interposed.md", "# Interposed\n");
    repository.commit("docs: interpose a commit between the merge and activation");
    commitActivation(repository, record);
    assertDiagnostic(check(repository), "activation-parent");
  });

  it("rejects an activation commit carrying unrelated changes", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, record, (fixtureRepository) => {
      fixtureRepository.write("packages/example/src/smuggled.mjs", "export const smuggled = 1;\n");
    });
    assertDiagnostic(check(repository), "activation-unrelated-change");
  });

  it("rejects an activation record that binds its own hash", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, { ...record, activation_commit: "0".repeat(40) });
    assertDiagnostic(check(repository), "activation-self-reference");
  });

  it("rejects a bound merge tree that is not the merge commit's tree", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, { ...record, merge_tree: "0".repeat(40) });
    assertDiagnostic(check(repository), "activation-hash-mismatch");
  });

  it("rejects an altered checker blob", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, {
      ...record,
      bound_blobs: { ...record.bound_blobs, [CHECKER_PATH]: "0".repeat(40) },
    });
    assertDiagnostic(check(repository), "checker-blob-mismatch");
  });

  it("rejects an altered policy blob", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, {
      ...record,
      bound_blobs: { ...record.bound_blobs, [POLICY_PATH]: "0".repeat(40) },
    });
    assertDiagnostic(check(repository), "policy-blob-mismatch");
  });

  it("rejects a technical commit that is not in this history", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, { ...record, technical_commit: "0".repeat(40) });
    assertDiagnostic(check(repository), "technical-commit-absent");
  });

  it("rejects a merge commit that is not in this history", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, { ...record, merge_commit: "0".repeat(40) });
    assertDiagnostic(check(repository), "activation-commit-absent");
  });
});

describe("R16 the governed merge preserves reviewed identities", () => {
  it("rejects a squash merge, which replaces the reviewed commits", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository, { strategy: "squash" });
    commitActivation(repository, record);
    assertDiagnostic(check(repository), "merge-strategy-squash");
  });

  it("rejects a rebase merge, which rewrites the reviewed commit's identity", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository, { strategy: "rebase" });
    // Declared fast_forward so the single-parent shape is legitimate and the
    // only thing left to catch is the rewritten identity itself. Asserting the
    // squash diagnostic here would have passed without ever exercising the
    // rebase control.
    commitActivation(repository, { ...record, merge_strategy: "fast_forward" });
    const result = check(repository);
    assertDiagnostic(result, "merge-strategy-rebase");
    assertNoDiagnostic(result, "merge-strategy-squash");
  });

  it("accepts a genuine fast-forward that preserves both commits", () => {
    const repository = fixture();
    repository.branch("feat/ff");
    repository.write("packages/example/src/feature.mjs", "export const feature = 1;\n");
    const technical = repository.commit("feat: the reviewed technical commit");
    repository.write("openspec/governance/records/signed.json", `${JSON.stringify({ binds: technical }, null, 2)}\n`);
    const signed = repository.commit("docs: the signed governance record");
    repository.checkout("main");
    repository.git(["merge", "--ff-only", "feat/ff"]);
    const merge = repository.head();

    commitActivation(repository, {
      schema_version: "1.1",
      protected_reference: "refs/heads/main",
      merge_commit: merge,
      merge_tree: repository.git(["rev-parse", `${merge}^{tree}`]).trim(),
      merge_strategy: "fast_forward",
      technical_commit: technical,
      signed_record_commit: signed,
      signed_record_content_object: repository.git(["rev-parse", `${technical}^{tree}`]).trim(),
      bound_blobs: {
        [CHECKER_PATH]: repository.git(["rev-parse", `${technical}:${CHECKER_PATH}`]).trim(),
        [POLICY_PATH]: repository.git(["rev-parse", `${technical}:${POLICY_PATH}`]).trim(),
      },
      required_check: {
        context: "design-pattern-governance",
        evidence_method: "github-branch-protection-api",
        evidence_digest: `sha256:${"a".repeat(64)}`,
        verified: true,
        verified_contexts: ["design-pattern-governance"],
      },
      supported_schema_versions: ["1.0", "1.1"],
      grandfathered_entries: [],
      allowlisted_activation_paths: [ACTIVATION_PATH],
    });

    assertPasses(check(repository));
  });
});

describe("R12 activation requires verified required-check enforcement", () => {
  it("rejects activation when required-status enforcement is unverified", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, {
      ...record,
      required_check: { ...record.required_check, verified: false },
    });
    assertDiagnostic(check(repository), "required-check-unverified");
  });

  it("rejects activation when the required context is absent from the verified set", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, {
      ...record,
      required_check: { ...record.required_check, verified_contexts: ["sonar"] },
    });
    assertDiagnostic(check(repository), "required-check-context-absent");
  });

  it("rejects activation when the required-check evidence has no digest", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    const withoutDigest = { ...record.required_check };
    delete withoutDigest.evidence_digest;
    commitActivation(repository, { ...record, required_check: withoutDigest });
    assertDiagnostic(check(repository), "required-check-evidence-absent");
  });
});

describe("R18 bootstrap is exact and one-time", () => {
  it("rejects bootstrap while required-check enforcement is unverified", () => {
    const repository = fixture();
    const policy = JSON.parse(repository.read(POLICY_PATH));
    policy.protected_mainline.required_check.verified = false;
    policy.protected_mainline.required_check.verified_contexts = [];
    repository.write(POLICY_PATH, JSON.stringify(policy, null, 2) + "\n");
    assertDiagnostic(runChecker(repository, { phase: "bootstrap" }), "required-check-evidence-absent");
  });

  it("rejects bootstrap re-entry once an activation record exists", () => {
    const repository = fixture();
    const { record } = buildGovernedHistory(repository);
    commitActivation(repository, record);
    assertDiagnostic(runChecker(repository, { phase: "bootstrap" }), "bootstrap-re-entry");
  });

  it("reports activation as pending when no activation record exists", () => {
    const repository = fixture();
    assertDiagnostic(runChecker(repository, { phase: "activation" }), "activation-commit-absent");
  });
});
