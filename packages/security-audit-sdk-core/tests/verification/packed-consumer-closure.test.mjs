// Packed-consumer closure gate (S-6 regression, inverted).
//
// Reproduces the production-only consumer install: pack the tarball, install
// it into a fresh temp consumer with --omit=dev --offline, import both public
// entry points BY PACKAGE SPECIFIER (so the declared export map is exercised),
// and run positive, structural-negative, and semantic-negative validation,
// including an event carrying a uri-format field so the bundled bare-function
// uri validator runs end to end.
//
// This test reads the live tree rather than a disposable clone. That is the
// one deliberate exception to the clone convention: npm pack writes the
// tarball to a destination OUTSIDE the package root (check-package-contents
// rejects any packed .tgz inside it), and performs no write inside the
// package. The clone convention exists to stop writes from corrupting the
// snapshots sibling test files take in parallel; this test makes none.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";

import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
  assert.equal(result.status, 0, `${command} ${args.join(" ")} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}

test("packed tarball installs, imports, and validates with production-only dependencies", async () => {
  assert.equal(existsSync(resolve(packageRoot, "dist/index.js")), true, "run npm run build first");
  assert.equal(existsSync(resolve(packageRoot, "dist/testing.js")), true, "run npm run build first");
  assert.equal(existsSync(resolve(packageRoot, "dist/generated/schema-validator.generated.cjs")), true, "run npm run build first");

  const packDir = mkdtempSync(join(tmpdir(), "bloodtrail-pack-"));
  const consumerDir = mkdtempSync(join(tmpdir(), "bloodtrail-consumer-"));
  try {
    const packOutput = JSON.parse(run("npm", ["pack", "--json", "--pack-destination", packDir, "--ignore-scripts", "--loglevel", "error"], packageRoot));
    const tarballs = packOutput.filter((entry) => entry.filename.endsWith(".tgz"));
    assert.equal(tarballs.length, 1, "expected exactly one packed tarball");
    const tarball = resolve(packDir, tarballs[0].filename);

    // A minimal manifest before installing: without it npm walks up to the
    // nearest ancestor manifest and installs there instead.
    writeFileSync(resolve(consumerDir, "package.json"), JSON.stringify({ name: "consumer", private: true, type: "module" }), "utf8");
    run("npm", ["install", tarball, "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline", "--loglevel", "error"], consumerDir);

    const probePath = resolve(consumerDir, "probe.mjs");
    writeFileSync(
      probePath,
      [
        'export * from "@bloodtrail/security-audit-sdk-core";',
        'export * from "@bloodtrail/security-audit-sdk-core/testing";',
        "",
      ].join("\n"),
      "utf8",
    );
    const probe = await import(pathToFileURL(probePath).href);
    assert.equal(typeof probe.createSecurityAuditSdk, "function", "root export missing from consumer install");
    assert.equal(typeof probe.validateSecurityAuditEvent, "function", "root export missing from consumer install");
    assert.equal(typeof probe.createCapturingAuditSink, "function", "testing export missing from consumer install");
    assert.equal(typeof probe.createInMemoryAuditSink, "function", "testing export missing from consumer install");

    const fixtures = JSON.parse(readFileSync(resolve(repositoryRoot, "contracts/security-audit/examples/positive/all-events.json"), "utf8"));
    const withUriField = fixtures.find((candidate) =>
      Boolean(candidate.authentication?.identity_provider || candidate.authenticated_principal?.issuer));
    assert.ok(withUriField, "contract examples must include an event carrying a uri-format field");
    const valid = structuredClone(withUriField);

    assert.equal(probe.validateSecurityAuditEvent(valid).ok, true, "valid canonical event must validate from the consumer install");

    const structural = structuredClone(valid);
    delete structural.event.id;
    const structuralResult = probe.validateSecurityAuditEvent(structural);
    assert.equal(structuralResult.ok, false, "missing required event id must fail validation");
    assert.ok(structuralResult.error && typeof structuralResult.error.code === "string", "failure must carry a bounded diagnostic");
    assert.ok(JSON.stringify(structuralResult).length < 512, "failure diagnostics must stay bounded");

    const semantic = structuredClone(valid);
    semantic.event.timestamp = "2026-02-30T10:30:00Z";
    const semanticResult = probe.validateSecurityAuditEvent(semantic);
    assert.equal(semanticResult.ok, false, "semantically invalid RFC 3339 timestamp must fail validation");
    assert.ok(semanticResult.error && typeof semanticResult.error.code === "string", "failure must carry a bounded diagnostic");
    assert.ok(JSON.stringify(semanticResult).length < 512, "failure diagnostics must stay bounded");

    const installedArtifact = readFileSync(
      resolve(consumerDir, "node_modules/@bloodtrail/security-audit-sdk-core/dist/generated/schema-validator.generated.cjs"),
      "utf8",
    );
    assert.equal(installedArtifact.includes("require("), false, "installed validator must be self-contained");
    assert.equal(installedArtifact.includes("Bundled runtime code, MIT licensed"), true, "attribution header missing from installed artifact");
    assert.equal(installedArtifact.startsWith('"use strict";'), true, "strict-mode directive must stay the first statement");
  } finally {
    rmSync(packDir, { recursive: true, force: true });
    rmSync(consumerDir, { recursive: true, force: true });
  }
});
