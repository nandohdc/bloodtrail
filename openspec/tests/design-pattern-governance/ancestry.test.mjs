/**
 * R10 — assessment ordering proven by Git ancestry.
 *
 * These fixtures build real commit graphs rather than declaring relationships in
 * JSON. That is the requirement: the ordering evidence has to be something the
 * author of the change cannot simply assert about themselves.
 */

import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import { ASSESSMENT, DisposableRepository, createRepository } from "./support/disposable-repo.mjs";
import { assertDiagnostic, assertPasses, runChecker } from "./support/harness.mjs";

const repositories = [];
function fixture() {
  const repository = createRepository();
  repositories.push(repository);
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

const check = (repository) => runChecker(repository, { phase: "assessment" });

/** A governed implementation path in the fixture's own classification. */
const IMPLEMENTATION = "packages/example/src/feature.mjs";

function writeImplementation(repository, body) {
  repository.write(IMPLEMENTATION, body);
}

function setOrdering(repository, ordering) {
  repository.mutateJson(ASSESSMENT, (assessment) => {
    assessment.ordering = { ...assessment.ordering, ...ordering };
    return assessment;
  });
}

function assertOrderingFailure(expectedId, scenario) {
  const repository = fixture();
  const baseline = repository.head();
  const ordering = arrangeInvalidOrdering(repository, baseline, scenario);
  setOrdering(repository, { proposal_baseline_commit: baseline, ...ordering });
  repository.commit("docs: bind ordering evidence");
  assertDiagnostic(check(repository), expectedId);
}

function arrangeInvalidOrdering(repository, baseline, scenario) {
  writeImplementation(repository, "export function feature() { return 1; }\n");
  if (scenario === "assessment-after-implementation") {
    const implementation = repository.commit("feat: implement before assessing");
    setOrdering(repository, { proposal_baseline_commit: baseline });
    return {
      assessment_commit: repository.commit("docs: record the assessment late"),
      earliest_governed_implementation_commit: implementation,
    };
  }

  setOrdering(repository, { proposal_baseline_commit: baseline });
  const assessmentCommit = repository.commit(
    scenario === "shared-commit" ? "feat: assess and implement together" : "docs: assessment carrying implementation",
  );
  if (scenario === "shared-commit") {
    return {
      assessment_commit: assessmentCommit,
      earliest_governed_implementation_commit: assessmentCommit,
    };
  }
  return { assessment_commit: assessmentCommit };
}

describe("R10 assessment ordering", () => {
  it("accepts an assessment commit that precedes the earliest governed implementation commit", () => {
    const repository = fixture();
    const baseline = repository.head();

    setOrdering(repository, { proposal_baseline_commit: baseline });
    const assessmentCommit = repository.commit("docs: record the assessment");

    writeImplementation(repository, "export function feature() { return 1; }\n");
    const implementation = repository.commit("feat: implement the feature");

    setOrdering(repository, {
      proposal_baseline_commit: baseline,
      assessment_commit: assessmentCommit,
      earliest_governed_implementation_commit: implementation,
      final_technical_commit: repository.commit("chore: finalise"),
    });
    repository.commit("docs: bind ordering evidence");

    assertPasses(check(repository));
  });

  for (const scenario of [
    {
      name: "rejects an assessment commit that follows the implementation",
      diagnostic: "assessment-follows-implementation",
      arrangement: "assessment-after-implementation",
    },
    {
      name: "rejects an assessment and implementation introduced by one commit",
      diagnostic: "assessment-shares-implementation-commit",
      arrangement: "shared-commit",
    },
    {
      name: "rejects an assessment commit that also changes a governed implementation path",
      diagnostic: "assessment-shares-implementation-commit",
      arrangement: "implementation-in-assessment",
    },
  ]) {
    it(scenario.name, () => {
      assertOrderingFailure(scenario.diagnostic, scenario.arrangement);
    });
  }

  it("rejects an assessment commit that is not an ancestor of the final technical commit", () => {
    const repository = fixture();
    const baseline = repository.head();

    repository.branch("sidetrack");
    repository.write("docs/sidetrack.md", "# Unrelated\n");
    const unrelated = repository.commit("docs: unrelated side branch");

    repository.checkout("main");
    const technical = repository.commit("chore: continue on main");

    setOrdering(repository, {
      proposal_baseline_commit: baseline,
      assessment_commit: unrelated,
      final_technical_commit: technical,
    });
    repository.commit("docs: bind unrelated assessment");

    assertDiagnostic(check(repository), "assessment-unrelated");
  });

  it("rejects a proposal baseline that is not a commit in this history", () => {
    const repository = fixture();
    setOrdering(repository, { proposal_baseline_commit: "0".repeat(40) });
    repository.commit("docs: bind an unresolvable baseline");

    assertDiagnostic(check(repository), "proposal-baseline-unresolvable");
  });

  it("rejects an earliest-implementation commit that is not in this history", () => {
    const repository = fixture();
    const baseline = repository.head();
    const assessmentCommit = repository.commit("docs: record the assessment");
    setOrdering(repository, {
      proposal_baseline_commit: baseline,
      assessment_commit: assessmentCommit,
      earliest_governed_implementation_commit: "1".repeat(40),
    });
    repository.commit("docs: bind an unresolvable implementation commit");

    assertDiagnostic(check(repository), "implementation-ancestry-unavailable");
  });

  it("fails closed with activation-history-unavailable on a shallow clone", () => {
    const repository = fixture();
    const baseline = repository.head();
    const assessmentCommit = repository.commit("docs: record the assessment");
    setOrdering(repository, { proposal_baseline_commit: baseline, assessment_commit: assessmentCommit });
    repository.commit("docs: bind ordering evidence");

    // Depth 1 makes the assessment's ancestry unprovable. An ordering that
    // cannot be proven must deny; treating "I could not see it" as "it was fine"
    // is the fail-open this requirement exists to close.
    const clone = shallowCloneOf(repository);
    repositories.push(clone);
    assertDiagnostic(runChecker(clone, { phase: "assessment" }), "activation-history-unavailable");
  });
});

function shallowCloneOf(source) {
  const root = mkdtempSync(join(tmpdir(), "bloodtrail-governance-shallow-"));
  rmSync(root, { recursive: true, force: true });
  execFileSync("git", ["clone", "--depth", "1", `file://${source.root}`, root], { stdio: ["ignore", "pipe", "pipe"] });
  return new DisposableRepository(root);
}
