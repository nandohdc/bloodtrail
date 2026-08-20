import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { verifyPackedCompleteness } from "./packed-completeness.mjs";
import { assert, packageRoot, readJson } from "./verification-helpers.mjs";

const pkg = await readJson(resolve(packageRoot, "package.json"));
assert(pkg.private === true, "package must remain private until explicit release authorization");
assert(pkg.license === "UNLICENSED", "package license metadata must remain explicit while release licensing is unresolved");
assert(pkg.sideEffects === false, "sideEffects must remain false for this side-effect-free package");
assert(pkg.types === "./dist/index.d.ts", "root declaration entry drift");
assert(Object.keys(pkg.dependencies ?? {}).length === 0, "runtime dependencies must remain empty");

let completeness;
let inventory;
try {
  completeness = await verifyPackedCompleteness({
    packageRoot,
    onPacked: async (files) => { inventory = await verifyInventory(files); },
  });
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
if (!completeness) process.exit();
assert(inventory, "packed inventory allowlist did not run");
process.stdout.write(`packed artifact completeness passed: ${inventory.paths.length} intentional files, ${inventory.totalBytes} bytes, ${completeness.entryPoints.length} entry points imported, no tests/source/scripts/governance/contract copies\n`);

async function verifyInventory(files) {
  const paths = files.map((entry) => entry.path).sort();
  const pathSet = new Set(paths);

  for (const required of [
    "package.json",
    "README.md",
    "API.md",
    "SECURITY.md",
    "MIGRATION.md",
    "DEPENDENCIES.md",
    "compatibility.json",
    "contract-provenance.json",
    "dist/index.js",
    "dist/index.d.ts",
    "dist/testing.js",
    "dist/testing.d.ts",
    "dist/generated/schema-validator.generated.cjs",
    "examples/run.ts",
    "examples/scenarios.ts",
    "examples/support.ts",
  ]) {
    assert(pathSet.has(required), `intended package file is missing from dry-run: ${required}`);
  }

  const forbiddenPath = /(?:^|\/)(?:tests?|scripts?|src|adr|node_modules|dist-tests|dist-examples|\.verification-output|coverage|\.cache|openspec|contracts)(?:\/|$)|(?:^|\/)\.env(?:\.|$)|\.tgz$/i;
  const allowedTopLevel = new Set([
    "package.json",
    "README.md",
    "API.md",
    "SECURITY.md",
    "MIGRATION.md",
    "DEPENDENCIES.md",
    "compatibility.json",
    "contract-provenance.json",
  ]);
  for (const path of paths) {
    assert(!forbiddenPath.test(path), `unintended package path: ${path}`);
    const allowed = path.startsWith("dist/") || path.startsWith("examples/") || allowedTopLevel.has(path);
    assert(allowed, `package path is not in the intentional allowlist: ${path}`);
    const absolute = resolve(packageRoot, path);
    const data = await readFile(absolute);
    if (data.includes(0)) continue;
    const text = data.toString("utf8");
    assert(!text.includes("/Users/") && !text.includes("\\Users\\"), `machine-specific absolute path packaged in ${path}`);
    assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), `private key material packaged in ${path}`);
  }

  return {
    paths,
    totalBytes: files.reduce((sum, entry) => sum + Number(entry.size ?? 0), 0),
  };
}
