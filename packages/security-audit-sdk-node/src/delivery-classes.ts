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

import { nodeByteLength } from "./byte-length.js";
import { EVENT_MAX_BYTES, type HttpDeliveryHandoff } from "./http-handoff.js";

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

// The commit states each event's own catalog entry allows. They are copied once
// from sdk-core's exported catalog, so a later change to that array cannot widen
// what `transaction_critical` admission accepts (#913).
const CATALOG_COMMIT_STATES_BY_NAME: ReadonlyMap<string, ReadonlySet<string>> = new Map(
  EVENT_CATALOG.map((definition) => [definition.name, new Set<string>(definition.commit)]),
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
  /**
   * `transaction_critical` only: the occurrence's commit state is absent, or is
   * not one its own catalog entry allows. Refused before the probe runs (#913).
   */
  | "commit_state_not_allowed"
  /**
   * `transaction_critical` only: the occurrence has no JSON serialization, so it
   * could never become durable. Refused before the probe runs (#913).
   */
  | "occurrence_not_serializable"
  /**
   * `transaction_critical` only: the occurrence's JSON serialization is larger
   * than the contract's event size limit, so it could never become durable.
   * Refused before the probe runs (#945).
   */
  | "occurrence_too_large"
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
     * A `partially_committed` occurrence reached the durability point after the
     * commit gate ran. The result truthfully reflects that the business change
     * was partial rather than claiming a full commit (#869).
     */
    readonly status: "partially_committed_and_durable";
    readonly event_id: string;
    readonly transaction_id: string;
  }>
  | Readonly<{
    /**
     * A `compensated` occurrence reached the durability point after the
     * commit gate ran. The result truthfully reflects that the business change
     * was compensated/undone rather than claiming a full commit (#869).
     */
    readonly status: "compensated_and_durable";
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
 * Admission comes first (#913). It takes one snapshot of the occurrence: its
 * JSON serialization, parsed back and deeply frozen. Serialization is the only
 * caller code admission runs, except that a serialization refusal reads the
 * caller's identifier once more, through a guarded read. Every later step reads only that snapshot: the admission
 * checks, the deduplication key, the occurrence handed to the durability point,
 * and the result. Before anything runs, admission refuses, in this order:
 *
 *   - an occurrence with no JSON serialization (`occurrence_not_serializable`);
 *   - an event name outside the catalog, or one of another class;
 *   - an empty transaction identifier;
 *   - a commit state that the occurrence's own catalog entry does not allow, or
 *     none (`commit_state_not_allowed`).
 *
 * After admission the order is fixed, and it is the whole point of the class:
 *
 *   1. probe audit durability — anything but `true` means fail closed and the
 *      commit gate is never invoked, so no business commit happens without an
 *      audit record being possible;
 *   2. run the caller's commit gate — anything but `"committed"` stops here, so
 *      the audit record never becomes durable ahead of the commit;
 *   3. only then hand the snapshot to the durability point.
 *
 * The snapshot's commit state selects one entry of `OUTCOME_BY_COMMIT_STATE`,
 * which decides both whether step 2 runs and which status a durable occurrence
 * reports. `not_committed` skips step 2 and is reported
 * `durable_without_commit`, because there is no business commit to gate.
 * `partially_committed` and `compensated` are reported with their qualified
 * statuses (#869). No commit state reaches a commit claim by default.
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
        const result = await runTransactionPipeline({
          ...admission.admitted,
          handoff,
          durabilityProbe,
          commitGate,
          transactionId,
        });
        if (reachedDurability(result)) settled.add(key);
        return result;
      } finally {
        reserved.delete(key);
      }
    },
  } satisfies TransactionCriticalDelivery);
}

type DurableTransactionStatus =
  | "committed_and_durable"
  | "partially_committed_and_durable"
  | "compensated_and_durable"
  | "durable_without_commit";

/** What one commit state decides: whether the commit gate runs, and the status once durable. */
type TransactionOutcome = Readonly<{
  readonly runsCommitGate: boolean;
  readonly status: DurableTransactionStatus;
}>;

/** Every commit state that some `transaction_critical` catalog entry allows. */
type TransactionCriticalCommitState = Extract<
  (typeof EVENT_CATALOG)[number],
  { readonly delivery: "transaction_critical" }
>["commit"][number];

/**
 * The one mapping from commit state to outcome (#913). It is total over the
 * commit states the catalog allows for this class: the `satisfies` clause stops
 * compiling if the catalog gains one. It has no default, so a commit state
 * without an entry is refused at admission and never claimed.
 */
const OUTCOME_BY_COMMIT_STATE = Object.freeze({
  committed: Object.freeze({ runsCommitGate: true, status: "committed_and_durable" }),
  partially_committed: Object.freeze({ runsCommitGate: true, status: "partially_committed_and_durable" }),
  compensated: Object.freeze({ runsCommitGate: true, status: "compensated_and_durable" }),
  not_committed: Object.freeze({ runsCommitGate: false, status: "durable_without_commit" }),
} satisfies Record<TransactionCriticalCommitState, TransactionOutcome>);

/** An occurrence that passed every admission check. */
interface AdmittedOccurrence {
  /** The snapshot: the only view of the occurrence that any later step reads. */
  readonly occurrence: Readonly<SecurityAuditEvent>;
  /** The snapshot's own identifier, used as it is in the key and the result. */
  readonly eventId: string;
  readonly outcome: TransactionOutcome;
}

type AdmissionRefusal = Readonly<{ readonly refusal: TransactionCriticalDeliveryResult }>;

type TransactionAdmission =
  | AdmissionRefusal
  | Readonly<{ readonly refusal: null; readonly key: string; readonly admitted: AdmittedOccurrence }>;

/**
 * Decides admission in one synchronous step, so no `await` can interleave
 * between the duplicate check and the reservation that follows it.
 *
 * Every refusal from the occurrence checks is decided before the duplicate
 * check (#913). A refused occurrence is therefore never recorded or reserved,
 * and once corrected, its pair stays deliverable.
 *
 * A key already settled is reported as already delivered. A key currently in
 * flight is *refused* rather than reported delivered: the first attempt has not
 * finished, so claiming delivery would be a premature success, and running a
 * second pipeline would put the same audit record through two commit gates.
 */
function admitTransaction(
  event: unknown,
  transactionId: string,
  settled: ReadonlySet<string>,
  reserved: ReadonlySet<string>,
): TransactionAdmission {
  const checked = checkOccurrence(event, transactionId);
  if ("refusal" in checked) return checked;

  const eventId = checked.eventId;
  const key = deduplicationKey(eventId, transactionId);
  if (settled.has(key)) {
    return { refusal: { status: "already_delivered", event_id: eventId, transaction_id: transactionId } };
  }
  if (reserved.has(key)) {
    return { refusal: { status: "refused", code: "duplicate_transaction_delivery", event_id: eventId } };
  }
  return { refusal: null, key, admitted: checked };
}

/**
 * The occurrence checks, in their fixed order (#913, #945). Each reads the
 * snapshot through guarded access, so no input makes admission throw. Each
 * refusal reports the identifier it can read as a string, or the empty string.
 *
 * The size is checked on the serialization alone, before it is parsed and
 * frozen, so an oversized input costs one serialization and one byte count.
 * No snapshot exists yet for those two refusals, so they read the identifier
 * from the caller's object.
 */
function checkOccurrence(event: unknown, transactionId: string): AdmittedOccurrence | AdmissionRefusal {
  const serialized = serializationOf(event);
  if (serialized === null) return refusedFor("occurrence_not_serializable", event);
  if (nodeByteLength.byteLength(serialized) > EVENT_MAX_BYTES) return refusedFor("occurrence_too_large", event);
  const snapshot = snapshotOf(serialized);
  if (snapshot === null) return refusedFor("occurrence_not_serializable", event);

  const fields = fieldOf(snapshot.value, "event");
  const name = fieldOf(fields, "name");
  const mismatch = classMismatchFor(name, "transaction_critical");
  if (mismatch !== null) return refusedFor(mismatch, snapshot.value);
  if (!isFilledString(transactionId)) return refusedFor("transaction_id_required", snapshot.value);
  const outcome = outcomeFor(name as string, fieldOf(fields, "commit_state"));
  if (outcome === null) return refusedFor("commit_state_not_allowed", snapshot.value);

  const occurrence = snapshot.value as Readonly<SecurityAuditEvent>;
  return { occurrence, eventId: occurrence.event.id, outcome };
}

/**
 * The occurrence's JSON serialization, or `null` when there is none: a BigInt,
 * a cycle, a throwing getter or `toJSON`, or a value whose serialization is not
 * a string.
 */
function serializationOf(event: unknown): string | null {
  try {
    const serialized: unknown = JSON.stringify(event);
    return typeof serialized === "string" ? serialized : null;
  } catch {
    return null;
  }
}

/**
 * The occurrence's one snapshot: its JSON serialization, parsed back and frozen
 * at every depth (#913). The handoff serializes it again into a body of the
 * same size, and for an ordinary object into the same bytes, so what is made
 * durable is what was admitted. `null` when the serialization cannot be parsed
 * back.
 */
function snapshotOf(serialized: string): Readonly<{ readonly value: unknown }> | null {
  try {
    return { value: deepFreeze(JSON.parse(serialized)) };
  } catch {
    return null;
  }
}

/** Freezes parsed JSON at every depth. Iterative, so nesting depth cannot exhaust the stack. */
function deepFreeze<T>(root: T): T {
  const pending: unknown[] = [root];
  while (pending.length > 0) {
    const value = pending.pop();
    if (value !== null && typeof value === "object") {
      for (const child of Object.values(Object.freeze(value))) pending.push(child);
    }
  }
  return root;
}

/** Reads one property without letting a getter or a proxy throw out of admission. */
function fieldOf(value: unknown, key: string): unknown {
  if (value === null || typeof value !== "object") return undefined;
  try {
    return (value as Readonly<Record<string, unknown>>)[key];
  } catch {
    return undefined;
  }
}

/** The identifier a refusal reports: a string read without throwing, or the empty string. */
function identifierOf(source: unknown): string {
  const id = fieldOf(fieldOf(source, "event"), "id");
  return typeof id === "string" ? id : "";
}

function refusedFor(code: DeliveryClassRefusalCode, source: unknown): AdmissionRefusal {
  return { refusal: { status: "refused", code, event_id: identifierOf(source) } };
}

/**
 * The outcome for a commit state that the occurrence's own catalog entry
 * allows, or `null` to refuse it. The entry is the event's own, never the union
 * of every `transaction_critical` entry: the catalog allows commit states per
 * event, which is the rule sdk-core's semantic validation applies.
 */
function outcomeFor(name: string, commitState: unknown): TransactionOutcome | null {
  if (typeof commitState !== "string") return null;
  if (CATALOG_COMMIT_STATES_BY_NAME.get(name)?.has(commitState) !== true) return null;
  if (!Object.hasOwn(OUTCOME_BY_COMMIT_STATE, commitState)) return null;
  return OUTCOME_BY_COMMIT_STATE[commitState as TransactionCriticalCommitState];
}

interface TransactionPipelineInput extends AdmittedOccurrence {
  readonly handoff: HttpDeliveryHandoff;
  readonly durabilityProbe: () => Promise<boolean>;
  readonly commitGate: BusinessCommitGate;
  readonly transactionId: string;
}

/**
 * The fixed order: prove audit durability is reachable, run the business
 * commit when the admitted outcome calls for one, then reach the durability
 * point. Returns the settled result and never rejects.
 */
async function runTransactionPipeline(
  input: TransactionPipelineInput,
): Promise<TransactionCriticalDeliveryResult> {
  if ((await settledValue(input.durabilityProbe)) !== true) {
    return failClosed("audit_durability_unreachable", input.eventId, false, false);
  }
  return input.outcome.runsCommitGate ? deliverWithCommit(input) : deliverWithoutCommit(input);
}

/** An occurrence that claims a commit: only a confirmed commit lets it become durable. */
async function deliverWithCommit(input: TransactionPipelineInput): Promise<TransactionCriticalDeliveryResult> {
  const eventId = input.eventId;
  const decision = await settledValue(input.commitGate);
  if (decision === "declined") return failClosed("business_commit_declined", eventId, true, false);
  if (decision !== "committed") return failClosed("business_commit_unconfirmed", eventId, true, false);
  if (!(await acknowledged(input))) {
    return failClosed("audit_durability_failed_after_commit", eventId, true, true);
  }
  return durable(input);
}

/** A `not_committed` occurrence: there is no business commit to gate, and the result claims none. */
async function deliverWithoutCommit(input: TransactionPipelineInput): Promise<TransactionCriticalDeliveryResult> {
  if (!(await acknowledged(input))) {
    return failClosed("audit_durability_unreachable", input.eventId, false, true);
  }
  return durable(input);
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
    return (await input.handoff.handoff(input.occurrence, 0)).status === "acknowledged";
  } catch {
    return false;
  }
}

/** The status is the admitted outcome's, never one read from the occurrence again. */
function durable(input: TransactionPipelineInput): TransactionCriticalDeliveryResult {
  return Object.freeze({ status: input.outcome.status, event_id: input.eventId, transaction_id: input.transactionId });
}

/** Only a result that reached the durability point is recorded for deduplication. */
function reachedDurability(result: TransactionCriticalDeliveryResult): boolean {
  return (
    result.status === "committed_and_durable" ||
    result.status === "partially_committed_and_durable" ||
    result.status === "compensated_and_durable" ||
    result.status === "durable_without_commit"
  );
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

/** The class check for a binding's own occurrence; see `classMismatchFor`. */
function classMismatch(
  event: Readonly<SecurityAuditEvent>,
  boundClass: GovernedDeliveryClass,
): DeliveryClassRefusalCode | null {
  return classMismatchFor(event.event.name, boundClass);
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
function classMismatchFor(name: unknown, boundClass: GovernedDeliveryClass): DeliveryClassRefusalCode | null {
  const declared = typeof name === "string" ? CATALOG_DELIVERY_BY_NAME.get(name) : undefined;
  if (declared === undefined) return "unknown_event_name";
  return declared === boundClass ? null : "delivery_class_mismatch";
}

/**
 * Dedupe by event id *and* transaction id, as the row requires. The key is a
 * JSON array of the identifier's type, the identifier and the transaction id.
 * Two distinct pairs therefore cannot share a key, whatever either identifier
 * holds. Building it cannot throw either: the identifier comes from the
 * snapshot, which is JSON data, and nothing in JSON data can change how it
 * serializes (#913).
 */
function deduplicationKey(eventId: unknown, transactionId: string): string {
  return JSON.stringify([typeof eventId, eventId, transactionId]);
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
