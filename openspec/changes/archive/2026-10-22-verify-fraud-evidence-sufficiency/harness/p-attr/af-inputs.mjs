import { authenticationFailedInput } from "./baselines.mjs";
import { leafOrigins, tagged } from "./origins.mjs";
import { DIGEST_FORMAT } from "./keying.mjs";

// Only injected public constructors are called. No package import or execution.
export function replaceContext(context, { field, constructor, value, origin = "SC" }) {
  const { state, prepared } = context;
  for (const path of Object.keys(prepared.origins)) {
    if (path.startsWith(`${field}.`)) delete prepared.origins[path];
  }
  prepared.input[field] = state.c(constructor, value);
  Object.assign(prepared.origins, leafOrigins({ value: prepared.input[field], origin, path: field }));
}

export function contentAt(context, { path, value, origin = "CP", kind = "presented_identifier", source = "request" }) {
  context.prepared.origins[path] = origin;
  context.prepared.contents[path] = { kind, source };
  return value;
}

// Host-side keyed carrier. Q1: expectations never hold a digest; the run
// records the declared key scope and a matches_declared_input boolean.
// The declared input is the presented identifier, scope presented-identifier
// (host K scope; G12/G2 withdrawn). prefix embeds the digest, e.g. req-<hex>.
// keyed() records the declared input spec and returns the digest; callers run
// keyedContent() AFTER any replaceContext so the CP origin is not wiped.
export function keyed(context, path, { prefix = "", purpose = "presented-identifier" } = {}) {
  const digest = context.keying.transform({ content: tagged({ value: context.pid, origin: "CP" }), scope: purpose }).value;
  context.prepared.keyedInputs[path] = { value: context.pid, scope: purpose,
    expected: `${prefix}${digest}`, key_scope: { purpose, tenant: null },
    input_origin: "CP", digest_format: DIGEST_FORMAT, embedded: prefix.length > 0 };
  return digest;
}

export function keyedContent(context, path) {
  contentAt(context, { path });
  const spec = context.prepared.keyedInputs[path];
  context.prepared.contents[path].keyed = { key_scope: spec.key_scope,
    input_origin: spec.input_origin, digest_format: spec.digest_format, embedded: spec.embedded };
}

function actor(context, constructor, value, path = "actor.id") {
  replaceContext(context, { field: "actor", constructor, value });
  contentAt(context, { path });
}

export function claimed(context) {
  actor(context, "claimedActor", { type: "anonymous", id: context.pid });
}

export function display(context) {
  const digest = keyed(context, "actor.display_name");
  replaceContext(context, { field: "actor", constructor: "claimedActor", value: { type: "anonymous", display_name: digest } });
  keyedContent(context, "actor.display_name");
}

export function subject(context, { value, origin = "CP", kind = "presented_identifier", source = "request" }) {
  replaceContext(context, { field: "subject", constructor: "authoritativeSubject", value: { type: "account", id: value } });
  contentAt(context, { path: "subject.id", origin, kind, source });
}

export function resolvedSubject(context) {
  if (context.variant.target !== "ex") return;
  subject(context, { value: context.account, origin: "SR", kind: "resolved_account", source: "safe_resolution" });
}

function subjectDisplay(context) {
  const digest = keyed(context, "subject.display_name");
  replaceContext(context, { field: "subject", constructor: "authoritativeSubject", value: { display_name: digest } });
  keyedContent(context, "subject.display_name");
}

function resource(context) {
  const digest = keyed(context, "resource.id");
  replaceContext(context, { field: "resource", constructor: "authoritativeResource", value: { type: context.variant.resource_type, id: digest } });
  keyedContent(context, "resource.id");
}

export function credential(context) {
  const digest = keyed(context, "credential.reference");
  replaceContext(context, { field: "credential", constructor: "credentialReference", value: { type: "password", reference: digest, key_id: context.keying.metadata.key_id } });
  keyedContent(context, "credential.reference");
}

function credentialSubject(context) {
  credential(context);
  resolvedSubject(context);
}

function credentialType(context) {
  replaceContext(context, { field: "credential", constructor: "credentialReference", value: { type: "password" }, origin: "SR" });
}

function resourceType(context) {
  replaceContext(context, { field: "resource", constructor: "authoritativeResource", value: { type: "credential" }, origin: "SR" });
}

function rawSubject(context) {
  subject(context, { value: context.pid });
}

function hookedActor(context) {
  if (context.variant.mode === "absent") return;
  claimed(context);
  const scope = `${context.plan.purpose}|platform-login`;
  context.prepared.contents["actor.id"].keyed = { key_scope: { purpose: context.plan.purpose, tenant: "platform-login" },
    input_origin: "CP", digest_format: DIGEST_FORMAT, embedded: false };
  context.prepared.keyedInputs["actor.id"] = { value: context.pid, scope,
    expected: context.keying.recompute({ value: context.pid, scope }),
    key_scope: { purpose: context.plan.purpose, tenant: "platform-login" },
    input_origin: "CP", digest_format: DIGEST_FORMAT, embedded: false };
}

export const AF_CARRIERS = new Map([
  ["baseline", () => {}], ["credential-type", credentialType], ["claimed", claimed],
  ["hooked", hookedActor], ["display", display], ["subject-display", subjectDisplay],
  ["subject", rawSubject], ["resolved-subject", resolvedSubject], ["resource", resource],
  ["credential", credential], ["credential-subject", credentialSubject], ["resource-type", resourceType],
]);

export function prepareAf(context) {
  context.pid = `pid-${context.variant.target}-0001`;
  context.account = "acct-0001";
  context.prepared = { ...authenticationFailedInput(context.state), contents: {}, keyedInputs: {} };
  return context;
}
