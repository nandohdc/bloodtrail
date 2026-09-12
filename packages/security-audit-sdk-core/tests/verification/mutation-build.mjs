import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { packageRoot } from "../../scripts/verification-helpers.mjs";

/**
 * Timeout derivation and basis:
 * Baseline measurement: on warm developer hardware (Apple Silicon / modern Linux), `npm run build`
 * takes ~2.5s and `tsc -p tsconfig.test.json` takes ~2.3s (~4.8s total).
 *
 * Under GitHub Actions CI runners with a 2-CPU cgroup allocation (#306) running multiple
 * verification tests concurrently under `node --test`, build times experience severe contention
 * (measured up to 4.8x-15x variance, e.g. 76.5s in run 34666987341).
 *
 * 180_000ms (180s / 3 minutes) provides ~35x margin over baseline, matching the proven threshold
 * in `authority-scope.test.mjs:352`, while keeping runaway processes strictly bounded.
 *
 * Configurable via `MUTATION_TIMEOUT_MS` environment variable.
 */
export const MUTATION_TIMEOUT_MS = Number.parseInt(process.env.MUTATION_TIMEOUT_MS ?? "180000", 10);

/**
 * Retry policy decision: NO RETRY.
 * Retrying a timed-out mutation hides mutations that introduce pathological compilation or build
 * slowdowns, and doubling the build timeout on a saturated 2-CPU runner compounds runner starvation.
 * Instead, fail fast with an unambiguous diagnostic distinguishing timeout from build failure (#464).
 */

/**
 * Asserts that a subprocess result completed successfully.
 * Distinguishes timeouts/signals from legitimate compiler non-zero exit failures.
 */
export function assertSubprocessSuccess(result, { name, step, elapsedMs, timeoutMs }) {
  if (result.error?.code === "ETIMEDOUT" || (result.status === null && Boolean(result.signal))) {
    const signalStr = result.signal ? `killed by ${result.signal}` : "timed out";
    const elapsedStr = elapsedMs !== undefined ? ` after ${elapsedMs}ms` : "";
    const timeoutStr = timeoutMs !== undefined ? `, configured timeout: ${timeoutMs}ms` : "";
    assert.fail(
      `${name} ${step} timed out (${signalStr}${elapsedStr}${timeoutStr}); ` +
      `most likely runner cgroup pressure (#306), not a defect:\n` +
      `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    );
  }
  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0) {
    assert.fail(
      `${name} ${step} failed with exit code ${result.status}:\n` +
      `${result.stdout ?? ""}\n${result.stderr ?? ""}`
    );
  }
}

/**
 * Executes a mutation subprocess step (e.g. build or test compilation) and asserts success.
 */
export function runMutationStep(name, step, command, args, { cwd, timeout = MUTATION_TIMEOUT_MS, env }) {
  const start = performance.now();
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout, env });
  const elapsedMs = Math.round(performance.now() - start);
  assertSubprocessSuccess(result, { name, step, elapsedMs, timeoutMs: timeout });
  return result;
}

/**
 * Executes standard mutation build and test compilation in target root.
 */
export function buildAndCompileMutation(root, mutationName, { timeout = MUTATION_TIMEOUT_MS } = {}) {
  runMutationStep(mutationName, "build", "npm", ["run", "build"], { cwd: root, timeout });
  const tscPath = resolve(packageRoot, "node_modules/typescript/bin/tsc");
  runMutationStep(mutationName, "test compilation", process.execPath, [tscPath, "-p", "tsconfig.test.json"], { cwd: root, timeout });
}
