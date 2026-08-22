import { readdir, readFile } from "node:fs/promises";
import { extname, relative, resolve, sep } from "node:path";
import { inspectPlatformCoupling } from "./platform-coupling-policy.mjs";
import { packageRoot, readJson } from "./verification-helpers.mjs";

const sourceRoot = resolve(packageRoot, "src");
const packageJson = await readJson(resolve(packageRoot, "package.json"));
const files = await walk(sourceRoot);
const violations = [];
const FORBIDDEN_NAME_TERMS = [
  "adapter", "instrument(?:ation)?", "transport", "exporter", "collector",
  "queue", "outbox", "storage", "siem", "analytics", "detection", "browser",
  "telemetry", "framework", "express", "nestjs", "fastify", "nextjs",
  "cryptographic-chain",
];
const forbiddenFileName = new RegExp(
  `(?:^|[./_-])(${FORBIDDEN_NAME_TERMS.join("|")})(?:[./_-]|$)`,
  "i",
);
const forbiddenSource = [
  /\b(?:fetch|WebSocket|XMLHttpRequest)\s*\(/,
  /\b(?:http|https|net|tls|dgram|fs|fs\/promises|worker_threads|child_process)\b/,
  /\b(?:express|nestjs|fastify|nextjs|opentelemetry|kafka|rabbitmq|sqs|sns|pubsub|redis|postgres|mysql|mongodb|elasticsearch|splunk|datadog)\b/i,
  /\b(?:localStorage|sessionStorage|navigator|document|window)\b/,
  /\bconsole\.(?:log|info|warn|error|debug)\s*\(/,
];
const allowedNodeImports = new Set(["node:async_hooks", "node:crypto"]);

for (const file of files) {
  const relativePath = relative(packageRoot, file).split(sep).join("/");
  if (relativePath.startsWith("src/generated/")) continue;
  if (forbiddenFileName.test(relativePath)) violations.push(`${relativePath}: forbidden production integration filename`);
  let source;
  try {
    source = await readFile(file, "utf8");
  } catch {
    continue;
  }
  for (const pattern of forbiddenSource) {
    if (pattern.test(source)) violations.push(`${relativePath}: ${pattern}`);
  }
  for (const match of source.matchAll(/(?:from\s+|import\s*)["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (specifier.startsWith(".") || allowedNodeImports.has(specifier)) continue;
    violations.push(`${relativePath}: non-core production import ${specifier}`);
  }
}

for (const field of ["dependencies", "optionalDependencies", "peerDependencies"]) {
  if (Object.keys(packageJson[field] ?? {}).length > 0) violations.push(`package.json: ${field} must remain empty`);
}
for (const forbiddenExport of ["transport", "collector", "queue", "outbox", "storage", "browser", "telemetry"]) {
  if (JSON.stringify(packageJson.exports ?? {}).toLowerCase().includes(forbiddenExport)) {
    violations.push(`package.json: forbidden ${forbiddenExport} export`);
  }
}

const coupling = await inspectPlatformCoupling({ packageRoot, sourceRoot });
for (const item of coupling.violations) {
  violations.push(`[platform-coupling:${item.code}] ${item.artifact}: ${item.detail}`);
}

if (violations.length > 0) {
  throw new Error(`production-scope violations:\n${violations.join("\n")}`);
}

process.stdout.write(
  `scope passed: ${files.length} SDK source files, only node:async_hooks/node:crypto external runtime imports, no production integration or runtime dependency\n${formatInventory(coupling.inventory)}\n`,
);

function formatInventory(inventory) {
  const authoredGlobals = formatHostGlobals(inventory.authored.hostGlobals);
  const generatedGlobals = formatHostGlobals(inventory.generated.hostGlobals);
  return `platform coupling inventory: authored: ${inventory.authored.artifacts} artifacts, ${inventory.authored.references} references, host couplings: [${authoredGlobals}]; generated: ${inventory.generated.artifacts} artifacts, ${inventory.generated.references} references, host couplings: [${generatedGlobals}]`;
}

function formatHostGlobals(map) {
  if (map.size === 0) return "none";
  const items = [];
  for (const [name, count] of map) {
    items.push(`${name} (${count} site${count === 1 ? "" : "s"})`);
  }
  return items.join(", ");
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const result = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) result.push(...await walk(path));
    else if (entry.isFile() && extname(entry.name) === ".ts") result.push(path);
  }
  return result;
}
