import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const output = execFileSync("npm", ["pack", "--dry-run", "--json"], {
  cwd: packageRoot,
  encoding: "utf8"
});

const [result] = JSON.parse(output);
assert.ok(result, "npm pack produced no output");

const packedPaths = result.files.map((f) => f.path);
for (const p of packedPaths) {
  assert.ok(
    p.startsWith("dist/") || p === "package.json" || p === "README.md",
    `Unexpected file in package tarball: ${p}`
  );
}

process.stdout.write(`Package contents check passed: ${packedPaths.length} file(s) in tarball within approved manifest.\n`);
