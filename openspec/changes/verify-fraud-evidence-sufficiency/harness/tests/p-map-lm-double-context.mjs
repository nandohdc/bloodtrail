import { frozenSnapshot } from "../p-map/snapshot.mjs";

// Fixture constructors: identity-preserving public shapes, not SDK validation.
// core/src/context.ts:139-166,183-196,210-212,244-254,284-323 at 8e6cdf7.
const CONTEXTS = ["authoritativeSubject", "authoritativeTenant", "sessionEvidence", "authoritativeResource",
  "authorizationEvidence", "observedSource", "authenticationEvidence", "credentialReference", "authenticatedPrincipal"];

function actor(type, input) {
  return { type, id: input.id, provenance: { trust_level: "authoritative_server", source: "configured-authority" } };
}

export function contextDouble() {
  const identities = new WeakSet();
  const brand = (value) => {
    const result = frozenSnapshot(value);
    identities.add(result);
    return result;
  };
  const core = Object.fromEntries(CONTEXTS.map((name) => [name, (input) => brand(input)]));
  core.anonymousActor = () => brand({ type: "anonymous", provenance: { trust_level: "client_claim", source: "request_boundary" } });
  core.authenticatedHumanActor = (input) => brand(actor("authenticated_human", input));
  core.administratorActor = (input) => brand(actor("administrator", input));
  return { core, identities };
}

const COMMIT_STATES = { started: "pending", committed: "committed", not_committed: "not_committed" };

// Only the publicly declared handle/getters/methods are present. No authority
// emulation: the script decides each emitted outcome independently of input.
export function operationDouble({ ordinal, transactional = true }) {
  let current = "started";
  const snapshot = () => frozenSnapshot({ operation_id: `fixture-op-${ordinal}`,
    transaction_id: `fixture-txn-${ordinal}`, correlation_id: `fixture-cor-${ordinal}`,
    state: current, transactional, commit_state: transactional ? COMMIT_STATES[current] : "not_applicable" });
  const mark = (next) => {
    current = next;
    return { ok: true, value: snapshot() };
  };
  return Object.freeze({ operationId: `fixture-op-${ordinal}`, transactionId: `fixture-txn-${ordinal}`,
    correlationId: `fixture-cor-${ordinal}`, boundEvent: undefined, transactional,
    get state() { return current; }, snapshot,
    markCommitted: () => mark("committed"), markNotCommitted: () => mark("not_committed") });
}
