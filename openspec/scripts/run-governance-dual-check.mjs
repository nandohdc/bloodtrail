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
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const CHECKER = "openspec/scripts/check-design-pattern-governance.mjs";
const MODULE_DIR = "openspec/scripts/design-pattern-governance";

const options = parseArguments(process.argv.slice(2));
const repositoryRoot = discoverRepositoryRoot();

const baseRef = options.base ?? defaultBase();
const results = { base: baseRef, phase: options.phase, baseline: null, candidate: null, notes: [] };

let scratch = null;
try {
  results.candidate = runCandidate();
  results.baseline = runBaseline();
} finally {
  if (scratch) rmSync(scratch, { recursive: true, force: true });
}

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
    diagnostics: diagnosticIds(run.stdout),
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
    diagnostics: diagnosticIds(run.stdout),
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

function diagnosticIds(stdout) {
  try {
    const parsed = JSON.parse(stdout);
    return [...(parsed.failures ?? []).map((entry) => entry.id)].sort();
  } catch {
    return [];
  }
}

/**
 * Weakening checks the candidate cannot perform on itself. Each compares the
 * baseline's verdict with the candidate's; a candidate that passes where the
 * baseline fails is the signature of self-approval.
 */
function exitCode(result) {
  if (result.baseline === null) {
    return result.candidate.exit_code === 0 ? 0 : 1;
  }
  if (result.baseline.exit_code !== 0) return 1;
  if (result.candidate.exit_code !== 0) return 1;
  return 0;
}

function report(result) {
  if (options.json) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }
  for (const note of result.notes) process.stdout.write(`note: ${note}\n`);
  process.stdout.write(describe("candidate", result.candidate));
  process.stdout.write(describe("baseline ", result.baseline));

  if (result.baseline && result.baseline.exit_code !== 0 && result.candidate.exit_code === 0) {
    process.stderr.write(
      "dual-check disagreement: the trusted baseline rejects what the candidate accepts. "
      + "A candidate checker is never the sole judge of whether it weakened itself.\n",
    );
  }
}

function describe(label, run) {
  if (run === null) return `${label}: not run\n`;
  const verdict = run.exit_code === 0 ? "passed" : `failed (${run.diagnostics.join(", ") || "see stderr"})`;
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
