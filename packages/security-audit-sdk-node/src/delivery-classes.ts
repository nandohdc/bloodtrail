// The three governed delivery classes the vertical slice did not exercise:
// `best_effort`, `transaction_critical`, and `policy_critical` (#112).
//
// Each is a *policy over the existing delivery primitives*, not a new
// transport. A class binding decides how many attempts an occurrence gets,
// what happens when capacity or the peer refuses it, what has to be true
// before the occurrence may become durable, and what the binding is permitted
// to claim about the result. The durability substrate itself is injected: the
// contract row for `transaction_critical` names "transactional outbox or
// equivalent behavior, product not selected", and selecting one is a separate
// governed change with its own authorization.
//
// Every rule below traces to one row of the frozen contract's
// `delivery_class_contracts`. `tests/delivery-classes.test.ts` reads those
// rows out of `contracts/security-audit/source/contract.source.json` and
// asserts this module against them, so a row edit breaks the suite rather
// than silently diverging from it.

import type { SecurityAuditEvent } from "@bloodtrail/security-audit-sdk-core";
import { EVENT_CATALOG } from "@bloodtrail/security-audit-sdk-core";

import type { HttpDeliveryHandoff } from "./http-handoff.js";

/** The four governed classes, as the frozen contract names them. */
export type GovernedDeliveryClass = SecurityAuditEvent["event"]["delivery_class"];

/**
 * Saturating ceiling for the `best_effort` loss counter. The contract row asks
 * for "bounded loss reporting"; an unbounded counter is not bounded reporting,
 * and a wrapping one would under-report. Saturating preserves the only fact
 * the signal has to carry — that loss reached the reporting ceiling.
 */
export const BEST_EFFORT_LOSS_CEILING = 1_000_000;

const CATALOG_DELIVERY_BY_NAME: ReadonlyMap<string, GovernedDeliveryClass> = new Map(
  EVENT_CATALOG.map((definition) => [definition.name, definition.delivery]),
);

/**
 * What a class binding is permitted to claim. Exposed so a caller can read the
 * guarantee off the binding rather than inferring it from the class name, and
 * so a `best_effort` binding cannot be mistaken for a stronger one.
 */
export type DeliveryClassGuarantees = Readonly<{
  readonly deliveryClass: GovernedDeliveryClass;
  /** Never `exactly_once`: the conformance contract forbids claiming it for any class. */
  readonly semantic: "at_most_once" | "at_least_once";
  /** True only where the class row promises delivery after producer acceptance. */
  readonly claimsAtLeastOnce: boolean;
  /**
   * True where the row requires refusing the business operation rather than losing the record. For
   * `transaction_critical` it covers only failures before the business commit gate runs; a failure
   * after the gate committed is reported as `audit_durability_failed_after_commit`.
   */
  readonly failsClosedBeforeCommit: boolean;
}>;

export type DeliveryClassRefusalCode =
  | "delivery_class_mismatch"
  | "unknown_event_name"
  | "transaction_id_required"
  | "duplicate_transaction_delivery"
  | "audit_durability_unreachable"
  | "audit_durability_failed_after_commit"
  | "business_commit_declined"
  | "business_commit_unconfirmed";

export type BestEffortObservability = Readonly<{
  /** Called once per dropped occurrence, with the saturating loss total after the drop. */
  onDropped?: (eventId: string, lossCount: number) => void;
  /** Called once when the loss counter first saturates, so the ceiling is never silent. */
  onLossCeilingReached?: (lossCount: number) => void;
}>;

export type BestEffortDeliveryOptions = Readonly<{
  readonly handoff: HttpDeliveryHandoff;
  /**
   * Saturating ceiling for the loss counter, a bounded positive integer.
   * Defaults to `BEST_EFFORT_LOSS_CEILING`. Configurable because "bounded" is
   * a property a deployment may need to set to its own reporting limits — and
   * because a ceiling that can only be reached after a million drops is a
   * claim no test can check.
   */
  readonly lossCeiling?: number;
  readonly observability?: BestEffortObservability;
}>;

export type BestEffortDeliveryResult =
  | Readonly<{ readonly status: "delivered"; readonly event_id: string; readonly attempts: 1 }>
  | Readonly<{
    readonly status: "dropped";
    readonly event_id: string;
    readonly attempts: 1;
    /** Saturating count of occurrences this binding has dropped. */
    readonly lossCount: number;
  }>
  | Readonly<{ readonly status: "refused"; readonly code: DeliveryClassRefusalCode; readonly event_id: string }>;

export interface BestEffortDelivery {
  readonly guarantees: DeliveryClassGuarantees;
  /** The ceiling this binding saturates at. */
  readonly lossCeiling: number;
  /** Saturating count of dropped occurrences; never decreases and never wraps. */
  readonly lossCount: number;
  deliver(event: Readonly<SecurityAuditEvent>): Promise<BestEffortDeliveryResult>;
  /** Returns immediately: the row forbids an unbounded shutdown delay and nothing is outstanding. */
  shutdown(): DeliveryClassHealthSignal;
}

/** The health signal the `best_effort` row requires an outage to record. */
export type DeliveryClassHealthSignal = Readonly<{
  readonly deliveryClass: "best_effort";
  readonly lossCount: number;
  readonly lossCeilingReached: boolean;
  /** Always false: a `best_effort` binding never claims an occurrence was delivered when it was dropped. */
  readonly claimsDelivered: false;
}>;

/**
 * `best_effort`: one attempt, no retry, drop on any non-acknowledgment, and a
 * bounded observable loss counter. Explicitly does not provide the
 * `security_significant` guarantees — read `guarantees` rather than assuming.
 */
export function createBestEffortDelivery(options: BestEffortDeliveryOptions): BestEffortDelivery {
  const handoff = options.handoff;
  const observability = options.observability;
  const lossCeiling = validateLossCeiling(options.lossCeiling);
  let lossCount = 0;
  let ceilingReached = false;

  function recordLoss(eventId: string): number {
    if (lossCount < lossCeiling) {
      lossCount += 1;
      if (lossCount === lossCeiling) {
        ceilingReached = true;
        observability?.onLossCeilingReached?.(lossCount);
      }
    }
    observability?.onDropped?.(eventId, lossCount);
    return lossCount;
  }

  return Object.freeze({
    guarantees: Object.freeze({
      deliveryClass: "best_effort",
      semantic: "at_most_once",
      claimsAtLeastOnce: false,
      failsClosedBeforeCommit: false,
    } satisfies DeliveryClassGuarantees),
    lossCeiling,
    get lossCount(): number {
      return lossCount;
    },
    async deliver(event: Readonly<SecurityAuditEvent>): Promise<BestEffortDeliveryResult> {
      const mismatch = classMismatch(event, "best_effort");
      if (mismatch !== null) return { status: "refused", code: mismatch, event_id: event.event.id };

      const outcome = await handoff.handoff(event, 0);
      if (outcome.status === "acknowledged") {
        return { status: "delivered", event_id: outcome.event_id, attempts: 1 };
      }
      return { status: "dropped", event_id: outcome.event_id, attempts: 1, lossCount: recordLoss(outcome.event_id) };
    },
    shutdown(): DeliveryClassHealthSignal {
      return Object.freeze({
        deliveryClass: "best_effort",
        lossCount,
        lossCeilingReached: ceilingReached,
        claimsDelivered: false,
      });
    },
  } satisfies BestEffortDelivery);
}

function validateLossCeiling(lossCeiling: number | undefined): number {
  if (lossCeiling === undefined) return BEST_EFFORT_LOSS_CEILING;
  if (!isBoundedCeiling(lossCeiling)) {
    throw new TypeError(
      `best_effort lossCeiling must be an integer between 1 and ${BEST_EFFORT_LOSS_CEILING}`,
    );
  }
  return lossCeiling;
}

function isBoundedCeiling(value: number): boolean {
  if (!Number.isInteger(value)) return false;
  if (value < 1) return false;
  return value <= BEST_EFFORT_LOSS_CEILING;
}

/**
 * The caller's business commit. Runs *after* audit durability has been proven
 * reachable and *before* the audit record is made durable, which is the only
 * ordering that satisfies both halves of the `transaction_critical` row.
 *
 * Only `"committed"` continues to the durability point. `"declined"` fails
 * closed as `business_commit_declined`; any other value — which a JavaScript
 * host, a cast or an `any` result can still produce — and a rejection both fail
 * closed as `business_commit_unconfirmed`. It is never invoked for an
 * occurrence whose commit state is `not_committed`.
 */
export type BusinessCommitGate = () => Promise<"committed" | "declined">;

export type TransactionCriticalDeliveryOptions = Readonly<{
  readonly handoff: HttpDeliveryHandoff;
  /**
   * Proves audit durability is reachable before the business commit runs.
   * Resolving anything other than exactly `true`, or rejecting, makes the
   * binding fail closed with the commit gate never invoked, per the row's
   * `fail_closed before business commit if audit durability cannot be reached`.
   */
  readonly durabilityProbe: () => Promise<boolean>;
}>;

export type TransactionCriticalDeliveryResult =
  | Readonly<{
    readonly status: "committed_and_durable";
    readonly event_id: string;
    readonly transaction_id: string;
  }>
  | Readonly<{
    /**
     * A `not_committed` occurrence reached the durability point without the
     * commit gate running. The result makes no commit claim; the occurrence's
     * own commit state says what happened to the business change.
     */
    readonly status: "durable_without_commit";
    readonly event_id: string;
    readonly transaction_id: string;
  }>
  | Readonly<{
    readonly status: "already_delivered";
    readonly event_id: string;
    readonly transaction_id: string;
  }>
  | Readonly<{
    readonly status: "failed_closed";
    readonly code: DeliveryClassRefusalCode;
    readonly event_id: string;
    /** True only when the caller's commit gate actually ran. */
    readonly commitGateInvoked: boolean;
    /** True only when the occurrence reached the durability point. */
    readonly durabilityAttempted: boolean;
  }>
  | Readonly<{ readonly status: "refused"; readonly code: DeliveryClassRefusalCode; readonly event_id: string }>;

export interface TransactionCriticalDelivery {
  readonly guarantees: DeliveryClassGuarantees;
  deliver(
    event: Readonly<SecurityAuditEvent>,
    transactionId: string,
    commitGate: BusinessCommitGate,
  ): Promise<TransactionCriticalDeliveryResult>;
}

/**
 * `transaction_critical`: orders audit durability around the caller's business
 * commit, deduplicated by event id *and* transaction id.
 *
 * The order is fixed and is the whole point of the class:
 *
 *   1. probe audit durability — anything but `true` means fail closed and the
 *      commit gate is never invoked, so no business commit happens without an
 *      audit record being possible;
 *   2. run the caller's commit gate — anything but `"committed"` stops here, so
 *      the audit record never becomes durable ahead of the commit;
 *   3. only then hand the occurrence to the durability point.
 *
 * An occurrence whose commit state is `not_committed` skips step 2 and is
 * reported `durable_without_commit`: there is no business commit to gate, and
 * the result must not claim one.
 *
 * What it does not provide: business and audit atomicity (a failure after the
 * gate committed is reported as `audit_durability_failed_after_commit`, but the
 * commit has happened), persistent retry (one handoff attempt), and
 * deduplication beyond this binding instance (the sets below live in memory).
 */
export function createTransactionCriticalDelivery(
  options: TransactionCriticalDeliveryOptions,
): TransactionCriticalDelivery {
  const handoff = options.handoff;
  const durabilityProbe = options.durabilityProbe;
  // Keys that reached the durability point, and keys currently in flight. The
  // pair is the reserve/complete/release protocol sdk-core already uses for
  // operation handles: reserving synchronously, before the first `await`,
  // is what makes a concurrently reachable duplicate impossible rather than
  // merely unlikely — the same reason the collector's ledger decides in one
  // synchronous step.
  const settled = new Set<string>();
  const reserved = new Set<string>();

  return Object.freeze({
    guarantees: Object.freeze({
      deliveryClass: "transaction_critical",
      semantic: "at_least_once",
      claimsAtLeastOnce: true,
      failsClosedBeforeCommit: true,
    } satisfies DeliveryClassGuarantees),
    async deliver(
      event: Readonly<SecurityAuditEvent>,
      transactionId: string,
      commitGate: BusinessCommitGate,
    ): Promise<TransactionCriticalDeliveryResult> {
      const admission = admitTransaction(event, transactionId, settled, reserved);
      if (admission.refusal !== null) return admission.refusal;

      const key = admission.key;
      reserved.add(key);
      try {
        const result = await runTransactionPipeline({ handoff, durabilityProbe, commitGate, event, transactionId });
        if (reachedDurability(result)) settled.add(key);
        return result;
      } finally {
        reserved.delete(key);
      }
    },
  } satisfies TransactionCriticalDelivery);
}

interface TransactionAdmission {
  readonly key: string;
  readonly refusal: TransactionCriticalDeliveryResult | null;
}

/**
 * Decides admission in one synchronous step, so no `await` can interleave
 * between the duplicate check and the reservation that follows it.
 *
 * A key already settled is reported as already delivered. A key currently in
 * flight is *refused* rather than reported delivered: the first attempt has not
 * finished, so claiming delivery would be a premature success, and running a
 * second pipeline would put the same audit record through two commit gates.
 */
function admitTransaction(
  event: Readonly<SecurityAuditEvent>,
  transactionId: string,
  settled: ReadonlySet<string>,
  reserved: ReadonlySet<string>,
): TransactionAdmission {
  const eventId = event.event.id;
  const mismatch = classMismatch(event, "transaction_critical");
  if (mismatch !== null) {
    return { key: "", refusal: { status: "refused", code: mismatch, event_id: eventId } };
  }
  if (!isFilledString(transactionId)) {
    return { key: "", refusal: { status: "refused", code: "transaction_id_required", event_id: eventId } };
  }

  const key = deduplicationKey(eventId, transactionId);
  if (settled.has(key)) {
    return { key, refusal: { status: "already_delivered", event_id: eventId, transaction_id: transactionId } };
  }
  if (reserved.has(key)) {
    return { key, refusal: { status: "refused", code: "duplicate_transaction_delivery", event_id: eventId } };
  }
  return { key, refusal: null };
}

interface TransactionPipelineInput {
  readonly handoff: HttpDeliveryHandoff;
  readonly durabilityProbe: () => Promise<boolean>;
  readonly commitGate: BusinessCommitGate;
  readonly event: Readonly<SecurityAuditEvent>;
  readonly transactionId: string;
}

/**
 * The fixed order: prove audit durability is reachable, run the business
 * commit unless the occurrence records that nothing committed, then reach the
 * durability point. Returns the settled result and never rejects.
 */
async function runTransactionPipeline(
  input: TransactionPipelineInput,
): Promise<TransactionCriticalDeliveryResult> {
  const eventId = input.event.event.id;

  if ((await settledValue(input.durabilityProbe)) !== true) {
    return failClosed("audit_durability_unreachable", eventId, false, false);
  }
  return input.event.event.commit_state === "not_committed"
    ? deliverWithoutCommit(input)
    : deliverWithCommit(input);
}

/** An occurrence that claims a commit: only a confirmed commit lets it become durable. */
async function deliverWithCommit(input: TransactionPipelineInput): Promise<TransactionCriticalDeliveryResult> {
  const eventId = input.event.event.id;
  const decision = await settledValue(input.commitGate);
  if (decision === "declined") return failClosed("business_commit_declined", eventId, true, false);
  if (decision !== "committed") return failClosed("business_commit_unconfirmed", eventId, true, false);
  if (!(await acknowledged(input))) {
    return failClosed("audit_durability_failed_after_commit", eventId, true, true);
  }
  return durable(input, "committed_and_durable");
}

/** A `not_committed` occurrence: there is no business commit to gate, and the result claims none. */
async function deliverWithoutCommit(input: TransactionPipelineInput): Promise<TransactionCriticalDeliveryResult> {
  if (!(await acknowledged(input))) {
    return failClosed("audit_durability_unreachable", input.event.event.id, false, true);
  }
  return durable(input, "durable_without_commit");
}

/**
 * Settles a caller's probe or gate to a plain value. Its declared type is a
 * promise the binding cannot enforce: a JavaScript host, a cast or an `any`
 * result can resolve anything (#859), and a rejection confirms no more than a
 * wrong value does, so it settles to `undefined`.
 */
async function settledValue(read: () => Promise<unknown>): Promise<unknown> {
  try {
    return await read();
  } catch {
    return undefined;
  }
}

/** True only when the durability point acknowledged; a rejecting handoff has not. */
async function acknowledged(input: TransactionPipelineInput): Promise<boolean> {
  try {
    return (await input.handoff.handoff(input.event, 0)).status === "acknowledged";
  } catch {
    return false;
  }
}

function durable(
  input: TransactionPipelineInput,
  status: "committed_and_durable" | "durable_without_commit",
): TransactionCriticalDeliveryResult {
  return Object.freeze({ status, event_id: input.event.event.id, transaction_id: input.transactionId });
}

/** Only a result that reached the durability point is recorded for deduplication. */
function reachedDurability(result: TransactionCriticalDeliveryResult): boolean {
  return result.status === "committed_and_durable" || result.status === "durable_without_commit";
}

/** The behaviours a policy owner may approve, exactly as the contract row enumerates them. */
export type PolicyCriticalBehavior = "fail_open" | "fail_closed" | "deferred_completion";

/**
 * A policy owner's recorded approval. The row's `business_failure_posture` is
 * `blocked_pending_qualified_review`, so the absence of this record is not a
 * default — it is a deterministic construction failure.
 */
export type PolicyOwnerDecisionRecord = Readonly<{
  readonly behavior: PolicyCriticalBehavior;
  /** Who approved it. Non-empty: an unattributed approval is not a reviewed policy. */
  readonly policyOwner: string;
  /** Where the review is recorded, so the approval is checkable rather than asserted. */
  readonly reviewReference: string;
}>;

export type PolicyCriticalDeliveryOptions = Readonly<{
  readonly handoff: HttpDeliveryHandoff;
  readonly policyDecision: PolicyOwnerDecisionRecord;
}>;

export type PolicyCriticalDeliveryResult =
  | Readonly<{ readonly status: "delivered"; readonly event_id: string }>
  | Readonly<{
    readonly status: "policy_applied";
    readonly behavior: PolicyCriticalBehavior;
    readonly event_id: string;
    /** Always false: applying a policy to a failure never asserts the occurrence was delivered. */
    readonly claimsDelivered: false;
  }>
  | Readonly<{ readonly status: "refused"; readonly code: DeliveryClassRefusalCode; readonly event_id: string }>;

export interface PolicyCriticalDelivery {
  readonly guarantees: DeliveryClassGuarantees;
  readonly policyDecision: PolicyOwnerDecisionRecord;
  deliver(event: Readonly<SecurityAuditEvent>): Promise<PolicyCriticalDeliveryResult>;
}

/**
 * `policy_critical`: identical delivery mechanics to `security_significant`,
 * plus a recorded policy-owner decision that fixes what happens on failure.
 *
 * Construction throws when that record is missing or incomplete. That matches
 * this SDK's one exception to results-not-exceptions — configuration errors
 * throw — and it is the only treatment consistent with
 * `blocked_pending_qualified_review`: a binding that could be built without an
 * approved policy would have a default, and the row says there is none.
 */
export function createPolicyCriticalDelivery(options: PolicyCriticalDeliveryOptions): PolicyCriticalDelivery {
  const policyDecision = validatePolicyDecision(options.policyDecision);
  const handoff = options.handoff;

  return Object.freeze({
    guarantees: Object.freeze({
      deliveryClass: "policy_critical",
      semantic: "at_least_once",
      claimsAtLeastOnce: true,
      failsClosedBeforeCommit: policyDecision.behavior === "fail_closed",
    } satisfies DeliveryClassGuarantees),
    policyDecision,
    async deliver(event: Readonly<SecurityAuditEvent>): Promise<PolicyCriticalDeliveryResult> {
      const eventId = event.event.id;
      const mismatch = classMismatch(event, "policy_critical");
      if (mismatch !== null) return { status: "refused", code: mismatch, event_id: eventId };

      const outcome = await handoff.handoff(event, 0);
      if (outcome.status === "acknowledged") return { status: "delivered", event_id: outcome.event_id };
      return {
        status: "policy_applied",
        behavior: policyDecision.behavior,
        event_id: eventId,
        claimsDelivered: false,
      };
    },
  } satisfies PolicyCriticalDelivery);
}

/**
 * Exact-match class binding. A binding accepts only occurrences whose catalog
 * entry declares its own class.
 *
 * Exact match rather than a "class is at least as strong" ordering, because
 * the contract fixes no such ordering and the substitution is unsafe in both
 * directions: delivering a `transaction_critical` occurrence through
 * `best_effort` tolerates loss the catalog says is intolerable, and delivering
 * a `best_effort` occurrence through `transaction_critical` gives an event
 * whose posture is `fail_open` the power to block a business commit.
 */
function classMismatch(
  event: Readonly<SecurityAuditEvent>,
  boundClass: GovernedDeliveryClass,
): DeliveryClassRefusalCode | null {
  const declared = CATALOG_DELIVERY_BY_NAME.get(event.event.name);
  if (declared === undefined) return "unknown_event_name";
  return declared === boundClass ? null : "delivery_class_mismatch";
}

/**
 * Dedupe by event id *and* transaction id, as the row requires. The separator
 * is excluded from the UUID and transaction-id alphabets in use, so two
 * distinct pairs cannot collide into one key.
 */
function deduplicationKey(eventId: string, transactionId: string): string {
  return `${eventId} ${transactionId}`;
}

function failClosed(
  code: DeliveryClassRefusalCode,
  eventId: string,
  commitGateInvoked: boolean,
  durabilityAttempted: boolean,
): TransactionCriticalDeliveryResult {
  return Object.freeze({
    status: "failed_closed",
    code,
    event_id: eventId,
    commitGateInvoked,
    durabilityAttempted,
  });
}

const APPROVED_POLICY_BEHAVIORS = new Set<PolicyCriticalBehavior>([
  "fail_open",
  "fail_closed",
  "deferred_completion",
]);

/**
 * One rule per way a policy record can be incomplete, as a table so each
 * carries its own diagnostic and none can be lost inside a combined condition
 * — the same shape the repository's merge gate uses for its verdict rules.
 */
const POLICY_DECISION_RULES: ReadonlyArray<
  readonly [(record: PolicyOwnerDecisionRecord) => boolean, string]
> = [
  [
    (record) => APPROVED_POLICY_BEHAVIORS.has(record.behavior),
    "behavior must name fail_open, fail_closed, or deferred_completion",
  ],
  [(record) => isFilledString(record.policyOwner), "policyOwner must be a non-empty string"],
  [(record) => isFilledString(record.reviewReference), "reviewReference must be a non-empty string"],
];

function isFilledString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function validatePolicyDecision(record: PolicyOwnerDecisionRecord | undefined): PolicyOwnerDecisionRecord {
  if (record === undefined || record === null) throw missingPolicyDecision("record is absent");
  for (const [holds, detail] of POLICY_DECISION_RULES) {
    if (!holds(record)) throw missingPolicyDecision(detail);
  }
  return Object.freeze({
    behavior: record.behavior,
    policyOwner: record.policyOwner,
    reviewReference: record.reviewReference,
  });
}

function missingPolicyDecision(detail: string): TypeError {
  return new TypeError(
    `policy_critical delivery is blocked pending qualified review: policy owner decision ${detail}`,
  );
}
