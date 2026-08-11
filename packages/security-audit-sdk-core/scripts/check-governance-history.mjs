import { byCodePoint, git } from "./verification-helpers.mjs";
import { boundedFailure, lifecycleMetadata } from "./lifecycle-policy.mjs";

const OBJECT_ID = /^[0-9a-f]{40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const failures = [];
const verified = { governed: 0, bound: 0, merges: 0, content: 0 };
const records = lifecycleMetadata.governanceRecords;

if (records === undefined) {
  fail("governance-manifest-missing", "verification-lifecycle.json", "governanceRecords is absent; governance bindings must be declared as structured data");
} else if (!Array.isArray(records) || records.length === 0) {
  fail("governance-manifest-missing", "verification-lifecycle.json", `governanceRecords must be a non-empty array, found ${describe(records)}`);
} else {
  for (const [index, record] of records.entries()) checkRecord(record, labelFor(record, index));
}

if (failures.length > 0) {
  const lines = failures.map((failure) => `[${failure.id}] ${failure.file}: ${failure.message}`);
  throw new Error(`governance merge and history integrity failed:\n${[...new Set(lines)].sort(byCodePoint).join("\n")}`);
}

process.stdout.write(
  `governance history passed: ${records.length} record(s); ${verified.governed} governed commit(s) resolve; ${verified.bound} bound commit(s) are ancestors of HEAD; ${verified.merges} declared merge commit(s) have their expected parent count; ${verified.content} reviewed content object(s) resolve to a tree\n`,
);

function fail(id, label, message) {
  failures.push(boundedFailure(id, label, message));
}

function checkRecord(record, label) {
  if (!isPlainObject(record)) {
    fail("governance-record-shape", label, `record must be an object, found ${describe(record)}`);
    return;
  }
  if (!isNonEmptyString(record.change)) {
    fail("governance-record-shape", label, "change must be a non-empty string naming the governed change");
  }
  checkCommitList(label, record, "governedCommits", false);
  checkCommitList(label, record, "boundCommits", true);
  checkMergeCommits(label, record);
  checkReviewedContent(label, record);
  checkReviewedCommit(label, record);
  checkAuthorizations(label, record);
  checkSignature(label, record);
}

// Every declared commit must resolve. Bound commits carry the stronger property:
// they must still be reachable from HEAD, which is what a squash merge silently
// breaks and what no prose review has ever caught here.
function checkCommitList(label, record, field, requireAncestor) {
  const value = record[field];
  if (value === undefined && !requireAncestor) return;
  if (!Array.isArray(value)) {
    fail("governance-record-shape", label, `${field} must be an array of full Git commits, found ${describe(value)}`);
    return;
  }
  for (const [index, commit] of value.entries()) {
    if (!checkDeclaredCommit(label, `${field}[${index}]`, commit, requireAncestor)) continue;
    if (requireAncestor) verified.bound += 1;
    else verified.governed += 1;
  }
}

function checkDeclaredCommit(label, property, commit, requireAncestor) {
  if (!isObjectId(commit)) {
    fail("governance-commit-format", label, `${property} must be a full 40-character lowercase hexadecimal Git commit, found ${describe(commit)}`);
    return false;
  }
  if (!commitResolves(commit)) {
    fail("governance-commit-unresolvable", label, `${property} ${commit} does not resolve to a commit in this repository`);
    return false;
  }
  if (requireAncestor && !isAncestorOfHead(commit)) {
    fail("governance-commit-not-ancestor", label, `${property} ${commit} is not an ancestor of HEAD: expected reachable from HEAD, found unreachable`);
    return false;
  }
  return true;
}

function checkMergeCommits(label, record) {
  const value = record.mergeCommits;
  if (!Array.isArray(value)) {
    fail("governance-record-shape", label, `mergeCommits must be an array, empty when the change declares no merge commit, found ${describe(value)}`);
    return;
  }
  for (const [index, entry] of value.entries()) {
    if (checkMergeCommit(label, `mergeCommits[${index}]`, entry)) verified.merges += 1;
  }
}

function checkMergeCommit(label, property, entry) {
  if (!hasMergeCommitShape(entry)) {
    fail("governance-record-shape", label, `${property} must be an object with a full Git commit and an expectedParents integer of at least 1, found ${describe(entry)}`);
    return false;
  }
  if (!commitResolves(entry.commit)) {
    fail("governance-commit-unresolvable", label, `${property}.commit ${entry.commit} does not resolve to a commit in this repository`);
    return false;
  }
  const actualParents = parentCount(entry.commit);
  if (actualParents !== entry.expectedParents) {
    fail("governance-merge-parent-count", label, `${property} ${entry.commit}: expected ${entry.expectedParents} parents, found ${actualParents}`);
    return false;
  }
  return true;
}

// A tree identifier survives squash merge, rebase, and cherry-pick, and can be
// named by a later commit without the self-reference a commit hash would need.
function checkReviewedContent(label, record) {
  const value = record.reviewedContent;
  if (value === undefined) return;
  if (!hasReviewedContentShape(value)) {
    fail("governance-record-shape", label, `reviewedContent must be an object with kind "tree", a repository-relative path, and a full object id, found ${describe(value)}`);
    return;
  }
  const type = objectType(value.object);
  if (type === null) {
    fail("governance-content-object-unresolvable", label, `reviewedContent.object ${value.object} does not resolve to an object in this repository`);
    return;
  }
  if (type !== "tree") {
    fail("governance-content-object-not-tree", label, `reviewedContent.object ${value.object}: expected object type tree, found ${type}`);
    return;
  }
  verified.content += 1;
}

function checkReviewedCommit(label, record) {
  const value = record.reviewedCommit;
  if (value === undefined) return;
  if (!isObjectId(value)) {
    fail("governance-commit-format", label, `reviewedCommit must be a full 40-character lowercase hexadecimal Git commit, found ${describe(value)}`);
    return;
  }
  if (!commitResolves(value)) {
    fail("governance-commit-unresolvable", label, `reviewedCommit ${value} does not resolve to a commit in this repository`);
  }
}

function checkAuthorizations(label, record) {
  const value = record.authorizations;
  if (!isPlainObject(value)) {
    fail("governance-authorization-missing", label, `authorizations must be an object with granted and withheld arrays, found ${describe(value)}`);
    return;
  }
  for (const field of ["granted", "withheld"]) {
    if (isStringArray(value[field])) continue;
    fail("governance-authorization-missing", label, `authorizations.${field} must be an array of non-empty strings, found ${describe(value[field])}`);
  }
  if (isEmptyArray(value.withheld)) {
    fail("governance-authorization-missing", label, "authorizations.withheld must state what remains unauthorized; an empty list asserts unlimited authorization");
  }
}

function checkSignature(label, record) {
  if (typeof record.signed !== "boolean") {
    fail("governance-record-shape", label, `signed must be a boolean, found ${describe(record.signed)}`);
    return;
  }
  if (!isNonEmptyStringArray(record.assuranceLimitations)) {
    fail("governance-record-shape", label, `assuranceLimitations must be a non-empty array of strings, found ${describe(record.assuranceLimitations)}`);
  }
  if (record.signed) checkSignedRecord(label, record);
  else if (record.reviewer !== undefined) fail("governance-record-shape", label, "an unsigned record must not name a reviewer");
}

// A signed record binds a content object. The one exception is a record archived
// before content-object binding existed, which must say so rather than silently
// fall back to a commit hash the requirement rejects.
function checkSignedRecord(label, record) {
  if (!hasReviewerShape(record.reviewer)) {
    fail("governance-reviewer-missing", label, `a signed record must name reviewer.name and an ISO reviewer.signedAt date, found ${describe(record.reviewer)}`);
  }
  if (bindsReviewedContent(record)) return;
  fail(
    "governance-content-binding-missing",
    label,
    "a signed record must bind reviewedContent, or declare legacyCommitBinding with a legacyReason; a commit hash alone is not an accepted binding",
  );
}

function bindsReviewedContent(record) {
  if (record.reviewedContent !== undefined) return true;
  if (record.legacyCommitBinding !== true) return false;
  return isNonEmptyString(record.legacyReason);
}

function hasMergeCommitShape(entry) {
  if (!isPlainObject(entry)) return false;
  if (!isObjectId(entry.commit)) return false;
  if (!Number.isInteger(entry.expectedParents)) return false;
  return entry.expectedParents >= 1;
}

function hasReviewedContentShape(value) {
  if (!isPlainObject(value)) return false;
  if (value.kind !== "tree") return false;
  if (!isNonEmptyString(value.path)) return false;
  return isObjectId(value.object);
}

function hasReviewerShape(reviewer) {
  if (!isPlainObject(reviewer)) return false;
  if (!isNonEmptyString(reviewer.name)) return false;
  return isIsoDate(reviewer.signedAt);
}

function labelFor(record, index) {
  if (!isPlainObject(record)) return `governanceRecords[${index}]`;
  if (!isNonEmptyString(record.change)) return `governanceRecords[${index}]`;
  return record.change;
}

function isPlainObject(value) {
  if (value === null) return false;
  if (Array.isArray(value)) return false;
  return typeof value === "object";
}

function isNonEmptyString(value) {
  if (typeof value !== "string") return false;
  return value.length > 0;
}

function isObjectId(value) {
  if (typeof value !== "string") return false;
  return OBJECT_ID.test(value);
}

function isIsoDate(value) {
  if (typeof value !== "string") return false;
  return ISO_DATE.test(value);
}

function isStringArray(value) {
  if (!Array.isArray(value)) return false;
  return value.every(isNonEmptyString);
}

function isNonEmptyStringArray(value) {
  if (!isStringArray(value)) return false;
  return value.length > 0;
}

function isEmptyArray(value) {
  if (!Array.isArray(value)) return false;
  return value.length === 0;
}

function commitResolves(commit) {
  return quietGit(["rev-parse", "--verify", "--quiet", `${commit}^{commit}`]) !== null;
}

function isAncestorOfHead(commit) {
  return quietGit(["merge-base", "--is-ancestor", commit, "HEAD"]) !== null;
}

function parentCount(commit) {
  return git(["rev-list", "--parents", "-n", "1", commit]).trim().split(/\s+/).filter(Boolean).length - 1;
}

function objectType(object) {
  return quietGit(["cat-file", "-t", object])?.trim() ?? null;
}

// Git reports "this is not true" as a non-zero exit, which the shared helper
// raises. These probes ask questions whose negative answer is a finding rather
// than an error, so a rejection is caught and reported as null — the same
// shape check-git-state.mjs uses for its empty-index probe.
function quietGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function describe(value) {
  if (value === undefined) return "nothing";
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (typeof value === "object") return "an object";
  return JSON.stringify(value);
}
