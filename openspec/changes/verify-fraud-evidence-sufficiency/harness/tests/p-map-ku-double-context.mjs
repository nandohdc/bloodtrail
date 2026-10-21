import { contextDouble } from "./p-map-lm-double-context.mjs";
import { frozenSnapshot } from "../p-map/snapshot.mjs";

const ACTORS = [
  ["serviceAccountActor", "service_account"],
  ["workloadIdentityActor", "workload_identity"],
  ["scheduledProcessActor", "scheduled_process"],
];

export function lockContextDouble() {
  const { core, identities } = contextDouble();
  for (const [method, type] of ACTORS) core[method] = (input) => {
    const result = frozenSnapshot({ type, id: input.id,
      provenance: { trust_level: "authoritative_server", source: "configured-authority" } });
    identities.add(result);
    return result;
  };
  return { core, identities };
}

const COMMIT = { started: "pending", committed: "committed", compensated: "compensated" };
// Public getters/methods only; SDK source operations.ts:31-46,97-111 at base.
// Prototype getters are intentionally non-enumerable like the packed handle,
// so U2's object spread cannot accidentally acquire the original identity.
export function lockHandleDouble({ ordinal, correlationId = `ku-correlation-${ordinal}` }) {
  let current = "started";
  const operationId = `ku-operation-${ordinal}`;
  const transactionId = `ku-transaction-${ordinal}`;
  const snapshot = () => frozenSnapshot({ operation_id: operationId, transaction_id: transactionId,
    correlation_id: correlationId, state: current, commit_state: COMMIT[current], transactional: true });
  const mark = (next) => { current = next; return { ok: true, value: snapshot() }; };
  const prototype = Object.create(null, {
    operationId: { get: () => operationId }, transactionId: { get: () => transactionId },
    correlationId: { get: () => correlationId }, state: { get: () => current },
    transactional: { get: () => true }, boundEvent: { get: () => undefined },
    snapshot: { value: snapshot }, markCommitted: { value: () => mark("committed") },
    markCompensated: { value: () => mark("compensated") },
  });
  return Object.freeze(Object.create(prototype));
}
