#!/usr/bin/env node
/**
 * Baseline-plus-candidate governance verification.
 *
 * A governance-core change is judged twice: once by the **trusted baseline**
 * checker taken from the merge base with the protected mainline, and once by the
 * **candidate** checker on the branch. Both run against the candidate's data.
 *
 * The asymmetry is the point. A candidate checker edited to return success for
 * invalid evidence would pass its own run; the baseline, which that edit cannot
 * reach, still rejects it. Neither result substitutes for the other, and both are
 * recorded separately in the signed governance record.
 *
 * Usage:
 *   node openspec/scripts/run-governance-dual-check.mjs [--base <ref>] [--phase <phase>] [--json]
 */

import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKER = "openspec/scripts/check-design-pattern-governance.mjs";
const MODULE_DIR = "openspec/scripts/design-pattern-governance";
const POLICY = "openspec/governance/design-pattern-policy.json";

const options = parseArguments(process.argv.slice(2));
const repositoryRoot = discoverRepositoryRoot();

const baseRef = options.base ?? defaultBase();
const results = { base: baseRef, phase: options.phase, baseline: null, candidate: null, disagreement: null, notes: [] };

let scratch = null;
try {
  results.candidate = runCandidate();
  results.baseline = runBaseline();
} finally {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}

// Classified before reporting, so the report can state whether a disagreement
// was accepted rather than only that one exists.
results.disagreement = classifyDisagreement(results);
report(results);
process.exit(exitCode(results));

function runCandidate() {
  const run = spawnSync(process.execPath, [
    resolve(repositoryRoot, CHECKER), "--phase", options.phase, "--repo-root", repositoryRoot, "--json",
  ], { encoding: "utf8", cwd: repositoryRoot });
  return {
    source_ref: "candidate (working tree)",
    checker_blob: blobAt("HEAD", CHECKER) ?? "uncommitted",
    exit_code: run.status ?? 1,
    diagnostics: diagnosticEntries(run.stdout),
    stderr: (run.stderr ?? "").trim().slice(0, 2000),
  };
}

function runBaseline() {
  if (baseRef === null) {
    results.notes.push("no protected-mainline reference resolved; baseline comparison unavailable");
    return null;
  }
  const baselineChecker = blobAt(baseRef, CHECKER);
  if (baselineChecker === null) {
    // The change that introduces governance has no baseline to be judged by.
    // That is the bootstrap window, and it is exactly why bootstrap requires
    // exact approved objects and human review rather than a passing checker.
    results.notes.push(
      `no governance checker exists at ${baseRef.slice(0, 12)}; this change introduces it, so baseline validation is unavailable and bootstrap review carries that weight instead`,
    );
    return null;
  }

  scratch = mkdtempSync(join(tmpdir(), "bloodtrail-governance-baseline-"));
  materialiseBaseline(scratch);

  const run = spawnSync(process.execPath, [
    join(scratch, CHECKER), "--phase", options.phase, "--repo-root", repositoryRoot, "--json",
  ], { encoding: "utf8", cwd: repositoryRoot });

  return {
    source_ref: baseRef,
    checker_blob: baselineChecker,
    exit_code: run.status ?? 1,
    diagnostics: diagnosticEntries(run.stdout),
    stderr: (run.stderr ?? "").trim().slice(0, 2000),
  };
}

/**
 * Materialises the baseline checker and its modules only. The policy, schemas,
 * catalog, and registry are deliberately NOT copied: the baseline code must read
 * the candidate's data, or it would be checking the past against the past.
 */
function materialiseBaseline(root) {
  mkdirSync(join(root, MODULE_DIR), { recursive: true });
  writeFileSync(join(root, CHECKER), git(["show", `${baseRef}:${CHECKER}`]), "utf8");
  for (const entry of listTree(baseRef, MODULE_DIR)) {
    writeFileSync(join(root, entry), git(["show", `${baseRef}:${entry}`]), "utf8");
  }
}

function listTree(ref, path) {
  const output = git(["ls-tree", "-r", "--name-only", "-z", ref, "--", path]);
  return output.split("\0").filter((entry) => entry.length > 0);
}

/**
 * Failures as id-and-path pairs, not bare ids. An acceptance that named only the
 * id would cover the same diagnostic wherever it was raised, so the path is part
 * of what gets reviewed and matched.
 */
function diagnosticEntries(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    // Code-point ordering, never localeCompare: this output must not vary by locale.
    return (parsed.failures ?? [])
      .map((entry) => ({ id: String(entry.id), path: String(entry.path) }))
      .sort((left, right) => byCodePoint(`${left.id} ${left.path}`, `${right.id} ${right.path}`));
  } catch {
    return [];
  }
}

function diagnosticLabels(entries) {
  return entries.map((entry) => `${entry.id} at ${entry.path}`);
}

/** Code-point ordering. Deliberately not localeCompare: output must not vary by locale. */
function byCodePoint(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

/**
 * Weakening checks the candidate cannot perform on itself. Each compares the
 * baseline's verdict with the candidate's; a candidate that passes where the
 * baseline fails is the signature of self-approval — unless the signed record
 * accepted that exact disagreement in advance. See classifyDisagreement.
 */
function exitCode(result) {
  if (result.candidate.exit_code !== 0) return 1;
  if (result.baseline === null) return 0;
  if (result.baseline.exit_code === 0) return 0;
  return result.disagreement?.accepted === true ? 0 : 1;
}

/**
 * Classifies a baseline-rejects/candidate-accepts disagreement, or null when
 * there is none.
 *
 * Such a disagreement has two possible causes and the verdicts alone cannot tell
 * them apart: a candidate edited to approve itself, and a candidate that repairs
 * a false positive the baseline raises. Treating every disagreement as
 * self-approval makes the second case unlandable, which would freeze the checker
 * against its own defects; treating it as a repair would let a weakened checker
 * clear its own gate. So the disagreement is tolerated only when one canonical
 * current signed record accepted exactly this disagreement in advance.
 *
 * Every part of that is exact rather than sufficient. One acceptance on one
 * record, never a list and never combined across records, so no acceptance can
 * be assembled from fragments. The declared diagnostics must equal the raised
 * ones as id-and-path pairs, so a superset cannot pre-approve rejections nobody
 * reviewed. The named technical commit must be the record's own reviewed commit
 * and the record must have been committed as that commit's direct child, so an
 * acceptance signed against different code is stale. The named baseline and
 * phase must be the ones actually compared, which also makes the acceptance
 * expire by itself: once the repair lands the baseline moves and it matches
 * nothing. Any failure to establish all of that leaves the disagreement
 * rejected.
 */
function classifyDisagreement(result) {
  if (!baselineRejectsCandidatePass(result)) return null;
  const raised = result.baseline.diagnostics;
  // A baseline that failed without parseable diagnostics cannot be accepted:
  // there is nothing the record could have named, so there is nothing to review.
  if (raised.length === 0) return { raised, accepted: false, rejection: "the baseline produced no parseable diagnostics" };
  const resolved = resolveAcceptance(result);
  if (resolved.rejection !== null) return { raised, accepted: false, rejection: resolved.rejection };
  return matchAcceptance(resolved.acceptance, raised, result);
}

/** Compares a validated acceptance against what the baseline actually raised. */
function matchAcceptance(acceptance, raised, result) {
  const mismatch = firstMismatch(acceptance, raised, result);
  if (mismatch !== null) return { raised, accepted: false, rejection: mismatch };
  return { raised, accepted: true, rejection: null, reason: acceptance.reason };
}

function firstMismatch(acceptance, raised, result) {
  if (acceptance.baseline !== result.base) {
    return `the acceptance names baseline ${acceptance.baseline.slice(0, 12)}, not ${String(result.base).slice(0, 12)}`;
  }
  if (acceptance.phase !== result.phase) {
    return `the acceptance names phase ${acceptance.phase}, not ${result.phase}`;
  }
  return diagnosticsMismatch(acceptance.diagnostics, raised);
}

/** Exact structured equality between declared and raised diagnostics. */
function diagnosticsMismatch(declared, raised) {
  const asKeys = (entries) => entries.map((entry) => `${entry.id} ${entry.path}`).sort();
  const declaredKeys = asKeys(declared);
  const raisedKeys = asKeys(raised);
  if (declaredKeys.length === raisedKeys.length && declaredKeys.every((key, index) => key === raisedKeys[index])) {
    return null;
  }
  return "the accepted diagnostics are not exactly the ones the baseline raised"
    + ` (accepted ${describeKeys(declaredKeys)}; raised ${describeKeys(raisedKeys)})`;
}

function describeKeys(keys) {
  return keys.length === 0 ? "none" : keys.map((key) => key.replace(" ", " at ")).join("; ");
}

/**
 * The single acceptance the signed-record source authorises, or a rejection
 * reason. Reading anything here is best-effort by design: an unreadable policy,
 * source, or schema yields a rejection, never a default acceptance.
 */
function resolveAcceptance(result) {
  const source = readRecordSource();
  if (source === null) return reject("the signed-record source named by the policy could not be read");

  const carriers = source.records.filter((record) => isObject(record) && record.baselineDisagreementAcceptance !== undefined);
  if (carriers.length !== 1) {
    return reject(`exactly one governance record may carry an acceptance, found ${carriers.length}`);
  }
  const record = carriers[0];
  if (record.signed !== true) return reject("the record carrying the acceptance is not signed");

  const canonical = source.records.filter((other) => isObject(other) && other.signed === true && other.change === record.change);
  if (canonical.length !== 1) {
    return reject(`${String(record.change)} must have exactly one current signed record, found ${canonical.length}`);
  }
  return validateAcceptance(record, source.path, result);
}

function validateAcceptance(record, recordPath, result) {
  const schema = readAcceptanceSchema();
  if (schema === null) return reject("the baseline-disagreement schema could not be read as a closed schema");
  const invalid = validateAgainstSchema(record.baselineDisagreementAcceptance, schema, "acceptance");
  if (invalid !== null) return reject(`the acceptance does not satisfy its closed schema: ${invalid}`);
  return bindAcceptanceToCommits(record, recordPath, result);
}

/**
 * Ties the acceptance to the exact reviewed commit and to the record commit that
 * carries it. The record commit is derived from history rather than declared,
 * because a commit cannot record its own identifier.
 */
function bindAcceptanceToCommits(record, recordPath, result) {
  const acceptance = record.baselineDisagreementAcceptance;
  if (acceptance.technicalCommit !== record.reviewedCommit) {
    return reject("the acceptance names a technical commit that is not the record's own reviewedCommit");
  }
  const signedCommit = commitIntroducingRecord(recordPath, acceptance.technicalCommit);
  if (signedCommit === null) {
    return reject(`no commit after ${acceptance.technicalCommit.slice(0, 12)} introduces the current record bytes`);
  }
  const parents = parentsOf(signedCommit);
  if (parents.length !== 1 || parents[0] !== acceptance.technicalCommit) {
    return reject(`the record commit ${signedCommit.slice(0, 12)} is not a direct child of ${acceptance.technicalCommit.slice(0, 12)}`);
  }
  result.acceptanceRecordCommit = signedCommit;
  return { acceptance, rejection: null };
}

/** The first commit after `technical` whose record bytes are the current ones. */
function commitIntroducingRecord(recordPath, technical) {
  const current = tryGit(["rev-parse", `HEAD:${recordPath}`])?.trim();
  if (!current) return null;
  const range = tryGit(["rev-list", "--reverse", `${technical}..HEAD`]);
  if (range === null) return null;
  for (const commit of range.split("\n").map((line) => line.trim()).filter(Boolean)) {
    if (tryGit(["rev-parse", `${commit}:${recordPath}`])?.trim() === current) return commit;
  }
  return null;
}

function parentsOf(commit) {
  const output = tryGit(["rev-list", "--parents", "-n", "1", commit]);
  return output === null ? [] : output.trim().split(/\s+/).slice(1);
}

/** The signed-record source the policy names, or null when anything is unreadable. */
function readRecordSource() {
  try {
    const policy = JSON.parse(readFileSync(resolve(repositoryRoot, POLICY), "utf8"));
    const recordPath = policy.review_freshness?.record_path;
    if (typeof recordPath !== "string" || recordPath.length === 0) return null;
    const parsed = JSON.parse(readFileSync(resolve(repositoryRoot, recordPath), "utf8"));
    if (!Array.isArray(parsed?.governanceRecords)) return null;
    return { path: recordPath, records: parsed.governanceRecords };
  } catch {
    return null;
  }
}

/**
 * The closed schema the acceptance is judged against, loaded rather than
 * duplicated in code so the declared field set and the enforced one cannot
 * drift apart.
 */
function readAcceptanceSchema() {
  try {
    const policy = JSON.parse(readFileSync(resolve(repositoryRoot, POLICY), "utf8"));
    const schemaPath = policy.schemas?.baseline_disagreement;
    if (typeof schemaPath !== "string") return null;
    const schema = JSON.parse(readFileSync(resolve(repositoryRoot, schemaPath), "utf8"));
    if (schema?.closed !== true || !isObject(schema.fields)) return null;
    return schema;
  } catch {
    return null;
  }
}

function reject(rejection) {
  return { acceptance: null, rejection };
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Validates a value against one closed-schema field table, returning the first
 * violation or null. Closed means unknown keys are violations: a field nobody
 * declared is a field nobody reviewed.
 */
function validateAgainstSchema(value, schema, label) {
  if (!isObject(value)) return `${label} is not an object`;
  const fields = schema.fields;
  const unknown = Object.keys(value).find((key) => fields[key] === undefined);
  if (unknown !== undefined) return `${label} carries undeclared field ${unknown}`;
  for (const [name, definition] of Object.entries(fields)) {
    const violation = validateField(value[name], definition, `${label}.${name}`);
    if (violation !== null) return violation;
  }
  return null;
}

function validateField(value, definition, label) {
  if (value === undefined) {
    return definition.required === true ? `${label} is required` : null;
  }
  if (definition.type === "array") return validateArrayField(value, definition, label);
  if (definition.type === "object") return validateAgainstSchema(value, definition, label);
  return validateStringField(value, definition, label);
}

function validateArrayField(value, definition, label) {
  if (!Array.isArray(value)) return `${label} is not an array`;
  if (definition.min_items !== undefined && value.length < definition.min_items) {
    return `${label} has fewer than ${definition.min_items} item(s)`;
  }
  if (definition.max_items !== undefined && value.length > definition.max_items) {
    return `${label} has more than ${definition.max_items} item(s)`;
  }
  return firstItemViolation(value, definition.items, label);
}

function firstItemViolation(value, items, label) {
  if (items === undefined) return null;
  for (const [index, entry] of value.entries()) {
    const violation = validateAgainstSchema(entry, items, `${label}[${index}]`);
    if (violation !== null) return violation;
  }
  return null;
}

function validateStringField(value, definition, label) {
  if (typeof value !== "string") return `${label} is not a string`;
  return violatedStringConstraint(value, definition, label);
}

/** Constraints in declaration order, so the reported violation is the first one. */
function violatedStringConstraint(value, definition, label) {
  if (isOutsideEnum(value, definition)) return `${label} is not one of ${definition.enum.join(", ")}`;
  if (isOffPattern(value, definition)) return `${label} does not match ${definition.pattern}`;
  return violatedLengthConstraint(value, definition, label);
}

function violatedLengthConstraint(value, definition, label) {
  // Trimmed for the minimum so whitespace cannot pad a reason to length, but raw
  // for the maximum so a bound stays a bound.
  if (definition.min_length !== undefined && value.trim().length < definition.min_length) {
    return `${label} is shorter than ${definition.min_length} character(s)`;
  }
  if (definition.max_length !== undefined && value.length > definition.max_length) {
    return `${label} is longer than ${definition.max_length} character(s)`;
  }
  return null;
}

function isOutsideEnum(value, definition) {
  return Array.isArray(definition.enum) && !definition.enum.includes(value);
}

function isOffPattern(value, definition) {
  return definition.pattern !== undefined && !new RegExp(definition.pattern).test(value);
}

function report(result) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  for (const note of result.notes) process.stdout.write(`note: ${note}\n`);
  process.stdout.write(describe("candidate", result.candidate));
  process.stdout.write(describe("baseline ", result.baseline));

  reportSelfApprovalDisagreement(result);
}

function reportSelfApprovalDisagreement(result) {
  const disagreement = result.disagreement;
  if (disagreement === null) return;
  if (disagreement.accepted) {
    process.stdout.write(
      `baseline disagreement accepted for baseline ${String(result.base).slice(0, 12)} in ${result.phase} phase `
      + `by the signed record committed at ${String(result.acceptanceRecordCommit).slice(0, 12)}: `
      + `${diagnosticLabels(disagreement.raised).join("; ")}\n`,
    );
    return;
  }
  process.stderr.write(
    "dual-check disagreement: the trusted baseline rejects what the candidate accepts. "
    + "A candidate checker is never the sole judge of whether it weakened itself.\n"
    + `not accepted: ${disagreement.rejection}\n`,
  );
}

function baselineRejectsCandidatePass(result) {
  if (!result.baseline) return false;
  if (result.baseline.exit_code === 0) return false;
  return result.candidate.exit_code === 0;
}

function describe(label, run) {
  if (run === null) return `${label}: not run\n`;
  const verdict = run.exit_code === 0 ? "passed" : `failed (${diagnosticLabels(run.diagnostics).join("; ") || "see stderr"})`;
  return `${label}: ${verdict} — checker blob ${run.checker_blob.slice(0, 12)} from ${run.source_ref}\n`;
}

function defaultBase() {
  for (const candidate of ["refs/remotes/origin/main", "refs/heads/main", "main"]) {
    const resolved = tryGit(["merge-base", candidate, "HEAD"]);
    if (resolved !== null) return resolved.trim();
  }
  return null;
}

function blobAt(ref, path) {
  return tryGit(["rev-parse", `${ref}:${path}`])?.trim() ?? null;
}

function git(args) {
  return execFileSync("git", args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    // Absence of a path at a ref is an expected answer here, not an incident.
    // Letting git narrate it to stderr would put "fatal:" in a passing run's log.
    stdio: ["ignore", "pipe", "pipe"],
  });
}

function tryGit(args) {
  try {
    return git(args);
  } catch {
    return null;
  }
}

/**
 * Resolves from the working directory before falling back to this script's own
 * location. Discovering only from the script's directory made every invocation
 * inspect the repository the script happens to live in, so running it against
 * another checkout silently reported on the wrong tree.
 */
function discoverRepositoryRoot() {
  if (options.repoRoot) return options.repoRoot;
  for (const cwd of [process.cwd(), dirname(fileURLToPath(import.meta.url))]) {
    try {
      return execFileSync("git", ["rev-parse", "--show-toplevel"], {
        cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"],
      }).trim();
    } catch {
      continue;
    }
  }
  return resolve(dirname(fileURLToPath(import.meta.url)), "../..");
}

function parseArguments(argv) {
  const parsed = { base: null, phase: "final", json: false, repoRoot: null };
  for (let index = 0; index < argv.length; index += 1) {
    switch (argv[index]) {
      case "--base": parsed.base = argv[++index]; break;
      case "--phase": parsed.phase = argv[++index]; break;
      case "--repo-root": parsed.repoRoot = resolve(argv[++index]); break;
      case "--json": parsed.json = true; break;
      default:
        process.stderr.write(`unsupported argument: ${argv[index]}\n`);
        process.exit(2);
    }
  }
  return parsed;
}
