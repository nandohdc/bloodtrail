import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const scriptPath = fileURLToPath(new URL("./check-conventional-commits.mjs", import.meta.url));
const explanation = "a work-item ID is not a change description";
const workItemSubjects = [
  "feat: US-001 - x",
  "feat(sdk-node): US-001 - x",
  "fix: ABC-12: x",
];

function runTitle(subject, path = scriptPath) {
  const result = spawnSync(process.execPath, [path, "--title", subject], { encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  return result;
}

for (const subject of workItemSubjects) {
  test(`rejects leading work-item description: ${subject}`, () => {
    const result = runTitle(subject);
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes(`PR title: ${subject} (${explanation})`), result.stderr);
  });
}

for (const subject of [
  "fix(sdk-node): x",
  "feat: SHA-256 digests for x",
  "fix: UTF-8 x",
  "chore: release v0.22.0",
  "fix(sdk-node)!: x",
  "security: x",
  "fix: handle US-001 - x",
  "fix: US-001 x",
  "fix: US-001-x",
  "fix: US-001 -x",
  "fix: US-001- x",
  "fix: us-001 - x",
]) {
  test(`accepts change description: ${subject}`, () => {
    const result = runTitle(subject);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stderr, "");
  });
}

for (const subject of [
  "feat: ",
  "feat:  x",
  "feature: x",
  "fix: x ",
  "fix(): x",
  "Merge branch 'main' into feature",
]) {
  test(`preserves invalid-format rejection: ${subject}`, () => {
    const result = runTitle(subject);
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes(`PR title: ${subject}`), result.stderr);
    assert.ok(result.stderr.includes("Expected: type(scope)!: description"), result.stderr);
    assert.ok(!result.stderr.includes(explanation), result.stderr);
  });
}

for (const subject of ["fix: A1-12 - x", "fix!: X-0:x"]) {
  test(`rejects other uppercase key forms: ${subject}`, () => {
    const result = runTitle(subject);
    assert.equal(result.status, 1, result.stderr);
    assert.ok(result.stderr.includes(`PR title: ${subject} (${explanation})`), result.stderr);
  });
}

test("fetched commit subjects share title validation and retain SHA context without network", () => {
  const commits = [...workItemSubjects, "fix: x ", "fix: UTF-8 x"].map((subject, index) => ({
    sha: `${index}123456789abcdef`,
    commit: { message: `${subject}\n\nBody is not a subject.` },
  }));
  const preload = `globalThis.fetch = async () => ({ ok: true, json: async () => ${JSON.stringify(commits)} });`;
  const result = spawnSync(process.execPath, [
    "--import", `data:text/javascript,${encodeURIComponent(preload)}`,
    scriptPath, "--title", "fix: x", "--github-pr", "owner/repo", "743",
  ], { encoding: "utf8" });
  assert.ifError(result.error);
  assert.equal(result.signal, null);
  assert.equal(result.status, 1, result.stderr);
  for (const [index, subject] of workItemSubjects.entries()) {
    assert.ok(result.stderr.includes(`commit ${commits[index].sha.slice(0, 8)}: ${subject} (${explanation})`), result.stderr);
  }
  assert.ok(result.stderr.includes("commit 31234567: fix: x "), result.stderr);
  assert.ok(!result.stderr.includes("commit 41234567:"), result.stderr);
  assert.ok(result.stdout.includes("checked PR title and 5 commit subject(s)"), result.stdout);
});

test("planted defect: disabling only the work-item predicate accepts all rejected labels", () => {
  const source = readFileSync(scriptPath, "utf8");
  const target = "WORK_ITEM_DESCRIPTION.test(match[1])";
  assert.equal(source.split(target).length - 1, 1, "mutation target must be unique");
  const mutant = source.replace(target, "false");
  assert.notEqual(mutant, source, "mutation must change the script bytes");
  const directory = mkdtempSync(join(tmpdir(), "bloodtrail-work-item-mutant-"));
  try {
    const mutantPath = join(directory, "check-conventional-commits.mjs");
    writeFileSync(mutantPath, mutant);
    for (const subject of workItemSubjects) {
      const production = runTitle(subject);
      assert.equal(production.status, 1, production.stderr);
      assert.ok(production.stderr.includes(explanation), production.stderr);
      const control = runTitle(subject, mutantPath);
      assert.equal(control.status, 0, control.stderr);
      assert.equal(control.stderr, "");
    }
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
