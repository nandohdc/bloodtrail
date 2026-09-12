## Context & Architectural Seam

In `packages/security-audit-sdk-core/tests/verification/`, four test files test that mutation guards fail closed:
- `f07-mutations.test.mjs`
- `f08-mutations.test.mjs`
- `f10-mutations.test.mjs`
- `f11-mutations.test.mjs`

Each test sets up an isolated clone of the package in a temp directory, applies a source mutation, builds the package (`npm run build`), compiles the test suite (`tsc -p tsconfig.test.json`), and executes the specific guard test to assert it rejects the mutation.

Before this change, each of the four files duplicated identical `spawnSync` calls and assertions:
```js
const build = spawnSync("npm", ["run", "build"], { cwd: root, encoding: "utf8", timeout: 60_000 });
assert.equal(build.status, 0, `${mutation.name} did not build:\n${build.stdout}\n${build.stderr}`);
const compile = spawnSync(process.execPath, [resolve(packageRoot, "node_modules/typescript/bin/tsc"), "-p", "tsconfig.test.json"], {
  cwd: root,
  encoding: "utf8",
  timeout: 60_000,
});
assert.equal(compile.status, 0, `${mutation.name} tests did not compile:\n${compile.stdout}\n${compile.stderr}`);
```

### Defects Addressed

1. **Diagnostic Misattribution**:
   When `spawnSync` reaches its timeout or child termination signal, Node sets:
   - `result.status = null`
   - `result.signal = "SIGTERM"`
   - `result.error = Error: spawnSync ... [ETIMEDOUT]` (with `code: "ETIMEDOUT"`)
   The assertion `assert.equal(build.status, 0, "did not build")` produces `AssertionError: actual: null, expected: 0` with the message claiming the mutation "did not build". This sends investigators searching for compilation or schema defects in valid code.

2. **Hand-Coded Magic Constant**:
   `timeout: 60_000` is hardcoded 15 times without recorded derivation. On a 2-CPU cgroup runner (#306) under concurrent test execution, `npm run build` can exceed 60s (observed at 63.9s and 76.5s).

3. **Code Duplication**:
   The exact build-and-compile sequence is duplicated across four files, flagged by Copy/Paste Detectors (CPD).

## Technical Design

### 1. `mutation-build.mjs` Helper Module

A new module in `packages/security-audit-sdk-core/tests/verification/mutation-build.mjs`:

```javascript
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { performance } from "node:perf_hooks";
import { packageRoot } from "../../scripts/verification-helpers.mjs";

export const MUTATION_TIMEOUT_MS = Number.parseInt(process.env.MUTATION_TIMEOUT_MS ?? "180000", 10);

export function assertSubprocessSuccess(result, { name, step, elapsedMs, timeoutMs }) {
  if (result.error?.code === "ETIMEDOUT" || (result.status === null && result.signal)) {
    const signalStr = result.signal ? `killed by ${result.signal}` : "timed out";
    const elapsedStr = elapsedMs !== undefined ? ` after ${elapsedMs}ms` : "";
    const timeoutStr = timeoutMs !== undefined ? ` (configured timeout: ${timeoutMs}ms)` : "";
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

export function runMutationStep(name, step, command, args, { cwd, timeout = MUTATION_TIMEOUT_MS, env }) {
  const start = performance.now();
  const result = spawnSync(command, args, { cwd, encoding: "utf8", timeout, env });
  const elapsedMs = Math.round(performance.now() - start);
  assertSubprocessSuccess(result, { name, step, elapsedMs, timeoutMs: timeout });
  return result;
}

export function buildAndCompileMutation(root, mutationName, { timeout = MUTATION_TIMEOUT_MS } = {}) {
  runMutationStep(mutationName, "build", "npm", ["run", "build"], { cwd: root, timeout });
  const tscPath = resolve(packageRoot, "node_modules/typescript/bin/tsc");
  runMutationStep(mutationName, "test compilation", process.execPath, [tscPath, "-p", "tsconfig.test.json"], { cwd: root, timeout });
}
```

### 2. Timeout Derivation & Basis

- **Baseline measurement**:
  - `npm run build` clean build on warm hardware: ~2.5s.
  - `tsc -p tsconfig.test.json` on warm hardware: ~2.3s.
  - Combined baseline: ~4.8s.
- **CI load multiplier**:
  - Verification tests run concurrently via `node --test`.
  - Runners operate on a 2-CPU cgroup (#306). Under peak test parallelism, 4+ concurrent TypeScript compilations compete for 2 vCPUs.
  - `authority-scope.test.mjs:352` already uses `timeout: 180_000` (180s / 3 min) for its fixture build.
  - 180,000ms provides ~35x margin over baseline, sufficient to prevent spurious runner timeouts while strictly bounding runaway builds.
  - Configurable via `MUTATION_TIMEOUT_MS` environment variable.

### 3. Retry Policy Decision: NO RETRY

**Alternatives Compared**:
- **Option A: Retry once on timeout.**
  - *Trade-off*: Retrying on timeout could mask a transient CPU spike, but doubles the worst-case makespan of a failing test (e.g. 180s → 360s), worsening runner contention for all other jobs. More critically, retry hides mutations that introduce quadratic or pathological compiler slowdowns.
- **Option B: No retry (Fail Fast with Clear Diagnostic).**
  - *Rationale*: A timeout diagnostic clearly names the duration, signal, and cgroup context (#306). It makes flaky slowdowns immediately observable and preserves predictable suite execution times.
  - *Decision*: **Option B (NO RETRY)** is selected.

### 4. Verification Controls

A dedicated test suite `tests/verification/mutation-build-diagnostics.test.mjs` verifies:
1. `assertSubprocessSuccess` fails with a timeout message containing signal, duration, and cgroup reference when given an `ETIMEDOUT` error or `status: null` with `signal`. The message does NOT contain "failed with exit code" or "did not build".
2. `assertSubprocessSuccess` fails with exit code and compiler output when given `status: 1` or `status: 2`. The message does NOT mention timeout.
3. `assertSubprocessSuccess` passes when given `status: 0`.
4. `runMutationStep` properly times out and surfaces the diagnostic against a synthetic long-running child process.
