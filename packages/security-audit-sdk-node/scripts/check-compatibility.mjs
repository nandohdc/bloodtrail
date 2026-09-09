import { resolve } from "node:path";
import { assert, packageRoot, readJson, repositoryRoot } from "./verification-helpers.mjs";

const pkg = await readJson(resolve(packageRoot, "package.json"));
const lock = await readJson(resolve(packageRoot, "package-lock.json"));
const compatibility = await readJson(resolve(packageRoot, "compatibility.json"));
const coreRoot = resolve(repositoryRoot, "packages/security-audit-sdk-core");
const corePackage = await readJson(resolve(coreRoot, "package.json"));
const coreCompatibility = await readJson(resolve(coreRoot, "compatibility.json"));
const installedCore = await readJson(resolve(packageRoot, "node_modules/@bloodtrail/security-audit-sdk-core/package.json"));

assert(pkg.version === compatibility.package.version, "package.json and compatibility package versions differ");
assert(lock.packages?.[""]?.version === pkg.version, "lockfile root package version differs from package.json");
assert(lock.packages?.[""]?.name === pkg.name, "lockfile root package name differs from package.json");
assert(pkg.dependencies?.["@bloodtrail/security-audit-sdk-core"] === "file:../security-audit-sdk-core", "Node binding must retain its local first-party Core dependency");

const lockedCore = lock.packages?.["../security-audit-sdk-core"];
assert(lockedCore?.name === corePackage.name, "lockfile first-party Core name differs from the workspace package");
assert(lockedCore?.version === compatibility.coreContract.packageVersion, "lockfile first-party Core version differs from compatibility metadata");
assert(corePackage.version === compatibility.coreContract.packageVersion, "workspace Core package version differs from Node compatibility metadata");
assert(installedCore.version === compatibility.coreContract.packageVersion, "installed first-party Core version differs from Node compatibility metadata");
assert(coreCompatibility.contractVersion === compatibility.coreContract.contractVersion, "Core contract version differs from Node compatibility metadata");
assert(coreCompatibility.package.version === compatibility.coreContract.packageVersion, "Core compatibility package version differs from Node compatibility metadata");
assert(lock.packages?.["node_modules/@bloodtrail/security-audit-sdk-core"]?.link === true, "installed first-party Core must remain a workspace link");

process.stdout.write(`Node compatibility passed: ${pkg.name}@${pkg.version} binds ${corePackage.name}@${corePackage.version} to contract ${coreCompatibility.contractVersion}\n`);
