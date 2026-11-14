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
// It also pins what offering a pair again does after a failure following the
// commit (#870): the probe and the commit gate run again, so only a reconciling
// commit gate keeps the redelivery durability-only.
//
// And it pins what admission decides before the probe runs (#913): a commit
// state the occurrence's own catalog entry does not allow is refused, an
// occurrence that cannot be serialized is refused, and one admitted snapshot is
// what reaches the durability point and what the result reports.
//
// And it pins the size refusal (#945): an occurrence whose serialization is
// larger than the contract's event size limit is refused before the probe, so
// no business change commits for a record that can never become durable.
//
// Events come from the contract's own positive example set, so the committed
// and the uncommitted arms run against real catalog entries.

import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { EVENT_CATALOG, type SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";
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

function acceptedOutcome(event: SecurityAuditEvent): HttpExchangeOutcome {
  return { kind: "response", status: 202, acknowledgments: [{ event_id: event.event.id, outcome: "accepted" }] };
}

function acknowledging() {
  return recordingHandoff(acceptedOutcome);
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
const PARTIALLY_COMMITTED = transactionCriticalEvent("partially_committed");
const COMPENSATED = transactionCriticalEvent("compensated");

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
  ["a failing handoff after the gate committed for partially_committed", failingHandoff, PARTIALLY_COMMITTED, "audit_durability_failed_after_commit", true],
  ["a failing handoff after the gate committed for compensated", failingHandoff, COMPENSATED, "audit_durability_failed_after_commit", true],
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

// ---------------------------------------------------------------------------
// Qualified durability claims for partial and compensated (#869)
// ---------------------------------------------------------------------------

describe("transaction_critical: qualified durability claims for partial and compensated (#869)", () => {
  const QUALIFIED_COMMITTED = [
    ["partially_committed", PARTIALLY_COMMITTED, "partially_committed_and_durable"],
    ["compensated", COMPENSATED, "compensated_and_durable"],
  ] as const;

  for (const [name, occurrence, expectedStatus] of QUALIFIED_COMMITTED) {
    it(`a ${name} occurrence runs the commit gate and reports ${expectedStatus} upon commit`, async () => {
      const { handoff, attempts } = acknowledging();
      const gate = countingGate("committed");
      const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

      const result = await binding.deliver(occurrence, `txn-${name}`, gate.run);

      assert.deepEqual(result, {
        status: expectedStatus,
        event_id: occurrence.event.id,
        transaction_id: `txn-${name}`,
      });
      assert.equal(gate.calls, 1, `the commit gate must run for ${name}`);
      assert.equal(attempts.length, 1, "the occurrence reached durability");
      assert.ok(Object.isFrozen(result));
    });
  }

  it("deduplicates repeated deliveries of partially_committed and compensated occurrences", async () => {
    const { handoff, attempts } = acknowledging();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const firstPartial = await binding.deliver(PARTIALLY_COMMITTED, "txn-dedup-p", countingGate("committed").run);
    const secondPartial = await binding.deliver(PARTIALLY_COMMITTED, "txn-dedup-p", countingGate("committed").run);

    assert.equal(firstPartial.status, "partially_committed_and_durable");
    assert.deepEqual(secondPartial, {
      status: "already_delivered",
      event_id: PARTIALLY_COMMITTED.event.id,
      transaction_id: "txn-dedup-p",
    });

    const firstComp = await binding.deliver(COMPENSATED, "txn-dedup-c", countingGate("committed").run);
    const secondComp = await binding.deliver(COMPENSATED, "txn-dedup-c", countingGate("committed").run);

    assert.equal(firstComp.status, "compensated_and_durable");
    assert.deepEqual(secondComp, {
      status: "already_delivered",
      event_id: COMPENSATED.event.id,
      transaction_id: "txn-dedup-c",
    });
    assert.equal(attempts.length, 2, "only first attempts reached durability");
  });

  it("fails closed when the commit gate declines or is unconfirmed for qualified occurrences", async () => {
    const { handoff, attempts } = acknowledging();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const declined = await binding.deliver(PARTIALLY_COMMITTED, "txn-declined", countingGate("declined").run);
    assert.deepEqual(declined, {
      status: "failed_closed",
      code: "business_commit_declined",
      event_id: PARTIALLY_COMMITTED.event.id,
      commitGateInvoked: true,
      durabilityAttempted: false,
    });

    const unconfirmed = await binding.deliver(COMPENSATED, "txn-unconfirmed", countingGate("failed").run);
    assert.deepEqual(unconfirmed, {
      status: "failed_closed",
      code: "business_commit_unconfirmed",
      event_id: COMPENSATED.event.id,
      commitGateInvoked: true,
      durabilityAttempted: false,
    });
    assert.equal(attempts.length, 0);
  });
});

// ---------------------------------------------------------------------------
// #870: a redelivery after a failure following the commit runs the gate again
// ---------------------------------------------------------------------------

// A handoff whose first attempt fails and whose later attempts are acknowledged.
function failingOnce() {
  let calls = 0;
  return recordingHandoff((event) => {
    calls += 1;
    return calls === 1 ? { kind: "transport_failure" } : acceptedOutcome(event);
  });
}

// A durability probe that always confirms, and counts how often it ran.
function countingProbe() {
  const probe = {
    calls: 0,
    run: async () => {
      probe.calls += 1;
      return true;
    },
  };
  return probe;
}

// A commit gate whose first run rejects, as when the connection drops after the
// commit was sent, and whose later runs confirm the commit.
function rejectingOnceGate() {
  const gate = {
    calls: 0,
    run: async (): Promise<"committed"> => {
      gate.calls += 1;
      if (gate.calls === 1) throw new Error("synthetic gate rejection: commit outcome unknown");
      return "committed";
    },
  };
  return gate;
}

describe("transaction_critical: a redelivery after a failure following the commit runs the gate again (#870)", () => {
  it("(A) after audit_durability_failed_after_commit, a gate that commits on every call commits twice", async () => {
    const { handoff, attempts } = failingOnce();
    const probe = countingProbe();
    const gate = countingGate("committed");
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: probe.run });

    const first = await binding.deliver(COMMITTED, "txn-870-a", gate.run);
    const second = await binding.deliver(COMMITTED, "txn-870-a", gate.run);

    assert.deepEqual(first, {
      status: "failed_closed",
      code: "audit_durability_failed_after_commit",
      event_id: COMMITTED.event.id,
      commitGateInvoked: true,
      durabilityAttempted: true,
    });
    assert.deepEqual(second, {
      status: "committed_and_durable",
      event_id: COMMITTED.event.id,
      transaction_id: "txn-870-a",
    });
    assert.equal(probe.calls, 2, "the redelivery probes audit durability again");
    assert.equal(gate.calls, 2, "the redelivery runs the commit gate again, which committed the change again");
    assert.deepEqual(attempts, [COMMITTED.event.id, COMMITTED.event.id]);
  });

  it("(B) after business_commit_unconfirmed, the redelivery runs the gate again", async () => {
    const { handoff, attempts } = acknowledging();
    const probe = countingProbe();
    const gate = rejectingOnceGate();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: probe.run });

    const first = await binding.deliver(COMMITTED, "txn-870-b", gate.run);
    const second = await binding.deliver(COMMITTED, "txn-870-b", gate.run);

    assert.deepEqual(first, {
      status: "failed_closed",
      code: "business_commit_unconfirmed",
      event_id: COMMITTED.event.id,
      commitGateInvoked: true,
      durabilityAttempted: false,
    });
    assert.deepEqual(second, {
      status: "committed_and_durable",
      event_id: COMMITTED.event.id,
      transaction_id: "txn-870-b",
    });
    assert.equal(probe.calls, 2, "the redelivery probes audit durability again");
    assert.equal(gate.calls, 2, "the redelivery runs the commit gate again");
    assert.deepEqual(attempts, [COMMITTED.event.id]);
  });

  it("runs the probe, then the gate, then the handoff again, in that order", async () => {
    const steps: string[] = [];
    let handoffs = 0;
    const { handoff } = recordingHandoff((event) => {
      steps.push("handoff");
      handoffs += 1;
      return handoffs === 1 ? { kind: "transport_failure" } : acceptedOutcome(event);
    });
    const binding = createTransactionCriticalDelivery({
      handoff,
      durabilityProbe: async () => {
        steps.push("probe");
        return true;
      },
    });
    const gate: BusinessCommitGate = async () => {
      steps.push("gate");
      return "committed";
    };

    await binding.deliver(COMMITTED, "txn-870-order", gate);
    const second = await binding.deliver(COMMITTED, "txn-870-order", gate);

    assert.equal(second.status, "committed_and_durable");
    assert.deepEqual(steps, ["probe", "gate", "handoff", "probe", "gate", "handoff"]);
  });

  it("does not run the gate again when the redelivery's probe no longer confirms durability", async () => {
    const { handoff, attempts } = failing();
    let probes = 0;
    const gate = countingGate("committed");
    const binding = createTransactionCriticalDelivery({
      handoff,
      durabilityProbe: async () => {
        probes += 1;
        return probes === 1;
      },
    });

    const first = await binding.deliver(COMMITTED, "txn-870-probe", gate.run);
    const second = await binding.deliver(COMMITTED, "txn-870-probe", gate.run);

    assert.equal(first.status === "failed_closed" && first.code, "audit_durability_failed_after_commit");
    assert.deepEqual(second, {
      status: "failed_closed",
      code: "audit_durability_unreachable",
      event_id: COMMITTED.event.id,
      commitGateInvoked: false,
      durabilityAttempted: false,
    });
    assert.equal(gate.calls, 1, "the gate runs only once the probe confirms");
    assert.equal(attempts.length, 1);
  });
});

// ---------------------------------------------------------------------------
// #870: a reconciling commit gate keeps the redelivery durability-only
// ---------------------------------------------------------------------------

// A synthetic host whose business store records each committed transaction. The
// gate it builds for one transaction identifier is a reconciling commit gate: it
// confirms a business change that already committed instead of committing it
// again. The binding passes the gate no arguments, so the host closes over the
// transaction identifier.
function reconcilingHost() {
  const committedTransactions = new Set<string>();
  const host = {
    businessCommits: 0,
    gateFor(transactionId: string): BusinessCommitGate {
      return async () => {
        if (!committedTransactions.has(transactionId)) {
          committedTransactions.add(transactionId);
          host.businessCommits += 1;
        }
        return "committed";
      };
    },
  };
  return host;
}

describe("transaction_critical: a reconciling commit gate commits once (#870)", () => {
  it("(C) after audit_durability_failed_after_commit, the redelivery commits nothing again and becomes durable", async () => {
    const { handoff, attempts } = failingOnce();
    const host = reconcilingHost();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const first = await binding.deliver(COMMITTED, "txn-870-c", host.gateFor("txn-870-c"));
    const second = await binding.deliver(COMMITTED, "txn-870-c", host.gateFor("txn-870-c"));

    assert.equal(first.status === "failed_closed" && first.code, "audit_durability_failed_after_commit");
    assert.deepEqual(second, {
      status: "committed_and_durable",
      event_id: COMMITTED.event.id,
      transaction_id: "txn-870-c",
    });
    assert.equal(host.businessCommits, 1, "the business change committed once");
    assert.deepEqual(attempts, [COMMITTED.event.id, COMMITTED.event.id], "two handoff attempts");
  });

  it("commits once for two occurrences sharing one transaction identifier, and makes both durable", async () => {
    const { handoff, attempts } = acknowledging();
    const host = reconcilingHost();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });
    const second = withNewEventId(COMMITTED);

    const results = [
      await binding.deliver(COMMITTED, "txn-870-shared", host.gateFor("txn-870-shared")),
      await binding.deliver(second, "txn-870-shared", host.gateFor("txn-870-shared")),
    ];

    assert.deepEqual(results.map((result) => result.status), ["committed_and_durable", "committed_and_durable"]);
    assert.equal(host.businessCommits, 1, "the shared business change committed once");
    assert.deepEqual(attempts, [COMMITTED.event.id, second.event.id]);
  });

  it("keeps the record non-durable when reconciliation after business_commit_unconfirmed declines", async () => {
    const { handoff, attempts } = acknowledging();
    let calls = 0;
    // The first run cannot tell; the reconciliation then finds a change that never committed and will not.
    const gate: BusinessCommitGate = async () => {
      calls += 1;
      if (calls === 1) throw new Error("synthetic gate rejection: commit outcome unknown");
      return "declined";
    };
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const first = await binding.deliver(COMMITTED, "txn-870-declined", gate);
    const second = await binding.deliver(COMMITTED, "txn-870-declined", gate);

    assert.equal(first.status === "failed_closed" && first.code, "business_commit_unconfirmed");
    assert.deepEqual(second, {
      status: "failed_closed",
      code: "business_commit_declined",
      event_id: COMMITTED.event.id,
      commitGateInvoked: true,
      durabilityAttempted: false,
    });
    assert.equal(attempts.length, 0, "the record never reaches the durability point");
  });

  it("lets two occurrences sharing a transaction identifier reach the gate at the same time", async () => {
    const { handoff } = acknowledging();
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });
    const second = withNewEventId(COMMITTED);
    let inGate = 0;
    let mostInGate = 0;
    let releaseBoth = () => {};
    const bothInGate = new Promise<void>((resolve) => {
      releaseBoth = resolve;
    });
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const giveUp = new Promise<void>((resolve) => {
      deadline = setTimeout(resolve, 2000);
    });
    // Each call waits until both are inside the gate, or until the deadline if the binding never lets them be.
    const gate: BusinessCommitGate = async () => {
      inGate += 1;
      mostInGate = Math.max(mostInGate, inGate);
      if (inGate === 2) releaseBoth();
      await Promise.race([bothInGate, giveUp]);
      inGate -= 1;
      return "committed";
    };

    try {
      const results = await Promise.all([
        binding.deliver(COMMITTED, "txn-870-concurrent", gate),
        binding.deliver(second, "txn-870-concurrent", gate),
      ]);

      assert.deepEqual(results.map((result) => result.status), ["committed_and_durable", "committed_and_durable"]);
      assert.equal(mostInGate, 2, "the binding does not serialise deliveries that share only a transaction identifier");
    } finally {
      clearTimeout(deadline);
    }
  });
});

// ---------------------------------------------------------------------------
// #913: admission checks the commit claim, and one snapshot is delivered
// ---------------------------------------------------------------------------

// One binding whose probe, commit gate and handoff each record that they ran.
// The hooks let a test act as a caller that changes its own object while a step
// is running. `handedOff` holds what reached the durability point, and `bodies`
// holds the bytes each exchange carried.
function instrumented(hooks: Readonly<{ probe?: () => void; gate?: () => void; exchange?: () => void }> = {}) {
  const steps: string[] = [];
  const handedOff: unknown[] = [];
  const bodies: string[] = [];
  const http = createHttpDeliveryHandoff({
    path: "/v1/security-audit",
    exchange: async (request) => {
      bodies.push(request.body);
      hooks.exchange?.();
      return { kind: "response", status: 202, acknowledgments: [{ event_id: request.event_id, outcome: "accepted" }] };
    },
  });
  const handoff: HttpDeliveryHandoff = {
    handoff: async (event, attempt) => {
      steps.push("handoff");
      handedOff.push(event);
      return http.handoff(event, attempt);
    },
  };
  const binding = createTransactionCriticalDelivery({
    handoff,
    durabilityProbe: async () => {
      steps.push("probe");
      hooks.probe?.();
      return true;
    },
  });
  const gate: BusinessCommitGate = async () => {
    steps.push("gate");
    hooks.gate?.();
    return "committed";
  };
  return { binding, gate, steps, handedOff, bodies };
}

// A copy of `event` with a fresh identifier and the given commit state, or none.
function withCommitState(event: SecurityAuditEvent, commitState: string | undefined): SecurityAuditEvent {
  const copy = withNewEventId(event);
  const fields = copy.event as { commit_state?: string };
  if (commitState === undefined) delete fields.commit_state;
  else fields.commit_state = commitState;
  return copy;
}

function catalogCommitStates(name: string): readonly string[] {
  const entry = EVENT_CATALOG.find((definition) => definition.name === name);
  assert.ok(entry, `the catalog carries no ${name} entry`);
  return entry.commit as readonly string[];
}

function assertFrozenThroughout(value: unknown, path: string): void {
  if (value === null || typeof value !== "object") return;
  assert.ok(Object.isFrozen(value), `${path} must be frozen`);
  for (const [key, child] of Object.entries(value)) assertFrozenThroughout(child, `${path}.${key}`);
}

describe("transaction_critical: a commit state its own catalog entry does not allow is refused (#913)", () => {
  for (const commitState of ["pending", "unknown", "not_started", "not_applicable", undefined]) {
    const label = commitState ?? "an absent commit state";
    it(`refuses ${label} as commit_state_not_allowed, with no probe, gate or handoff`, async () => {
      const occurrence = withCommitState(COMMITTED, commitState);
      const run = instrumented();

      const result = await run.binding.deliver(occurrence, "txn-913-unlisted", run.gate);

      assert.deepEqual(result, { status: "refused", code: "commit_state_not_allowed", event_id: occurrence.event.id });
      assert.deepEqual(run.steps, [], "nothing runs for a refused occurrence");
    });
  }

  it("refuses a commit state that another entry allows but the occurrence's own entry does not", async () => {
    assert.ok(!catalogCommitStates(COMMITTED.event.name).includes("compensated"), "precondition: own entry forbids it");
    assert.ok(
      catalogCommitStates("bloodtrail.audit.data.sensitive_resource.modified").includes("compensated"),
      "precondition: another transaction_critical entry allows it",
    );
    const occurrence = withCommitState(COMMITTED, "compensated");
    const run = instrumented();

    const result = await run.binding.deliver(occurrence, "txn-913-foreign-state", run.gate);

    assert.deepEqual(result, { status: "refused", code: "commit_state_not_allowed", event_id: occurrence.event.id });
    assert.deepEqual(run.steps, []);
  });

  it("leaves the pair deliverable once the refused occurrence is corrected", async () => {
    const refused = withCommitState(COMMITTED, "pending");
    const corrected = structuredClone(refused) as SecurityAuditEvent;
    (corrected.event as { commit_state?: string }).commit_state = "committed";
    const run = instrumented();

    const first = await run.binding.deliver(refused, "txn-913-corrected", run.gate);
    const second = await run.binding.deliver(corrected, "txn-913-corrected", run.gate);

    assert.equal(first.status === "refused" && first.code, "commit_state_not_allowed");
    assert.deepEqual(second, {
      status: "committed_and_durable",
      event_id: corrected.event.id,
      transaction_id: "txn-913-corrected",
    });
    assert.deepEqual(run.steps, ["probe", "gate", "handoff"]);
  });
});

describe("transaction_critical: the admitted snapshot is what is delivered and reported (#913)", () => {
  for (const phase of ["probe", "gate", "exchange"] as const) {
    it(`a caller's change during the ${phase} reaches neither the handed-off body nor the result`, async () => {
      const occurrence = withNewEventId(PARTIALLY_COMMITTED);
      const admittedBody = JSON.stringify(occurrence);
      const admittedId = occurrence.event.id;
      const change = () => {
        const fields = occurrence.event as { id: string; commit_state?: string };
        fields.commit_state = "committed";
        fields.id = randomUUID();
      };
      const run = instrumented({ [phase]: change });

      const result = await run.binding.deliver(occurrence, `txn-913-${phase}`, run.gate);

      assert.deepEqual(run.bodies, [admittedBody], "the durable bytes are the occurrence as admitted");
      assert.deepEqual(result, {
        status: "partially_committed_and_durable",
        event_id: admittedId,
        transaction_id: `txn-913-${phase}`,
      });
    });
  }

  it("hands the durability point an occurrence frozen at every depth", async () => {
    const occurrence = withNewEventId(COMMITTED);
    const run = instrumented();

    const result = await run.binding.deliver(occurrence, "txn-913-frozen", run.gate);

    assert.equal(result.status, "committed_and_durable");
    assert.equal(run.handedOff.length, 1);
    assert.notEqual(run.handedOff[0], occurrence, "the caller's own object is never handed off");
    assertFrozenThroughout(run.handedOff[0], "occurrence");
  });

  for (const example of ALL_EVENTS.filter((candidate) => candidate.event.delivery_class === "transaction_critical")) {
    it(`hands off exactly the JSON serialization of the ${example.event.name} example`, async () => {
      const occurrence = structuredClone(example) as SecurityAuditEvent;
      const run = instrumented();

      await run.binding.deliver(occurrence, `txn-913-bytes-${example.event.id}`, run.gate);

      assert.deepEqual(run.bodies, [JSON.stringify(example)]);
    });
  }
});

describe("transaction_critical: an occurrence that cannot be serialized is refused before the commit (#913)", () => {
  const UNSERIALIZABLE: readonly (readonly [string, (event: SecurityAuditEvent) => void])[] = [
    ["a BigInt", (event) => {
      (event.event as unknown as Record<string, unknown>).poison = 1n;
    }],
    ["a cycle", (event) => {
      (event.event as unknown as Record<string, unknown>).self = event;
    }],
    ["a throwing toJSON", (event) => {
      (event as unknown as Record<string, unknown>).toJSON = () => {
        throw new Error("synthetic toJSON failure");
      };
    }],
    ["a toJSON that returns nothing", (event) => {
      (event as unknown as Record<string, unknown>).toJSON = () => undefined;
    }],
  ];

  for (const [label, poison] of UNSERIALIZABLE) {
    it(`refuses an occurrence holding ${label} as occurrence_not_serializable, with no probe, gate or handoff`, async () => {
      const occurrence = withNewEventId(COMMITTED);
      poison(occurrence);
      const run = instrumented();

      const result = await run.binding.deliver(occurrence, "txn-913-unserializable", run.gate);

      assert.deepEqual(result, { status: "refused", code: "occurrence_not_serializable", event_id: occurrence.event.id });
      assert.deepEqual(run.steps, []);
    });
  }

  it("refuses an occurrence whose event getter throws, reporting an empty event_id", async () => {
    const hostile = Object.defineProperty({}, "event", {
      enumerable: true,
      get() {
        throw new Error("synthetic getter failure");
      },
    }) as SecurityAuditEvent;
    const run = instrumented();

    const result = await run.binding.deliver(hostile, "txn-913-getter", run.gate);

    assert.deepEqual(result, { status: "refused", code: "occurrence_not_serializable", event_id: "" });
    assert.deepEqual(run.steps, []);
  });

  for (const value of [null, 42]) {
    it(`refuses ${String(value)} as unknown_event_name rather than rejecting`, async () => {
      const run = instrumented();

      const result = await run.binding.deliver(value as unknown as SecurityAuditEvent, "txn-913-not-an-object", run.gate);

      assert.deepEqual(result, { status: "refused", code: "unknown_event_name", event_id: "" });
      assert.deepEqual(run.steps, []);
    });
  }
});

describe("transaction_critical: every allowed commit state has one outcome, in a fixed order (#913)", () => {
  // The documented table: the status each commit state reaches once acknowledged,
  // and whether the commit gate runs for it.
  const DOCUMENTED_OUTCOMES: Readonly<Record<string, readonly [string, boolean]>> = {
    committed: ["committed_and_durable", true],
    partially_committed: ["partially_committed_and_durable", true],
    compensated: ["compensated_and_durable", true],
    not_committed: ["durable_without_commit", false],
  };
  const TRANSACTION_CRITICAL_ENTRIES = EVENT_CATALOG.filter((entry) => entry.delivery === "transaction_critical");

  it("walks a non-empty set of transaction_critical catalog entries", () => {
    assert.ok(TRANSACTION_CRITICAL_ENTRIES.length > 0);
  });

  for (const entry of TRANSACTION_CRITICAL_ENTRIES) {
    it(`maps each commit state ${entry.name} allows to its documented outcome`, async () => {
      for (const commitState of entry.commit as readonly string[]) {
        const documented = DOCUMENTED_OUTCOMES[commitState];
        assert.ok(documented, `${entry.name} allows ${commitState}, which the documented table does not cover`);
        const [status, gateRuns] = documented;
        const occurrence = withCommitState(COMMITTED, commitState);
        (occurrence.event as { name: string }).name = entry.name;
        const run = instrumented();

        const result = await run.binding.deliver(occurrence, `txn-913-${commitState}`, run.gate);

        assert.deepEqual(result, { status, event_id: occurrence.event.id, transaction_id: `txn-913-${commitState}` },
          `${entry.name} / ${commitState}`);
        assert.deepEqual(run.steps, gateRuns ? ["probe", "gate", "handoff"] : ["probe", "handoff"],
          `${entry.name} / ${commitState}`);
      }
    });
  }

  it("runs the probe, then the gate, then the handoff, once each", async () => {
    const run = instrumented();

    await run.binding.deliver(withNewEventId(COMMITTED), "txn-913-order", run.gate);

    assert.deepEqual(run.steps, ["probe", "gate", "handoff"]);
  });

  it("reports a repeat of a settled pair already delivered, running nothing again", async () => {
    const occurrence = withNewEventId(COMMITTED);
    const run = instrumented();

    await run.binding.deliver(occurrence, "txn-913-repeat", run.gate);
    const repeat = await run.binding.deliver(occurrence, "txn-913-repeat", run.gate);

    assert.deepEqual(repeat, { status: "already_delivered", event_id: occurrence.event.id, transaction_id: "txn-913-repeat" });
    assert.deepEqual(run.steps, ["probe", "gate", "handoff"], "the repeat runs no probe, gate or handoff");
  });
});

// A binding whose handoff acknowledges whatever it is handed. It stands in for
// the durability point where the identifier is not one the HTTP handoff's
// acknowledgment check would echo back.
function acknowledgingStub() {
  const handedOff: unknown[] = [];
  const binding = createTransactionCriticalDelivery({
    handoff: {
      handoff: async (event, attempt = 0) => {
        handedOff.push(event);
        return { status: "acknowledged", code: "acknowledged", event_id: "stub", attempt };
      },
    },
    durabilityProbe: async () => true,
  });
  return { binding, handedOff };
}

describe("transaction_critical: refusals are decided before the duplicate check (#913)", () => {
  it("refuses a settled pair offered again with a commit state its entry does not allow", async () => {
    const occurrence = withNewEventId(COMMITTED);
    const repeat = structuredClone(occurrence) as SecurityAuditEvent;
    (repeat.event as { commit_state?: string }).commit_state = "pending";
    const run = instrumented();

    const first = await run.binding.deliver(occurrence, "txn-913-settled-repeat", run.gate);
    const second = await run.binding.deliver(repeat, "txn-913-settled-repeat", run.gate);

    assert.equal(first.status, "committed_and_durable");
    assert.deepEqual(second, { status: "refused", code: "commit_state_not_allowed", event_id: occurrence.event.id });
    assert.deepEqual(run.steps, ["probe", "gate", "handoff"], "the refused repeat runs nothing");
  });

  it("refuses a settled pair offered again with no JSON serialization", async () => {
    const occurrence = withNewEventId(COMMITTED);
    const repeat = structuredClone(occurrence) as SecurityAuditEvent;
    (repeat.event as unknown as Record<string, unknown>).poison = 1n;
    const run = instrumented();

    await run.binding.deliver(occurrence, "txn-913-settled-unserializable", run.gate);
    const second = await run.binding.deliver(repeat, "txn-913-settled-unserializable", run.gate);

    assert.deepEqual(second, { status: "refused", code: "occurrence_not_serializable", event_id: occurrence.event.id });
    assert.deepEqual(run.steps, ["probe", "gate", "handoff"]);
  });

  it("refuses an in-flight pair offered again with a commit state its entry does not allow, not as a duplicate", async () => {
    const occurrence = withNewEventId(COMMITTED);
    const repeat = structuredClone(occurrence) as SecurityAuditEvent;
    (repeat.event as { commit_state?: string }).commit_state = "unknown";
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = instrumented();
    const heldGate: BusinessCommitGate = async () => {
      await held;
      return "committed";
    };

    const first = run.binding.deliver(occurrence, "txn-913-in-flight", heldGate);
    try {
      const second = await run.binding.deliver(repeat, "txn-913-in-flight", heldGate);
      assert.deepEqual(second, { status: "refused", code: "commit_state_not_allowed", event_id: occurrence.event.id });
    } finally {
      release();
    }
    assert.equal((await first).status, "committed_and_durable");
  });
});

describe("transaction_critical: the deduplication key holds for any identifier the snapshot carries (#913)", () => {
  it("delivers an occurrence whose identifier shadows toString, rather than rejecting", async () => {
    const occurrence = withNewEventId(COMMITTED);
    (occurrence.event as unknown as { id: unknown }).id = { toString: 1 };
    const stub = acknowledgingStub();

    const result = await stub.binding.deliver(occurrence, "txn-913-shadowed-id", countingGate("committed").run);

    assert.equal(result.status, "committed_and_durable");
    assert.equal(stub.handedOff.length, 1);
  });

  it("keeps the identifiers 1 and \"1\" apart under one transaction identifier", async () => {
    const numeric = withNewEventId(COMMITTED);
    (numeric.event as unknown as { id: unknown }).id = 1;
    const text = withNewEventId(COMMITTED);
    (text.event as { id: string }).id = "1";
    const stub = acknowledgingStub();

    const results = [
      await stub.binding.deliver(numeric, "txn-913-one", countingGate("committed").run),
      await stub.binding.deliver(text, "txn-913-one", countingGate("committed").run),
    ];

    assert.deepEqual(results.map((result) => result.status), ["committed_and_durable", "committed_and_durable"]);
    assert.equal(stub.handedOff.length, 2, "neither is mistaken for the other");
  });
});

// ---------------------------------------------------------------------------
// #945: an occurrence too large to become durable is refused before the commit
// ---------------------------------------------------------------------------

// The contract's own event size limit. Every size below is built from it, never
// from a literal, so these tests fail if admission or the handoff applies any
// other limit.
const CONTRACT_EVENT_MAX_BYTES = (
  JSON.parse(
    readFileSync(resolve(__dirname, "../../../contracts/security-audit/source/contract.source.json"), "utf8"),
  ) as { readonly bounds: { readonly event_max_bytes: number } }
).bounds.event_max_bytes;

function serializedBytes(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value), "utf8");
}

// A copy of `event` with a fresh identifier and a padding member of `filler`
// repeated `count` times.
function padded(event: SecurityAuditEvent, filler: string, count: number): SecurityAuditEvent {
  const copy = withNewEventId(event) as SecurityAuditEvent & { extension_padding: string };
  copy.extension_padding = filler.repeat(count);
  return copy;
}

// A copy of `event` whose JSON serialization is exactly `bytes` UTF-8 bytes.
function sizedTo(event: SecurityAuditEvent, bytes: number): SecurityAuditEvent {
  const empty = serializedBytes(padded(event, "x", 0));
  assert.ok(bytes >= empty, "precondition: the example fits under the requested size");
  const copy = padded(event, "x", bytes - empty);
  assert.equal(serializedBytes(copy), bytes, "precondition: the occurrence has the requested size");
  return copy;
}

function tooLarge(occurrence: unknown) {
  const id = (occurrence as { event?: { id?: unknown } } | null)?.event?.id;
  return { status: "refused", code: "occurrence_too_large", event_id: typeof id === "string" ? id : "" };
}

describe("transaction_critical: an occurrence over the contract's size limit is refused before the commit (#945)", () => {
  it("reads a usable limit from the contract source", () => {
    assert.ok(Number.isSafeInteger(CONTRACT_EVENT_MAX_BYTES) && CONTRACT_EVENT_MAX_BYTES > serializedBytes(COMMITTED));
  });

  for (const [label, excess] of [["one byte over the limit", 1], ["well over the limit", 8192]] as const) {
    it(`refuses an occurrence ${label} as occurrence_too_large, with no probe, gate or handoff`, async () => {
      const occurrence = sizedTo(COMMITTED, CONTRACT_EVENT_MAX_BYTES + excess);
      const run = instrumented();

      const result = await run.binding.deliver(occurrence, "txn-945-oversized", run.gate);

      assert.deepEqual(result, tooLarge(occurrence));
      assert.deepEqual(run.steps, [], "nothing runs for a refused occurrence");
    });
  }

  it("counts UTF-8 bytes, not characters", async () => {
    const occurrence = padded(COMMITTED, "\u00e9", Math.floor(CONTRACT_EVENT_MAX_BYTES * 0.6));
    assert.ok(JSON.stringify(occurrence).length < CONTRACT_EVENT_MAX_BYTES, "precondition: under the limit in characters");
    assert.ok(serializedBytes(occurrence) > CONTRACT_EVENT_MAX_BYTES, "precondition: over the limit in bytes");
    const run = instrumented();

    const result = await run.binding.deliver(occurrence, "txn-945-multibyte", run.gate);

    assert.deepEqual(result, tooLarge(occurrence));
    assert.deepEqual(run.steps, []);
  });

  it("refuses an oversized not_committed occurrence, which runs no commit gate", async () => {
    const occurrence = sizedTo(NOT_COMMITTED, CONTRACT_EVENT_MAX_BYTES + 1);
    const run = instrumented();

    const result = await run.binding.deliver(occurrence, "txn-945-not-committed", run.gate);

    assert.deepEqual(result, tooLarge(occurrence));
    assert.deepEqual(run.steps, []);
  });

  it("delivers an occurrence exactly at the limit, with a body of that size", async () => {
    const occurrence = sizedTo(COMMITTED, CONTRACT_EVENT_MAX_BYTES);
    const run = instrumented();

    const result = await run.binding.deliver(occurrence, "txn-945-at-limit", run.gate);

    assert.deepEqual(result, {
      status: "committed_and_durable",
      event_id: occurrence.event.id,
      transaction_id: "txn-945-at-limit",
    });
    assert.deepEqual(run.steps, ["probe", "gate", "handoff"]);
    assert.deepEqual(run.bodies.map((body) => Buffer.byteLength(body, "utf8")), [CONTRACT_EVENT_MAX_BYTES]);
  });

  it("leaves the pair deliverable once the refused occurrence is made to fit", async () => {
    const refused = sizedTo(COMMITTED, CONTRACT_EVENT_MAX_BYTES + 1);
    const corrected = structuredClone(refused) as SecurityAuditEvent & { extension_padding?: string };
    delete corrected.extension_padding;
    const run = instrumented();

    const first = await run.binding.deliver(refused, "txn-945-corrected", run.gate);
    const second = await run.binding.deliver(corrected, "txn-945-corrected", run.gate);

    assert.deepEqual(first, tooLarge(refused));
    assert.deepEqual(second, {
      status: "committed_and_durable",
      event_id: corrected.event.id,
      transaction_id: "txn-945-corrected",
    });
    assert.deepEqual(run.steps, ["probe", "gate", "handoff"]);
  });
});

describe("transaction_critical: the size refusal comes before every refusal but the serialization one (#945)", () => {
  it("refuses an oversized occurrence of another delivery class as too large, not as a class mismatch", async () => {
    const other = ALL_EVENTS.find((candidate) => candidate.event.delivery_class !== "transaction_critical");
    assert.ok(other, "precondition: the example set carries another delivery class");
    const occurrence = sizedTo(other, CONTRACT_EVENT_MAX_BYTES + 1);
    const run = instrumented();

    const result = await run.binding.deliver(occurrence, "txn-945-other-class", run.gate);

    assert.deepEqual(result, tooLarge(occurrence));
    assert.deepEqual(run.steps, []);
  });

  it("refuses an oversized occurrence with a commit state its entry does not allow as too large", async () => {
    const occurrence = sizedTo(withCommitState(COMMITTED, "unknown"), CONTRACT_EVENT_MAX_BYTES + 1);
    assert.equal(occurrence.event.commit_state, "unknown", "precondition: the commit state is not one the entry allows");
    const run = instrumented();

    const result = await run.binding.deliver(occurrence, "txn-945-unlisted-state", run.gate);

    assert.deepEqual(result, tooLarge(occurrence));
    assert.deepEqual(run.steps, []);
  });

  it("refuses an oversized string, which is not an occurrence object, as too large", async () => {
    const text = "x".repeat(CONTRACT_EVENT_MAX_BYTES);
    const run = instrumented();

    const result = await run.binding.deliver(text as unknown as SecurityAuditEvent, "txn-945-text", run.gate);

    assert.deepEqual(result, tooLarge(text));
    assert.deepEqual(run.steps, []);
  });

  it("refuses a settled pair offered again oversized, rather than reporting it delivered", async () => {
    const occurrence = withNewEventId(COMMITTED);
    const oversized = structuredClone(occurrence) as SecurityAuditEvent & { extension_padding: string };
    oversized.extension_padding = "x".repeat(CONTRACT_EVENT_MAX_BYTES);
    const run = instrumented();

    const first = await run.binding.deliver(occurrence, "txn-945-settled", run.gate);
    const second = await run.binding.deliver(oversized, "txn-945-settled", run.gate);

    assert.equal(first.status, "committed_and_durable");
    assert.deepEqual(second, tooLarge(oversized));
    assert.deepEqual(run.steps, ["probe", "gate", "handoff"], "the repeat ran nothing");
  });

  it("refuses an oversized occurrence delivered with an empty transaction identifier as too large", async () => {
    const occurrence = sizedTo(COMMITTED, CONTRACT_EVENT_MAX_BYTES + 1);
    const run = instrumented();

    const result = await run.binding.deliver(occurrence, "", run.gate);

    assert.deepEqual(result, tooLarge(occurrence));
    assert.deepEqual(run.steps, []);
  });

  it("refuses an in-flight pair offered again oversized, not as a duplicate", async () => {
    const occurrence = withNewEventId(COMMITTED);
    const oversized = structuredClone(occurrence) as SecurityAuditEvent & { extension_padding: string };
    oversized.extension_padding = "x".repeat(CONTRACT_EVENT_MAX_BYTES);
    let release = () => {};
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });
    const run = instrumented();
    const heldGate: BusinessCommitGate = async () => {
      await held;
      return "committed";
    };

    const first = run.binding.deliver(occurrence, "txn-945-in-flight", heldGate);
    try {
      const second = await run.binding.deliver(oversized, "txn-945-in-flight", heldGate);
      assert.deepEqual(second, tooLarge(oversized));
    } finally {
      release();
    }
    assert.equal((await first).status, "committed_and_durable");
  });

  it("still refuses an occurrence with no JSON serialization as not serializable, however large", async () => {
    const occurrence = sizedTo(COMMITTED, CONTRACT_EVENT_MAX_BYTES + 1) as SecurityAuditEvent & { cyclic?: unknown };
    occurrence.cyclic = occurrence;
    const run = instrumented();

    const result = await run.binding.deliver(occurrence, "txn-945-cyclic", run.gate);

    assert.deepEqual(result, { status: "refused", code: "occurrence_not_serializable", event_id: occurrence.event.id });
    assert.deepEqual(run.steps, []);
  });
});
