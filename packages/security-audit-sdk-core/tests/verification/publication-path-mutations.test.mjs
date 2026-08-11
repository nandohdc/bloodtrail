import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
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
