import assert from "node:assert/strict";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import { runDisposableGit } from "./disposable-git.mjs";

const WORKFLOW = ".github/workflows/ci.yml";
const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-publication-path-"));
const controlRoot = resolve(suiteRoot, "control");
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

prepareControl();

test("P-00 unmutated control passes over real workflows and documentation", () => {
  const root = caseRepository("control-pass");
  // The false-positive direction is the one that gets a check abandoned: the
  // repository really does contain these strings, and none of them publishes.
  assert.match(readFileSync(resolve(root, "RELEASING.md"), "utf8"), /npm publish/);
  assert.match(readFileSync(resolve(root, "packages/security-audit-sdk-core/package-lock.json"), "utf8"), /registry\.npmjs\.org/);
  assert.match(readFileSync(resolve(root, WORKFLOW), "utf8"), /SONAR_TOKEN|CODECOV_TOKEN/);
  const result = succeeds(root);
  assert.match(result.stdout, /publication-path exclusion passed: 3 workflow file\(s\)/);
  // The widened surface must be covered, not merely available: automation files
  // beyond the workflows, and every tracked manifest with its script bodies.
  assert.match(result.stdout, /[1-9]\d* automation file\(s\)/);
  assert.match(result.stdout, /[3-5] private tracked package manifest\(s\)\/[1-9]\d* script\(s\)/);
});

test("M-PP-A an introduced publish step is rejected", () => {
  const root = caseRepository("publish-step");
  appendWorkflow(root, ["      - run: npm publish"]);
  const result = fails(root, "publication-command");
  assert.match(result.stderr, new RegExp(`${WORKFLOW}:\\d+`));
});

test("M-PP-B an introduced publication credential is rejected", () => {
  const root = caseRepository("publication-credential");
  appendWorkflow(root, ["        env:", "          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}"]);
  fails(root, "publication-credential");
});

test("M-PP-C an introduced registry publication configuration is rejected", () => {
  const root = caseRepository("registry-url");
  appendWorkflow(root, ["          registry-url: https://registry.npmjs.org"]);
  fails(root, "publication-registry-config");
});

test("M-PP-D documenting the exclusion in a workflow comment is not a violation", () => {
  const root = caseRepository("workflow-comment");
  appendWorkflow(root, ["      # No job here runs npm publish, and no NPM_TOKEN exists."]);
  succeeds(root);
});

test("M-PP-E comment stripping is not a bypass for a block-scalar publish", () => {
  const root = caseRepository("block-scalar-publish");
  appendWorkflow(root, ["      - run: |", "          # release", "          npm publish --access public"]);
  fails(root, "publication-command");
});

test("M-PP-F a tracked .npmrc is rejected", () => {
  const root = caseRepository("tracked-npmrc");
  writeFileSync(resolve(root, ".npmrc"), "//registry.npmjs.org/:_authToken=${NPM_TOKEN}\n", "utf8");
  git(root, ["add", ".npmrc"]);
  fails(root, "publication-registry-config");
});

test("M-PP-G a publishConfig entry in a tracked manifest is rejected", () => {
  const root = caseRepository("publish-config");
  const path = resolve(root, "packages/security-audit-sdk-core/package.json");
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  assert.equal(manifest.publishConfig, undefined, "control manifest must declare no publishConfig");
  manifest.publishConfig = { access: "public" };
  writeFileSync(path, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  fails(root, "publication-registry-config");
});

test("M-PP-H scanning no workflow at all is rejected rather than vacuously passing", () => {
  const root = caseRepository("no-workflows");
  rmSync(resolve(root, ".github/workflows"), { recursive: true, force: true });
  fails(root, "publication-scan-empty");
});

// Proves the rejection above comes from the publish-command patterns rather
// than from some incidental property of the mutated workflow.
test("M-PP-I removing the publish-command patterns lets the publish step pass", () => {
  const root = caseRepository("command-patterns-removed");
  appendWorkflow(root, ["      - run: npm publish"]);
  fails(root, "publication-command");
  mutateChecker(root, String.raw`/\b(?:npm|pnpm|yarn|bun)\s+publish\b/,`, "");
  succeeds(root);
});

// The indirect path. Every mutation below passed the workflow-only scan: the
// publication command was never written in a workflow, only reached from one.
// No control executes a publication command; each only writes content the gate
// then reads.
test("M-PP-J a publication command held in a tracked manifest script is rejected", () => {
  const root = caseRepository("indirect-manifest-script");
  // private stays true so the only reason to reject is the script body itself.
  writeManifest(root, "tools/release-helper/package.json", {
    name: "release-helper",
    version: "0.0.0",
    private: true,
    scripts: { release: "npm publish" },
  });
  appendWorkflow(root, ["      - run: npm run release --prefix tools/release-helper"]);
  const result = fails(root, "publication-command");
  assert.match(result.stderr, /tools\/release-helper\/package\.json#scripts\.release/);
});

test("M-PP-K a tracked manifest that is not private is rejected as a publishable workspace", () => {
  const root = caseRepository("publishable-manifest");
  writeManifest(root, "tools/publishable/package.json", { name: "publishable", version: "0.0.0" });
  const result = fails(root, "publication-publishable-manifest");
  assert.match(result.stderr, /expected private: true/);
});

test("M-PP-L a local action carrying a publish command is rejected", () => {
  const root = caseRepository("local-action");
  writeTracked(root, ".github/actions/release/action.yml", [
    "name: release",
    "runs:",
    "  using: composite",
    "  steps:",
    "    - run: npm publish --access public",
    "      shell: bash",
  ]);
  appendWorkflow(root, ["      - uses: ./.github/actions/release"]);
  const result = fails(root, "publication-command");
  assert.match(result.stderr, /\.github\/actions\/release\/action\.yml:\d+/);
});

test("M-PP-M a repository automation script carrying a publish command is rejected", () => {
  const root = caseRepository("automation-script");
  writeTracked(root, ".github/scripts/release.sh", ["#!/bin/sh", "npm publish"]);
  appendWorkflow(root, ["      - run: bash .github/scripts/release.sh"]);
  const result = fails(root, "publication-command");
  assert.match(result.stderr, /\.github\/scripts\/release\.sh:\d+/);
});

test("M-PP-N a local action the gate cannot read fails closed", () => {
  const root = caseRepository("unscannable-action");
  appendWorkflow(root, ["      - uses: ./tools/local-action"]);
  const result = fails(root, "publication-unscannable-automation");
  assert.match(result.stderr, /tools\/local-action/);
});

// Comment stripping applies to YAML and shell, where "#" cannot execute. It is
// not claimed for other file types, so a publish command in a JavaScript comment
// under the automation directory is still rejected rather than silently trusted.
test("M-PP-O documenting the exclusion in a shell comment is not a violation", () => {
  const root = caseRepository("automation-shell-comment");
  writeTracked(root, ".github/scripts/notes.sh", ["#!/bin/sh", "# No step here runs npm publish."]);
  succeeds(root);
});

// Tracked-but-absent is the other unscannable direction: the file still
// publishes for everyone who checks it out, so an empty working tree must not
// read as an established exclusion.
test("M-PP-R a tracked automation file missing from the working tree fails closed", () => {
  const root = caseRepository("automation-file-removed");
  const path = ".github/scripts/check-conventional-commits.mjs";
  assert.ok(readFileSync(resolve(root, path), "utf8").length > 0, "control must track the automation script");
  rmSync(resolve(root, path));
  const result = fails(root, "publication-unscannable-automation");
  assert.match(result.stderr, /check-conventional-commits\.mjs/);
});

// A local reference resolves the way GitHub Actions resolves one. Treating it as
// "scan everything underneath" made a bare `./` sweep the whole repository and
// then fail on RELEASING.md, which legitimately states that no workflow here runs
// npm publish — the false positive that gets a gate distrusted rather than fixed.
test("M-PP-S a repository-root local reference fails closed instead of sweeping the tree", () => {
  const root = caseRepository("local-reference-root");
  appendWorkflow(root, ["      - uses: ./"]);
  const result = fails(root, "publication-unscannable-automation");
  assert.doesNotMatch(result.stderr, /RELEASING\.md/, "documentation must stay outside the scanned surface");
  assert.doesNotMatch(result.stderr, /package-lock\.json/, "lockfiles must stay outside the scanned surface");
});

// Quoting a local reference is legal YAML and changes nothing for the runner, so
// it must change nothing for the gate either. A reference outside the automation
// directory is the case that depends on the capture: nothing else brings
// tools/ into the surface.
test("M-PP-U a quoted local reference is resolved rather than ignored", () => {
  const root = caseRepository("quoted-local-reference");
  writeTracked(root, "tools/publisher/action.yml", [
    "name: publisher",
    "runs:",
    "  using: composite",
    "  steps:",
    "    - run: npm publish --access public",
    "      shell: bash",
  ]);
  appendWorkflow(root, ['      - uses: "./tools/publisher"']);
  const result = fails(root, "publication-command");
  assert.match(result.stderr, /tools\/publisher\/action\.yml:\d+/);
});

// Comment stripping is claimed for YAML and shell only, so documentation cannot
// be made safe by stripping: it has to be out of the surface. A pull-request
// template naming the exclusion is the ordinary case.
test("M-PP-T documentation under the automation directory is not a publication path", () => {
  const root = caseRepository("automation-documentation");
  writeTracked(root, ".github/PULL_REQUEST_TEMPLATE.md", [
    "## Checklist",
    "",
    "- [ ] This change runs no `npm publish` step and introduces no NPM_TOKEN.",
  ]);
  succeeds(root);
});

test("M-PP-P scanning no tracked manifest at all is rejected rather than vacuously passing", () => {
  const root = caseRepository("no-manifests");
  mutateChecker(root, 'entry === "package.json" || entry.endsWith("/package.json")', "false");
  fails(root, "publication-scan-empty");
});

// Non-vacuity: the rejection in M-PP-J must come from the manifest-script scan.
test("M-PP-Q removing the manifest-script scan lets the indirect publish pass", () => {
  const root = caseRepository("manifest-script-scan-removed");
  writeManifest(root, "tools/release-helper/package.json", {
    name: "release-helper",
    version: "0.0.0",
    private: true,
    scripts: { release: "npm publish" },
  });
  appendWorkflow(root, ["      - run: npm run release --prefix tools/release-helper"]);
  fails(root, "publication-command");
  mutateChecker(root, "for (const [name, body] of Object.entries(manifest.scripts ?? {})) {", "for (const [name, body] of []) {");
  succeeds(root);
});

function prepareControl() {
  git(repositoryRoot, ["clone", "--quiet", "--no-hardlinks", repositoryRoot, controlRoot]);
  overlayControl(controlRoot);
  git(controlRoot, ["add", "-A"]);
  // --allow-empty: on a clean tree the overlay is byte-identical to HEAD.
  git(controlRoot, ["commit", "--allow-empty", "-m", "test: publication path control"]);
  const result = runChecker(controlRoot);
  assert.equal(result.status, 0, `control repository must satisfy the gate before any mutation:\n${result.stdout}\n${result.stderr}`);
}

function caseRepository(name) {
  const root = resolve(suiteRoot, name);
  git(suiteRoot, ["clone", "--quiet", "--no-hardlinks", controlRoot, root]);
  return root;
}

function runChecker(root) {
  return spawnSync(process.execPath, ["scripts/check-publication-path.mjs"], {
    cwd: resolve(root, "packages/security-audit-sdk-core"),
    encoding: "utf8",
  });
}

function succeeds(root) {
  const result = runChecker(root);
  assert.equal(result.status, 0, `check-publication-path.mjs unexpectedly failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}

function fails(root, expectedId) {
  const result = runChecker(root);
  assert.notEqual(result.status, 0, `check-publication-path.mjs unexpectedly passed mutation ${expectedId}:\n${result.stdout}`);
  assert.match(result.stderr, new RegExp(`\\[${expectedId}\\]`), `expected diagnostic ${expectedId}, got:\n${result.stderr}`);
  return result;
}

function appendWorkflow(root, lines) {
  const path = resolve(root, WORKFLOW);
  const text = readFileSync(path, "utf8");
  assert.ok(text.endsWith("\n"), "control workflow must end with a final newline");
  writeFileSync(path, `${text}${lines.join("\n")}\n`, "utf8");
}

function writeTracked(root, relativePath, lines) {
  const path = resolve(root, relativePath);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
  git(root, ["add", "--", relativePath]);
}

function writeManifest(root, relativePath, manifest) {
  writeTracked(root, relativePath, [JSON.stringify(manifest, null, 2)]);
}

function mutateChecker(root, oldText, newText) {
  const path = resolve(root, "packages/security-audit-sdk-core/scripts/check-publication-path.mjs");
  const text = readFileSync(path, "utf8");
  assert.equal(text.split(oldText).length - 1, 1, `mutation input must occur exactly once in ${path}`);
  writeFileSync(path, text.replace(oldText, newText), "utf8");
}

// Overlay exactly what the gate under test reads: its own scripts, the package
// manifest it inspects for publishConfig, and the workflows it scans. Copying
// the whole package would also copy src/, which races with the
// verification-policy suite materializing a transient src/_vp_dummy.ts while
// node --test runs these files concurrently.
function overlayControl(root) {
  const destination = resolve(root, "packages/security-audit-sdk-core");
  cpSync(resolve(packageRoot, "scripts"), resolve(destination, "scripts"), { recursive: true, force: true });
  cpSync(resolve(packageRoot, "package.json"), resolve(destination, "package.json"), { force: true });
  cpSync(resolve(repositoryRoot, ".github/workflows"), resolve(root, ".github/workflows"), { recursive: true, force: true });
}

function git(root, args) {
  const result = runDisposableGit(root, args);
  assert.equal(result.status, 0, `git ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result;
}
