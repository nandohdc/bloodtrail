import { occurrenceLedger } from "../lib/ledger.mjs";
import { createState } from "../p-e/runtime.mjs";

// Public-shape doubles only, not SDK conformance emulation. Source shapes:
// core/src/{operations.ts:31-46,sdk.ts:44-46,testing.ts:21-33} at #803 base.
export const ACCEPTED = Object.freeze({ ok: true, value: Object.freeze({ status: "accepted" }) });
export const REFUSED = { ok: false, error: { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" } };
export const EVENT = Object.freeze({ event: Object.freeze({ id: "pe-event-0001" }),
  correlation: Object.freeze({ transaction_id: "pe-txn-0001" }) });

export function fixtureState({ budget = 100, node = {}, core = {} } = {}) {
  return createState({ ledger: occurrenceLedger({ budget }),
    core: { CONTRACT_VERSION: "2.1.0", ...core }, node,
    testing: { createCapturingAuditSink: () => ({ emit: async () => ({ status: "accepted" }) }) } });
}

export function handleFixture() {
  let state = "started";
  const handle = Object.freeze({ operationId: "pe-op-0001", transactionId: "pe-txn-0001", correlationId: "pe-cor-0001",
    boundEvent: "mfaRemoved", transactional: true, get state() { return state; },
    snapshot() { return { state, operation_id: this.operationId, commit_state: state }; },
    markCommitted() { state = "committed"; return { ok: true, value: this.snapshot() }; } });
  return handle;
}

export function requestFixture(body = "pe-body-Ω") {
  return { body, attempt: 0, event_id: "pe-event-0001", method: "POST", path: "/v1/security-audit",
    headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) } };
}
