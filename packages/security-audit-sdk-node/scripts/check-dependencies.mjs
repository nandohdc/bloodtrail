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

// TypeScript emits each static import/export declaration onto one line in the
// shipped JavaScript and declaration files. Read that emitted syntax directly
// instead of scanning an entire artifact with a broad expression.
function quotedSpecifierAt(text, start) {
  const quote = text[start];
  if (quote !== "\"" && quote !== "'") return null;

  const end = text.indexOf(quote, start + 1);
  return end > start + 1 ? text.slice(start + 1, end) : null;
}

function staticImportSpecifier(line) {
  const declaration = line.trimStart();
  const isImport = declaration.startsWith("import ");
  const isExport = declaration.startsWith("export ");
  if (!isImport && !isExport) return null;

  const bareSpecifier = isImport
    ? quotedSpecifierAt(declaration, "import ".length)
    : null;
  if (bareSpecifier !== null) return bareSpecifier;

  const fromIndex = declaration.lastIndexOf(" from ");
  return fromIndex === -1
    ? null
    : quotedSpecifierAt(declaration, fromIndex + " from ".length);
}

function staticImportSpecifiers(content) {
  return content
    .split("\n")
    .map((line) => staticImportSpecifier(line.endsWith("\r") ? line.slice(0, -1) : line))
    .filter((specifier) => specifier !== null);
}

for (const file of codeFiles) {
  const content = await readFile(resolve(distDir, file), "utf8");
  for (const specifier of staticImportSpecifiers(content)) {
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
