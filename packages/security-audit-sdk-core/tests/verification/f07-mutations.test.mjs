import assert from "node:assert/strict";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-f07-mutations-"));

test.after(() => {
  rmSync(suiteRoot, { recursive: true, force: true });
});

const mutations = [
  {
    name: "M-F07-A remove unref",
    oldText: "  timer.unref();",
    newText: "",
    pattern: "real Node unref guard exits promptly",
    expected: /retained the process|exceeded 3000 ms/i,
  },
  {
    name: "M-F07-B remove timeout cancellation",
    oldText: "      clearTimeout(timer);",
    newText: "",
    pattern: "controlled timer instrumentation",
    expected: /Expected values to be strictly equal|0 !== 1/i,
  },
  {
    name: "M-F07-C remove structured cleanup",
    oldText: "    } finally {\n      timeout.cancel();\n    }",
    newText: "    } finally {\n      if (this.#state !== \"shut_down\") timeout.cancel();\n    }",
    pattern: "controlled timer instrumentation",
    expected: /Expected values to be strictly equal|0 !== 1/i,
  },
  {
    name: "M-F07-D break logical timeout behavior",
    oldText: "  const timer = setTimeout(() => resolveTimeout(false), timeoutMs);",
    newText: "  const timer = setTimeout(() => {}, timeoutMs);",
    pattern: "referenced process still observes",
    expected: /exceeded 2000 ms/i,
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
    replace(resolve(root, "src/sdk.ts"), mutation.oldText, mutation.newText);

    const build = spawnSync("npm", ["run", "build"], { cwd: root, encoding: "utf8", timeout: 60_000 });
    assert.equal(build.status, 0, `${mutation.name} did not build:\n${build.stdout}\n${build.stderr}`);
    const compile = spawnSync(process.execPath, [resolve(packageRoot, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.test.json"], {
      cwd: root,
      encoding: "utf8",
      timeout: 60_000,
    });
    assert.equal(compile.status, 0, `${mutation.name} tests did not compile:\n${compile.stdout}\n${compile.stderr}`);
    const childEnvironment = { ...process.env };
    delete childEnvironment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [
      "--test",
      `--test-name-pattern=${mutation.pattern}`,
      "dist-tests/f07-shutdown-timer.test.js",
    ], {
      cwd: root,
      encoding: "utf8",
      timeout: 12_000,
      env: childEnvironment,
    });
    assert.notEqual(result.status, 0, `${mutation.name} unexpectedly survived its F-07 guard:\n${result.stdout}\n${result.stderr}`);
    assert.match(`${result.stdout}\n${result.stderr}`, mutation.expected);
  });
}

function replace(path, oldText, newText) {
  const text = readFileSync(path, "utf8");
  assert.ok(text.includes(oldText), `mutation input absent from ${path}`);
  writeFileSync(path, text.replace(oldText, newText));
}
