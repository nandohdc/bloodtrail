import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const PACKAGE_NAME = "@bloodtrail/security-audit-sdk-core";
const MAX_DETAIL_LENGTH = 240;
const MAX_COMMAND_OUTPUT = 2_048;

export async function verifyPackedCompleteness({ packageRoot, onPacked, onInstalled }) {
  const packRoot = await mkdtemp(resolve(tmpdir(), "bloodtrail-pack-"));
  let consumerRoot;
  let tarball;

  try {
    consumerRoot = await mkdtemp(resolve(tmpdir(), "bloodtrail-consumer-"));
    process.stdout.write(`[packed-completeness:temporary-paths] pack=${packRoot} consumer=${consumerRoot}\n`);
    const manifest = await readManifest(packageRoot);
    const pack = packPackage(packageRoot, packRoot);
    tarball = resolve(packRoot, pack.filename);
    await runPackedHook({ onPacked, files: pack.files, entryPoint: manifest.name });
    await writeConsumerManifest(consumerRoot);
    installTarball(consumerRoot, tarball);

    const entryPoints = declaredEntryPoints(manifest);
    const installedPackageRoot = resolve(await realpath(consumerRoot), "node_modules", ...manifest.name.split("/"));
    const namespaces = await loadEntryPointNamespaces({ consumerRoot, entryPoints, installedPackageRoot });

    const rootNamespace = namespaces.get(manifest.name);
    await validateCanonicalEvent({ packageRoot, entryPoint: manifest.name, namespace: rootNamespace });
    await runInstalledHook({ onInstalled, consumerRoot, namespaces });

    return { files: pack.files, entryPoints, consumerRoot, tarball };
  } finally {
    await removeTemporaryRoots(packRoot, consumerRoot);
  }
}

async function runPackedHook({ onPacked, files, entryPoint }) {
  if (!onPacked) return;
  try {
    await onPacked(files);
  } catch (error) {
    throw diagnostic("inventory-allowlist", entryPoint, errorMessage(error));
  }
}

async function runInstalledHook({ onInstalled, consumerRoot, namespaces }) {
  if (!onInstalled) return;
  const namespace = Object.assign({}, ...namespaces.values());
  await onInstalled({ consumerRoot, namespace });
}

async function removeTemporaryRoots(packRoot, consumerRoot) {
  const removals = [rm(packRoot, { recursive: true, force: true })];
  if (consumerRoot) removals.push(rm(consumerRoot, { recursive: true, force: true }));
  await Promise.all(removals);
}

async function readManifest(packageRoot) {
  return JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
}

async function writeConsumerManifest(consumerRoot) {
  const manifest = { name: "packed-completeness-consumer", private: true, type: "module" };
  await writeFile(resolve(consumerRoot, "package.json"), `${JSON.stringify(manifest)}\n`, "utf8");
}

async function loadEntryPointNamespaces({ consumerRoot, entryPoints, installedPackageRoot }) {
  const namespaces = new Map();
  for (const entryPoint of entryPoints) {
    const loaded = await importEntryPoint({ consumerRoot, entryPoint });
    await assertConsumerResolution({ entryPoint, resolvedUrl: loaded.resolvedUrl, installedPackageRoot });
    namespaces.set(entryPoint, loaded.namespace);
  }
  return namespaces;
}

function packPackage(packageRoot, packRoot) {
  const output = runCommand("npm", [
    "pack",
    "--json",
    "--pack-destination",
    packRoot,
    "--ignore-scripts",
    "--loglevel",
    "error",
  ], packageRoot, "pack-failure");
  let report;
  try {
    report = JSON.parse(output);
  } catch {
    throw diagnostic("pack-report", PACKAGE_NAME, "npm pack did not return parseable JSON");
  }
  const packs = (Array.isArray(report) ? report : [report]).filter((entry) => entry?.filename?.endsWith(".tgz"));
  if (packs.length !== 1) {
    throw diagnostic("pack-report", PACKAGE_NAME, "npm pack returned an invalid artifact inventory");
  }
  if (!Array.isArray(packs[0].files)) {
    throw diagnostic("pack-report", PACKAGE_NAME, "npm pack returned an invalid artifact inventory");
  }
  return packs[0];
}

function installTarball(consumerRoot, tarball) {
  runCommand("npm", [
    "install",
    tarball,
    "--omit=dev",
    "--no-audit",
    "--no-fund",
    "--ignore-scripts",
    "--offline",
    "--loglevel",
    "error",
  ], consumerRoot, "install-failure");
}

function declaredEntryPoints(manifest) {
  assertManifestExportMap(manifest);
  const entryPoints = Object.keys(manifest.exports).map((subpath) => entryPointForSubpath(manifest.name, subpath));
  if (entryPoints.length === 0) {
    throw diagnostic("export-map", manifest.name, "package export map declares no entry points");
  }
  return entryPoints;
}

function assertManifestExportMap(manifest) {
  if (typeof manifest.name !== "string") {
    throw diagnostic("export-map", PACKAGE_NAME, "package name or export map is missing");
  }
  if (manifest.name.length === 0) {
    throw diagnostic("export-map", PACKAGE_NAME, "package name or export map is missing");
  }
  if (manifest.exports === null) {
    throw diagnostic("export-map", PACKAGE_NAME, "package name or export map is missing");
  }
  if (typeof manifest.exports !== "object") {
    throw diagnostic("export-map", PACKAGE_NAME, "package name or export map is missing");
  }
}

function entryPointForSubpath(packageName, subpath) {
  if (subpath === ".") return packageName;
  if (!subpath.startsWith("./")) {
    throw diagnostic("export-map", packageName, `unsupported declared subpath ${subpath}`);
  }
  if (subpath.includes("*")) {
    throw diagnostic("export-map", packageName, `unsupported declared subpath ${subpath}`);
  }
  return `${packageName}/${subpath.slice(2)}`;
}

async function importEntryPoint({ consumerRoot, entryPoint }) {
  const probePath = resolve(consumerRoot, `probe-${encodeURIComponent(entryPoint)}.mjs`);
  await writeFile(probePath, [
    `export const resolvedUrl = import.meta.resolve(${JSON.stringify(entryPoint)});`,
    `export const namespace = await import(${JSON.stringify(entryPoint)});`,
    "",
  ].join("\n"), "utf8");
  try {
    return await import(pathToFileURL(probePath).href);
  } catch (error) {
    throw diagnostic("entry-point-import", entryPoint, errorMessage(error));
  }
}

async function assertConsumerResolution({ entryPoint, resolvedUrl, installedPackageRoot }) {
  const resolvedPath = await realpath(fileURLToPath(resolvedUrl)).catch((error) => {
    throw diagnostic("resolution-provenance", entryPoint, `resolution could not be established: ${errorMessage(error)}`);
  });
  const relation = relative(installedPackageRoot, resolvedPath);
  if (relation === "") return;
  if (resolvesOutsideConsumer(relation)) {
    throw diagnostic("resolution-provenance", entryPoint, "resolved outside disposable consumer");
  }
}

function resolvesOutsideConsumer(relation) {
  if (relation.startsWith("..")) return true;
  return isAbsolute(relation);
}

async function validateCanonicalEvent({ packageRoot, entryPoint, namespace }) {
  if (typeof namespace?.validateSecurityAuditEvent !== "function") {
    throw diagnostic("canonical-validation", entryPoint, "validateSecurityAuditEvent export is missing");
  }
  const fixturePath = resolve(packageRoot, "../../contracts/security-audit/examples/positive/all-events.json");
  let fixtures;
  try {
    fixtures = JSON.parse(await readFile(fixturePath, "utf8"));
  } catch (error) {
    throw diagnostic("canonical-validation", entryPoint, `canonical fixture could not be read: ${errorMessage(error)}`);
  }
  const result = namespace.validateSecurityAuditEvent(fixtures[0]);
  if (result?.ok !== true) {
    throw diagnostic("canonical-validation", entryPoint, "canonical event did not validate");
  }
}

function runCommand(command, args, cwd, code) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status === 0) return result.stdout;
  const detail = `${result.stderr}\n${result.stdout}`.trim().slice(0, MAX_COMMAND_OUTPUT);
  throw diagnostic(code, PACKAGE_NAME, detail || `${command} exited ${String(result.status)}`);
}

function diagnostic(code, entryPoint, detail) {
  return new Error(`[packed-completeness:${code}] entry point ${bounded(entryPoint)}: ${bounded(detail)}`);
}

function errorMessage(error) {
  if (error instanceof Error) return `${error.name}: ${error.message}`;
  return String(error);
}

function bounded(value) {
  const escaped = String(value)
    .replaceAll(/[^\x20-\x7e]/g, (character) => String.raw`\u${character.codePointAt(0).toString(16).padStart(4, "0")}`)
    .slice(0, MAX_DETAIL_LENGTH);
  return escaped.length === 0 ? "<empty>" : escaped;
}
