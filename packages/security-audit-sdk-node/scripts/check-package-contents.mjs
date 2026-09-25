import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { packedInstall } from "./packed-install.mjs";
import { assert, packageRoot, readJson, runChecked } from "./verification-helpers.mjs";

const pkg = await readJson(resolve(packageRoot, "package.json"));
assert(pkg.private === true, "package must remain private");
assert(pkg.license === "UNLICENSED", "package license must remain UNLICENSED");
assert(pkg.types === "./dist/index.d.ts", "package types must point to ./dist/index.d.ts");
assert(pkg.sideEffects === false, "sideEffects must remain false");

// 1. Verify dry-run packed file inventory
const packDryRun = JSON.parse(
  runChecked("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: packageRoot,
    capture: true,
  }),
);

const packReport = Array.isArray(packDryRun) ? packDryRun[0] : packDryRun;
assert(packReport && Array.isArray(packReport.files), "invalid npm pack dry-run report");

const packedPaths = new Set(packReport.files.map((f) => f.path));

const REQUIRED_FILES = [
  "package.json",
  "README.md",
  "compatibility.json",
  "dist/index.js",
  "dist/index.d.ts",
  "dist/clock.js",
  "dist/clock.d.ts",
  "dist/identifiers.js",
  "dist/identifiers.d.ts",
  "dist/byte-length.js",
  "dist/byte-length.d.ts",
  "dist/timers.js",
  "dist/timers.d.ts",
  "dist/context.js",
  "dist/context.d.ts",
  "dist/schema.js",
  "dist/schema.d.ts",
  "dist/platform.js",
  "dist/platform.d.ts",
];

for (const req of REQUIRED_FILES) {
  assert(packedPaths.has(req), `required file ${req} missing from packed tarball`);
}

const FORBIDDEN_PATH_SEGMENTS = new Set([
  "test",
  "tests",
  "script",
  "scripts",
  "src",
  ".git",
  "node_modules",
  "dist-tests",
  ".verification-output",
  "coverage",
  ".cache",
]);

function isForbiddenPackedPath(packedPath) {
  const segments = packedPath.toLowerCase().split("/");
  const finalSegment = segments.at(-1);
  return (
    segments.some((segment) => FORBIDDEN_PATH_SEGMENTS.has(segment) || segment.startsWith(".env")) ||
    finalSegment.endsWith(".tgz")
  );
}

for (const path of packedPaths) {
  assert(!isForbiddenPackedPath(path), `forbidden path ${path} included in package tarball`);
  const absolute = resolve(packageRoot, path);
  const data = await readFile(absolute);
  if (data.includes(0)) continue;
  const text = data.toString("utf8");
  assert(!text.includes("/Users/") && !text.includes("\\Users\\"), `machine-specific absolute path in ${path}`);
  assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), `private key in ${path}`);
}

// 2. Perform production install test outside workspace root
const { installRoot, removeTemporaryDirectory } = await packedInstall({
  packages: ["core", "node"],
  manifest: () => ({ name: "consumer", private: true, type: "module" }),
  installer: ({ core, node }) => ({
    command: "npm",
    args: ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline", core.path, node.path],
  }),
});

try {
  // Probe imports from the consumer
  const probeScript = resolve(installRoot, "probe.mjs");
  await writeFile(
    probeScript,
    `
    import * as sdkNode from "@bloodtrail/security-audit-sdk-node";
    import assert from "node:assert/strict";

    assert.equal(typeof sdkNode.createNodeSecurityAuditSdk, "function");
    assert.equal(typeof sdkNode.nodeClock.now, "function");
    assert.ok(sdkNode.nodeClock.now() instanceof Date);
    assert.equal(typeof sdkNode.nodeIdentifiers.eventId, "function");
    assert.ok(/^[0-9a-f-]{36}$/i.test(sdkNode.nodeIdentifiers.eventId()));
    assert.equal(typeof sdkNode.nodeByteLength.byteLength, "function");
    assert.equal(sdkNode.nodeByteLength.byteLength("abc"), 3);
    assert.equal(typeof sdkNode.nodeTimers.setTimeout, "function");
    assert.equal(typeof sdkNode.nodeContextProvider.get, "function");
    assert.equal(sdkNode.nodeContextProvider.get(), undefined);
    assert.equal(typeof sdkNode.nodeSchemaRuntime.validate, "function");
    assert.ok(sdkNode.nodePlatformProvider);

    console.log("consumer-probe:pass");
    `,
    "utf8",
  );

  const probeOutput = runChecked("node", [probeScript], { cwd: installRoot, capture: true });
  assert(probeOutput.includes("consumer-probe:pass"), "consumer probe failed to execute successfully");

  process.stdout.write(
    `packed artifact verification passed: ${packedPaths.size} files in tarball, clean offline install and import verified outside workspace root\n`,
  );
} finally {
  await removeTemporaryDirectory();
}
