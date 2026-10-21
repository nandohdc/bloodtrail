import assert from "node:assert/strict";
import test from "node:test";
import { parking, withTimeout } from "../p-e/parking.mjs";

test("parking creates the promise and release together, before any parked work starts", () => {
  const gate = parking();
  assert.equal(typeof gate.release, "function");
  assert.equal(typeof gate.promise.then, "function");
  assert.equal(gate.released, false);
});

test("release precedes every exchange entry and the parked delivery completes exactly once", async () => {
  const gate = parking();
  const entries = [];
  const delivery = (async () => {
    await gate.promise;
    entries.push("exchange");
    return "delivered";
  })();
  await Promise.resolve();
  assert.deepEqual(entries, []);
  assert.equal(gate.release(), true);
  assert.equal(await withTimeout(delivery, { ms: 1000 }), "delivered");
  assert.deepEqual(entries, ["exchange"]);
});

test("normal park and release keeps work blocked until the explicit release", async () => {
  const gate = parking();
  let reached = false;
  const work = (async () => {
    await gate.promise;
    reached = true;
  })();
  await Promise.resolve();
  assert.equal(reached, false);
  gate.release();
  await withTimeout(work, { ms: 1000 });
  assert.equal(reached, true);
});

test("duplicate release is idempotent and never throws", async () => {
  const gate = parking();
  const work = (async () => {
    await gate.promise;
    return "done";
  })();
  assert.equal(gate.release(), true);
  assert.equal(gate.release(), false);
  assert.equal(gate.release(), false);
  assert.equal(await withTimeout(work, { ms: 1000 }), "done");
});

test("rejected parked work propagates its rejection and release stays idempotent", async () => {
  const gate = parking();
  const fault = new Error("pe-parked-rejection");
  const work = (async () => {
    await gate.promise;
    throw fault;
  })();
  assert.equal(gate.release(), true);
  await assert.rejects(withTimeout(work, { ms: 1000 }), (error) => error === fault);
  assert.equal(gate.release(), false);
  assert.equal(gate.released, true);
});

test("bounded timeout detects a hang without deciding any case ordering", async () => {
  const never = new Promise(() => {});
  await assert.rejects(withTimeout(never, { ms: 25, label: "hang fixture" }), /hang fixture exceeded 25ms/);
  assert.equal(await withTimeout(Promise.resolve("settled"), { ms: 1000 }), "settled");
});
