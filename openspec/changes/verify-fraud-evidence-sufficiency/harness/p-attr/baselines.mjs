import { leafOrigins, tagged } from "./origins.mjs";
import { instance, named } from "./runtime.mjs";
import { DIGEST_FORMAT } from "./keying.mjs";

// Citations are at cc4fdf5a3309db5077b85c4954c916b9ba902b8e (not the draft).
// context.ts:155-166,248-254,283-291,306-315,321-323; sdk.ts:112-145.
const AUTH = Object.freeze({ method: "password", credential_type: "password", mfa_state: "not_used" });
const SOURCE = Object.freeze({ observed: { address: "203.0.113.10", port: 51000 } });
const AS_IDENTITY = Object.freeze({ account: "acct-0001", credential: "cref-0001", session: "session-handle-0001" });
const COMMON = [
  ["tenant", "authoritativeTenant", { scope: "tenantless" }, "SR"],
  ["source", "observedSource", SOURCE, "SC"],
];

function context(state, prepared, { field, constructor, value, origin }) {
  prepared.input[field] = state.c(constructor, value);
  Object.assign(prepared.origins, leafOrigins({ value: prepared.input[field], origin, path: field }));
}

function common(state, source = SOURCE) {
  const prepared = { input: {}, origins: {} };
  for (const [field, constructor, value, origin] of COMMON) {
    context(state, prepared, { field, constructor, value: field === "source" ? source : value, origin });
  }
  return prepared;
}

function plain(prepared, values) {
  Object.assign(prepared.input, values);
  Object.assign(prepared.origins, leafOrigins({ value: values, origin: "SC" }));
}

function anonymous(state, { route, requestId, source = SOURCE }) {
  const prepared = common(state, source);
  context(state, prepared, { field: "actor", constructor: "anonymousActor", value: undefined, origin: "SC" });
  plain(prepared, { request: { id: requestId, method: "POST", route }, correlation: {} });
  return prepared;
}

export function authenticationFailedInput(state) {
  const prepared = anonymous(state, { route: "/login", requestId: "req-af-0001" });
  context(state, prepared, { field: "authentication", constructor: "authenticationEvidence", value: { ...AUTH, failure_reason: "credential_invalid" }, origin: "SR" });
  plain(prepared, { event: { outcome_reason: { code: "credential_invalid" } } });
  return prepared;
}

export function authenticationSucceededInput(state, { keying, identity = AS_IDENTITY }) {
  const prepared = common(state, { observed: { address: "198.51.100.20", port: 52000 } });
  const session = keying.transform({ content: tagged({ value: identity.session, origin: "SR" }), scope: "fraud-evidence" });
  const fields = [
    ["actor", "authenticatedHumanActor", { id: identity.account }],
    ["authenticated_principal", "authenticatedPrincipal", { type: "human_user", id: identity.account }],
    ["authentication", "authenticationEvidence", { ...AUTH, authenticated_at: "2026-10-12T00:00:00.000Z" }],
    ["credential", "credentialReference", { type: "password", reference: identity.credential }],
    ["session", "sessionEvidence", { id: `sfp-${session.value}` }],
  ];
  for (const [field, constructor, value] of fields) context(state, prepared, { field, constructor, value, origin: "SR" });
  prepared.keyedInputs = { "session.id": { value: identity.session, scope: "fraud-evidence",
    expected: `sfp-${session.value}`, key_scope: { purpose: "fraud-evidence", tenant: null },
    input_origin: "SR", digest_format: DIGEST_FORMAT, embedded: true } };
  return prepared;
}

export function passwordResetInput(state) {
  return anonymous(state, { route: "/password-reset", requestId: "req-pr-0001", source: { observed: { address: "203.0.113.11", port: 51001 } } });
}

export function registrationInput(state) {
  return anonymous(state, { route: "/register", requestId: "req-ra-0001", source: { observed: { address: "203.0.113.12", port: 51002 } } });
}

// Predicted public calls include 2 instance calls and 1 named-method call.
// Source: generated/contract.generated.ts:515-548,575-625,737-763;
// semantic.ts:46-55,271-316; events.ts:185-227,383-414 (RA=create).
export const BASELINES = [
  { case_id: "AF-B", method: "authenticationFailed", build: authenticationFailedInput, calls: 7 },
  { case_id: "AS-B", method: "authenticationSucceeded", build: authenticationSucceededInput, calls: 10 },
  { case_id: "PR-B", method: "passwordResetRequested", build: passwordResetInput, calls: 6 },
  { case_id: "RA-B", method: "accountRegistrationAttempted", build: registrationInput, calls: 6 },
];

export async function baseline(state, { entry, keying }) {
  state.current = entry.case_id;
  const prepared = entry.build(state, { keying });
  const target = instance(state);
  const record = await named(state, { target, method: entry.method, ...prepared });
  return { record, prepared, target };
}
