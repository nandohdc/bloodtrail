import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { inspectShippedImports } from "./shipped-import-policy.mjs";
import { assert, packageRoot, readJson, runChecked } from "./verification-helpers.mjs";

const pkg = await readJson(resolve(packageRoot, "package.json"));
const lock = await readJson(resolve(packageRoot, "package-lock.json"));
const dependencyRecord = await readFile(resolve(packageRoot, "DEPENDENCIES.md"), "utf8");

for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
  assert(Object.keys(pkg[field] ?? {}).length === 0, `${field} must remain empty`);
}
assert(lock.lockfileVersion === 3, "package-lock.json must use lockfileVersion 3");
const root = lock.packages?.[""];
assert(root && typeof root === "object", "lockfile root package entry is missing");
for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
  assert(Object.keys(root[field] ?? {}).length === 0, `lockfile root ${field} must remain empty`);
}

const declared = pkg.devDependencies ?? {};
assert(Object.keys(declared).length === 4, "unexpected direct development dependency count");
for (const [name, version] of Object.entries(declared)) {
  assert(/^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?$/.test(version), `${name} must use an exact version`);
  assert(root.devDependencies?.[name] === version, `${name} lockfile declaration differs from package.json`);
  const locked = lock.packages?.[`node_modules/${name}`];
  assert(locked?.version === version, `${name} resolved version differs from the exact direct version`);
  assert(locked?.dev === true, `${name} must remain development-only`);
  assert(dependencyRecord.includes(`\`${name}\``) && dependencyRecord.includes(`| ${version} |`), `${name} purpose/version record is missing`);
}

let installedPackages = 0;
for (const [path, entry] of Object.entries(lock.packages ?? {})) {
  if (!path || !path.startsWith("node_modules/") || entry.link === true) continue;
  assert(typeof entry.integrity === "string" && entry.integrity.startsWith("sha512-"), `${path} lacks sha512 lockfile integrity`);
  const manifestPath = resolve(packageRoot, path, "package.json");
  const manifest = await readJson(manifestPath);
  assert(typeof manifest.name === "string" && typeof manifest.version === "string", `${path} installed manifest is incomplete`);
  assert(
    (typeof manifest.license === "string" && manifest.license.length > 0)
      || (Array.isArray(manifest.licenses) && manifest.licenses.length > 0),
    `${path} has no declared license metadata`,
  );
  installedPackages += 1;
}
assert(installedPackages > 0, "no installed development dependency graph was inspected");

const shippedImports = await inspectShippedImports({
  packageRoot,
  files: packedFiles(),
  manifest: pkg,
});
assert(shippedImports.inspected > 0, "no shipped JavaScript or TypeScript artifact was inspected");
if (shippedImports.violations.length > 0) {
  const diagnostics = shippedImports.violations.slice(0, 50).map(formatViolation);
  const omitted = shippedImports.violations.length - diagnostics.length;
  if (omitted > 0) diagnostics.push(`${String(omitted)} additional violations omitted`);
  throw new Error(`shipped import policy violations:\n${diagnostics.join("\n")}`);
}

const productionTree = JSON.parse(runChecked("npm", ["ls", "--omit=dev", "--all", "--json"], {
  cwd: packageRoot,
  capture: true,
}));
assert(Object.keys(productionTree.dependencies ?? {}).length === 0, "installed production dependency tree is not empty");

process.stdout.write(`dependency policy passed: 0 runtime, ${shippedImports.inspected} shipped artifacts with ${shippedImports.specifiers} module specifiers, and ${installedPackages} locked installed development packages with integrity/license metadata\n`);

function packedFiles() {
  const output = runChecked("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: packageRoot,
    capture: true,
  });
  let report;
  try { report = JSON.parse(output); }
  catch { throw new Error("npm pack --dry-run did not return parseable JSON"); }
  const pack = Array.isArray(report) ? report[0] : report;
  assert(pack && Array.isArray(pack.files), "npm pack dry-run file inventory is missing");
  return pack.files;
}

function formatViolation({ artifact, specifier, code }) {
  return `${bounded(artifact, 90)}: ${bounded(specifier, 90)} [${bounded(code, 40)}]`;
}

function bounded(value, maximum) {
  const text = String(value).replaceAll(
    /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g,
    escapeControlCharacter,
  );
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 3)}...`;
}

function escapeControlCharacter(character) {
  return String.raw`\u${character.codePointAt(0).toString(16).padStart(4, "0")}`;
}
