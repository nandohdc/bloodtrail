/**
 * R6-R7, R9, R12, R14 — the catalog, actor-neutral documentation, schema
 * compatibility, and the controls that stop governance from weakening itself.
 *
 * The dual-check case is the load-bearing one: a candidate checker edited to
 * accept anything passes its own run, and the point of the requirement is that
 * the baseline still refuses.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { after, describe, it } from "node:test";

import { createRepository, dualCheckPath } from "./support/disposable-repo.mjs";
import {
  ASSESSMENT_PATH,
  CATALOG_PATH,
  POLICY_PATH,
  REGISTRY_PATH,
  assertDiagnostic,
  assertPasses,
  runChecker,
} from "./support/harness.mjs";

const CHECKER = "openspec/scripts/check-design-pattern-governance.mjs";

const repositories = [];
function fixture() {
  const repository = createRepository();
  repositories.push(repository);
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

const check = (repository) => runChecker(repository, { phase: "final" });
const localCheck = (repository) => runChecker(repository, { phase: "final", checker: repository.path(CHECKER) });

describe("R6 and R7 the catalog is complete and honest about its limits", () => {
  it("accepts the seeded 24-entry catalog", () => {
    assertPasses(check(fixture()));
  });

  it("rejects a catalog with the wrong number of entries", () => {
    const repository = fixture();
    const text = repository.read(CATALOG_PATH);
    repository.write(CATALOG_PATH, `${text}\n### 25. Invented Entry\n\n- **Pattern ID:** \`pattern-invented\`\n`);
    assertDiagnostic(check(repository), "catalog-entry-count");
  });

  it("rejects a catalog entry missing a required guidance field", () => {
    const repository = fixture();
    const text = repository.read(CATALOG_PATH);
    repository.write(CATALOG_PATH, text.replace("**Misuse.**", "**Notes.**"));
    assertDiagnostic(check(repository), "catalog-entry-incomplete");
  });

  it("rejects a catalog that presents itself as exhaustive", () => {
    const repository = fixture();
    const text = repository.read(CATALOG_PATH);
    repository.write(CATALOG_PATH, text.replace(/This catalog is \*\*not exhaustive\*\*\./, "Only catalog entries may be used."));
    assertDiagnostic(check(repository), "catalog-claims-exhaustive");
  });

  it("rejects a registry invariant the catalog does not document", () => {
    const repository = fixture();
    repository.mutateJson(REGISTRY_PATH, (registry) => {
      registry.patterns["pattern-adapter"].invariants["pattern-adapter-undocumented"] = {
        kind: "required",
        since_version: "1.0.0",
        statement: "An invariant added to the registry without a corresponding catalog entry mention.",
      };
      return registry;
    });
    assertDiagnostic(check(repository), "catalog-registry-divergence");
  });

  it("rejects duplicate invariant IDs across patterns", () => {
    const repository = fixture();
    repository.mutateJson(REGISTRY_PATH, (registry) => {
      registry.patterns["pattern-state"].invariants["pattern-adapter-boundary-isolation"] = {
        kind: "required",
        since_version: "1.0.0",
        statement: "The same invariant identifier reused under a second pattern, which the registry prohibits.",
      };
      return registry;
    });
    assertDiagnostic(check(repository), "invariant-id-duplicate");
  });

  it("rejects a registry that permits invariant ID reuse", () => {
    const repository = fixture();
    repository.mutateJson(REGISTRY_PATH, (registry) => {
      registry.id_policy.reuse = "permitted";
      return registry;
    });
    assertDiagnostic(check(repository), "invariant-id-reuse-permitted");
  });

  it("keeps all eight Ambient Context invariants required", () => {
    const registry = fixture().readJson(REGISTRY_PATH);
    const ambient = registry.patterns["pattern-ambient-context"].invariants;
    assert.equal(Object.keys(ambient).length, 8, "Ambient Context must carry all eight invariants");
    for (const [id, invariant] of Object.entries(ambient)) {
      assert.equal(invariant.kind, "required", `${id} must be required, not conditional`);
    }
    // The hidden-authority invariant is the one the requirement singles out.
    assert.ok(ambient["pattern-ambient-context-authority-not-inferred-from-presence"],
      "Ambient Context must state that presence alone grants no authority");
  });
});

describe("R12 actor-neutral documentation is authoritative and present", () => {
  for (const document of ["docs/design-pattern-governance.md", "CONTRIBUTING.md", ".github/PULL_REQUEST_TEMPLATE.md"]) {
    it(`rejects removal of ${document}`, () => {
      const repository = fixture();
      repository.remove(document);
      assertDiagnostic(check(repository), "actor-neutral-document-absent");
    });
  }

  it("rejects a policy document that drops its actor-neutrality claim", () => {
    const repository = fixture();
    const text = repository.read("docs/design-pattern-governance.md");
    repository.write("docs/design-pattern-governance.md", text.replace(/applies identically to/g, "is suggested for"));
    assertDiagnostic(check(repository), "actor-neutral-claim-absent");
  });

  it("rejects a non-authoritative source that claims to be the policy", () => {
    const repository = fixture();
    repository.write("CLAUDE.md", "# Instructions\n\nThis file is the authoritative design-pattern governance policy.\n");
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.non_authoritative_sources = ["CLAUDE.md"];
      return policy;
    });
    assertDiagnostic(check(repository), "non-authoritative-source-claims-authority");
  });
});

describe("R14 the governance CI job is required and runs the checker", () => {
  it("rejects removal of the governance CI job", () => {
    const repository = fixture();
    const text = repository.read(".github/workflows/ci.yml");
    repository.write(".github/workflows/ci.yml", text.replace(/^ {2}design-pattern-governance:$/m, "  disabled-governance:"));
    assertDiagnostic(check(repository), "governance-ci-absent");
  });

  it("rejects a governance job that no longer runs the checker", () => {
    const repository = fixture();
    const text = repository.read(".github/workflows/ci.yml");
    repository.write(".github/workflows/ci.yml", text.replaceAll("check-design-pattern-governance.mjs", "true"));
    assertDiagnostic(check(repository), "governance-ci-does-not-run-checker");
  });

  it("rejects a governance job checked out shallowly", () => {
    const repository = fixture();
    const text = repository.read(".github/workflows/ci.yml");
    repository.write(".github/workflows/ci.yml", text.replaceAll("fetch-depth: 0", "fetch-depth: 1"));
    assertDiagnostic(check(repository), "governance-ci-shallow-checkout");
  });
});

describe("R14 a candidate checker is not the sole judge of its own weakening", () => {
  it("the baseline rejects what a self-approving candidate accepts", () => {
    const repository = fixture();

    // A committed baseline for the candidate to be judged against.
    repository.commit("chore: baseline governance state");
    const baseline = repository.head();

    // Two mutations: evidence the baseline rejects, and a candidate checker
    // edited to accept everything.
    repository.remove(POLICY_PATH);
    repository.write(CHECKER, "#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ failures: [], warnings: [] }));\nprocess.exit(0);\n");
    repository.commit("chore: weaken the candidate checker and remove the policy");

    const candidate = localCheck(repository);
    assert.equal(candidate.status, 0, "the self-approving candidate is expected to pass its own run");

    const trusted = runChecker(repository, { phase: "final" });
    assertDiagnostic(trusted, "policy-absent", "the trusted baseline must still reject the weakened evidence");

    const dual = spawnSync(process.execPath, [dualCheckPath, "--base", baseline, "--repo-root", repository.root, "--json"], {
      encoding: "utf8",
      cwd: repository.root,
    });
    assert.notEqual(dual.status, 0,
      `dual-check must fail when the baseline rejects what the candidate accepts\n${dual.stdout}${dual.stderr}`);
  });
});

/**
 * A candidate that repairs a false positive in the baseline produces the same
 * two verdicts as one that approves itself. The signed record is what separates
 * them, and these controls fix how narrow that acceptance is: it must name the
 * exact baseline and the exact diagnostic, so it cannot be written once and left
 * to cover whatever the checker stops reporting later.
 */
describe("R14 a baseline disagreement is accepted only exactly where one signed record binds it", () => {
  const RECORD = "packages/security-audit-sdk-core/verification-lifecycle.json";
  const CHANGE = "establish-design-pattern-governance";
  const REASON = "The baseline raises this against evidence the candidate repairs; accepted for this exact baseline only.";

  /**
   * A fixture whose baseline rejects evidence the candidate checker accepts.
   *
   * The rejected evidence is a malformed assessment rather than a missing policy,
   * because the policy is where the signed-record source and the acceptance
   * schema are named: removing it would make the lookup fail for that reason
   * instead of the one under test, and the real case always has a readable policy.
   */
  function repairedFalsePositive() {
    const repository = fixture();
    repository.commit("chore: baseline governance state");
    const baseline = repository.head();
    repository.write(ASSESSMENT_PATH, "{ not json");
    // Stands in for a candidate that no longer raises what the baseline raises.
    repository.write(CHECKER, "#!/usr/bin/env node\nprocess.stdout.write(JSON.stringify({ failures: [], warnings: [] }));\nprocess.exit(0);\n");
    const technical = repository.commit("feat: the reviewed technical commit");
    return { repository, baseline, technical };
  }

  function acceptance(baseline, technical, overrides = {}) {
    return {
      schemaVersion: "1.0",
      phase: "final",
      baseline,
      technicalCommit: technical,
      diagnostics: [{ id: "assessment-invalid-json", path: ASSESSMENT_PATH }],
      reason: REASON,
      ...overrides,
    };
  }

  /** Writes the record as the direct child of the technical commit, which is what binds it. */
  function signRecord(repository, records) {
    repository.writeJson(RECORD, { governanceRecords: records });
    return repository.commit("docs: the signed governance record");
  }

  function record(technical, entry, overrides = {}) {
    return {
      change: CHANGE,
      signed: true,
      reviewedCommit: technical,
      ...(entry === null ? {} : { baselineDisagreementAcceptance: entry }),
      ...overrides,
    };
  }

  function dualCheck(repository, baseline) {
    return spawnSync(process.execPath, [dualCheckPath, "--base", baseline, "--repo-root", repository.root, "--json"], {
      encoding: "utf8",
      cwd: repository.root,
    });
  }

  /** Runs the whole arrangement and returns the dual-check result. */
  function run(records, mutate) {
    const { repository, baseline, technical } = repairedFalsePositive();
    signRecord(repository, records(baseline, technical));
    if (mutate) mutate(repository);
    return { dual: dualCheck(repository, baseline), repository };
  }

  const rejects = (label, records, mutate) => it(label, () => {
    const { dual } = run(records, mutate);
    assert.notEqual(dual.status, 0, `${label}\n${dual.stdout}${dual.stderr}`);
  });

  it("accepts one exactly-bound acceptance on the canonical current record", () => {
    const { dual } = run((baseline, technical) => [record(technical, acceptance(baseline, technical))]);
    assert.equal(dual.status, 0, `an exactly-bound acceptance must clear the gate\n${dual.stdout}${dual.stderr}`);
    assert.match(dual.stdout, /"accepted": true/, "the report must state the acceptance explicitly");
  });

  rejects("rejects no acceptance at all",
    (_baseline, technical) => [record(technical, null)]);

  rejects("rejects an acceptance naming a different baseline",
    (_baseline, technical) => [record(technical, acceptance("0".repeat(40), technical))]);

  rejects("rejects an acceptance naming a different phase",
    (baseline, technical) => [record(technical, acceptance(baseline, technical, { phase: "activation" }))]);

  rejects("rejects an acceptance naming a different diagnostic id",
    (baseline, technical) => [record(technical, acceptance(baseline, technical, {
      diagnostics: [{ id: "policy-absent", path: ASSESSMENT_PATH }],
    }))]);

  rejects("rejects an acceptance naming the right id at the wrong path",
    (baseline, technical) => [record(technical, acceptance(baseline, technical, {
      diagnostics: [{ id: "assessment-invalid-json", path: "openspec/governance/design-pattern-policy.json" }],
    }))]);

  rejects("rejects an acceptance covering more diagnostics than were raised",
    (baseline, technical) => [record(technical, acceptance(baseline, technical, {
      diagnostics: [
        { id: "assessment-invalid-json", path: ASSESSMENT_PATH },
        { id: "policy-absent", path: "openspec/governance/design-pattern-policy.json" },
      ],
    }))]);

  rejects("rejects acceptances aggregated across two records",
    (baseline, technical) => [
      record(technical, acceptance(baseline, technical, { diagnostics: [{ id: "policy-absent", path: ASSESSMENT_PATH }] })),
      record(technical, acceptance(baseline, technical), { change: "right-size-change-governance" }),
    ]);

  rejects("rejects two current signed records for one change",
    (baseline, technical) => [
      record(technical, acceptance(baseline, technical)),
      record(technical, null),
    ]);

  rejects("rejects an acceptance on an unsigned record",
    (baseline, technical) => [record(technical, acceptance(baseline, technical), { signed: false })]);

  rejects("rejects an acceptance carrying an undeclared field",
    (baseline, technical) => [record(technical, { ...acceptance(baseline, technical), scope: "everything" })]);

  rejects("rejects an acceptance on an unsupported schema version",
    (baseline, technical) => [record(technical, acceptance(baseline, technical, { schemaVersion: "2.0" }))]);

  rejects("rejects an acceptance whose reason is too short to be a review",
    (baseline, technical) => [record(technical, acceptance(baseline, technical, { reason: "fine" }))]);

  rejects("rejects an acceptance naming a technical commit the record did not review",
    (baseline, technical) => [record(technical, acceptance(baseline, "0".repeat(40)))]);

  it("rejects a record that is stale against its own technical commit", () => {
    const { repository, baseline, technical } = repairedFalsePositive();
    // A commit between the technical commit and the record means the record was
    // not signed as that commit's direct child, so something unreviewed landed
    // in between and the binding is stale.
    repository.write("docs/interposed.md", "# Interposed\n");
    repository.commit("docs: interpose a commit before the record is signed");
    signRecord(repository, [record(technical, acceptance(baseline, technical))]);

    const dual = dualCheck(repository, baseline);
    assert.notEqual(dual.status, 0, `a record that is not the technical commit's direct child is stale\n${dual.stdout}`);
    assert.match(dual.stderr + dual.stdout, /not a direct child/, "the rejection must name the broken commit binding\n" + dual.stdout + dual.stderr);
  });

  rejects("rejects an acceptance when the policy naming the schema is unreadable",
    (baseline, technical) => [record(technical, acceptance(baseline, technical))],
    (repository) => {
      repository.remove(POLICY_PATH);
      repository.commit("chore: remove the policy");
    });

  rejects("rejects an acceptance when the schema it is judged against is missing",
    (baseline, technical) => [record(technical, acceptance(baseline, technical))],
    (repository) => {
      repository.remove("openspec/governance/schemas/baseline-disagreement.schema.json");
      repository.commit("chore: remove the acceptance schema");
    });

  rejects("rejects an acceptance judged against an opened schema",
    (baseline, technical) => [record(technical, acceptance(baseline, technical))],
    (repository) => {
      repository.mutateJson("openspec/governance/schemas/baseline-disagreement.schema.json", (schema) => {
        schema.closed = false;
        return schema;
      });
      repository.commit("chore: open the acceptance schema");
    });
});

/**
 * R14's widening scenario, enforced mechanically: an exempt or benign path
 * class broadened without an exactly-bound signed-record acknowledgement fails
 * with a named diagnostic, and only an exact acknowledgement clears it.
 */
describe("R14 path-class widening is rejected without an exactly-bound acknowledgement", () => {
  const RECORD = "packages/security-audit-sdk-core/verification-lifecycle.json";
  const CHANGE = "establish-design-pattern-governance";
  const REASON = "The reviewer records this exact widening for this exact baseline and nothing else.";

  function widenedRepository(mutate, acknowledge = null) {
    const repository = fixture();
    repository.commit("chore: baseline governance state");
    const baseline = repository.head();
    mutate(repository);
    const technical = repository.commit("feat: widen a benign path class");
    if (acknowledge) acknowledge(repository, baseline, technical);
    return { repository, baseline, technical };
  }

  const moveTemplateToDocumentationOnly = (repository) => {
    repository.mutateJson(POLICY_PATH, (policy) => {
      const core = policy.path_classes.find((entry) => entry.class === "governance_core");
      const docs = policy.path_classes.find((entry) => entry.class === "documentation_only");
      core.patterns = core.patterns.filter((pattern) => pattern !== ".github/PULL_REQUEST_TEMPLATE.md");
      docs.patterns = [...docs.patterns, ".github/PULL_REQUEST_TEMPLATE.md"];
      return policy;
    });
  };

  const addUnmatchedBenignPattern = (repository) => {
    repository.mutateJson(POLICY_PATH, (policy) => {
      const docs = policy.path_classes.find((entry) => entry.class === "documentation_only");
      docs.patterns = [...docs.patterns, "NEVER-MATCHED.txt"];
      return policy;
    });
  };

  const narrowDocumentationOnly = (repository) => {
    repository.mutateJson(POLICY_PATH, (policy) => {
      const core = policy.path_classes.find((entry) => entry.class === "governance_core");
      const docs = policy.path_classes.find((entry) => entry.class === "documentation_only");
      docs.patterns = docs.patterns.filter((pattern) => pattern !== "README.md");
      core.patterns = [...core.patterns, "README.md"];
      return policy;
    });
  };

  const strengthenGovernanceCore = (repository) => {
    repository.mutateJson(POLICY_PATH, (policy) => {
      const core = policy.path_classes.find((entry) => entry.class === "governance_core");
      core.patterns = [...core.patterns, "NEW-CORE.txt"];
      return policy;
    });
  };

  function acknowledgement(baseline, technical, paths) {
    return { acknowledged: true, baselineCommit: baseline, reason: REASON, paths };
  }

  function signRecord(repository, baseline, technical, build) {
    repository.writeJson(RECORD, {
      governanceRecords: [{
        change: CHANGE,
        signed: true,
        reviewedCommit: technical,
        pathClassWideningAcknowledgement: build(baseline, technical),
      }],
    });
    repository.commit("docs: the signed governance record");
  }

  it("rejects an unacknowledged path reclassification into documentation_only", () => {
    const { repository, baseline } = widenedRepository(moveTemplateToDocumentationOnly);
    assertDiagnostic(runChecker(repository, { phase: "final", base: baseline }),
      "path-class-widening-unacknowledged");
  });

  it("rejects an unacknowledged benign pattern growth that matches nothing tracked yet", () => {
    const { repository, baseline } = widenedRepository(addUnmatchedBenignPattern);
    assertDiagnostic(runChecker(repository, { phase: "final", base: baseline }),
      "path-class-widening-unacknowledged");
  });

  it("rejects the widening through the dual check too", () => {
    // The widening commits sit on a branch so the checker's own merge-base
    // resolution (protected mainline against HEAD) sees the range; with
    // main == HEAD the range would be empty and the rule could not fire.
    const repository = fixture();
    repository.commit("chore: baseline governance state");
    const baseline = repository.head();
    repository.branch("feat/widen");
    moveTemplateToDocumentationOnly(repository);
    repository.commit("feat: widen a benign path class");
    const dual = spawnSync(process.execPath, [dualCheckPath, "--base", baseline, "--repo-root", repository.root, "--json"], {
      encoding: "utf8",
      cwd: repository.root,
    });
    assert.notEqual(dual.status, 0,
      `the dual check must reject an unacknowledged widening\n${dual.stdout}${dual.stderr}`);
  });

  it("accepts an exactly-bound acknowledgement", () => {
    const { repository, baseline, technical } = widenedRepository(
      moveTemplateToDocumentationOnly,
      (repository, baseline, technical) => signRecord(repository, baseline, technical,
        (baseline) => acknowledgement(baseline, technical, [".github/PULL_REQUEST_TEMPLATE.md"])),
    );
    assertPasses(runChecker(repository, { phase: "final", base: baseline }),
      "an exact acknowledgement must clear the widening rule");
  });

  it("rejects an acknowledgement naming a different baseline", () => {
    const { repository, baseline, technical } = widenedRepository(
      moveTemplateToDocumentationOnly,
      (repository, baseline, technical) => signRecord(repository, baseline, technical,
        () => acknowledgement("0".repeat(40), technical, [".github/PULL_REQUEST_TEMPLATE.md"])),
    );
    assertDiagnostic(runChecker(repository, { phase: "final", base: baseline }),
      "path-class-widening-acknowledgement-stale");
  });

  it("rejects an acknowledgement covering a different path set", () => {
    const { repository, baseline, technical } = widenedRepository(
      moveTemplateToDocumentationOnly,
      (repository, baseline, technical) => signRecord(repository, baseline, technical,
        (baseline) => acknowledgement(baseline, technical, ["docs/other.md"])),
    );
    assertDiagnostic(runChecker(repository, { phase: "final", base: baseline }),
      "path-class-widening-acknowledgement-incomplete");
  });

  it("rejects an acknowledgement whose path set is a superset", () => {
    const { repository, baseline, technical } = widenedRepository(
      moveTemplateToDocumentationOnly,
      (repository, baseline, technical) => signRecord(repository, baseline, technical,
        (baseline) => acknowledgement(baseline, technical, [".github/PULL_REQUEST_TEMPLATE.md", "docs/other.md"])),
    );
    assertDiagnostic(runChecker(repository, { phase: "final", base: baseline }),
      "path-class-widening-acknowledgement-incomplete");
  });

  it("rejects a recorded denial", () => {
    const { repository, baseline, technical } = widenedRepository(
      moveTemplateToDocumentationOnly,
      (repository, baseline, technical) => signRecord(repository, baseline, technical,
        (baseline) => ({ ...acknowledgement(baseline, technical, [".github/PULL_REQUEST_TEMPLATE.md"]), acknowledged: false })),
    );
    assertDiagnostic(runChecker(repository, { phase: "final", base: baseline }),
      "path-class-widening-acknowledgement-invalid");
  });

  it("rejects two records each claiming the acknowledgement", () => {
    const { repository, baseline, technical } = widenedRepository(moveTemplateToDocumentationOnly);
    repository.writeJson(RECORD, {
      governanceRecords: [
        { change: CHANGE, signed: true, reviewedCommit: technical, pathClassWideningAcknowledgement: acknowledgement(baseline, technical, [".github/PULL_REQUEST_TEMPLATE.md"]) },
        { change: "right-size-change-governance", signed: true, reviewedCommit: technical, pathClassWideningAcknowledgement: acknowledgement(baseline, technical, [".github/PULL_REQUEST_TEMPLATE.md"]) },
      ],
    });
    repository.commit("docs: two signed governance records");
    assertDiagnostic(runChecker(repository, { phase: "final", base: baseline }),
      "path-class-widening-acknowledgement-ambiguous");
  });

  it("does not fire on a narrowing", () => {
    const { repository, baseline } = widenedRepository(narrowDocumentationOnly);
    assertPasses(runChecker(repository, { phase: "final", base: baseline }),
      "narrowing a benign class is a strengthening and must not fire the rule");
  });

  it("does not fire on a strengthening pattern addition", () => {
    const { repository, baseline } = widenedRepository(strengthenGovernanceCore);
    assertPasses(runChecker(repository, { phase: "final", base: baseline }),
      "adding a governance_core pattern is a strengthening and must not fire the rule");
  });

  it("does not fire on a path introduced together with its benign classification", () => {
    // The sanctioned flow: a new path arriving with its documentation_only
    // classification had no prior scrutiny to weaken, so it is not a widening.
    const repository = fixture();
    repository.commit("chore: baseline governance state");
    const baseline = repository.head();
    repository.write("release-metadata.txt", "0.1.0\n");
    repository.mutateJson(POLICY_PATH, (policy) => {
      const docs = policy.path_classes.find((entry) => entry.class === "documentation_only");
      docs.patterns = [...docs.patterns, "release-metadata.txt"];
      return policy;
    });
    repository.commit("chore: add a classified path");
    assertPasses(runChecker(repository, { phase: "final", base: baseline }),
      "a new path with its own benign classification must not fire the widening rule");
  });
});
