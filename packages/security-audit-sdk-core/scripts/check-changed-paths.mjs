import { existsSync, lstatSync, readdirSync, readFileSync } from "node:fs";
import { relative, resolve } from "node:path";
import {
  assert,
  byCodePoint,
  git,
  repositoryRoot,
  splitNull,
} from "./verification-helpers.mjs";
import {
  lifecycleMetadata,
  parseLifecycleArguments,
  resolveVerificationLifecycle,
} from "./lifecycle-policy.mjs";

const metadata = lifecycleMetadata;
const remediation = metadata.remediationChange;
const ownership = metadata.ownership;
const requestedLifecycle = parseLifecycleArguments();
let lifecycle;
try {
  lifecycle = await resolveVerificationLifecycle();
} catch (error) {
  rethrowArchivedMovementLifecycleError(error, requestedLifecycle);
}
const base = remediation.proposalBaseline;
assert(typeof base === "string" && /^[0-9a-f]{40}$/.test(base), "remediation proposal baseline must be a full Git commit");
git(["rev-parse", "--verify", `${base}^{commit}`]);
git(["merge-base", "--is-ancestor", base, "HEAD"]);

const originalArchivePrefix = `${metadata.originalSdkChange.archive}/`;
const activeRemediationPrefix = `${remediation.active}/`;
const remediationArchivePattern = new RegExp(`${remediation.archivePattern.slice(0, -1)}/`);
const archiveMovement = lifecycle.mode === "archived" && lifecycle.change === remediation.name
  ? validateArchiveMovement(lifecycle)
  : Object.freeze({ activeSources: new Set(), archivePaths: new Set() });
const reviewedNewPaths = validateReviewedNewSdkSourcePaths(metadata);

const tracked = trackedChanges(base);
const untracked = splitNull(git(["ls-files", "--others", "--exclude-standard", "-z"]));
const records = [...tracked, ...untracked.map((path) => ({ status: "?", path }))];
const violations = [];
const classified = new Map();
// Terms are verbatim from the original single-literal pattern, including the
// `instrumentation?` spelling (optional trailing "n"), which differs from
// check-scope.mjs's `instrument(?:ation)?`. Preserved deliberately.
const FORBIDDEN_IMPLEMENTATION_TERMS = [
  "adapter", "instrumentation?", "transport", "exporter", "collector", "broker",
  "queue", "outbox", "storage", "siem", "analytics", "detection", "browser",
  "telemetry", "framework", "middleware", "opentelemetry", "otlp",
  "cryptographic-chain",
];
const forbiddenPackageImplementationPath = new RegExp(
  `^packages/security-audit-sdk-core/(?:src|lib)/(?:.*/)?(?:${FORBIDDEN_IMPLEMENTATION_TERMS.join("|")})(?:[._/-]|$)`,
  "i",
);

for (const record of records) {
  const paths = [record.path, record.source].filter(Boolean);
  for (const path of paths) {
    const classification = classify(path);
    classified.set(path, classification);
    if (metadata.contract.protectedPrefixes.some((prefix) => path.startsWith(prefix))) {
      violations.push(`${record.status} ${path} (canonical event contract or contract governance drift)`);
      continue;
    }
    if (path.startsWith(originalArchivePrefix)) {
      violations.push(`${record.status} ${path} (archived original SDK governance is immutable)`);
      continue;
    }
    if (forbiddenPackageImplementationPath.test(path)) {
      violations.push(`${record.status} ${path} (forbidden production integration path inside the SDK package)`);
      continue;
    }
    if (record.status === "?" && metadata.ownership.sdkSourcePrefixes.some((prefix) => path.startsWith(prefix))) {
      if (reviewedNewPaths.has(path)) {
        continue;
      }
      violations.push(`? ${path} (untracked SDK source is not an expected reviewed target)`);
      continue;
    }
    if (path.startsWith(ownership.canonicalSdkCapabilityPrefix) && lifecycle.mode !== "archived") {
      violations.push(`${record.status} ${path} (canonical SDK capability may change only through archived OpenSpec application)`);
      continue;
    }
    if (remediationArchivePattern.test(path) && lifecycle.mode !== "archived") {
      violations.push(`${record.status} ${path} (remediation archive is not allowed before archived mode)`);
      continue;
    }
    if (path.startsWith(activeRemediationPrefix) && lifecycle.change === remediation.name && lifecycle.mode === "archived") {
      if (archiveMovement.activeSources.has(path)) continue;
      violations.push(`${record.status} ${path} ([archive-movement-unmatched-deletion] active remediation deletion is not part of the verified exact movement)`);
    }
  }
}

const reviewTarget = process.env.SDK_VERIFICATION_REVIEW_TARGET;
if (reviewTarget) {
  assert(/^[0-9a-f]{40}$/.test(reviewTarget), "SDK_VERIFICATION_REVIEW_TARGET must be a full Git commit");
  git(["rev-parse", "--verify", `${reviewTarget}^{commit}`]);
  const packageDrift = splitNull(git([
    "diff", "--no-renames", "--name-only", "-z", "--diff-filter=ACDMRTUXB",
    reviewTarget, "--", ownership.packagePrefix,
  ]));
  for (const path of packageDrift) violations.push(`M ${path} (SDK package differs from expected reviewed target ${reviewTarget})`);
}

if (violations.length > 0) {
  throw new Error(`lifecycle-aware changed-path enforcement failed:\n${[...new Set(violations)].sort(byCodePoint).join("\n")}`);
}

const counts = [...classified.values()].reduce((result, value) => {
  result[value] = (result[value] ?? 0) + 1;
  return result;
}, {});
process.stdout.write(
  `changed-path policy passed in ${lifecycle.mode} mode for ${lifecycle.change}: ${records.length} visible records; ${JSON.stringify(counts)}; ignored files excluded by standard Git semantics\n`,
);

function rethrowArchivedMovementLifecycleError(error, requested) {
  if (requested.change !== remediation.name || requested.mode !== "archived") throw error;
  if (error?.code === "ARCHIVED_CHANGE_ACTIVE") {
    throw new Error([
      "archive movement validation failed:",
      `[archive-movement-retained-active-file] ${remediation.active} still exists in archived mode`,
      "[archive-movement-partial] active-to-archive movement is incomplete",
    ].join("\n"));
  }
  if (error?.code === "ARCHIVE_CARDINALITY") {
    const matches = matchingArchiveDirectories();
    if (matches.length > 1) {
      throw new Error(`archive movement validation failed:\n[archive-movement-multiple-destinations] expected one archive destination, found ${matches.length}: ${matches.join(", ")}`);
    }
    const similarlyNamed = archiveDirectories().filter((path) => path.endsWith(`-${remediation.name}`));
    throw new Error(`archive movement validation failed:\n[archive-movement-wrong-archive-path] expected one archive matching ${remediation.archivePattern}; found ${matches.length}; similarly named: ${similarlyNamed.join(", ") || "none"}`);
  }
  throw error;
}

function validateArchiveMovement(resolvedLifecycle) {
  const movementViolations = [];
  const exactArchive = normalizeRepositoryPath(relative(repositoryRoot, resolvedLifecycle.remediationArchives[0]));
  const exactPattern = new RegExp(remediation.archivePattern);
  movementRule("archive-movement-wrong-archive-path", exactPattern.test(exactArchive), `archive destination ${exactArchive} does not match ${remediation.archivePattern}`);

  const baseline = resolveMovementBaseline(exactArchive, movementViolations);
  const source = baseline.source;
  const sourceFiles = baseline.files;
  const archiveFiles = workingTreeInventory(exactArchive, movementViolations);
  const activeFiles = workingTreeInventory(remediation.active, movementViolations);

  movementRule("archive-movement-retained-active-file", activeFiles.size === 0, `active remediation retains ${activeFiles.size} file(s)`);
  movementRule("archive-movement-partial", sourceFiles.size > 0, "source baseline contains no active remediation files");

  const activeSources = new Set();
  const archivePaths = new Set();
  for (const [relativePath, sourceEntry] of sourceFiles) {
    const destinationEntry = archiveFiles.get(relativePath);
    const sourcePath = `${remediation.active}/${relativePath}`;
    const destinationPath = `${exactArchive}/${relativePath}`;
    activeSources.add(sourcePath);
    if (!destinationEntry) {
      movementFailure("archive-movement-unmatched-deletion", `${sourcePath} has no archive addition at ${destinationPath}`);
      continue;
    }
    archivePaths.add(destinationPath);
    movementRule(
      "archive-movement-mode-mismatch",
      sourceEntry.mode === destinationEntry.mode,
      `${sourcePath} mode ${sourceEntry.mode} differs from ${destinationPath} mode ${destinationEntry.mode}`,
    );
    // On the attested path there is no reachable source revision to replay the
    // transitions against, so tasks.md is compared by object like every other
    // file: the attestation records its post-transition blob, and the transition
    // itself was validated by re-derivation when the attestation was written.
    if (relativePath === "tasks.md" && baseline.mode === "rederived") {
      movementRule(
        "archive-movement-unauthorized-task-difference",
        archivedTasksMatchSource(source, sourcePath, destinationPath, movementViolations),
        `${destinationPath} differs from the source by more than exact 12.8-12.10 checkbox transitions`,
      );
    } else {
      movementRule(
        "archive-movement-byte-substitution",
        sourceEntry.oid === destinationEntry.oid,
        `${sourcePath} blob ${sourceEntry.oid} differs from ${destinationPath} blob ${destinationEntry.oid}`,
      );
    }
  }

  for (const relativePath of archiveFiles.keys()) {
    if (sourceFiles.has(relativePath)) continue;
    const destinationPath = `${exactArchive}/${relativePath}`;
    movementFailure("archive-movement-unmatched-addition", `${destinationPath} has no active remediation deletion`);
    movementFailure("archive-movement-wrong-path", `${destinationPath} does not preserve an active relative path`);
  }

  if (sourceFiles.size !== archiveFiles.size || activeFiles.size !== 0) {
    movementFailure("archive-movement-partial", `movement inventory is source=${sourceFiles.size}, archive=${archiveFiles.size}, active-remnants=${activeFiles.size}`);
  }

  checkUnrelatedMovementChanges(baseline.inProgressSource, exactArchive, movementViolations);

  if (movementViolations.length > 0) {
    throw new Error(`archive movement validation failed:\n${[...new Set(movementViolations)].sort(byCodePoint).join("\n")}`);
  }
  return Object.freeze({ activeSources, archivePaths });

  function movementFailure(id, message) {
    movementViolations.push(`[${id}] ${message}`);
  }

  function movementRule(id, condition, message) {
    if (!condition) movementFailure(id, message);
  }
}

/**
 * Resolves the baseline the archive is compared against, by one of two paths.
 *
 * `rederived` reconstructs the source inventory from history and is the stronger
 * check: it proves the archive is an exact move of what the active change held.
 * `attested` compares against recorded blob objects and proves only that the
 * archive has not changed since it was attested.
 *
 * The repository squash-merges by default, which replays a branch as one commit
 * and destroys the intermediate state re-derivation needs. Fallback is therefore
 * keyed strictly on *reachability* of the attested source revision, never on a
 * content mismatch — otherwise altering the archive and the attestation together
 * would face a weaker check than altering the archive alone.
 */
function resolveMovementBaseline(archiveRelative, movementViolations) {
  // The archive commit itself: the active change is still at HEAD, so the
  // movement is fully re-derivable and the attestation is validated as written.
  const headInventory = gitTreeInventory("HEAD", remediation.active);
  if (headInventory.size > 0) {
    process.stdout.write("archive movement baseline: re-derived from HEAD\n");
    // inProgressSource is set only here. The unrelated-change scan is bounded to
    // the working tree against HEAD, so it applies only while the movement is
    // being made. Once committed the source is historical, it was scanned then,
    // and re-deriving it against an ever-growing diff would reject every archive
    // created afterwards. Carrying the decision here rather than branching at the
    // call site keeps that knowledge with the resolution that already has it.
    const source = Object.freeze({ revision: "HEAD", movementCommit: null });
    return Object.freeze({ mode: "rederived", source, files: headInventory, inProgressSource: source });
  }

  const attestation = movementAttestationFor(archiveRelative, movementViolations);
  if (!attestation) return Object.freeze({ mode: "unresolved", source: null, files: new Map(), inProgressSource: null });

  // The attested revision is authoritative. Scanning history for a commit that
  // added the archive is what squash merging defeats: it finds the squash commit
  // whose parent is the target branch tip, not the pre-archive branch commit.
  if (revisionCarriesActiveChange(attestation.sourceRevision)) {
    process.stdout.write(`archive movement baseline: re-derived from attested revision ${attestation.sourceRevision}\n`);
    return Object.freeze({
      mode: "rederived",
      source: Object.freeze({ revision: attestation.sourceRevision, movementCommit: null }),
      files: gitTreeInventory(attestation.sourceRevision, remediation.active),
      inProgressSource: null,
    });
  }

  process.stdout.write(
    `archive movement baseline: attested (source revision ${attestation.sourceRevision} is unreachable; comparing recorded objects only)\n`,
  );
  return Object.freeze({ mode: "attested", source: null, files: attestedInventory(attestation), inProgressSource: null });
}

function movementAttestationFor(archiveRelative, movementViolations) {
  const entries = metadata.movementAttestations;
  if (entries === undefined) return null;
  if (!Array.isArray(entries)) throw new TypeError("movementAttestations must be an array");
  const matches = entries.filter((entry) => entry?.archive === archiveRelative);
  if (matches.length === 0) {
    movementViolations.push(`[archive-movement-attestation-missing] no movement attestation records ${archiveRelative}`);
    return null;
  }
  if (matches.length > 1) {
    movementViolations.push(`[archive-movement-attestation-ambiguous] ${matches.length} attestations record ${archiveRelative}`);
    return null;
  }
  const attestation = matches[0];
  assert(/^[0-9a-f]{40}$/.test(attestation.sourceRevision ?? ""), "movement attestation sourceRevision must be a full Git commit");
  assert(attestation.files && typeof attestation.files === "object" && !Array.isArray(attestation.files), "movement attestation files must be an object");
  return attestation;
}

function attestedInventory(attestation) {
  const inventory = new Map();
  for (const [relativePath, entry] of Object.entries(attestation.files)) {
    assert(/^[0-9a-f]{40}$/.test(entry?.oid ?? ""), `movement attestation oid for ${relativePath} must be a full object id`);
    assert(/^\d{6}$/.test(entry?.mode ?? ""), `movement attestation mode for ${relativePath} must be a six-digit file mode`);
    inventory.set(relativePath, Object.freeze({
      mode: entry.mode,
      oid: entry.oid,
      path: `${remediation.active}/${relativePath}`,
    }));
  }
  return inventory;
}

function revisionCarriesActiveChange(revision) {
  try {
    git(["rev-parse", "--verify", `${revision}^{commit}`]);
  } catch {
    return false;
  }
  return gitTreeInventory(revision, remediation.active).size > 0;
}

function exactArchivedTaskReconciliation(sourceText, movementViolations) {
  let expected = sourceText;
  for (const taskId of ["12.8", "12.9", "12.10"]) {
    const pattern = new RegExp(String.raw`^- \[([ x])\] ${escapeRegex(taskId)} `, "gm");
    const matches = [...expected.matchAll(pattern)];
    if (matches.length !== 1 || matches[0][1] !== " ") {
      movementViolations.push(`[archive-movement-unauthorized-task-difference] source task ${taskId} must occur exactly once and be unchecked before archive`);
      return null;
    }
    expected = expected.replace(pattern, `- [x] ${taskId} `);
  }
  return expected;
}

function gitTreeInventory(revision, prefix) {
  const inventory = new Map();
  const records = splitNull(git(["ls-tree", "-r", "-z", revision, "--", prefix]));
  for (const record of records) {
    const separator = record.indexOf("\t");
    assert(separator !== -1, `unable to parse git tree record for ${prefix}`);
    const [mode, type, oid] = record.slice(0, separator).split(" ");
    const path = record.slice(separator + 1);
    assert(type === "blob", `archive movement requires blob entries, found ${type} at ${path}`);
    assert(path.startsWith(`${prefix}/`), `tree path ${path} is outside ${prefix}`);
    const relativePath = path.slice(prefix.length + 1);
    assert(!inventory.has(relativePath), `duplicate tree path ${relativePath}`);
    inventory.set(relativePath, Object.freeze({ mode, oid, path }));
  }
  return inventory;
}

function workingTreeInventory(rootRelative, movementViolations) {
  const inventory = new Map();
  const root = resolve(repositoryRoot, rootRelative);
  if (!existsSync(root)) return inventory;

  function walk(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const absolute = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      const stat = lstatSync(absolute);
      const path = normalizeRepositoryPath(relative(repositoryRoot, absolute));
      const relativePath = path.slice(rootRelative.length + 1);
      if (!entry.isFile() && !entry.isSymbolicLink()) {
        movementViolations.push(`[archive-movement-mode-mismatch] unsupported filesystem entry at ${path}`);
        continue;
      }
      const mode = gitFileMode(entry, stat);
      const oid = git(["hash-object", "--no-filters", "--", path]).trim();
      inventory.set(relativePath, Object.freeze({ mode, oid, path }));
    }
  }
  walk(root);
  return inventory;
}

function workingChangesAgainst(revision) {
  const changes = parseNameStatus(splitNull(git([
    "diff", "--no-renames", "--name-status", "-z", "--diff-filter=ACDMRTUXB",
    revision, "--",
  ])));
  const untracked = splitNull(git(["ls-files", "--others", "--exclude-standard", "-z"]));
  return [...changes, ...untracked.map((path) => ({ status: "?", path }))];
}

function trackedChangesBetween(source, destination) {
  return parseNameStatus(splitNull(git([
    "diff", "--no-renames", "--name-status", "-z", "--diff-filter=ACDMRTUXB",
    source, destination, "--",
  ])));
}

function parseNameStatus(fields) {
  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (/^[RC]/.test(status)) {
      const source = fields[index++];
      const path = fields[index++];
      changes.push({ status, source, path });
    } else {
      changes.push({ status, path: fields[index++] });
    }
  }
  return changes;
}

function archiveDirectories() {
  const root = resolve(repositoryRoot, "openspec/changes/archive");
  try {
    return readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `openspec/changes/archive/${entry.name}`)
      .sort(byCodePoint);
  } catch {
    return [];
  }
}

function matchingArchiveDirectories() {
  return archiveDirectories().filter((path) => new RegExp(remediation.archivePattern).test(path));
}

function normalizeRepositoryPath(path) {
  return path.replaceAll("\\", "/");
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
}

function validateReviewedNewSdkSourcePaths(metadata) {
  const ownership = metadata.ownership;
  const paths = ownership.reviewedNewSdkSourcePaths;

  if (paths === undefined) return new Set();

  if (!Array.isArray(paths)) {
    throw new TypeError("ownership.reviewedNewSdkSourcePaths must be an array");
  }

  const seen = new Set();
  const validated = new Set();

  for (const rawPath of paths) {
    assertReviewedPathShape(rawPath, ownership);
    if (seen.has(rawPath)) {
      throw new Error(`reviewedNewSdkSourcePaths contains duplicate path: ${rawPath}`);
    }

    seen.add(rawPath);
    validated.add(rawPath);
  }

  return validated;
}

function trackedChanges(commit) {
  const fields = splitNull(git([
    "diff", "--find-renames", "--name-status", "-z", "--diff-filter=ACDMRTUXB",
    commit, "--",
  ]));
  const changes = [];
  for (let index = 0; index < fields.length;) {
    const status = fields[index++];
    if (/^[RC]/.test(status)) {
      const source = fields[index++];
      const path = fields[index++];
      changes.push({ status, source, path });
    } else {
      changes.push({ status, path: fields[index++] });
    }
  }
  return changes;
}

function classify(path) {
  if (path.startsWith(ownership.packagePrefix)) return "sdk-package";
  if (path.startsWith(activeRemediationPrefix)) return "active-remediation";
  if (remediationArchivePattern.test(path)) return "archived-remediation";
  if (path.startsWith(ownership.canonicalSdkCapabilityPrefix)) return "sdk-capability";
  if (metadata.contract.protectedPrefixes.some((prefix) => path.startsWith(prefix))) return "event-contract";
  if (path.startsWith(originalArchivePrefix)) return "original-sdk-archive";
  if (path === "CLAUDE.md" || /(?:^|\/)CLAUDE\.md$/.test(path)) return "local-instruction-unrelated";
  return existsSync(resolve(repositoryRoot, path)) ? "unrelated-history-or-worktree" : "unrelated-deletion";
}

function collectMovementChanges(source) {
  if (!source) return [];
  if (source.movementCommit) return trackedChangesBetween(source.revision, source.movementCommit);
  return workingChangesAgainst(source.revision);
}

function gitFileMode(entry, stat) {
  if (entry.isSymbolicLink()) return "120000";
  return (stat.mode & 0o111) === 0 ? "100644" : "100755";
}

function isUnrelatedActiveDeletion(record) {
  return record.status === "D"
    && record.path.startsWith("openspec/changes/")
    && !record.path.startsWith(`${remediation.active}/`)
    && !record.path.startsWith("openspec/changes/archive/");
}

function isUnrelatedArchiveAddition(record, exactArchive) {
  return ["A", "?"].includes(record.status)
    && record.path.startsWith("openspec/changes/archive/")
    && !record.path.startsWith(`${exactArchive}/`);
}

function archivedTasksMatchSource(source, sourcePath, destinationPath, movementViolations) {
  const sourceTasks = git(["show", `${source.revision}:${sourcePath}`]);
  const destinationTasks = readFileSync(resolve(repositoryRoot, destinationPath), "utf8");
  const reconciled = exactArchivedTaskReconciliation(sourceTasks, movementViolations);
  return reconciled !== null && destinationTasks === reconciled;
}

function assertReviewedPathShape(rawPath, ownership) {
  if (typeof rawPath !== "string" || rawPath.length === 0) {
    throw new Error(`reviewedNewSdkSourcePaths entry must be a non-empty string, got: ${JSON.stringify(rawPath)}`);
  }

  // "\0" is the NUL character. The previous spelling was String.raw`\0`, the
  // two-character sequence backslash-zero, so an embedded NUL passed every
  // guard and was accepted. A literal backslash-zero is still rejected below
  // by the forward-slash rule.
  if (rawPath.includes("\0")) {
    throw new Error(`reviewedNewSdkSourcePaths entry contains null byte: ${JSON.stringify(rawPath)}`);
  }

  if (rawPath.includes("..")) {
    throw new Error(`reviewedNewSdkSourcePaths entry must not contain path traversal: ${rawPath}`);
  }

  if (rawPath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(rawPath)) {
    throw new Error(`reviewedNewSdkSourcePaths entry must be a repository-relative path, not absolute: ${rawPath}`);
  }

  if (rawPath.includes("\\")) {
    throw new Error(`reviewedNewSdkSourcePaths entry must use forward slashes: ${rawPath}`);
  }

  if (rawPath.endsWith("/")) {
    throw new Error(`reviewedNewSdkSourcePaths entry must be a file path, not a directory: ${rawPath}`);
  }

  if (/[*?[{]/.test(rawPath)) {
    throw new Error(`reviewedNewSdkSourcePaths entry must not contain glob characters: ${rawPath}`);
  }

  if (!ownership.sdkSourcePrefixes.some((prefix) => rawPath.startsWith(prefix))) {
    throw new Error(`reviewedNewSdkSourcePaths entry is outside configured SDK source prefixes: ${rawPath}`);
  }
}

/** Receives a source only while the movement is in progress; see resolveMovementBaseline. */
function checkUnrelatedMovementChanges(source, exactArchive, movementViolations) {
  for (const record of collectMovementChanges(source)) {
    if (isUnrelatedActiveDeletion(record)) {
      movementViolations.push(`[archive-movement-unrelated-change-deletion] ${record.path} belongs to another active change`);
    }
    if (isUnrelatedArchiveAddition(record, exactArchive)) {
      movementViolations.push(`[archive-movement-unrelated-archive-addition] ${record.path} is outside ${exactArchive}`);
    }
  }
}
