import { relative, resolve, sep } from "node:path";
import {
  formatCouplingViolation,
  inspectPlatformCoupling,
  walkSourceTree,
} from "./platform-coupling-policy.mjs";
import { packageRoot, readJson } from "./verification-helpers.mjs";

const sourceRoot = resolve(packageRoot, "src");
const packageJson = await readJson(resolve(packageRoot, "package.json"));
const sourceTree = await walkSourceTree(sourceRoot);
const violations = [];

// The collector package is itself the "collector" name — that token is NOT a
// forbidden filename term here (it would reject the package's own identity).
// The forbidden vocabulary is the production integration surface this bounded
// ingress must never grow: transport, exporters, queues, outboxes, storage,
// SIEM, analytics/detection, browser telemetry, framework instrumentation,
// servers/listeners/sockets, and cryptographic audit-log chaining.
const FORBIDDEN_NAME_TERMS = [
  "adapter", "instrument(?:ation)?", "transport", "exporter", "queue",
  "outbox", "storage", "siem", "analytics", "detection", "browser",
  "telemetry", "framework", "express", "nestjs", "fastify", "nextjs",
  "cryptographic-chain", "server", "socket", "http", "client",
];
const forbiddenFileName = forbiddenNamePattern(FORBIDDEN_NAME_TERMS);
// #115 selects and implements one storage backend under its own governed change.
// Exactly these two files may carry the storage token, and no other forbidden
// token; any other storage-named file is still an incidental integration.
const AUTHORIZED_STORAGE_FILES = new Set(["src/storage.ts", "src/sqlite-storage.ts"]);
const forbiddenExceptStorage = forbiddenNamePattern(FORBIDDEN_NAME_TERMS.filter((term) => term !== "storage"));
for (const file of sourceTree.files) {
  const relativePath = relative(packageRoot, file).split(sep).join("/");
  const pattern = AUTHORIZED_STORAGE_FILES.has(relativePath) ? forbiddenExceptStorage : forbiddenFileName;
  if (pattern.test(relativePath)) violations.push(`${relativePath}: forbidden production integration filename`);
}

if (Object.keys(packageJson.dependencies ?? {}).length > 0) {
  violations.push("package.json: dependencies must remain empty; the collector ships zero runtime dependencies");
}
for (const field of ["optionalDependencies", "peerDependencies"]) {
  if (Object.keys(packageJson[field] ?? {}).length > 0) violations.push(`package.json: ${field} must remain empty`);
}
const exportsText = JSON.stringify(packageJson.exports ?? "").toLowerCase();
for (const forbiddenExport of ["transport", "queue", "outbox", "storage", "browser", "telemetry", "server", "http"]) {
  if (exportsText.includes(forbiddenExport)) {
    violations.push(`package.json: forbidden ${forbiddenExport} export`);
  }
}

const coupling = await inspectPlatformCoupling({ packageRoot, sourceRoot, tree: sourceTree });
for (const item of coupling.violations) {
  violations.push(formatCouplingViolation(item));
}

if (violations.length > 0) {
  throw new Error(`production-scope violations:\n${violations.join("\n")}`);
}

process.stdout.write(
  `scope passed: ${sourceTree.files.length} collector source files, one approved runtime coupling (node:sqlite in src/sqlite-storage.ts only), no other production integration or runtime dependency\n${formatInventory(coupling.inventory)}\n`,
);

function forbiddenNamePattern(terms) {
  return new RegExp(`(?:^|[./_-])(${terms.join("|")})(?:[./_-]|$)`, "i");
}

function formatInventory(inventory) {
  const authoredGlobals = formatHostGlobals(inventory.authored.hostGlobals);
  const backendSpecifiers = formatHostGlobals(inventory.backend.specifiers);
  return `platform coupling inventory: authored: ${inventory.authored.artifacts} artifacts, ${inventory.authored.references} references, host couplings: [${authoredGlobals}]; backend: ${inventory.backend.artifacts} artifacts, specifiers: [${backendSpecifiers}]; generated: ${inventory.generated.artifacts} artifacts, ${inventory.generated.references} references (byte-drift-gated)`;
}

function formatHostGlobals(map) {
  if (map.size === 0) return "none";
  const items = [];
  for (const [name, count] of map) {
    items.push(`${name} (${count} site${count === 1 ? "" : "s"})`);
  }
  return items.join(", ");
}
