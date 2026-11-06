import assert from "node:assert/strict";
import { test } from "node:test";
import { BUCKETS, accountFor, bucketFor, delayIdentity } from "../lib/accounting.mjs";

const IDS = ["e1", "e2", "e3", "e4", "e5"];
const DELIVERIES = new Map([["e1", "acknowledged"], ["e2", "exhausted"], ["e3", "rejected_overload"], ["e4", "abandoned"], ["e5", "acknowledged"]]);

test("buckets are assigned in priority order, persisted first", () => {
  const rows = [
    [{ persisted: true, delivery: "exhausted" }, "persisted"],
    [{ persisted: false, delivery: "non_retryable" }, "reported_undelivered"],
    [{ persisted: false, delivery: "protocol_error" }, "reported_undelivered"],
    [{ persisted: false, delivery: "rejected_shutting_down" }, "admission_signal"],
    [{ persisted: false, delivery: "abandoned" }, "abandoned"],
    [{ persisted: false, delivery: "acknowledged" }, "unexplained"],
    [{ persisted: false, delivery: undefined }, "unexplained"],
  ];
  for (const [input, bucket] of rows) assert.equal(bucketFor(input), bucket, JSON.stringify(input));
});

test("null control: every occurrence lands in exactly one bucket and the identity holds", () => {
  const result = accountFor({ planned: IDS.length, generated: IDS, deliveries: DELIVERIES, persisted: new Set(["e1", "e5"]) });
  assert.deepEqual(result.counts, { persisted: 2, reported_undelivered: 1, admission_signal: 1, abandoned: 1, unexplained: 0 });
  assert.equal(result.total, IDS.length);
  assert.equal(result.missing, 0);
  assert.equal(result.holds, true);
});

test("planted defect: a silently dropped occurrence breaks the identity", () => {
  const result = accountFor({ planned: IDS.length, generated: IDS, deliveries: DELIVERIES, persisted: new Set(["e1"]) });
  assert.deepEqual(result.unexplained, ["e5"]);
  assert.equal(result.holds, false);
});

test("planted defect: an occurrence lost before the sink is unexplained, not absent from the denominator", () => {
  const lost = accountFor({ planned: IDS.length, generated: IDS.slice(0, 4), deliveries: DELIVERIES, persisted: new Set(["e1"]) });
  assert.equal(lost.denominator, 5);
  assert.equal(lost.missing, 1);
  assert.equal(lost.counts.unexplained, 1);
  assert.equal(lost.holds, false);
  const none = accountFor({ planned: 1, generated: [], deliveries: new Map(), persisted: new Set() });
  assert.deepEqual({ missing: none.missing, unexplained: none.counts.unexplained, holds: none.holds }, { missing: 1, unexplained: 1, holds: false });
  assert.equal(accountFor({ planned: 1, generated: ["e1", "e5"], deliveries: DELIVERIES, persisted: new Set(["e1", "e5"]) }).holds, false, "more occurrences than planned");
});

test("a persisted occurrence the sender reported undelivered is kept as a disagreement, counted once", () => {
  const result = accountFor({ planned: 1, generated: ["e2"], deliveries: DELIVERIES, persisted: new Set(["e2"]) });
  assert.deepEqual(result.counts.persisted, 1);
  assert.deepEqual(result.disagreements, [{ event_id: "e2", delivery: "exhausted" }]);
});

test("duplicate generated ids are refused", () => {
  assert.throws(() => accountFor({ planned: 2, generated: ["e1", "e1"], deliveries: DELIVERIES, persisted: new Set() }), /distinct/);
  assert.throws(() => accountFor({ planned: 0, generated: [], deliveries: DELIVERIES, persisted: new Set() }), /planned occurrences/);
});

test("the delay identity holds only when every retry delay was reported", () => {
  // Three occurrences: one attempt, two attempts, three attempts (exchange ordinals 0; 0, 1; 0, 1, 2).
  assert.deepEqual(delayIdentity({ scheduledDelays: 3, exchangeAttempts: [0, 0, 1, 0, 1, 2] }), { scheduled: 3, expected: 3, holds: true });
  assert.equal(delayIdentity({ scheduledDelays: 2, exchangeAttempts: [0, 0, 1, 0, 1, 2] }).holds, false);
  // A repeat delivery of one id restarts its ordinals; its retries still count.
  assert.equal(delayIdentity({ scheduledDelays: 2, exchangeAttempts: [0, 1, 2, 0] }).holds, true);
  assert.equal(BUCKETS.length, 5);
});
