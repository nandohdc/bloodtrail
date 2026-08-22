import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
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
    name: "m-71-j-loop-header-global",
    file: "src/probe.ts",
    generate: (marker) => `// ${marker}\nexport function scan(): string[] { const out: string[] = []; for (const value of process.argv) { out.push(value); } return out; }\n`,
    expected: { code: "undeclared-global", artifact: "src/probe.ts", detail: "process" },
  },
  {
    name: "m-71-k-loop-condition-global",
    file: "src/probe.ts",
    generate: (marker) => `// ${marker}\nexport function count(): number { let n = 0; for (let i = 0; i < process.pid; i += 1) { n += 1; } return n; }\n`,
    expected: { code: "undeclared-global", artifact: "src/probe.ts", detail: "process" },
  },
  {
    name: "m-71-l-loop-header-specifier",
    file: "src/probe.ts",
    generate: (marker) => `// ${marker}\nexport async function load(): Promise<unknown[]> { const out: unknown[] = []; for (const m of [await import("kafkajs")]) { out.push(m); } return out; }\n`,
    expected: { code: "undeclared-specifier", artifact: "src/probe.ts", detail: "kafkajs" },
  },
  {
    name: "m-71-m-destructuring-default",
    file: "src/probe.ts",
    generate: (marker) => `// ${marker}\nexport function home(input: { home?: string }): string | undefined { const { home = process.env.HOME } = input; return home; }\n`,
    expected: { code: "undeclared-global", artifact: "src/probe.ts", detail: "process" },
  },
  {
    name: "m-71-n-computed-method-name",
    file: "src/probe.ts",
    generate: (marker) => `// ${marker}\nexport class Probe { [process.pid](): number { return 1; } }\n`,
    expected: { code: "undeclared-global", artifact: "src/probe.ts", detail: "process" },
  },
  {
    name: "m-71-o-dynamic-function-evasion",
    file: "src/probe.ts",
    generate: (marker) => `// ${marker}\nexport function evade(): unknown { return Function("return " + "pro" + "cess")(); }\n`,
    expected: { code: "undeclared-global", artifact: "src/probe.ts", detail: "Function" },
  },
  {
    name: "m-71-p-eval-evasion",
    file: "src/probe.ts",
    generate: (marker) => `// ${marker}\nexport function evade(): unknown { return eval("process"); }\n`,
    expected: { code: "undeclared-global", artifact: "src/probe.ts", detail: "eval" },
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
    verifyCouplingFailure(result, { ...scenario.expected, sourceMarker });
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

test("negative control: destructuring defaults over language globals pass", () => {
  const { output, status } = runCase("m-71-s-destructuring-language-default", ({ copiedPackage }) => {
    writeFileSync(
      resolve(copiedPackage, "src/probe.ts"),
      "export function limits(input: { size?: number }): number {\n  const { size = Number.MAX_SAFE_INTEGER } = input;\n  for (const key of Object.keys(input)) { if (key === 'size') continue; }\n  return size;\n}\n",
      "utf8",
    );
  });
  assert.equal(status, 0, `destructuring-default negative control failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("unreadable source artifact and empty inventory fail closed", (t) => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  let denied = false;
  const unreadableResult = runCase("m-71-h-unreadable", ({ copiedPackage }) => {
    const probePath = resolve(copiedPackage, "src/unreadable.ts");
    writeFileSync(probePath, `// ${sourceMarker}\nexport const x = 1;\n`, "utf8");
    denied = denyRead(probePath, (path) => readFileSync(path));
  });

  if (denied) {
    verifyCouplingFailure(unreadableResult, {
      code: "read-failure",
      artifact: "src/unreadable.ts",
      detail: "unreadable.ts",
      sourceMarker,
    });
  } else {
    t.diagnostic("skipped M-71-H unreadable-file arm: mode bits do not deny this user (root or a mode-less filesystem)");
  }

  const emptyResult = runCase("m-71-h-empty", ({ copiedPackage }) => {
    resetDirectory(resolve(copiedPackage, "src"));
  });

  assert.notEqual(emptyResult.status, 0, `empty inventory mutation unexpectedly passed:\n${emptyResult.output}`);
  assert.match(emptyResult.output, /\[platform-coupling:empty-inventory\]/);
});

test("unreadable source directory fails closed instead of dropping its subtree", (t) => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  let denied = false;
  let probeDir = "";
  const result = runCase("m-71-q-unreadable-directory", ({ copiedPackage }) => {
    probeDir = resolve(copiedPackage, "src/sealed");
    mkdirSync(probeDir, { recursive: true });
    writeFileSync(
      resolve(probeDir, "probe.ts"),
      `// ${sourceMarker}\nexport const leak = process.env;\n`,
      "utf8",
    );
    denied = denyRead(probeDir, (path) => readdirSync(path));
  });
  // A 0o000 directory cannot be traversed, so the suite's rmSync would fail
  // with ENOTEMPTY. Restore the mode now that the gate has run.
  restoreMode(probeDir);

  if (!denied) {
    t.diagnostic("skipped M-71-Q: mode bits do not deny this user (root or a mode-less filesystem)");
    return;
  }
  verifyCouplingFailure(result, {
    code: "directory-read-failure",
    artifact: "src/sealed",
    detail: "sealed",
    sourceMarker,
  });
});

test("symlinked source artifact fails closed rather than going uninspected", () => {
  const sourceMarker = "SOURCE_MARKER_MUST_NOT_APPEAR_IN_DIAGNOSTICS";
  const result = runCase("m-71-r-symlinked-source", ({ copiedPackage }) => {
    // The target sits outside src/ so the walk can only reach it through the
    // link. tsc would follow it into dist/, so leaving it uncounted, unread and
    // unreported is exactly the gap this arm guards.
    const outside = resolve(copiedPackage, "linked-probe.ts.txt");
    writeFileSync(outside, `// ${sourceMarker}\nexport const leak = process.env;\n`, "utf8");
    symlinkSync(outside, resolve(copiedPackage, "src/linked.ts"), "file");
  });

  verifyCouplingFailure(result, {
    code: "unsupported-entry",
    artifact: "src/linked.ts",
    detail: "linked.ts",
    sourceMarker,
  });
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

// chmod 0o000 is a no-op for root, and CI may run as root on a self-hosted
// runner. Confirm the mode actually denies *this* process before asserting the
// gate reacts to it, so the arm skips rather than failing spuriously.
function denyRead(targetPath, probe) {
  try {
    chmodSync(targetPath, 0o000);
  } catch {
    return false;
  }
  try {
    probe(targetPath);
    return false;
  } catch {
    return true;
  }
}

function restoreMode(targetPath) {
  try {
    chmodSync(targetPath, 0o755);
  } catch {
    // nothing to restore
  }
}

function readExisting(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return "";
  }
}

function runCase(name, mutate) {
  const targetDir = resolve(suiteRoot, name, "packages/security-audit-sdk-core");
  stageIsolatedPackage(packageRoot, targetDir);
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

function verifyCouplingFailure({ output, status }, expected) {
  assert.notEqual(status, 0, "platform coupling mutation should fail");
  assert.match(output, new RegExp(`\\[platform-coupling:${expected.code}\\]`));
  assert.ok(output.includes(expected.artifact), `missing artifact: ${expected.artifact}`);
  assert.ok(output.includes(expected.detail), `missing detail: ${expected.detail}`);
  if (expected.sourceMarker) {
    assert.equal(output.includes(expected.sourceMarker), false, "source marker leaked into error stream");
  }
  assert.ok(output.length < 4_096, "scope diagnostic buffer exceeded 4KB boundary");
}

function stageIsolatedPackage(sourceDir, targetDir) {
  cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true,
    filter: (entry) => !entry.includes("node_modules") && !entry.includes("dist-") && !entry.includes("coverage"),
  });
}

function resetDirectory(dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
}
