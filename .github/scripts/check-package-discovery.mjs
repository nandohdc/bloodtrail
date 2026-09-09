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
 */
export function assertMakefileCoverage(
  makefileText = null,
  declaredPackages = DECLARED_PACKAGES,
  targets = COVERING_MAKE_TARGETS,
) {
  const text = makefileText ?? readFileSync(resolve(repositoryRoot, "Makefile"), "utf8");
  const workspaces = declaredPackages.map((pkg) => pkg.replace(/\/package\.json$/, ""));
  const failures = [];

  for (const target of targets) {
    const recipe = makeRecipeFor(text, target);
    if (recipe === null) {
      failures.push(`[makefile-target-missing] Makefile declares no '${target}' target`);
      continue;
    }
    const uncovered = workspaces.filter((workspace) => !recipe.includes(workspace));
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = assertPackageDiscovery();
    process.stdout.write(result.message);
    process.stdout.write(assertMakefileCoverage().message);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
