import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
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

const productionTree = JSON.parse(runChecked("npm", ["ls", "--omit=dev", "--all", "--json"], {
  cwd: packageRoot,
  capture: true,
}));
assert(Object.keys(productionTree.dependencies ?? {}).length === 0, "installed production dependency tree is not empty");

process.stdout.write(`dependency policy passed: 0 runtime and ${installedPackages} locked installed development packages with integrity/license metadata\n`);
