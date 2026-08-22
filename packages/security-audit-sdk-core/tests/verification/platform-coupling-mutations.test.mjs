import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import test from "node:test";

import { packageRoot } from "../../scripts/verification-helpers.mjs";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-platform-coupling-"));
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

test("unmutated package copy passes the scope gate and reports declared coupling inventory", () => {
  const { output, status } = runCase("null");
  assert.equal(status, 0, `unmutated control failed:\n${output}`);
  assert.match(output, /scope passed:/);
  assert.match(output, /platform coupling inventory:/);
  assert.match(output, /authored:/);
  assert.match(output, /generated:/);
});

test("authored source referencing an undeclared Node global fails closed", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("m-71-a-authored-global", ({ copiedPackage }) => {
    const probePath = resolve(copiedPackage, "src/probe.ts");
    writeFileSync(
      probePath,
      `// ${sourceMarker}\nexport function readEnv(): string | undefined { return process.env.AUDIT_PROBE; }\n`,
      "utf8",
    );
  });

  assertFailure(result, {
    code: "undeclared-global",
    artifact: "src/probe.ts",
    detail: "process",
    sourceMarker,
  });
});

test("authored source referencing globalThis fails closed and names globalThis", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("m-71-b-evasion", ({ copiedPackage }) => {
    const probePath = resolve(copiedPackage, "src/probe.ts");
    writeFileSync(
      probePath,
      `// ${sourceMarker}\nexport function evade(u: string): unknown { return globalThis["fe" + "tch"](u); }\n`,
      "utf8",
    );
  });

  assertFailure(result, {
    code: "undeclared-global",
    artifact: "src/probe.ts",
    detail: "globalThis",
    sourceMarker,
  });
});

test("generated source referencing a global declared only for authored role fails closed", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("m-71-c-generated-global", ({ copiedPackage }) => {
    const validatorPath = resolve(copiedPackage, "src/generated/schema-validator.generated.cjs");
    const original = readFileSync(validatorPath, "utf8");
    writeFileSync(
      validatorPath,
      `/* ${sourceMarker} */\nconst _probeLength = Buffer.byteLength("probe", "utf8");\n${original}`,
      "utf8",
    );
  });

  assertFailure(result, {
    code: "undeclared-global",
    artifact: "src/generated/schema-validator.generated.cjs",
    detail: "Buffer",
    sourceMarker,
  });
});

test("generated source referencing an undeclared module specifier fails closed", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("m-71-d-generated-specifier", ({ copiedPackage }) => {
    const validatorPath = resolve(copiedPackage, "src/generated/schema-validator.generated.cjs");
    const original = readFileSync(validatorPath, "utf8");
    writeFileSync(
      validatorPath,
      `/* ${sourceMarker} */\nrequire("ajv/dist/runtime/ucs2length");\n${original}`,
      "utf8",
    );
  });

  assertFailure(result, {
    code: "undeclared-specifier",
    artifact: "src/generated/schema-validator.generated.cjs",
    detail: "ajv/dist/runtime/ucs2length",
    sourceMarker,
  });
});

test("authored source referencing a dynamic non-literal specifier fails closed", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("m-71-dynamic-specifier", ({ copiedPackage }) => {
    const probePath = resolve(copiedPackage, "src/probe.ts");
    writeFileSync(
      probePath,
      `// ${sourceMarker}\nconst dynamicName = "crypto";\nexport async function load() { return import(dynamicName); }\n`,
      "utf8",
    );
  });

  assertFailure(result, {
    code: "dynamic-specifier",
    artifact: "src/probe.ts",
    detail: "<dynamic-import>",
    sourceMarker,
  });
});

test("negative control: locally bound identifier sharing a global name passes", () => {
  const { output, status } = runCase("m-71-e-lexical-binding", ({ copiedPackage }) => {
    const probePath = resolve(copiedPackage, "src/probe.ts");
    writeFileSync(
      probePath,
      [
        "export function processName(process: string): string {",
        "  const Buffer = process.length;",
        "  return `${process}:${String(Buffer)}`;",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
  });

  assert.equal(status, 0, `negative control M-71-E over-reported and failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("negative control: aliased import property passes without false positive", () => {
  const { output, status } = runCase("m-71-aliased-import", ({ copiedPackage }) => {
    const probePath = resolve(copiedPackage, "src/probe.ts");
    writeFileSync(
      probePath,
      [
        "import { validateNoProhibitedData as localValidator } from './validation/index.js';",
        "export function check(data: unknown) {",
        "  return localValidator(data);",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
  });

  assert.equal(status, 0, `aliased import negative control failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("negative control: type-position references to utility types pass", () => {
  const { output, status } = runCase("m-71-f-type-positions", ({ copiedPackage }) => {
    const probePath = resolve(copiedPackage, "src/probe.ts");
    writeFileSync(
      probePath,
      [
        "export type ProbeConfig = {",
        "  payload: Uint8Array;",
        "  options: Partial<Record<string, unknown>>;",
        "  omitted: Omit<{ a: string; b: number }, 'b'>;",
        "  extracted: Extract<'x' | 'y', 'x'>;",
        "};",
        "",
      ].join("\n"),
      "utf8",
    );
  });

  assert.equal(status, 0, `negative control M-71-F over-reported and failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("negative control: class extending language global Error passes", () => {
  const { output, status } = runCase("m-71-class-extends-error", ({ copiedPackage }) => {
    const probePath = resolve(copiedPackage, "src/probe.ts");
    writeFileSync(
      probePath,
      [
        "export class CustomError extends Error {",
        "  constructor(message: string) {",
        "    super(message);",
        "    this.name = 'CustomError';",
        "  }",
        "}",
        "",
      ].join("\n"),
      "utf8",
    );
  });

  assert.equal(status, 0, `class extends Error negative control failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("authored class extending an undeclared host global fails closed", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("m-71-class-extends-undeclared", ({ copiedPackage }) => {
    const probePath = resolve(copiedPackage, "src/probe.ts");
    writeFileSync(
      probePath,
      `// ${sourceMarker}\nexport class CustomStream extends EventEmitter {}\n`,
      "utf8",
    );
  });

  assertFailure(result, {
    code: "undeclared-global",
    artifact: "src/probe.ts",
    detail: "EventEmitter",
    sourceMarker,
  });
});

test("unparseable source artifact fails closed", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("m-71-g-unparseable", ({ copiedPackage }) => {
    const brokenPath = resolve(copiedPackage, "src/generated/broken.generated.ts");
    writeFileSync(
      brokenPath,
      `// ${sourceMarker}\nexport const = { {{{ ;;\n`,
      "utf8",
    );
  });

  assertFailure(result, {
    code: "parse-failure",
    artifact: "src/generated/broken.generated.ts",
    detail: "broken.generated.ts",
    sourceMarker,
  });
});

test("unreadable source artifact and empty inventory fail closed", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const unreadableResult = runCase("m-71-h-unreadable", ({ copiedPackage }) => {
    const probePath = resolve(copiedPackage, "src/unreadable.ts");
    writeFileSync(probePath, `// ${sourceMarker}\nexport const x = 1;\n`, "utf8");
    chmodSync(probePath, 0o000);
  });

  assertFailure(unreadableResult, {
    code: "read-failure",
    artifact: "src/unreadable.ts",
    detail: "unreadable.ts",
    sourceMarker,
  });

  const emptyResult = runCase("m-71-h-empty", ({ copiedPackage }) => {
    const srcDir = resolve(copiedPackage, "src");
    resetDirectory(srcDir);
  });

  assert.notEqual(emptyResult.status, 0, `empty inventory mutation unexpectedly passed:\n${emptyResult.output}`);
  assert.match(emptyResult.output, /\[platform-coupling:empty-inventory\]/);
});

test("forbidden production integration filename diagnostic remains distinguishable", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("m-71-i-filename-distinguishability", ({ copiedPackage }) => {
    const forbiddenPath = resolve(copiedPackage, "src/transport.ts");
    writeFileSync(
      forbiddenPath,
      `// ${sourceMarker}\nexport const transportConfig = {};\n`,
      "utf8",
    );
  });

  assert.notEqual(result.status, 0, `filename mutation unexpectedly passed:\n${result.output}`);
  assert.match(result.output, /forbidden production integration filename/);
  assert.equal(result.output.includes("[platform-coupling:"), false, `diagnostic leaked coupling code:\n${result.output}`);
  assert.equal(result.output.includes(sourceMarker), false, `diagnostic leaked source content:\n${result.output}`);
  assert.ok(result.output.length < 4_096, `output length exceeded limit: ${String(result.output.length)} bytes`);
});

function runCase(name, mutate) {
  const targetDir = resolve(suiteRoot, name, "packages/security-audit-sdk-core");
  cloneSourceTree(packageRoot, targetDir);
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(targetDir, "node_modules"), "dir");
  const env = { ...process.env };
  if (mutate) mutate({ copiedPackage: targetDir, environment: env });
  const check = spawnSync(process.execPath, ["scripts/check-scope.mjs"], {
    cwd: targetDir,
    encoding: "utf8",
    env,
    timeout: 30_000,
  });
  return { status: check.status, output: `${check.stdout}\n${check.stderr}` };
}

function assertFailure({ output, status }, expectation) {
  assert.notEqual(status, 0, `mutation unexpectedly passed:\n${output}`);
  assert.match(output, new RegExp(`\\[platform-coupling:${expectation.code}\\]`));
  assert.ok(output.includes(expectation.artifact), `missing artifact ${expectation.artifact}`);
  assert.ok(output.includes(expectation.detail), `missing detail ${expectation.detail}`);
  assert.equal(output.includes(expectation.sourceMarker), false, `leaked marker`);
  assert.ok(output.length < 4_096, `output length exceeded limit`);
}

function cloneSourceTree(src, dest) {
  const ignored = new Set(["node_modules", "dist-tests", "dist-examples", "coverage", ".verification-output", "_vp_dummy.ts"]);
  cpSync(src, dest, {
    recursive: true,
    force: true,
    filter: (path) => !ignored.has(basename(path)),
  });
}

function resetDirectory(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
