import assert from "node:assert/strict";
import test from "node:test";

import {
  DEDUPLICATION_MAX_RECORDS,
  DEDUPLICATION_RETENTION_MILLISECONDS,
  DeduplicationLedger,
} from "../dist/deduplication.js";

test("the ledger recognizes exact bodies, conflicts, and sender-scoped identities", () => {
  const ledger = new DeduplicationLedger(() => 0);
  assert.equal(ledger.decide("sender-a", "event-1", "first body"), "first");
  assert.equal(ledger.decide("sender-a", "event-1", "first body"), "duplicate");
  assert.equal(ledger.decide("sender-a", "event-1", "different body"), "conflict");
  assert.equal(ledger.decide("sender-b", "event-1", "first body"), "first");
});

test("the ledger lazily expires records and rejects capacity without live eviction", () => {
  let time = 0;
  const ledger = new DeduplicationLedger(() => time);
  for (let index = 0; index < DEDUPLICATION_MAX_RECORDS; index += 1) {
    assert.equal(ledger.decide("sender", `event-${index}`, "body"), "first");
  }
  assert.equal(ledger.decide("sender", "event-overflow", "body"), "capacity");
  assert.equal(ledger.decide("sender", "event-0", "body"), "duplicate");

  time = DEDUPLICATION_RETENTION_MILLISECONDS;
  assert.equal(ledger.decide("sender", "event-overflow", "body"), "first");
});
