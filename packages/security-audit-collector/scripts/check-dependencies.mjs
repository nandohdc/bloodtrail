import { readdir, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { assert, packageRoot, readJson, runChecked } from "./verification-helpers.mjs";

const pkg = await readJson(resolve(packageRoot, "package.json"));
const lock = await readJson(resolve(packageRoot, "package-lock.json"));

assert(pkg.private === true, "package must remain private");
assert(pkg.license === "UNLICENSED", "package license must remain UNLICENSED");

// The collector ships ZERO runtime dependencies: no first-party and no
// third-party runtime imports. Authored runtime code imports only relative
// modules (the vendored generated validator).
assert(
  Object.keys(pkg.dependencies ?? {}).length === 0,
  "runtime dependencies must remain empty; the collector has zero runtime dependencies",
);

for (const field of ["optionalDependencies", "peerDependencies"]) {
  assert(Object.keys(pkg[field] ?? {}).length === 0, `${field} must remain empty`);
}

assert(lock.lockfileVersion === 3, "package-lock.json must use lockfileVersion 3");
const root = lock.packages?.[""];
assert(root && typeof root === "object", "lockfile root package entry is missing");
assert(
  Object.keys(root.dependencies ?? {}).length === 0,
  "lockfile root dependencies must remain empty",
);

// Inspect all shipped artifacts in dist/. The vendored generated validator is
// canonical contract output, byte-drift-gated by check-validator-drift.mjs, so
// its internal specifiers are not re-classified here; the authored dist files
// must import nothing but relative paths.
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
  if (file.startsWith("generated/")) continue;
  const content = await readFile(resolve(distDir, file), "utf8");
  for (const specifier of staticImportSpecifiers(content)) {
    inspectedSpecifiers += 1;
    assert(
      specifier.startsWith("."),
      `unapproved import specifier "${specifier}" found in ${file}; authored runtime code must import only relative modules`,
    );
  }
}

// Verify the production dependency tree has zero dependencies at all.
const productionTree = JSON.parse(
  runChecked("npm", ["ls", "--omit=dev", "--all", "--json"], {
    cwd: packageRoot,
    capture: true,
  }),
);

assert(
  Object.keys(productionTree.dependencies ?? {}).length === 0,
  "production dependency tree must remain empty",
);

process.stdout.write(
  `dependency policy passed: 0 runtime dependencies, ${codeFiles.length} shipped artifacts with ${inspectedSpecifiers} inspected authored specifiers, zero third-party runtime dependencies\n`,
);
