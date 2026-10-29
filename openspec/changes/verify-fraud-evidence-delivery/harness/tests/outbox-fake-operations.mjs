// Operation authority belongs to one SDK instance, as operations.ts does.
import { randomUUID } from "node:crypto";

export function failure(code, path, category = "validation") {
  return { ok: false, error: { code, path, category } };
}

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
      if (!handles.has(handle)) return failure("SDK_INVALID_OPERATION_TRANSITION", "/operation", "lifecycle");
      const mismatch = handle.boundEvent !== undefined && handle.boundEvent !== method;
      if (mismatch) return failure("SDK_OPERATION_EVENT_MISMATCH", "/operation/bound_event", "lifecycle");
      return null;
    },
  };
}
