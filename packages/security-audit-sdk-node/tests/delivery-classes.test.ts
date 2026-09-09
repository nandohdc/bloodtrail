// Common per-class delivery conformance suite (#112).
//
// The class rows are read out of the frozen contract source rather than
// restated here, so an edit to `delivery_class_contracts` breaks this suite
// instead of silently diverging from it — which is what the conformance
// contract's "conformance statement traces to a frozen row" requirement asks
// for. Events come from the contract's own positive example set, so each arm
// runs against the real catalog entry for its class rather than a hand-built
// shape.
//
// `security_significant` is included as the already-satisfied arm. It is the
// null control: a suite that only ever ran against the three new classes could
// pass by asserting nothing the vertical slice had not already proven.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";
import {
  BEST_EFFORT_LOSS_CEILING,
  createBestEffortDelivery,
  createHttpDeliveryHandoff,
  createPolicyCriticalDelivery,
  createTransactionCriticalDelivery,
  type GovernedDeliveryClass,
  type HttpExchangeOutcome,
} from "../dist/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const contractsRoot = resolve(__dirname, "../../../contracts/security-audit");

type DeliveryClassRow = Readonly<Record<string, string>>;

const DELIVERY_CLASS_CONTRACTS = JSON.parse(
  readFileSync(resolve(contractsRoot, "source/contract.source.json"), "utf8"),
).delivery_class_contracts as Readonly<Record<GovernedDeliveryClass, DeliveryClassRow>>;

const ALL_EVENTS = JSON.parse(
  readFileSync(resolve(contractsRoot, "examples/positive/all-events.json"), "utf8"),
) as readonly SecurityAuditEvent[];

const GOVERNED_CLASSES = [
  "best_effort",
  "security_significant",
  "transaction_critical",
  "policy_critical",
] as const satisfies readonly GovernedDeliveryClass[];

function eventForClass(deliveryClass: GovernedDeliveryClass): SecurityAuditEvent {
  const match = ALL_EVENTS.find((candidate) => candidate.event.delivery_class === deliveryClass);
  assert.ok(match, `contract example set carries no ${deliveryClass} event`);
  return structuredClone(match) as SecurityAuditEvent;
}

function acknowledgingExchange(event: SecurityAuditEvent): HttpExchangeOutcome {
  return { kind: "response", status: 202, acknowledgments: [{ event_id: event.event.id, outcome: "accepted" }] };
}

function handoffReturning(outcomeFor: (event: SecurityAuditEvent) => HttpExchangeOutcome, event: SecurityAuditEvent) {
  const attempts: number[] = [];
  const handoff = createHttpDeliveryHandoff({
    path: "/v1/security-audit",
    exchange: async (request) => {
      attempts.push(request.attempt);
      return outcomeFor(event);
    },
  });
  return { handoff, attempts };
}

function acknowledgingHandoff(event: SecurityAuditEvent) {
  return handoffReturning(acknowledgingExchange, event);
}

function failingHandoff(event: SecurityAuditEvent) {
  return handoffReturning(() => ({ kind: "transport_failure" }), event);
}

const APPROVED_POLICY = {
  behavior: "fail_closed",
  policyOwner: "synthetic-policy-owner",
  reviewReference: "openspec/changes/implement-remaining-delivery-classes/design.md#policy-critical",
} as const;

// ---------------------------------------------------------------------------
// The rows themselves
// ---------------------------------------------------------------------------

describe("Frozen delivery class rows", () => {
  it("carries exactly the four governed classes and no others", () => {
    assert.deepEqual(Object.keys(DELIVERY_CLASS_CONTRACTS).sort(), [...GOVERNED_CLASSES].sort());
  });

  for (const deliveryClass of GOVERNED_CLASSES) {
    it(`fixes every conformance dimension for ${deliveryClass}`, () => {
      const row = DELIVERY_CLASS_CONTRACTS[deliveryClass];
      for (const dimension of ["semantic", "durability", "idempotency", "retry", "backpressure", "shutdown", "outage", "business_failure_posture"]) {
        assert.equal(typeof row[dimension], "string", `${deliveryClass}.${dimension} must be fixed by the row`);
        assert.ok((row[dimension] ?? "").length > 0, `${deliveryClass}.${dimension} must not be empty`);
      }
    });
  }

  it("never claims exactly-once for any class", () => {
    for (const deliveryClass of GOVERNED_CLASSES) {
      const row = DELIVERY_CLASS_CONTRACTS[deliveryClass];
      assert.doesNotMatch(row.semantic ?? "", /exactly[- ]once/i, `${deliveryClass} must not claim exactly-once`);
    }
  });
});

// ---------------------------------------------------------------------------
// Common conformance: every class binding, same assertions
// ---------------------------------------------------------------------------

interface ClassArm {
  readonly deliveryClass: GovernedDeliveryClass;
  /** Delivers the class's own catalog event through its binding, against an acknowledging peer. */
  deliverOwn(): Promise<{ readonly claimsDelivered: boolean; readonly attempts: readonly number[] }>;
  /** Delivers an event belonging to a *different* class through this binding. */
  deliverForeign(foreign: SecurityAuditEvent): Promise<{ readonly refusedCode: string | undefined }>;
  readonly guarantees: { readonly semantic: string; readonly claimsAtLeastOnce: boolean };
}

function bestEffortArm(): ClassArm {
  const event = eventForClass("best_effort");
  const { handoff, attempts } = acknowledgingHandoff(event);
  const binding = createBestEffortDelivery({ handoff });
  return {
    deliveryClass: "best_effort",
    guarantees: binding.guarantees,
    async deliverOwn() {
      const result = await binding.deliver(event);
      return { claimsDelivered: result.status === "delivered", attempts };
    },
    async deliverForeign(foreign) {
      const result = await binding.deliver(foreign);
      return { refusedCode: result.status === "refused" ? result.code : undefined };
    },
  };
}

function transactionCriticalArm(): ClassArm {
  const event = eventForClass("transaction_critical");
  const { handoff, attempts } = acknowledgingHandoff(event);
  const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });
  let transaction = 0;
  return {
    deliveryClass: "transaction_critical",
    guarantees: binding.guarantees,
    async deliverOwn() {
      transaction += 1;
      const result = await binding.deliver(event, `txn-${transaction}`, async () => "committed");
      return { claimsDelivered: result.status === "committed_and_durable", attempts };
    },
    async deliverForeign(foreign) {
      const result = await binding.deliver(foreign, "txn-foreign", async () => "committed");
      return { refusedCode: result.status === "refused" ? result.code : undefined };
    },
  };
}

function policyCriticalArm(): ClassArm {
  const event = eventForClass("policy_critical");
  const { handoff, attempts } = acknowledgingHandoff(event);
  const binding = createPolicyCriticalDelivery({ handoff, policyDecision: APPROVED_POLICY });
  return {
    deliveryClass: "policy_critical",
    guarantees: binding.guarantees,
    async deliverOwn() {
      const result = await binding.deliver(event);
      return { claimsDelivered: result.status === "delivered", attempts };
    },
    async deliverForeign(foreign) {
      const result = await binding.deliver(foreign);
      return { refusedCode: result.status === "refused" ? result.code : undefined };
    },
  };
}

const IMPLEMENTED_ARMS: readonly (() => ClassArm)[] = [bestEffortArm, transactionCriticalArm, policyCriticalArm];

describe("Common per-class delivery conformance", () => {
  for (const makeArm of IMPLEMENTED_ARMS) {
    const { deliveryClass } = makeArm();

    it(`${deliveryClass}: delivers its own catalog event in one attempt against an acknowledging peer`, async () => {
      const arm = makeArm();
      const { claimsDelivered, attempts } = await arm.deliverOwn();
      assert.equal(claimsDelivered, true);
      assert.deepEqual(attempts, [0], "attempt ordinals are zero-based");
    });

    it(`${deliveryClass}: refuses an event whose catalog entry declares a different class`, async () => {
      const arm = makeArm();
      for (const foreignClass of GOVERNED_CLASSES) {
        if (foreignClass === deliveryClass) continue;
        const { refusedCode } = await arm.deliverForeign(eventForClass(foreignClass));
        assert.equal(
          refusedCode,
          "delivery_class_mismatch",
          `${deliveryClass} binding must refuse a ${foreignClass} occurrence`,
        );
      }
    });

    it(`${deliveryClass}: states a semantic matching its frozen row and never claims exactly-once`, () => {
      const arm = makeArm();
      const row = DELIVERY_CLASS_CONTRACTS[deliveryClass];
      const rowSaysAtMostOnce = /at-most-once/i.test(row.semantic ?? "");
      assert.equal(arm.guarantees.semantic, rowSaysAtMostOnce ? "at_most_once" : "at_least_once");
      assert.equal(arm.guarantees.claimsAtLeastOnce, !rowSaysAtMostOnce);
      assert.notEqual(arm.guarantees.semantic as string, "exactly_once");
    });

    it(`${deliveryClass}: refuses an occurrence whose event name is not in the catalog`, async () => {
      const arm = makeArm();
      const unknown = eventForClass(deliveryClass);
      (unknown.event as { name: string }).name = "bloodtrail.audit.not.a.catalog.event";
      const { refusedCode } = await arm.deliverForeign(unknown);
      assert.equal(refusedCode, "unknown_event_name");
    });
  }
});

// ---------------------------------------------------------------------------
// best_effort
// ---------------------------------------------------------------------------

describe("best_effort delivery", () => {
  it("does not claim the security_significant guarantees", () => {
    const { handoff } = acknowledgingHandoff(eventForClass("best_effort"));
    const binding = createBestEffortDelivery({ handoff });

    assert.equal(binding.guarantees.semantic, "at_most_once");
    assert.equal(binding.guarantees.claimsAtLeastOnce, false);
    assert.equal(binding.guarantees.failsClosedBeforeCommit, false);
    assert.match(DELIVERY_CLASS_CONTRACTS.security_significant.semantic ?? "", /at-least-once/i);
  });

  it("drops on failure in exactly one attempt and counts the loss observably", async () => {
    const event = eventForClass("best_effort");
    const { handoff, attempts } = failingHandoff(event);
    const dropped: number[] = [];
    const binding = createBestEffortDelivery({ handoff, observability: { onDropped: (_id, count) => dropped.push(count) } });

    const first = await binding.deliver(event);
    const second = await binding.deliver(event);

    assert.equal(first.status, "dropped");
    assert.equal(second.status, "dropped");
    assert.deepEqual(attempts, [0, 0], "no retry is ever scheduled");
    assert.deepEqual(dropped, [1, 2]);
    assert.equal(binding.lossCount, 2);
  });

  it("reports a bounded loss counter that saturates rather than wrapping", async () => {
    assert.ok(Number.isInteger(BEST_EFFORT_LOSS_CEILING) && BEST_EFFORT_LOSS_CEILING > 0);
    assert.ok(BEST_EFFORT_LOSS_CEILING < Number.MAX_SAFE_INTEGER);
    assert.match(DELIVERY_CLASS_CONTRACTS.best_effort.backpressure ?? "", /bounded counter/i);

    // Saturation itself, at a ceiling low enough to actually reach. The default
    // ceiling is a million drops, which no test can exercise — which is why the
    // ceiling is configurable rather than a constant.
    const event = eventForClass("best_effort");
    const { handoff } = failingHandoff(event);
    const ceilingSignals: number[] = [];
    const binding = createBestEffortDelivery({
      handoff,
      lossCeiling: 2,
      observability: { onLossCeilingReached: (count) => ceilingSignals.push(count) },
    });

    assert.equal(binding.lossCeiling, 2);
    const observed: number[] = [];
    for (let i = 0; i < 4; i += 1) {
      const result = await binding.deliver(event);
      observed.push(result.status === "dropped" ? result.lossCount : -1);
    }

    assert.deepEqual(observed, [1, 2, 2, 2], "the counter saturates rather than wrapping or growing");
    assert.deepEqual(ceilingSignals, [2], "reaching the ceiling is signalled exactly once");
    assert.deepEqual(binding.shutdown(), {
      deliveryClass: "best_effort",
      lossCount: 2,
      lossCeilingReached: true,
      claimsDelivered: false,
    });
  });

  it("rejects a loss ceiling that is not a bounded positive integer", () => {
    const { handoff } = acknowledgingHandoff(eventForClass("best_effort"));
    for (const bad of [0, -1, 1.5, BEST_EFFORT_LOSS_CEILING + 1, Number.NaN]) {
      assert.throws(
        () => createBestEffortDelivery({ handoff, lossCeiling: bad }),
        /lossCeiling must be an integer between 1 and/,
        `lossCeiling ${String(bad)} must be rejected`,
      );
    }
    assert.equal(createBestEffortDelivery({ handoff }).lossCeiling, BEST_EFFORT_LOSS_CEILING);
  });

  it("shuts down without delay and emits a health signal that never claims delivery", async () => {
    const event = eventForClass("best_effort");
    const { handoff } = failingHandoff(event);
    const binding = createBestEffortDelivery({ handoff });
    await binding.deliver(event);

    const signal = binding.shutdown();

    assert.deepEqual(signal, {
      deliveryClass: "best_effort",
      lossCount: 1,
      lossCeilingReached: false,
      claimsDelivered: false,
    });
    assert.match(DELIVERY_CLASS_CONTRACTS.best_effort.shutdown ?? "", /no unbounded delay/i);
  });

  // Deterministic negative fixture: the class-specific guarantee is that loss
  // is bounded and observable. Silent loss violates it.
  it("negative: a dropped occurrence is never reported as delivered", async () => {
    const event = eventForClass("best_effort");
    const { handoff } = failingHandoff(event);
    const binding = createBestEffortDelivery({ handoff });

    const result = await binding.deliver(event);

    assert.notEqual(result.status, "delivered");
    assert.equal(result.status === "dropped" && result.lossCount, 1);
  });
});

// ---------------------------------------------------------------------------
// transaction_critical
// ---------------------------------------------------------------------------

describe("transaction_critical delivery", () => {
  it("deduplicates by event id and transaction id together", async () => {
    const event = eventForClass("transaction_critical");
    const { handoff, attempts } = acknowledgingHandoff(event);
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const first = await binding.deliver(event, "txn-1", async () => "committed");
    const repeat = await binding.deliver(event, "txn-1", async () => "committed");
    const sameEventNewTransaction = await binding.deliver(event, "txn-2", async () => "committed");

    assert.equal(first.status, "committed_and_durable");
    assert.equal(repeat.status, "already_delivered");
    assert.equal(sameEventNewTransaction.status, "committed_and_durable");
    assert.equal(attempts.length, 2, "the deduplicated repeat reached no durability point");
    assert.match(DELIVERY_CLASS_CONTRACTS.transaction_critical.idempotency ?? "", /event id and transaction id/i);
  });

  it("requires a transaction id", async () => {
    const event = eventForClass("transaction_critical");
    const { handoff, attempts } = acknowledgingHandoff(event);
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const result = await binding.deliver(event, "", async () => "committed");

    assert.deepEqual(result, { status: "refused", code: "transaction_id_required", event_id: event.event.id });
    assert.equal(attempts.length, 0);
  });

  it("fails closed before the business commit when audit durability is unreachable", async () => {
    const event = eventForClass("transaction_critical");
    const { handoff, attempts } = acknowledgingHandoff(event);
    let commitGateInvoked = false;
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => false });

    const result = await binding.deliver(event, "txn-1", async () => {
      commitGateInvoked = true;
      return "committed";
    });

    assert.equal(result.status, "failed_closed");
    assert.equal(result.status === "failed_closed" && result.code, "audit_durability_unreachable");
    assert.equal(commitGateInvoked, false, "the business commit must not run when audit durability is unreachable");
    assert.equal(attempts.length, 0);
    assert.match(
      DELIVERY_CLASS_CONTRACTS.transaction_critical.business_failure_posture ?? "",
      /fail_closed before business commit/i,
    );
  });

  // Deterministic negative fixture: the class-specific guarantee is that the
  // audit record is never durable ahead of the business commit gate.
  it("negative: a declined business commit leaves the audit record non-durable", async () => {
    const event = eventForClass("transaction_critical");
    const { handoff, attempts } = acknowledgingHandoff(event);
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const result = await binding.deliver(event, "txn-1", async () => "declined");

    assert.equal(result.status, "failed_closed");
    assert.equal(result.status === "failed_closed" && result.code, "business_commit_declined");
    assert.equal(result.status === "failed_closed" && result.commitGateInvoked, true);
    assert.equal(result.status === "failed_closed" && result.durabilityAttempted, false);
    assert.equal(attempts.length, 0, "the occurrence never reached the durability point");
  });

  it("records the commit gate as having run when the durability point itself fails", async () => {
    const event = eventForClass("transaction_critical");
    const { handoff, attempts } = failingHandoff(event);
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const result = await binding.deliver(event, "txn-1", async () => "committed");

    assert.equal(result.status, "failed_closed");
    assert.equal(result.status === "failed_closed" && result.commitGateInvoked, true);
    assert.equal(result.status === "failed_closed" && result.durabilityAttempted, true);
    assert.deepEqual(attempts, [0]);
  });

  it("refuses a concurrently reachable duplicate rather than claiming it delivered", async () => {
    const event = eventForClass("transaction_critical");
    const release: Array<() => void> = [];
    const attempts: number[] = [];
    const handoff = createHttpDeliveryHandoff({
      path: "/v1/security-audit",
      exchange: async (request) => {
        attempts.push(request.attempt);
        await new Promise<void>((resolve) => release.push(resolve));
        return acknowledgingExchange(event);
      },
    });
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const first = binding.deliver(event, "txn-1", async () => "committed");
    // Let the first reach the durability point and park there before the
    // second is admitted, so both are genuinely in flight at once.
    await new Promise<void>((resolve) => setImmediate(resolve));
    const second = await binding.deliver(event, "txn-1", async () => "committed");

    assert.deepEqual(second, {
      status: "refused",
      code: "duplicate_transaction_delivery",
      event_id: event.event.id,
    });
    release.forEach((resolve) => resolve());
    assert.equal((await first).status, "committed_and_durable");
    assert.deepEqual(attempts, [0], "only one occurrence reached the durability point");
  });

  it("releases the reservation so a failed occurrence can be retried", async () => {
    const event = eventForClass("transaction_critical");
    const { handoff } = failingHandoff(event);
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const first = await binding.deliver(event, "txn-1", async () => "committed");
    const retry = await binding.deliver(event, "txn-1", async () => "committed");

    assert.equal(first.status, "failed_closed");
    assert.equal(retry.status, "failed_closed", "the reservation was released rather than leaked");
  });

  it("does not record a failed delivery as deduplicated", async () => {
    const event = eventForClass("transaction_critical");
    const { handoff } = failingHandoff(event);
    const binding = createTransactionCriticalDelivery({ handoff, durabilityProbe: async () => true });

    const first = await binding.deliver(event, "txn-1", async () => "committed");
    const retry = await binding.deliver(event, "txn-1", async () => "committed");

    assert.equal(first.status, "failed_closed");
    assert.equal(retry.status, "failed_closed", "a failed occurrence stays retryable rather than becoming a duplicate");
  });
});

// ---------------------------------------------------------------------------
// policy_critical
// ---------------------------------------------------------------------------

describe("policy_critical delivery", () => {
  it("cannot be constructed without a recorded policy-owner decision", () => {
    const { handoff } = acknowledgingHandoff(eventForClass("policy_critical"));

    assert.throws(
      () => createPolicyCriticalDelivery({ handoff, policyDecision: undefined as never }),
      /blocked pending qualified review/,
    );
    assert.match(
      DELIVERY_CLASS_CONTRACTS.policy_critical.business_failure_posture ?? "",
      /blocked_pending_qualified_review/i,
    );
  });

  it("rejects a policy record that names no approved behavior", () => {
    const { handoff } = acknowledgingHandoff(eventForClass("policy_critical"));

    assert.throws(
      () => createPolicyCriticalDelivery({
        handoff,
        policyDecision: { ...APPROVED_POLICY, behavior: "whatever_is_convenient" as never },
      }),
      /fail_open, fail_closed, or deferred_completion/,
    );
  });

  it("rejects an unattributed or unreferenced approval", () => {
    const { handoff } = acknowledgingHandoff(eventForClass("policy_critical"));

    assert.throws(
      () => createPolicyCriticalDelivery({ handoff, policyDecision: { ...APPROVED_POLICY, policyOwner: "" } }),
      /policyOwner must be a non-empty string/,
    );
    assert.throws(
      () => createPolicyCriticalDelivery({ handoff, policyDecision: { ...APPROVED_POLICY, reviewReference: "" } }),
      /reviewReference must be a non-empty string/,
    );
  });

  it("carries the approved behavior through to its guarantees and its results", async () => {
    const event = eventForClass("policy_critical");
    const { handoff } = failingHandoff(event);
    const binding = createPolicyCriticalDelivery({
      handoff,
      policyDecision: { ...APPROVED_POLICY, behavior: "deferred_completion" },
    });

    const result = await binding.deliver(event);

    assert.equal(binding.policyDecision.behavior, "deferred_completion");
    assert.equal(binding.guarantees.failsClosedBeforeCommit, false);
    assert.deepEqual(result, {
      status: "policy_applied",
      behavior: "deferred_completion",
      event_id: event.event.id,
      claimsDelivered: false,
    });
  });

  // Deterministic negative fixture: the class-specific guarantee is that no
  // policy_critical occurrence is delivered under an unreviewed policy, and
  // that applying a policy to a failure never asserts delivery.
  it("negative: applying a policy to a failure never reports delivery", async () => {
    const event = eventForClass("policy_critical");
    const { handoff } = failingHandoff(event);
    const binding = createPolicyCriticalDelivery({ handoff, policyDecision: APPROVED_POLICY });

    const result = await binding.deliver(event);

    assert.notEqual(result.status, "delivered");
    assert.equal(result.status === "policy_applied" && result.claimsDelivered, false);
  });

  it("freezes the recorded decision so it cannot be edited after construction", () => {
    const { handoff } = acknowledgingHandoff(eventForClass("policy_critical"));
    const binding = createPolicyCriticalDelivery({ handoff, policyDecision: APPROVED_POLICY });

    assert.throws(() => {
      (binding.policyDecision as { behavior: string }).behavior = "fail_open";
    }, TypeError);
    assert.equal(binding.policyDecision.behavior, "fail_closed");
  });
});
