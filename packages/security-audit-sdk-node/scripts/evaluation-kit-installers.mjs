import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

// What an installer prints when it drops a kit setting, as measured on the pinned
// pnpm releases: `The "pnpm" field in package.json is no longer read by pnpm. The
// following keys were ignored: "pnpm.overrides".`
const IGNORED_SETTING_PATTERNS = Object.freeze([/no longer read/i, /\bwere ignored\b/i]);

const INSTALLER_DOCS = Object.freeze(["docs/quickstart.md", "docs/known-issues.md"]);

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
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  const output = `${result.stdout}${result.stderr}`;
  assert(result.status === 0, `${label} install failed with exit status ${String(result.status)}:\n${output}`);
  const ignored = IGNORED_SETTING_PATTERNS.find((pattern) => pattern.test(output));
  assert(!ignored, `${label} reported an ignored kit setting (${String(ignored)}):\n${output}`);
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

// Counts the core copies that load at runtime, so it holds for any installer's layout.
export async function runCoreCopyProbe(installDir, label) {
  await writeFile(resolve(installDir, "check-duplicate-core.mjs"), PROBE_SCRIPT_CONTENT, "utf8");
  const probe = spawnSync(process.execPath, ["--no-warnings", "check-duplicate-core.mjs"], {
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

export async function assertKitDocsNameInstallers(kitDir) {
  const phrase = supportedPnpmPhrase();
  for (const doc of INSTALLER_DOCS) {
    const text = await readFile(resolve(kitDir, doc), "utf8");
    assert(text.includes(phrase), `${doc} must name the supported pnpm majors exactly as "${phrase}"`);
  }
}
