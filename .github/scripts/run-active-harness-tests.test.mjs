import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";

const RUNNER = new URL("./run-active-harness-tests.mjs", import.meta.url).href;
const PASS = 'import { test } from "node:test"; test("fixture passed", () => {});\n';

function fixture(t) {
  const root = mkdtempSync(join(tmpdir(), "bloodtrail-harness-ci-"));
  mkdirSync(join(root, "openspec/changes"), { recursive: true });
  t.after(() => rmSync(root, { recursive: true, force: true }));
  return root;
}

function put(root, path, content = PASS) {
  const target = join(root, "openspec/changes", path);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function run(root, options = {}) {
  const code = `import { runActiveHarnessTests } from ${JSON.stringify(RUNNER)}; process.exitCode = await runActiveHarnessTests(${JSON.stringify({ root, ...options })});`;
  const env = { ...process.env };
  delete env.NODE_TEST_CONTEXT;
  return spawnSync(process.execPath, ["--input-type=module", "--eval", code], { encoding: "utf8", timeout: 15_000, env });
}

test("CI executes and reports an active harness fixture suite", (t) => {
  const root = fixture(t);
  put(root, "active/harness/tests/check.test.mjs");
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /active\/harness\/tests\/check\.test\.mjs/);
  assert.match(result.stdout, /fixture passed/);
});

test("CI runs all active suites recursively and excludes the archive", (t) => {
  const root = fixture(t);
  put(root, "second/harness/tests/nested/check.test.mjs");
  put(root, "first/harness/tests/check.test.mjs");
  put(root, "archive/old/harness/tests/check.test.mjs", 'throw new Error("archive must never execute");\n');
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /second\/harness\/tests\/nested\/check\.test\.mjs/);
  assert.doesNotMatch(result.stdout, /archive\/old/);
});

test("no active harness is explicitly not applicable without executing unrelated tests", (t) => {
  const root = fixture(t);
  put(root, "archive/old/harness/tests/check.test.mjs", 'throw new Error("archive executed");\n');
  put(root, "ordinary/unrelated.test.mjs", 'throw new Error("unrelated test executed");\n');
  const result = run(root);
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /not applicable: no active change harnesses/i);
});

test("missing or empty suites cannot silently remove an active harness", (t) => {
  const root = fixture(t);
  mkdirSync(join(root, "openspec/changes/orphan/harness"), { recursive: true });
  const missing = run(root);
  assert.notEqual(missing.status, 0);
  assert.match(missing.stderr, /orphan\/harness/);
  mkdirSync(join(root, "openspec/changes/orphan/harness/tests"));
  const empty = run(root);
  assert.notEqual(empty.status, 0);
  assert.match(empty.stderr, /no self-tests.*orphan\/harness/i);
  put(root, "orphan/harness/tests/check.test.mjs");
  assert.equal(run(root).status, 0, "the same harness passes once a fixture suite exists");
});

test("symbolic links cannot conceal or redirect active harness coverage", (t) => {
  for (const component of ["change", "harness", "tests", "test-file"]) {
    const root = fixture(t);
    const changes = join(root, "openspec/changes");
    const target = join(root, "outside");
    mkdirSync(target);
    if (component === "change") symlinkSync(target, join(changes, "active"));
    else if (component === "harness") {
      mkdirSync(join(changes, "active"));
      symlinkSync(target, join(changes, "active/harness"));
    } else if (component === "tests") {
      mkdirSync(join(changes, "active/harness"), { recursive: true });
      symlinkSync(target, join(changes, "active/harness/tests"));
    } else {
      put(root, "active/harness/tests/valid.test.mjs");
      symlinkSync(join(target, "missing.test.mjs"), join(changes, "active/harness/tests/linked.test.mjs"));
    }
    const result = run(root);
    assert.notEqual(result.status, 0, component);
    assert.match(result.stderr, /symbolic link/i, component);
  }
});

test("a planted failing fixture propagates nonzero and its null control passes", (t) => {
  const root = fixture(t);
  put(root, "active/harness/tests/check.test.mjs", 'import { test } from "node:test"; test("planted failure", () => { throw new Error("planted defect"); });\n');
  const planted = run(root);
  assert.notEqual(planted.status, 0);
  assert.match(planted.stdout + planted.stderr, /planted defect/);
  put(root, "active/harness/tests/check.test.mjs");
  assert.equal(run(root).status, 0);
});

test("discovery errors and malformed suites fail rather than report not applicable", (t) => {
  const missingRoot = fixture(t);
  rmSync(join(missingRoot, "openspec/changes"), { recursive: true });
  assert.notEqual(run(missingRoot).status, 0);
  const malformed = fixture(t);
  put(malformed, "active/harness/tests", "not a directory\n");
  assert.notEqual(run(malformed).status, 0);
});

test("an unreadable suite fails", { skip: process.getuid?.() === 0 }, (t) => {
  const root = fixture(t);
  put(root, "active/harness/tests/check.test.mjs");
  const path = join(root, "openspec/changes/active/harness/tests");
  chmodSync(path, 0);
  try {
    assert.notEqual(run(root).status, 0);
  } finally {
    chmodSync(path, 0o700);
  }
});

test("a stalled test and its worker stop before timeout failure returns", async (t) => {
  const root = fixture(t);
  const heartbeat = join(root, "heartbeat");
  const pid = join(root, "worker-pid");
  put(root, "active/harness/tests/check.test.mjs", `import { test } from "node:test"; import { appendFileSync, writeFileSync } from "node:fs"; writeFileSync(${JSON.stringify(pid)}, String(process.pid)); test("stall", () => new Promise(() => { setInterval(() => appendFileSync(${JSON.stringify(heartbeat)}, "x"), 10); }));\n`);
  const result = run(root, { timeoutMs: 1500 });
  const worker = Number(readFileSync(pid, "utf8"));
  t.after(() => { try { process.kill(worker, "SIGKILL"); } catch (error) { if (error.code !== "ESRCH") throw error; } });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /ETIMEDOUT|terminated/i);
  const before = readFileSync(heartbeat, "utf8");
  await delay(150);
  assert.equal(readFileSync(heartbeat, "utf8"), before, "no fixture work may survive timeout");
});
