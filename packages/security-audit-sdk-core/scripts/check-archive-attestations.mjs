import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { byCodePoint, git, repositoryRoot } from "./verification-helpers.mjs";
import { boundedFailure, lifecycleMetadata } from "./lifecycle-policy.mjs";
import { repositoryPathProblem } from "./repository-path.mjs";
import { gitTreeInventory, workingTreeInventory } from "./archive-inventory.mjs";

/**
 * Anchors every declared archive-movement attestation in version-control history.
 *
 * A movement attestation records, for one archived directory, the file mode and
 * content object of every archived path. `check-changed-paths.mjs` compares an
 * archive against the active change it replaced, and falls back to those recorded
 * objects when the pre-archive revision has been squashed away. That fallback has
 * a hole this gate closes: the archive and the attestation are both mutable
 * working-tree content, so an archived file rewritten *together with* its
 * recorded object agrees with itself and passes.
 *
 * The anchor here is neither of them. It is the commit reachable from HEAD that
 * history shows introduced the archived path, derived by walking history for that
 * path and never from any value the attestation declares. Both the working-tree
 * archive and the declared inventory are compared against it, so a coordinated
 * rewrite fails twice over.
 *
 * Bounded claim: a history-derived anchor does not withstand rewriting the
 * history it derives from. What bounds that is outside this gate — the mainline
 * is protected against force-push, and a rewrite at or before an anchor changes
 * the identifier of every descendant commit, including the bound commits
 * `check-governance-history.mjs` requires to remain ancestors of HEAD. This gate
 * detects the attack it is specified to detect; it is not tamper-proof storage.
 *
 * Scope: attestations that are declared. Archives that never declared one predate
 * the mechanism, and demanding attestations for them would mean rewriting frozen
 * archived artifacts.
 */
const ARCHIVE_ROOT = "openspec/changes/archive/";
const OBJECT_ID = /^[0-9a-f]{40}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const FILE_MODE = /^\d{6}$/;
// Named because it is the diagnostic for seven distinct malformed-input cases:
// repeating the literal is what Sonar's duplicate-literal rule flags, and a typo
// in one of seven copies would silently split the id.
const ENTRY_INVALID = "archive-attestation-entry-invalid";

const failures = [];
const reports = [];
const counts = { declared: 0, anchored: 0, pending: 0, files: 0 };
const attestations = lifecycleMetadata.movementAttestations;

if (!Array.isArray(attestations) || attestations.length === 0) {
  fail(
    "archive-attestation-manifest-missing",
    "verification-lifecycle.json",
    `movementAttestations must be a non-empty array of declared archive movements, found ${describe(attestations)}`,
  );
} else {
  counts.declared = attestations.length;
  const declaredArchives = attestations.map((entry) => (isPlainObject(entry) ? entry.archive : undefined));
  for (const [index, attestation] of attestations.entries()) {
    checkAttestation(attestation, index, declaredArchives);
  }
}

if (failures.length > 0) {
  const lines = failures.map((failure) => `[${failure.id}] ${failure.file}: ${failure.message}`);
  throw new Error(`archive attestation anchoring failed:\n${[...new Set(lines)].sort(byCodePoint).join("\n")}`);
}

process.stdout.write(
  `archive attestations passed: ${counts.declared} declared, ${counts.anchored} anchored, ${counts.pending} pending, ${counts.files} archived file(s) verified against history\n${reports.sort(byCodePoint).join("\n")}\n`,
);

function fail(id, file, message) {
  failures.push(boundedFailure(id, file, message));
}

function checkAttestation(attestation, index, declaredArchives) {
  const label = `movementAttestations[${index}]`;
  if (!isPlainObject(attestation)) {
    fail(ENTRY_INVALID, label, `attestation must be an object, found ${describe(attestation)}`);
    return;
  }
  const archive = attestation.archive;
  if (!checkArchivePath(label, archive, declaredArchives)) return;
  if (!checkMetadata(archive, attestation)) return;
  const declaredInventory = declaredInventoryOf(archive, attestation);
  if (declaredInventory === null) return;
  if (!existsSync(resolve(repositoryRoot, archive))) {
    fail("archive-attestation-archive-absent", archive, "declared archive is absent from the working tree: expected the archived directory, found none");
    return;
  }
  const { inventory: workingInventory, problems } = workingTreeInventory(repositoryRoot, archive);
  for (const problem of problems) {
    fail(ENTRY_INVALID, problem.path, "archived path is neither a file nor a symbolic link and cannot be compared by object");
  }

  const anchor = deriveAnchor(archive);
  if (anchor.kind === "anchored") verifyAnchored(attestation, anchor, declaredInventory, workingInventory);
  else verifyPending(attestation, declaredInventory, workingInventory);
}

function checkArchivePath(label, archive, declaredArchives) {
  const problem = repositoryPathProblem(archive);
  if (problem) {
    fail("archive-attestation-path-invalid", label, `archive ${JSON.stringify(archive)} ${problem}`);
    return false;
  }
  if (!archive.startsWith(ARCHIVE_ROOT) || archive.length === ARCHIVE_ROOT.length) {
    fail("archive-attestation-path-invalid", label, `archive ${archive}: expected a directory inside ${ARCHIVE_ROOT}, found a path outside it`);
    return false;
  }
  if (declaredArchives.filter((candidate) => candidate === archive).length > 1) {
    fail("archive-attestation-ambiguous", archive, "more than one attestation records this archive: expected exactly one, found several");
    return false;
  }
  return true;
}

function checkMetadata(archive, attestation) {
  let valid = true;
  if (!OBJECT_ID.test(attestation.sourceRevision ?? "")) {
    fail(ENTRY_INVALID, archive, `sourceRevision must be a full 40-character lowercase hexadecimal Git commit, found ${describe(attestation.sourceRevision)}`);
    valid = false;
  }
  if (!ISO_DATE.test(attestation.attestedAt ?? "")) {
    fail(ENTRY_INVALID, archive, `attestedAt must be an ISO date, found ${describe(attestation.attestedAt)}`);
    valid = false;
  }
  if (attestation.anchorCommit !== undefined && !OBJECT_ID.test(attestation.anchorCommit)) {
    fail(ENTRY_INVALID, archive, `anchorCommit must be a full 40-character lowercase hexadecimal Git commit, found ${describe(attestation.anchorCommit)}`);
    valid = false;
  }
  return valid;
}

/** The recorded inventory, in the same shape the comparison inventories use. */
function declaredInventoryOf(archive, attestation) {
  const files = attestation.files;
  if (!isPlainObject(files) || Object.keys(files).length === 0) {
    fail("archive-attestation-inventory-empty", archive, `files must record every archived path, found ${describe(files)}`);
    return null;
  }
  const inventory = new Map();
  let valid = true;
  for (const [relativePath, entry] of Object.entries(files)) {
    const problem = repositoryPathProblem(relativePath);
    if (problem) {
      fail(ENTRY_INVALID, archive, `files key ${JSON.stringify(relativePath)} ${problem}`);
      valid = false;
      continue;
    }
    if (!hasInventoryEntryShape(entry)) {
      fail(ENTRY_INVALID, `${archive}/${relativePath}`, `files entry must record a six-digit mode and a full object id, found ${describe(entry)}`);
      valid = false;
      continue;
    }
    inventory.set(relativePath, Object.freeze({ mode: entry.mode, oid: entry.oid }));
  }
  return valid ? inventory : null;
}

/**
 * The commit history shows introduced the archived path: the oldest commit
 * reachable from HEAD that touched it, confirmed absent from every parent of that
 * commit. When no commit carries the path, the movement is still being prepared.
 */
function deriveAnchor(archive) {
  const commits = lines(quietGit(["rev-list", "HEAD", "--", archive]));
  const introducing = commits.at(-1);
  if (introducing === undefined) return { kind: "pending" };
  const retained = lines(quietGit(["rev-list", "--parents", "-n", "1", introducing])).at(0)?.split(" ").slice(1) ?? [];
  const carriedByParent = retained.find((parent) => gitTreeInventory(parent, archive).size > 0);
  if (carriedByParent !== undefined) {
    fail("archive-attestation-anchor-derivation", archive, `cannot establish the introducing commit: ${introducing} is the oldest commit touching this archive, yet parent ${carriedByParent} already carries it`);
    return { kind: "unresolved" };
  }
  // The archive travels with the anchor so the comparison below needs one
  // subject argument rather than a separate path alongside it.
  return { kind: "anchored", archive, commit: introducing, inventory: gitTreeInventory(introducing, archive) };
}

function verifyAnchored(attestation, anchor, declaredInventory, workingInventory) {
  const archive = anchor.archive;
  checkDeclaredAnchorCommit(attestation, anchor);
  compare("archive-attestation-drift", anchor, declaredInventory, "the attestation");
  compare("archive-attestation-anchor-mismatch", anchor, workingInventory, "the working tree");
  counts.anchored += 1;
  counts.files += anchor.inventory.size;
  reports.push(`  ${archive}: anchored at ${anchor.commit} (${anchor.inventory.size} file(s))${attestation.anchorCommit === undefined ? ", anchor derived but not declared" : ""}`);
}

function checkDeclaredAnchorCommit(attestation, anchor) {
  if (attestation.anchorCommit === undefined) return;
  if (!isAncestorOfHead(attestation.anchorCommit)) {
    fail("archive-attestation-anchor-unreachable", attestation.archive, `anchorCommit ${attestation.anchorCommit} is not an ancestor of HEAD: expected reachable from HEAD, found unreachable`);
    return;
  }
  if (attestation.anchorCommit !== anchor.commit) {
    fail("archive-attestation-anchor-declaration", attestation.archive, `anchorCommit ${attestation.anchorCommit} is not the commit that introduced this archive: expected ${anchor.commit}`);
  }
}

// No anchor exists yet, which is the state while a movement commit is being
// prepared. The archive must still match what was attested for it, so the
// attestation cannot be written against content that was never there.
function verifyPending(attestation, declaredInventory, workingInventory) {
  const archive = attestation.archive;
  if (attestation.anchorCommit !== undefined) {
    fail("archive-attestation-anchor-declaration", archive, `anchorCommit ${attestation.anchorCommit} is declared for an archive that is absent from history: expected no anchor before the movement is committed`);
  }
  for (const difference of differences(declaredInventory, workingInventory)) {
    fail("archive-attestation-pending-mismatch", `${archive}/${difference.path}`, `${difference.message} between the attestation and the working tree`);
  }
  counts.pending += 1;
  counts.files += declaredInventory.size;
  reports.push(`  ${archive}: pending, not yet in history (${declaredInventory.size} file(s) compared against the working tree)`);
}

function compare(id, anchor, actual, subject) {
  for (const difference of differences(anchor.inventory, actual)) {
    fail(id, `${anchor.archive}/${difference.path}`, `${difference.message} between anchor ${anchor.commit} and ${subject}`);
  }
}

/** Mode, object, and path-set differences between two inventories. */
function differences(expected, actual) {
  const changed = [...expected].flatMap(([path, entry]) => entryDifferences(path, entry, actual.get(path)));
  const added = [...actual.keys()]
    .filter((path) => !expected.has(path))
    .map((path) => ({ path, message: "expected absent, found present" }));
  return [...changed, ...added].sort((left, right) => byCodePoint(left.path, right.path));
}

function entryDifferences(path, entry, other) {
  if (other === undefined) return [{ path, message: "expected present, found absent" }];
  const found = [];
  if (other.mode !== entry.mode) found.push({ path, message: `expected mode ${entry.mode}, found ${other.mode}` });
  if (other.oid !== entry.oid) found.push({ path, message: `expected object ${entry.oid}, found ${other.oid}` });
  return found;
}

function isAncestorOfHead(commit) {
  return quietGit(["merge-base", "--is-ancestor", commit, "HEAD"]) !== null;
}

function lines(text) {
  return (text ?? "").split("\n").filter(Boolean);
}

// Git reports "this is not true" as a non-zero exit, which the shared helper
// raises. These probes ask questions whose negative answer is a finding rather
// than an error, so a rejection is reported as null.
function quietGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

function hasInventoryEntryShape(entry) {
  if (!isPlainObject(entry)) return false;
  if (!FILE_MODE.test(entry.mode ?? "")) return false;
  return OBJECT_ID.test(entry.oid ?? "");
}

function isPlainObject(value) {
  if (value === null) return false;
  if (Array.isArray(value)) return false;
  return typeof value === "object";
}

function describe(value) {
  if (value === undefined) return "nothing";
  if (value === null) return "null";
  if (Array.isArray(value)) return `an array of ${value.length}`;
  if (typeof value === "object") return "an object";
  return JSON.stringify(value);
}
