import assert from "node:assert/strict";

// Independently hand-written public-boundary oracle. No descriptor, workload,
// expectations JSON or double script is imported to derive any expectation.
// All source references are at 8e6cdf781445574c67883a465eb37581ca14b5ab.
const CORE = "packages/security-audit-sdk-core/src/";
const CATALOG = "contracts/security-audit/source/contract.source.json";
const LOGOUT = { "occurrence.event_name": "bloodtrail.audit.session.revoked", "occurrence.category": "session",
  "occurrence.action": "revoke_session", "occurrence.lifecycle_phase": "completed",
  "occurrence.outcome": "success", "occurrence.commit_state": "committed",
  "occurrence.delivery_class": "transaction_critical", "occurrence.operation_type": "delete",
  "occurrence.operation_id_matches_handle": true, "occurrence.transaction_id_matches_handle": true,
  "occurrence.correlation_id_matches_handle": true, "signal.resource_matches_session": true };
const MFA = { "occurrence.event_name": "bloodtrail.audit.authentication.failed", "occurrence.category": "authentication",
  "occurrence.action": "authenticate", "occurrence.lifecycle_phase": "completed", "occurrence.outcome": "failure",
  "occurrence.commit_state": "not_applicable", "occurrence.delivery_class": "security_significant",
  "signal.mfa_state": "failed", "signal.failure_reason": "mfa_failed", "signal.outcome_reason": "mfa_failed",
  "signal.credential_reference_present": false, "signal.operation_id_nonempty": true, "signal.correlation_id_nonempty": true };

function accepted(step_id, fields, basis) {
  return { step_id, fields: { kind: "returned", accepted: true, sink_count: 1,
    "raw.value.status": "accepted", "captures.0.frozen": true, ...fields }, basis };
}

function refused(step_id, diagnostic, basis, fields = {}) {
  return { step_id, fields: { kind: "returned", accepted: false, sink_count: 0,
    "diagnostic.code": diagnostic[0], "diagnostic.category": diagnostic[1], "diagnostic.path": diagnostic[2], ...fields }, basis };
}

const PREMATURE = ["PREMATURE_SUCCESS", "validation", "/operation/state"];
const ANONYMOUS = { "signal.actor_type": "anonymous", "signal.actor_trust": "client_claim" };
const TARGETLESS = { ...ANONYMOUS, "signal.subject_present": false, "signal.actor_id_present": false };
const HUMAN = { "signal.actor_type": "authenticated_human", "signal.actor_trust": "authoritative_server" };

export const LM_ORACLE = [
  accepted("L1/not-applicable", { ...LOGOUT, ...HUMAN, "signal.actor_matches_subject": true,
    "signal.authorization_decision": "not_applicable" }, [`${CATALOG}:3126-3161`, `${CORE}events.ts:217-225`]),
  refused("L1/duplicate-success", ["SDK_DUPLICATE_SUCCESS", "lifecycle", "/operation/state"], [`${CORE}sdk.ts:251-268`]),
  accepted("L1/allow", { ...LOGOUT, "signal.authorization_decision": "allow" }, [`${CORE}validation/semantic.ts:380-384,426-435`]),
  refused("L2/no-handle", PREMATURE, [`${CORE}events.ts:190-197,223-225`]),
  refused("L3/tenantless", ["TENANT_RESOURCE_CONFLICT", "validation", "/tenant/scope"],
    [`${CORE}validation/semantic.ts:54,391-399`]),
  accepted("L3/usable-handle", LOGOUT, [`${CORE}sdk.ts:234-248`]),
  accepted("L3/tenantless-login", { "occurrence.event_name": "bloodtrail.audit.authentication.succeeded",
    "occurrence.commit_state": "not_applicable", "occurrence.delivery_class": "security_significant" },
  [`${CORE}validation/semantic.ts:49`, `${CATALOG}:2847-2880`]),
  accepted("L3/tenantless-session", { "occurrence.event_name": "bloodtrail.audit.session.created",
    "occurrence.commit_state": "not_applicable", "occurrence.delivery_class": "security_significant" },
  [`${CORE}validation/semantic.ts:53`, `${CATALOG}:3072-3105`]),
  accepted("L4/anonymous", { ...LOGOUT, ...ANONYMOUS, "signal.actor_matches_subject": false },
    [`${CORE}context.ts:155-166`, `${CORE}validation/semantic.ts:249-263,372-389`, `${CATALOG}:3153`]),
  refused("L5a/denied-no-handle", PREMATURE, [`${CORE}events.ts:217-225`]),
  refused("L5b/direct-not-committed", ["PREMATURE_SUCCESS", "validation", "/event/commit_state"], [`${CORE}events.ts:213-215`]),
  accepted("L5c/denied-not-committed", { ...LOGOUT, "occurrence.outcome": "denied", "occurrence.commit_state": "not_committed",
    "signal.actor_type": "administrator", "signal.actor_matches_subject": false, "signal.authorization_decision": "deny" },
  [`${CORE}operations.ts:109,212-222`, `${CORE}events.ts:540-544`, `${CORE}validation/semantic.ts:91-96,426-435`]),
  accepted("M1/tenantless", { ...MFA, ...TARGETLESS }, [`${CATALOG}:2902-2934`, `${CORE}events.ts:223,258-272`]),
  accepted("M1/tenant", { ...MFA, ...TARGETLESS }, [`${CORE}validation/semantic.ts:50,391-399`]),
  accepted("M2/resolved-subject", { ...MFA, ...ANONYMOUS, "signal.subject_present": true },
    [`${CORE}validation/semantic.ts:249-352`, `${CORE}context.ts:248-250`, `${CATALOG}:2927`]),
  accepted("M3/authenticated-actor", { ...MFA, ...HUMAN, "signal.actor_id_present": true },
    [`${CORE}context.ts:139-153,194-196`, `${CORE}validation/semantic.ts:372-389`]),
  refused("M4/transactional", ["SDK_SEMANTIC_VALIDATION_FAILED", "validation", "/event/commit_state"],
    [`${CORE}operations.ts:212-222`, `${CORE}events.ts:220-224`, `${CORE}validation/semantic.ts:227-247`]),
  accepted("M4/nontransactional", { ...MFA, ...TARGETLESS, "handle.transactional": false,
    "occurrence.operation_id_matches_handle": true, "occurrence.transaction_id_matches_handle": true },
  [`${CORE}operations.ts:212-214`, `${CORE}validation/semantic.ts:227-247,91-96`]),
];

export function assertOracle(record, row) {
  assert(record, `missing ${row.step_id}`);
  for (const [path, expected] of Object.entries(row.fields)) {
    const actual = path.split(".").reduce((value, key) => value?.[key], record);
    assert.deepEqual(actual, expected, `${row.step_id}: ${path} (${row.basis.join("; ")})`);
  }
}
