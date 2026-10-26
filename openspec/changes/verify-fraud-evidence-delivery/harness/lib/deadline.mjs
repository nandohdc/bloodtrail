// S2 stop condition: a run that exceeds its frozen deadline is halted, its role processes are killed, and
// the run reports the stop instead of continuing.
import assert from "node:assert/strict";

export class StopCondition extends Error {
  constructor(condition, detail) {
    super(`S2 stop (${condition}): ${detail}`);
    this.name = "StopCondition";
    this.condition = condition;
  }
}

export async function withDeadline({ ms, work, onTimeout, timers = globalThis }) {
  assert(Number.isSafeInteger(ms) && ms > 0, "deadline must be a positive integer of milliseconds");
  let timer;
  const expired = new Promise((_, reject) => {
    timer = timers.setTimeout(() => {
      const failure = new StopCondition("deadline", `run exceeded ${ms} ms`);
      try {
        onTimeout();
      } catch (error) {
        failure.halt_error = error.message;
        failure.role_closure_confirmed = false;
      }
      reject(failure);
    }, ms);
  });
  try {
    return await Promise.race([work(), expired]);
  } finally {
    timers.clearTimeout(timer);
  }
}
