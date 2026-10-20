import assert from "node:assert/strict";
import test from "node:test";
import { runCases, stepRecord } from "./p-e-redelivery-fixtures.mjs";

// Independent per-attempt oracle from delivery-classes.ts:273-286,320-326,
// 342-356 at abcbefa: throw/false probe stops before gate; a declined/throwing
// gate stops before exchange; a settled key skips all three. Handoff exchange
// throw/timeout is caught at http-handoff.ts:108-113, NOT a callback exception
// contained by the binding. #811 does not change either transaction callback.
const ORACLE = [
  { id: "P-E-5", steps: ["initial", "redeliver-1", "redeliver-2", "settle"], order: ["probe", "gate", "exchange"] },
  { id: "P-E-5", steps: ["extra"], order: [] },
  { id: "P-E-7", steps: ["b1-deliver", "b2-deliver"], order: ["probe", "gate", "exchange"] },
  { id: "P-E-7", steps: ["b1-again"], order: [] },
  { id: "P-E-8", steps: ["deliver", "redeliver", "variant-2xx", "variant-3xx"], order: ["probe", "gate", "exchange"] },
  { id: "P-E-x1", steps: ["gate/throw"], order: ["probe", "gate"] },
  { id: "P-E-x1", steps: ["probe/throw"], order: ["probe"] },
  { id: "P-E-x1", steps: ["gate/retry", "probe/retry"], order: ["probe", "gate", "exchange"] },
  { id: "P-E-2c", steps: ["probe-false/first"], order: ["probe"] },
  { id: "P-E-2c", steps: ["gate-declined/first"], order: ["probe", "gate"] },
  { id: "P-E-2c", steps: ["probe-false/second", "gate-declined/second"], order: ["probe", "gate", "exchange"] },
  { id: "P-E-x2", steps: ["gate-failed", "gate-undefined", "probe-one", "probe-string"], order: ["probe", "gate", "exchange"] },
  { id: "P-E-x2", steps: ["falsy-zero", "falsy-empty", "falsy-undefined"], order: ["probe"] },
  { id: "P-E-x3", steps: ["throw", "throw-redeliver", "timeout", "timeout-redeliver"], order: ["probe", "gate", "exchange"] },
];

test("P-E retry/fault callback ordering matches each source-derived pipeline branch", async () => {
  const { state } = await runCases([...new Set(ORACLE.map((row) => row.id))]);
  for (const row of ORACLE) {
    for (const id of row.steps) {
      const record = stepRecord(state, row.id, id);
      assert.deepEqual(record.callback_order, row.order, record.step_id);
      assert.equal(record.exchange_attempts.length, row.order.filter((name) => name === "exchange").length);
    }
  }
});
