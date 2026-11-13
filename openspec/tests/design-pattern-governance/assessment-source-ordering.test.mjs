/**
 * R10 — an assessment's generator source is a planning artifact (#943, #913).
 *
 * A generated assessment is written from `assessment.source.json`, so the
 * assessment commit of every change authored with the generator adds that file
 * beside `assessment.json`. Ordering must treat both files as the assessment, not
 * as governed implementation. Otherwise recording that commit as
 * `assessment_commit` fails `assessment-shares-implementation-commit`, as #913's
 * proposal commit did.
 *
 * The fixtures build real commit graphs, as the R10 fixtures in
 * `ancestry.test.mjs` do. Each history deletes the source again before the
 * ordering record: the checker regenerates `assessment.json` from a source file
 * present in an active change directory and fails on drift, and a minimal
 * fixture source would not regenerate the seeded assessment. Ordering reads the
 * paths each commit changed, so the assessment commit still carries the source.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { after, describe, it } from "node:test";

import { requiresOpenSpecAssociation } from "../../scripts/design-pattern-governance/perimeter.mjs";
import { ASSESSMENT, createRepository, liveRepositoryRoot } from "./support/disposable-repo.mjs";
import { assertDiagnostic, assertPasses, runChecker } from "./support/harness.mjs";

const POLICY = "openspec/governance/design-pattern-policy.json";
const SOURCE = ASSESSMENT.replace(/assessment\.json$/, "assessment.source.json");
const SOURCE_PATTERN = "openspec/changes/*/assessment.source.json";
const ASSESSMENT_PATTERN = "openspec/changes/*/assessment.json";
/** A governed implementation path in the fixture's own classification. */
const IMPLEMENTATION = "packages/example/src/feature.mjs";

const livePolicy = () => JSON.parse(readFileSync(resolve(liveRepositoryRoot, POLICY), "utf8"));

const repositories = [];
function fixture() {
  const repository = createRepository();
  repositories.push(repository);
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

function setOrdering(repository, ordering) {
  repository.mutateJson(ASSESSMENT, (assessment) => {
    assessment.ordering = { ...assessment.ordering, ...ordering };
    return assessment;
  });
}

/** Commits a fixture policy whose planning list carries, or lacks, the source pattern. */
function withSourcePattern(repository, present) {
  repository.mutateJson(POLICY, (policy) => {
    const others = policy.planning_artifact_patterns.filter((pattern) => pattern !== SOURCE_PATTERN);
    policy.planning_artifact_patterns = present ? [...others, SOURCE_PATTERN] : others;
    return policy;
  });
  repository.commit("chore: set the fixture's planning artifact patterns");
}

/**
 * The assessment commit writes the source, the implementation follows, the
 * source is deleted again, and the ordering is recorded. Returns the baseline.
 */
function orderedHistory(repository) {
  const baseline = repository.head();
  setOrdering(repository, { proposal_baseline_commit: baseline });
  repository.write(SOURCE, `${JSON.stringify({ ordering: { proposal_baseline_commit: baseline } }, null, 2)}\n`);
  const assessmentCommit = repository.commit("docs: record the assessment and its source");

  repository.write(IMPLEMENTATION, "export function feature() { return 1; }\n");
  const implementation = repository.commit("feat: implement the feature");

  repository.remove(SOURCE);
  repository.commit("chore: drop the fixture's generator source");

  setOrdering(repository, {
    proposal_baseline_commit: baseline,
    assessment_commit: assessmentCommit,
    earliest_governed_implementation_commit: implementation,
    final_technical_commit: implementation,
  });
  repository.commit("docs: bind ordering evidence");
  return baseline;
}

/** The two phases that judge ordering: the author's, and the one CI runs with a base. */
function phases(repository, baseline) {
  return [
    ["assessment", runChecker(repository, { phase: "assessment" })],
    ["final", runChecker(repository, { phase: "final", base: baseline })],
  ];
}

describe("R10: an assessment's generator source is a planning artifact", () => {
  it("accepts an assessment commit that writes assessment.source.json, in both phases", () => {
    const repository = fixture();
    const baseline = orderedHistory(repository);

    for (const [phase, result] of phases(repository, baseline)) assertPasses(result, phase);
  });

  it("null control: without the pattern, the same history shares implementation, in both phases", () => {
    const repository = fixture();
    withSourcePattern(repository, false);
    const baseline = orderedHistory(repository);

    for (const [phase, result] of phases(repository, baseline)) {
      assertDiagnostic(result, "assessment-shares-implementation-commit", phase);
    }
  });

  it("exempts only the source from association, not other change files or archived sources", () => {
    const policy = livePolicy();

    assert.equal(requiresOpenSpecAssociation("openspec/changes/example-change/assessment.source.json", policy), false);
    assert.equal(requiresOpenSpecAssociation("openspec/changes/example-change/notes.mjs", policy), true);
    assert.equal(
      requiresOpenSpecAssociation("openspec/changes/archive/2026-01-01-example-change/assessment.source.json", policy),
      true,
    );
  });

  it("lists the source pattern next to assessment.json in the live policy", () => {
    const patterns = livePolicy().planning_artifact_patterns;

    assert.equal(patterns.indexOf(SOURCE_PATTERN), patterns.indexOf(ASSESSMENT_PATTERN) + 1);
    assert.ok(patterns.includes(ASSESSMENT_PATTERN));
  });
});
