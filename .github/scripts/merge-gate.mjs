#!/usr/bin/env node
//
// merge-gate — the decision half of the sanctioned merge path for this repository.
//
// The operator entry point (.github/scripts/merge-pr.sh) collects evidence from
// `gh` and `hermes`; this module decides from that evidence alone. Splitting the
// two is what makes the gate testable: every arm below is a pure function over
// plain JSON, so a fixture can assert both that a defect is refused and that the
// matching healthy input is still allowed. A gate with no failing arm is not a
// gate — `codescene delta` was a no-op for its entire life because nothing ever
// proved it could fail.
//
// Usage:
//   node .github/scripts/merge-gate.mjs --evidence <path|->
//
// Exit codes:
//   0  every gate passed; the report names the merge method to use
//   1  a gate refused the merge
//   2  usage or evidence-shape error

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

/** Buckets `gh pr checks --json bucket` reports for a context that is not blocking. */
const PASSING_BUCKETS = Object.freeze(["pass", "skipping"]);

/** Verdicts the reviewer profile is permitted to emit for a merge-eligible review. */
const ACCEPTED_VERDICTS = Object.freeze(["approved", "technically_acceptable"]);

/** Metadata fields a reviewer run may record its reviewed commit in. */
const REVIEWED_COMMIT_FIELDS = Object.freeze([
  "reviewed_commit",
  "commit_sha_reviewed",
  "reviewed_sha",
]);

const ARCHIVE_PATH_PREFIX = "openspec/changes/archive/";

/** Every merge here is a merge commit; see `selectMergeMethod`. */
export const MERGE_METHOD = "--merge";

const isFilledString = (value) => typeof value === "string" && value.length > 0;

const asArray = (value) => (Array.isArray(value) ? value : []);

const stringsOf = (value) => asArray(value).filter(isFilledString);

const isPlainObject = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const gate = (name, failures, details = {}) => ({
  name,
  ok: failures.length === 0,
  failures,
  ...details,
});

const shown = (value) => value ?? "<absent>";

/** Collects the `[code] message` failures of one gate from a rule table. */
const failuresOf = (rules, subject) =>
  rules.filter(([holds]) => !holds(subject)).map(([, describe]) => describe(subject));

// ---------------------------------------------------------------- gate 1

// A pull request is mergeable at all only if every one of these holds. Kept as a
// table so each property carries its own diagnostic and none can be lost in a
// combined condition.
const PULL_REQUEST_RULES = Object.freeze([
  [(pr) => pr.state === "OPEN", (pr) => `[pr-not-open] pull request is ${shown(pr.state)}, not OPEN`],
  [(pr) => pr.isDraft === false, () => "[pr-draft] pull request is a draft"],
  [
    (pr) => pr.baseRefName === pr.expectedBase,
    (pr) => `[pr-wrong-base] pull request targets '${shown(pr.baseRefName)}', not '${pr.expectedBase}'`,
  ],
  [(pr) => isFilledString(pr.headRefOid), () => "[pr-no-head] pull request reports no head commit"],
]);

/** Gate 1 — the pull request is a thing that may be merged at all. */
export function evaluatePullRequestState(pullRequest, expectedBase = "main") {
  const subject = { ...pullRequest, expectedBase };
  const failures = failuresOf(PULL_REQUEST_RULES, subject);
  return gate("pull-request-state", failures, { head: subject.headRefOid ?? null });
}

// ---------------------------------------------------------------- gate 2

const isPassing = (check) => PASSING_BUCKETS.includes(check?.bucket);

/**
 * Refuses before any counting when the evidence itself is unusable. An empty
 * evidence source and a healthy one are indistinguishable to a gate that treats
 * absence as consent, so both cases stop here.
 */
function unusableCheckEvidence(requiredContexts, reportedChecks) {
  if (requiredContexts.length === 0) {
    return gate(
      "required-checks",
      [
        "[required-contexts-unreadable] branch protection reported no required contexts; refusing to merge an ungated pull request",
      ],
      { missing: [], notPassing: [] },
    );
  }
  if (reportedChecks.length === 0) {
    return gate(
      "required-checks",
      [`[checks-none-reported] no required CI check reported; expected ${requiredContexts.length}`],
      { missing: requiredContexts, notPassing: [] },
    );
  }
  return null;
}

function describeMissing(missing, reportedCount, requiredCount) {
  if (missing.length === 0) return [];
  return [
    `[required-context-never-reported] ${missing.length} required context(s) never reported (${reportedCount} present, ${requiredCount} required): ${missing.join(", ")}`,
  ];
}

function describeNotPassing(notPassing) {
  if (notPassing.length === 0) return [];
  return [`[required-check-not-passing] ${notPassing.length} required check(s) not passing`];
}

/**
 * Gate 2 — every context branch protection requires has REPORTED and is passing.
 *
 * `gh pr checks --required` lists only contexts that have reported, so a context
 * that never started is absent from that list rather than pending in it. Counting
 * "nothing is failing" over that list settles on an incomplete set: observed on
 * PR #245, where 8 contexts reported, all passed, and `sonar` had never run at
 * all. Presence is therefore asserted against branch protection, not against the
 * reported set, and the two failure modes are reported separately because they
 * call for different actions.
 */
export function evaluateRequiredChecks(evidence) {
  const requiredContexts = stringsOf(evidence?.requiredContexts);
  const reportedChecks = asArray(evidence?.reportedChecks);
  const unusable = unusableCheckEvidence(requiredContexts, reportedChecks);
  if (unusable) return unusable;

  const reported = new Set(reportedChecks.map((check) => check?.name));
  const missing = requiredContexts.filter((context) => !reported.has(context));
  const notPassing = reportedChecks
    .filter((check) => requiredContexts.includes(check?.name) && !isPassing(check))
    .map((check) => `${shown(check.bucket)}\t${check.name}`);

  const failures = [
    ...describeMissing(missing, reported.size, requiredContexts.length),
    ...describeNotPassing(notPassing),
  ];
  return gate("required-checks", failures, { missing, notPassing });
}

// ---------------------------------------------------------------- gate 3

/** Every commit a reviewer run recorded as the thing it reviewed. */
export function reviewedCommitsOf(run) {
  const metadata = run?.metadata ?? {};
  const single = REVIEWED_COMMIT_FIELDS.map((field) => metadata[field]);
  // A review card covering two pull requests cannot express its binding as one
  // string, and reviewers correctly record a map instead. Widening the field a
  // binding may live in is not a relaxation: the assertion is still that a run
  // recorded THIS EXACT live head, so a stale review still matches nothing.
  const mapped = Object.values(metadata.reviewed_commits ?? {});
  return [...single, ...mapped].filter(isFilledString);
}

const completedRunsBy = (runs, reviewerProfile) =>
  asArray(runs).filter((run) => run?.profile === reviewerProfile && run?.outcome === "completed");

// The reviewer profile's own instructions forbid the word "approved" for an AI
// review, so demanding that literal asked a correctly-behaving reviewer for a
// string it may not emit. "approved" stays accepted for older runs and for the
// carve-out where the verdict cites separate human approval evidence. The
// findings rule makes the pair strictly stricter than a verdict check alone: the
// vocabulary permits acceptance only when no blocking finding remains, so an
// accepting verdict carrying findings is self-contradictory.
const VERDICT_RULES = Object.freeze([
  [
    (run) => ACCEPTED_VERDICTS.includes(run.verdict),
    (run) =>
      `[review-verdict-unacceptable] review verdict is '${shown(run.verdict)}'; expected one of ${ACCEPTED_VERDICTS.join(", ")}`,
  ],
  [
    (run) => run.findings.length === 0,
    (run) =>
      `[review-accepts-with-findings] verdict '${run.verdict}' carries ${run.findings.length} blocking finding(s)`,
  ],
]);

function evaluateBoundRun(bound) {
  const subject = {
    verdict: bound.metadata?.technical_review ?? null,
    findings: asArray(bound.metadata?.blocking_findings),
  };
  return { verdict: subject.verdict, failures: failuresOf(VERDICT_RULES, subject) };
}

/**
 * Gate 3 — a review verdict, bound to this exact head, with no blocking findings.
 *
 * GitHub supplies no approval here: `main` has no CODEOWNERS and no required
 * reviews, so `reviewDecision` is empty on every pull request. The binding
 * verdict is the reviewer profile's completed run. A completed run is not by
 * itself an approval — a reviewer that requests changes also completes its run —
 * so the verdict and the commit it was bound to are both read from run metadata.
 */
export function evaluateReview(evidence) {
  const head = evidence?.head;
  const failures =
    evidence?.githubReviewDecision === "CHANGES_REQUESTED"
      ? ["[github-changes-requested] GitHub review decision is CHANGES_REQUESTED"]
      : [];

  const completed = completedRunsBy(evidence?.runs, evidence?.reviewerProfile);
  if (completed.length === 0) {
    failures.push(
      `[review-not-completed] no completed review run by profile '${shown(evidence?.reviewerProfile)}'`,
    );
    return gate("review", failures, { verdict: null, boundRun: null });
  }

  const bound = completed.findLast((run) => reviewedCommitsOf(run).includes(head));
  if (bound === undefined) {
    failures.push(
      `[review-not-bound-to-head] no completed review run is bound to head ${shown(head)}; a review of an older head does not carry forward`,
    );
    return gate("review", failures, { verdict: null, boundRun: null });
  }

  const { verdict, failures: verdictFailures } = evaluateBoundRun(bound);
  return gate("review", [...failures, ...verdictFailures], {
    verdict,
    boundRun: bound.id ?? null,
  });
}

// ---------------------------------------------------------------- gate 4

const ARCHIVE_REASON =
  "archive pull request — a merge commit keeps the pre-archive state reachable for movement re-derivation";
const MERGE_REASON =
  "merge commit — keeps this commit reachable for any governance record that binds it";

/**
 * Gate 4 — the merge method.
 *
 * Always a merge commit. A squash replays the branch as a single commit parented
 * on the target tip, which orphans the commit a governance record named, and
 * `check-governance-history.mjs` then fails `governance-commit-not-ancestor`.
 * Fold pull requests are exactly that case. Archive pull requests keep their own
 * separate reason: archive-movement exactness is re-derived from history, and a
 * squash makes the pre-archive state unreachable. The reason is recorded, but it
 * does not select the method, so misclassifying a pull request cannot pick one
 * that orphans a commit.
 */
export function selectMergeMethod(changedPaths) {
  const paths = stringsOf(changedPaths);
  if (paths.length === 0) {
    return gate("merge-method", ["[pr-no-changed-paths] pull request reports no changed paths"], {
      method: null,
      archive: false,
      reason: null,
    });
  }
  const archive = paths.some((path) => path.startsWith(ARCHIVE_PATH_PREFIX));
  return gate("merge-method", [], {
    method: MERGE_METHOD,
    archive,
    reason: archive ? ARCHIVE_REASON : MERGE_REASON,
  });
}

/** Runs every gate over one evidence object and reports them all, in order. */
export function evaluateMergeGates(evidence) {
  const state = evaluatePullRequestState(evidence?.pullRequest, evidence?.expectedBase ?? "main");
  const gates = [
    state,
    evaluateRequiredChecks(evidence),
    evaluateReview({ ...evidence, head: state.head }),
    selectMergeMethod(evidence?.changedPaths),
  ];
  return { ok: gates.every((entry) => entry.ok), gates };
}

// ---------------------------------------------------------------- cli

function readEvidence(source) {
  const raw = source === "-" ? readFileSync(0, "utf8") : readFileSync(source, "utf8");
  const parsed = JSON.parse(raw);
  if (!isPlainObject(parsed)) throw new TypeError("evidence must be a JSON object");
  return parsed;
}

function reportGate(entry, write) {
  if (!entry.ok) {
    write(`  FAIL  ${entry.name}\n`);
    for (const failure of entry.failures) write(`          ${failure}\n`);
    return;
  }
  const because = entry.reason ? ` — ${entry.reason}` : "";
  write(`  ok    ${entry.name}${because}\n`);
}

function valueAfter(argv, flag) {
  const index = argv.indexOf(flag);
  return index === -1 ? null : argv[index + 1] ?? null;
}

function main(argv, write) {
  const source = valueAfter(argv, "--evidence");
  if (source === null) {
    write("usage: merge-gate.mjs --evidence <path|->\n");
    return 2;
  }
  let evidence;
  try {
    evidence = readEvidence(source);
  } catch (error) {
    write(`ERROR: could not read evidence: ${error.message}\n`);
    return 2;
  }
  const result = evaluateMergeGates(evidence);
  for (const entry of result.gates) reportGate(entry, write);
  if (!result.ok) return 1;
  write(`merge-method ${MERGE_METHOD}\n`);
  return 0;
}

// Only the direct invocation exits; importing this module runs no gate.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = main(process.argv.slice(2), (text) => process.stdout.write(text));
}
