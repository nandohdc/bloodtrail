import assert from "node:assert/strict";
import test from "node:test";
import {
  MUTATION_TIMEOUT_MS,
  assertSubprocessSuccess,
  runMutationStep,
} from "./mutation-build.mjs";

test("MUTATION_TIMEOUT_MS has documented 180s basis", () => {
  assert.equal(typeof MUTATION_TIMEOUT_MS, "number");
  assert.ok(MUTATION_TIMEOUT_MS >= 60_000, "timeout should be >= 60s baseline");
});

test("assertSubprocessSuccess distinguishes timeout from compile failure (simulated timeout)", () => {
  const timedOutResult = {
    status: null,
    signal: "SIGTERM",
    error: Object.assign(new Error("timed out"), { code: "ETIMEDOUT" }),
    stdout: "generated contract written\n",
    stderr: "",
  };

  assert.throws(
    () =>
      assertSubprocessSuccess(timedOutResult, {
        name: "M-F08-E",
        step: "build",
        elapsedMs: 63922,
        timeoutMs: 60000,
      }),
    (error) => {
      assert.ok(error instanceof Error, "should throw an Error");
      const message = error.message;
      assert.match(message, /M-F08-E build timed out \(killed by SIGTERM after 63922ms, configured timeout: 60000ms\)/);
      assert.match(message, /#306/);
      assert.doesNotMatch(message, /did not build/);
      assert.doesNotMatch(message, /failed with exit code/);
      return true;
    }
  );
});

test("assertSubprocessSuccess distinguishes signal termination without ETIMEDOUT code", () => {
  const signalKilledResult = {
    status: null,
    signal: "SIGKILL",
    stdout: "",
    stderr: "killed by host\n",
  };

  assert.throws(
    () =>
      assertSubprocessSuccess(signalKilledResult, {
        name: "M-F10-A",
        step: "test compilation",
        elapsedMs: 75000,
        timeoutMs: 60000,
      }),
    (error) => {
      const message = error.message;
      assert.match(message, /M-F10-A test compilation timed out \(killed by SIGKILL after 75000ms, configured timeout: 60000ms\)/);
      assert.doesNotMatch(message, /tests did not compile/);
      assert.doesNotMatch(message, /failed with exit code/);
      return true;
    }
  );
});

test("assertSubprocessSuccess preserves genuine compiler exit failure and output", () => {
  const compilerFailureResult = {
    status: 2,
    signal: null,
    stdout: "src/sdk.ts(45,7): error TS2345: Argument of type 'string' is not assignable to 'number'.\n",
    stderr: "",
  };

  assert.throws(
    () =>
      assertSubprocessSuccess(compilerFailureResult, {
        name: "M-F07-A",
        step: "build",
        elapsedMs: 2300,
        timeoutMs: 60000,
      }),
    (error) => {
      const message = error.message;
      assert.match(message, /M-F07-A build failed with exit code 2:/);
      assert.match(message, /error TS2345/);
      assert.doesNotMatch(message, /timed out/);
      assert.doesNotMatch(message, /killed by/);
      return true;
    }
  );
});

test("assertSubprocessSuccess passes on clean zero exit status", () => {
  const successResult = {
    status: 0,
    signal: null,
    stdout: "Build complete\n",
    stderr: "",
  };

  assert.doesNotThrow(() =>
    assertSubprocessSuccess(successResult, {
      name: "M-F11-A",
      step: "build",
      elapsedMs: 1500,
      timeoutMs: 60000,
    })
  );
});

test("runMutationStep correctly reports timeout on real child process execution", () => {
  assert.throws(
    () =>
      runMutationStep({
        name: "M-REAL-TIMEOUT",
        step: "sleep step",
        command: process.execPath,
        args: ["-e", "setTimeout(() => {}, 10000)"],
        timeout: 150,
      }),
    (error) => {
      const message = error.message;
      assert.match(message, /M-REAL-TIMEOUT sleep step timed out \(killed by SIGTERM/);
      assert.match(message, /#306/);
      assert.doesNotMatch(message, /did not build/);
      assert.doesNotMatch(message, /failed with exit code/);
      return true;
    }
  );
});

test("runMutationStep correctly reports non-zero exit code on real child process execution", () => {
  assert.throws(
    () =>
      runMutationStep({
        name: "M-REAL-FAIL",
        step: "compile step",
        command: process.execPath,
        args: ["-e", "console.error('simulated tsc failure'); process.exit(1)"],
        timeout: 5000,
      }),
    (error) => {
      const message = error.message;
      assert.match(message, /M-REAL-FAIL compile step failed with exit code 1:/);
      assert.match(message, /simulated tsc failure/);
      assert.doesNotMatch(message, /timed out/);
      return true;
    }
  );
});
