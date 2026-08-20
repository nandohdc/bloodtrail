import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import test from "node:test";

import { packageRoot, runChecked } from "../../scripts/verification-helpers.mjs";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-shipped-imports-"));
const policyUrl = new URL("../../scripts/shipped-import-policy.mjs", import.meta.url);
const baseManifest = Object.freeze({
  name: "@bloodtrail/security-audit-sdk-core",
  dependencies: {},
  exports: {
    ".": { import: "./dist/index.js" },
    "./testing": { import: "./dist/testing.js" },
  },
});

test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

const permittedFixtures = [
  {
    name: "bundled artifact contributes no module specifier",
    artifact: "dist/bundled.cjs",
    source: "const embeddedRuntime = 1;\n",
    specifiers: 0,
  },
  {
    name: "manifest-declared dependency is accepted",
    artifact: "dist/declared.js",
    source: 'export { value } from "declared-package/subpath";\n',
    manifest: { ...baseManifest, dependencies: { "declared-package": "1.0.0" } },
    specifiers: 1,
  },
  {
    name: "approved runtime built-in is accepted",
    artifact: "dist/builtin.js",
    source: 'import { randomUUID } from "node:crypto";\nvoid randomUUID;\n',
    specifiers: 1,
  },
  {
    name: "declared example self-references are accepted",
    artifact: "examples/self-reference.ts",
    source: [
      'import type { SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";',
      'export { createCapturingAuditSink } from "@bloodtrail/security-audit-sdk-core/testing";',
      "export type Fixture = SecurityAuditEvent;",
      "",
    ].join("\n"),
    specifiers: 2,
  },
  {
    name: "all supported static module-reference positions are inspected",
    artifact: "examples/static-positions.ts",
    source: [
      'import value from "./import.js";',
      'export * from "./export.js";',
      'import Alias = require("./equals.cjs");',
      'type Imported = import("./types.js").Thing;',
      'const required = require("./required.cjs");',
      "void value; void Alias; void required;",
      "export type Result = Imported;",
      "",
    ].join("\n"),
    specifiers: 5,
  },
];

for (const fixture of permittedFixtures) {
  test(fixture.name, async () => {
    const result = await inspectFixture(fixture);
    assert.equal(result.inspected, 1);
    assert.equal(result.specifiers, fixture.specifiers);
    assert.deepEqual(result.violations, []);
  });
}

const rejectedFixtures = [
  {
    name: "unapproved built-in is rejected for the artifact role",
    artifact: "dist/unapproved.js",
    source: 'import "node:assert";\n',
    code: "unapproved-builtin",
    specifier: "node:assert",
  },
  {
    name: "unprefixed built-in is rejected",
    artifact: "dist/unprefixed.js",
    source: 'import "crypto";\n',
    code: "unprefixed-builtin",
    specifier: "crypto",
  },
  {
    name: "unprefixed built-in is rejected in examples",
    artifact: "examples/unprefixed.ts",
    source: 'import "assert";\n',
    code: "unprefixed-builtin",
    specifier: "assert",
  },
  {
    name: "unknown self-reference subpath is rejected",
    artifact: "examples/unknown-self-reference.ts",
    source: 'import "@bloodtrail/security-audit-sdk-core/transport";\n',
    code: "undeclared-self-reference",
    specifier: "@bloodtrail/security-audit-sdk-core/transport",
  },
  {
    name: "undeclared external module is rejected",
    artifact: "dist/undeclared.cjs",
    source: 'require("ajv/dist/runtime/ucs2length");\n',
    code: "undeclared-external",
    specifier: "ajv/dist/runtime/ucs2length",
  },
  {
    name: "dynamic import specifier is rejected",
    artifact: "dist/dynamic-import.js",
    source: "const moduleName = './module.js';\nimport(moduleName);\n",
    code: "dynamic-specifier",
    specifier: "<dynamic-import>",
  },
  {
    name: "dynamic require specifier is rejected",
    artifact: "dist/dynamic-require.cjs",
    source: "const moduleName = './module.cjs';\nrequire(moduleName);\n",
    code: "dynamic-specifier",
    specifier: "<dynamic-require>",
  },
  {
    name: "aliased require is rejected",
    artifact: "dist/aliased-require.cjs",
    source: "const load = require;\nload('./module.cjs');\n",
    code: "unclassifiable-require",
    specifier: "<require-reference>",
  },
  {
    name: "computed module require is rejected",
    artifact: "dist/computed-require.cjs",
    source: 'module["require"]("ajv/dist/runtime/ucs2length");\n',
    code: "unclassifiable-require",
    specifier: "<require-reference>",
  },
  {
    name: "artifact outside a declared role is rejected",
    artifact: "other/unclassified.js",
    source: "const value = 1;\nvoid value;\n",
    code: "unknown-artifact-role",
    specifier: "<artifact-role>",
  },
];

for (const fixture of rejectedFixtures) {
  test(fixture.name, async () => {
    const result = await inspectFixture(fixture);
    assert.equal(result.inspected, 1);
    assert.deepEqual(result.violations.map(({ code }) => code), [fixture.code]);
    assert.equal(result.violations[0].artifact, fixture.artifact);
    assert.equal(result.violations[0].specifier, fixture.specifier);
  });
}

test("violations use deterministic code-point ordering", async () => {
  const result = await inspectFixture({
    artifact: "dist/ordering.cjs",
    source: 'require("zz-package");\nrequire("aa-package");\n',
  });
  assert.deepEqual(result.violations.map(({ specifier }) => specifier), ["aa-package", "zz-package"]);
});

test("unreadable shipped artifact is rejected", async () => {
  const result = await inspectFixture({
    artifact: "dist/missing.js",
    source: null,
  });
  assert.equal(result.inspected, 1);
  assert.deepEqual(result.violations.map(({ code }) => code), ["artifact-read-failure"]);
  assert.equal(result.violations[0].artifact, "dist/missing.js");
});

test("empty shipped artifact inventory fails closed", async () => {
  const { inspectShippedImports } = await import(policyUrl.href);
  const root = mkdtempSync(resolve(suiteRoot, "empty-"));
  const result = await inspectShippedImports({ packageRoot: root, files: [], manifest: baseManifest });
  assert.equal(result.inspected, 0);
  assert.equal(result.specifiers, 0);
  assert.deepEqual(result.violations.map(({ code }) => code), ["empty-inventory"]);
});

test("current packed artifact inventory is accepted", async () => {
  assert.equal(existsSync(resolve(packageRoot, "dist/index.js")), true, "run npm run build first");
  const { inspectShippedImports } = await import(policyUrl.href);
  const manifest = JSON.parse(readFileSync(resolve(packageRoot, "package.json"), "utf8"));
  const pack = packedInventory(packageRoot);
  const result = await inspectShippedImports({ packageRoot, files: pack.files, manifest });
  assert.ok(result.inspected > 0);
  assert.ok(result.specifiers > 0);
  assert.deepEqual(result.violations, []);
});

test("dependency gate rejects a bounded undeclared-AJV mutation without source disclosure", () => {
  const root = resolve(suiteRoot, "mutation", "packages", "security-audit-sdk-core");
  copyPackageStable(packageRoot, root);
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(root, "node_modules"), "dir");

  const artifact = "dist/generated/schema-validator.generated.cjs";
  const artifactPath = resolve(root, artifact);
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const injectedSpecifier = `zz-undeclared-00\nINJECTED_DIAGNOSTIC_LINE${"x".repeat(300)}`;
  const mutations = [
    `const helper = require("ajv/dist/runtime/ucs2length"); // ${sourceMarker}`,
    `require(${JSON.stringify(injectedSpecifier)});`,
    ...Array.from({ length: 54 }, (_, index) => `require("zz-undeclared-${String(index + 1).padStart(2, "0")}");`),
    "",
  ].join("\n");
  writeFileSync(artifactPath, `${readFileSync(artifactPath, "utf8")}\n${mutations}`, "utf8");

  const result = spawnSync(process.execPath, ["scripts/check-dependencies.mjs"], {
    cwd: root,
    encoding: "utf8",
    timeout: 60_000,
  });
  const output = `${result.stdout}\n${result.stderr}`;
  assert.notEqual(result.status, 0, `undeclared mutation unexpectedly passed:\n${output}`);
  assert.match(output, new RegExp(artifact.replaceAll(".", "\\.")));
  assert.match(output, /ajv\/dist\/runtime\/ucs2length/);
  assert.equal(output.includes(sourceMarker), false, `diagnostic leaked source content:\n${output}`);
  assert.equal(output.includes("\nINJECTED_DIAGNOSTIC_LINE"), false, `diagnostic preserved a control character:\n${output}`);
  assert.equal(output.match(/undeclared-external/g)?.length, 50, `diagnostic count was not capped:\n${output}`);
  const diagnostics = output.split("\n").filter((line) => line.includes("[undeclared-external]"));
  assert.equal(diagnostics.length, 50, `diagnostics were not one bounded line each:\n${output}`);
  assert.equal(diagnostics.every((line) => line.length <= 240), true, `a diagnostic exceeded 240 characters:\n${output}`);
  assert.ok(output.length < 13_000, `diagnostic output was not length-bounded: ${String(output.length)} bytes`);
});

async function inspectFixture(fixture) {
  const { inspectShippedImports } = await import(policyUrl.href);
  const root = mkdtempSync(resolve(suiteRoot, "fixture-"));
  const artifactPath = resolve(root, fixture.artifact);
  if (fixture.source !== null) {
    mkdirSync(dirname(artifactPath), { recursive: true });
    writeFileSync(artifactPath, fixture.source, "utf8");
  }
  return inspectShippedImports({
    packageRoot: root,
    files: [{ path: fixture.artifact }],
    manifest: fixture.manifest ?? baseManifest,
  });
}

function packedInventory(root) {
  const output = runChecked("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: root,
    capture: true,
  });
  const report = JSON.parse(output);
  return Array.isArray(report) ? report[0] : report;
}

function copyPackageStable(source, destination) {
  const excluded = new Set(["node_modules", "dist-tests", "dist-examples", ".verification-output", "_vp_dummy.ts"]);
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
      if (isTransientCopyError(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error("package copy remained unstable");
}

function isTransientCopyError(error) {
  if (!error) return false;
  if (error.code !== "ENOENT") return false;
  return String(error.path ?? "").endsWith("_vp_dummy.ts");
}
