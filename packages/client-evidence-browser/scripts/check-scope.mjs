import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const srcDir = resolve(packageRoot, "src");
const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));

const FORBIDDEN_STORAGE_TERMS = [
  "localStorage",
  "sessionStorage",
  "indexedDB",
  "document.cookie",
  "openDatabase",
  "CacheStorage",
  "caches.open"
];

const FORBIDDEN_TRANSPORT_TERMS = [
  "fetch(",
  "XMLHttpRequest",
  "sendBeacon",
  "WebSocket",
  "EventSource"
];

const FORBIDDEN_NODE_MODULES = [
  "node:",
  "from \"fs\"",
  "from 'fs'",
  "from \"path\"",
  "from 'path'",
  "from \"crypto\"",
  "from 'crypto'",
  "from \"http\"",
  "from 'http'",
  "from \"net\"",
  "from 'net'"
];

const FORBIDDEN_CORE_IMPORT = "@bloodtrail/security-audit-sdk-core";

const violations = [];

function checkPackageJson(pkg) {
  if (Object.keys(pkg.dependencies ?? {}).length > 0) {
    violations.push("package.json: dependencies must remain empty; browser package ships zero runtime dependencies");
  }
  if (Object.keys(pkg.peerDependencies ?? {}).length > 0) {
    violations.push("package.json: peerDependencies must remain empty");
  }
  if (Object.keys(pkg.optionalDependencies ?? {}).length > 0) {
    violations.push("package.json: optionalDependencies must remain empty");
  }
}

async function collectFiles(dir) {
  const entries = await readdir(dir, { withFileTypes: true, recursive: true });
  return entries
    .filter((e) => e.isFile() && (e.name.endsWith(".ts") || e.name.endsWith(".js")))
    .map((e) => resolve(e.parentPath || dir, e.name));
}

function inspectFileContent(filePath, content) {
  const rel = relative(packageRoot, filePath);
  if (content.includes(FORBIDDEN_CORE_IMPORT)) {
    violations.push(`${rel}: forbidden import of SDK Core package (${FORBIDDEN_CORE_IMPORT})`);
  }
  for (const term of FORBIDDEN_STORAGE_TERMS) {
    if (content.includes(term)) {
      violations.push(`${rel}: forbidden browser storage reference: ${term}`);
    }
  }
  for (const term of FORBIDDEN_TRANSPORT_TERMS) {
    if (content.includes(term)) {
      violations.push(`${rel}: forbidden network transport reference: ${term}`);
    }
  }
  for (const term of FORBIDDEN_NODE_MODULES) {
    if (content.includes(term)) {
      violations.push(`${rel}: forbidden Node built-in import: ${term}`);
    }
  }
}

checkPackageJson(packageJson);

const srcFiles = await collectFiles(srcDir);
for (const file of srcFiles) {
  const content = await readFile(file, "utf8");
  inspectFileContent(file, content);
}

if (violations.length > 0) {
  process.stderr.write(`Scope violations detected:\n${violations.join("\n")}\n`);
  process.exit(1);
}

process.stdout.write(`Scope check passed: ${srcFiles.length} browser source files verified (zero Core imports, zero Node built-ins, zero storage, zero transport).\n`);
