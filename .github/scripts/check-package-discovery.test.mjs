import assert from "node:assert/strict";
import test from "node:test";
import {
  DECLARED_PACKAGES,
  assertPackageDiscovery,
  enumerateGitPackages,
} from "./check-package-discovery.mjs";

test("check-package-discovery: enumerateGitPackages discovers all tracked packages", () => {
  const enumerated = enumerateGitPackages();
  assert.equal(enumerated.length, 4);
  assert.deepEqual(enumerated, [
    "contracts/security-audit/package.json",
    "packages/security-audit-sdk-core/package.json",
    "packages/security-audit-sdk-node/package.json",
    "research/browser-telemetry/package.json",
  ]);
});

test("check-package-discovery: passing verification on exact declared package list", () => {
  const result = assertPackageDiscovery();
  assert.equal(result.packageCount, 4);
  assert.equal(result.packages.length, 4);
  assert.match(result.message, /package discovery completeness passed: 4 declared package\(s\)/);
});

test("check-package-discovery: fails closed when discovered package count is zero", () => {
  assert.throws(
    () => assertPackageDiscovery([], DECLARED_PACKAGES),
    /\[package-discovery-empty\] discovered package count is zero/,
  );
});

test("check-package-discovery: fails closed when an untracked/undeclared package exists on disk", () => {
  const simulatedOnDisk = [
    ...DECLARED_PACKAGES,
    "packages/untracked-new-pkg/package.json",
  ];
  assert.throws(
    () => assertPackageDiscovery(simulatedOnDisk, DECLARED_PACKAGES),
    /\[package-discovery-undeclared\] packages present on disk but absent from declared list: packages\/untracked-new-pkg\/package\.json/,
  );
});

test("check-package-discovery: fails closed when a declared package is missing from disk", () => {
  const simulatedOnDisk = [
    "contracts/security-audit/package.json",
    "packages/security-audit-sdk-core/package.json",
  ];
  assert.throws(
    () => assertPackageDiscovery(simulatedOnDisk, DECLARED_PACKAGES),
    /\[package-discovery-phantom\] packages declared in list but absent from on-disk git tracking/,
  );
});
