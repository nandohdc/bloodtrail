import { leafOrigins } from "../p-attr/origins.mjs";
import { DIGEST_FORMAT, memoryKeying } from "../p-attr/keying.mjs";

export const PID = "pid-ex-0001";
export const ACCOUNT = "acct-0001";
const NAMES = {
  AF: "authentication.failed", AS: "authentication.succeeded",
  PR: "account.password_reset.requested", RA: "account.registration.attempted",
};

// Hand-built public capture shapes. No SDK code, expectation file, network or
// evaluator is involved in constructing these observations.
export function capture(family) {
  return {
    event: { name: `bloodtrail.audit.${NAMES[family]}`, id: "evt-0001", timestamp: "2026-10-17T00:00:00.000Z", observed_at: "2026-10-17T00:00:00.000Z" },
    actor: { type: "anonymous", provenance: { trust_level: "client_claim", source: "request_boundary" } },
    resource: { operation_type: family === "RA" ? "create" : "execute" },
    request: { id: "req-0001", method: "POST", route: "/login" },
    correlation: { correlation_id: "cor-0001", operation_id: "op-0001", request_id: "req-0001" },
    tenant: { scope: "tenantless" },
  };
}

export function observation({ id, event, contents = {}, origins = {}, keyed_checks = [] }) {
  const captured = { ...leafOrigins({ value: event, origin: "SC" }), ...origins };
  return {
    step_id: `${id}/main`, family: id.split("-")[0], kind: "returned", accepted: true,
    raw: { ok: true, value: { status: "accepted" } }, sink_count: 1,
    frozen: [true], events: [event], origins: { ...origins }, captured_origins: [captured], contents, keyed_checks,
  };
}

export function refused({ id, code, category, path }) {
  const diagnostic = { code, category, path };
  return {
    step_id: `${id}/main`, family: id.split("-")[0], kind: "returned", accepted: false,
    raw: { ok: false, error: diagnostic }, diagnostic, sink_count: 0,
    frozen: [], events: [], origins: {}, captured_origins: [], contents: {},
  };
}

export function withTarget({ id, path, value = PID, kind = "presented_identifier", origin = "CP", source = "request", keyed = false }) {
  const family = id.split("-")[0];
  const event = capture(family);
  if (family === "AS") {
    event.actor = { type: "authenticated_human", id: ACCOUNT, provenance: { trust_level: "authoritative_server", source: "configured-authority" } };
    event.authenticated_principal = { type: "human_user", id: ACCOUNT };
  }
  let keying;
  if (keyed) {
    keying = memoryKeying();
    value = keying.transform({ content: { value: PID, origin: "CP" }, scope: "presented-identifier" }).value;
  }
  put(event, path, value);
  const record = observation({ id, event, contents: { [path]: { kind, source, target: true } }, origins: { [path]: origin } });
  if (keyed) {
    record.keyed_checks = [{ path, key_scope: { purpose: "presented-identifier", tenant: null },
      input_origin: "CP", digest_format: DIGEST_FORMAT, matches_declared_input: true }];
  }
  return record;
}

export function put(value, path, replacement) {
  const parts = path.split(".");
  let cursor = value;
  for (const part of parts.slice(0, -1)) {
    if (cursor[part] === undefined) cursor[part] = {};
    cursor = cursor[part];
  }
  cursor[parts.at(-1)] = replacement;
}

function lookupActor() {
  const record = withTarget({ id: "AF-X4", path: "actor.id", value: ACCOUNT, kind: "resolved_account", origin: "SR", source: "lookup" });
  record.events[0].actor.type = "authenticated_human";
  record.events[0].actor.provenance.trust_level = "authoritative_server";
  record.events[0].authenticated_principal = { type: "human_user", id: ACCOUNT };
  record.captured_origins[0]["authenticated_principal.id"] = "SR";
  record.captured_origins[0]["authenticated_principal.type"] = "SC";
  record.contents["authenticated_principal.id"] = { kind: "resolved_account", source: "lookup", target: true };
  return record;
}

const OBSERVATIONS = [
  ["AF-C1", () => withTarget({ id: "AF-C1", path: "actor.id" })],
  ["AF-C3", () => withTarget({ id: "AF-C3", path: "actor.display_name", keyed: true })],
  ["AF-C8", () => refused({ id: "AF-C8", code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor/provenance/trust_level" })],
  ["AF-X4", lookupActor],
  ["AS-C3", () => withTarget({ id: "AS-C3", path: "actor.display_name", keyed: true })],
  ["AS-C5", () => withTarget({ id: "AS-C5", path: "subject.id", value: ACCOUNT, kind: "resolved_account", origin: "SR", source: "safe_resolution" })],
  ["AS-C0", () => refused({ id: "AS-C0", code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" })],
  ["PR-C4", () => withTarget({ id: "PR-C4", path: "subject.id" })],
  ["PR-C5", () => withTarget({ id: "PR-C5", path: "subject.id", value: ACCOUNT, kind: "resolved_account", origin: "SR", source: "safe_resolution" })],
  ["PR-C8", () => refused({ id: "PR-C8", code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor/provenance/trust_level" })],
  ["RA-B", () => observation({ id: "RA-B", event: capture("RA") })],
  ["RA-C5", () => withTarget({ id: "RA-C5", path: "resource.id", value: ACCOUNT, kind: "resolved_account", origin: "SR", source: "safe_resolution" })],
  ["RA-C9", () => refused({ id: "RA-C9", code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" })],
];

export function independentObservations() {
  return OBSERVATIONS.map(([, build]) => build());
}
