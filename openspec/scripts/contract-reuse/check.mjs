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

function run(opts, sink) {
  const repositoryRoot = opts.repoRoot ?? discoverRepositoryRoot();
  const selectedChange = selectActiveChange(repositoryRoot, opts.change, sink);
  if (selectedChange === null) return summary({ repositoryRoot, selectedChange: null });

  if (!historyIsComplete(repositoryRoot)) {
    sink.fail("cra-range-unavailable", ".", "the CRA checker requires complete local Git history to establish its merge-base range");
    return summary({ repositoryRoot, selectedChange });
  }

  const base = resolveBase(opts.base, repositoryRoot, sink);
  const head = resolveCommit("HEAD", repositoryRoot);
  if (base === null || head === null) {
    sink.fail("cra-range-unavailable", ".", "the selected change range cannot be resolved from complete local Git history");
    return summary({ repositoryRoot, selectedChange, base, head });
  }
  if (!isAncestor(base, head, repositoryRoot)) {
    sink.fail("cra-range-unavailable", ".", "the CRA range base is not an ancestor of the evaluated change head");
    return summary({ repositoryRoot, selectedChange, base, head });
  }

  const range = collectRangePaths(base, head, repositoryRoot, sink);
  if (range === null) {
    sink.fail("cra-range-unavailable", ".", "the selected change range cannot be enumerated");
    return summary({ repositoryRoot, selectedChange, base, head });
  }

  const triggeringPaths = range.paths.filter((path) => isTriggerPath(path, selectedChange));
  if (triggeringPaths.length === 0) {
    return summary({
      repositoryRoot,
      selectedChange,
      base,
      head,
      range,
      triggeringPaths,
      outcome: "approved-skip",
    });
  }

  const changes = collectOpenSpecChanges(
    range.paths,
    (changeId) => readAssessment(repositoryRoot, changeId),
    activeChangeIds(repositoryRoot),
  );
  if (!attributesEveryTrigger(triggeringPaths, changes, selectedChange, sink)) {
    return summary({ repositoryRoot, selectedChange, base, head, range, triggeringPaths, outcome: "rejected" });
  }

  const recordPath = changeRecordPath(selectedChange);
  const record = readCraRecord(repositoryRoot, recordPath, sink);
  if (record === null) {
    return summary({ repositoryRoot, selectedChange, base, head, range, triggeringPaths, outcome: "rejected" });
  }

  if (!hasSupportedContract(record, recordPath, sink)) {
    return summary({ repositoryRoot, selectedChange, base, head, range, triggeringPaths, outcome: "rejected" });
  }

  const structuralStart = sink.count;
  const schema = loadCraSchema(repositoryRoot, sink);
  if (schema !== null) validateCraRecord(schema, record, { documentPath: recordPath, sink });
  if (sink.count !== structuralStart) {
    sink.fail("cra-record-invalid", recordPath,
      "the required Contract Reuse Assessment does not satisfy its closed structural record shape");
    if (record.mode === "exemption") {
      sink.fail("cra-exemption-unauthorized", recordPath,
        "an exemption must first satisfy the closed exemption record shape before external evidence can be recognized");
    }
    return summary({ repositoryRoot, selectedChange, base, head, range, triggeringPaths, outcome: "rejected" });
  }

  if (record.mode === "assessment") {
    if (!resolveAssessmentReferences(record, repositoryRoot, recordPath, sink)) {
      return summary({ repositoryRoot, selectedChange, base, head, range, triggeringPaths, outcome: "rejected" });
    }
    return summary({ repositoryRoot, selectedChange, base, head, range, triggeringPaths, outcome: "cra-validated" });
  }

  if (record.mode === "exemption") {
    if (!validateExemption(record, { repositoryRoot, selectedChange, recordPath, head, sink })) {
      return summary({ repositoryRoot, selectedChange, base, head, range, triggeringPaths, outcome: "rejected" });
    }
    return summary({ repositoryRoot, selectedChange, base, head, range, triggeringPaths, outcome: "approved-exemption" });
  }

  sink.fail("cra-record-invalid", recordPath, "the required Contract Reuse Assessment selects no supported record mode");
  return summary({ repositoryRoot, selectedChange, base, head, range, triggeringPaths, outcome: "rejected" });
}

function selectActiveChange(repositoryRoot, change, sink) {
  if (typeof change !== "string" || !CHANGE_ID.test(change)) {
    sink.fail("cra-change-invalid", "--change", "a CRA evaluation requires one safe selected active OpenSpec change id");
    return null;
  }
  if (!activeChangeIds(repositoryRoot).includes(change)) {
    sink.fail("cra-change-absent", `openspec/changes/${change}`,
      "the selected CRA change is not an active OpenSpec change directory");
    return null;
  }
  return change;
}

function resolveBase(requestedBase, cwd, sink) {
  if (requestedBase) {
    if (typeof requestedBase !== "string" || requestedBase.length === 0 || requestedBase.length > 1000
      || requestedBase.startsWith("-")) {
      sink.fail("cra-range-unavailable", ".", "the supplied CRA range base must be one safe Git revision string");
      return null;
    }
    const resolved = resolveCommit(requestedBase, cwd);
    if (resolved !== null) return resolved;
    sink.fail("cra-range-unavailable", ".", "the supplied CRA range base does not resolve to a commit");
    return null;
  }
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

function attributesEveryTrigger(triggeringPaths, changes, selectedChange, sink) {
  let attributed = true;
  for (const path of triggeringPaths) {
    const matches = changes.filter((change) => matchesSelection(path, change.ownedPaths));
    if (matches.length === 1 && matches[0].id === selectedChange) continue;
    sink.fail("cra-trigger-unattributable", path, attributionMessage(matches, selectedChange));
    attributed = false;
  }
  return attributed;
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
    sink.fail("cra-record-malformed", recordPath, "the required contract-reuse.json record does not contain valid JSON");
    return null;
  }
}

function hasSupportedContract(record, recordPath, sink) {
  if (isRecord(record) && record.contract === REQUIRED_CONTRACT) return true;
  sink.fail("cra-contract-unsupported", recordPath,
    "the CRA checker supports exactly security-audit@1.0.0 and does not select another contract source");
  return false;
}

function resolveAssessmentReferences(record, repositoryRoot, recordPath, sink) {
  if (record.disposition !== "reuse" && record.disposition !== "extend") return true;
  const source = readCanonicalContract(repositoryRoot, sink);
  if (source === null) return false;
  let resolved = true;
  for (const reference of record.mechanism_references ?? []) {
    if (resolvesReference(source, reference)) continue;
    sink.fail("cra-mechanism-unresolved", recordPath,
      `the canonical security-audit source does not resolve mechanism reference ${describeSafeReference(reference)}`);
    resolved = false;
  }
  return resolved;
}

function readCanonicalContract(repositoryRoot, sink) {
  let text;
  try {
    text = readFileSync(resolve(repositoryRoot, CANONICAL_CONTRACT_PATH), "utf8");
  } catch {
    sink.fail("cra-contract-source-unavailable", CANONICAL_CONTRACT_PATH,
      "the supported canonical security-audit source is absent or unreadable");
    return null;
  }
  try {
    const source = JSON.parse(text);
    if (source?.authoritative_source !== true || source?.metadata?.schema_version !== "1.0.0") {
      sink.fail("cra-contract-source-unavailable", CANONICAL_CONTRACT_PATH,
        "the supported canonical source is not the authoritative security-audit source at schema version 1.0.0");
      return null;
    }
    return source;
  } catch {
    sink.fail("cra-contract-source-unavailable", CANONICAL_CONTRACT_PATH,
      "the supported canonical security-audit source does not contain valid JSON");
    return null;
  }
}

function resolvesReference(source, reference) {
  if (typeof reference !== "string" || !SAFE_REFERENCE.test(reference)) return false;
  let value = source;
  for (const segment of reference.split(".")) {
    if (!isRecord(value) || !Object.hasOwn(value, segment)) return false;
    value = value[segment];
  }
  return true;
}

function describeSafeReference(reference) {
  if (typeof reference === "string" && reference.length <= 200 && SAFE_REFERENCE.test(reference)) {
    return JSON.stringify(reference);
  }
  return "a structurally invalid reference";
}

function validateExemption(record, context) {
  if (record.governance_locator?.change !== context.selectedChange) {
    return rejectExemption(context, "an exemption locator must name the selected CRA change");
  }
  const manifest = readGovernanceManifest(context.repositoryRoot, context.sink);
  if (manifest === null) return false;
  const matches = manifest.governanceRecords.filter((entry) => entry?.change === context.selectedChange);
  if (matches.length !== 1) {
    return rejectExemption(context,
      "the fixed governance-record source must contain exactly one record for the selected exemption change");
  }
  const recordEvidence = matches[0];
  if (!hasRequiredExemptionFields(recordEvidence, context)) return false;

  const technical = resolveCommit(recordEvidence.reviewedCommit, context.repositoryRoot);
  if (technical === null || technical !== recordEvidence.reviewedCommit) {
    return rejectExemption(context, "the exemption reviewed technical commit is unavailable or not an exact commit object");
  }
  if (!isAncestor(technical, context.head, context.repositoryRoot)) {
    return rejectExemption(context, "the exemption reviewed technical commit is not an ancestor of the evaluated change head");
  }
  if (!hasExactReviewedContent(recordEvidence, technical, context)) return false;
  return hasDirectSignedRecord(recordEvidence, technical, context);
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
    if (isRecord(manifest) && Array.isArray(manifest.governanceRecords)) return manifest;
  } catch {
    // The bounded diagnostic deliberately does not expose parser details from an external evidence source.
  }
  sink.fail("cra-exemption-unauthorized", GOVERNANCE_RECORD_PATH,
    "the fixed signed-governance source does not contain a governanceRecords array");
  return null;
}

function hasRequiredExemptionFields(record, context) {
  if (!isRecord(record) || record.signed !== true) {
    return rejectExemption(context, "the selected governance evidence is not a signed record");
  }
  if (record.reviewer?.name !== PROJECT_OWNER) {
    return rejectExemption(context, "the selected governance evidence is not signed by the project owner");
  }
  const token = `contract-reuse-exemption:${context.selectedChange}`;
  if (!Array.isArray(record.authorizations?.granted) || !record.authorizations.granted.includes(token)) {
    return rejectExemption(context, "the selected governance evidence grants no exact CRA exemption token");
  }
  if (typeof record.reviewedCommit !== "string" || !OBJECT_ID.test(record.reviewedCommit)) {
    return rejectExemption(context, "the selected governance evidence names no exact reviewed technical commit");
  }
  return true;
}

function hasExactReviewedContent(record, technical, context) {
  const candidateRoot = treeOf(technical, context.repositoryRoot);
  if (candidateRoot === null || record.reviewedContent?.candidateRoot !== candidateRoot) {
    return rejectExemption(context, "the selected governance evidence does not bind the reviewed technical tree");
  }
  const changeRoot = `openspec/changes/${context.selectedChange}`;
  const expectedObject = objectAtPath(technical, changeRoot, context.repositoryRoot);
  const entries = record.reviewedContent?.entries;
  const bindings = Array.isArray(entries)
    ? entries.filter((entry) => entry?.path === changeRoot && entry?.object === expectedObject)
    : [];
  if (expectedObject === null || bindings.length !== 1) {
    return rejectExemption(context, "the selected governance evidence does not bind the exact selected change-root tree");
  }
  if (objectAtPath(context.head, changeRoot, context.repositoryRoot) !== expectedObject) {
    return rejectExemption(context,
      "the selected change root differs from the reviewed technical candidate tree; the exemption is stale");
  }
  return true;
}

function hasDirectSignedRecord(recordEvidence, technical, context) {
  const candidates = signedRecordCommits(recordEvidence, technical, context);
  if (candidates.length !== 1) {
    return rejectExemption(context,
      "the selected governance evidence was not introduced exactly once by a record-only direct child of its technical commit");
  }
  return true;
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
  const parents = parentsOf(commit, cwd);
  if (!Array.isArray(parents) || parents.length !== 1 || parents[0] !== technical) return false;
  const paths = pathsChangedByCommit(commit, cwd);
  if (!Array.isArray(paths) || paths.length !== 1 || paths[0] !== GOVERNANCE_RECORD_PATH) return false;
  const manifest = manifestAtCommit(commit, cwd);
  if (manifest === null) return false;
  return manifest.governanceRecords.some((entry) => stableValue(entry) === stableValue(recordEvidence));
}

function manifestAtCommit(commit, cwd) {
  const text = blobAt(commit, GOVERNANCE_RECORD_PATH, cwd);
  if (text === null) return null;
  try {
    const parsed = JSON.parse(text);
    return isRecord(parsed) && Array.isArray(parsed.governanceRecords) ? parsed : null;
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
    const value = option.takesValue ? (inlineValue ?? argv[++index]) : null;
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
