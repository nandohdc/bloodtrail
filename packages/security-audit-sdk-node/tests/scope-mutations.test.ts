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

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-sdk-node-scope-"));
test.after(() => rmSync(suiteRoot, { recursive: true, force: true }));

const BASELINE_INVENTORY =
  "platform coupling inventory: authored: 15 artifacts, 91 references, host couplings: [none]; fetchExchange: 1 artifacts, 9 references, host couplings: [AbortSignal (1 site), fetch (1 site)]";

const PROBE_ARTIFACT = "src/probe.ts";

interface CouplingRejection {
  readonly name: string;
  readonly source: string;
  readonly code: string;
  readonly detail: string;
}

// A single probe module carrying exactly one unapproved coupling. `detail` is the
// specifier or identifier the gate must name back; `code` separates the two
// classes so a specifier failure can never be mistaken for a global one.
const COUPLING_REJECTIONS: ReadonlyArray<CouplingRejection> = [
  {
    // fetch is declared for src/fetch-exchange.ts alone (#113); anywhere else it
    // is still an undeclared host global.
    name: "the fetch adapter's host global fetch outside the adapter",
    source: 'export function leak(): unknown { return fetch; }\n',
    code: "undeclared-global",
    detail: "fetch",
  },
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
    name: "unapproved Node built-in node:child_process",
    source: 'import { spawn } from "node:child_process";\nexport const x = spawn;\n',
    code: "undeclared-specifier",
    detail: "node:child_process",
  },
  {
    name: "unprefixed built-in",
    source: 'import crypto from "crypto";\nexport const x = crypto;\n',
    code: "undeclared-specifier",
    detail: "crypto",
  },
  {
    name: "third-party external module specifier",
    source: 'import { Kafka } from "kafkajs";\nexport const x = Kafka;\n',
    code: "undeclared-specifier",
    detail: "kafkajs",
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
    name: "undeclared host global document",
    source: "export const title = document.title;\n",
    code: "undeclared-global",
    detail: "document",
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

// Placement mutations: code belonging to a package that does not exist yet must not
// become legal merely by landing in the Node binding. The filename class is reported
// without a `[platform-coupling:...]` code so the two rejection reasons stay distinct.
const FORBIDDEN_FILENAME_MUTATIONS: ReadonlyArray<{ readonly artifact: string; readonly source: string }> = [
  { artifact: "src/transport.ts", source: "export const transport = {};\n" },
  { artifact: "src/collector.ts", source: "export const collector = {};\n" },
  { artifact: "src/browser-client.ts", source: "export const browser = {};\n" },
  { artifact: "src/telemetry-exporter.ts", source: "export const exporter = {};\n" },
];

interface PackageManifest {
  exports: Record<string, unknown>;
  dependencies: Record<string, unknown>;
  [field: string]: unknown;
}

interface ManifestMutation {
  readonly name: string;
  readonly mutate: (manifest: PackageManifest) => void;
  readonly expected: RegExp;
}

const MANIFEST_MUTATIONS: ReadonlyArray<ManifestMutation> = [
  {
    name: "forbidden transport export",
    mutate: (manifest) => {
      manifest.exports["./transport"] = "./dist/transport.js";
    },
    expected: /package\.json: forbidden transport export/,
  },
  {
    name: "third-party dependency",
    mutate: (manifest) => {
      manifest.dependencies["kafkajs"] = "2.2.4";
    },
    expected: /dependencies must remain empty of third-party packages/,
  },
];

interface CaseResult {
  readonly status: number | null;
  readonly output: string;
}

function runCase(name: string, mutate?: (context: { copiedPackage: string; environment: NodeJS.ProcessEnv }) => void): CaseResult {
  const targetDir = resolve(suiteRoot, name, "packages/security-audit-sdk-node");
  stageIsolatedPackage({ sourceDir: packageRoot, targetDir });
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

interface ProbeCase {
  readonly name: string;
  readonly artifact: string;
  readonly source: string;
}

function runWithProbe(probe: ProbeCase): CaseResult {
  return runCase(probe.name, ({ copiedPackage }) => {
    writeFileSync(resolve(copiedPackage, probe.artifact), probe.source, "utf8");
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

function stageIsolatedPackage(directories: { readonly sourceDir: string; readonly targetDir: string }) {
  cpSync(directories.sourceDir, directories.targetDir, {
    recursive: true,
    force: true,
    filter: (entry) =>
      !entry.includes("node_modules") &&
      !entry.includes("dist-") &&
      !entry.includes("dist") &&
      !entry.includes("coverage"),
  });
}

test("unmutated sdk-node package passes the scope gate and reports declared coupling inventory", () => {
  const { output, status } = runCase("null-control");
  assert.equal(status, 0, `unmutated control failed:\n${output}`);
  assert.match(output, /scope passed: 16 SDK source files/);
  const inventoryLine = output.split(/\r?\n/).find((line) => line.startsWith("platform coupling inventory:"));
  assert.equal(inventoryLine, BASELINE_INVENTORY, `null control inventory changed:\n${output}`);
});

test("positive control: approved Node capabilities and first-party Core dependency pass", () => {
  const { output, status } = runWithProbe({
    name: "approved-capabilities",
    artifact: PROBE_ARTIFACT,
    source: [
      'import { AsyncLocalStorage } from "node:async_hooks";',
      'import { Buffer } from "node:buffer";',
      'import { randomUUID } from "node:crypto";',
      'import { setTimeout, clearTimeout } from "node:timers";',
      'import type { SecurityAuditSdk } from "@bloodtrail/security-audit-sdk-core";',
      'export const probe = { AsyncLocalStorage, Buffer, randomUUID, setTimeout, clearTimeout };',
      'export type SdkType = SecurityAuditSdk;',
      "",
    ].join("\n"),
  });
  assert.equal(status, 0, `approved capabilities failed:\n${output}`);
  assert.match(output, /scope passed: 17 SDK source files/);
});

for (const scenario of COUPLING_REJECTIONS) {
  test(`${scenario.name} is rejected`, () => {
    const result = runWithProbe({ name: slug(scenario.name), artifact: PROBE_ARTIFACT, source: scenario.source });
    verifyCouplingFailure(result, { code: scenario.code, artifact: PROBE_ARTIFACT, detail: scenario.detail });
  });
}

for (const scenario of FORBIDDEN_FILENAME_MUTATIONS) {
  test(`cross-package placement mutation: ${scenario.artifact} in sdk-node fails closed`, () => {
    const result = runWithProbe({ name: slug(scenario.artifact), artifact: scenario.artifact, source: scenario.source });
    assert.notEqual(result.status, 0, `filename mutation unexpectedly passed:\n${result.output}`);
    assert.match(
      result.output,
      new RegExp(`${scenario.artifact.replaceAll("/", "\\/")}: forbidden production integration filename`),
    );
    assert.equal(
      result.output.includes("[platform-coupling:"),
      false,
      `filename mutation leaked coupling diagnostic:\n${result.output}`,
    );
  });
}

for (const scenario of MANIFEST_MUTATIONS) {
  test(`package.json with ${scenario.name} fails closed`, () => {
    const result = runCase(slug(scenario.name), ({ copiedPackage }) => {
      const manifestPath = resolve(copiedPackage, "package.json");
      const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as PackageManifest;
      scenario.mutate(manifest);
      writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    });
    assert.notEqual(result.status, 0, `manifest mutation unexpectedly passed:\n${result.output}`);
    assert.match(result.output, scenario.expected);
  });
}

test("negative control: locally bound identifier matching global name passes", () => {
  const { output, status } = runWithProbe({ name: "locally-bound-identifier", artifact: PROBE_ARTIFACT, source: "export function processName(process: string): string { const Buffer = process.length; return `${process}:${Buffer}`; }\n" });
  assert.equal(status, 0, `negative control failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("negative control: type-position references pass without false positive", () => {
  const { output, status } = runWithProbe({ name: "type-positions", artifact: PROBE_ARTIFACT, source: "export type ProbeOptions = { bufferSize?: number; processId?: string; };\n" });
  assert.equal(status, 0, `type positions failed:\n${output}`);
  assert.match(output, /scope passed:/);
});

test("empty source inventory fails closed", () => {
  const result = runCase("empty-inventory", ({ copiedPackage }) => {
    rmSync(resolve(copiedPackage, "src"), { recursive: true, force: true });
    mkdirSync(resolve(copiedPackage, "src"), { recursive: true });
  });
  assert.notEqual(result.status, 0, `empty inventory mutation unexpectedly passed:\n${result.output}`);
  assert.match(result.output, /\[platform-coupling:empty-inventory\]/);
});

test("the fetch adapter importing a Node built-in beyond node:buffer fails closed", () => {
  const result = runCase("fetch-adapter-extra-builtin", ({ copiedPackage }) => {
    const adapterPath = resolve(copiedPackage, "src/fetch-exchange.ts");
    writeFileSync(adapterPath, `import http from "node:http";\nexport const leak = http;\n${readFileSync(adapterPath, "utf8")}`, "utf8");
  });
  verifyCouplingFailure(result, { code: "undeclared-specifier", artifact: "src/fetch-exchange.ts", detail: "node:http" });
});
