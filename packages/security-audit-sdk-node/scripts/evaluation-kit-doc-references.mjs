import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import * as coreSdk from "@bloodtrail/security-audit-sdk-core";
import * as coreTesting from "@bloodtrail/security-audit-sdk-core/testing";
import * as nodeSdk from "@bloodtrail/security-audit-sdk-node";
import { extractDeclaredDocBlockIdentifiers } from "./evaluation-kit-doc-blocks.mjs";
import { assert } from "./verification-helpers.mjs";

const FENCED_BLOCK_PATTERN = /```[\s\S]*?```|````[\s\S]*?````/g;
const INLINE_CODE_PATTERN = /`([^`\r\n]+)`/g;
const DOTTED_CALL_PATTERN = /^([a-zA-Z0-9_$]+)\.([a-zA-Z0-9_$]+)(?:\(.*\))?$/;
const CALL_PATTERN = /^([a-zA-Z0-9_$]+)\s*\(.*\)$/;
const FACTORY_VALIDATOR_PATTERN = /^(?:create|validate)[A-Z][a-zA-Z0-9_$]*$/;

const SINK_METHODS = Object.freeze(new Set(["emit", "flush", "shutdown"]));
const OP_METHODS = Object.freeze(
  new Set([
    "snapshot",
    "markCommitted",
    "markNotCommitted",
    "markPartiallyCommitted",
    "markCompensated",
    "markCancelled",
  ]),
);
const CLOCK_METHODS = Object.freeze(new Set(["now"]));
const HANDOFF_METHODS = Object.freeze(new Set(["submit"]));
const SHUTDOWN_METHODS = Object.freeze(new Set(["submit", "shutdown"]));
const STANDARD_METHODS = Object.freeze(
  new Set(["now", "toISOString", "toJSON", "sort", "unref", "submit", "randomUUID", "byteLength", "exit"]),
);
const IGNORED_PREFIXES = Object.freeze(["{", "[", '"', "'", "<", "npm ", "node ", "git ", "shasum "]);

export function stripFencedCodeBlocks(markdownText) {
  return markdownText.replace(FENCED_BLOCK_PATTERN, "");
}

export function extractInlineCodeSpans(markdownText) {
  const prose = stripFencedCodeBlocks(markdownText);
  const spans = [];
  let match;
  INLINE_CODE_PATTERN.lastIndex = 0;
  while ((match = INLINE_CODE_PATTERN.exec(prose)) !== null) {
    const code = match[1]?.trim();
    if (code) {
      spans.push(code);
    }
  }
  return spans;
}

function isIgnoredSpan(span) {
  return IGNORED_PREFIXES.some((prefix) => span.startsWith(prefix));
}

function parseStandardBuiltin(span) {
  if (span.startsWith("new Date")) return { kind: "standard", name: "Date", raw: span };
  if (span.startsWith("node:crypto.randomUUID")) return { kind: "standard", name: "randomUUID", raw: span };
  if (span.startsWith("Buffer.byteLength")) return { kind: "standard", name: "byteLength", raw: span };
  return null;
}

function parseDottedReference(span, allowedReceivers) {
  const match = DOTTED_CALL_PATTERN.exec(span);
  if (!match) return null;
  const receiver = match[1];
  const member = match[2];
  if (allowedReceivers.has(receiver)) {
    return { kind: "receiver", receiver, member, raw: span };
  }
  return null;
}

function parseCallReference(span) {
  const match = CALL_PATTERN.exec(span);
  if (!match) return null;
  return { kind: "call", name: match[1], raw: span };
}

function parseFactoryOrValidator(span) {
  if (FACTORY_VALIDATOR_PATTERN.test(span)) {
    return { kind: "function", name: span, raw: span };
  }
  return null;
}

export function parseCallShapedReference(span, allowedReceivers) {
  if (isIgnoredSpan(span)) return null;
  const standard = parseStandardBuiltin(span);
  if (standard) return standard;
  const dotted = parseDottedReference(span, allowedReceivers);
  if (dotted) return dotted;
  const call = parseCallReference(span);
  if (call) return call;
  return parseFactoryOrValidator(span);
}

export function buildReceiverMethodMaps() {
  const eventMethods = coreSdk.EVENT_METHODS.map((m) => m.method);
  const sdkMethods = new Set([
    ...eventMethods,
    "emit",
    "redeliver",
    "beginOperation",
    "runWithContext",
    "flush",
    "shutdown",
  ]);
  return {
    sdk: sdkMethods,
    audit: sdkMethods,
    op: OP_METHODS,
    sink: SINK_METHODS,
    clock: CLOCK_METHODS,
    AuditEventSink: SINK_METHODS,
    DeliveryShutdown: SHUTDOWN_METHODS,
    HttpDeliveryHandoff: HANDOFF_METHODS,
  };
}

export function buildExportedFunctionSet() {
  return new Set([
    ...Object.keys(nodeSdk).filter((k) => typeof nodeSdk[k] === "function"),
    ...Object.keys(coreSdk).filter((k) => typeof coreSdk[k] === "function"),
    ...Object.keys(coreTesting).filter((k) => typeof coreTesting[k] === "function"),
  ]);
}

export function buildAllKnownMethodsSet(receiverMaps) {
  const allMethods = new Set(STANDARD_METHODS);
  for (const methodSet of Object.values(receiverMaps)) {
    for (const method of methodSet) {
      allMethods.add(method);
    }
  }
  return allMethods;
}

export function createDefaultContext() {
  const receiverMaps = buildReceiverMethodMaps();
  const exportedFunctions = buildExportedFunctionSet();
  const allKnownMethods = buildAllKnownMethodsSet(receiverMaps);
  return { receiverMaps, exportedFunctions, allKnownMethods };
}

function resolveReceiverReference(ref, receiverMaps) {
  const allowed = receiverMaps[ref.receiver];
  if (allowed?.has(ref.member)) return null;
  return `Unknown method "${ref.member}" on "${ref.receiver}"`;
}

function resolveCallReference(ref, context) {
  const { exportedFunctions, allKnownMethods, localHelpers } = context;
  if (exportedFunctions.has(ref.name)) return null;
  if (allKnownMethods.has(ref.name)) return null;
  if (localHelpers?.has(ref.name)) return null;
  return `Unknown function or method "${ref.name}()"`;
}

function resolveFunctionReference(ref, context) {
  const { exportedFunctions, localHelpers } = context;
  if (exportedFunctions.has(ref.name)) return null;
  if (localHelpers?.has(ref.name)) return null;
  return `Unknown exported function "${ref.name}"`;
}

export function resolveReference(ref, context) {
  if (ref.kind === "standard") return null;
  if (ref.kind === "receiver") {
    return resolveReceiverReference(ref, context.receiverMaps);
  }
  if (ref.kind === "call") {
    return resolveCallReference(ref, context);
  }
  if (ref.kind === "function") {
    return resolveFunctionReference(ref, context);
  }
  return null;
}

export function verifyDocumentText(text, baseContext) {
  const localHelpers = extractDeclaredDocBlockIdentifiers(text);
  const context = { ...baseContext, localHelpers };
  const allowedReceivers = new Set(Object.keys(baseContext.receiverMaps));
  const spans = extractInlineCodeSpans(text);
  const errors = [];

  for (const span of spans) {
    const ref = parseCallShapedReference(span, allowedReceivers);
    if (!ref) continue;
    const failure = resolveReference(ref, context);
    if (failure) {
      errors.push({ raw: span, reason: failure });
    }
  }
  return errors;
}

export async function assertKitDocReferences(docsDir, baseContext = createDefaultContext()) {
  const entries = await readdir(docsDir, { withFileTypes: true });
  const failures = [];

  for (const entry of entries) {
    if (entry.isFile() && extname(entry.name).toLowerCase() === ".md") {
      const filePath = resolve(docsDir, entry.name);
      const text = await readFile(filePath, "utf8");
      const errors = verifyDocumentText(text, baseContext);
      for (const err of errors) {
        failures.push(`${entry.name}: \`${err.raw}\` (${err.reason})`);
      }
    }
  }

  assert(
    failures.length === 0,
    `evaluation kit doc references check failed with ${failures.length} unresolved reference(s):\n  ${failures.join("\n  ")}`,
  );
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const docsDir = process.argv[2] ? resolve(process.argv[2]) : resolve(process.cwd(), "docs");
  await assertKitDocReferences(docsDir);
  process.stdout.write(`kit doc references valid: all call-shaped references in ${docsDir} resolve\n`);
}
