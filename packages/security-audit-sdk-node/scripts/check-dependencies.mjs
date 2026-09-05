import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assert, packageRoot, readJson, runChecked } from "./verification-helpers.mjs";

const pkg = await readJson(resolve(packageRoot, "package.json"));
const lock = await readJson(resolve(packageRoot, "package-lock.json"));

assert(pkg.private === true, "package must remain private");
assert(pkg.license === "UNLICENSED", "package license must remain UNLICENSED");

const ALLOWED_BUILTINS = new Set([
  "node:async_hooks",
  "node:buffer",
  "node:crypto",
  "node:timers",
]);

for (const dep of Object.keys(pkg.dependencies ?? {})) {
  assert(
    dep.startsWith("@bloodtrail/"),
    `runtime dependency ${dep} is not in first-party allowlist (@bloodtrail/*)`,
  );
}

for (const field of ["optionalDependencies", "peerDependencies"]) {
  assert(Object.keys(pkg[field] ?? {}).length === 0, `${field} must remain empty`);
}

assert(lock.lockfileVersion === 3, "package-lock.json must use lockfileVersion 3");
const root = lock.packages?.[""];
assert(root && typeof root === "object", "lockfile root package entry is missing");

for (const dep of Object.keys(root.dependencies ?? {})) {
  assert(
    dep.startsWith("@bloodtrail/"),
    `lockfile runtime dependency ${dep} is not in first-party allowlist (@bloodtrail/*)`,
  );
}

// Inspect all shipped artifacts in dist/
const distDir = resolve(packageRoot, "dist");
const files = await readdir(distDir, { recursive: true });
const codeFiles = files.filter((f) => f.endsWith(".js") || f.endsWith(".d.ts"));

assert(codeFiles.length > 0, "no shipped artifacts found in dist/");

let inspectedSpecifiers = 0;
const IMPORT_REGEX = /(?:import|export)\s+(?:(?:[\s\S]*?from\s+)?["']([^"']+)["']|type\s+[^=]+from\s+["']([^"']+)["'])/g;

for (const file of codeFiles) {
  const content = await readFile(resolve(distDir, file), "utf8");
  let match;
  while ((match = IMPORT_REGEX.exec(content)) !== null) {
    const specifier = match[1] ?? match[2];
    if (!specifier) continue;
    inspectedSpecifiers += 1;

    const isRelative = specifier.startsWith(".");
    const isAllowedBuiltin = ALLOWED_BUILTINS.has(specifier);
    const isAllowedDep = specifier === "@bloodtrail/security-audit-sdk-core" || specifier.startsWith("@bloodtrail/security-audit-sdk-core/");

    assert(
      isRelative || isAllowedBuiltin || isAllowedDep,
      `unapproved import specifier "${specifier}" found in ${file}`,
    );
  }
}

// Verify production dependency tree has zero third-party dependencies
const productionTree = JSON.parse(
  runChecked("npm", ["ls", "--omit=dev", "--all", "--json"], {
    cwd: packageRoot,
    capture: true,
  }),
);

for (const dep of Object.keys(productionTree.dependencies ?? {})) {
  assert(
    dep.startsWith("@bloodtrail/"),
    `production tree dependency ${dep} is not in first-party allowlist (@bloodtrail/*)`,
  );
}

process.stdout.write(
  `dependency policy passed: ${Object.keys(pkg.dependencies ?? {}).length} runtime first-party dependencies, ${codeFiles.length} shipped artifacts with ${inspectedSpecifiers} inspected specifiers, zero third-party runtime dependencies\n`,
);
