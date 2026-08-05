import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-f08-mutations-"));
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

const mutations = [
  {
    name: "M-F08-A remove FIFO eviction",
    file: "src/bounded-fifo.ts",
    oldText: "    if (this.#entries.size === this.#capacity) {\n      const oldest = this.#entries.values().next().value as T;\n      this.#entries.delete(oldest);\n    }",
    newText: "",
    pattern: "bounded FIFO uses insertion age",
  },
  {
    name: "M-F08-B refresh FIFO age on read",
    file: "src/bounded-fifo.ts",
    oldText: "  has(value: T): boolean {\n    return this.#entries.has(value);\n  }",
    newText: "  has(value: T): boolean {\n    if (!this.#entries.delete(value)) return false;\n    this.#entries.add(value);\n    return true;\n  }",
    pattern: "bounded FIFO uses insertion age",
  },
  {
    name: "M-F08-C evict active reservation",
    file: "src/operations.ts",
    oldText: "      return { ok: true, value: resolved.value.completions.get(eventName) };",
    newText: "      if (resolved.value.completions.get(eventName) === \"reserved\") resolved.value.completions.delete(eventName);\n      return { ok: true, value: resolved.value.completions.get(eventName) };",
    pattern: "active reservations are independent",
  },
  {
    name: "M-F08-D strongly retain operation handles",
    file: "src/operations.ts",
    oldText: "const evidenceByHandle = new WeakMap<object, AuditOperationEvidence>();",
    newText: "const evidenceByHandle = new Map<object, AuditOperationEvidence>();",
    pattern: "operation authority remains weak",
  },
  {
    name: "M-F08-E expire live-handle authority with collision history",
    file: "src/sdk.ts",
    oldText: "    const operation = this.#operationAuthority.resolve(suppliedOperation);\n    if (!operation.ok) return operation;",
    newText: "    const operation = this.#operationAuthority.resolve(suppliedOperation);\n    if (!operation.ok) return operation;\n    if (suppliedOperation !== undefined && !this.#issuedOperationIds.has((suppliedOperation as AuditOperationHandle).operationId)) {\n      return failure(\"SDK_INVALID_OPERATION_TRANSITION\", \"lifecycle\", \"/operation\");\n    }",
    pattern: "live exact-handle authority",
  },
  {
    name: "M-F08-F remove hard configuration maximum",
    file: "src/config.ts",
    oldText: "  if (!Number.isSafeInteger(capacity) || capacity <= 0 || capacity > MAX_RETENTION_CAPACITY) {",
    newText: "  if (!Number.isSafeInteger(capacity) || capacity <= 0) {",
    pattern: "retention configuration is finite",
  },
  {
    name: "M-F08-G weaken completed-state retention",
    file: "src/operations.ts",
    oldText: "        resolved.value.completions.set(eventName, \"completed\");",
    newText: "        resolved.value.completions.delete(eventName);",
    pattern: "live exact-handle authority",
  },
];

for (const mutation of mutations) {
  test(mutation.name, () => {
    const caseRoot = resolve(suiteRoot, mutation.name.replaceAll(/[^A-Za-z0-9]+/g, "-"));
    const root = resolve(caseRoot, "packages/security-audit-sdk-core");
    cpSync(packageRoot, root, {
      recursive: true,
      force: true,
      filter: (source) => !["node_modules", "dist", "dist-tests", "dist-examples", ".verification-output"].includes(basename(source)),
    });
    cpSync(resolve(repositoryRoot, "contracts"), resolve(caseRoot, "contracts"), { recursive: true, force: true });
    symlinkSync(resolve(packageRoot, "node_modules"), resolve(root, "node_modules"), "dir");
    replace(resolve(root, mutation.file), mutation.oldText, mutation.newText);

    const build = spawnSync("npm", ["run", "build"], { cwd: root, encoding: "utf8", timeout: 60_000 });
    assert.equal(build.status, 0, `${mutation.name} did not build:\n${build.stdout}\n${build.stderr}`);
    const compile = spawnSync(process.execPath, [resolve(packageRoot, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.test.json"], {
      cwd: root,
      encoding: "utf8",
      timeout: 60_000,
    });
    assert.equal(compile.status, 0, `${mutation.name} tests did not compile:\n${compile.stdout}\n${compile.stderr}`);
    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [
      "--test",
      `--test-name-pattern=${mutation.pattern}`,
      "dist-tests/f08-retention.test.js",
    ], { cwd: root, encoding: "utf8", timeout: 30_000, env: environment });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.notEqual(result.status, 0, `${mutation.name} unexpectedly survived its F-08 guard:\n${output}`);
    assert.match(output, /tests\s+[1-9][0-9]*/i, `${mutation.name} had zero test discovery:\n${output}`);
    assert.match(output, /fail\s+[1-9][0-9]*/i, `${mutation.name} did not fail an intended guard:\n${output}`);
  });
}

function replace(path, oldText, newText) {
  const text = readFileSync(path, "utf8");
  assert.equal(text.split(oldText).length - 1, 1, `mutation input must occur exactly once in ${path}`);
  writeFileSync(path, text.replace(oldText, newText));
}
