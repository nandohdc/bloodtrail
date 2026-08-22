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

const POSITIVE_MUTATIONS = [
  {
    name: "m-71-a-authored-global",
    file: "src/probe.ts",
    generate: (marker) => `// ${marker}\nexport function readEnv(): string | undefined { return process.env.AUDIT_PROBE; }\n`,
    expected: { code: "undeclared-global", artifact: "src/probe.ts", detail: "process" },
  },
  {
    name: "m-71-b-evasion",
    file: "src/probe.ts",
    generate: (marker) => `// ${marker}\nexport function evade(u: string): unknown { return globalThis["fe" + "tch"](u); }\n`,
    expected: { code: "undeclared-global", artifact: "src/probe.ts", detail: "globalThis" },
  },
  {
    name: "m-71-c-generated-global",
    file: "src/generated/schema-validator.generated.cjs",
    generate: (marker, original) => `/* ${marker} */\nconst _probeLength = Buffer.byteLength("probe", "utf8");\n${original}`,
    expected: { code: "undeclared-global", artifact: "src/generated/schema-validator.generated.cjs", detail: "Buffer" },
  },
  {
    name: "m-71-d-generated-specifier",
    file: "src/generated/schema-validator.generated.cjs",
    generate: (marker, original) => `/* ${marker} */\nrequire("ajv/dist/runtime/ucs2length");\n${original}`,
    expected: { code: "undeclared-specifier", artifact: "src/generated/schema-validator.generated.cjs", detail: "ajv/dist/runtime/ucs2length" },
  },
  {
    name: "m-71-dynamic-specifier",
    file: "src/probe.ts",
    generate: (marker) => `// ${marker}\nconst dynamicName = "crypto";\nexport async function load() { return import(dynamicName); }\n`,
    expected: { code: "dynamic-specifier", artifact: "src/probe.ts", detail: "<dynamic-import>" },
  },
  {
    name: "m-71-class-extends-undeclared",
    file: "src/probe.ts",
    generate: (marker) => `// ${marker}\nexport class CustomStream extends EventEmitter {}\n`,
    expected: { code: "undeclared-global", artifact: "src/probe.ts", detail: "EventEmitter" },
  },
  {
    name: "m-71-g-unparseable",
    file: "src/generated/broken.generated.ts",
    generate: (marker) => `// ${marker}\nexport const = { {{{ ;;\n`,
    expected: { code: "parse-failure", artifact: "src/generated/broken.generated.ts", detail: "broken.generated.ts" },
  },
];

test("unmutated package copy passes the scope gate and reports declared coupling inventory", () => {
  const { output, status } = runCase("null");
  assert.equal(status, 0, `unmutated control failed:\n${output}`);
  assert.match(output, /scope passed:/);
  assert.match(output, /platform coupling inventory:/);
  assert.match(output, /authored:/);
  assert.match(output, /generated:/);
});

test("authored and generated mutations fail closed with expected diagnostics", () => {
  for (const scenario of POSITIVE_MUTATIONS) {
    const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
    const result = runCase(scenario.name, ({ copiedPackage }) => {
      const targetPath = resolve(copiedPackage, scenario.file);
      const original = readExisting(targetPath);
      writeFileSync(targetPath, scenario.generate(sourceMarker, original), "utf8");
    });
    assertFailure(result, { ...scenario.expected, sourceMarker });
  }
});

test("negative control: locally bound identifier sharing a global name passes", () => {
  const { output, status } = runCase("m-71-e-lexical-binding", ({ copiedPackage }) => {
    writeFileSync(
      resolve(copiedPackage, "src/probe.ts"),
      "export function processName(process: string): string {\n  const Buffer = process.length;\n  return `${process}:${String(Buffer)}`;\n}\n",
      "utf8",
    );
  });
  assert.equal(status, 0, `negative control M-71-E failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("negative control: aliased import property passes without false positive", () => {
  const { output, status } = runCase("m-71-aliased-import", ({ copiedPackage }) => {
    writeFileSync(
      resolve(copiedPackage, "src/probe.ts"),
      "import { validateNoProhibitedData as localValidator } from './validation/index.js';\nexport function check(data: unknown) { return localValidator(data); }\n",
      "utf8",
    );
  });
  assert.equal(status, 0, `aliased import negative control failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("negative control: type-position references to utility types pass", () => {
  const { output, status } = runCase("m-71-f-type-positions", ({ copiedPackage }) => {
    writeFileSync(
      resolve(copiedPackage, "src/probe.ts"),
      "export type ProbeConfig = { payload: Uint8Array; options: Partial<Record<string, unknown>>; omitted: Omit<{ a: string; b: number }, 'b'>; extracted: Extract<'x' | 'y', 'x'>; };\n",
      "utf8",
    );
  });
  assert.equal(status, 0, `negative control M-71-F failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("negative control: class extending language global Error passes", () => {
  const { output, status } = runCase("m-71-class-extends-error", ({ copiedPackage }) => {
    writeFileSync(
      resolve(copiedPackage, "src/probe.ts"),
      "export class CustomError extends Error { constructor(message: string) { super(message); this.name = 'CustomError'; } }\n",
      "utf8",
    );
  });
  assert.equal(status, 0, `class extends Error negative control failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("unreadable source artifact and empty inventory fail closed", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const unreadableResult = runCase("m-71-h-unreadable", ({ copiedPackage }) => {
    const probePath = resolve(copiedPackage, "src/unreadable.ts");
    writeFileSync(probePath, `// ${sourceMarker}\nexport const x = 1;\n`, "utf8");
    try {
      chmodSync(probePath, 0);
    } catch {
      // ignore on systems where chmod is not supported
    }
  });

  assertFailure(unreadableResult, {
    code: "read-failure",
    artifact: "src/unreadable.ts",
    detail: "unreadable.ts",
    sourceMarker,
  });

  const emptyResult = runCase("m-71-h-empty", ({ copiedPackage }) => {
    resetDirectory(resolve(copiedPackage, "src"));
  });

  assert.notEqual(emptyResult.status, 0, `empty inventory mutation unexpectedly passed:\n${emptyResult.output}`);
  assert.match(emptyResult.output, /\[platform-coupling:empty-inventory\]/);
});

test("forbidden production integration filename diagnostic remains distinguishable", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("m-71-i-filename-distinguishability", ({ copiedPackage }) => {
    writeFileSync(
      resolve(copiedPackage, "src/transport.ts"),
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

function readExisting(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

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

function assertFailure({ output, status }, { code, artifact, detail, sourceMarker }) {
  assert.notEqual(status, 0, `mutation unexpectedly passed:\n${output}`);
  assert.match(output, new RegExp(`\\[platform-coupling:${code}\\]`));
  assert.ok(output.includes(artifact), `missing artifact ${artifact}`);
  assert.ok(output.includes(detail), `missing detail ${detail}`);
  assert.equal(output.includes(sourceMarker), false, `leaked marker`);
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
