/**
 * R10 — assessment ordering derived from Git history (#943, #974).
 *
 * A change's assessment commit is the first commit that adds its
 * `assessment.json`. The checker finds it from history, never from the
 * assessment's own `ordering` record, and requires it to strictly precede every
 * governed commit in the reviewed range that the change owns. Recorded ordering
 * commits stay optional and are checked against history.
 *
 * Every test here builds a real commit graph in a disposable repository, runs the
 * checker as a process, and asserts diagnostic identifiers and the exit status
 * only. The paths each change owns (`packages/<area>/`) are owned by no other
 * change in the fixture, so the seeded change's own assessment, which precedes
 * everything, never stands in for the one under test.
 */

import { mkdirSync } from "node:fs";
import { after, describe, it } from "node:test";

import { ASSESSMENT, createRepository } from "./support/disposable-repo.mjs";
import { POLICY_PATH, assertDiagnostic, assertNoDiagnostic, assertPasses, runChecker } from "./support/harness.mjs";

const FOLLOWS = "assessment-follows-implementation";
const SHARES = "assessment-shares-implementation-commit";
const ANCHOR_MISSING = "assessment-anchor-missing";
const AMENDED = "assessment-amended-after-implementation";
const INCONSISTENT = "assessment-ordering-record-inconsistent";
const CONTRACT_REUSE_PATTERN = "openspec/changes/*/contract-reuse.json";

const repositories = [];
function fixture() {
  const repository = createRepository();
  repositories.push(repository);
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

const assessmentOf = (change) => `openspec/changes/${change}/assessment.json`;
const sourceIn = (area) => `packages/${area}/src/feature.mjs`;
const ownerOf = (area) => [`packages/${area}/`];

const finalPhase = (repository, base) => runChecker(repository, { phase: "final", base });
const assessmentPhase = (repository) => runChecker(repository, { phase: "assessment" });

/**
 * Writes an assessment for `change`, copied from the seeded one so it is valid,
 * owning `ownedPaths`. Nothing is recorded beyond the proposal baseline.
 */
function writeAssessment(repository, change, ownedPaths, edit = () => {}) {
  const assessment = repository.readJson(ASSESSMENT);
  assessment.change_id = change;
  assessment.owned_paths = ownedPaths;
  assessment.ordering = { proposal_baseline_commit: repository.baseline };
  edit(assessment);
  repository.writeJson(assessmentOf(change), assessment);
}

function assess(repository, change, area, edit) {
  writeAssessment(repository, change, ownerOf(area), edit);
  return repository.commit(`docs: assess ${change}`);
}

function implement(repository, area, value) {
  repository.write(sourceIn(area), `export const value = ${value};\n`);
  return repository.commit(`feat: implement ${area} (${value})`);
}

/** Commits ordering fields beside the proposal baseline. An `ordering`-only edit. */
function recordOrdering(repository, change, fields) {
  repository.mutateJson(assessmentOf(change), (assessment) => {
    assessment.ordering = { proposal_baseline_commit: assessment.ordering.proposal_baseline_commit, ...fields };
    return assessment;
  });
  return repository.commit(`docs: record ${change} ordering`);
}

function bothPhasesPass(repository, base, context) {
  assertPasses(assessmentPhase(repository), `${context}, assessment phase`);
  assertPasses(finalPhase(repository, base), `${context}, final phase`);
}

describe("R10: implementation before the assessment fails however it is recorded (history A)", () => {
  /** C0, then C1 implements, C2 adds the assessment, C3 implements again. */
  function historyA(repository) {
    const c0 = repository.head();
    const c1 = implement(repository, "alpha", 1);
    const c2 = assess(repository, "alpha-change", "alpha");
    const c3 = implement(repository, "alpha", 3);
    return { c0, c1, c2, c3 };
  }

  const variants = [
    { name: "nothing recorded", record: null },
    { name: "assessment C2, earliest C1 (the truth)",
      record: ({ c1, c2 }) => ({ assessment_commit: c2, earliest_governed_implementation_commit: c1 }) },
    { name: "assessment C2, earliest C3 (a later commit)",
      record: ({ c2, c3 }) => ({ assessment_commit: c2, earliest_governed_implementation_commit: c3 }) },
    { name: "assessment C2, earliest omitted", record: ({ c2 }) => ({ assessment_commit: c2 }) },
    { name: "assessment C0 (adds no assessment), earliest C1",
      record: ({ c0, c1 }) => ({ assessment_commit: c0, earliest_governed_implementation_commit: c1 }) },
  ];

  for (const variant of variants) {
    it(`rejects history A with ${variant.name}`, () => {
      const repository = fixture();
      const commits = historyA(repository);
      if (variant.record) recordOrdering(repository, "alpha-change", variant.record(commits));

      const result = finalPhase(repository, commits.c0);
      assertDiagnostic(result, FOLLOWS, variant.name);
      if (variant.record) assertDiagnostic(result, INCONSISTENT, variant.name);
    });
  }

  it("null control: the same commits in the correct order pass, recorded or not, in both phases", () => {
    const repository = fixture();
    const c0 = repository.head();
    const c2 = assess(repository, "alpha-change", "alpha");
    const c1 = implement(repository, "alpha", 1);
    const c3 = implement(repository, "alpha", 3);
    bothPhasesPass(repository, c0, "nothing recorded");

    recordOrdering(repository, "alpha-change", {
      assessment_commit: c2, earliest_governed_implementation_commit: c1, final_technical_commit: c3,
    });
    bothPhasesPass(repository, c0, "every field recorded consistently");
  });

  it("rejects a commit that adds the assessment together with implementation, with nothing recorded", () => {
    const repository = fixture();
    const c0 = repository.head();
    writeAssessment(repository, "alpha-change", ownerOf("alpha"));
    repository.write(sourceIn("alpha"), "export const value = 1;\n");
    repository.commit("feat: assess and implement alpha together");

    assertDiagnostic(finalPhase(repository, c0), SHARES);
  });
});

describe("R10: the assessment's decision content is frozen once the change implements, within the range", () => {
  const placeholder = (assessment) => {
    assessment.forces = ["A placeholder force recorded before the real assessment was written."];
  };

  it("rejects a placeholder assessment rewritten after implementation in the same range", () => {
    const repository = fixture();
    const c0 = repository.head();
    assess(repository, "alpha-change", "alpha", placeholder);
    implement(repository, "alpha", 1);
    writeAssessment(repository, "alpha-change", ownerOf("alpha"));
    repository.commit("docs: write the real alpha-change assessment");

    assertDiagnostic(finalPhase(repository, c0), AMENDED);
  });

  const bookkeeping = [
    ["ordering", (assessment, implementation) => {
      assessment.ordering.final_technical_commit = implementation;
    }],
    ["invariant_evidence", (assessment) => {
      const [first] = Object.keys(assessment.invariant_evidence);
      assessment.invariant_evidence[first].evidence_ids.push("evidence recorded after implementation");
    }],
    ["verification_task_ids", (assessment) => {
      assessment.verification_task_ids = [...assessment.verification_task_ids].reverse();
    }],
    ["owned_paths", (assessment) => {
      assessment.owned_paths = [...assessment.owned_paths, "packages/alpha-tests/"];
    }],
  ];
  for (const [field, edit] of bookkeeping) {
    it(`null control: an edit to ${field} alone after implementation passes`, () => {
      const repository = fixture();
      const c0 = repository.head();
      assess(repository, "alpha-change", "alpha");
      const implementation = implement(repository, "alpha", 1);
      repository.mutateJson(assessmentOf("alpha-change"), (assessment) => {
        edit(assessment, implementation);
        return assessment;
      });
      repository.commit(`docs: record alpha-change ${field}`);

      assertPasses(finalPhase(repository, c0), field);
    });
  }

  it("null control: a rewrite in a later range with none of the change's commits passes (the disclosed limit)", () => {
    const repository = fixture();
    assess(repository, "alpha-change", "alpha", placeholder);
    const implementation = implement(repository, "alpha", 1);
    writeAssessment(repository, "alpha-change", ownerOf("alpha"));
    repository.commit("docs: write the real alpha-change assessment in a later pull request");

    assertPasses(finalPhase(repository, implementation));
  });

  it("an archive move, which deletes the active assessment, is not an amendment", () => {
    const repository = fixture();
    assess(repository, "alpha-change", "alpha");
    const implementation = implement(repository, "alpha", 1);
    mkdirSync(repository.path("openspec/changes/archive"), { recursive: true });
    repository.git(["mv", "openspec/changes/alpha-change", "openspec/changes/archive/2026-01-01-alpha-change"]);
    repository.commit("docs: archive alpha-change");

    const result = finalPhase(repository, implementation);
    assertNoDiagnostic(result, AMENDED);
    assertNoDiagnostic(result, FOLLOWS);
  });
});

describe("R10: a change is judged only by its own commits", () => {
  it("null control: another change's governed commit between this change's assessment and its implementation (history B)", () => {
    const repository = fixture();
    const c0 = repository.head();
    assess(repository, "alpha-change", "alpha", (assessment) => {
      assessment.ordering.proposal_baseline_commit = c0;
    });
    assess(repository, "other-change", "other");
    const other = implement(repository, "other", 1);
    implement(repository, "alpha", 1);

    assertPasses(finalPhase(repository, c0), "whole history");
    assertPasses(finalPhase(repository, other), "alpha-change's own range");
  });

  /** Assesses `change` on a branch cut from `base`, returning to main. */
  function assessOnSideBranch(repository, base, change, area) {
    repository.git(["switch", "-c", change, base]);
    assess(repository, change, area);
    repository.checkout("main");
  }

  function merge(repository, branch) {
    repository.git(["merge", "--no-ff", "-m", `chore: merge ${branch}`, branch]);
  }

  it("accepts a commit owned by two changes when one owner's assessment precedes it", () => {
    const repository = fixture();
    const c0 = repository.head();
    assess(repository, "x-change", "shared");
    assessOnSideBranch(repository, c0, "y-change", "shared");
    implement(repository, "shared", 1);
    merge(repository, "y-change");

    assertPasses(finalPhase(repository, c0));
  });

  it("rejects a commit owned by two changes when neither owner's assessment precedes it", () => {
    const repository = fixture();
    const c0 = repository.head();
    assessOnSideBranch(repository, c0, "x-change", "shared");
    assessOnSideBranch(repository, c0, "y-change", "shared");
    implement(repository, "shared", 1);
    merge(repository, "x-change");
    merge(repository, "y-change");

    assertDiagnostic(finalPhase(repository, c0), FOLLOWS);
  });

  it("fails closed when a change owns a governed commit but its assessment was never committed", () => {
    const repository = fixture();
    const c0 = repository.head();
    writeAssessment(repository, "zeta-change", ownerOf("zeta"));
    repository.write(sourceIn("zeta"), "export const value = 1;\n");
    repository.git(["add", sourceIn("zeta")]);
    repository.git(["commit", "-m", "feat: implement zeta before committing its assessment"]);

    assertDiagnostic(finalPhase(repository, c0), ANCHOR_MISSING);
  });

  it("fails closed for a change with no committed assessment even when another owner's assessment precedes the commit", () => {
    const repository = fixture();
    const c0 = repository.head();
    assess(repository, "x-change", "shared");
    writeAssessment(repository, "zeta-change", ownerOf("shared"));
    repository.write(sourceIn("shared"), "export const value = 1;\n");
    repository.git(["add", sourceIn("shared")]);
    repository.git(["commit", "-m", "feat: implement shared before committing zeta-change's assessment"]);

    assertDiagnostic(finalPhase(repository, c0), ANCHOR_MISSING);
  });
});

describe("R10: the contract-reuse record is a planning artifact", () => {
  /** The proposal commit adds the assessment and the contract-reuse record, then implementation follows. */
  function proposeWithContractReuse(repository) {
    const c0 = repository.head();
    writeAssessment(repository, "gamma-change", ownerOf("gamma"));
    repository.writeJson("openspec/changes/gamma-change/contract-reuse.json", { change: "gamma-change" });
    const proposal = repository.commit("docs: propose gamma-change with its contract-reuse record");
    implement(repository, "gamma", 1);
    recordOrdering(repository, "gamma-change", { assessment_commit: proposal });
    return c0;
  }

  it("accepts a proposal commit that adds the contract-reuse record beside the assessment, in both phases", () => {
    const repository = fixture();
    const c0 = proposeWithContractReuse(repository);

    bothPhasesPass(repository, c0, "contract-reuse record in the proposal commit");
  });

  it("null control: without the pattern, the same proposal commit shares implementation, in both phases", () => {
    const repository = fixture();
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.planning_artifact_patterns = policy.planning_artifact_patterns
        .filter((pattern) => pattern !== CONTRACT_REUSE_PATTERN);
      return policy;
    });
    repository.commit("chore: drop the contract-reuse pattern from the fixture's policy");
    const c0 = proposeWithContractReuse(repository);

    assertDiagnostic(assessmentPhase(repository), SHARES, "assessment phase");
    assertDiagnostic(finalPhase(repository, c0), SHARES, "final phase");
  });
});

describe("R10: recorded ordering commits are checked against history", () => {
  /**
   * C0, the anchor adds the assessment, an empty commit, a pre-implementation
   * edit (the #957 shape), then two implementation commits. With
   * `mixedFirst`, the first implementation commit also edits the assessment.
   */
  function recordedHistory(repository, { mixedFirst = false } = {}) {
    const c0 = repository.head();
    const anchor = assess(repository, "rho-change", "rho");
    const empty = repository.commit("chore: an empty commit after the assessment");
    repository.mutateJson(assessmentOf("rho-change"), (assessment) => {
      assessment.owned_paths = [...assessment.owned_paths, "packages/rho-tests/"];
      return assessment;
    });
    const edit = repository.commit("docs: widen rho-change's owned paths before implementation");
    if (mixedFirst) {
      repository.mutateJson(assessmentOf("rho-change"), (assessment) => {
        const [first] = Object.keys(assessment.invariant_evidence);
        assessment.invariant_evidence[first].evidence_ids.push("evidence written with the implementation");
        return assessment;
      });
    }
    const first = implement(repository, "rho", 1);
    const second = implement(repository, "rho", 2);
    return { c0, anchor, empty, edit, first, second };
  }

  const inconsistent = [
    { name: "an assessment commit that does not change the assessment",
      record: ({ empty }) => ({ assessment_commit: empty }) },
    { name: "an assessment commit that precedes the first commit adding the assessment",
      record: ({ c0 }) => ({ assessment_commit: c0 }) },
    { name: "an assessment commit that also changes an owned governed path", mixedFirst: true,
      record: ({ first }) => ({ assessment_commit: first }) },
    { name: "an earliest implementation commit that is not an owned governed commit",
      record: ({ edit }) => ({ earliest_governed_implementation_commit: edit }) },
    { name: "a final technical commit that does not descend from the assessment",
      record: ({ c0 }) => ({ final_technical_commit: c0 }) },
  ];

  for (const variant of inconsistent) {
    it(`rejects ${variant.name}, in both phases`, () => {
      const repository = fixture();
      const commits = recordedHistory(repository, { mixedFirst: variant.mixedFirst });
      recordOrdering(repository, "rho-change", variant.record(commits));

      assertDiagnostic(assessmentPhase(repository), INCONSISTENT, `${variant.name}, assessment phase`);
      assertDiagnostic(finalPhase(repository, commits.c0), INCONSISTENT, `${variant.name}, final phase`);
    });
  }

  it("rejects, at the final phase, an earliest implementation commit preceded by another of the change's commits", () => {
    const repository = fixture();
    const commits = recordedHistory(repository);
    recordOrdering(repository, "rho-change", { earliest_governed_implementation_commit: commits.second });

    assertPasses(assessmentPhase(repository), "assessment phase");
    assertDiagnostic(finalPhase(repository, commits.c0), INCONSISTENT, "final phase");
  });

  const consistent = [
    { name: "the first commit adding the assessment",
      record: ({ anchor, first, second }) => ({
        assessment_commit: anchor, earliest_governed_implementation_commit: first, final_technical_commit: second,
      }) },
    { name: "a later pre-implementation edit as the assessment commit",
      record: ({ edit, first, second }) => ({
        assessment_commit: edit, earliest_governed_implementation_commit: first, final_technical_commit: second,
      }) },
  ];

  for (const variant of consistent) {
    it(`null control: accepts ${variant.name}, with the true earliest commit, in both phases`, () => {
      const repository = fixture();
      const commits = recordedHistory(repository);
      recordOrdering(repository, "rho-change", variant.record(commits));

      bothPhasesPass(repository, commits.c0, variant.name);
    });
  }
});
