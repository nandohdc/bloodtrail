import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  DECLARED_PACKAGES,
  assertMakefileCoverage,
  assertPackageDiscovery,
  enumerateGitPackages,
  makeRecipeFor,
  repositoryRoot,
} from "./check-package-discovery.mjs";

test("check-package-discovery: enumerateGitPackages discovers all tracked packages", () => {
  const enumerated = enumerateGitPackages();
  assert.equal(enumerated.length, 5);
  assert.deepEqual(enumerated, [
    "contracts/security-audit/package.json",
    "packages/security-audit-collector/package.json",
    "packages/security-audit-sdk-core/package.json",
    "packages/security-audit-sdk-node/package.json",
    "research/browser-telemetry/package.json",
  ]);
});

test("check-package-discovery: passing verification on exact declared package list", () => {
  const result = assertPackageDiscovery();
  assert.equal(result.packageCount, 5);
  assert.equal(result.packages.length, 5);
  assert.match(result.message, /package discovery completeness passed: 5 declared package\(s\)/);
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

// Makefile workspace coverage. A gate with no failing arm is not a gate, so each
// arm below is paired with the healthy input that must still pass.

test("check-package-discovery: makeRecipeFor extracts a target's recipe and stops at the next block", () => {
  const makefile = [
    "runtime-gates:",
    "\t@echo one",
    "\tnpm run validate --prefix packages/a",
    "",
    "other-target:",
    "\tnpm run validate --prefix packages/b",
    "",
  ].join("\n");

  const recipe = makeRecipeFor(makefile, "runtime-gates");

  assert.match(recipe, /packages\/a/);
  assert.doesNotMatch(recipe, /packages\/b/);
  assert.equal(makeRecipeFor(makefile, "absent-target"), null);
});

test("check-package-discovery: Makefile runs every declared workspace in every covering target", () => {
  const result = assertMakefileCoverage();
  assert.deepEqual(result.targets, ["runtime-gates", "governance-gates"]);
  assert.equal(result.workspaceCount, DECLARED_PACKAGES.length);
  assert.match(result.message, /each run all 5 declared workspace\(s\)/);
});

test("check-package-discovery: fails closed when a covering target skips a declared workspace", () => {
  // The exact defect this arm exists for: the collector declared, and the
  // recipe silently not running it.
  const makefile = [
    "runtime-gates:",
    "\tnpm run test:matrix --prefix packages/security-audit-sdk-core",
    "\tnpm run validate --prefix packages/security-audit-sdk-node",
    "\tnpm run validate --prefix contracts/security-audit",
    "\tnpm test --prefix research/browser-telemetry",
    "",
    "governance-gates:",
    "\tnpm run validate --prefix packages/security-audit-sdk-core",
    "\tnpm run validate --prefix packages/security-audit-sdk-node",
    "\tnpm run validate --prefix packages/security-audit-collector",
    "\tnpm run validate --prefix contracts/security-audit",
    "\tnpm test --prefix research/browser-telemetry",
    "",
  ].join("\n");

  assert.throws(
    () => assertMakefileCoverage(makefile),
    /\[makefile-workspace-uncovered\] 'runtime-gates' does not run: packages\/security-audit-collector/,
  );
});

test("check-package-discovery: fails closed when a covering target is absent entirely", () => {
  const makefile = ["runtime-gates:", "\tnpm run validate --prefix packages/a", ""].join("\n");

  assert.throws(
    () => assertMakefileCoverage(makefile, ["packages/a/package.json"]),
    /\[makefile-target-missing\] Makefile declares no 'governance-gates' target/,
  );
});

test("check-package-discovery: a newly declared package is uncovered until the Makefile runs it", () => {
  // "Add a package, forget the Makefile" must fail rather than pass quietly.
  const makefile = readFileSync(resolve(repositoryRoot, "Makefile"), "utf8");

  assert.throws(
    () => assertMakefileCoverage(makefile, [...DECLARED_PACKAGES, "packages/brand-new/package.json"]),
    /\[makefile-workspace-uncovered\].*packages\/brand-new/s,
  );
  // The same Makefile still passes against the real declared list.
  assert.equal(assertMakefileCoverage(makefile).workspaceCount, DECLARED_PACKAGES.length);
});
