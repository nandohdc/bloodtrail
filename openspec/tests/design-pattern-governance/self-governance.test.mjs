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
