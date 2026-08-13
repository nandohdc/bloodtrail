/**
 * Assessment ordering, proven by Git ancestry.
 *
 * "Assess before you implement" is only a rule if it is checkable after the fact,
 * and the only after-the-fact evidence that cannot be rewritten by the author is
 * the commit graph. Every question here is answered from ancestry; none is
 * answered from a field the evidence declares about itself.
 *
 * Where ancestry cannot be established — a shallow clone, a missing commit — the
 * answer is a failure, never an assumption that the ordering was fine.
 */

import { commitsBetween, historyIsComplete, isAncestor, pathsChangedByCommit, resolveCommit } from "./git.mjs";
import { matchesSelection } from "./paths.mjs";

export function requireCompleteHistory(cwd, sink) {
  if (historyIsComplete(cwd)) return true;
  sink.fail("activation-history-unavailable", ".",
    "the clone is shallow; ancestry cannot be proven and absent history never reads as satisfied ordering");
  return false;
}

/**
 * The earliest commit after the baseline that touches a governed implementation
 * path. Walking forward from the baseline — rather than backward from HEAD —
 * is what makes "earliest" mean earliest rather than "the first one I happened
 * to find".
 */
export function findEarliestGovernedImplementationCommit({ baseline, head, governedPatterns, cwd, sink }) {
  const commits = commitsBetween(baseline, head, cwd);
  if (commits === null) {
    sink.fail("history-unavailable", baseline, `cannot enumerate commits between ${baseline} and ${head}`);
    return null;
  }
  for (const commit of commits) {
    const paths = pathsChangedByCommit(commit, cwd);
    if (paths === null) {
      sink.fail("history-unavailable", commit, "cannot enumerate the paths a commit changed");
      return null;
    }
    if (paths.some((path) => matchesSelection(path, governedPatterns))) return commit;
  }
  return null;
}

export function verifyAssessmentOrdering(ordering, { governedPatterns, cwd, documentPath, sink }) {
  if (!requireCompleteHistory(cwd, sink)) return;

  const baseline = resolveCommit(ordering.proposal_baseline_commit, cwd);
  if (baseline === null) {
    sink.fail("proposal-baseline-unresolvable", documentPath,
      `proposal baseline ${ordering.proposal_baseline_commit} is not a commit in this history`);
    return;
  }

  const assessment = resolveOptionalCommit(ordering.assessment_commit, cwd);
  if (assessment.invalid) {
    sink.fail("assessment-commit-unresolvable", documentPath,
      `assessment commit ${ordering.assessment_commit} is not a commit in this history`);
    return;
  }
  if (assessment.commit === null) return;

  checkAssessmentCommitPaths(assessment.commit, { governedPatterns, cwd, documentPath, sink });

  const earliest = resolveOptionalCommit(ordering.earliest_governed_implementation_commit, cwd);
  if (earliest.invalid) {
    sink.fail("implementation-ancestry-unavailable", documentPath,
      `earliest governed implementation commit ${ordering.earliest_governed_implementation_commit} is not in this history`);
    return;
  }
  checkEarliestRelation(assessment.commit, earliest.commit, { cwd, documentPath, sink });

  const technical = resolveOptionalCommit(ordering.final_technical_commit, cwd);
  if (technical.invalid) {
    sink.fail("technical-commit-unresolvable", documentPath,
      `final technical commit ${ordering.final_technical_commit} is not in this history`);
    return;
  }
  checkTechnicalRelation(assessment.commit, technical.commit, { cwd, documentPath, sink });
  if (!isAncestor(baseline, assessment.commit, cwd)) {
    sink.fail("assessment-unrelated", documentPath,
      "the assessment commit is not a descendant of the proposal baseline");
  }
}

function resolveOptionalCommit(reference, cwd) {
  if (!reference) return { commit: null, invalid: false };
  const commit = resolveCommit(reference, cwd);
  if (commit !== null) return { commit, invalid: false };
  return { commit: null, invalid: true };
}

function checkAssessmentCommitPaths(assessmentCommit, { governedPatterns, cwd, documentPath, sink }) {
  // The assessment commit must not itself carry implementation. An assessment
  // that arrives with the code it approves has not preceded it.
  const assessmentPaths = pathsChangedByCommit(assessmentCommit, cwd) ?? [];
  if (!assessmentPaths.some((path) => matchesSelection(path, governedPatterns))) return;
  sink.fail("assessment-shares-implementation-commit", documentPath,
    "the assessment commit also changes a governed implementation path");
}

function checkEarliestRelation(assessmentCommit, earliest, { cwd, documentPath, sink }) {
  if (earliest === null) return;
  if (assessmentCommit === earliest) {
    sink.fail("assessment-shares-implementation-commit", documentPath,
      "the assessment commit and the earliest governed implementation commit are the same commit");
    return;
  }
  if (isAncestor(assessmentCommit, earliest, cwd)) return;
  sink.fail("assessment-follows-implementation", documentPath,
    "the assessment commit is not an ancestor of the earliest governed implementation commit");
}

function checkTechnicalRelation(assessmentCommit, technical, { cwd, documentPath, sink }) {
  if (technical === null || isAncestor(assessmentCommit, technical, cwd)) return;
  sink.fail("assessment-unrelated", documentPath,
    "the assessment commit is not an ancestor of the final technical commit");
}

/**
 * A retrospective exception is never inferred. The checker only reports that one
 * was claimed and that it reduces assurance; deciding it is a human act, and
 * making it inferable would turn "we could not reconstruct the order" into a
 * self-service waiver.
 */
export function reportRetrospectiveException(exception, documentPath, sink) {
  if (!exception) return false;
  sink.warn("retrospective-exception-in-effect", documentPath,
    `ordering rests on a human-owned retrospective exception recorded by ${exception.owner}; this is not equivalent assurance`);
  return true;
}
