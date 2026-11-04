import { randomUUID } from "node:crypto";
import { checkOperationEvidence, fakeFailure } from "./fake-sdk-common.mjs";

export const refusal = fakeFailure;

export function transition(registry, handle, next, allowedFrom) {
  const evidence = registry.get(handle);
  if (!evidence) return refusal("SDK_INVALID_OPERATION_TRANSITION", "/operation", "lifecycle");
  if (evidence.state === next) return { ok: true, value: handle.snapshot() };
  if (!allowedFrom.includes(evidence.state)) return refusal("SDK_INVALID_OPERATION_TRANSITION", "/operation/state", "lifecycle");
  evidence.state = next;
  return { ok: true, value: handle.snapshot() };
}

const transitions = [
  ["markCommitted", "committed", ["started"]],
  ["markNotCommitted", "not_committed", ["started"]],
  ["markPartiallyCommitted", "partially_committed", ["started"]],
  ["markCancelled", "cancelled", ["started"]],
  ["markCompensated", "compensated", ["committed"]],
];

function issueHandle(options, registry) {
  const evidence = { boundEvent: options.boundEvent, state: "started" };
  const handle = Object.freeze({
    operationId: `op_${randomUUID()}`, transactionId: `tx_${randomUUID()}`, correlationId: `cor_${randomUUID()}`,
    boundEvent: options.boundEvent,
    get state() { return evidence.state; },
    snapshot: () => ({ state: evidence.state }),
    ...Object.fromEntries(transitions.map(([method, next, allowedFrom]) => [
      method, () => transition(registry, handle, next, allowedFrom),
    ])),
  });
  return { handle, evidence };
}

export function operationAuthority(methods) {
  const registry = new WeakMap();
  return {
    beginOperation(options = {}) {
      const unknown = options.boundEvent !== undefined && !methods.includes(options.boundEvent);
      if (unknown) return refusal("UNKNOWN_CATALOG_VALUE", "/operation/bound_event");
      const issued = issueHandle(options, registry);
      registry.set(issued.handle, issued.evidence);
      return { ok: true, value: issued.handle };
    },
    check: (handle, method) => checkOperation({ registry, handle, method }),
  };
}

function checkOperation({ registry, handle, method }) {
  if (handle === undefined) return null;
  return checkOperationEvidence(registry.get(handle), method);
}
