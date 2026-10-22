import { occurrenceLedger } from "../lib/ledger.mjs";
import { createState } from "../p-map/runtime.mjs";
import { frozenSnapshot } from "../p-map/snapshot.mjs";

// Public-shape doubles, NOT a validator or an SDK implementation. Shapes read
// from packed declarations at 8e6cdf7; source: core/src/testing.ts:21-33,
// core/src/operations.ts:31-46, node/src/platform.ts:51-56. No package imports.
export const ACCEPTED = frozenSnapshot({ ok: true, value: { status: "accepted" } });
export const REFUSED = frozenSnapshot({ ok: false, error: {
  code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state",
} });

export function eventFixture() {
  return frozenSnapshot({ event: { id: "pmap-occ-0001", name: "bloodtrail.audit.session.revoked",
    category: "session", action: "revoke_session", lifecycle_phase: "completed",
    outcome: "success", commit_state: "committed", delivery_class: "transaction_critical" },
  correlation: { operation_id: "pmap-op-0001", transaction_id: "pmap-txn-0001", correlation_id: "pmap-cor-0001" },
  resource: { type: "session", operation_type: "delete" } });
}

function acceptingSdk(config) {
  return { async sessionRevoked() {
    await config.sink.emit(eventFixture());
    return ACCEPTED;
  } };
}

export function runtimeFixture({ budget = 100, core = {}, factory = acceptingSdk } = {}) {
  const configs = [];
  const state = createState({ ledger: occurrenceLedger({ budget }),
    core: { CONTRACT_VERSION: "2.1.0", ...core },
    node: { createNodeSecurityAuditSdk(config) { configs.push(config); return factory(config); } },
    testing: { createCapturingAuditSink() {
      const events = [];
      return { events, async emit(event) { events.push(event); return { status: "accepted" }; } };
    } },
  });
  return { state, configs };
}

export function handleFixture() {
  let state = "started";
  return Object.freeze({ operationId: "pmap-op-0001", transactionId: "pmap-txn-0001",
    correlationId: "pmap-cor-0001", boundEvent: undefined, transactional: true,
    get state() { return state; },
    markCommitted() { state = "committed"; return { ok: true, value: { state } }; },
  });
}
