import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
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
  "dist/ingress.js",
  "dist/ingress.d.ts",
  "dist/auth.js",
  "dist/auth.d.ts",
  "dist/diagnostics.js",
  "dist/diagnostics.d.ts",
  "dist/metrics.js",
  "dist/metrics.d.ts",
  "dist/bounds.js",
  "dist/bounds.d.ts",
  "dist/schema.js",
  "dist/schema.d.ts",
  "dist/version.js",
  "dist/version.d.ts",
  "dist/storage.js",
  "dist/storage.d.ts",
  "dist/sqlite-storage.js",
  "dist/sqlite-storage.d.ts",
  "dist/generated/bounds.generated.js",
  "dist/generated/bounds.generated.d.ts",
  "dist/generated/schema-validator.generated.cjs",
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

// 2. Perform a production-only install of the packed tarball in a clean consumer
// directory outside any workspace root and probe the public entry point end to
// end: an admitted fixture submission and a rejected unauthenticated submission.
const tempRoot = await mkdtemp(resolve(tmpdir(), "bloodtrail-collector-test-"));
const consumerRoot = resolve(tempRoot, "consumer");

try {
  runChecked("mkdir", ["-p", consumerRoot]);

  const packOut = JSON.parse(
    runChecked("npm", ["pack", "--json", "--pack-destination", tempRoot, "--ignore-scripts"], {
      cwd: packageRoot,
      capture: true,
    }),
  );
  const tarball = resolve(tempRoot, (Array.isArray(packOut) ? packOut[0] : packOut).filename);

  await writeFile(
    resolve(consumerRoot, "package.json"),
    JSON.stringify({ name: "consumer", private: true, type: "module" }),
    "utf8",
  );

  runChecked(
    "npm",
    [
      "install",
      "--omit=dev",
      "--no-audit",
      "--no-fund",
      "--ignore-scripts",
      "--offline",
      tarball,
    ],
    { cwd: consumerRoot, capture: true },
  );

  const probeScript = resolve(consumerRoot, "probe.mjs");
  await writeFile(
    probeScript,
    `
    import assert from "node:assert/strict";
    import {
      CollectorIngress,
      SqliteStorage,
      SyntheticFixtureAuthenticator,
      SUPPORTED_CONTRACT_VERSIONS,
    } from "@bloodtrail/security-audit-collector";

    assert.deepEqual(SUPPORTED_CONTRACT_VERSIONS, ["1.1.0"]);
    const authenticator = new SyntheticFixtureAuthenticator(["fixture-token-a"]);
    const ingress = new CollectorIngress({ authenticator });
    assert.equal(typeof ingress.submit, "function");
    assert.equal(typeof ingress.metrics, "function");

    const fixture = JSON.stringify({
      event: { id: "00000000-0000-4000-8000-000000000001", name: "bloodtrail.audit.authentication.succeeded", category: "authentication", action: "authenticate", lifecycle_phase: "completed", outcome: "success", timestamp: "2026-09-06T12:00:00.000Z", observed_at: "2026-09-06T12:00:00.000Z", delivery_class: "security_significant" },
      schema: { name: "security-audit-event", version: "1.1.0" },
      producer: { name: "producer-fixture", version: "1.0.0" },
      environment: { name: "synthetic" },
      service: { name: "svc" },
      tenant: { scope: "tenant" },
      actor: { type: "service_account" },
      initiator: { type: "service", id: "init-1" },
      resource: { operation_type: "read" },
      correlation: { correlation_id: "c1", operation_id: "op1" },
      data: { classification: "internal", retention_class: "security_standard", field_policy_version: "1.1.0" },
    });
    const admitted = ingress.submit({ credentials: { credential: "fixture-token-a" }, body: fixture });
    assert.equal(admitted.kind, "admitted");
    assert.equal(admitted.eventId, "00000000-0000-4000-8000-000000000001");

    const rejected = ingress.submit({ body: fixture });
    assert.equal(rejected.kind, "rejected");
    assert.equal(rejected.diagnostic.code, "COLLECTOR_AUTH_MISSING");

    // The packed backend persists through node:sqlite outside the workspace.
    const storage = new SqliteStorage({ location: ":memory:" });
    const persisting = new CollectorIngress({
      authenticator,
      storage: {
        port: storage,
        owners: { dataOwner: "probe-data-owner", retentionAuthority: "probe-retention", keyOwner: "probe-key-owner" },
      },
    });
    const platformFixture = fixture.replace('"tenant":{"scope":"tenant"}', '"tenant":{"scope":"platform"}');
    const persisted = persisting.submit({ credentials: { credential: "fixture-token-a" }, body: platformFixture });
    assert.equal(persisted.kind, "persisted");
    const stored = storage.get({ kind: "platform" }, "00000000-0000-4000-8000-000000000001");
    assert.equal(stored.kind, "found");
    assert.equal(stored.record.body, platformFixture);
    storage.close();

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
