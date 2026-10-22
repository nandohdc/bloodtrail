// Transaction-critical delivery claims only what it checks (#859, #860).
//
// Each case reproduces one Stage P finding (run 4, P-E; system ADR 0014)
// through the public binding:
//
//   - P-E-x2: a probe or commit gate value outside its declared type must fail
//     closed, never continue to the durability point;
//   - P-E-3a: a `not_committed` occurrence is delivered without a commit claim;
//   - P-E-6c: two such occurrences sharing a transaction id never run the gate;
//   - P-E-7:  deduplication holds within one binding instance only;
//   - P-E-8:  a failure after the gate committed is distinct from one before it;
//   - and a rejected probe, gate or handoff confirms nothing either, so it fails
//     closed the same way instead of rejecting `deliver()`.
//
// Events come from the contract's own positive example set, so the committed
// and the uncommitted arms run against real catalog entries.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";
import {
  createHttpDeliveryHandoff,
  createTransactionCriticalDelivery,
  type BusinessCommitGate,
  type HttpDeliveryHandoff,
  type HttpExchangeOutcome,
} from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ALL_EVENTS = JSON.parse(
  readFileSync(resolve(__dirname, "../../../contracts/security-audit/examples/positive/all-events.json"), "utf8"),
) as readonly SecurityAuditEvent[];

function transactionCriticalEvent(commitState: string): SecurityAuditEvent {
  const match = ALL_EVENTS.find(
    (candidate) => candidate.event.delivery_class === "transaction_critical" && candidate.event.commit_state === commitState,
  );
  assert.ok(match, `contract example set carries no transaction_critical ${commitState} event`);
  return structuredClone(match) as SecurityAuditEvent;
}

function withNewEventId(event: SecurityAuditEvent): SecurityAuditEvent {
  const copy = structuredClone(event) as SecurityAuditEvent;
  (copy.event as { id: string }).id = randomUUID();
  return copy;
}

function recordingHandoff(outcome: (event: SecurityAuditEvent) => HttpExchangeOutcome) {
  const attempts: string[] = [];
  const handoff = createHttpDeliveryHandoff({
    path: "/v1/security-audit",
    exchange: async (request) => {
      const body = JSON.parse(request.body) as SecurityAuditEvent;
      attempts.push(body.event.id);
      return outcome(body);
    },
  });
  return { handoff, attempts };
}

function acknowledging() {
  return recordingHandoff((event) => ({
    kind: "response",
    status: 202,
    acknowledgments: [{ event_id: event.event.id, outcome: "accepted" }],
  }));
}

function failing() {
  return recordingHandoff(() => ({ kind: "transport_failure" }));
}

// A commit gate that resolves `decision` whatever its type, as a JavaScript
// host, a cast or an `any` result can, and counts how often it ran.
function countingGate(decision: unknown) {
  const gate = {
    calls: 0,
    run: (async () => {
      gate.calls += 1;
      return decision;
    }) as unknown as BusinessCommitGate,
  };
  return gate;
}

const COMMITTED = transactionCriticalEvent("committed");
const NOT_COMMITTED = transactionCriticalEvent("not_committed");

// ---------------------------------------------------------------------------
// P-E-x2 (#859): out-of-type probe and gate values fail closed
// ---------------------------------------------------------------------------

describe("transaction_critical: out-of-type probe results fail closed (P-E-x2, #859)", () => {
  for (const value of [1, "no", 0, "", undefined, null, "true"]) {
    it(`a probe resolving ${JSON.stringify(value) ?? "undefined"} fails closed before the commit gate`, async () => {
      const { handoff, attempts } = acknowledging();
      const gate = countingGate("committed");
      const binding = createTransactionCriticalDelivery({
        handoff,
        durabilityProbe: (async () => value) as unknown as () => Promise<boolean>,
      });

      const result = await binding.deliver(COMMITTED, "txn-probe", gate.run);

      assert.deepEqual(result, {
        status: "failed_closed",
        code: "audit_durability_unreachable",
        event_id: COMMITTED.event.id,
        commitGateInvoked: false,
        durabilityAttempted: false,
      });
      assert.equal(gate.calls, 0, "the business commit must not run");
      assert.equal(attempts.length, 0, "no delivery attempt is made");
    });
  }
});

describe("transaction_critical: out-of-type commit gate results fail closed (P-E-x2, #859)", () => {
  for (const value of [undefined, "failed", null, true, "Committed"]) {
    it(`a gate resolving ${JSON.stringify(value) ?? "undefined"} fails closed as unconfirmed, never durable`, async () => {
      const { handoff, attempts } = acknowledging();
      const gate = countingGate(value);
      const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

      const result = await binding.deliver(COMMITTED, "txn-gate", gate.run);

      assert.deepEqual(result, {
        status: "failed_closed",
        code: "business_commit_unconfirmed",
        event_id: COMMITTED.event.id,
        commitGateInvoked: true,
        durabilityAttempted: false,
      });
      assert.equal(gate.calls, 1);
      assert.equal(attempts.length, 0, "the occurrence never reaches the durability point");
    });
  }

  it("keeps an unconfirmed pair deliverable rather than recording it as delivered", async () => {
    const { handoff, attempts } = acknowledging();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const unconfirmed = await binding.deliver(COMMITTED, "txn-retry", countingGate("failed").run);
    const confirmed = await binding.deliver(COMMITTED, "txn-retry", countingGate("committed").run);

    assert.equal(unconfirmed.status, "failed_closed");
    assert.equal(confirmed.status, "committed_and_durable");
    assert.equal(attempts.length, 1);
  });

  it("control: a declined commit keeps its own code, distinct from unconfirmed", async () => {
    const { handoff, attempts } = acknowledging();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const result = await binding.deliver(COMMITTED, "txn-declined", countingGate("declined").run);

    assert.equal(result.status === "failed_closed" && result.code, "business_commit_declined");
    assert.equal(attempts.length, 0);
  });
});

// ---------------------------------------------------------------------------
// P-E-3a and P-E-6c (#860): an uncommitted occurrence carries no commit claim
// ---------------------------------------------------------------------------

describe("transaction_critical: an uncommitted occurrence is delivered without a commit claim (P-E-3a, #860)", () => {
  it("reports durable_without_commit and never runs the commit gate", async () => {
    const { handoff, attempts } = acknowledging();
    const gate = countingGate("committed");
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const result = await binding.deliver(NOT_COMMITTED, "txn-uncommitted", gate.run);

    assert.deepEqual(result, {
      status: "durable_without_commit",
      event_id: NOT_COMMITTED.event.id,
      transaction_id: "txn-uncommitted",
    });
    assert.equal(gate.calls, 0, "there is no business commit to gate");
    assert.deepEqual(attempts, [NOT_COMMITTED.event.id]);
  });

  it("still fails closed before delivery when audit durability is unreachable", async () => {
    const { handoff, attempts } = acknowledging();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => false });

    const result = await binding.deliver(NOT_COMMITTED, "txn-uncommitted", countingGate("committed").run);

    assert.equal(result.status === "failed_closed" && result.code, "audit_durability_unreachable");
    assert.equal(attempts.length, 0);
  });

  it("records the pair for deduplication like a committed delivery", async () => {
    const { handoff, attempts } = acknowledging();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    await binding.deliver(NOT_COMMITTED, "txn-dedup", countingGate("committed").run);
    const repeat = await binding.deliver(NOT_COMMITTED, "txn-dedup", countingGate("committed").run);

    assert.deepEqual(repeat, {
      status: "already_delivered",
      event_id: NOT_COMMITTED.event.id,
      transaction_id: "txn-dedup",
    });
    assert.equal(attempts.length, 1);
  });

  it("never runs the gate for two uncommitted occurrences sharing one transaction id (P-E-6c)", async () => {
    const { handoff, attempts } = acknowledging();
    const gate = countingGate("committed");
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });
    const second = withNewEventId(NOT_COMMITTED);

    const results = [
      await binding.deliver(NOT_COMMITTED, "txn-shared", gate.run),
      await binding.deliver(second, "txn-shared", gate.run),
    ];

    assert.deepEqual(results.map((result) => result.status), ["durable_without_commit", "durable_without_commit"]);
    assert.equal(gate.calls, 0);
    assert.deepEqual(attempts, [NOT_COMMITTED.event.id, second.event.id]);
  });

  it("control: a committed occurrence still runs the gate once and claims the commit", async () => {
    const { handoff } = acknowledging();
    const gate = countingGate("committed");
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const result = await binding.deliver(COMMITTED, "txn-committed", gate.run);

    assert.equal(result.status, "committed_and_durable");
    assert.equal(gate.calls, 1);
  });
});

// ---------------------------------------------------------------------------
// P-E-8 (#860): a failure after the commit is distinct from one before it
// ---------------------------------------------------------------------------

function rejectingHandoff(): HttpDeliveryHandoff {
  return { handoff: async () => Promise.reject(new Error("synthetic handoff rejection")) };
}

function failingHandoff(): HttpDeliveryHandoff {
  return failing().handoff;
}

// Every handoff that does not acknowledge, whether it fails or rejects, settles
// on its commit path's outcome: after a confirmed commit it is a failure after
// the commit; for an uncommitted occurrence no gate ran, so it stays unreachable.
const HANDOFF_FAILURES = [
  ["a failing handoff after the gate committed", failingHandoff, COMMITTED, "audit_durability_failed_after_commit", true],
  ["a rejecting handoff after the gate committed", rejectingHandoff, COMMITTED, "audit_durability_failed_after_commit", true],
  ["a failing handoff for an uncommitted occurrence", failingHandoff, NOT_COMMITTED, "audit_durability_unreachable", false],
  ["a rejecting handoff for an uncommitted occurrence", rejectingHandoff, NOT_COMMITTED, "audit_durability_unreachable", false],
] as const;

describe("transaction_critical: a failure after the commit gate is distinguishable (P-E-8, #860)", () => {
  for (const [situation, makeHandoff, event, code, gateRan] of HANDOFF_FAILURES) {
    it(`${situation} fails closed as ${code}, never rejecting`, async () => {
      const gate = countingGate("committed");
      const binding = createTransactionCriticalDelivery({ handoff: makeHandoff(), durabilityProbe: async () => true });

      const result = await binding.deliver(event, `txn-${situation}`, gate.run);

      assert.deepEqual(result, {
        status: "failed_closed",
        code,
        event_id: event.event.id,
        commitGateInvoked: gateRan,
        durabilityAttempted: true,
      });
      assert.equal(gate.calls, gateRan ? 1 : 0);
    });
  }

  it("keeps audit_durability_unreachable for a failure before the commit gate runs", async () => {
    const { handoff } = failing();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => false });

    const result = await binding.deliver(COMMITTED, "txn-before", countingGate("committed").run);

    assert.deepEqual(result, {
      status: "failed_closed",
      code: "audit_durability_unreachable",
      event_id: COMMITTED.event.id,
      commitGateInvoked: false,
      durabilityAttempted: false,
    });
  });

  it("keeps the declaration: it fails closed before the commit gate runs", () => {
    const { handoff } = acknowledging();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    assert.deepEqual(binding.guarantees, {
      deliveryClass: "transaction_critical",
      semantic: "at_least_once",
      claimsAtLeastOnce: true,
      failsClosedBeforeCommit: true,
    });
  });
});

// ---------------------------------------------------------------------------
// Rejections confirm nothing either: deliver() fails closed instead of rejecting
// ---------------------------------------------------------------------------

describe("transaction_critical: a rejected probe or gate fails closed rather than rejecting", () => {
  it("treats a rejecting probe as unreachable audit durability, before the gate", async () => {
    const { handoff, attempts } = acknowledging();
    const gate = countingGate("committed");
    const binding = createTransactionCriticalDelivery({
      handoff,
      durabilityProbe: async () => Promise.reject(new Error("synthetic probe rejection")),
    });

    const result = await binding.deliver(COMMITTED, "txn-probe-rejects", gate.run);

    assert.equal(result.status === "failed_closed" && result.code, "audit_durability_unreachable");
    assert.equal(gate.calls, 0);
    assert.equal(attempts.length, 0);
  });

  it("treats a rejecting gate as an unconfirmed commit, with no handoff", async () => {
    const { handoff, attempts } = acknowledging();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const result = await binding.deliver(COMMITTED, "txn-gate-rejects", async () =>
      Promise.reject(new Error("synthetic gate rejection")));

    assert.deepEqual(result, {
      status: "failed_closed",
      code: "business_commit_unconfirmed",
      event_id: COMMITTED.event.id,
      commitGateInvoked: true,
      durabilityAttempted: false,
    });
    assert.equal(attempts.length, 0);
  });

  it("returns frozen results on both durable paths, like every failure", async () => {
    const { handoff } = acknowledging();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const committed = await binding.deliver(COMMITTED, "txn-frozen", countingGate("committed").run);
    const uncommitted = await binding.deliver(NOT_COMMITTED, "txn-frozen", countingGate("committed").run);

    assert.equal(committed.status, "committed_and_durable");
    assert.equal(uncommitted.status, "durable_without_commit");
    assert.ok(Object.isFrozen(committed) && Object.isFrozen(uncommitted));
  });
});

// ---------------------------------------------------------------------------
// P-E-7 (#860): deduplication holds within one binding instance only
// ---------------------------------------------------------------------------

describe("transaction_critical: deduplication is per binding instance (P-E-7, #860)", () => {
  it("delivers the same pair once through each of two instances, neither reporting it already delivered", async () => {
    const { handoff, attempts } = acknowledging();
    const first = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });
    const second = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const results = [
      await first.deliver(COMMITTED, "txn-instances", countingGate("committed").run),
      await second.deliver(COMMITTED, "txn-instances", countingGate("committed").run),
    ];

    assert.deepEqual(results.map((result) => result.status), ["committed_and_durable", "committed_and_durable"]);
    assert.equal(attempts.length, 2, "each instance reached the durability point");
  });
});
