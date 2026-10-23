// Injected time for Stage 2 probe processes.
//
// - syntheticClock: the SDK's AuditClock. Event times are ground truth, so they advance by a fixed step
//   from a frozen start rather than following the wall clock.
// - timerGate + gatedTimers: the AuditTimerProvider handed to bounded retry. A scheduled delay fires
//   only after its real delay elapses AND the gate is open, so a restart the orchestrator performs on
//   onAttemptScheduled completes before the retry it was timed against (no wall-clock race).
import assert from "node:assert/strict";
import { seededRandom } from "./workload.mjs";

export function syntheticClock({ start, stepMs }) {
  let current = Date.parse(start);
  assert(Number.isFinite(current), "synthetic clock start must be an ISO timestamp");
  assert(Number.isSafeInteger(stepMs) && stepMs > 0, "synthetic clock step must be a positive integer");
  return {
    now() {
      const value = new Date(current);
      current += stepMs;
      return value;
    },
  };
}

export function timerGate() {
  let release = null;
  let pending = null;
  return {
    close() {
      if (pending === null) pending = new Promise((resolveGate) => { release = resolveGate; });
    },
    open() {
      if (release !== null) release();
      release = null;
      pending = null;
    },
    whenOpen() {
      return pending ?? Promise.resolve();
    },
  };
}

export function gatedTimers({ gate, base = globalThis }) {
  return {
    setTimeout(callback, ms) {
      const handle = { cleared: false, timer: null };
      handle.timer = base.setTimeout(() => {
        gate.whenOpen().then(() => {
          if (!handle.cleared) callback();
        });
      }, ms);
      return handle;
    },
    clearTimeout(handle) {
      handle.cleared = true;
      base.clearTimeout(handle.timer);
    },
  };
}

// A fixed, seeded jitter source for bounded retry, on the workload's 32-bit generator: the same seed draws
// the same sequence of values in [0, 1). Draws follow call order across every occurrence the retry
// handles, so a given occurrence's delays repeat only when retries are scheduled in the same order, as
// they always are for a single occurrence.
export function seededJitter(seed) {
  assert(Number.isSafeInteger(seed) && seed > 0, "jitter seed must be a positive integer");
  return seededRandom(seed);
}
