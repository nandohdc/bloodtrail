import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { assert, packageRoot, readJson, repositoryRoot, runChecked } from "./verification-helpers.mjs";

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

const FORBIDDEN_PATTERN = /(?:^|\/)(?:tests?|scripts?|src|\.git|node_modules|dist-tests|\.verification-output|coverage|\.cache)(?:\/|$)|(?:^|\/)\.env|\.tgz$/i;

for (const path of packedPaths) {
  assert(!FORBIDDEN_PATTERN.test(path), `forbidden path ${path} included in package tarball`);
  const absolute = resolve(packageRoot, path);
  const data = await readFile(absolute);
  if (data.includes(0)) continue;
  const text = data.toString("utf8");
  assert(!text.includes("/Users/") && !text.includes("\\Users\\"), `machine-specific absolute path in ${path}`);
  assert(!/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), `private key in ${path}`);
}

// 2. Perform production install test outside workspace root
const coreRoot = resolve(repositoryRoot, "packages/security-audit-sdk-core");
const tempRoot = await mkdtemp(resolve(tmpdir(), "bloodtrail-node-test-"));
const consumerRoot = resolve(tempRoot, "consumer");

try {
  runChecked("mkdir", ["-p", consumerRoot]);

  // Pack Core
  const corePackOut = JSON.parse(
    runChecked("npm", ["pack", "--json", "--pack-destination", tempRoot, "--ignore-scripts"], {
      cwd: coreRoot,
      capture: true,
    }),
  );
  const coreTarball = resolve(tempRoot, (Array.isArray(corePackOut) ? corePackOut[0] : corePackOut).filename);

  // Pack Node binding
  const nodePackOut = JSON.parse(
    runChecked("npm", ["pack", "--json", "--pack-destination", tempRoot, "--ignore-scripts"], {
      cwd: packageRoot,
      capture: true,
    }),
  );
  const nodeTarball = resolve(tempRoot, (Array.isArray(nodePackOut) ? nodePackOut[0] : nodePackOut).filename);

  // Initialize consumer
  await writeFile(
    resolve(consumerRoot, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" }),
    "utf8",
  );

  // Install both tarballs into isolated consumer
  runChecked(
    "npm",
    [
      "install",
      "--omit=dev",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      "--offline",
      coreTarball,
      nodeTarball,
    ],
    { cwd: consumerRoot, capture: true },
  );

  // Probe imports from the consumer
  const probeScript = resolve(consumerRoot, "probe.mjs");
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

  const probeOutput = runChecked("node", [probeScript], { cwd: consumerRoot, capture: true });
  assert(probeOutput.includes("consumer-probe:pass"), "consumer probe failed to execute successfully");

  process.stdout.write(
    `packed artifact verification passed: ${packedPaths.size} files in tarball, clean offline install and import verified outside workspace root\n`,
  );
} finally {
  await rm(tempRoot, { recursive: true, force: true });
}
