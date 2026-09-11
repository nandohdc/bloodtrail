#!/usr/bin/env node
// Generates src/generated/envelope-rules.generated.ts from the ClientEvidenceEnvelope v1
// source and the security-audit contract source. The envelope stage's bounds and closed
// vocabularies derive from the envelope contract, and the audit-record member names it
// refuses to see addressed from a client derive from the audit contract; neither is ever
// configured locally.
//
// Usage: node scripts/generate-envelope-rules.mjs [--check]
//   --check  regenerate in memory and exit 1 when the on-disk file differs

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { byCodePoint } from "./verification-helpers.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const envelopeSourcePath = resolve(packageRoot, "../../contracts/client-evidence-envelope/source/envelope.source.json");
const contractSourcePath = resolve(packageRoot, "../../contracts/security-audit/source/contract.source.json");
const outputPath = resolve(packageRoot, "src/generated/envelope-rules.generated.ts");

const REGISTRY_CONSTANTS = Object.freeze([
  ["envelope_versions", "ENVELOPE_VERSIONS", "number"],
  ["interaction_kinds", "INTERACTION_KINDS", "string"],
  ["provenance_sources", "PROVENANCE_SOURCES", "string"],
  ["trust_levels", "TRUST_LEVELS", "string"],
  ["platforms", "PLATFORMS", "string"],
  ["capture_scopes", "CAPTURE_SCOPES", "string"],
  ["forbidden_claim_names", "FORBIDDEN_CLAIM_NAMES", "string"],
]);

function isPlainObject(value) {
  if (typeof value !== "object" || value === null) return false;
  return !Array.isArray(value);
}

function requireObject(value, description) {
  if (!isPlainObject(value)) throw new TypeError(`${description} is missing or not an object`);
  return value;
}

function isTypedList(values, type) {
  if (!Array.isArray(values) || values.length === 0) return false;
  return values.every((value) => typeof value === type);
}

function renderBounds(bounds) {
  return Object.keys(bounds).sort(byCodePoint).map((field) => {
    const value = bounds[field];
    if (!Number.isSafeInteger(value)) throw new TypeError(`envelope bound ${field} is not a safe integer`);
    return `export const ${field.toUpperCase()} = ${String(value)} as const;`;
  });
}

function renderRegistry(registries, [key, name, type]) {
  const values = registries[key];
  if (!isTypedList(values, type)) throw new TypeError(`envelope registry ${key} must be a non-empty ${type} array`);
  return [`export const ${name}: readonly ${type}[] = [`, ...values.map((value) => `  ${JSON.stringify(value)},`), "];"];
}

// Every top-level member of a security-audit record, in code-point order. An envelope that
// addresses one of them is trying to write server-owned material, not describing an interaction.
function auditRecordMembers(contract) {
  const fields = contract?.fields;
  if (!Array.isArray(fields) || fields.length === 0) throw new TypeError("contract source has no fields");
  const members = new Set(fields.map((field) => String(field.p).split(".")[0]));
  members.add("extensions");
  return [...members].sort(byCodePoint);
}

function render(envelope, contract) {
  const bounds = requireObject(envelope?.bounds, "envelope source bounds block");
  const registries = requireObject(envelope?.registries, "envelope source registries block");
  const lines = [
    "// GENERATED FILE. DO NOT EDIT.",
    "// Sources: contracts/client-evidence-envelope/source/envelope.source.json (bounds and registries)",
    "// and contracts/security-audit/source/contract.source.json (top-level audit record members).",
    ...renderBounds(bounds),
    "",
  ];
  for (const registry of REGISTRY_CONSTANTS) lines.push(...renderRegistry(registries, registry));
  lines.push("", "export const AUDIT_RECORD_MEMBERS: readonly string[] = [");
  lines.push(...auditRecordMembers(contract).map((member) => `  ${JSON.stringify(member)},`), "];");
  return `${lines.join("\n")}\n`;
}

const envelope = JSON.parse(await readFile(envelopeSourcePath, "utf8"));
const contract = JSON.parse(await readFile(contractSourcePath, "utf8"));
const rendered = render(envelope, contract);

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = await readFile(outputPath, "utf8");
  } catch {
    current = "";
  }
  if (current !== rendered) {
    process.stderr.write("envelope rules drift: src/generated/envelope-rules.generated.ts differs from its sources; run npm run generate\n");
    process.exitCode = 1;
  } else {
    process.stdout.write("envelope rules generation check passed: byte-identical to the envelope and contract sources\n");
  }
} else {
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, rendered);
  process.stdout.write(`generated ${outputPath}\n`);
}
