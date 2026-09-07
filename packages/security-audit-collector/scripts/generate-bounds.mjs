#!/usr/bin/env node
// Generates src/generated/bounds.generated.ts from the frozen contract source.
// The collector's size limits and supported contract-version set derive from the
// contract, never from package-local configuration (F3 of the #107 plan).
//
// Usage: node scripts/generate-bounds.mjs [--check]
//   --check  regenerate in memory and exit 1 when the on-disk file differs

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const contractSourcePath = resolve(
  packageRoot,
  "../../contracts/security-audit/source/contract.source.json",
);
const outputPath = resolve(packageRoot, "src/generated/bounds.generated.ts");

const BOUND_FIELDS = Object.freeze([
  "event_max_bytes",
  "object_max_depth",
  "default_string_max",
  "display_string_max",
  "message_string_max",
  "array_max_items",
  "extension_max_namespaces",
  "clock_skew_max_seconds",
  "retry_attempt_max",
]);

function constantName(field) {
  return field.toUpperCase();
}

function render(bounds, supportedVersions) {
  const lines = [
    "// GENERATED FILE. DO NOT EDIT.",
    "// Sources: contracts/security-audit/source/contract.source.json (bounds and schema version).",
  ];
  for (const field of BOUND_FIELDS) {
    const value = bounds[field];
    if (typeof value !== "number" || !Number.isFinite(value)) {
      throw new Error(`contract bounds block is missing a numeric ${field}`);
    }
    lines.push(`export const ${constantName(field)} = ${String(value)} as const;`);
  }
  lines.push("");
  lines.push("// The explicitly enumerated finite supported set for the collector-side version stage,");
  lines.push("// per the ratified asymmetric version policy (#75/#76): the producer binds EXACT_ONE while");
  lines.push("// a separately authorized collector MAY support an explicit finite set for migration.");
  lines.push("export const SUPPORTED_CONTRACT_VERSIONS: readonly string[] = [");
  for (const version of supportedVersions) {
    lines.push(`  ${JSON.stringify(version)},`);
  }
  lines.push("];");
  return `${lines.join("\n")}\n`;
}

function requireBounds(value) {
  if (typeof value !== "object" || value === null) {
    throw new Error("contract source has no bounds block");
  }
  return value;
}

function requireSchemaVersion(value) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error("contract source has no metadata.schema_version string");
  }
  return value;
}

function loadContractData(contract) {
  const bounds = requireBounds(contract?.bounds);
  const schemaVersion = requireSchemaVersion(contract?.metadata?.schema_version);
  return { bounds, schemaVersion };
}

async function checkDrift(rendered) {
  const existing = await readFile(outputPath, "utf8");
  if (existing !== rendered) {
    process.stderr.write(
      "bounds drift: src/generated/bounds.generated.ts differs from the contract source; run npm run generate\n",
    );
    process.exitCode = 1;
    return;
  }
  process.stdout.write("bounds generation check passed: byte-identical to contract source\n");
}

async function main() {
  const check = process.argv.includes("--check");
  const contract = JSON.parse(await readFile(contractSourcePath, "utf8"));
  const { bounds, schemaVersion } = loadContractData(contract);
  const rendered = render(bounds, [schemaVersion]);

  if (check) {
    await checkDrift(rendered);
    return;
  }

  await mkdir(resolve(packageRoot, "src/generated"), { recursive: true });
  await writeFile(outputPath, rendered, "utf8");
  process.stdout.write(
    `generated ${outputPath} (${BOUND_FIELDS.length} bounds, supported versions: ${schemaVersion})\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`generate-bounds failed: ${error.message}\n`);
  process.exitCode = 1;
});
