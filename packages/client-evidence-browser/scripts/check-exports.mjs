import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import assert from "node:assert/strict";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const entryUrl = pathToFileURL(resolve(packageRoot, "dist/index.js")).href;

const mod = await import(entryUrl);
const exportedKeys = Object.keys(mod).sort();

const expectedExports = [
  "BoundsExceededError",
  "CapabilityMissingError",
  "ClientInteraction",
  "ForbiddenClaimError",
  "InvalidClaimValueError",
  "InvalidInteractionKindError",
  "InvalidNonceError",
  "buildClientEvidenceEnvelope",
  "startInteraction"
].sort();

assert.deepEqual(
  exportedKeys,
  expectedExports,
  `Package exports mismatch: expected [${expectedExports.join(", ")}], got [${exportedKeys.join(", ")}]`
);

process.stdout.write(`Exports check passed: ${exportedKeys.length} expected export(s) verified.\n`);
