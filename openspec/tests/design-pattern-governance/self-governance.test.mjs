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

describe("R9 schema compatibility", () => {
  it("rejects evidence on a version newer than the checker supports", () => {
    const repository = fixture();
    repository.mutateJson("openspec/changes/establish-design-pattern-governance/assessment.json", (assessment) => {
      assessment.schema_version = "9.0";
      return assessment;
    });
    assertDiagnostic(runChecker(repository, { phase: "assessment" }), "unknown-new-version");
  });

  it("rejects evidence on a version older than the supported range", () => {
    const repository = fixture();
    repository.mutateJson("openspec/governance/schemas/assessment.schema.json", (schema) => {
      schema.supported_versions = ["1.1"];
      return schema;
    });
    repository.mutateJson("openspec/changes/establish-design-pattern-governance/assessment.json", (assessment) => {
      assessment.schema_version = "1.0";
      return assessment;
    });
    assertDiagnostic(runChecker(repository, { phase: "assessment" }), "unsupported-old-version");
  });

  it("rejects a schema that stops being closed", () => {
    const repository = fixture();
    repository.mutateJson("openspec/governance/schemas/assessment.schema.json", (schema) => {
      schema.closed = false;
      return schema;
    });
    assertDiagnostic(runChecker(repository, { phase: "assessment" }), "schema-weakened");
  });

  it("rejects a schema declaring a rule the checker does not implement", () => {
    const repository = fixture();
    repository.mutateJson("openspec/governance/schemas/assessment.schema.json", (schema) => {
      schema.rules.push({ id: "assessment-invented-rule", requirement: "R2" });
      return schema;
    });
    assertDiagnostic(runChecker(repository, { phase: "assessment" }), "rule-unimplemented");
  });

  it("rejects a schema that drops a rule the checker implements", () => {
    const repository = fixture();
    repository.mutateJson("openspec/governance/schemas/assessment.schema.json", (schema) => {
      schema.rules = schema.rules.filter((rule) => rule.id !== "assessment-direct-has-no-selected-patterns");
      return schema;
    });
    assertDiagnostic(runChecker(repository, { phase: "assessment" }), "rule-undeclared");
  });
});

describe("determinism", () => {
  it("produces byte-identical output across repeated runs", () => {
    const repository = fixture();
    const first = runChecker(repository, { phase: "final" });
    const second = runChecker(repository, { phase: "final" });
    assert.equal(first.stdout, second.stdout, "identical inputs must produce identical output");
    assert.equal(first.status, second.status);
  });

  it("sorts diagnostics stably regardless of the order the failures arise in", () => {
    const repository = fixture();
    repository.remove(POLICY_PATH);
    const first = runChecker(repository, { phase: "final" });
    const second = runChecker(repository, { phase: "final" });
    assert.deepEqual(first.ids, second.ids);
    assert.deepEqual([...first.ids].sort(), first.ids, "diagnostics must be emitted in sorted order");
  });
});
