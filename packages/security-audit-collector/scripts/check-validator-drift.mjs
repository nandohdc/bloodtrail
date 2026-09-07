#!/usr/bin/env node
// Byte-identity drift gate for the vendored generated validator (F2 of the #107 plan).
// The collector validates with the EXACT standalone validator the SDK core produces,
// carried as a byte-identical vendored copy. Any byte difference from the canonical
// artifact fails this gate closed, so producer and collector cannot disagree.

import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const vendored = resolve(
  packageRoot,
  "src/generated/schema-validator.generated.cjs",
);
const canonical = resolve(
  packageRoot,
  "../security-audit-sdk-core/src/generated/schema-validator.generated.cjs",
);

const vendoredBytes = await readFile(vendored);
const canonicalBytes = await readFile(canonical);

if (!vendoredBytes.equals(canonicalBytes)) {
  process.stderr.write(
    `validator drift: the vendored copy (${vendoredBytes.length} B) differs from the canonical generated artifact (${canonicalBytes.length} B); re-vendor it with a governed change\n`,
  );
  process.exitCode = 1;
} else {
  process.stdout.write(
    `validator drift check passed: vendored copy is byte-identical to the canonical generated artifact (${canonicalBytes.length} B)\n`,
  );
}
