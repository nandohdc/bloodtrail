#!/usr/bin/env node
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import {
  evaluateMutationSummary,
  loadMutationManifest,
  preflightMutationAnchors,
  sha256Bytes,
} from "./normative-precedence/mutation-assurance.mjs";

// A fixture repository must never start Git's background maintenance, because a
// detached repack could still be rewriting its .git while the test uses or
// removes it (#780, as #775 and #772 did for the other fixture helpers).
const GIT_FIXTURE_CONFIG = Object.freeze(["-c", "maintenance.auto=false", "-c", "gc.auto=0"]);

const scriptDir = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(scriptDir, "../..");
const defaultManifest = "openspec/tests/design-pattern-governance/fixtures/normative-precedence/revision-3-mutants.json";
const defaultControls = "openspec/tests/design-pattern-governance/fixtures/normative-precedence/revision-3-negative-controls.json";
const controlFile = "openspec/tests/design-pattern-governance/mutation-assurance.test.mjs";

function command(cwd, executable, args) {
  return spawnSync(executable, args, { cwd, encoding: "utf8" });
}

function changedFiles(repoRoot) {
  const tracked = command(repoRoot, "git", ["diff", "--name-only", "HEAD"]);
  const untracked = command(repoRoot, "git", ["ls-files", "--others", "--exclude-standard"]);
  if (tracked.status !== 0 || untracked.status !== 0) throw new Error("cannot enumerate implementation overlay");
  return [...new Set(`${tracked.stdout}${untracked.stdout}`.split("\n").filter(Boolean))];
}

function copyChangedFiles(repoRoot, scratchRoot) {
  for (const path of changedFiles(repoRoot)) {
    const source = resolve(repoRoot, path);
    if (!existsSync(source)) continue;
    const target = resolve(scratchRoot, path);
    mkdirSync(dirname(target), { recursive: true });
    cpSync(source, target, { recursive: true });
  }
}

function run(cwd, args, failure) {
  const result = command(cwd, "git", [...GIT_FIXTURE_CONFIG, ...args]);
  if (result.status !== 0) throw new Error(result.stderr || failure);
  return result.stdout;
}

function commitOverlay(scratchRoot) {
  command(scratchRoot, "git", ["config", "user.name", "Mutation Harness"]);
  command(scratchRoot, "git", ["config", "user.email", "mutation@example.invalid"]);
  run(scratchRoot, ["add", "-A"], "cannot stage the overlay");
  const staged = run(scratchRoot, ["diff", "--cached", "--name-only"], "cannot inspect the staged overlay");
  if (staged.trim() === "") return;
  run(scratchRoot, ["commit", "-q", "--no-gpg-sign", "-m", "mutation baseline"], "cannot commit the mutation baseline");
}

function copyOverlay(repoRoot, scratchRoot) {
  copyChangedFiles(repoRoot, scratchRoot);
  commitOverlay(scratchRoot);
}

function makeScratch(repoRoot) {
  const scratchRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-r3-mutations-"));
  const clone = command(repoRoot, "git", ["clone", "--shared", "--quiet", repoRoot, scratchRoot]);
  if (clone.status !== 0) {
    rmSync(scratchRoot, { recursive: true, force: true });
    throw new Error(clone.stderr);
  }
  copyOverlay(repoRoot, scratchRoot);
  return scratchRoot;
}

function runControls(repoRoot, pattern = null) {
  const args = ["--test"];
  if (pattern) args.push(`--test-name-pattern=${pattern}`);
  args.push(controlFile);
  return command(repoRoot, process.execPath, args);
}

function applyMutant(repoRoot, mutant) {
  const path = resolve(repoRoot, mutant.target_path);
  const original = readFileSync(path);
  const text = original.toString("utf8");
  const mutated = text.replace(mutant.anchor, mutant.replacement);
  if (mutated === text) return { applied: false, original, path };
  writeFileSync(path, mutated, "utf8");
  return { applied: true, original, path };
}

function parseArgs(args) {
  const options = { repoRoot: defaultRoot, manifest: defaultManifest, controls: defaultControls, json: false };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--repo") options.repoRoot = resolve(args[++index]);
    else if (args[index] === "--manifest") options.manifest = args[++index];
    else if (args[index] === "--controls") options.controls = args[++index];
    else if (args[index] === "--json") options.json = true;
    else throw new Error(`unknown argument ${args[index]}`);
  }
  return options;
}

function runMutant(scratchRoot, mutant, control) {
  const state = applyMutant(scratchRoot, mutant);
  if (!state.applied) return { id: mutant.id, control_id: control.id, status: "NOT_APPLIED" };
  const testResult = runControls(scratchRoot, mutant.control_pattern);
  const status = testResult.status === 0 ? "SURVIVED" : "KILLED";
  writeFileSync(state.path, state.original);
  const restored = readFileSync(state.path);
  return {
    id: mutant.id,
    control_id: control.id,
    control_pattern: mutant.control_pattern,
    status,
    exit_code: testResult.status,
    restored: sha256Bytes(restored) === sha256Bytes(state.original),
  };
}

function summarise(manifest, controlManifest, results, dirtyControls) {
  const applied = results.filter((entry) => entry.status !== "NOT_APPLIED").length;
  const killed = results.filter((entry) => entry.status === "KILLED").length;
  return {
    expected: manifest.mutants.length,
    applied,
    killed,
    not_applied: manifest.mutants.length - applied,
    survived: applied - killed,
    dirty_controls: dirtyControls,
    restoration_mismatches: results.filter((entry) => entry.restored === false).length,
    negative_controls_expected: controlManifest.controls.length,
    negative_controls_detected: killed,
  };
}

function loadClosedManifests(scratchRoot, options) {
  const manifest = loadMutationManifest(scratchRoot, options.manifest);
  const controlManifest = loadMutationManifest(scratchRoot, options.controls);
  if (controlManifest.controls?.length !== manifest.mutants.length) {
    throw new Error("negative-control and mutant manifests must have the same closed cardinality");
  }
  return { manifest, controlManifest };
}

function dirtyControlCount(scratchRoot, baseline) {
  if (baseline.status !== 0) return 1;
  const dirty = command(scratchRoot, "git", ["status", "--porcelain"]);
  return dirty.status === 0 && dirty.stdout.trim() === "" ? 0 : 1;
}

function execute(options) {
  const scratchRoot = makeScratch(options.repoRoot);
  try {
    const { manifest, controlManifest } = loadClosedManifests(scratchRoot, options);
    const anchorDiagnostics = preflightMutationAnchors(scratchRoot, manifest);
    const baseline = runControls(scratchRoot);
    const runnable = anchorDiagnostics.length === 0 && baseline.status === 0 ? manifest.mutants : [];
    const results = runnable.map((mutant, index) => runMutant(scratchRoot, mutant, controlManifest.controls[index]));
    const summary = summarise(manifest, controlManifest, results, dirtyControlCount(scratchRoot, baseline));
    return {
      schema: "bloodtrail.normative-precedence.mutation-report.v1",
      anchor_preflight: anchorDiagnostics.length === 0 ? "PASS" : "FAIL",
      null_controls: baseline.status === 0 ? "CLEAN" : "DIRTY",
      restoration: summary.restoration_mismatches === 0 ? "BYTE_IDENTICAL" : "MISMATCH",
      summary,
      results,
      diagnostics: [...anchorDiagnostics, ...evaluateMutationSummary(summary)],
      baseline_stderr: baseline.status === 0 ? "" : baseline.stderr,
    };
  } finally {
    rmSync(scratchRoot, { recursive: true, force: true });
  }
}

try {
  const options = parseArgs(process.argv.slice(2));
  const report = execute(options);
  if (options.json) console.log(JSON.stringify(report, null, 2));
  else {
    console.log(`ANCHOR_PREFLIGHT=${report.anchor_preflight}`);
    console.log(`EXPECTED_MUTANTS=${report.summary.expected}`);
    console.log(`APPLIED_MUTANTS=${report.summary.applied}`);
    console.log(`KILLED_MUTANTS=${report.summary.killed}`);
    console.log(`NOT_APPLIED=${report.summary.not_applied}`);
    console.log(`SURVIVED=${report.summary.survived}`);
    console.log(`NULL_CONTROLS=${report.null_controls}`);
    console.log(`RESTORATION=${report.restoration}`);
  }
  process.exit(report.diagnostics.length === 0 ? 0 : 1);
} catch (error) {
  console.error(`normative-precedence-mutation-error: ${error.message}`);
  process.exit(2);
}
