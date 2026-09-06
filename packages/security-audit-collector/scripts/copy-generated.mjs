#!/usr/bin/env node
// Copies the vendored generated validator into dist/ so the shipped artifact is
// self-contained: dist/schema.js imports ./generated/schema-validator.generated.cjs
// relative to itself, and npm pack must include the validator (F2 byte-identity
// carries the canonical artifact, not a reimplementation).

import { copyFile, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const sourceDir = resolve(packageRoot, "src/generated");
const targetDir = resolve(packageRoot, "dist/generated");

await mkdir(targetDir, { recursive: true });
for (const name of ["schema-validator.generated.cjs", "schema-validator.generated.d.cts"]) {
  await copyFile(resolve(sourceDir, name), resolve(targetDir, name));
}
process.stdout.write("copied vendored generated validator into dist/generated/\n");
