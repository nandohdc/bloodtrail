import assert from "node:assert/strict";
import { mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import { command, filesBelow, sha256 } from "./io.mjs";

export const CORE = "@bloodtrail/security-audit-sdk-core";
export const NODE = "@bloodtrail/security-audit-sdk-node";
export const COLLECTOR = "@bloodtrail/security-audit-collector";
const PACKAGES = [CORE, NODE, COLLECTOR];
const INSTALL_SCRIPTS = ["preinstall", "install", "postinstall", "prepare"];

// Every public symbol the Stage 2 harness uses, checked against the packed declarations as text before
// expectations are frozen and before every run; nothing is imported or executed here.
export const SYMBOLS = Object.freeze({
  [CORE]: ["authenticatedHumanActor", "authoritativeTenant", "authenticatedPrincipal", "authenticationEvidence", "credentialReference", "sessionEvidence", "observedSource", "AuditEventSink", "AuditDeliveryResult", "AuditClock"],
  [NODE]: ["createNodeSecurityAuditSdk", "createHttpDeliveryHandoff", "createFetchHttpExchange", "createBoundedDeliveryRetry", "createBoundedDeliveryBackpressure", "createDeliveryShutdown", "nodeTimers"],
  [COLLECTOR]: ["CollectorIngress", "SqliteStorage", "SyntheticFixtureAuthenticator", "DIAGNOSTIC_CODES"],
});

export function assertNoInstallScripts(manifest) {
  const scripts = manifest.scripts || {};
  for (const key of INSTALL_SCRIPTS) assert(!Object.hasOwn(scripts, key), `${manifest.name}: lifecycle ${key} refused`);
  return { name: manifest.name, install_lifecycle_absent: true };
}

export function ownServiceManifest({ kit, artifacts }) {
  const dependencies = Object.fromEntries(PACKAGES.map((name) => {
    const artifact = artifacts.find((entry) => entry.manifest.name === name);
    assert(artifact, `missing packed package: ${name}`);
    return [name, `file:../${kit}/${artifact.filename}`];
  }));
  return { private: true, type: "module", dependencies, overrides: { [CORE]: dependencies[CORE] } };
}

export function singleCoreEvidence({ service, listing, candidates }) {
  const paths = [];
  function visit(entry) {
    if (entry.name === CORE) paths.push(realpathSync(entry.path));
    for (const [name, child] of Object.entries(entry.dependencies || {})) visit({ ...child, name });
  }
  visit(listing);
  assert.deepEqual([...new Set(paths)], [realpathSync(join(service, "node_modules", CORE))], "npm ls must resolve one core path");
  assert.equal(candidates.length, 1, "filesystem must contain exactly one core manifest");
  assert.equal(realpathSync(candidates[0]), join(paths[0], "package.json"));
  return { npm_ls_paths: [...new Set(paths)], filesystem_manifests: candidates };
}

function declarationEvidence({ service, files }) {
  return Object.entries(SYMBOLS).map(([name, symbols]) => {
    const sources = files.filter((path) => path.startsWith(join(service, "node_modules", name) + "/") && path.endsWith(".d.ts"));
    const text = sources.map((path) => readFileSync(path, "utf8")).join("\n");
    for (const symbol of symbols) assert(new RegExp(`\\b${symbol}\\b`).test(text), `declaration missing: ${name} ${symbol}`);
    return { name, symbols, declarations: sources.map((path) => ({ path: relative(service, path), sha256: sha256(readFileSync(path)) })) };
  });
}

export function installService({ kit, service, identity, log }) {
  const artifacts = identity.artifacts.map(({ filename }) => ({ filename, manifest: JSON.parse(command({ program: "tar", args: ["-xzOf", join(kit, filename), "package/package.json"] })) }));
  const checks = artifacts.filter(({ manifest }) => PACKAGES.includes(manifest.name)).map(({ manifest }) => assertNoInstallScripts(manifest));
  mkdirSync(service);
  writeFileSync(join(service, "package.json"), JSON.stringify(ownServiceManifest({ kit: "evaluation-kit", artifacts }), null, 2) + "\n");
  log("install", command({ program: "npm", args: ["install", "--no-audit", "--no-fund", "--ignore-scripts"], cwd: service }));
  const listing = JSON.parse(command({ program: "npm", args: ["ls", CORE, "--all", "--json", "--long"], cwd: service }));
  const files = filesBelow(service);
  const single = singleCoreEvidence({ service, listing, candidates: files.filter((path) => path.endsWith(`node_modules/${CORE}/package.json`)) });
  return { lifecycle: checks, single_core: single, declarations: declarationEvidence({ service, files }) };
}
