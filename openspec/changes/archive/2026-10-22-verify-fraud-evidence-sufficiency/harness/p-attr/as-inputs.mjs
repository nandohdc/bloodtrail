import { authenticationSucceededInput } from "./baselines.mjs";
import { claimed, contentAt, credential, keyed, keyedContent, replaceContext, subject } from "./af-inputs.mjs";
import { AF_CONTROLS } from "./af-controls.mjs";
import { DIGEST_FORMAT } from "./keying.mjs";

const IDENTITY_CONTENTS = [
  ["actor.id", "performer"], ["authenticated_principal.id", "authenticated_principal"],
  ["credential.reference", "credential_reference"], ["session.id", "session_fingerprint"],
];
const TENANT_BUILDERS = ["tenant-claim", "claim-only", "conflicting-tenant", "claimed-human"];

function hookKeyed(context, { value, origin }) {
  const scope = `${context.plan.purpose}|platform-login`;
  context.prepared.contents["actor.id"].keyed = { key_scope: { purpose: context.plan.purpose, tenant: "platform-login" },
    input_origin: origin, digest_format: DIGEST_FORMAT, embedded: false };
  context.prepared.keyedInputs["actor.id"] = { value, scope,
    expected: context.keying.recompute({ value, scope }),
    key_scope: { purpose: context.plan.purpose, tenant: "platform-login" },
    input_origin: origin, digest_format: DIGEST_FORMAT, embedded: false };
}

export function prepareAs(context) {
  const suffix = context.variant.account_suffix;
  const identity = { account: `acct-${suffix}`, credential: `cref-${suffix}`, session: `session-handle-${suffix}` };
  context.pid = `pid-ex-${suffix}`;
  context.account = identity.account;
  context.prepared = { ...authenticationSucceededInput(context.state, { keying: context.keying, identity }), contents: {} };
  for (const [path, kind] of IDENTITY_CONTENTS) contentAt(context, { path, kind, origin: "SR", source: "validated_authentication" });
  const sessionKeyed = context.prepared.keyedInputs["session.id"];
  if (sessionKeyed) context.prepared.contents["session.id"].keyed = { key_scope: sessionKeyed.key_scope,
    input_origin: sessionKeyed.input_origin, digest_format: sessionKeyed.digest_format, embedded: sessionKeyed.embedded };
}

function pruneMetadata({ metadata, field }) {
  for (const path of Object.keys(metadata).filter((path) => path.startsWith(`${field}.`))) delete metadata[path];
}

function removeField(context, field) {
  delete context.prepared.input[field];
  pruneMetadata({ metadata: context.prepared.origins, field });
  pruneMetadata({ metadata: context.prepared.contents, field });
}

function anonymous(context) {
  removeField(context, "actor");
  replaceContext(context, { field: "actor", constructor: "anonymousActor", value: undefined });
  if (context.variant.mode === "without-principal") removeField(context, "authenticated_principal");
}

function hooked(context) {
  if (context.variant.mode === "keyed-mirror") {
    // Q5: AS-X2-shaped raw actor through the hook instance, keyed under the
    // AS semantic purpose. Declared before the run; purposes differ from
    // AF-C2, so the C2 mirror joins nothing. Refused AS-C2/main stays a
    // separate control row.
    rawActor(context);
    hookKeyed(context, { value: context.pid, origin: "CP" });
    return;
  }
  if (context.variant.mode === "honest-control") {
    hookKeyed(context, { value: context.account, origin: "SR" });
    return;
  }
  claimed(context);
  hookKeyed(context, { value: context.pid, origin: "CP" });
}

function display(context) {
  const display_name = keyed(context, "actor.display_name");
  if (context.variant.mode === "anonymous") {
    removeField(context, "actor");
    replaceContext(context, { field: "actor", constructor: "claimedActor", value: { type: "anonymous", display_name } });
  } else {
    replaceContext(context, { field: "actor", constructor: "authenticatedHumanActor", value: { id: context.account, displayName: display_name }, origin: "SR" });
  }
  keyedContent(context, "actor.display_name");
}

function rawSubject(context) {
  subject(context, { value: context.pid });
}

function resolvedSubject(context) {
  subject(context, { value: context.account, origin: "SR", kind: "resolved_account", source: "safe_resolution" });
}

function resource(context) {
  const digest = keyed(context, "resource.id");
  replaceContext(context, { field: "resource", constructor: "authoritativeResource", value: { type: "account", id: digest } });
  keyedContent(context, "resource.id");
}

function credentialSubject(context) {
  credential(context);
  resolvedSubject(context);
}

function rawActor(context) {
  replaceContext(context, { field: "actor", constructor: "authenticatedHumanActor", value: { id: context.pid } });
  contentAt(context, { path: "actor.id" });
}

export const AS_BUILDERS = new Map([
  ["baseline", () => {}], ["anonymous", anonymous], ["claimed", claimed], ["hooked", hooked],
  ["display", display], ["subject", rawSubject], ["resolved-subject", resolvedSubject],
  ["resource", resource], ["credential", credential], ["credential-subject", credentialSubject],
  ["raw-actor", rawActor], ...TENANT_BUILDERS.map((name) => [name, AF_CONTROLS.get(name)]),
]);
