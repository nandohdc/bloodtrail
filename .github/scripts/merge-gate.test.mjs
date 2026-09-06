import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { fileURLToPath } from "node:url";

import {
  MERGE_METHOD,
  evaluateMergeGates,
  evaluatePullRequestState,
  evaluateRequiredChecks,
  evaluateReview,
  reviewedCommitsOf,
  selectMergeMethod,
} from "./merge-gate.mjs";

const GATE_SCRIPT = join(dirname(fileURLToPath(import.meta.url)), "merge-gate.mjs");

const HEAD = "0b7e0512a3c4d5e6f708192a3b4c5d6e7f809102";
const OLDER_HEAD = "aaaaaaaabbbbbbbbccccccccddddddddeeeeeeee";

// A frozen fixture of the contexts `main` required on 2026-09-02, the day the
// missing-context defect was observed on PR #245. It is a fixture of that
// incident, never an assertion about what branch protection requires today —
// the gate reads the live list and this test proves what it does with one.
const REQUIRED_CONTEXTS = Object.freeze([
  "ci / lint",
  "ci / test",
  "ci / audit",
  "sonar",
  "sdk",
  "contract",
  "conventional-commits",
  "codescene delta",
  "design-pattern-governance",
  "coverage",
]);

const passingChecks = (contexts) => contexts.map((name) => ({ name, bucket: "pass" }));

const reviewRun = (overrides = {}) => ({
  id: "run-1",
  profile: "reviewer",
  outcome: "completed",
  metadata: { technical_review: "technically_acceptable", reviewed_commit: HEAD },
  ...overrides,
});

const healthyEvidence = (overrides = {}) => ({
  pullRequest: { state: "OPEN", isDraft: false, baseRefName: "main", headRefOid: HEAD },
  requiredContexts: [...REQUIRED_CONTEXTS],
  reportedChecks: passingChecks(REQUIRED_CONTEXTS),
  reviewerProfile: "reviewer",
  githubReviewDecision: "",
  runs: [reviewRun()],
  changedPaths: ["openspec/specs/change-governance/spec.md"],
  ...overrides,
});

const codesOf = (result) => result.failures.map((failure) => failure.slice(1, failure.indexOf("]")));

// ---------------------------------------------------------------- gate 2

test("required checks: NULL CONTROL - every required context reported and passing is allowed", () => {
  const result = evaluateRequiredChecks(healthyEvidence());
  assert.equal(result.ok, true);
  assert.deepEqual(result.missing, []);
});

test("required checks: a context that never reported is refused, not read as absent-and-fine", () => {
  // The exact PR #245 shape: 9 contexts reported, all passing, `sonar` never started.
  const reported = REQUIRED_CONTEXTS.filter((name) => name !== "sonar");
  const result = evaluateRequiredChecks(
    healthyEvidence({ reportedChecks: passingChecks(reported) }),
  );
  assert.equal(result.ok, false);
  assert.deepEqual(result.missing, ["sonar"]);
  assert.deepEqual(codesOf(result), ["required-context-never-reported"]);
  assert.match(result.failures[0], /sonar/);
});

test("required checks: unreadable branch protection refuses rather than merging an ungated PR", () => {
  for (const requiredContexts of [[], undefined, null, "not-an-array"]) {
    const result = evaluateRequiredChecks(healthyEvidence({ requiredContexts }));
    assert.equal(result.ok, false);
    assert.deepEqual(codesOf(result), ["required-contexts-unreadable"]);
  }
});

test("required checks: zero reported checks refuses", () => {
  const result = evaluateRequiredChecks(healthyEvidence({ reportedChecks: [] }));
  assert.equal(result.ok, false);
  assert.deepEqual(codesOf(result), ["checks-none-reported"]);
});

test("required checks: a reported required context in any non-passing bucket refuses", () => {
  for (const bucket of ["fail", "pending", "cancel", "skipped"]) {
    const reportedChecks = passingChecks(REQUIRED_CONTEXTS).map((check) =>
      check.name === "sonar" ? { name: "sonar", bucket } : check,
    );
    const result = evaluateRequiredChecks(healthyEvidence({ reportedChecks }));
    assert.equal(result.ok, false, `bucket ${bucket} should refuse`);
    assert.deepEqual(codesOf(result), ["required-check-not-passing"]);
  }
});

test("required checks: `skipping` counts as passing, and a failing non-required check does not block", () => {
  const reportedChecks = [
    ...passingChecks(REQUIRED_CONTEXTS.filter((name) => name !== "codescene delta")),
    { name: "codescene delta", bucket: "skipping" },
    { name: "CodeScene Code Health Review (main)", bucket: "fail" },
  ];
  const result = evaluateRequiredChecks(healthyEvidence({ reportedChecks }));
  assert.equal(result.ok, true);
  assert.deepEqual(result.notPassing, []);
});

// ---------------------------------------------------------------- gate 4

test("merge method: a non-archive PR still lands as a merge commit, never a squash", () => {
  const result = selectMergeMethod(["openspec/specs/change-governance/spec.md"]);
  assert.equal(result.ok, true);
  assert.equal(result.method, MERGE_METHOD);
  assert.equal(result.archive, false);
  assert.match(result.reason, /reachable/);
});

test("merge method: an archive PR lands as a merge commit for its own re-derivation reason", () => {
  const result = selectMergeMethod([
    "openspec/changes/archive/2026-09-05-some-change/proposal.md",
    "README.md",
  ]);
  assert.equal(result.method, MERGE_METHOD);
  assert.equal(result.archive, true);
  assert.match(result.reason, /movement re-derivation/);
});

test("merge method: no method is chosen for a PR that reports no changed paths", () => {
  for (const changedPaths of [[], undefined, [""], "openspec/"]) {
    const result = selectMergeMethod(changedPaths);
    assert.equal(result.ok, false);
    assert.equal(result.method, null);
    assert.deepEqual(codesOf(result), ["pr-no-changed-paths"]);
  }
});

// ---------------------------------------------------------------- gate 1

test("pull request state: NULL CONTROL - an open, non-draft PR against main is allowed", () => {
  const result = evaluatePullRequestState(healthyEvidence().pullRequest);
  assert.equal(result.ok, true);
  assert.equal(result.head, HEAD);
});

test("pull request state: each unmergeable shape is refused with its own code", () => {
  const cases = [
    [{ state: "MERGED" }, "pr-not-open"],
    [{ state: "CLOSED" }, "pr-not-open"],
    [{ isDraft: true }, "pr-draft"],
    [{ baseRefName: "release/next" }, "pr-wrong-base"],
    [{ headRefOid: "" }, "pr-no-head"],
  ];
  for (const [mutation, expected] of cases) {
    const result = evaluatePullRequestState({ ...healthyEvidence().pullRequest, ...mutation });
    assert.equal(result.ok, false, `${expected} should refuse`);
    assert.ok(codesOf(result).includes(expected), `expected ${expected}, got ${codesOf(result)}`);
  }
});

// ---------------------------------------------------------------- gate 3

test("review: NULL CONTROL - an accepting verdict bound to the live head is allowed", () => {
  const result = evaluateReview({ ...healthyEvidence(), head: HEAD });
  assert.equal(result.ok, true);
  assert.equal(result.verdict, "technically_acceptable");
});

test("review: `approved` stays accepted alongside `technically_acceptable`", () => {
  const runs = [reviewRun({ metadata: { technical_review: "approved", reviewed_commit: HEAD } })];
  const result = evaluateReview({ ...healthyEvidence({ runs }), head: HEAD });
  assert.equal(result.ok, true);
});

test("review: a completed run is not an approval — the verdict is read from run metadata", () => {
  const cases = [
    ["changes_requested", "review-verdict-unacceptable"],
    ["blocked", "review-verdict-unacceptable"],
    [undefined, "review-verdict-unacceptable"],
  ];
  for (const [technical_review, expected] of cases) {
    const runs = [reviewRun({ metadata: { technical_review, reviewed_commit: HEAD } })];
    const result = evaluateReview({ ...healthyEvidence({ runs }), head: HEAD });
    assert.equal(result.ok, false, `verdict ${technical_review} should refuse`);
    assert.deepEqual(codesOf(result), [expected]);
  }
});

test("review: an accepting verdict carrying blocking findings is self-contradictory and refused", () => {
  const runs = [
    reviewRun({
      metadata: {
        technical_review: "technically_acceptable",
        reviewed_commit: HEAD,
        blocking_findings: [{ path: "src/sdk.ts", finding: "unbounded retry" }],
      },
    }),
  ];
  const result = evaluateReview({ ...healthyEvidence({ runs }), head: HEAD });
  assert.equal(result.ok, false);
  assert.deepEqual(codesOf(result), ["review-accepts-with-findings"]);
});

test("review: a verdict bound to an older head does not carry forward", () => {
  const runs = [
    reviewRun({
      metadata: { technical_review: "technically_acceptable", reviewed_commit: OLDER_HEAD },
    }),
  ];
  const result = evaluateReview({ ...healthyEvidence({ runs }), head: HEAD });
  assert.equal(result.ok, false);
  assert.deepEqual(codesOf(result), ["review-not-bound-to-head"]);
});

test("review: an absent, unfinished, or foreign-profile run is refused", () => {
  const cases = [
    [[], "review-not-completed"],
    [[reviewRun({ outcome: "failed" })], "review-not-completed"],
    [[reviewRun({ profile: "implementer" })], "review-not-completed"],
  ];
  for (const [runs, expected] of cases) {
    const result = evaluateReview({ ...healthyEvidence({ runs }), head: HEAD });
    assert.equal(result.ok, false);
    assert.deepEqual(codesOf(result), [expected]);
  }
});

test("review: GitHub CHANGES_REQUESTED refuses even with an accepting reviewer run", () => {
  const result = evaluateReview({
    ...healthyEvidence({ githubReviewDecision: "CHANGES_REQUESTED" }),
    head: HEAD,
  });
  assert.equal(result.ok, false);
  assert.ok(codesOf(result).includes("github-changes-requested"));
});

test("reviewed commits: every recorded binding field and the two-PR map are read", () => {
  assert.deepEqual(reviewedCommitsOf({ metadata: { commit_sha_reviewed: HEAD } }), [HEAD]);
  assert.deepEqual(reviewedCommitsOf({ metadata: { reviewed_sha: HEAD } }), [HEAD]);
  assert.deepEqual(
    reviewedCommitsOf({
      metadata: { reviewed_commits: { fold_pr_252: OLDER_HEAD, archive_pr_253: HEAD } },
    }),
    [OLDER_HEAD, HEAD],
  );
  assert.deepEqual(reviewedCommitsOf({}), []);
});

// ---------------------------------------------------------------- aggregate

test("aggregate: NULL CONTROL - healthy evidence passes every gate", () => {
  const result = evaluateMergeGates(healthyEvidence());
  assert.equal(result.ok, true, JSON.stringify(result.gates.filter((entry) => !entry.ok)));
  assert.deepEqual(
    result.gates.map((entry) => entry.name),
    ["pull-request-state", "required-checks", "review", "merge-method"],
  );
});

test("aggregate: any single defective input refuses the whole merge", () => {
  const mutations = [
    { pullRequest: { state: "OPEN", isDraft: true, baseRefName: "main", headRefOid: HEAD } },
    { reportedChecks: passingChecks(REQUIRED_CONTEXTS.filter((n) => n !== "sonar")) },
    { runs: [] },
    { changedPaths: [] },
  ];
  for (const mutation of mutations) {
    assert.equal(evaluateMergeGates(healthyEvidence(mutation)).ok, false, JSON.stringify(mutation));
  }
});

test("aggregate: the review gate binds to the head the PR gate read, not to a caller-supplied one", () => {
  const evidence = healthyEvidence({
    pullRequest: { state: "OPEN", isDraft: false, baseRefName: "main", headRefOid: OLDER_HEAD },
  });
  const result = evaluateMergeGates(evidence);
  const review = result.gates.find((entry) => entry.name === "review");
  assert.equal(review.ok, false);
  assert.deepEqual(codesOf(review), ["review-not-bound-to-head"]);
});

// ---------------------------------------------------------------- CLI

function runScript(args) {
  try {
    return { status: 0, stdout: execFileSync(process.execPath, [GATE_SCRIPT, ...args], { encoding: "utf8" }) };
  } catch (error) {
    return { status: error.status, stdout: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

function runGate(evidence) {
  const file = join(mkdtempSync(join(tmpdir(), "merge-gate-")), "evidence.json");
  writeFileSync(file, JSON.stringify(evidence));
  return runScript(["--evidence", file]);
}

test("cli: exits 0 and names the merge method on healthy evidence", () => {
  const { status, stdout } = runGate(healthyEvidence());
  assert.equal(status, 0);
  assert.match(stdout, /^merge-method --merge$/m);
});

test("cli: exits 1 and names the missing context when one never reported", () => {
  const { status, stdout } = runGate(
    healthyEvidence({ reportedChecks: passingChecks(REQUIRED_CONTEXTS.filter((n) => n !== "sonar")) }),
  );
  assert.equal(status, 1);
  assert.match(stdout, /required-context-never-reported/);
  assert.doesNotMatch(stdout, /^merge-method --merge$/m);
});

test("cli: exits 2 without an --evidence argument or on unusable evidence", () => {
  const noArgument = runScript([]);
  assert.equal(noArgument.status, 2);
  assert.match(noArgument.stdout, /usage: merge-gate.mjs/);

  for (const raw of ["not json at all", "[]", "null"]) {
    const file = join(mkdtempSync(join(tmpdir(), "merge-gate-")), "evidence.json");
    writeFileSync(file, raw);
    assert.equal(runScript(["--evidence", file]).status, 2, `${raw} should be a usage error`);
  }
});
