import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { assert, runChecked } from "./verification-helpers.mjs";

// One pinned release of each supported pnpm major. The kit's documents name exactly these majors.
export const PNPM_RELEASES = Object.freeze(["10.17.0", "11.28.2", "12.8.1"]);

// pnpm 11 and later no longer read the consumer manifest's `pnpm` field, so the kit
// carries its pnpm override in a settings file, which also makes the kit its own
// pnpm workspace root.
export const PNPM_SETTINGS_FILE = "pnpm-workspace.yaml";

const CORE_PACKAGE = "@bloodtrail/security-audit-sdk-core";

const INSTALLER_DOCS = Object.freeze(["docs/quickstart.md", "docs/known-issues.md", "docs/integration-and-testing.md"]);
const SETTING_WARNING_PHRASE = /\bunknown\b|\bignored\b|\bno longer read\b/i;
const TOKEN_CHARACTER = /[\p{L}\p{N}_-]/u;
const NPM_SETTINGS_FILE = ".npmrc";
const MANIFEST_FILE = "package.json";

function settingRecord(name, source) {
  return { name, source };
}

function npmrcSettingName(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith("#")) return null;
  if (trimmed.startsWith(";")) return null;
  const separator = trimmed.indexOf("=");
  if (separator <= 0) return null;
  return trimmed.slice(0, separator).trim() || null;
}

function readNpmrcSettings(installDir) {
  const source = NPM_SETTINGS_FILE;
  const path = resolve(installDir, source);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .flatMap((line) => {
      const name = npmrcSettingName(line);
      return name ? [settingRecord(name, source)] : [];
    });
}

function pnpmWorkspaceSettingName(line) {
  if (line !== line.trimStart()) return null;
  if (line.startsWith("#")) return null;
  const separator = line.indexOf(":");
  if (separator <= 0) return null;
  return line.slice(0, separator).trim() || null;
}

function readPnpmWorkspaceSettings(installDir) {
  const source = PNPM_SETTINGS_FILE;
  const path = resolve(installDir, source);
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8")
    .split(/\r?\n/)
    .flatMap((line) => {
      const name = pnpmWorkspaceSettingName(line);
      return name ? [settingRecord(name, source)] : [];
    });
}

function objectKeys(value) {
  if (!value || typeof value !== "object") return [];
  if (Array.isArray(value)) return [];
  return Object.keys(value);
}

function readManifestSettings(installDir) {
  const source = MANIFEST_FILE;
  const path = resolve(installDir, source);
  if (!existsSync(path)) return [];
  const manifest = JSON.parse(readFileSync(path, "utf8"));
  const settings = [];
  if (Object.hasOwn(manifest, "overrides")) settings.push(settingRecord("overrides", source));
  if (Object.hasOwn(manifest, "pnpm")) {
    settings.push(settingRecord("pnpm", source));
    for (const key of objectKeys(manifest.pnpm)) {
      settings.push(settingRecord(`pnpm.${key}`, source));
    }
  }
  return settings;
}

function readShippedSettings(installDir) {
  return [
    ...readNpmrcSettings(installDir),
    ...readPnpmWorkspaceSettings(installDir),
    ...readManifestSettings(installDir),
  ];
}

function isTokenCharacter(character = "") {
  return TOKEN_CHARACTER.test(character);
}

function isSettingBoundary(before, after) {
  return !isTokenCharacter(before) && !isTokenCharacter(after);
}

function lineNamesSetting(line, name) {
  const segments = line.split(name);
  return segments.slice(0, -1).some((before, index) => isSettingBoundary(before.at(-1), segments[index + 1].at(0)));
}

function reportedSettingsOnLine(line, settings) {
  if (!SETTING_WARNING_PHRASE.test(line)) return [];
  return settings.filter(({ name }) => lineNamesSetting(line, name)).map((setting) => ({ ...setting, line }));
}

function findReportedSettings(output, settings) {
  return output.split(/\r?\n/).flatMap((line) => reportedSettingsOnLine(line, settings));
}

function formatSettingFindings(findings) {
  return findings.map(({ name, source, line }) => `${name} from ${source}: ${JSON.stringify(line)}`).join("\n");
}

function pnpmMajor(release) {
  return release.split(".")[0];
}

// "pnpm 10, 11 and 12"
export function supportedPnpmPhrase() {
  const majors = PNPM_RELEASES.map(pnpmMajor);
  return `pnpm ${majors.slice(0, -1).join(", ")} and ${majors.at(-1)}`;
}

// JSON strings are valid YAML double-quoted scalars.
export function createPnpmSettings(coreFilename) {
  const coreSpecifier = JSON.stringify("./" + coreFilename);
  return `overrides:\n  ${JSON.stringify(CORE_PACKAGE)}: ${coreSpecifier}\n`;
}

export function runInstaller(label, command, args, cwd) {
  const shippedSettings = readShippedSettings(cwd);
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  const output = `${result.stdout}${result.stderr}`;
  assert(result.status === 0, `${label} install failed with exit status ${String(result.status)}:\n${output}`);
  const findings = findReportedSettings(output, shippedSettings);
  assert(
    findings.length === 0,
    `${label} reported a shipped kit setting as unknown, ignored or no longer read:\n${formatSettingFindings(findings)}`,
  );
  return output;
}

const PROBE_SCRIPT_CONTENT = `import assert from "node:assert/strict";
import { createNodeSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authenticatedHumanActor,
} from "@bloodtrail/security-audit-sdk-core";

const COPY_PROBE_KEY = Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1");
const probes = globalThis[COPY_PROBE_KEY];
assert(Array.isArray(probes), "copy probe channel must be an array");

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { name: "eval-probe", version: "1.0.0" },
  service: { name: "eval-probe", version: "1.0.0" },
  environment: { name: "development" },
  sink: { emit: async () => ({ status: "accepted", event_id: "probe-1" }) },
});

const actor = authenticatedHumanActor({ id: "actor-probe", displayName: "Probe User" });
sdk.runWithContext({ actor }, () => {});
assert.equal(probes.length, 1, "expected exactly 1 core copy");
console.log("duplicate-copy-probe:pass");
`;

const OWN_SERVICE_SECTION_HEADING = "## Adding the Kit to Your Own Service";
const OWN_SERVICE_DEPENDENCY_ERROR =
  "the documented own-service install must list both @bloodtrail/security-audit-sdk-core and @bloodtrail/security-audit-sdk-node in dependencies";

function documentedOwnServiceSection(guide) {
  const lines = guide.split(/\r?\n/);
  const starts = lines.flatMap((line, index) => (line === OWN_SERVICE_SECTION_HEADING ? [index] : []));
  assert(
    starts.length === 1,
    'docs/integration-and-testing.md must hold the section "## Adding the Kit to Your Own Service" exactly once',
  );
  const start = starts[0];
  const end = lines.findIndex((line, index) => index > start && line.startsWith("## "));
  return { startLine: start + 1, endLine: end === -1 ? lines.length + 1 : end + 1 };
}

async function readDocumentedOwnServiceInstall(kitDir) {
  const guide = await readFile(resolve(kitDir, "docs/integration-and-testing.md"), "utf8");
  const { startLine, endLine } = documentedOwnServiceSection(guide);
  // Imported on use: the kit builder loads this module from a clone without node_modules, and the
  // document-block module loads TypeScript.
  const { extractFencedBlocks } = await import("./evaluation-kit-doc-blocks.mjs");
  const fences = extractFencedBlocks(guide).filter(
    ({ openingLine }) => openingLine > startLine && openingLine < endLine,
  );
  const jsonFences = fences.filter(({ language }) => language.toLowerCase() === "json");
  const yamlFences = fences.filter(({ language }) => language.toLowerCase() === "yaml");
  assert(jsonFences.length === 1, "the documented own-service install must hold exactly one JSON fence");
  assert(yamlFences.length === 1, "the documented own-service install must hold exactly one YAML fence");

  const manifest = JSON.parse(jsonFences[0].body);
  const dependencies = manifest.dependencies;
  assert(
    dependencies &&
      typeof dependencies === "object" &&
      Object.hasOwn(dependencies, "@bloodtrail/security-audit-sdk-core") &&
      Object.hasOwn(dependencies, "@bloodtrail/security-audit-sdk-node"),
    OWN_SERVICE_DEPENDENCY_ERROR,
  );
  return { manifest, pnpmSettings: yamlFences[0].body };
}

const OWN_SERVICE_PROBE_SCRIPT_CONTENT = `import assert from "node:assert/strict";
import { createNodeSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-node";
import {
  CONTRACT_VERSION,
  authenticatedHumanActor,
} from "@bloodtrail/security-audit-sdk-core";
import { createCapturingAuditSink } from "@bloodtrail/security-audit-sdk-core/testing";

const COPY_PROBE_KEY = Symbol.for("bloodtrail.security-audit-sdk-core.copy-probe.v1");
const probes = globalThis[COPY_PROBE_KEY];
assert(Array.isArray(probes), "copy probe channel must be an array");

const sdk = createNodeSecurityAuditSdk({
  contractVersion: CONTRACT_VERSION,
  producer: { name: "eval-probe", version: "1.0.0" },
  service: { name: "eval-probe", version: "1.0.0" },
  environment: { name: "development" },
  sink: createCapturingAuditSink(),
});

const actor = authenticatedHumanActor({ id: "actor-probe", displayName: "Probe User" });
sdk.runWithContext({ actor }, () => {});
assert.equal(probes.length, 1, "expected exactly 1 core copy");
await sdk.shutdown();
console.log("duplicate-copy-probe:pass");
`;

const KIT_PROBE = Object.freeze({ file: "check-duplicate-core.mjs", content: PROBE_SCRIPT_CONTENT });
const OWN_SERVICE_PROBE = Object.freeze({ file: "check-own-service-core.mjs", content: OWN_SERVICE_PROBE_SCRIPT_CONTENT });

// Counts the core copies that load at runtime, so it holds for any installer's layout.
async function runCopyProbe(installDir, label, { file, content }) {
  await writeFile(resolve(installDir, file), content, "utf8");
  const probe = spawnSync(process.execPath, ["--no-warnings", file], {
    cwd: installDir,
    encoding: "utf8",
  });
  const output = `${probe.stderr}${probe.stdout}`;
  if (output.includes("DUPLICATE_AUTHORITY")) {
    throw new Error(`duplicate-copy probe under ${label} reported DUPLICATE_AUTHORITY:\n${output}`);
  }
  assert(probe.status === 0, `duplicate-copy probe under ${label} failed with exit status ${String(probe.status)}:\n${output}`);
  assert(probe.stdout.includes("duplicate-copy-probe:pass"), `duplicate-copy probe did not pass under ${label}`);
}

export async function runCoreCopyProbe(installDir, label) {
  await runCopyProbe(installDir, label, KIT_PROBE);
}

// Returns a command's exit status with its combined output, for a check that quotes a failing command's report.
function runReporting(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  return { status: result.status, output: `${result.stdout}${result.stderr}` };
}

export async function verifyPnpmInstall(kitDir, release) {
  const label = `pnpm ${release}`;
  const installDir = await mkdtemp(resolve(tmpdir(), `bloodtrail-eval-pnpm-${pnpmMajor(release)}-`));
  try {
    await cp(kitDir, installDir, { recursive: true });
    runInstaller(label, "npx", ["--yes", `pnpm@${release}`, "install", "--prod", "--ignore-scripts"], installDir);

    const firstEvent = runChecked(process.execPath, ["--no-warnings", "examples/first-event.ts"], {
      cwd: installDir,
      capture: true,
    });
    assert(firstEvent.includes("first-event:pass"), `examples/first-event.ts did not succeed under ${label}:\n${firstEvent}`);

    await runCoreCopyProbe(installDir, label);
  } finally {
    await rm(installDir, { recursive: true, force: true });
  }
}

export async function verifyPnpmInstalls(kitDir) {
  for (const release of PNPM_RELEASES) {
    await verifyPnpmInstall(kitDir, release);
  }
}

export async function verifyOwnServiceInstall(kitDir, installer) {
  const isNpm = installer === "npm";
  assert(isNpm || PNPM_RELEASES.includes(installer), `unsupported own-service installer: ${installer}`);
  const label = isNpm ? "own service npm" : `own service pnpm ${installer}`;
  const { manifest: documentedManifest, pnpmSettings } = await readDocumentedOwnServiceInstall(kitDir);
  const root = await mkdtemp(resolve(tmpdir(), "bloodtrail-own-service-"));
  const copiedKit = resolve(root, "evaluation-kit");
  const serviceDir = resolve(root, "my-service");
  try {
    await cp(kitDir, copiedKit, { recursive: true });
    await mkdir(serviceDir);
    await writeFile(
      resolve(serviceDir, MANIFEST_FILE),
      JSON.stringify({ name: "own-service", version: "1.0.0", private: true, ...documentedManifest }, null, 2) + "\n",
      "utf8",
    );
    if (!isNpm) await writeFile(resolve(serviceDir, PNPM_SETTINGS_FILE), `${pnpmSettings}\n`, "utf8");

    if (isNpm) {
      runInstaller(label, "npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline"], serviceDir);
      const listed = runReporting("npm", ["ls", "--all"], serviceDir);
      assert(listed.status === 0, `own service npm install left an invalid dependency tree:\n${listed.output}`);
    } else {
      runInstaller(label, "npx", ["--yes", `pnpm@${installer}`, "install", "--prod", "--ignore-scripts"], serviceDir);
    }
    await runCopyProbe(serviceDir, label, OWN_SERVICE_PROBE);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

export async function verifyOwnServiceInstalls(kitDir) {
  await verifyOwnServiceInstall(kitDir, "npm");
  for (const release of PNPM_RELEASES) {
    await verifyOwnServiceInstall(kitDir, release);
  }
}

export async function assertKitDocsNameInstallers(kitDir) {
  const phrase = supportedPnpmPhrase();
  for (const doc of INSTALLER_DOCS) {
    const text = await readFile(resolve(kitDir, doc), "utf8");
    assert(text.includes(phrase), `${doc} must name the supported pnpm majors exactly as "${phrase}"`);
  }
}
