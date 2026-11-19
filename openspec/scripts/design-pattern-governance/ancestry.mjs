/**
 * Assessment ordering, proven by Git ancestry.
 *
 * "Assess before you implement" is only a rule if it is checkable after the fact,
 * and the only after-the-fact evidence that cannot be rewritten by the author is
 * the commit graph. Every question here is answered from ancestry; none is
 * answered from a field the evidence declares about itself.
 *
 * A change's assessment commit — its anchor — is the oldest commit reachable from
 * the checked head that adds its `assessment.json`. Ordering is judged over the
 * reviewed range, one change at a time, and only over the governed commits that
 * change owns: another change's commit on the shared mainline is never this
 * change's implementation, which is why nothing here walks forward from a
 * proposal baseline. Commits an assessment records about itself are optional,
 * and each one present is checked against the anchor rather than used in its
 * place.
 *
 * Where ancestry cannot be established — a shallow clone, a missing commit — the
 * answer is a failure, never an assumption that the ordering was fine.
 */

import { blobAt, historyIsComplete, isAncestor, parentsOf, pathsChangedByCommit, resolveCommit, splitLines, tryGit } from "./git.mjs";
import { matchesAny, matchesSelection } from "./paths.mjs";

/**
 * Assessment fields whose edits after implementation are evidence or scope
 * bookkeeping rather than a changed decision: the ordering record, invariant
 * evidence, verification task identifiers and owned paths. Everything else is
 * the decision the implementation was approved against.
 */
const BOOKKEEPING_FIELDS = Object.freeze(["ordering", "invariant_evidence", "verification_task_ids", "owned_paths"]);

const assessmentPathFor = (changeId) => `openspec/changes/${changeId}/assessment.json`;

export function requireCompleteHistory(cwd, sink) {
  if (historyIsComplete(cwd)) return true;
  sink.fail("activation-history-unavailable", ".",
    "the clone is shallow; ancestry cannot be proven and absent history never reads as satisfied ordering");
  return false;
}

/**
 * The anchor of a change: the oldest commit reachable from `head` that adds its
 * assessment. `undefined` when history cannot be read, `null` when no such
 * commit exists. Never read from the assessment.
 */
function findAssessmentAnchor(changeId, head, cwd) {
  const result = tryGit(["log", "--diff-filter=A", "--reverse", "--format=%H", head, "--", assessmentPathFor(changeId)], { cwd });
  if (!result.ok) return undefined;
  return splitLines(result.value)[0] ?? null;
}

/**
 * Recorded ordering, checked in every phase.
 *
 * The relations between recorded commits stay as they were. On top of them,
 * every recorded commit is checked against the anchor derived from history, so
 * a record can describe the ordering but never substitute for it.
 */
export function verifyAssessmentOrdering(ordering, options) {
  const { cwd, documentPath, sink } = options;
  if (!requireCompleteHistory(cwd, sink)) return;

  const baseline = resolveCommit(ordering.proposal_baseline_commit, cwd);
  if (baseline === null) {
    sink.fail("proposal-baseline-unresolvable", documentPath,
      `proposal baseline ${ordering.proposal_baseline_commit} is not a commit in this history`);
    return;
  }

  const recorded = resolveRecordedOrdering(ordering, { cwd, documentPath, sink });
  if (recorded === null) return;
  if (recorded.assessment !== null) checkRecordedRelations(recorded, baseline, options);
  checkRecordAgainstHistory(recorded, options);
}

function resolveRecordedOrdering(ordering, { cwd, documentPath, sink }) {
  const fields = [
    ["assessment", ordering.assessment_commit, "assessment-commit-unresolvable",
      `assessment commit ${ordering.assessment_commit} is not a commit in this history`],
    ["earliest", ordering.earliest_governed_implementation_commit, "implementation-ancestry-unavailable",
      `earliest governed implementation commit ${ordering.earliest_governed_implementation_commit} is not in this history`],
    ["technical", ordering.final_technical_commit, "technical-commit-unresolvable",
      `final technical commit ${ordering.final_technical_commit} is not in this history`],
  ];
  const recorded = {};
  for (const [name, reference, id, message] of fields) {
    const resolved = resolveOptionalCommit(reference, cwd);
    if (resolved.invalid) {
      sink.fail(id, documentPath, message);
      return null;
    }
    recorded[name] = resolved.commit;
  }
  return recorded;
}

function resolveOptionalCommit(reference, cwd) {
  if (!reference) return { commit: null, invalid: false };
  const commit = resolveCommit(reference, cwd);
  if (commit !== null) return { commit, invalid: false };
  return { commit: null, invalid: true };
}

function checkRecordedRelations(recorded, baseline, { governedPatterns, cwd, documentPath, sink }) {
  checkAssessmentCommitPaths(recorded.assessment, { governedPatterns, cwd, documentPath, sink });
  checkEarliestRelation(recorded.assessment, recorded.earliest, { cwd, documentPath, sink });
  checkTechnicalRelation(recorded.assessment, recorded.technical, { cwd, documentPath, sink });
  if (!isAncestor(baseline, recorded.assessment, cwd)) {
    sink.fail("assessment-unrelated", documentPath,
      "the assessment commit is not a descendant of the proposal baseline");
  }
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
 * Consistency, not equality: a recorded assessment commit may be a later edit
 * made before implementation, so it must touch the assessment and descend from
 * the anchor rather than equal it.
 */
function checkRecordAgainstHistory(recorded, { changeId, ownedPaths, governedPatterns, cwd, documentPath, sink }) {
  if (Object.values(recorded).every((commit) => commit === null)) return;
  const anchor = findAssessmentAnchor(changeId, "HEAD", cwd);
  if (anchor === undefined) {
    sink.fail("history-unavailable", documentPath, `cannot read the history of ${assessmentPathFor(changeId)}`);
    return;
  }
  const report = (message) => sink.fail("assessment-ordering-record-inconsistent", documentPath, message);
  if (anchor === null) {
    if (recorded.assessment !== null) report("an assessment commit is recorded, but no commit adding the assessment is reachable");
    return;
  }
  const scope = { changeId, ownedPaths, governedPatterns, cwd };
  const problems = [
    recorded.assessment && assessmentCommitProblem(recorded.assessment, anchor, scope),
    recorded.earliest && earliestCommitProblem(recorded.earliest, anchor, scope),
    recorded.technical && technicalCommitProblem(recorded.technical, anchor, cwd),
  ];
  for (const problem of problems.filter(Boolean)) report(problem);
}

function assessmentCommitProblem(commit, anchor, { changeId, governedPatterns, cwd }) {
  const paths = pathsChangedByCommit(commit, cwd) ?? [];
  if (!paths.includes(assessmentPathFor(changeId))) {
    return `the recorded assessment commit ${short(commit)} does not change the assessment`;
  }
  if (!isAncestor(anchor, commit, cwd)) {
    return `the recorded assessment commit ${short(commit)} precedes ${short(anchor)}, the first commit adding the assessment`;
  }
  if (paths.some((path) => matchesSelection(path, governedPatterns))) {
    return `the recorded assessment commit ${short(commit)} changes a governed implementation path`;
  }
  return null;
}

function earliestCommitProblem(commit, anchor, scope) {
  if (!ownsGovernedPath(pathsChangedByCommit(commit, scope.cwd) ?? [], scope)) {
    return `the recorded earliest implementation commit ${short(commit)} changes no governed path the change owns`;
  }
  if (commit === anchor || !isAncestor(anchor, commit, scope.cwd)) {
    return `the recorded earliest implementation commit ${short(commit)} does not follow the assessment commit ${short(anchor)}`;
  }
  return null;
}

function technicalCommitProblem(commit, anchor, cwd) {
  if (isAncestor(anchor, commit, cwd)) return null;
  return `the recorded final technical commit ${short(commit)} does not descend from the assessment commit ${short(anchor)}`;
}

function ownsGovernedPath(paths, { ownedPaths, governedPatterns }) {
  return paths.some((path) => matchesSelection(path, governedPatterns) && matchesAny(path, ownedPaths));
}

/**
 * Derived ordering over the reviewed range, run at the final phase.
 *
 * `changes` is the association's own list, so ordering and association agree
 * about which change owns a path. A relocated change owns only its archive and
 * is not judged here; a change with no assessment, or with a retrospective
 * exception, is skipped as it always was. Every other change's owned governed
 * commits must descend strictly from its anchor, except that a commit several
 * changes own passes when any owner's anchor strictly precedes it.
 */
export function verifyDerivedOrdering({ range, head, changes, relocated, readAssessment, governedPatterns, cwd, sink }) {
  const judged = judgedChanges({ range, head, changes, relocated, readAssessment, governedPatterns, cwd, sink });
  if (judged === null) return;

  reportMissingAnchors(judged, sink);
  checkOwnedCommits(judged, range, cwd, sink);
  for (const change of judged) {
    checkAmendments(change, range, cwd, sink);
    checkRecordAgainstRange(change, cwd, sink);
  }
}

/**
 * A change that owns a governed commit in the range but has no commit adding
 * its assessment fails closed, whatever the commit's other owners show: the
 * several-owner rule relaxes the order of assessments that exist, never their
 * absence.
 */
function reportMissingAnchors(judged, sink) {
  for (const change of judged.filter((candidate) => candidate.anchor === null && candidate.ownedCommits.length > 0)) {
    sink.fail("assessment-anchor-missing", change.path,
      `${change.id} owns governed commit ${short(change.ownedCommits[0])} in the range, but no commit adding its assessment is reachable`);
  }
}

/** Each owned governed commit passes when the anchor of at least one owner that has one strictly precedes it. */
function checkOwnedCommits(judged, range, cwd, sink) {
  const anchored = judged.filter((change) => change.anchor !== null);
  for (const commit of range.commits) {
    const owners = anchored.filter((change) => change.ownedCommits.includes(commit));
    if (owners.length === 0 || owners.some((owner) => strictlyPrecedes(owner.anchor, commit, cwd))) continue;
    for (const owner of owners) reportUnprecededCommit(owner, commit, sink);
  }
}

function judgedChanges({ range, head, changes, relocated, readAssessment, governedPatterns, cwd, sink }) {
  const judged = [];
  for (const change of changes) {
    if (relocated.has(change.id)) continue;
    const document = readAssessment(change.id);
    if (document === null || document.retrospective_exception) continue;
    const anchor = findAssessmentAnchor(change.id, head, cwd);
    if (anchor === undefined) {
      sink.fail("history-unavailable", assessmentPathFor(change.id), `cannot read the history of ${assessmentPathFor(change.id)}`);
      return null;
    }
    const scope = { ownedPaths: change.ownedPaths, governedPatterns };
    const ownedCommits = range.commits.filter((commit) => ownsGovernedPath(range.perCommit.get(commit) ?? [], scope));
    judged.push({ id: change.id, document, anchor, ownedCommits, path: assessmentPathFor(change.id) });
  }
  return judged;
}

function strictlyPrecedes(anchor, commit, cwd) {
  return anchor !== null && anchor !== commit && isAncestor(anchor, commit, cwd);
}

function reportUnprecededCommit(owner, commit, sink) {
  if (owner.anchor === commit) {
    sink.fail("assessment-shares-implementation-commit", owner.path,
      `commit ${short(commit)} adds ${owner.id}'s assessment together with a governed path it owns`);
  } else {
    sink.fail("assessment-follows-implementation", owner.path,
      `${owner.id}'s governed commit ${short(commit)} does not descend from its assessment commit ${short(owner.anchor)}`);
  }
}

/**
 * Within the range, the decision an implementation was approved against cannot
 * change after that implementation. An amendment in a later range, once the
 * implementation has merged, is not tied back here: R10 states that limit.
 */
function checkAmendments(change, range, cwd, sink) {
  if (change.ownedCommits.length === 0) return;
  for (const commit of range.commits) {
    if (!changesDecision(commit, change.path, range, cwd)) continue;
    const implementation = change.ownedCommits.find((owned) => owned !== commit && isAncestor(owned, commit, cwd));
    if (implementation === undefined) continue;
    sink.fail("assessment-amended-after-implementation", change.path,
      `commit ${short(commit)} changes ${change.id}'s assessment after its governed commit ${short(implementation)} in the same range`);
  }
}

/**
 * Whether `commit` changes the assessment's decision content against its first
 * parent. Adding the assessment does; deleting it, which is the archive move,
 * does not.
 */
function changesDecision(commit, path, range, cwd) {
  if (!(range.perCommit.get(commit) ?? []).includes(path)) return false;
  const after = blobAt(commit, path, cwd);
  if (after === null) return false;
  const [parent] = parentsOf(commit, cwd) ?? [];
  const before = parent ? blobAt(parent, path, cwd) : null;
  return before === null || decisionContent(before) !== decisionContent(after);
}

/** The assessment as text, with the top-level bookkeeping fields left out. */
function decisionContent(text) {
  try {
    const document = JSON.parse(text);
    return JSON.stringify(document, function omitBookkeeping(key, value) {
      return this === document && BOOKKEEPING_FIELDS.includes(key) ? undefined : value;
    });
  } catch {
    return `text:${text}`;
  }
}

/**
 * The two recorded-field checks that need the range: a recorded assessment
 * commit precedes every governed commit the change owns in it, and no such
 * commit precedes a recorded earliest implementation commit.
 */
function checkRecordAgainstRange(change, cwd, sink) {
  const ordering = change.document.ordering ?? {};
  const report = (message) => sink.fail("assessment-ordering-record-inconsistent", change.path, message);
  const assessment = resolveRecorded(ordering.assessment_commit, cwd);
  const unpreceded = assessment && change.ownedCommits.find((owned) => !strictlyPrecedes(assessment, owned, cwd));
  if (unpreceded) {
    report(`the recorded assessment commit ${short(assessment)} does not precede governed commit ${short(unpreceded)}`);
  }
  const earliest = resolveRecorded(ordering.earliest_governed_implementation_commit, cwd);
  const earlier = earliest && change.ownedCommits.find((owned) => strictlyPrecedes(owned, earliest, cwd));
  if (earlier) {
    report(`the recorded earliest implementation commit ${short(earliest)} follows governed commit ${short(earlier)}`);
  }
}

const resolveRecorded = (reference, cwd) => (reference ? resolveCommit(reference, cwd) : null);
const short = (commit) => String(commit).slice(0, 12);

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
