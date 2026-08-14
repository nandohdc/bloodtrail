/**
 * R11 and R19 — OpenSpec association, grandfathered scope, and schema evolution.
 *
 * These cover the controls that were wired last. Each was written after noticing
 * that the function existed and nothing called it: an exported function shaped
 * like a control, reachable from nowhere, is indistinguishable from a control
 * that always passes.
 */

import { after, describe, it } from "node:test";

import { ASSESSMENT, createRepository } from "./support/disposable-repo.mjs";
import { POLICY_PATH, assertDiagnostic, assertPasses, runChecker } from "./support/harness.mjs";

const repositories = [];
function fixture(options) {
  const repository = createRepository(options);
  repositories.push(repository);
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

const check = (repository, base) => runChecker(repository, { phase: "implementation", base });

function assertSchemaMutation(mutate) {
  const repository = fixture();
  const base = repository.head();
  repository.mutateJson("openspec/governance/schemas/assessment.schema.json", mutate);
  repository.commit("chore: weaken mandatory schema evidence");
  assertDiagnostic(check(repository, base), "schema-weakened");
}

function assertEmergencyState({ change, terminatedBy, active, expectedId }) {
  const repository = fixture();
  if (active) repository.write(`openspec/changes/${change}/proposal.md`, "# Still active\n");
  repository.mutateJson(POLICY_PATH, (policy) => {
    policy.emergency_records = [emergencyRecord(repository, change, terminatedBy)];
    return policy;
  });
  repository.commit("chore: record emergency lifecycle evidence");
  assertDiagnostic(runChecker(repository, { phase: "final" }), expectedId);
}

function emergencyRecord(repository, change, terminatedBy) {
  return {
    change,
    proposal_baseline_commit: repository.head(),
    affected_paths: ["unclassified-territory/urgent.mjs"],
    conservative_path_class: "governed_implementation",
    disposition: "conservative_full_assessment",
    reason: "An urgent correction whose recorded lifecycle state must agree with its actual repository state.",
    incident_reference: "INC-2",
    follow_up: "issue-100",
    owner_governance_commit: repository.head(),
    terminated_by: terminatedBy,
  };
}

describe("R11 governed implementation must be associated with an owning OpenSpec change", () => {
  it("rejects governed implementation changed with no OpenSpec change in the range", () => {
    const repository = fixture({ seedChange: false });
    const base = repository.head();
    repository.write("packages/example/src/feature.mjs", "export const feature = 1;\n");
    repository.commit("feat: implementation with no OpenSpec change");

    assertDiagnostic(check(repository, base), "openspec-association-absent");
  });

  it("rejects an OpenSpec change that does not own the modified path", () => {
    const repository = fixture();
    const seeded = repository.readJson(ASSESSMENT);
    repository.remove("openspec/changes/establish-design-pattern-governance");
    const base = repository.head();
    repository.write("openspec/changes/unrelated-change/proposal.md", "# Unrelated\n");
    repository.writeJson("openspec/changes/unrelated-change/assessment.json", {
      ...seeded,
      change_id: "unrelated-change",
      owned_paths: ["packages/somewhere-else/"],
    });
    repository.write("packages/example/src/feature.mjs", "export const feature = 1;\n");
    repository.commit("feat: implementation alongside an unrelated change");

    assertDiagnostic(check(repository, base), "openspec-association-unrelated");
  });

  it("accepts governed implementation a change declares it owns", () => {
    const repository = fixture();
    const base = repository.head();
    repository.write("openspec/changes/owning-change/proposal.md", "# Owning\n");
    repository.writeJson("openspec/changes/owning-change/assessment.json", {
      ...repository.readJson(ASSESSMENT),
      change_id: "owning-change",
      owned_paths: ["packages/example/src/"],
    });
    repository.write("packages/example/src/feature.mjs", "export const feature = 1;\n");
    repository.commit("feat: implementation owned by its change");

    assertPasses(check(repository, base));
  });

  it("rejects an OpenSpec change that declares no capability at all", () => {
    const repository = fixture();
    const assessment = repository.readJson(ASSESSMENT);
    repository.remove("openspec/changes/establish-design-pattern-governance");
    const base = repository.head();
    repository.write("openspec/changes/capability-less/proposal.md", "# No capability\n");
    assessment.change_id = "capability-less";
    assessment.applicability.capabilities = [];
    assessment.owned_paths = ["packages/example/src/"];
    repository.writeJson("openspec/changes/capability-less/assessment.json", assessment);
    repository.write("packages/example/src/feature.mjs", "export const feature = 1;\n");
    repository.commit("feat: implementation under a capability-less change");

    assertDiagnostic(check(repository, base), "openspec-association-unrelated");
  });
});

describe("R19 grandfathering covers only the recorded scope", () => {
  it("rejects a grandfathered change touching a path outside its bounded scope", () => {
    const repository = fixture();
    repository.write("openspec/changes/legacy-change/proposal.md", "# Legacy\n");
    repository.writeJson("openspec/changes/legacy-change/assessment.json", {
      ...repository.readJson(ASSESSMENT),
      change_id: "legacy-change",
      owned_paths: ["packages/example/src/"],
    });
    repository.commit("docs: seed a grandfathered change");
    const base = repository.head();

    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.grandfathering = [{
        change: "legacy-change",
        class: "mainline_present",
        proposal_path: "openspec/changes/legacy-change/proposal.md",
        proposal_blob: repository.git(["rev-parse", "HEAD:openspec/changes/legacy-change/proposal.md"]).trim(),
        proposal_baseline_commit: repository.head(),
        bounded_paths: ["openspec/changes/legacy-change/"],
        bounded_scope: "The legacy correction as recorded in its proposal, bounded to its own change directory only.",
      }];
      return policy;
    });
    repository.write("openspec/changes/legacy-change/tasks.md", "- [ ] 1.1 Within scope\n");
    repository.commit("chore: record grandfathering and work within scope");

    const inScope = check(repository, base);
    assertPasses(inScope);

    // Now expand beyond the record.
    const expandedBase = repository.head();
    repository.write("packages/example/src/expanded.mjs", "export const expanded = 1;\n");
    repository.commit("feat: expand the grandfathered change beyond its record");

    assertDiagnostic(check(repository, expandedBase), "grandfathered-scope-expanded");
  });
});

describe("R9 and R14 a candidate schema cannot weaken its own evidence", () => {
  for (const scenario of [
    {
      name: "rejects making a mandatory field optional, compared against the baseline",
      mutate(schema) {
        schema.fields.security_sensitive.required = false;
        return schema;
      },
    },
    {
      name: "rejects removing a mandatory field outright",
      mutate(schema) {
        delete schema.fields.rejection_reasons;
        return schema;
      },
    },
    {
      name: "rejects dropping a relational rule from the schema",
      mutate(schema) {
        schema.rules = schema.rules.filter((rule) => rule.id !== "assessment-security-false-requires-justification");
        return schema;
      },
    },
  ]) {
    it(scenario.name, () => {
      assertSchemaMutation(scenario.mutate);
    });
  }

  it("accepts adding an optional field, which weakens nothing", () => {
    const repository = fixture();
    const base = repository.head();
    repository.mutateJson("openspec/governance/schemas/assessment.schema.json", (schema) => {
      schema.fields.reviewer_note = { type: "string", required: false, max_length: 400 };
      return schema;
    });
    repository.commit("chore: add an optional field");

    assertPasses(check(repository, base));
  });
});

describe("R21 emergency records terminate on change state, not on a clock", () => {
  for (const scenario of [
    {
      name: "rejects a record left pending for a change that is neither active nor archived",
      change: "vanished-change",
      terminatedBy: "pending",
      active: false,
      expectedId: "emergency-not-terminated",
    },
    {
      name: "rejects a record marked terminated while its change is still active",
      change: "still-active",
      terminatedBy: "merged",
      active: true,
      expectedId: "emergency-terminated-early",
    },
  ]) {
    it(scenario.name, () => {
      assertEmergencyState(scenario);
    });
  }
});
