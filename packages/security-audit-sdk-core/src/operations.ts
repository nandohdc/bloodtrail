import type { EventMethodName, GeneratedOperationContext } from "./generated/contract.generated.js";
import type { AuditIdentifierProvider } from "./providers.js";
import type { AuditResult } from "./errors.js";
import { failure } from "./errors.js";
import { cloneAndFreeze } from "./internal.js";

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

export function createAuditOperation(identifiers: AuditIdentifierProvider, input: AuditOperationInput = {}): AuditOperationHandle {
  return new AuditOperationHandleImpl(
    input.operationId ?? identifiers.operationId(),
    input.transactionId ?? identifiers.transactionId(),
    input.correlationId ?? identifiers.correlationId(),
    input.boundEvent,
    input.transactional ?? true,
  );
}

class AuditOperationHandleImpl implements AuditOperationHandle {
  readonly operationId: string;
  readonly transactionId: string;
  readonly correlationId: string;
  readonly boundEvent: EventMethodName | undefined;
  readonly transactional: boolean;
  #state: AuditOperationState = "started";

  constructor(operationId: string, transactionId: string, correlationId: string, boundEvent: EventMethodName | undefined, transactional: boolean) {
    this.operationId = operationId;
    this.transactionId = transactionId;
    this.correlationId = correlationId;
    this.boundEvent = boundEvent;
    this.transactional = transactional;
  }

  get state(): AuditOperationState {
    return this.#state;
  }

  snapshot(): AuditOperationSnapshot {
    return cloneAndFreeze({
      operation_id: this.operationId,
      transaction_id: this.transactionId,
      correlation_id: this.correlationId,
      state: this.#state,
      commit_state: commitStateForOperationState(this.#state, this.transactional),
      ...(this.boundEvent === undefined ? {} : { bound_event: this.boundEvent }),
      transactional: this.transactional,
    });
  }

  markCommitted(): AuditResult<AuditOperationSnapshot> {
    return this.#transition("committed", ["started"]);
  }

  markNotCommitted(): AuditResult<AuditOperationSnapshot> {
    return this.#transition("not_committed", ["started"]);
  }

  markPartiallyCommitted(): AuditResult<AuditOperationSnapshot> {
    return this.#transition("partially_committed", ["started"]);
  }

  markCompensated(): AuditResult<AuditOperationSnapshot> {
    return this.#transition("compensated", ["committed"]);
  }

  markCancelled(): AuditResult<AuditOperationSnapshot> {
    return this.#transition("cancelled", ["started"]);
  }

  #transition(next: AuditOperationState, allowedFrom: readonly AuditOperationState[]): AuditResult<AuditOperationSnapshot> {
    if (next === this.#state) return { ok: true, value: this.snapshot() };
    if (!allowedFrom.includes(this.#state)) {
      return failure("SDK_INVALID_OPERATION_TRANSITION", "lifecycle", "/operation/state");
    }
    this.#state = next;
    return { ok: true, value: this.snapshot() };
  }
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
