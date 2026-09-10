import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import test from "node:test";
import {
  DECLARED_PACKAGES,
  assertCostFiguresAreVariables,
  assertSonarCpdExclusions,
  assertSonarScopeCoversDeclaredPackages,
  assertMakefileCoverage,
  assertPackageDiscovery,
  assertPartialTargetDisclosure,
  enumerateGitPackages,
  makeRecipeFor,
  makeTargetsIn,
  recipeCommandLines,
  recipeMessageLines,
  repositoryRoot,
  sonarPropertyFor,
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

// Coverage counts what a recipe runs, not what it says. Reading the whole recipe
// would let a target that stopped running a workspace keep reporting coverage for
// it as long as its notice still mentioned it — #412, re-entering through the
// door partial-run disclosure opens.

test("check-package-discovery: command and message lines are separated", () => {
  const recipe = ["\t@echo skipped packages/a", "\tnpm run validate --prefix packages/b"].join("\n");

  assert.match(recipeCommandLines(recipe), /packages\/b/);
  assert.doesNotMatch(recipeCommandLines(recipe), /packages\/a/);
  assert.match(recipeMessageLines(recipe), /packages\/a/);
  assert.doesNotMatch(recipeMessageLines(recipe), /packages\/b/);
});

test("check-package-discovery: a workspace named only in a message is not covered", () => {
  const makefile = [
    "runtime-gates:",
    "\tnpm run validate --prefix packages/a",
    "\t@echo also covers packages/b",
    "",
    "governance-gates:",
    "\tnpm run validate --prefix packages/a",
    "\tnpm run validate --prefix packages/b",
    "",
  ].join("\n");

  assert.throws(
    () => assertMakefileCoverage(makefile, ["packages/a/package.json", "packages/b/package.json"]),
    /\[makefile-workspace-uncovered\] 'runtime-gates' does not run: packages\/b/,
  );
});

test("check-package-discovery: makeTargetsIn lists rule targets and skips variables", () => {
  const makefile = [
    ".DEFAULT_GOAL := test",
    "COST_SDK := ~1s local, 2026-09-10",
    ".PHONY: test sdk",
    "test: runtime-gates",
    "sdk:",
    "\tnpm run validate --prefix packages/a",
    "",
  ].join("\n");

  assert.deepEqual(makeTargetsIn(makefile), ["test", "sdk"]);
});

// Partial-run disclosure. The ratified requirement always said a partial run must
// name what it skipped; nothing enforced it, and all three partial targets went on
// describing a four-workspace repository after the collector was added.

test("check-package-discovery: every partial target names the workspaces it skips", () => {
  const result = assertPartialTargetDisclosure();

  assert.deepEqual(result.targets, ["sdk", "contract", "research"]);
  assert.equal(result.workspaceCount, DECLARED_PACKAGES.length);
  assert.match(result.message, /name every workspace they skip/);
});

test("check-package-discovery: fails closed when a partial target omits a skipped workspace", () => {
  // The exact defect this arm exists for: the collector skipped, and the notice
  // still listing the pre-collector set.
  const makefile = [
    "sdk:",
    "\tnpm run validate --prefix packages/security-audit-sdk-core",
    "\t@echo Notice: contracts/security-audit and research/browser-telemetry were NOT run.",
    "",
  ].join("\n");

  assert.throws(
    () => assertPartialTargetDisclosure(makefile),
    /\[makefile-skip-undisclosed\] 'sdk' does not run and does not say it skipped: .*packages\/security-audit-collector/s,
  );
});

test("check-package-discovery: fails closed when a partial target claims to skip what it runs", () => {
  const makefile = [
    "sdk:",
    "\tnpm run validate --prefix packages/security-audit-sdk-core",
    "\tnpm run validate --prefix packages/security-audit-sdk-node",
    "\t@echo Notice: packages/security-audit-sdk-node, packages/security-audit-collector, contracts/security-audit and research/browser-telemetry were NOT run.",
    "",
  ].join("\n");

  assert.throws(
    () => assertPartialTargetDisclosure(makefile),
    /\[makefile-skip-misreported\] 'sdk' says it skipped a workspace it runs: packages\/security-audit-sdk-node/,
  );
});

test("check-package-discovery: a target that runs no workspace makes no coverage claim", () => {
  const makefile = ["help:", "\t@echo Bloodtrail command surface", ""].join("\n");

  assert.deepEqual(assertPartialTargetDisclosure(makefile).targets, []);
});

test("check-package-discovery: a newly declared package must be disclosed by every partial target", () => {
  // "Add a package, forget the notice" must fail rather than pass quietly, the
  // same way "add a package, forget the Makefile" already does.
  const makefile = readFileSync(resolve(repositoryRoot, "Makefile"), "utf8");

  assert.throws(
    () =>
      assertPartialTargetDisclosure(makefile, [
        ...DECLARED_PACKAGES,
        "packages/brand-new/package.json",
      ]),
    /\[makefile-skip-undisclosed\].*packages\/brand-new/s,
  );
  assert.equal(assertPartialTargetDisclosure(makefile).targets.length, 3);
});

// One target, one documented cost. `help` said 26s while the recipe echoed 34s.

test("check-package-discovery: every cost figure expands from a COST_ variable", () => {
  const result = assertCostFiguresAreVariables();

  assert.match(result.message, /every stated cost expands from a single COST_ variable/);
});

test("check-package-discovery: fails closed on a cost figure written by hand", () => {
  const makefile = [
    "COST_SDK := ~40s local, 2026-09-10",
    "",
    "sdk:",
    "\t@echo Running SDK product loop (~26s)...",
    "",
  ].join("\n");

  assert.throws(
    () => assertCostFiguresAreVariables(makefile),
    /\[makefile-cost-literal\].*Running SDK product loop/s,
  );
});

test("check-package-discovery: a cost stated only through its variable passes", () => {
  const makefile = [
    "COST_SDK := ~40s local, 2026-09-10",
    "",
    "sdk:",
    "\t@echo Running SDK product loop ($(COST_SDK))...",
    "",
  ].join("\n");

  assert.match(assertCostFiguresAreVariables(makefile).message, /every stated cost expands/);
});

// The analysis scope of a required gate. `sonar-project.properties` said it
// "scans every workspace" while omitting two of the five, and the header is why
// nobody re-read the list.

test("check-package-discovery: sonarPropertyFor reads one list and skips comments", () => {
  const properties = [
    "# sonar.sources=commented/out",
    "sonar.sources=a/src, b/src ,c/src",
    "sonar.tests=a/tests",
    "",
  ].join("\n");

  assert.deepEqual(sonarPropertyFor(properties, "sonar.sources"), ["a/src", "b/src", "c/src"]);
  assert.deepEqual(sonarPropertyFor(properties, "sonar.tests"), ["a/tests"]);
  assert.equal(sonarPropertyFor(properties, "sonar.absent"), null);
});

test("check-package-discovery: the analysis scope covers every declared package", () => {
  const result = assertSonarScopeCoversDeclaredPackages();

  assert.equal(result.workspaceCount, DECLARED_PACKAGES.length);
  assert.match(result.message, /covering all 5 declared package\(s\)/);
});

test("check-package-discovery: fails closed when a declared package is absent from the scope", () => {
  // The exact defect this arm exists for: the collector declared, and the
  // analyser never told to look at it.
  const properties = [
    "sonar.sources=packages/security-audit-sdk-core/src,packages/security-audit-sdk-node/src,contracts/security-audit/scripts,research/browser-telemetry/lib",
    "",
  ].join("\n");

  assert.throws(
    () => assertSonarScopeCoversDeclaredPackages(properties),
    /\[sonar-scope-uncovered\].*packages\/security-audit-collector/s,
  );
});

test("check-package-discovery: fails closed on a scope entry under no declared package", () => {
  const properties = [
    "sonar.sources=packages/security-audit-sdk-core/src,packages/security-audit-sdk-node/src,packages/security-audit-collector/src,contracts/security-audit/scripts,research/browser-telemetry/lib,packages/removed-workspace/src",
    "",
  ].join("\n");

  assert.throws(
    () => assertSonarScopeCoversDeclaredPackages(properties),
    /\[sonar-scope-stray\].*packages\/removed-workspace\/src/s,
  );
});

test("check-package-discovery: a recorded exception is tolerated, an unrecorded one is not", () => {
  const properties = [
    "sonar.sources=packages/security-audit-sdk-core/src,packages/security-audit-sdk-node/src,packages/security-audit-collector/src,contracts/security-audit/scripts,research/browser-telemetry/lib,openspec/scripts",
    "",
  ].join("\n");

  assert.throws(
    () => assertSonarScopeCoversDeclaredPackages(properties),
    /\[sonar-scope-stray\].*openspec\/scripts/s,
  );
  assert.match(
    assertSonarScopeCoversDeclaredPackages(properties, DECLARED_PACKAGES, ["openspec/scripts"]).message,
    /covering all 5 declared package\(s\)/,
  );
});

test("check-package-discovery: fails closed when sonar.sources is absent entirely", () => {
  assert.throws(
    () => assertSonarScopeCoversDeclaredPackages("sonar.tests=a/tests\n"),
    /\[sonar-sources-absent\]/,
  );
});

test("check-package-discovery: a newly declared package must be added to the analysis scope", () => {
  // "Add a package, forget the analyser" must fail rather than pass quietly,
  // the same way "add a package, forget the Makefile" already does.
  const properties = readFileSync(resolve(repositoryRoot, "sonar-project.properties"), "utf8");

  assert.throws(
    () =>
      assertSonarScopeCoversDeclaredPackages(properties, [
        ...DECLARED_PACKAGES,
        "packages/brand-new/package.json",
      ]),
    /\[sonar-scope-uncovered\].*packages\/brand-new/s,
  );
  assert.equal(
    assertSonarScopeCoversDeclaredPackages(properties).workspaceCount,
    DECLARED_PACKAGES.length,
  );
});

test("check-package-discovery: CPD excludes only intentional standalone-package script duplication", () => {
  const result = assertSonarCpdExclusions();

  assert.deepEqual(result.exclusions, ["packages/*/scripts/**"]);
  assert.match(result.message, /approved standalone-package boundary/);
});

test("check-package-discovery: fails closed when the CPD exception is absent or broadened", () => {
  assert.throws(
    () => assertSonarCpdExclusions("sonar.sources=packages/security-audit-sdk-core/src\n"),
    /\[sonar-cpd-exclusions-absent\]/,
  );
  assert.throws(
    () => assertSonarCpdExclusions("sonar.cpd.exclusions=**/scripts/**\n"),
    /\[sonar-cpd-exclusion-missing\].*packages\/\*\/scripts\/\*\*.*\[sonar-cpd-exclusion-unexpected\].*\*\*\/scripts\/\*\*/s,
  );
});
