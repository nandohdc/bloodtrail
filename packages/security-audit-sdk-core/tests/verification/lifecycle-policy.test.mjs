import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import test from "node:test";
import {
  LifecycleVerificationError,
  boundedFailure,
  parseLifecycleArguments,
  parseTaskChecklist,
  resolveVerificationLifecycle,
} from "../../scripts/lifecycle-policy.mjs";

const temporaryRoots = [];
test.after(async () => {
  await Promise.all(temporaryRoots.map((path) => rm(path, { recursive: true, force: true })));
});

async function fixture() {
  const root = await mkdtemp(resolve(tmpdir(), "bloodtrail-lifecycle-unit-"));
  temporaryRoots.push(root);
  await mkdir(resolve(root, "openspec/changes/archive"), { recursive: true });
  return root;
}

test("argument parsing accepts bounded explicit lifecycle selection", () => {
  assert.deepEqual(
    parseLifecycleArguments(["--mode", "active", "--change=remediate-security-audit-sdk-adversarial-review"], {}),
    { mode: "active", change: "remediate-security-audit-sdk-adversarial-review" },
  );
  assert.throws(
    () => parseLifecycleArguments(["--mode", "unexpected"], {}),
    (error) => error instanceof LifecycleVerificationError && error.code === "LIFECYCLE_MODE",
  );
});

test("active lifecycle requires the active remediation and rejects an archive collision", async () => {
  const root = await fixture();
  await assert.rejects(
    resolveVerificationLifecycle({ repositoryRoot: root, mode: "active" }),
    (error) => error.code === "ACTIVE_CHANGE_MISSING",
  );
  await mkdir(resolve(root, "openspec/changes/remediate-security-audit-sdk-adversarial-review"), { recursive: true });
  assert.equal((await resolveVerificationLifecycle({ repositoryRoot: root, mode: "active" })).mode, "active");
  await mkdir(resolve(root, "openspec/changes/archive/2026-08-01-remediate-security-audit-sdk-adversarial-review"), { recursive: true });
  await assert.rejects(
    resolveVerificationLifecycle({ repositoryRoot: root, mode: "active" }),
    (error) => error.code === "ACTIVE_CHANGE_ARCHIVED",
  );
});

test("archived lifecycle requires active absence and exactly one dated archive", async () => {
  const root = await fixture();
  await mkdir(resolve(root, "openspec/changes/remediate-security-audit-sdk-adversarial-review"), { recursive: true });
  await assert.rejects(
    resolveVerificationLifecycle({ repositoryRoot: root, mode: "archived" }),
    (error) => error.code === "ARCHIVED_CHANGE_ACTIVE",
  );
  await rm(resolve(root, "openspec/changes/remediate-security-audit-sdk-adversarial-review"), { recursive: true });
  await mkdir(resolve(root, "openspec/changes/archive/2026-08-01-remediate-security-audit-sdk-adversarial-review"), { recursive: true });
  assert.equal((await resolveVerificationLifecycle({ repositoryRoot: root, mode: "archived" })).mode, "archived");
});

test("task-state parsing and diagnostics remain bounded", () => {
  const tasks = parseTaskChecklist("- [x] 1.1 complete\n- [ ] 1.2 pending\n");
  assert.deepEqual(tasks.map(({ id, done }) => ({ id, done })), [
    { id: "1.1", done: true },
    { id: "1.2", done: false },
  ]);
  const failure = boundedFailure("rule", "file", "x".repeat(1000));
  assert.equal(failure.message.length, 240);
  assert.ok(Object.isFrozen(failure));
});
