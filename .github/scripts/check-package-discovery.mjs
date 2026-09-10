#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(__dirname, "../..");

export const DECLARED_PACKAGES = Object.freeze([
  "contracts/security-audit/package.json",
  "packages/security-audit-sdk-core/package.json",
  "packages/security-audit-sdk-node/package.json",
  "packages/security-audit-collector/package.json",
  "research/browser-telemetry/package.json",
]);

/**
 * Enumerates all tracked package.json files in the repository using git ls-files,
 * explicitly excluding any nested inside node_modules.
 */
export function enumerateGitPackages(repoRoot = repositoryRoot) {
  const stdout = execFileSync("git", ["ls-files", "*package.json"], {
    cwd: repoRoot,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  return stdout
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.includes("node_modules/"))
    .sort();
}

/**
 * Asserts that the enumerated on-disk packages match the declared package list byte-for-byte
 * and that discovered package count is nonzero, failing closed in both directions.
 */
export function assertPackageDiscovery(
  enumeratedPackages = null,
  declaredPackages = DECLARED_PACKAGES,
) {
  const actual = (enumeratedPackages ?? enumerateGitPackages()).slice().sort();
  const declared = declaredPackages.slice().sort();

  if (actual.length === 0) {
    throw new Error(
      "[package-discovery-empty] discovered package count is zero; build/test discovery must be nonzero",
    );
  }

  const missingFromDeclared = actual.filter((pkg) => !declared.includes(pkg));
  const phantomInDeclared = declared.filter((pkg) => !actual.includes(pkg));

  const failures = [];
  if (missingFromDeclared.length > 0) {
    failures.push(
      `[package-discovery-undeclared] packages present on disk but absent from declared list: ${missingFromDeclared.join(", ")}`,
    );
  }
  if (phantomInDeclared.length > 0) {
    failures.push(
      `[package-discovery-phantom] packages declared in list but absent from on-disk git tracking: ${phantomInDeclared.join(", ")}`,
    );
  }
  if (actual.length !== declared.length && failures.length === 0) {
    failures.push(
      `[package-discovery-count-mismatch] discovered ${actual.length} packages, expected ${declared.length}`,
    );
  }

  if (failures.length > 0) {
    throw new Error(`package discovery completeness assertion failed:\n  ${failures.join("\n  ")}`);
  }

  const message = `package discovery completeness passed: ${actual.length} declared package(s) verified on disk:\n  - ${actual.join("\n  - ")}\n`;
  return {
    packageCount: actual.length,
    packages: actual,
    message,
  };
}

/**
 * The `make` recipes that must exercise every declared workspace. Both the fast
 * product loop and the full gate chain claim to cover the repository, so both
 * are held to the same completeness assertion.
 */
export const COVERING_MAKE_TARGETS = Object.freeze(["runtime-gates", "governance-gates"]);

/** The Makefile text an assertion should read: the caller's, or the repository's. */
export function resolveMakefileText(makefileText) {
  return makefileText ?? readFileSync(resolve(repositoryRoot, "Makefile"), "utf8");
}

/** Workspace directories, from the declared `package.json` paths. */
export function workspacesFrom(declaredPackages) {
  return declaredPackages.map((pkg) => pkg.replace(/\/package\.json$/, ""));
}

/** Reads one target's recipe lines out of a Makefile's text. */
export function makeRecipeFor(makefileText, target) {
  const lines = makefileText.split(/\r?\n/);
  const start = lines.findIndex((line) => line.startsWith(`${target}:`));
  if (start === -1) return null;
  const recipe = [];
  for (const line of lines.slice(start + 1)) {
    if (line.startsWith("\t")) recipe.push(line);
    else if (line.trim().length > 0) break;
  }
  return recipe.join("\n");
}

/**
 * Asserts that every declared workspace is actually invoked by each covering
 * `make` target.
 *
 * The declared list alone is not enough: `make` reported green across "all four
 * workspaces" while never running `packages/security-audit-collector`, because
 * the count in the success message was a hand-maintained literal consistent with
 * the recipe rather than with the repository. An explicit list needs a
 * completeness assertion, or "add a package, forget the Makefile" fails silently.
 *
 * Coverage is read from the recipe's command lines alone. Reading the whole
 * recipe would let a workspace named in an `@echo` satisfy the check without ever
 * being run, which is #412 again: a target that stopped running a workspace but
 * still mentioned it would report coverage it does not have.
 */
export function assertMakefileCoverage(
  makefileText = null,
  declaredPackages = DECLARED_PACKAGES,
  targets = COVERING_MAKE_TARGETS,
) {
  const text = resolveMakefileText(makefileText);
  const workspaces = workspacesFrom(declaredPackages);
  const failures = [];

  for (const target of targets) {
    const recipe = makeRecipeFor(text, target);
    if (recipe === null) {
      failures.push(`[makefile-target-missing] Makefile declares no '${target}' target`);
      continue;
    }
    const commands = recipeCommandLines(recipe);
    const uncovered = workspaces.filter((workspace) => !commands.includes(workspace));
    if (uncovered.length > 0) {
      failures.push(
        `[makefile-workspace-uncovered] '${target}' does not run: ${uncovered.join(", ")}`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(`Makefile workspace coverage assertion failed:\n  ${failures.join("\n  ")}`);
  }

  return {
    targets: [...targets],
    workspaceCount: workspaces.length,
    message: `Makefile workspace coverage passed: ${targets.length} target(s) each run all ${workspaces.length} declared workspace(s)\n`,
  };
}

/**
 * The recipe lines that run something.
 *
 * A target's coverage is what it invokes. What it prints is a claim about that,
 * and the two must not be read from the same text.
 */
export function recipeCommandLines(recipe) {
  return recipe
    .split(/\r?\n/)
    .filter((line) => !/^\t\s*@?echo\b/.test(line))
    .join("\n");
}

/** The recipe lines that only print. A target's disclosure lives here. */
export function recipeMessageLines(recipe) {
  return recipe
    .split(/\r?\n/)
    .filter((line) => /^\t\s*@?echo\b/.test(line))
    .join("\n");
}

/** The message lines in which a target states what it did not run. */
export function recipeDisclosureLines(recipe) {
  return recipeMessageLines(recipe)
    .split(/\r?\n/)
    .filter((line) => line.includes("NOT run"))
    .join("\n");
}

/** Every rule target declared in a Makefile, in file order. */
export function makeTargetsIn(makefileText) {
  const targets = [];
  for (const line of makefileText.split(/\r?\n/)) {
    const match = /^([A-Za-z][A-Za-z0-9_-]*):(?!=)/.exec(line);
    if (match) targets.push(match[1]);
  }
  return targets;
}

/**
 * Asserts that a target running some but not all declared workspaces names every
 * workspace it did not run.
 *
 * The ratified requirement has always said a partial run must name what it
 * skipped. Nothing enforced it, so when `packages/security-audit-collector` was
 * added, all three partial targets went on describing a four-workspace
 * repository — the same silent staleness as #412, one file away from the
 * assertion that catches it.
 *
 * Targets that run no workspace claim no coverage and are skipped; targets that
 * run all of them are the covering case `assertMakefileCoverage` already holds.
 * Both directions fail closed: a workspace skipped but not named is a failure,
 * and so is a workspace named as skipped while the recipe actually runs it.
 */
export function assertPartialTargetDisclosure(
  makefileText = null,
  declaredPackages = DECLARED_PACKAGES,
) {
  const text = resolveMakefileText(makefileText);
  const workspaces = workspacesFrom(declaredPackages);
  const failures = [];
  const partialTargets = [];

  for (const target of makeTargetsIn(text)) {
    const recipe = makeRecipeFor(text, target);
    if (recipe === null) continue;

    const commands = recipeCommandLines(recipe);
    const invoked = workspaces.filter((workspace) => commands.includes(workspace));
    if (invoked.length === 0 || invoked.length === workspaces.length) continue;
    partialTargets.push(target);

    const disclosure = recipeDisclosureLines(recipe);
    const skipped = workspaces.filter((workspace) => !invoked.includes(workspace));
    const undisclosed = skipped.filter((workspace) => !disclosure.includes(workspace));
    const misreported = invoked.filter((workspace) => disclosure.includes(workspace));

    if (undisclosed.length > 0) {
      failures.push(
        `[makefile-skip-undisclosed] '${target}' does not run and does not say it skipped: ${undisclosed.join(", ")}`,
      );
    }
    if (misreported.length > 0) {
      failures.push(
        `[makefile-skip-misreported] '${target}' says it skipped a workspace it runs: ${misreported.join(", ")}`,
      );
    }
  }

  if (failures.length > 0) {
    throw new Error(
      `Makefile partial-run disclosure assertion failed:\n  ${failures.join("\n  ")}`,
    );
  }

  return {
    targets: partialTargets,
    workspaceCount: workspaces.length,
    message: `Makefile partial-run disclosure passed: ${partialTargets.length} partial target(s) name every workspace they skip\n`,
  };
}

/** A cost figure written out by hand rather than expanded from a variable. */
const HAND_TYPED_COST = /~\s*\d/;
/** The one place a cost figure may be written. */
const COST_VARIABLE_DEFINITION = /^COST_[A-Z0-9_]*\s*[:?+]?=/;

/**
 * Asserts that every cost figure in the Makefile expands from a single `COST_`
 * variable.
 *
 * `help` described `runtime-gates` as 26s while the target itself echoed 34s: one
 * file, one target, two costs, because the figure was written twice and only one
 * copy was ever updated. Defining each cost once makes that divergence impossible
 * rather than merely detectable, and this assertion keeps a hand-typed figure from
 * quietly reintroducing a second copy.
 */
export function assertCostFiguresAreVariables(makefileText = null) {
  const text = resolveMakefileText(makefileText);
  const offenders = [];

  text.split(/\r?\n/).forEach((line, index) => {
    if (COST_VARIABLE_DEFINITION.test(line)) return;
    if (HAND_TYPED_COST.test(line)) offenders.push(`line ${index + 1}: ${line.trim()}`);
  });

  if (offenders.length > 0) {
    throw new Error(
      `Makefile cost-figure assertion failed:\n  [makefile-cost-literal] a cost figure is written by hand instead of expanding from a COST_ variable, so two statements of one target's cost can diverge again:\n  ${offenders.join("\n  ")}`,
    );
  }

  return {
    message: "Makefile cost figures passed: every stated cost expands from a single COST_ variable\n",
  };
}

/** Scope entries that are deliberately not under a declared package. */
export const SONAR_SCOPE_EXCEPTIONS = Object.freeze([]);

/** Deliberately duplicated standalone-package gate scripts, excluded from CPD only. */
export const SONAR_CPD_EXCLUSIONS = Object.freeze(["packages/*/scripts/**"]);

/** Reads one `key=value` property out of a properties file's text. */
export function sonarPropertyFor(propertiesText, key) {
  for (const line of propertiesText.split(/\r?\n/)) {
    if (line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator === -1) continue;
    if (line.slice(0, separator).trim() !== key) continue;
    return line
      .slice(separator + 1)
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry.length > 0);
  }
  return null;
}

/**
 * Asserts that the required static-analysis gate looks at every declared
 * package.
 *
 * `sonar-project.properties` said in its own header that it "scans every
 * workspace" while omitting two of the five, and the header is why nobody
 * re-read the list: a file that declares itself complete does not invite
 * checking. The list is the same kind of hand-maintained set as the `make`
 * recipes, and it went stale the same way (#452).
 *
 * Fails closed in both directions. A declared package with no scope entry is a
 * failure. A scope entry under no declared package is also a failure — it means
 * either a workspace was removed and the list was not, or a path was mistyped
 * and has been silently analysing nothing. Deliberate non-package entries are
 * named in `SONAR_SCOPE_EXCEPTIONS`, so widening what the assertion tolerates is
 * a visible edit rather than an inference.
 */
export function assertSonarScopeCoversDeclaredPackages(
  propertiesText = null,
  declaredPackages = DECLARED_PACKAGES,
  exceptions = SONAR_SCOPE_EXCEPTIONS,
) {
  const text = propertiesText ?? readFileSync(resolve(repositoryRoot, "sonar-project.properties"), "utf8");
  const workspaces = workspacesFrom(declaredPackages);
  const sources = sonarPropertyFor(text, "sonar.sources");

  if (sources === null) {
    throw new Error(
      "Sonar analysis scope assertion failed:\n  [sonar-sources-absent] sonar-project.properties declares no sonar.sources",
    );
  }

  const failures = [
    ...uncoveredDiagnostics(workspaces, sources),
    ...strayDiagnostics(sources, workspaces, exceptions),
  ];
  if (failures.length > 0) {
    throw new Error(`Sonar analysis scope assertion failed:\n  ${failures.join("\n  ")}`);
  }

  return {
    workspaceCount: workspaces.length,
    entryCount: sources.length,
    message: `Sonar analysis scope passed: ${sources.length} scope entr(y|ies) covering all ${workspaces.length} declared package(s)\n`,
  };
}

/**
 * Keeps the intentional-duplication exception narrow and visible. Package
 * scripts remain in sonar.sources, so this does not suppress code findings.
 */
export function assertSonarCpdExclusions(
  propertiesText = null,
  expectedExclusions = SONAR_CPD_EXCLUSIONS,
) {
  const text = propertiesText ?? readFileSync(resolve(repositoryRoot, "sonar-project.properties"), "utf8");
  const exclusions = sonarPropertyFor(text, "sonar.cpd.exclusions");

  if (exclusions === null) {
    throw new Error(
      "Sonar CPD exclusion assertion failed:\n  [sonar-cpd-exclusions-absent] sonar-project.properties declares no sonar.cpd.exclusions",
    );
  }

  const missing = expectedExclusions.filter((entry) => !exclusions.includes(entry));
  const unexpected = exclusions.filter((entry) => !expectedExclusions.includes(entry));
  if (missing.length > 0 || unexpected.length > 0) {
    const diagnostics = [
      ...missing.map((entry) => `[sonar-cpd-exclusion-missing] required narrow exclusion absent: ${entry}`),
      ...unexpected.map((entry) => `[sonar-cpd-exclusion-unexpected] exclusion exceeds the approved package-script boundary: ${entry}`),
    ];
    throw new Error(`Sonar CPD exclusion assertion failed:\n  ${diagnostics.join("\n  ")}`);
  }

  return {
    exclusions,
    message: `Sonar CPD exclusions passed: ${exclusions.join(", ")} is the approved standalone-package boundary\n`,
  };
}

/** True when a scope entry is the workspace itself or a directory inside it. */
function scopeEntryIsInside(entry, workspace) {
  return entry === workspace || entry.startsWith(`${workspace}/`);
}

/** One diagnostic when any declared package has no scope entry, else none. */
function uncoveredDiagnostics(workspaces, sources) {
  const uncovered = workspaces.filter(
    (workspace) => !sources.some((entry) => scopeEntryIsInside(entry, workspace)),
  );
  if (uncovered.length === 0) return [];
  return [`[sonar-scope-uncovered] declared package(s) absent from sonar.sources: ${uncovered.join(", ")}`];
}

/** One diagnostic when any scope entry lies under no declared package, else none. */
function strayDiagnostics(sources, workspaces, exceptions) {
  const stray = sources.filter(
    (entry) =>
      !exceptions.includes(entry) &&
      !workspaces.some((workspace) => scopeEntryIsInside(entry, workspace)),
  );
  if (stray.length === 0) return [];
  return [
    `[sonar-scope-stray] sonar.sources entr(y|ies) under no declared package and not a recorded exception: ${stray.join(", ")}`,
  ];
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = assertPackageDiscovery();
    process.stdout.write(result.message);
    process.stdout.write(assertMakefileCoverage().message);
    process.stdout.write(assertPartialTargetDisclosure().message);
    process.stdout.write(assertCostFiguresAreVariables().message);
    process.stdout.write(assertSonarScopeCoversDeclaredPackages().message);
    process.stdout.write(assertSonarCpdExclusions().message);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
