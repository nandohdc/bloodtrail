import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pkg = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));

assert.equal(pkg.private, true, "package must remain private");
assert.equal(pkg.license, "UNLICENSED", "package license must remain UNLICENSED");
assert.deepEqual(pkg.dependencies ?? {}, {}, "dependencies must remain empty");
assert.deepEqual(pkg.peerDependencies ?? {}, {}, "peerDependencies must remain empty");
assert.deepEqual(pkg.optionalDependencies ?? {}, {}, "optionalDependencies must remain empty");

const distDir = resolve(packageRoot, "dist");
let distFiles = [];
try {
  const entries = await readdir(distDir, { recursive: true });
  distFiles = entries.filter((f) => f.endsWith(".js"));
} catch {
  // dist may not exist before build
}

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

for (const file of distFiles) {
  const content = await readFile(resolve(distDir, file), "utf8");
  const lines = content.split("\n");
  for (const line of lines) {
    const specifier = staticImportSpecifier(line);
    if (specifier !== null) {
      assert.ok(
        specifier.startsWith("."),
        `unapproved import specifier "${specifier}" in ${file}; browser package must import only relative modules`,
      );
    }
  }
}

process.stdout.write("Dependency check passed: zero runtime dependencies, all emitted specifiers relative.\n");
