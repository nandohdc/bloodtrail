import { refusal } from "./counts-fake-operations.mjs";

function asyncCausality(body, definition) {
  if (definition.semantic !== "password_reset_completed") return null;
  const complete = Boolean(body.correlation.causation_id) && Boolean(body.correlation.original_event_id);
  if (!complete) return refusal("BAD_CAUSALITY", "/correlation");
  return null;
}

function failedTarget(body, definition) {
  if (definition.semantic !== "authentication_failed") return null;
  const fields = ["subject", "resource"];
  for (const field of fields) {
    const context = body[field];
    if (invalidCredentialTarget(context)) return refusal("SDK_SEMANTIC_VALIDATION_FAILED", `/${field}/type`);
  }
  return null;
}

function invalidCredentialTarget(context) {
  if (!context) return false;
  if (context.type === "credential") return false;
  return context.id !== undefined;
}

function authority(body, definition) {
  const anonymous = body.actor.type === "anonymous";
  const permitted = definition.actor_rule.startsWith("anonymous actor permitted");
  if (anonymousHasPrincipal(anonymous, body)) return refusal("AUTHORITY_ESCALATION", "/authenticated_principal", "authority");
  if (anonymousForbidden(anonymous, permitted)) return refusal("MISSING_REQUIRED_ACTOR", "/actor/type");
  return null;
}

function anonymousHasPrincipal(anonymous, body) {
  return anonymous && Boolean(body.authenticated_principal);
}

function anonymousForbidden(anonymous, permitted) {
  return anonymous && !permitted;
}

export function semanticFailure(body, definition) {
  const checks = [asyncCausality, failedTarget, authority];
  for (const check of checks) {
    const failed = check(body, definition);
    if (failed) return failed;
  }
  return null;
}
