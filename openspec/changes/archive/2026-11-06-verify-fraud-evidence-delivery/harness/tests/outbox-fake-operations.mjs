// Operation authority belongs to one SDK instance, as operations.ts does.
import { randomUUID } from "node:crypto";
import { checkOperationEvidence, fakeFailure } from "./fake-sdk-common.mjs";

export const failure = fakeFailure;

function createHandle(options) {
  let state = "started";
  const operationId = options.operationId ?? `op_${randomUUID()}`;
  const transactionId = options.transactionId ?? `tx_${randomUUID()}`;
  const correlationId = options.correlationId ?? `cor_${randomUUID()}`;
  return {
    operationId, transactionId, correlationId, boundEvent: options.boundEvent,
    get state() { return state; },
    markCommitted() {
      state = "committed";
      return { ok: true, value: this.snapshot() };
    },
    snapshot() {
      return {
        operation_id: operationId, transaction_id: transactionId, correlation_id: correlationId,
        state, commit_state: state === "committed" ? "committed" : "pending",
        transactional: true, bound_event: options.boundEvent,
      };
    },
  };
}

export function operationAuthority() {
  const handles = new WeakSet();
  return {
    beginOperation(options = {}) {
      const handle = createHandle(options);
      handles.add(handle);
      return { ok: true, value: handle };
    },
    check(handle, method) {
      if (handle === undefined) return null;
      return checkOperationEvidence(handles.has(handle) ? handle : null, method);
    },
  };
}
