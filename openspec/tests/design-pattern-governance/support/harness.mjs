/**
 * Running the checker and asserting on what it says.
 *
 * Assertions here demand a **specific diagnostic identifier**, never merely a
 * non-zero exit. A mutation test that accepts any failure passes when the checker
 * breaks for an unrelated reason, which is how a control quietly stops testing
 * the thing it was written for.
 */

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";

import { checkerPath } from "./disposable-repo.mjs";

export function runChecker(repository, options = {}) {
  const script = options.checker ?? checkerPath;
  const args = [script, "--repo-root", repository.root, "--json", "--phase", options.phase ?? "final"];
  if (options.change) args.push("--change", options.change);
  if (options.base) args.push("--base", options.base);
  if (options.policy) args.push("--policy", options.policy);

  const run = spawnSync(process.execPath, args, { encoding: "utf8", cwd: repository.root });
  let report = null;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    report = null;
  }
  return {
    status: run.status,
    stdout: run.stdout,
    stderr: run.stderr,
    report,
    ids: report ? report.failures.map((entry) => entry.id) : [],
    warningIds: report ? report.warnings.map((entry) => entry.id) : [],
  };
}

export function assertDiagnostic(result, expectedId, context = "") {
  const suffix = context ? ` (${context})` : "";
  assert.ok(
    result.ids.includes(expectedId),
    `expected diagnostic "${expectedId}"${suffix}, got [${result.ids.join(", ") || "none"}]`
    + `${result.report ? "" : `\nchecker produced no JSON report; stderr:\n${result.stderr}`}`,
  );
  assert.notEqual(result.status, 0, `expected a non-zero exit alongside "${expectedId}"${suffix}`);
}

export function assertWarning(result, expectedId, context = "") {
  const suffix = context ? ` (${context})` : "";
  assert.ok(
    result.warningIds.includes(expectedId),
    `expected warning "${expectedId}"${suffix}, got [${result.warningIds.join(", ") || "none"}]`,
  );
}

export function assertPasses(result, context = "") {
  const suffix = context ? ` (${context})` : "";
  assert.equal(
    result.status, 0,
    `expected the checker to pass${suffix}, got [${result.ids.join(", ") || "no ids"}]\nstderr:\n${result.stderr}`,
  );
}

export function assertNoDiagnostic(result, unexpectedId, context = "") {
  const suffix = context ? ` (${context})` : "";
  assert.ok(
    !result.ids.includes(unexpectedId),
    `did not expect diagnostic "${unexpectedId}"${suffix}, got [${result.ids.join(", ")}]`,
  );
}

export const POLICY_PATH = "openspec/governance/design-pattern-policy.json";
export const ASSESSMENT_PATH = "openspec/changes/establish-design-pattern-governance/assessment.json";
export const CATALOG_PATH = "openspec/governance/design-pattern-catalog.md";
export const REGISTRY_PATH = "openspec/governance/invariant-registry.json";
