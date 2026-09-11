import test, { describe, it, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { disposableGitEnvironment, runDisposableGit } from "./disposable-git.mjs";

// Drives its negative cases by writing intentionally-invalid lifecycle metadata, so
// it must never touch the live tree: sibling verification files snapshot the live
// package with cpSync and node --test runs test files in parallel processes.
const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-toolchain-exemption-"));
const caseRoot = resolve(suiteRoot, "control");
const casePackage = resolve(caseRoot, "packages/security-audit-sdk-core");
const lifecyclePath = resolve(casePackage, "verification-lifecycle.json");
const exemptPath = "contracts/security-audit/package-lock.json";
const unexemptPath = "contracts/security-audit/README.md";
const candidatePath = "contracts/security-audit/source/contract.source.json";

prepareCase();
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

const pristineLifecycle = readFileSync(lifecyclePath, "utf8");

function prepareCase() {
  // Full history: the checker requires the proposal baseline to be an ancestor of HEAD.
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, caseRoot]);
  cpSync(packageRoot, casePackage, {
    recursive: true,
    force: true,
    filter: (source) => !["node_modules", "dist", "dist-tests", "dist-examples", ".verification-output"].includes(basename(source)),
  });
  git(caseRoot, ["add", "-A"]);
  git(caseRoot, ["commit", "--allow-empty", "-m", "test: isolated toolchain-exemption control"]);
}

function git(root, args) {
  const result = runDisposableGit(root, args);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

// Both gates read the same governed-candidate record, so they are driven through
// one runner: two copies differing only in the script name would be duplication,
// and the pair would drift the moment either gate's invocation changed.
function runGate(script) {
  const result = spawnSync(process.execPath, [script], {
    cwd: casePackage, encoding: "utf8", timeout: 60000,
    env: {
      ...disposableGitEnvironment(),
      SDK_VERIFICATION_MODE: "auto",
      SDK_VERIFICATION_CHANGE: "remediate-security-audit-sdk-adversarial-review",
    },
  });
  if (result.status === 0) return { passed: true, output: result.stdout };
  return { passed: false, output: `${result.stdout}\n${result.stderr}` };
}

const runChecker = () => runGate("scripts/check-changed-paths.mjs");
const runCoherence = () => runGate("scripts/check-coherence.mjs");

// The checker names its candidate by change id and resolves it to the active
// directory or the single dated archive. Resolving it the same way here keeps
// these controls working after this change is archived and its root moves.
function candidateRoot() {
  const change = JSON.parse(pristineLifecycle).contract.governedCandidate.change;
  const active = resolve(caseRoot, "openspec/changes", change);
  if (existsSync(active)) return active;
  const archiveRoot = resolve(caseRoot, "openspec/changes/archive");
  const dated = readdirSync(archiveRoot).filter((entry) => new RegExp(`^\\d{4}-\\d{2}-\\d{2}-${change}$`).test(entry));
  assert.equal(dated.length, 1, `expected exactly one archive for ${change}, found ${dated.length}`);
  return resolve(archiveRoot, dated[0]);
}

function setExemptions(entries) {
  const meta = JSON.parse(pristineLifecycle);
  meta.contract.toolchainExemptions = entries;
  writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
}

function setCandidatePaths(entries) {
  const meta = JSON.parse(pristineLifecycle);
  meta.contract.governedCandidate.protectedPaths = entries;
  writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
}

function setCandidateField(field, value) {
  const meta = JSON.parse(pristineLifecycle);
  meta.contract.governedCandidate[field] = value;
  if (field === "technicalCommit") meta.contract.normativeTechnicalTarget = value;
  writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
}

function touch(relativePath) {
  const target = resolve(caseRoot, relativePath);
  writeFileSync(target, `${readFileSync(target, "utf8")}\n`, "utf8");
}

function restoreTree() {
  git(caseRoot, ["checkout", "--", "contracts/security-audit"]);
}

describe("contract build-toolchain exemptions", () => {
  beforeEach(() => {
    writeFileSync(lifecyclePath, pristineLifecycle, "utf8");
    restoreTree();
  });

  it("lets an exempted toolchain file change, and still classifies it", () => {
    setExemptions([exemptPath]);
    touch(exemptPath);
    const result = runChecker();
    assert.equal(result.passed, true, `expected the exempted path to pass:\n${result.output}`);
    assert.match(result.output, /"event-contract":\s*[1-9]\d*/,
      "the exempted path must stay classified rather than disappear from the record set");
  });

  it("rejects a byte-different write to an otherwise declared governed candidate path", () => {
    touch(candidatePath);
    const result = runChecker();
    assert.equal(result.passed, false, "a candidate path with different bytes must fail");
    assert.match(result.output, new RegExp(`${candidatePath}.*contract governance drift`));
  });

  it("rejects a governed candidate inventory that differs from its technical commit", () => {
    const meta = JSON.parse(pristineLifecycle);
    setCandidatePaths(meta.contract.governedCandidate.protectedPaths.filter((path) => path !== candidatePath));
    const result = runChecker();
    assert.equal(result.passed, false, "a shortened candidate inventory must fail");
    assert.match(result.output, /protectedPaths does not exactly match its technical commit inventory/);
  });

  // The endpoint and the range base are the two halves of the cumulative
  // candidate's identity: either one moved alone silently redraws which
  // protected writes the gate will admit. Parameterised rather than written
  // twice because both cases assert the same contract on different fields.
  for (const [label, field, value] of [
    ["an endpoint that is not the approved technical commit", "technicalCommit", "cdecd7f3f2804517d9aa25ee4322b6486fd7a5bb"],
    ["a range base that is not the approved cumulative base", "rangeBase", "eeebae6d73e5a26db3e6778f56ee95756fa146c6"],
  ]) {
    it(`rejects ${label}`, () => {
      setCandidateField(field, value);
      const result = runChecker();
      assert.equal(result.passed, false, `expected ${label} to be rejected:\n${result.output}`);
      assert.match(result.output, /contract\.governedCandidate (?:technical commit|range base) is not the approved/);
    });
  }

  it("still fails on a contract path that is not exempted", () => {
    setExemptions([exemptPath]);
    touch(unexemptPath);
    const result = runChecker();
    assert.equal(result.passed, false, "an unexempted contract path must still fail");
    assert.match(result.output, new RegExp(`${unexemptPath}.*contract governance drift`));
  });

  it("rejects an exemption naming declared contract content", () => {
    setExemptions(["contracts/security-audit/source/contract.source.json"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /declared contract content and may never be exempt/);
  });

  it("rejects an exemption beneath a declared contract directory", () => {
    setExemptions(["contracts/security-audit/policies/anything.json"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /declared contract content and may never be exempt/);
  });

  for (const [label, entry] of [
    ["a directory", "contracts/security-audit/"],
    ["a glob", "contracts/security-audit/*.json"],
    ["path traversal", "contracts/security-audit/../../etc/passwd"],
    ["an absolute path", "/etc/passwd"],
  ]) {
    it(`rejects ${label}`, () => {
      setExemptions([entry]);
      const result = runChecker();
      assert.equal(result.passed, false, `expected ${label} to be rejected`);
      assert.match(result.output, /toolchainExemptions entry/);
    });
  }

  it("rejects an exemption outside every protected prefix", () => {
    setExemptions(["packages/security-audit-sdk-core/src/sdk.ts"]);
    const result = runChecker();
    assert.equal(result.passed, false);
    assert.match(result.output, /outside every protected contract prefix/);
  });
});

describe("governed candidate coherence", () => {
  const manifestPath = () => resolve(candidateRoot(), ".openspec.yaml");
  const contractSpecPath = () => resolve(candidateRoot(), "specs/security-audit-event-contract/spec.md");
  const pristineManifest = readFileSync(resolve(candidateRoot(), ".openspec.yaml"), "utf8");
  const pristineContractSpec = existsSync(contractSpecPath()) ? readFileSync(contractSpecPath(), "utf8") : null;
  const syntheticContractSpec = "## ADDED Requirements\n\n### Requirement: Synthetic delta\n\nThe contract SHALL be synthetic.\n\n#### Scenario: Synthetic\n- **WHEN** a synthetic delta is read\n- **THEN** it is synthetic\n";

  beforeEach(() => {
    writeFileSync(lifecyclePath, pristineLifecycle, "utf8");
    writeFileSync(manifestPath(), pristineManifest, "utf8");
    if (pristineContractSpec === null) rmSync(contractSpecPath(), { force: true });
    else writeContractSpec(pristineContractSpec);
  });

  function writeContractSpec(text) {
    mkdirSync(dirname(contractSpecPath()), { recursive: true });
    writeFileSync(contractSpecPath(), text, "utf8");
  }

  // A governed candidate either declares skip_specs and ships no contract delta,
  // or ships its contract delta. Each arm builds the shape it tests, so no arm
  // depends on which shape the currently governed candidate happens to have:
  // #96's candidate ships a delta where #423's declared skip_specs, and arms
  // that read the live shape went vacuous on that move.
  function makeDeltaLess(manifest) {
    rmSync(contractSpecPath(), { force: true });
    writeFileSync(manifestPath(), manifest, "utf8");
  }

  // Asserts the spec-delta rule alone rather than the whole run: the disposable
  // clone has no built `dist`, so an all-rules assertion here would report an
  // unrelated environmental failure and say nothing about the subject.
  it("raises no missing-contract-delta failure for a candidate that declares skip_specs", () => {
    makeDeltaLess("schema: spec-driven\nskip_specs: true\ncreated: 2026-09-09\n");
    assert.equal(existsSync(contractSpecPath()), false, "this control is vacuous unless the candidate ships no contract delta");
    const result = runCoherence();
    assert.doesNotMatch(result.output, /governed-candidate-contract-spec/,
      "a declared delta-less candidate must not be reported as missing its contract delta");
  });

  it("raises no missing-contract-delta failure for a candidate that ships its contract delta", () => {
    writeFileSync(manifestPath(), "schema: spec-driven\ncreated: 2026-09-10\n", "utf8");
    writeContractSpec(pristineContractSpec ?? syntheticContractSpec);
    const result = runCoherence();
    assert.doesNotMatch(result.output, /governed-candidate-contract-spec/,
      "a candidate carrying its contract delta must not be reported as missing it");
  });

  // The relaxation above is legitimate only because the change declares it has no
  // deltas. Withdraw the declaration and the missing delta must fail again, or the
  // absence would be excused for every candidate rather than the declared one.
  for (const [label, manifest] of [
    ["the declaration is withdrawn", "schema: spec-driven\ncreated: 2026-09-09\n"],
    ["the declaration is negated", "schema: spec-driven\nskip_specs: false\ncreated: 2026-09-09\n"],
  ]) {
    it(`rejects a candidate with no contract delta when ${label}`, () => {
      makeDeltaLess(manifest);
      const result = runCoherence();
      assert.equal(result.passed, false, `expected the undeclared missing delta to fail:\n${result.output}`);
      assert.match(result.output, /governed-candidate-contract-spec is missing or unreadable/);
    });
  }

  it("rejects a candidate that resolves to no change at all", () => {
    const meta = JSON.parse(pristineLifecycle);
    meta.contract.governedCandidate.change = "no-such-governed-change";
    writeFileSync(lifecyclePath, JSON.stringify(meta, null, 2) + "\n", "utf8");
    const result = runCoherence();
    assert.equal(result.passed, false, "an unresolvable candidate must fail rather than fall back");
    assert.match(result.output, /governed candidate resolves to neither an active change nor exactly one dated archive/);
  });
});
