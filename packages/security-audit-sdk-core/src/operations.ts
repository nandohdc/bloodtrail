import type { EventMethodName, EventName, GeneratedOperationContext } from "./generated/contract.generated.js";
import type { AuditIdentifierProvider } from "./providers.js";
import type { AuditResult } from "./errors.js";
import { failure } from "./errors.js";
import { cloneAndFreeze } from "./internal.js";

declare const auditOperationHandleBrand: unique symbol;

export type AuditOperationState = "started" | "committed" | "not_committed" | "partially_committed" | "compensated" | "cancelled";

export interface AuditOperationInput {
  readonly operationId?: string;
  readonly transactionId?: string;
  readonly correlationId?: string;
  /** Binds the operation to exactly one named event method; other methods cannot complete it. */
  readonly boundEvent?: EventMethodName;
  /** Explicitly declares that this unit of work has no commit step to await (default true). */
  readonly transactional?: boolean;
}

export interface AuditOperationSnapshot extends GeneratedOperationContext {
  readonly operation_id: string;
  readonly transaction_id: string;
  readonly correlation_id: string;
  readonly state: AuditOperationState;
  readonly commit_state: "pending" | "committed" | "not_committed" | "partially_committed" | "compensated" | "not_applicable";
  readonly bound_event?: EventMethodName;
  readonly transactional: boolean;
}

export interface AuditOperationHandle {
  /** Compile-time opacity only; runtime authority is held in an SDK-instance-private WeakMap. */
  readonly [auditOperationHandleBrand]: true;
  readonly operationId: string;
  readonly transactionId: string;
  readonly correlationId: string;
  readonly boundEvent: EventMethodName | undefined;
  readonly transactional: boolean;
  readonly state: AuditOperationState;
  snapshot(): AuditOperationSnapshot;
  markCommitted(): AuditResult<AuditOperationSnapshot>;
  markNotCommitted(): AuditResult<AuditOperationSnapshot>;
  markPartiallyCommitted(): AuditResult<AuditOperationSnapshot>;
  markCompensated(): AuditResult<AuditOperationSnapshot>;
  markCancelled(): AuditResult<AuditOperationSnapshot>;
}

type AuditOperationCompletionState = "reserved" | "completed";

export interface AuditOperationAuthority {
  issue(input?: AuditOperationInput): AuditResult<AuditOperationHandle>;
  resolve(input: unknown): AuditResult<AuditOperationSnapshot | undefined>;
  completionState(input: unknown, eventName: EventName): AuditResult<AuditOperationCompletionState | undefined>;
  reserveCompletion(input: unknown, eventName: EventName): AuditResult<boolean>;
  completeCompletion(input: unknown, eventName: EventName): AuditResult<void>;
  releaseCompletion(input: unknown, eventName: EventName): AuditResult<void>;
}

interface AuditOperationEvidence {
  readonly operationId: string;
  readonly transactionId: string;
  readonly correlationId: string;
  readonly boundEvent: EventMethodName | undefined;
  readonly transactional: boolean;
  state: AuditOperationState;
  readonly completions: Map<EventName, AuditOperationCompletionState>;
}

export function createAuditOperationAuthority(identifiers: AuditIdentifierProvider): AuditOperationAuthority {
  const evidenceByHandle = new WeakMap<object, AuditOperationEvidence>();

  const snapshot = (evidence: AuditOperationEvidence): AuditOperationSnapshot => cloneAndFreeze({
    operation_id: evidence.operationId,
    transaction_id: evidence.transactionId,
    correlation_id: evidence.correlationId,
    state: evidence.state,
    commit_state: commitStateForOperationState(evidence.state, evidence.transactional),
    ...(evidence.boundEvent === undefined ? {} : { bound_event: evidence.boundEvent }),
    transactional: evidence.transactional,
  });

  const transition = (
    handle: object,
    next: AuditOperationState,
    allowedFrom: readonly AuditOperationState[],
  ): AuditResult<AuditOperationSnapshot> => {
    const evidence = evidenceByHandle.get(handle);
    if (!evidence) return failure("SDK_INVALID_OPERATION_TRANSITION", "lifecycle", "/operation");
    if (next === evidence.state) return { ok: true, value: snapshot(evidence) };
    if (!allowedFrom.includes(evidence.state)) {
      return failure("SDK_INVALID_OPERATION_TRANSITION", "lifecycle", "/operation/state");
    }
    evidence.state = next;
    return { ok: true, value: snapshot(evidence) };
  };

  class AuditOperationHandleImpl implements AuditOperationHandle {
    declare readonly [auditOperationHandleBrand]: true;

    get operationId(): string { return this.#evidence().operationId; }
    get transactionId(): string { return this.#evidence().transactionId; }
    get correlationId(): string { return this.#evidence().correlationId; }
    get boundEvent(): EventMethodName | undefined { return this.#evidence().boundEvent; }
    get transactional(): boolean { return this.#evidence().transactional; }
    get state(): AuditOperationState { return this.#evidence().state; }

    snapshot(): AuditOperationSnapshot { return snapshot(this.#evidence()); }
    markCommitted(): AuditResult<AuditOperationSnapshot> { return transition(this, "committed", ["started"]); }
    markNotCommitted(): AuditResult<AuditOperationSnapshot> { return transition(this, "not_committed", ["started"]); }
    markPartiallyCommitted(): AuditResult<AuditOperationSnapshot> { return transition(this, "partially_committed", ["started"]); }
    markCompensated(): AuditResult<AuditOperationSnapshot> { return transition(this, "compensated", ["committed"]); }
    markCancelled(): AuditResult<AuditOperationSnapshot> { return transition(this, "cancelled", ["started"]); }

    #evidence(): AuditOperationEvidence {
      const evidence = evidenceByHandle.get(this);
      if (!evidence) throw new TypeError("Invalid operation handle receiver");
      return evidence;
    }
  }

  const resolveEvidence = (input: unknown): AuditResult<AuditOperationEvidence | undefined> => {
    if (input === undefined) return { ok: true, value: undefined };
    if ((typeof input !== "object" && typeof input !== "function") || input === null) {
      return failure("SDK_INVALID_OPERATION_TRANSITION", "lifecycle", "/operation");
    }
    const evidence = evidenceByHandle.get(input);
    if (!evidence) return failure("SDK_INVALID_OPERATION_TRANSITION", "lifecycle", "/operation");
    return { ok: true, value: evidence };
  };

  return {
    issue(input: AuditOperationInput = {}): AuditResult<AuditOperationHandle> {
      const operationId = issueIdentifier(identifiers, "operationId", input.operationId);
      if (!operationId.ok) return operationId;
      const transactionId = issueIdentifier(identifiers, "transactionId", input.transactionId);
      if (!transactionId.ok) return transactionId;
      const correlationId = issueIdentifier(identifiers, "correlationId", input.correlationId);
      if (!correlationId.ok) return correlationId;
      const evidence: AuditOperationEvidence = {
        operationId: operationId.value,
        transactionId: transactionId.value,
        correlationId: correlationId.value,
        boundEvent: input.boundEvent,
        transactional: input.transactional ?? true,
        state: "started",
        completions: new Map<EventName, AuditOperationCompletionState>(),
      };
      const handle = Object.freeze(new AuditOperationHandleImpl());
      evidenceByHandle.set(handle, evidence);
      return { ok: true, value: handle };
    },

    resolve(input: unknown): AuditResult<AuditOperationSnapshot | undefined> {
      const resolved = resolveEvidence(input);
      if (!resolved.ok) return resolved;
      if (resolved.value === undefined) return { ok: true, value: undefined };
      return { ok: true, value: snapshot(resolved.value) };
    },

    completionState(input: unknown, eventName: EventName): AuditResult<AuditOperationCompletionState | undefined> {
      const resolved = resolveEvidence(input);
      if (!resolved.ok) return resolved;
      if (resolved.value === undefined) return { ok: true, value: undefined };
      return { ok: true, value: resolved.value.completions.get(eventName) };
    },

    reserveCompletion(input: unknown, eventName: EventName): AuditResult<boolean> {
      const resolved = resolveEvidence(input);
      if (!resolved.ok) return resolved;
      if (resolved.value === undefined) return { ok: true, value: false };
      if (resolved.value.completions.has(eventName)) return { ok: true, value: false };
      resolved.value.completions.set(eventName, "reserved");
      return { ok: true, value: true };
    },

    completeCompletion(input: unknown, eventName: EventName): AuditResult<void> {
      const resolved = resolveEvidence(input);
      if (!resolved.ok) return resolved;
      if (resolved.value?.completions.get(eventName) === "reserved") {
        resolved.value.completions.set(eventName, "completed");
      }
      return { ok: true, value: undefined };
    },

    releaseCompletion(input: unknown, eventName: EventName): AuditResult<void> {
      const resolved = resolveEvidence(input);
      if (!resolved.ok) return resolved;
      if (resolved.value?.completions.get(eventName) === "reserved") {
        resolved.value.completions.delete(eventName);
      }
      return { ok: true, value: undefined };
    },
  };
}

const issuedIdentifierPaths = {
  operationId: "/operation/operation_id",
  transactionId: "/operation/transaction_id",
  correlationId: "/operation/correlation_id",
} as const;

function issueIdentifier(
  identifiers: AuditIdentifierProvider,
  method: keyof typeof issuedIdentifierPaths,
  supplied: string | undefined,
): AuditResult<string> {
  if (supplied !== undefined && supplied !== null) return { ok: true, value: supplied };
  try { return { ok: true, value: identifiers[method]() }; }
  catch { return failure("SDK_INVALID_IDENTIFIER", "validation", issuedIdentifierPaths[method]); }
}

export function commitStateForOperationState(state: AuditOperationState, transactional = true): AuditOperationSnapshot["commit_state"] {
  if (state === "started" && !transactional) return "not_applicable";
  switch (state) {
    case "started": return "pending";
    case "committed": return "committed";
    case "not_committed": return "not_committed";
    case "partially_committed": return "partially_committed";
    case "compensated": return "compensated";
    case "cancelled": return "not_committed";
  }
}
