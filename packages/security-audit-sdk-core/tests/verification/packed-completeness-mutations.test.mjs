import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import test from "node:test";

import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-packed-completeness-"));
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

test("unmutated package copy passes the packed completeness gate", () => {
  const { output, status } = runCase("null");
  assert.equal(status, 0, `unmutated control failed:\n${output}`);
  assert.match(output, /packed artifact completeness passed/);
  assertTemporaryPathsRemoved(output);
});

test("packed inventory omitting a loaded module fails closed", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("incomplete-inventory", ({ copiedPackage }) => {
    const manifestPath = resolve(copiedPackage, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.files.push("!dist/validation");
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    const omittedModule = resolve(copiedPackage, "dist/validation/index.js");
    writeFileSync(omittedModule, `${readFileSync(omittedModule, "utf8")}\n// ${sourceMarker}\n`, "utf8");
  });

  assertFailure(result, {
    code: "entry-point-import",
    entryPoint: "@bloodtrail/security-audit-sdk-core",
    detail: "dist/validation/index.js",
    sourceMarker,
  });
});

test("packed artifact referencing an undefined bundled helper fails closed", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("incomplete-artifact", ({ copiedPackage }) => {
    const validatorPath = resolve(copiedPackage, "dist/generated/schema-validator.generated.cjs");
    replaceExactly(
      validatorPath,
      "const bundledUcs2length = ucs2length;",
      `const bundledUcs2length = missingBundledHelper; /* ${sourceMarker} */`,
    );
  });

  assertFailure(result, {
    code: "entry-point-import",
    entryPoint: "@bloodtrail/security-audit-sdk-core",
    detail: "missingBundledHelper",
    sourceMarker,
  });
});

test("entry point resolving outside the disposable consumer fails closed", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("outside-consumer", ({ caseRoot, environment }) => {
    const decoyRoot = resolve(caseRoot, "decoy");
    writeDecoyPackage(decoyRoot, sourceMarker);
    const shimDir = resolve(caseRoot, "bin");
    mkdirSync(shimDir, { recursive: true });
    const shimPath = resolve(shimDir, "npm");
    writeFileSync(shimPath, npmShimSource(), "utf8");
    chmodSync(shimPath, 0o755);
    environment.PATH = `${shimDir}:${environment.PATH}`;
    environment.BLOODTRAIL_REAL_NPM = npmExecutable();
    environment.BLOODTRAIL_DECOY_PACKAGE = decoyRoot;
  });

  assertFailure(result, {
    code: "resolution-provenance",
    entryPoint: "@bloodtrail/security-audit-sdk-core",
    detail: "outside disposable consumer",
    sourceMarker,
  });
});

test("diagnostic interpolation escapes control characters", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("control-character-diagnostic", ({ copiedPackage }) => {
    const manifestPath = resolve(copiedPackage, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    manifest.exports["./testing\nINJECTED_DIAGNOSTIC_LINE"] = { import: "./dist/INJECTED_DOES_NOT_EXIST.js" };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  });

  assertFailure(result, {
    code: "entry-point-import",
    entryPoint: "@bloodtrail/security-audit-sdk-core/testing\\u000aINJECTED_DIAGNOSTIC_LINE",
    detail: "INJECTED_DIAGNOSTIC_LINE",
    sourceMarker,
  });
});

function runCase(name, mutate = () => {}) {
  const caseRoot = resolve(suiteRoot, name);
  const copiedPackage = resolve(caseRoot, "packages/security-audit-sdk-core");
  copyPackageStable(packageRoot, copiedPackage);
  cpSync(resolve(repositoryRoot, "contracts"), resolve(caseRoot, "contracts"), { recursive: true, force: true });
  const environment = { ...process.env };
  mutate({ caseRoot, copiedPackage, environment });
  const result = spawnSync(process.execPath, ["scripts/check-package-contents.mjs"], {
    cwd: copiedPackage,
    encoding: "utf8",
    env: environment,
    timeout: 60_000,
  });
  return { status: result.status, output: `${result.stdout}\n${result.stderr}` };
}

function assertFailure({ output, status }, { code, entryPoint, detail, sourceMarker }) {
  assert.notEqual(status, 0, `mutation unexpectedly passed:\n${output}`);
  assert.match(output, new RegExp(`\\[packed-completeness:${code}\\]`));
  assert.ok(output.includes(entryPoint), `diagnostic did not name ${entryPoint}:\n${output}`);
  assert.ok(output.includes(detail), `diagnostic did not name ${detail}:\n${output}`);
  assert.equal(output.includes(sourceMarker), false, `diagnostic leaked source content:\n${output}`);
  assert.equal(output.includes("\nINJECTED_DIAGNOSTIC_LINE"), false, `diagnostic preserved a control character:\n${output}`);
  assert.ok(output.length < 4_096, `diagnostic output was not bounded: ${String(output.length)} bytes`);
  assertTemporaryPathsRemoved(output);
}

function assertTemporaryPathsRemoved(output) {
  const match = output.match(/\[packed-completeness:temporary-paths\] pack=([^\s]+) consumer=([^\s]+)/);
  assert.ok(match, `temporary paths were not reported:\n${output}`);
  assert.equal(existsSync(match[1]), false, `pack directory survived verification: ${match[1]}`);
  assert.equal(existsSync(match[2]), false, `consumer directory survived verification: ${match[2]}`);
}

function replaceExactly(path, oldText, newText) {
  const text = readFileSync(path, "utf8");
  assert.equal(text.split(oldText).length - 1, 1, `mutation input must occur exactly once in ${path}`);
  writeFileSync(path, text.replace(oldText, newText), "utf8");
}

function writeDecoyPackage(root, sourceMarker) {
  mkdirSync(resolve(root, "dist"), { recursive: true });
  writeFileSync(resolve(root, "package.json"), `${JSON.stringify({
    name: "@bloodtrail/security-audit-sdk-core",
    version: "0.0.0-decoy",
    type: "module",
    exports: {
      ".": "./dist/index.js",
      "./testing": "./dist/testing.js",
    },
  }, null, 2)}\n`);
  writeFileSync(resolve(root, "dist/index.js"), `// ${sourceMarker}\nexport function validateSecurityAuditEvent() { return { ok: true }; }\n`);
  writeFileSync(resolve(root, "dist/testing.js"), `// ${sourceMarker}\nexport const decoy = true;\n`);
}

function npmShimSource() {
  return [
    "#!/usr/bin/env node",
    'const { mkdirSync, symlinkSync } = require("node:fs");',
    'const { dirname, resolve } = require("node:path");',
    'const { spawnSync } = require("node:child_process");',
    'if (process.argv[2] === "install") {',
    '  const target = resolve(process.cwd(), "node_modules/@bloodtrail/security-audit-sdk-core");',
    "  mkdirSync(dirname(target), { recursive: true });",
    '  symlinkSync(process.env.BLOODTRAIL_DECOY_PACKAGE, target, "dir");',
    '  process.stdout.write("installed decoy\\n");',
    "  process.exit(0);",
    "}",
    "const result = spawnSync(process.env.BLOODTRAIL_REAL_NPM, process.argv.slice(2), { stdio: \"inherit\" });",
    "process.exit(result.status ?? 1);",
    "",
  ].join("\n");
}

function npmExecutable() {
  const result = spawnSync("which", ["npm"], { encoding: "utf8" });
  assert.equal(result.status, 0, `could not resolve npm executable: ${result.stderr}`);
  return result.stdout.trim();
}

function copyPackageStable(source, destination) {
  const excluded = new Set([
    "node_modules",
    "dist-tests",
    "dist-examples",
    "coverage",
    ".verification-output",
    "_vp_dummy.ts",
  ]);
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
      if (error?.code === "ENOENT" && String(error.path ?? "").endsWith("_vp_dummy.ts")) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error("package copy remained unstable");
}
