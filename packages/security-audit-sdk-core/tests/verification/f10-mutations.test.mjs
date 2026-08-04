import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-f10-mutations-"));
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

const constructionGuard = "    if (!isTransformableFieldPath(path)) {\n      throw new SecurityAuditSdkError(\"SDK_INVALID_CONFIGURATION\", \"configuration\", `/transformations/${index}/path`);\n    }";
const runtimeGuard = "    if (!isTransformableFieldPath(path)) return failure(\"SDK_HOOK_FAILURE\", \"privacy\", `/${path.replace(/\\./g, \"/\")}`);";

const mutations = [
  {
    name: "M-F10-A remove construction validation",
    file: "src/config.ts",
    oldText: `${constructionGuard}\n`,
    newText: "",
    pattern: "F-10 construction",
  },
  {
    name: "M-F10-B validate only against FIELD_POLICY",
    file: "src/config.ts",
    oldText: "    if (!isTransformableFieldPath(path)) {",
    newText: "    if (!isTransformableFieldPath(path) && path !== \"event.outcome_reason.code\" && path !== \"event.outcome_reason.message\") {",
    pattern: "F-10 parity",
  },
  {
    name: "M-F10-C drift runtime predicate",
    file: "src/events.ts",
    oldText: runtimeGuard,
    newText: "    if (!fieldPolicyForPath(path)) return failure(\"SDK_HOOK_FAILURE\", \"privacy\", `/${path.replace(/\\./g, \"/\")}`);",
    pattern: "F-10 runtime defense",
  },
  {
    name: "M-F10-D broaden event-prefix transformability",
    file: "src/internal.ts",
    oldText: "  return !path.startsWith(\"event.\")",
    newText: "  return true",
    pattern: "F-10 construction",
  },
  {
    name: "M-F10-E remove runtime defense",
    file: "src/events.ts",
    oldText: `${runtimeGuard}\n`,
    newText: "",
    pattern: "F-10 runtime defense",
  },
  {
    name: "M-F10-F invoke hooks during construction",
    file: "src/config.ts",
    oldText: constructionGuard,
    newText: `${constructionGuard}\n    hook.transform({ path, value: "construction-probe", purpose: "construction-validation" });`,
    pattern: "F-10 ownership",
  },
  {
    name: "M-F10-G leak configured path",
    file: "src/config.ts",
    oldText: constructionGuard,
    newText: "    if (!isTransformableFieldPath(path)) {\n      throw new SecurityAuditSdkError(\"SDK_INVALID_CONFIGURATION\", \"configuration\", `/transformations/${index}/path/${path}`);\n    }",
    pattern: "F-10 diagnostics",
  },
];

for (const mutation of mutations) {
  test(mutation.name, () => {
    const caseRoot = resolve(suiteRoot, mutation.name.replaceAll(/[^A-Za-z0-9]+/g, "-"));
    const root = resolve(caseRoot, "packages/security-audit-sdk-core");
    copyPackageStable(packageRoot, root);
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
      "dist-tests/f10-hook-paths.test.js",
    ], { cwd: root, encoding: "utf8", timeout: 30_000, env: environment });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.notEqual(result.status, 0, `${mutation.name} unexpectedly survived its F-10 guard:\n${output}`);
    assert.match(output, /tests\s+[1-9][0-9]*/i, `${mutation.name} had zero test discovery:\n${output}`);
    assert.match(output, /fail\s+[1-9][0-9]*/i, `${mutation.name} did not fail an intended guard:\n${output}`);
  });
}

// The verification-policy suite materializes a transient src/_vp_dummy.ts while node --test
// runs verification files concurrently; a package copy must never fail on that artifact.
function copyPackageStable(source, destination) {
  const excluded = new Set(["node_modules", "dist", "dist-tests", "dist-examples", ".verification-output", "_vp_dummy.ts"]);
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      cpSync(source, destination, {
        recursive: true,
        force: true,
        filter: (entry) => !excluded.has(basename(entry)),
      });
      return;
    } catch (error) {
      if (error && error.code === "ENOENT" && String(error.path ?? "").endsWith("_vp_dummy.ts")) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error("package copy remained unstable");
}

function replace(path, oldText, newText) {
  const text = readFileSync(path, "utf8");
  assert.equal(text.split(oldText).length - 1, 1, `mutation input must occur exactly once in ${path}`);
  writeFileSync(path, text.replace(oldText, newText));
}
