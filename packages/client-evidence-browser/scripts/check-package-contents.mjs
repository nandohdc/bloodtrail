import assert from "node:assert/strict";
import { packageRoot, runChecked } from "./verification-helpers.mjs";

const output = runChecked("npm", ["pack", "--dry-run", "--json"], {
  cwd: packageRoot,
  capture: true
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
