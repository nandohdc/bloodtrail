import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-collector-scope-"));
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

const BASELINE_INVENTORY = /scope passed: \d+ collector source files, zero approved runtime couplings/;

const PROBE_ARTIFACT = "src/probe.ts";

interface CouplingRejection {
  readonly name: string;
  readonly source: string;
  readonly code: string;
  readonly detail: string;
}

// A single probe module carrying exactly one unapproved coupling. The collector
// approves NO runtime specifier and NO host global: authored runtime code must
// be pure language behavior.
const COUPLING_REJECTIONS: ReadonlyArray<CouplingRejection> = [
  {
    name: "unapproved Node built-in node:fs",
    source: 'import { readFileSync } from "node:fs";\nexport const x = readFileSync;\n',
    code: "undeclared-specifier",
    detail: "node:fs",
  },
  {
    name: "unapproved Node built-in node:http",
    source: 'import http from "node:http";\nexport const x = http;\n',
    code: "undeclared-specifier",
    detail: "node:http",
  },
  {
    name: "unapproved Node built-in node:net",
    source: 'import net from "node:net";\nexport const x = net;\n',
    code: "undeclared-specifier",
    detail: "node:net",
  },
  {
    name: "third-party external module specifier",
    source: 'import { Kafka } from "kafkajs";\nexport const x = Kafka;\n',
    code: "undeclared-specifier",
    detail: "kafkajs",
  },
  {
    name: "first-party sdk-core specifier",
    source: 'import { createSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-core";\nexport const x = createSecurityAuditSdk;\n',
    code: "undeclared-specifier",
    detail: "@bloodtrail/security-audit-sdk-core",
  },
  {
    name: "undeclared host global process",
    source: "export const pid = process.pid;\n",
    code: "undeclared-global",
    detail: "process",
  },
  {
    name: "undeclared host global window",
    source: "export const location = window.location;\n",
    code: "undeclared-global",
    detail: "window",
  },
  {
    name: "undeclared host global Buffer",
    source: "export const length = Buffer.byteLength(\"x\");\n",
    code: "undeclared-global",
    detail: "Buffer",
  },
  {
    name: "dynamic evasion globalThis",
    source: 'export function evade(): unknown { return globalThis["fe" + "tch"]; }\n',
    code: "undeclared-global",
    detail: "globalThis",
  },
  {
    name: "dynamic evasion eval",
    source: 'export function evade(): unknown { return eval("process"); }\n',
    code: "undeclared-global",
    detail: "eval",
  },
  {
    name: "dynamic evasion Function constructor",
    source: 'export function evade(): unknown { return Function("return process")(); }\n',
    code: "undeclared-global",
    detail: "Function",
  },
];

// Filename mutations: the production surface the bounded ingress must never grow.
// The collector package's own name is NOT a forbidden term (it is the identity);
// server, storage, transport and friends are.
const FORBIDDEN_FILENAME_MUTATIONS: ReadonlyArray<{ readonly artifact: string; readonly source: string }> = [
  { artifact: "src/transport.ts", source: "export const transport = {};\n" },
  { artifact: "src/storage.ts", source: "export const storage = {};\n" },
  { artifact: "src/server.ts", source: "export const server = {};\n" },
  { artifact: "src/telemetry-exporter.ts", source: "export const exporter = {};\n" },
  { artifact: "src/http-client.ts", source: "export const httpClient = {};\n" },
];

interface CaseResult {
  readonly status: number | null;
  readonly output: string;
}

function runCase(name: string, mutate?: (context: { copiedPackage: string }) => void): CaseResult {
  const targetDir = resolve(suiteRoot, name, "packages/security-audit-collector");
  stageIsolatedPackage(packageRoot, targetDir);
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(targetDir, "node_modules"), "dir");
  if (mutate) mutate({ copiedPackage: targetDir });
  const check = spawnSync(process.execPath, ["scripts/check-scope.mjs"], {
    cwd: targetDir,
    encoding: "utf8",
    timeout: 30_000,
  });
  return { status: check.status, output: `${check.stdout}\n${check.stderr}` };
}

function runWithProbe(name: string, artifact: string, source: string): CaseResult {
  return runCase(name, ({ copiedPackage }) => {
    writeFileSync(resolve(copiedPackage, artifact), source, "utf8");
  });
}

function verifyCouplingFailure(result: CaseResult, expected: { code: string; artifact: string; detail: string }) {
  assert.notEqual(result.status, 0, "platform coupling mutation should fail");
  assert.match(result.output, new RegExp(`\\[platform-coupling:${expected.code}\\]`));
  assert.ok(result.output.includes(expected.artifact), `missing artifact: ${expected.artifact}`);
  assert.ok(result.output.includes(expected.detail), `missing detail: ${expected.detail}`);
  assert.ok(result.output.length < 4_096, "scope diagnostic buffer exceeded 4KB boundary");
}

function slug(value: string): string {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, "-").replaceAll(/(?:^-|-$)/g, "");
}

function stageIsolatedPackage(sourceDir: string, targetDir: string) {
  cpSync(sourceDir, targetDir, {
    recursive: true,
    force: true,
    filter: (entry) =>
      !entry.includes("node_modules") &&
      !entry.includes("dist-") &&
      !entry.includes("dist") &&
      !entry.includes("coverage"),
  });
}

test("unmutated collector package passes the scope gate and reports zero approved couplings", () => {
  const { output, status } = runCase("null-control");
  assert.equal(status, 0, `unmutated control failed:\n${output}`);
  assert.match(output, BASELINE_INVENTORY);
  assert.ok(output.includes("host couplings: [none]"), `unexpected host couplings:\n${output}`);
});

test("positive control: language globals stay approved without false positives", () => {
  const { output, status } = runWithProbe(
    "language-globals",
    PROBE_ARTIFACT,
    "export function measure(text: string): number { return new TextEncoder().encode(text).byteLength + JSON.stringify({}).length; }\n",
  );
  assert.equal(status, 0, `language-global control failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

for (const scenario of COUPLING_REJECTIONS) {
  test(`${scenario.name} is rejected`, () => {
    const result = runWithProbe(slug(scenario.name), PROBE_ARTIFACT, scenario.source);
    verifyCouplingFailure(result, { code: scenario.code, artifact: PROBE_ARTIFACT, detail: scenario.detail });
  });
}

for (const scenario of FORBIDDEN_FILENAME_MUTATIONS) {
  test(`filename mutation: ${scenario.artifact} fails closed`, () => {
    const result = runWithProbe(slug(scenario.artifact), scenario.artifact, scenario.source);
    assert.notEqual(result.status, 0, `filename mutation unexpectedly passed:\n${result.output}`);
    assert.match(
      result.output,
      new RegExp(`${scenario.artifact.replaceAll("/", "\\/")}: forbidden production integration filename`),
    );
  });
}

test("negative control: locally bound identifier matching a host-global name passes", () => {
  const { output, status } = runWithProbe(
    "locally-bound-identifier",
    PROBE_ARTIFACT,
    "export function processName(process: string): string { const Buffer = process.length; return `${process}:${Buffer}`; }\n",
  );
  assert.equal(status, 0, `negative control failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("manifest mutation: a runtime dependency fails closed", () => {
  const result = runCase("runtime-dependency", ({ copiedPackage }) => {
    const manifestPath = resolve(copiedPackage, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as { dependencies?: Record<string, string> };
    manifest.dependencies = { kafkajs: "2.2.4" };
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  });
  assert.notEqual(result.status, 0, `manifest mutation unexpectedly passed:\n${result.output}`);
  assert.match(result.output, /dependencies must remain empty/);
});

test("manifest mutation: a forbidden transport export fails closed", () => {
  const result = runCase("transport-export", ({ copiedPackage }) => {
    const manifestPath = resolve(copiedPackage, "package.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
      exports: Record<string, unknown>;
    };
    manifest.exports["./transport"] = "./dist/transport.js";
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  });
  assert.notEqual(result.status, 0, `manifest mutation unexpectedly passed:\n${result.output}`);
  assert.match(result.output, /forbidden transport export/);
});

test("empty source inventory fails closed", () => {
  const result = runCase("empty-inventory", ({ copiedPackage }) => {
    rmSync(resolve(copiedPackage, "src"), { recursive: true, force: true });
    mkdirSync(resolve(copiedPackage, "src"), { recursive: true });
  });
  assert.notEqual(result.status, 0, `empty inventory mutation unexpectedly passed:\n${result.output}`);
  assert.match(result.output, /\[platform-coupling:empty-inventory\]/);
});
