#!/usr/bin/env node
/**
 * Contract Reuse Assessment (CRA) checker.
 *
 * This checker is deliberately dependency-free, read-only, and scoped to exactly
 * one active OpenSpec change. It determines whether a CRA is required from the
 * selected change's material range, then proves the distinct author-written
 * record structurally, semantically, and—only for an exemption—against the
 * fixed signed-governance source.
 */

import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { DiagnosticSink, formatDiagnostics } from "../design-pattern-governance/diagnostics.mjs";
import {
  blobAt,
  commitsBetween,
  historyIsComplete,
  isAncestor,
  objectAtPath,
  parentsOf,
  pathsChangedByCommit,
  resolveCommit,
  treeOf,
  tryGit,
} from "../design-pattern-governance/git.mjs";
import { collectOpenSpecChanges, collectRangePaths } from "../design-pattern-governance/perimeter.mjs";
import { matchesSelection } from "../design-pattern-governance/paths.mjs";
import { loadCraSchema, validateCraRecord } from "./schema.mjs";

const CRA_RECORD_NAME = "contract-reuse.json";
const GOVERNANCE_RECORD_PATH = "packages/security-audit-sdk-core/verification-lifecycle.json";
const CANONICAL_CONTRACT_PATH = "contracts/security-audit/source/contract.source.json";
const REQUIRED_CONTRACT = "security-audit@1.0.0";
const PROJECT_OWNER = "Fernando Homem da Costa (nandohdc)";
const CHANGE_ID = /^[a-z0-9][a-z0-9-]{2,99}$/;
const OBJECT_ID = /^[0-9a-f]{40}$/;
const SAFE_REFERENCE = /^[a-z][a-z0-9_]*(?:\.[a-z][a-z0-9_]*)*$/;

const ARGUMENT_OPTIONS = Object.freeze({
  "--repo-root": valueOption((parsed, value) => { parsed.repoRoot = resolve(value); }),
  "--change": valueOption((parsed, value) => { parsed.change = value; }),
  "--base": valueOption((parsed, value) => { parsed.base = value; }),
  "--json": flagOption((parsed) => { parsed.json = true; }),
  "--help": flagOption((parsed) => { parsed.help = true; }),
  "-h": flagOption((parsed) => { parsed.help = true; }),
});

const options = parseArguments(process.argv.slice(2));
if (options.help) {
  process.stdout.write(usage());
  process.exit(0);
}

const sink = new DiagnosticSink();
const report = run(options, sink);
emit({ ...report, failures: sink.failures, warnings: sink.warnings, truncated: sink.truncated }, sink, options);
process.exit(sink.ok ? 0 : 1);

/**
 * The evaluation pipeline. Each stage is one named step with a single early
 * return, so a failure in any stage is a distinguishable rejected outcome
 * rather than a partial pass.
 */
function run(opts, sink) {
  const repositoryRoot = opts.repoRoot ?? discoverRepositoryRoot();
  const selectedChange = selectActiveChange(repositoryRoot, opts.change, sink);
  if (selectedChange === null) return summary({ repositoryRoot, selectedChange: null });

  const range = resolveRange(repositoryRoot, opts.base, sink);
  if (range === null) return summary({ repositoryRoot, selectedChange });

  const context = { repositoryRoot, selectedChange, range, triggeringPaths: [], sink };
  const triggeringPaths = range.range.paths.filter((path) => isTriggerPath(path, selectedChange));
  if (triggeringPaths.length === 0) return skipSummary(context);

  context.triggeringPaths = triggeringPaths;
  const attribution = evaluateAttribution(context);
  if (attribution === "skip") return skipSummary(context);
  if (attribution === "rejected") return rejectedSummary(context);
  return evaluateRecord(context);
}

/** The complete-history, base, head, and range stages of the pipeline. */
function resolveRange(repositoryRoot, baseOption, sink) {
  if (!historyIsComplete(repositoryRoot)) {
    sink.fail("cra-range-unavailable", ".",
      "the CRA checker requires complete local Git history to establish its merge-base range");
    return null;
  }
  const base = resolveBase(baseOption, repositoryRoot, sink);
  if (base === null) {
    sink.fail("cra-range-unavailable", ".", "the selected change range cannot be resolved from complete local Git history");
    return null;
  }
  const head = resolveCommit("HEAD", repositoryRoot);
  if (head === null) {
    sink.fail("cra-range-unavailable", ".", "the selected change range cannot be resolved from complete local Git history");
    return null;
  }
  if (!isAncestor(base, head, repositoryRoot)) {
    sink.fail("cra-range-unavailable", ".", "the CRA range base is not an ancestor of the evaluated change head");
    return null;
  }
  const range = collectRangePaths(base, head, repositoryRoot, sink);
  if (range === null) {
    sink.fail("cra-range-unavailable", ".", "the selected change range cannot be enumerated");
    return null;
  }
  return { base, head, range };
}

/** Fail-closed attribution of triggering paths to the active changes that own them. */
function evaluateAttribution(context) {
  const changes = collectOpenSpecChanges(
    context.range.range.paths,
    (changeId) => readAssessment(context.repositoryRoot, changeId),
    activeChangeIds(context.repositoryRoot),
  );
  return checkTriggerAttribution(context, changes);
}

function checkTriggerAttribution(context, changes) {
  let hasUnattributable = false;
  for (const path of context.triggeringPaths) {
    const matches = changes.filter((change) => matchesSelection(path, change.ownedPaths));
    if (matches.length === 1) continue;
    context.sink.fail("cra-trigger-unattributable", path, attributionMessage(matches, context.selectedChange));
    hasUnattributable = true;
  }
  if (hasUnattributable) return "rejected";

  const selectedTriggers = context.triggeringPaths.filter((path) => {
    const matches = changes.filter((change) => matchesSelection(path, change.ownedPaths));
    return isSelectedAttribution(matches, context.selectedChange);
  });

  if (selectedTriggers.length === 0) return "skip";
  context.triggeringPaths = selectedTriggers;
  return "pass";
}

/** Record loading, identity, structural, and mode stages of the pipeline. */
function evaluateRecord(context) {
  const recordPath = changeRecordPath(context.selectedChange);
  const record = readCraRecord(context.repositoryRoot, recordPath, context.sink);
  if (record === null) return rejectedSummary(context);
  if (!hasSupportedContract(record, recordPath, context.sink)) return rejectedSummary(context);
  if (!isStructurallyValid(record, recordPath, context.repositoryRoot, context.sink)) return rejectedSummary(context);
  return evaluateMode(record, recordPath, context);
}

function selectActiveChange(repositoryRoot, change, sink) {
  if (!isValidChangeId(change)) {
    sink.fail("cra-change-invalid", "--change",
      "a CRA evaluation requires one safe selected active OpenSpec change id");
    return null;
  }
  if (!activeChangeIds(repositoryRoot).includes(change)) {
    sink.fail("cra-change-absent", `openspec/changes/${change}`,
      "the selected CRA change is not an active OpenSpec change directory");
    return null;
  }
  return change;
}

function isValidChangeId(change) {
  if (typeof change !== "string") return false;
  return CHANGE_ID.test(change);
}

function resolveBase(requestedBase, cwd, sink) {
  if (!requestedBase) return defaultBase(cwd, sink);
  if (!isSafeRevision(requestedBase)) {
    sink.fail("cra-range-unavailable", ".", "the supplied CRA range base must be one safe Git revision string");
    return null;
  }
  const resolved = resolveCommit(requestedBase, cwd);
  if (resolved !== null) return resolved;
  sink.fail("cra-range-unavailable", ".", "the supplied CRA range base does not resolve to a commit");
  return null;
}

function isSafeRevision(value) {
  if (typeof value !== "string") return false;
  if (value.length === 0) return false;
  if (value.length > 1000) return false;
  if (value.startsWith("-")) return false;
  return true;
}

function defaultBase(cwd, sink) {
  for (const mainline of ["refs/remotes/origin/main", "refs/heads/main"]) {
    const result = tryGit(["merge-base", mainline, "HEAD"], { cwd });
    if (result.ok) return result.value.trim();
  }
  sink.fail("cra-range-unavailable", ".", "the CRA range base cannot be derived from the protected mainline");
  return null;
}

function activeChangeIds(repositoryRoot) {
  try {
    return readdirSync(resolve(repositoryRoot, "openspec/changes"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory() && entry.name !== "archive")
      .map((entry) => entry.name)
      .sort();
  } catch {
    return [];
  }
}

function readAssessment(repositoryRoot, changeId) {
  try {
    return JSON.parse(readFileSync(resolve(repositoryRoot, "openspec/changes", changeId, "assessment.json"), "utf8"));
  } catch {
    return null;
  }
}

function isTriggerPath(path, changeId) {
  return path.startsWith("contracts/")
    || path.startsWith("packages/security-audit-sdk-core/src/generated/")
    || path.startsWith("openspec/specs/security-audit-event-contract/")
    || path.startsWith(`openspec/changes/${changeId}/specs/security-audit-event-contract/`);
}

function isSelectedAttribution(matches, selectedChange) {
  if (matches.length !== 1) return false;
  return matches[0].id === selectedChange;
}

function attributionMessage(matches, selectedChange) {
  if (matches.length === 0) {
    return "a CRA trigger path matches no active change owned-path set; attribution fails closed";
  }
  if (matches.length > 1) {
    return "a CRA trigger path matches more than one active change owned-path set; attribution fails closed";
  }
  return matches[0].id === selectedChange
    ? "a CRA trigger path has no usable selected-change attribution"
    : "a CRA trigger path is uniquely owned by a different active change; attribution fails closed";
}

function changeRecordPath(changeId) {
  return `openspec/changes/${changeId}/${CRA_RECORD_NAME}`;
}

function readCraRecord(repositoryRoot, recordPath, sink) {
  let text;
  try {
    text = readFileSync(resolve(repositoryRoot, recordPath), "utf8");
  } catch {
    sink.fail("cra-record-missing", recordPath, "a CRA-triggered change requires a contract-reuse.json record");
    return null;
  }
  try {
    return JSON.parse(text);
  } catch {
    sink.fail("cra-record-malformed", recordPath,
      "the required contract-reuse.json record does not contain valid JSON");
    return null;
  }
}

function hasSupportedContract(record, recordPath, sink) {
  if (!isRecord(record)) return rejectUnsupportedContract(recordPath, sink);
  if (record.contract !== REQUIRED_CONTRACT) return rejectUnsupportedContract(recordPath, sink);
  return true;
}

function rejectUnsupportedContract(recordPath, sink) {
  sink.fail("cra-contract-unsupported", recordPath,
    "the CRA checker supports exactly security-audit@1.0.0 and selects no other contract source");
  return false;
}

function isStructurallyValid(record, recordPath, repositoryRoot, sink) {
  const structuralStart = sink.count;
  const schema = loadCraSchema(repositoryRoot, sink);
  if (schema !== null) validateCraRecord(schema, record, { documentPath: recordPath, sink });
  if (sink.count === structuralStart) return true;
  sink.fail("cra-record-invalid", recordPath,
    "the required Contract Reuse Assessment does not satisfy its closed structural record shape");
  rejectExemptionStructure(record, recordPath, sink);
  return false;
}

function rejectExemptionStructure(record, recordPath, sink) {
  if (record.mode !== "exemption") return;
  sink.fail("cra-exemption-unauthorized", recordPath,
    "an exemption must first satisfy the closed exemption record shape before external evidence can be recognized");
}

function evaluateMode(record, recordPath, context) {
  if (record.mode === "assessment") return evaluateAssessment(record, recordPath, context);
  if (record.mode === "exemption") return evaluateExemption(record, recordPath, context);
  context.sink.fail("cra-record-invalid", recordPath, "the required Contract Reuse Assessment selects no supported record mode");
  return rejectedSummary(context);
}

function evaluateAssessment(record, recordPath, context) {
  if (!resolveAssessmentReferences(record, context, recordPath)) {
    return rejectedSummary(context);
  }
  return outcomeSummary(context, "cra-validated");
}

function evaluateExemption(record, recordPath, context) {
  const exemption = { ...context, recordPath, head: context.range.head };
  if (!validateExemption(record, exemption)) return rejectedSummary(context);
  return outcomeSummary(context, "approved-exemption");
}

function resolveAssessmentReferences(record, context, recordPath) {
  if (!requiresMechanismResolution(record.disposition)) return true;
  const source = readCanonicalContractAtBase(context.repositoryRoot, context.range.base, context.sink);
  if (source === null) return false;
  let resolved = true;
  for (const reference of record.mechanism_references ?? []) {
    if (resolvesReference(source, reference)) continue;
    context.sink.fail("cra-mechanism-unresolved", recordPath,
      `the canonical security-audit source does not resolve mechanism reference ${describeSafeReference(reference)}`);
    resolved = false;
  }
  return resolved;
}

function requiresMechanismResolution(disposition) {
  if (disposition === "reuse") return true;
  if (disposition === "extend") return true;
  return false;
}

function readCanonicalContractAtBase(repositoryRoot, base, sink) {
  const text = blobAt(base, CANONICAL_CONTRACT_PATH, repositoryRoot);
  if (text === null) {
    sink.fail("cra-contract-source-unavailable", CANONICAL_CONTRACT_PATH,
      "the supported canonical security-audit source is absent or unreadable at the reviewed range baseline");
    return null;
  }
  try {
    const source = JSON.parse(text);
    if (source?.authoritative_source !== true) return rejectCanonicalSource(sink);
    if (source?.metadata?.schema_version !== "1.0.0") return rejectCanonicalSource(sink);
    return source;
  } catch {
    sink.fail("cra-contract-source-unavailable", CANONICAL_CONTRACT_PATH,
      "the supported canonical security-audit source does not contain valid JSON");
    return null;
  }
}

function rejectCanonicalSource(sink) {
  sink.fail("cra-contract-source-unavailable", CANONICAL_CONTRACT_PATH,
    "the reviewed range baseline is not the authoritative security-audit source at schema version 1.0.0");
  return null;
}

function resolvesReference(source, reference) {
  if (typeof reference !== "string") return false;
  if (!SAFE_REFERENCE.test(reference)) return false;
  let value = source;
  for (const segment of reference.split(".")) {
    if (!isRecord(value)) return false;
    if (!Object.hasOwn(value, segment)) return false;
    value = value[segment];
  }
  return true;
}

function describeSafeReference(reference) {
  if (isSafeReferenceText(reference)) return JSON.stringify(reference);
  return "a structurally invalid reference";
}

function isSafeReferenceText(reference) {
  if (typeof reference !== "string") return false;
  if (reference.length > 200) return false;
  return SAFE_REFERENCE.test(reference);
}

function validateExemption(record, context) {
  if (record.governance_locator?.change !== context.selectedChange) {
    return rejectExemption(context, "an exemption locator must name the selected CRA change");
  }
  const evidence = selectedGovernanceEvidence(context);
  if (evidence === null) return false;
  if (!hasRequiredExemptionFields(evidence, context)) return false;
  const technical = resolvesTechnicalCandidate(evidence, context);
  if (technical === null) return false;
  if (!hasExactReviewedContent(evidence, technical, context)) return false;
  return hasDirectSignedRecord(evidence, technical, context);
}

function selectedGovernanceEvidence(context) {
  const manifest = readGovernanceManifest(context.repositoryRoot, context.sink);
  if (manifest === null) return null;
  const matches = manifest.governanceRecords.filter((entry) => entry?.change === context.selectedChange);
  if (matches.length === 1) return matches[0];
  rejectExemption(context,
    "the fixed governance-record source must contain exactly one record for the selected exemption change");
  return null;
}

function readGovernanceManifest(repositoryRoot, sink) {
  let text;
  try {
    text = readFileSync(resolve(repositoryRoot, GOVERNANCE_RECORD_PATH), "utf8");
  } catch {
    sink.fail("cra-exemption-unauthorized", GOVERNANCE_RECORD_PATH,
      "the fixed signed-governance source is absent or unreadable");
    return null;
  }
  try {
    const manifest = JSON.parse(text);
    if (hasRecordsArray(manifest)) return manifest;
  } catch {
    // The bounded diagnostic deliberately does not expose parser details from an external evidence source.
  }
  sink.fail("cra-exemption-unauthorized", GOVERNANCE_RECORD_PATH,
    "the fixed signed-governance source does not contain a governanceRecords array");
  return null;
}

function hasRecordsArray(manifest) {
  if (!isRecord(manifest)) return false;
  return Array.isArray(manifest.governanceRecords);
}

function hasRequiredExemptionFields(record, context) {
  if (!isSignedOwnerRecord(record, context)) return false;
  if (!grantsExemptionToken(record, context)) return false;
  if (!namesExactTechnicalCommit(record, context)) return false;
  return true;
}

function isSignedOwnerRecord(record, context) {
  if (!isRecord(record)) {
    return rejectExemption(context, "the selected governance evidence is not a signed record");
  }
  if (record.signed !== true) {
    return rejectExemption(context, "the selected governance evidence is not a signed record");
  }
  if (record.reviewer?.name !== PROJECT_OWNER) {
    return rejectExemption(context, "the selected governance evidence is not signed by the project owner");
  }
  return true;
}

function grantsExemptionToken(record, context) {
  const token = `contract-reuse-exemption:${context.selectedChange}`;
  if (!Array.isArray(record.authorizations?.granted)) {
    return rejectExemption(context, "the selected governance evidence grants no exact CRA exemption token");
  }
  if (!record.authorizations.granted.includes(token)) {
    return rejectExemption(context, "the selected governance evidence grants no exact CRA exemption token");
  }
  return true;
}

function namesExactTechnicalCommit(record, context) {
  if (typeof record.reviewedCommit !== "string") {
    return rejectExemption(context, "the selected governance evidence names no exact reviewed technical commit");
  }
  if (!OBJECT_ID.test(record.reviewedCommit)) {
    return rejectExemption(context, "the selected governance evidence names no exact reviewed technical commit");
  }
  return true;
}

function resolvesTechnicalCandidate(evidence, context) {
  const technical = resolveCommit(evidence.reviewedCommit, context.repositoryRoot);
  if (technical === null) {
    rejectExemption(context, "the exemption reviewed technical commit is unavailable or not an exact commit object");
    return null;
  }
  if (technical !== evidence.reviewedCommit) {
    rejectExemption(context, "the exemption reviewed technical commit is unavailable or not an exact commit object");
    return null;
  }
  if (!isAncestor(technical, context.head, context.repositoryRoot)) {
    rejectExemption(context, "the exemption reviewed technical commit is not an ancestor of the evaluated change head");
    return null;
  }
  return technical;
}

function hasExactReviewedContent(record, technical, context) {
  if (!bindsCandidateTree(record, technical, context)) return false;
  const expectedObject = expectedChangeRootObject(technical, context);
  if (expectedObject === null) {
    return rejectExemption(context, "the selected governance evidence does not bind the exact selected change-root tree");
  }
  if (!bindsChangeRootEntry(record, context, expectedObject)) return false;
  if (!matchesCurrentChangeRoot(context, expectedObject)) return false;
  return true;
}

function bindsCandidateTree(record, technical, context) {
  const candidateRoot = treeOf(technical, context.repositoryRoot);
  if (candidateRoot === null) {
    return rejectExemption(context, "the selected governance evidence does not bind the reviewed technical tree");
  }
  if (record.reviewedContent?.candidateRoot !== candidateRoot) {
    return rejectExemption(context, "the selected governance evidence does not bind the reviewed technical tree");
  }
  return true;
}

function expectedChangeRootObject(technical, context) {
  const changeRoot = `openspec/changes/${context.selectedChange}`;
  return objectAtPath(technical, changeRoot, context.repositoryRoot);
}

function bindsChangeRootEntry(record, context, expectedObject) {
  const entries = record.reviewedContent?.entries;
  if (!Array.isArray(entries)) {
    return rejectExemption(context, "the selected governance evidence does not bind the exact selected change-root tree");
  }
  const changeRoot = `openspec/changes/${context.selectedChange}`;
  const bindings = entries.filter((entry) => bindsExpectedEntry(entry, changeRoot, expectedObject));
  if (bindings.length !== 1) {
    return rejectExemption(context, "the selected governance evidence does not bind the exact selected change-root tree");
  }
  return true;
}

function bindsExpectedEntry(entry, changeRoot, expectedObject) {
  if (entry?.path !== changeRoot) return false;
  return entry?.object === expectedObject;
}

function matchesCurrentChangeRoot(context, expectedObject) {
  const changeRoot = `openspec/changes/${context.selectedChange}`;
  const current = objectAtPath(context.head, changeRoot, context.repositoryRoot);
  if (current !== expectedObject) {
    return rejectExemption(context,
      "the selected change root differs from the reviewed technical candidate tree; the exemption is stale");
  }
  return true;
}

function hasDirectSignedRecord(recordEvidence, technical, context) {
  const candidates = signedRecordCommits(recordEvidence, technical, context);
  if (candidates.length === 1) return true;
  return rejectExemption(context,
    "the selected governance evidence was not introduced exactly once by a record-only direct child of its technical commit");
}

function signedRecordCommits(recordEvidence, technical, context) {
  const commits = commitsBetween(technical, context.head, context.repositoryRoot);
  if (commits === null) {
    rejectExemption(context, "the signed-governance history after the technical commit is unavailable");
    return [];
  }
  return commits.filter((commit) => isDirectRecordCommit(commit, technical, recordEvidence, context.repositoryRoot));
}

function isDirectRecordCommit(commit, technical, recordEvidence, cwd) {
  if (!isDirectChild(commit, technical, cwd)) return false;
  if (!touchesOnlyGovernanceRecord(commit, cwd)) return false;
  return carriesRecordEvidence(commit, recordEvidence, cwd);
}

function isDirectChild(commit, technical, cwd) {
  const parents = parentsOf(commit, cwd);
  if (!Array.isArray(parents)) return false;
  if (parents.length !== 1) return false;
  return parents[0] === technical;
}

function touchesOnlyGovernanceRecord(commit, cwd) {
  const paths = pathsChangedByCommit(commit, cwd);
  if (!Array.isArray(paths)) return false;
  if (paths.length !== 1) return false;
  return paths[0] === GOVERNANCE_RECORD_PATH;
}

function carriesRecordEvidence(commit, recordEvidence, cwd) {
  const manifest = manifestAtCommit(commit, cwd);
  if (manifest === null) return false;
  return manifest.governanceRecords.some((entry) => stableValue(entry) === stableValue(recordEvidence));
}

function manifestAtCommit(commit, cwd) {
  const text = blobAt(commit, GOVERNANCE_RECORD_PATH, cwd);
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text);
    return hasRecordsArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function rejectExemption(context, message) {
  context.sink.fail("cra-exemption-unauthorized", context.recordPath, message);
  return false;
}

function stableValue(value) {
  if (Array.isArray(value)) return `[${value.map(stableValue).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableValue(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function isRecord(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function summary(values) {
  return {
    repositoryRoot: values.repositoryRoot,
    change: values.selectedChange,
    base: values.base ?? null,
    head: values.head ?? null,
    rangeCommits: values.range?.commits.length ?? null,
    rangePaths: values.range?.paths.length ?? null,
    triggeringPaths: values.triggeringPaths ?? [],
    outcome: values.outcome ?? "rejected",
  };
}

function outcomeSummary(context, outcome) {
  return summary({
    repositoryRoot: context.repositoryRoot,
    selectedChange: context.selectedChange,
    base: context.range.base,
    head: context.range.head,
    range: context.range.range,
    triggeringPaths: context.triggeringPaths,
    outcome,
  });
}

function skipSummary(context) {
  return outcomeSummary(context, "approved-skip");
}

function rejectedSummary(context) {
  return outcomeSummary(context, "rejected");
}

function emit(result, sink, opts) {
  if (opts.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  if (sink.ok) {
    process.stdout.write(`${outcomeMessage(result.outcome)} for ${result.change}\n`);
    return;
  }
  process.stderr.write(formatDiagnostics(sink.failures, "contract reuse assessment failed"));
  if (sink.truncated) process.stderr.write("  diagnostics were truncated at the bounded limit\n");
}

function outcomeMessage(outcome) {
  if (outcome === "approved-skip") return "contract reuse assessment approved skip";
  if (outcome === "approved-exemption") return "contract reuse assessment approved exemption";
  return "contract reuse assessment CRA-validated pass";
}

function parseArguments(argv) {
  const parsed = { repoRoot: null, change: null, base: null, json: false, help: false };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [flag, inlineValue] = argument.includes("=") ? splitOnce(argument, "=") : [argument, null];
    const option = ARGUMENT_OPTIONS[flag];
    if (!option) rejectArgument(argument);
    if (!option.takesValue) {
      option.apply(parsed, null);
      continue;
    }
    const value = inlineValue ?? argv[++index];
    if (value === undefined) rejectArgument(`${flag} requires a value`);
    option.apply(parsed, value);
  }
  return parsed;
}

function valueOption(apply) {
  return Object.freeze({ takesValue: true, apply });
}

function flagOption(apply) {
  return Object.freeze({ takesValue: false, apply });
}

function rejectArgument(argument) {
  process.stderr.write(`unsupported argument: ${argument}\n${usage()}`);
  process.exit(2);
}

function splitOnce(value, separator) {
  const index = value.indexOf(separator);
  return [value.slice(0, index), value.slice(index + separator.length)];
}

function discoverRepositoryRoot() {
  const here = dirname(fileURLToPath(import.meta.url));
  const result = tryGit(["rev-parse", "--show-toplevel"], { cwd: here });
  return result.ok ? result.value.trim() : resolve(here, "../../..");
}

function usage() {
  return [
    "usage: node openspec/scripts/contract-reuse/check.mjs --change <active-change> [options]",
    "",
    "  --repo-root <path>   repository to inspect",
    "  --change <id>        exactly one active OpenSpec change to evaluate",
    "  --base <commit>      merge-base range baseline (default: origin/main or local main merge base)",
    "  --json               emit a machine-readable report",
    "  --help",
    "",
  ].join("\n");
}
