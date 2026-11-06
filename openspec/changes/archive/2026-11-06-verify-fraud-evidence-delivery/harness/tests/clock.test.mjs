import assert from "node:assert/strict";
import { setTimeout as sleep } from "node:timers/promises";
import { test } from "node:test";
import { gatedTimers, seededJitter, syntheticClock, timerGate } from "../lib/clock.mjs";

test("the synthetic clock steps from its frozen start", () => {
  const clock = syntheticClock({ start: "2026-10-23T00:00:00.000Z", stepMs: 1000 });
  assert.deepEqual([clock.now(), clock.now()].map((date) => date.toISOString()), ["2026-10-23T00:00:00.000Z", "2026-10-23T00:00:01.000Z"]);
  assert.throws(() => syntheticClock({ start: "not a time", stepMs: 1 }));
});

test("a gated timer fires only after its delay elapses and the gate opens", async () => {
  const gate = timerGate();
  const timers = gatedTimers({ gate });
  let fired = false;
  gate.close();
  timers.setTimeout(() => { fired = true; }, 5);
  await sleep(30);
  assert.equal(fired, false, "a closed gate holds the timer");
  gate.open();
  await sleep(5);
  assert.equal(fired, true);
});

test("a cleared gated timer never fires", async () => {
  const timers = gatedTimers({ gate: timerGate() });
  let fired = false;
  const handle = timers.setTimeout(() => { fired = true; }, 5);
  timers.clearTimeout(handle);
  await sleep(30);
  assert.equal(fired, false);
});

test("seeded jitter is deterministic and in [0, 1)", () => {
  const values = (seed) => Array.from({ length: 5 }, seededJitter(seed));
  assert.deepEqual(values(836), values(836));
  assert.notDeepEqual(values(836), values(837));
  for (const value of values(836)) assert(value >= 0 && value < 1);
});

test("seeded jitter does not fall into a short cycle over a volume run's draws", () => {
  const draw = seededJitter(836);
  const values = new Set(Array.from({ length: 50_000 }, draw));
  assert(values.size > 49_000, `only ${values.size} distinct draws`);
});
