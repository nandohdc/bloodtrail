import { passwordResetInput, registrationInput } from "./baselines.mjs";
import { AF_CARRIERS, contentAt, keyed, keyedContent, replaceContext, resolvedSubject } from "./af-inputs.mjs";
import { AF_CONTROLS } from "./af-controls.mjs";

const BASE_BUILDERS = new Map([["PR", passwordResetInput], ["RA", registrationInput]]);
const CARRIERS = ["baseline", "claimed", "hooked", "display", "subject", "credential", "credential-subject"];
const CONTROLS = ["tenant-claim", "claim-only", "conflicting-tenant", "claimed-human", "principal"];

export function prepareRequest(context) {
  context.pid = `pid-${context.variant.target}-0001`;
  context.account = "acct-0001";
  context.prepared = { ...BASE_BUILDERS.get(context.plan.family)(context.state), contents: {}, keyedInputs: {} };
}

function accountResource(context, { id, origin = "CP", kind = "presented_identifier", source = "request" }) {
  replaceContext(context, { field: "resource", constructor: "authoritativeResource", value: { type: "account", id } });
  contentAt(context, { path: "resource.id", origin, kind, source });
}

function resolved(context) {
  if (context.variant.mode === "subject") return resolvedSubject(context);
  if (context.variant.target !== "ex") return;
  accountResource(context, { id: context.account, origin: "SR", kind: "resolved_account", source: "safe_resolution" });
}

function resource(context) {
  const digest = keyed(context, "resource.id");
  accountResource(context, { id: digest });
  keyedContent(context, "resource.id");
}

function fabricatedPrincipal(context) {
  AF_CONTROLS.get("fabricated-actor")(context);
  replaceContext(context, { field: "authenticated_principal", constructor: "authenticatedPrincipal", value: { type: "human_user", id: context.pid } });
  contentAt(context, { path: "authenticated_principal.id" });
}

// Shared construction does not collapse the two catalog policies or observations.
// Runtime omissions (claim-only) are intentional, even where .d.ts requires tenant.
export const REQUEST_BUILDERS = new Map([
  ...CARRIERS.map((name) => [name, AF_CARRIERS.get(name)]),
  ...CONTROLS.map((name) => [name, AF_CONTROLS.get(name)]),
  ["resolved", resolved], ["resource", resource], ["fabricated-principal", fabricatedPrincipal],
]);
