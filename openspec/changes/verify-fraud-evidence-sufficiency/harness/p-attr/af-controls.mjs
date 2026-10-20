import { claimed, contentAt, keyed, keyedContent, replaceContext } from "./af-inputs.mjs";

function tenantClaim(context) {
  const value = context.variant.claim;
  replaceContext(context, { field: "claimedTenant", constructor: "claimedTenant", value, origin: "CP" });
  contentAt(context, { path: "tenant.claimed_tenant_id", kind: "claimed_tenant" });
}

function claimOnly(context) {
  tenantClaim(context);
  delete context.prepared.input.tenant;
}

function conflictingTenant(context) {
  replaceContext(context, { field: "tenant", constructor: "authoritativeTenant", origin: "SR", value: {
    scope: "tenant", actor_tenant_id: "tnt-a01", effective_tenant_id: "tnt-a01", resource_tenant_id: "tnt-a01",
  } });
  tenantClaim(context);
}

function claimedHuman(context) {
  replaceContext(context, { field: "actor", constructor: "claimedActor", value: { type: "authenticated_human", id: context.account } });
  context.prepared.origins["actor.id"] = "SR";
}

function principal(context) {
  replaceContext(context, { field: "authenticated_principal", constructor: "authenticatedPrincipal", value: { type: "human_user", id: context.account }, origin: "SR" });
}

function authoritativeAnonymous(context) {
  replaceContext(context, { field: "actor", constructor: "authoritativeActor", value: { type: "anonymous", id: context.pid } });
  contentAt(context, { path: "actor.id" });
}

function fabricatedActor(context) {
  replaceContext(context, { field: "actor", constructor: "authenticatedHumanActor", value: { id: context.pid } });
  contentAt(context, { path: "actor.id" });
}

function existenceReason(context) {
  const reason = context.variant.target === "ex" ? "credential_invalid" : "not_found_or_not_disclosed";
  replaceContext(context, { field: "authentication", constructor: "authenticationEvidence", origin: "SR", value: {
    ...context.prepared.input.authentication, failure_reason: reason,
  } });
  context.prepared.input.event.outcome_reason.code = reason;
  context.prepared.origins["event.outcome_reason.code"] = "SR";
}

function lookupPrincipal(context) {
  if (context.variant.target !== "ex") return;
  replaceContext(context, { field: "actor", constructor: "authenticatedHumanActor", value: { id: context.account } });
  principal(context);
  for (const path of ["actor.id", "authenticated_principal.id"]) {
    contentAt(context, { path, origin: "SR", kind: "resolved_account", source: "lookup" });
  }
}

function requestCarrier(context) {
  const { request } = context.prepared.input;
  if (context.variant.mode === "id") {
    const digest = keyed(context, "request.id", { prefix: "req-" });
    request.id = `req-${digest}`;
    keyedContent(context, "request.id");
    contentAt(context, { path: "correlation.request_id" });
    context.prepared.contents["correlation.request_id"].keyed = context.prepared.contents["request.id"].keyed;
    context.prepared.keyedInputs["correlation.request_id"] = context.prepared.keyedInputs["request.id"];
    return;
  }
  const digest = keyed(context, "request.route", { prefix: "/login/" });
  request.route = `/login/${digest}`;
  keyedContent(context, "request.route");
}

function authenticationCarrier(context) {
  const digest = keyed(context, "authentication.method");
  const method = context.variant.mode === "length-control" ? `m-${digest}` : digest;
  replaceContext(context, { field: "authentication", constructor: "authenticationEvidence", origin: "SR", value: {
    ...context.prepared.input.authentication, method,
  } });
  keyedContent(context, "authentication.method");
}

function authorizationCarrier(context) {
  const digest = keyed(context, "authorization.resource_context.id");
  replaceContext(context, { field: "authorization", constructor: "authorizationEvidence", value: {
    decision: "not_applicable", resource_context: { type: "account", id: digest },
  } });
  keyedContent(context, "authorization.resource_context.id");
}

function messageCarrier(context) {
  const digest = keyed(context, "event.outcome_reason.message");
  context.prepared.input.event.outcome_reason.message = digest;
  keyedContent(context, "event.outcome_reason.message");
}

function tenantlessHook(context) {
  claimed(context);
  claimOnly(context);
}

export const AF_CONTROLS = new Map([
  ["tenant-claim", tenantClaim], ["claim-only", claimOnly], ["conflicting-tenant", conflictingTenant],
  ["claimed-human", claimedHuman], ["principal", principal], ["authoritative-anonymous", authoritativeAnonymous],
  ["fabricated-actor", fabricatedActor], ["existence-reason", existenceReason], ["lookup-principal", lookupPrincipal],
  ["request", requestCarrier], ["authentication", authenticationCarrier], ["authorization", authorizationCarrier],
  ["message", messageCarrier], ["tenantless-hook", tenantlessHook],
]);
