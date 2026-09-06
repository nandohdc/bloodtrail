#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const repositoryRoot = resolve(__dirname, "../..");

export const DECLARED_PACKAGES = Object.freeze([
  "contracts/security-audit/package.json",
  "packages/security-audit-sdk-core/package.json",
  "packages/security-audit-sdk-node/package.json",
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = assertPackageDiscovery();
    process.stdout.write(result.message);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
