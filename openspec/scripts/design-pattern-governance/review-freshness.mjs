/**
 * R15 — signed-review freshness.
 *
 * A signed governance record S binds an exact technical commit T. Any normative
 * change after T invalidates the binding, and only commits whose complete
 * changed-path set is governance-record-only (or the closed activation record)
 * may follow it. This verifier derives everything from repository history:
 * which record is current, which commit introduced those exact record bytes,
 * and which commits after T touched normative content. Nothing here consults
 * commit messages, task checkboxes, working-tree prose, or PR state, because
 * every one of those is the part an author controls.
 *
 * A change that has never been signed in any reachable commit remains a
 * legitimate pre-signing technical state. A change whose signed record was
 * removed after it existed is not — deleting the record does not rewind the
 * lifecycle.
 */

import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";

import {
  blobAt,
  commitsBetween,
  historyIsComplete,
  isAncestor,
  objectAtPath,
  pathsChangedByCommitIncludingMerges,
  resolveCommit,
  tryGit,
  splitLines,
} from "./git.mjs";
import { touchesNormativePath } from "./perimeter.mjs";
import { matchesAny } from "./paths.mjs";

const OBJECT_ID = /^[0-9a-f]{40}$/;
const HISTORY_UNAVAILABLE = Symbol("history-unavailable");
const ARCHIVE_ARTIFACTS = Object.freeze(["assessment.json", "proposal.md"]);

/**
 * @param {{ changeIds: Iterable<string>, allChangeIds?: Iterable<string>,
 *   repositoryRoot: string, cwd: string, policy: object, sink: object }} args
 */
export function verifySignedReviewFreshness({ changeIds, allChangeIds, repositoryRoot, cwd, policy, sink }) {
  const activeChanges = [...new Set(changeIds ?? [])].sort();
  // The dangling check must know about every active change, even when a
  // --change restriction scopes which changes get full verification; otherwise
  // a scoped run would report the other active changes' records as dangling.
  const knownChanges = new Set(allChangeIds ?? activeChanges);

  const prepared = prepareVerification(repositoryRoot, cwd, policy, sink);
  if (prepared === null) return;
  const { source, context } = prepared;

  // A signed record whose change id matches nothing active, nothing archived,
  // and nothing grandfathered is a dangling binding: renaming or deleting a
  // change directory would otherwise silently de-activate freshness for
  // everything the record binds.
  checkDanglingRecords(source, knownChanges, context);
  for (const changeId of activeChanges) {
    verifyChange(changeId, source, context);
  }
}

/** Loads and validates every input the verifier needs, or null with diagnostics. */
function prepareVerification(repositoryRoot, cwd, policy, sink) {
  const recordPath = requireRecordPath(policy, sink);
  if (recordPath === null) return null;
  const source = loadCommittedSource(repositoryRoot, recordPath, cwd, sink);
  if (source === null) return null;
  return { source, context: { repositoryRoot, cwd, policy, recordPath, sink } };
}

function loadCommittedSource(repositoryRoot, recordPath, cwd, sink) {
  const source = readRecordSource(repositoryRoot, recordPath, sink);
  if (source === null) return null;
  if (!isCommittedSource(source, recordPath, cwd, sink)) return null;
  if (!historyIsComplete(cwd)) {
    sink.fail("signed-review-history-unavailable", recordPath,
      "review freshness requires complete Git history; a shallow clone cannot prove what followed the signed record");
    return null;
  }
  return source;
}

/** The closed signed-record source path, or null with a diagnostic. */
function requireRecordPath(policy, sink) {
  const recordPath = policy.review_freshness?.record_path;
  if (typeof recordPath === "string" && recordPath.length > 0) return recordPath;
  // Policy loading validates this, but fail closed rather than assume the
  // caller passed validated policy.
  sink.fail("signed-record-source-absent", "review_freshness",
    "policy declares no signed-record source path; review freshness cannot be verified");
  return null;
}

function isCommittedSource(source, recordPath, cwd, sink) {
  const committed = blobAt("HEAD", recordPath, cwd);
  if (committed !== null && committed === source.text) return true;
  sink.fail("signed-record-uncommitted", recordPath,
    "the signed-record source differs from its committed HEAD blob; review freshness cannot be verified for uncommitted record bytes");
  return false;
}

function readRecordSource(repositoryRoot, recordPath, sink) {
  const text = readSourceText(repositoryRoot, recordPath, sink);
  if (text === null) return null;
  if (text.trim().length === 0) {
    sink.fail("signed-record-source-invalid", recordPath, "signed-record source has no content");
    return null;
  }
  return parseSourceManifest(text, recordPath, sink);
}

function readSourceText(repositoryRoot, recordPath, sink) {
  try {
    return readFileSync(resolve(repositoryRoot, recordPath), "utf8");
  } catch {
    sink.fail("signed-record-source-absent", recordPath,
      "signed-record source does not exist or is unreadable; absence never means no signed records");
    return null;
  }
}

function parseSourceManifest(text, recordPath, sink) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch (error) {
    sink.fail("signed-record-source-invalid", recordPath,
      `signed-record source did not parse: ${String(error?.message ?? error).slice(0, 160)}`);
    return null;
  }
  if (!hasManifestShape(parsed)) {
    sink.fail("signed-record-source-invalid", recordPath,
      "signed-record source must be an object with a governanceRecords array");
    return null;
  }
  return { text, records: parsed.governanceRecords };
}

function hasManifestShape(parsed) {
  return isRecordObject(parsed) && Array.isArray(parsed.governanceRecords);
}

function checkDanglingRecords(source, knownChanges, context) {
  const known = {
    active: knownChanges,
    archived: archivedChangeIds(context.repositoryRoot, context.cwd, context.sink),
    grandfathered: collectGrandfatheredIds(context.policy),
  };
  for (const record of source.records) {
    reportDanglingRecord(record, known, context);
  }
}

function collectGrandfatheredIds(policy) {
  return new Set(
    (policy.grandfathering ?? []).map((entry) => entry?.change).filter((change) => typeof change === "string"),
  );
}

function reportDanglingRecord(record, known, context) {
  if (!isRecordObject(record) || record.signed !== true) return;
  const changeId = record.change;
  if (typeof changeId !== "string" || changeId.length === 0) {
    context.sink.fail("signed-record-ambiguous", context.recordPath,
      "a signed governance record carries no valid change id");
    return;
  }
  if (isKnownChange(changeId, known)) return;
  context.sink.fail("signed-record-ambiguous", context.recordPath,
    `the signed record binds ${changeId}, which is neither an active change, nor a grandfathered change, nor present under openspec/changes/archive/; a signed binding whose change disappeared must not stay silent`);
}

function isKnownChange(changeId, known) {
  return known.active.has(changeId) || known.archived.has(changeId) || known.grandfathered.has(changeId);
}

/**
 * Change ids present as directories under openspec/changes/archive/.
 *
 * Only an archive that carries the change's own relocated artifacts counts: the
 * archived artifact's object must be the object history carried at the active
 * change path, which is the byte-identical relocation property R15 preserves.
 * An empty decoy directory, or one whose planted content differs from what
 * history carried, is exactly the trick that would re-open the dangling-binding
 * hole this check closes. A byte-for-byte copy of a real historical artifact is
 * indistinguishable from a genuine relocation at this level; archive-movement
 * attestations remain the higher authority for that residual.
 */
function archivedChangeIds(repositoryRoot, cwd, sink) {
  const ids = new Set();
  for (const entry of archiveDirectoryEntries(repositoryRoot)) {
    // Archive directories carry a leading date: 2026-08-13-right-size-change-governance.
    const id = entry.name.replace(/^\d{4}-\d{2}-\d{2}-/, "");
    if (id.length === 0) continue;
    if (carriesRelocatedArtifact(entry.name, id, cwd, sink)) ids.add(id);
  }
  return ids;
}

function archiveDirectoryEntries(repositoryRoot) {
  let entries;
  try {
    entries = readdirSync(resolve(repositoryRoot, "openspec/changes/archive"), { withFileTypes: true });
  } catch {
    return [];
  }
  // Sorted for strict determinism: membership is order-independent, but the
  // rare multi-archive history-failure diagnostic order must not vary by machine.
  entries.sort((left, right) => (left.name < right.name ? -1 : left.name > right.name ? 1 : 0));
  return entries.filter((entry) => entry.isDirectory());
}

/** Whether an archived artifact is the exact object history carried at the active path. */
function carriesRelocatedArtifact(archiveName, id, cwd, sink) {
  const archivedPath = `openspec/changes/archive/${archiveName}`;
  for (const artifact of ARCHIVE_ARTIFACTS) {
    const relocated = artifactWasRelocated(archivedPath, id, artifact, cwd, sink);
    if (relocated === HISTORY_UNAVAILABLE) return false;
    if (relocated) return true;
  }
  return false;
}

function artifactWasRelocated(archivedPath, id, artifact, cwd, sink) {
  const archivedObject = objectAtPath("HEAD", `${archivedPath}/${artifact}`, cwd);
  if (archivedObject === null) return false;
  const activePath = `openspec/changes/${id}/${artifact}`;
  const carried = historyCarriesObjectAt(activePath, archivedObject, cwd);
  if (carried === null) {
    sink.fail("signed-review-history-unavailable", archivedPath,
      `cannot enumerate the history of ${activePath}; archive relocation cannot be verified`);
    return HISTORY_UNAVAILABLE;
  }
  return carried;
}

/** True when some commit reachable from HEAD carried `object` at `path`; null when history is unreadable. */
function historyCarriesObjectAt(path, object, cwd) {
  const touched = tryGit(["rev-list", "HEAD", "--", path], { cwd });
  if (!touched.ok) return null;
  for (const commit of splitLines(touched.value)) {
    if (objectAtPath(commit, path, cwd) === object) return true;
  }
  return false;
}

function verifyChange(changeId, source, context) {
  const signed = source.records.filter((record) => isSignedRecordFor(record, changeId));
  if (signed.length === 0) {
    verifyUnsignedChange(changeId, context);
    return;
  }
  if (signed.length > 1) {
    context.sink.fail("signed-record-ambiguous", context.recordPath,
      `${changeId} declares ${signed.length} signed governance records; exactly one current signed record may bind a change`);
    return;
  }
  verifyBinding(changeId, signed[0], context);
}

function verifyUnsignedChange(changeId, context) {
  if (!historyCarriesSignedRecord(changeId, context)) return;
  context.sink.fail("signed-record-removed", context.recordPath,
    `no current signed governance record binds ${changeId}, but reachable history previously carried one; removing a signed record does not restore the unsigned state`);
}

function verifyBinding(changeId, record, context) {
  const technical = requireAncestorTechnicalCommit(changeId, record, context);
  if (technical === null) return;

  const range = commitsBetween(technical, "HEAD", context.cwd);
  if (range === null) {
    context.sink.fail("signed-review-history-unavailable", context.recordPath,
      `cannot enumerate commits between ${technical} and HEAD`);
    return;
  }

  const currentBlob = objectAtPath("HEAD", context.recordPath, context.cwd);
  const signedCommit = locateSignedCommit(range, currentBlob, technical, context);
  if (signedCommit === null) return;
  if (!checkNoNarrowing(changeId, record, currentBlob, context)) return;

  scanPostTechnicalCommits(signedCommit, range, context);
}

/** Returns the bound technical commit, or null after raising a diagnostic. */
function requireAncestorTechnicalCommit(changeId, record, context) {
  const technical = wellFormedTechnical(changeId, record, context);
  if (technical === null) return null;
  if (!resolvesInRepository(technical, changeId, context)) return null;
  if (!isAncestor(technical, "HEAD", context.cwd)) {
    context.sink.fail("signed-review-history-unavailable", context.recordPath,
      `reviewedCommit ${technical} for ${changeId} is not an ancestor of HEAD; the signed record cannot be ordered against its own history`);
    return null;
  }
  return technical;
}

function wellFormedTechnical(changeId, record, { recordPath, sink }) {
  const technical = record.reviewedCommit;
  if (typeof technical === "string" && OBJECT_ID.test(technical)) return technical;
  sink.fail("signed-review-history-unavailable", recordPath,
    `the signed record for ${changeId} does not name a well-formed reviewedCommit`);
  return null;
}

function resolvesInRepository(technical, changeId, { cwd, recordPath, sink }) {
  if (resolveCommit(technical, cwd) !== null) return true;
  sink.fail("signed-review-history-unavailable", recordPath,
    `reviewedCommit ${technical} for ${changeId} does not resolve in this repository`);
  return false;
}

/** The first commit after T carrying the current record bytes, or null after a diagnostic. */
function locateSignedCommit(range, currentBlob, technical, { recordPath, cwd, sink }) {
  for (const commit of range) {
    if (objectAtPath(commit, recordPath, cwd) === currentBlob) return commit;
  }
  sink.fail("signed-review-history-unavailable", recordPath,
    `no commit after ${technical} introduces the current signed-record bytes; a record binding T that predates T cannot order the review`);
  return null;
}

/**
 * Rejects re-binding the same technical commit with a narrower reviewed-content
 * set than a prior signed record declared for that commit.
 */
function checkNoNarrowing(changeId, record, currentBlob, context) {
  const prior = priorSignedRecord(changeId, currentBlob, context);
  if (prior === HISTORY_UNAVAILABLE) return false;
  if (prior === null) return true;
  return requireNoNarrowing(changeId, record, prior, context);
}

function requireNoNarrowing(changeId, record, prior, { recordPath, sink }) {
  if (prior.reviewedCommit !== record.reviewedCommit) return true;
  if (coversReviewedContent(record, prior)) return true;
  sink.fail("signed-record-ambiguous", recordPath,
    `the current signed record for ${changeId} narrows the reviewed content of an earlier record for the same reviewedCommit ${record.reviewedCommit}; re-binding the same technical commit with fewer content objects is not a fresh review`);
  return false;
}

/**
 * Every commit after T must be governance-record-only. The activation record is
 * excluded: it is a closed artifact with its own dedicated allowlist whose
 * exactness bootstrap and activation verification enforce (R17-R18).
 */
function scanPostTechnicalCommits(signedCommit, range, context) {
  for (const commit of range) {
    const paths = pathsChangedByCommitIncludingMerges(commit, context.cwd);
    if (paths === null) {
      context.sink.fail("signed-review-history-unavailable", commit,
        "cannot enumerate the paths a commit changed after the signed record");
      return;
    }
    reportStalePaths(paths, commit, signedCommit, context);
  }
}

function reportStalePaths(paths, commit, signedCommit, { policy, sink }) {
  const permitted = [
    ...(policy.governance_record_only_paths ?? []),
    ...(policy.activation?.record_path ? [policy.activation.record_path] : []),
  ];
  for (const path of paths) {
    if (matchesAny(path, permitted)) continue;
    if (touchesNormativePath([path], policy)) {
      sink.fail("signed-review-stale", path,
        `commit ${commit} changed ${path} after signed record ${signedCommit}; the signed review is stale; re-sign a new technical commit`);
    }
  }
}

/**
 * The most recent signed record for a change whose raw bytes differ from the
 * current record blob, or null when none exists. Used to reject narrowing a
 * binding while claiming the same reviewed commit.
 */
function priorSignedRecord(changeId, currentBlob, { recordPath, cwd, sink }) {
  const touched = tryGit(["rev-list", "HEAD", "--", recordPath], { cwd });
  if (!touched.ok) {
    sink.fail("signed-review-history-unavailable", recordPath,
      "cannot enumerate commits that touched the signed-record source");
    return HISTORY_UNAVAILABLE;
  }
  for (const commit of splitLines(touched.value)) {
    if (objectAtPath(commit, recordPath, cwd) === currentBlob) continue;
    const prior = signedRecordInManifestAt(commit, recordPath, changeId, cwd, sink);
    if (prior === HISTORY_UNAVAILABLE) return HISTORY_UNAVAILABLE;
    if (prior !== null) return prior;
  }
  return null;
}

function signedRecordInManifestAt(commit, recordPath, changeId, cwd, sink) {
  const parsed = parseHistoricalManifest(commit, recordPath, cwd, sink);
  if (parsed === HISTORY_UNAVAILABLE) return HISTORY_UNAVAILABLE;
  if (parsed === null) return null;
  const signed = parsed.governanceRecords.filter((record) => isSignedRecordFor(record, changeId));
  return signed.length > 0 ? signed[signed.length - 1] : null;
}

function historyCarriesSignedRecord(changeId, { recordPath, cwd, sink }) {
  const touched = tryGit(["rev-list", "HEAD", "--", recordPath], { cwd });
  if (!touched.ok) {
    sink.fail("signed-review-history-unavailable", recordPath,
      "cannot enumerate commits that touched the signed-record source; a removed record cannot be distinguished from a never-existing one");
    return true;
  }
  for (const commit of splitLines(touched.value)) {
    if (manifestCarriesRecord(commit, changeId, { recordPath, cwd, sink })) return true;
  }
  return false;
}

/**
 * Whether a historical manifest carries a signed record for the change. An
 * unreadable manifest counts as carrying one, so a broken history fails closed
 * on the removed-record path rather than reading as never signed.
 */
function manifestCarriesRecord(commit, changeId, { recordPath, cwd, sink }) {
  const parsed = parseHistoricalManifest(commit, recordPath, cwd, sink);
  if (parsed === HISTORY_UNAVAILABLE) return true;
  if (parsed === null) return false;
  return parsed.governanceRecords.some((record) => isSignedRecordFor(record, changeId));
}

/**
 * Parses a historical manifest blob. Null means the path carried no parseable
 * manifest; HISTORY_UNAVAILABLE means the bytes could not be read as history at
 * all — an unreadable historical manifest cannot be silently treated as
 * carrying no binding.
 */
function parseHistoricalManifest(commit, recordPath, cwd, sink) {
  const text = blobAt(commit, recordPath, cwd);
  if (text === null) return null;
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    sink.fail("signed-review-history-unavailable", commit,
      `a historical signed-record source did not parse; prior bindings cannot be reconstructed`);
    return HISTORY_UNAVAILABLE;
  }
  if (!hasManifestShape(parsed)) return null;
  return parsed;
}

function isSignedRecordFor(record, changeId) {
  return isRecordObject(record) && record.change === changeId && record.signed === true;
}

function isRecordObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Whether `current` binds at least every reviewed path `prior` bound. */
function coversReviewedContent(current, prior) {
  const priorEntries = prior.reviewedContent?.entries;
  if (!Array.isArray(priorEntries)) return true;
  const currentEntries = current.reviewedContent?.entries;
  if (!Array.isArray(currentEntries)) return false;
  const currentPaths = new Set(currentEntries.map((entry) => entry?.path).filter(Boolean));
  return priorEntries.every((entry) => currentPaths.has(entry?.path));
}
