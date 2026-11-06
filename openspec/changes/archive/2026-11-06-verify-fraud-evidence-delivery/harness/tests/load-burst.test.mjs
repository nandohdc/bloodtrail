import assert from "node:assert/strict";
import { test } from "node:test";
import { emitBurst } from "../load/burst.mjs";

test("a pre-sink refusal cannot strand another call behind the held retry gate", async () => {
  let release;
  let shutdown = false;
  let ordinal = 0;
  const composition = {
    callbacks: { admitted: [], rejected_overload: [], scheduled: [] }, deliveries: new Map(), shutdownTiming: { primitive_elapsed_ms: 0 },
    async shutdown() { shutdown = true; return { accepted: 1, completed: 0, abandoned: 1 }; },
    releaseRetries() { assert.equal(shutdown, true); release(); },
  };
  const call = async () => {
    if (++ordinal === 1) return { ok: false, error: { code: "fixture_before_sink" } };
    composition.deliveries.set("admitted", { status: "pending" });
    composition.callbacks.admitted.push([1, 1]);
    composition.callbacks.scheduled.push([1, 1]);
    await new Promise((resolveCall) => { release = resolveCall; });
    return { ok: true };
  };
  const result = await emitBurst({ composition, phase: { occurrences: 2, shutdown: "after_retry_scheduled", after_shutdown: 0 }, call });
  assert.equal(result.calls.length, 2);
  assert.equal(result.calls[0].error.code, "fixture_before_sink");
  assert.deepEqual(result.shutdown_report, { accepted: 1, completed: 0, abandoned: 1 });
});
