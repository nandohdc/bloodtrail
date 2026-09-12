## Why

In `packages/security-audit-sdk-core/tests/verification/`, four mutation suites (`f07-mutations.test.mjs`, `f08-mutations.test.mjs`, `f10-mutations.test.mjs`, and `f11-mutations.test.mjs`) build and compile package clones under disposable mutation before evaluating whether test guards fail closed. Each suite independently runs:

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

When a mutation build is killed by its timeout, `spawnSync` sets `status: null`, `signal: "SIGTERM"`, and `error.code: "ETIMEDOUT"`. The existing assertion fails with `null !== 0` and produces:

```
AssertionError [ERR_ASSERTION]: M-F11-F ... did not build:
...
null !== 0
```

This diagnostic misrepresents the failure:
1. It claims the code "did not build", masquerading as a compilation error when the code under test is defect-free.
2. It omits the signal and elapsed duration.
3. The build output terminates abruptly mid-compile (e.g. after contract generation), leaving the reader to deduce an undocumented `spawnSync` behavior to recognize a timeout.

Furthermore, `timeout: 60_000` is an uncalibrated literal repeated across four files. Baseline build and test compilation takes ~4.8s on developer hardware, but under CI runner load where multiple test processes run concurrently on a 2-CPU cgroup (#306), peak contention causes build durations to exceed 60s (measured at 63.9s in run 34525095093 and 76.5s in run 34666987341 on documentation-only changes).

## What Changes

1. **Extract shared subprocess assertion and execution helper**:
   - Introduce `packages/security-audit-sdk-core/tests/verification/mutation-build.mjs`.
   - Provide `assertSubprocessSuccess(result, { name, step, elapsedMs, timeoutMs })`:
     - When `result.error?.code === "ETIMEDOUT"` or `result.status === null && result.signal`: fails with a clear timeout diagnostic identifying the signal, elapsed time, and runner cgroup contention context (#306), and explicitly avoids asserting "did not build" or "tests did not compile".
     - When `result.status !== 0`: fails with the non-zero exit code and captured compiler stdout/stderr.
   - Provide `buildAndCompileMutation(root, mutationName, options)` to execute both build and test compilation in a single, deduplicated helper call.

2. **Deduplicate assertion call sites**:
   - Refactor `f07-mutations.test.mjs`, `f08-mutations.test.mjs`, `f10-mutations.test.mjs`, and `f11-mutations.test.mjs` to use `buildAndCompileMutation`. This eliminates the duplicated copy-pasted blocks reported by CPD.

3. **Derive and calibrate the timeout baseline**:
   - Establish `MUTATION_TIMEOUT_MS`: calibrated from baseline measurements (~4.8s baseline * ~35x load margin = 180,000ms / 3 minutes), matching the proven threshold already established in `authority-scope.test.mjs:352`.
   - Allow configuration via `process.env.MUTATION_TIMEOUT_MS`.

4. **Explicit retry policy decision (NO RETRY)**:
   - Explicitly record the decision not to retry timed-out mutation builds. Retrying doubles the worst-case makespan on an already constrained 2-CPU runner and masks mutations that introduce pathological compilation slowdowns. Failing fast with an honest, unambiguous diagnostic is the correct fail-fast posture.

5. **Mechanical control tests**:
   - Add `packages/security-audit-sdk-core/tests/verification/mutation-build-diagnostics.test.mjs` proving that:
     - A timed-out process fails with the timeout diagnostic and signal, not "did not build".
     - A non-zero exit code process fails with the compiler output and exit status, without mentioning timeout.
     - Successful processes pass cleanly without assertion errors.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change refines internal verification test harness diagnostics and eliminates duplication across verification suites without modifying canonical specifications or public contracts. The change declares `skip_specs: true`.

## Impact

- `packages/security-audit-sdk-core/tests/verification/mutation-build.mjs`: New shared helper.
- `packages/security-audit-sdk-core/tests/verification/mutation-build-diagnostics.test.mjs`: New verification controls.
- `packages/security-audit-sdk-core/tests/verification/f07-mutations.test.mjs`: Refactored to use helper.
- `packages/security-audit-sdk-core/tests/verification/f08-mutations.test.mjs`: Refactored to use helper.
- `packages/security-audit-sdk-core/tests/verification/f10-mutations.test.mjs`: Refactored to use helper.
- `packages/security-audit-sdk-core/tests/verification/f11-mutations.test.mjs`: Refactored to use helper.

No public APIs, dependencies, runtime behavior, or contract schemas are modified.
