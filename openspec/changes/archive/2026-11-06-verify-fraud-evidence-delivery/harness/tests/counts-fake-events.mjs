// Build from inputs and catalog metadata. No canonical examples are loaded or copied.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { jsonFile } from "../lib/io.mjs";
import { refusal } from "./counts-fake-operations.mjs";
import { semanticFailure as extendedSemantics } from "./counts-fake-semantics.mjs";

const require = createRequire(import.meta.url);
const validate = require("../../../../../packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs");
const CATALOG = jsonFile(new URL("../../../../../contracts/security-audit/catalog/catalog.json", import.meta.url));
const BY_NAME = new Map(CATALOG.map((entry) => [entry.name, entry]));
export const METHODS = Object.freeze({
  authenticationSucceeded: "bloodtrail.audit.authentication.succeeded", sessionCreated: "bloodtrail.audit.session.created",
  mfaRemoved: "bloodtrail.audit.authentication.mfa.removed", passwordResetCompleted: "bloodtrail.audit.account.password_reset.completed",
  sessionRevoked: "bloodtrail.audit.session.revoked", authenticationFailed: "bloodtrail.audit.authentication.failed",
});
const OP_TYPES = { create_session: "create", remove_mfa: "delete", revoke_session: "delete" };
const DIRECT_FIELDS = ["actor", "tenant", "authenticated_principal", "subject", "credential", "session", "source", "request", "authentication", "authorization"];

function correlation(input) {
  const value = { operation_id: `op_${randomUUID()}`, correlation_id: `cor_${randomUUID()}`, retry_attempt: 0, ...input.correlation };
  if (input.retry) Object.assign(value, input.retry);
  if (input.operation) Object.assign(value, {
    operation_id: input.operation.operationId, transaction_id: input.operation.transactionId,
    correlation_id: input.operation.correlationId,
  });
  return value;
}

function eventMetadata(definition, input) {
  const timestamp = input.event.timestamp;
  const commit = definition.commit.includes("not_applicable") ? "not_applicable" : "committed";
  return {
    id: randomUUID(), name: definition.name, category: definition.category, action: definition.action,
    lifecycle_phase: definition.phase.at(-1), outcome: definition.outcomes[0], commit_state: commit,
    timestamp, observed_at: timestamp, delivery_class: definition.delivery,
  };
}

function eventFromInput({ definition, input, config }) {
  const direct = Object.fromEntries(DIRECT_FIELDS.filter((field) => input[field] !== undefined).map((field) => [field, input[field]]));
  return {
    ...direct, event: eventMetadata(definition, input), schema: { name: "com.bloodtrail.security-audit.event", version: "2.1.0" },
    producer: config.producer, environment: config.environment, service: config.service,
    initiator: { type: "service", id: config.service.name },
    resource: { operation_type: OP_TYPES[definition.action] ?? "execute", ...input.resource },
    correlation: correlation(input),
    data: { classification: "internal", retention_class: definition.retention, field_policy_version: "2.1.0" },
  };
}

function boundCompletion(input, definition) {
  if (definition.commit.includes("not_applicable")) return null;
  if (!input.operation) return refusal("PREMATURE_SUCCESS", "/operation/state");
  if (input.operation.state !== "committed") return refusal("PREMATURE_SUCCESS", "/operation/state");
  return null;
}

function semanticFailure(event, definition) {
  const bound = boundCompletion(event.input, definition);
  if (bound) return bound;
  const body = event.body;
  const owning = body.resource.owning_tenant_id;
  const effective = body.tenant.effective_tenant_id;
  const conflict = Boolean(owning) && owning !== effective;
  if (conflict) return refusal("TENANT_RESOURCE_CONFLICT", "/resource/owning_tenant_id");
  return extendedSemantics(body, definition);
}

function requiredFailure(input, definition) {
  const required = definition.required_context.filter((field) => field !== "correlation");
  const missing = required.find((field) => input[field] === undefined);
  if (!missing) return null;
  const codes = { actor: "MISSING_REQUIRED_ACTOR", tenant: "MISSING_TENANT_CONTEXT" };
  return refusal(codes[missing] ?? "SDK_MISSING_EVENT_FIELD", `/${missing}`);
}

export function buildEvent({ method, input, config }) {
  const definition = BY_NAME.get(METHODS[method]);
  const missing = requiredFailure(input, definition);
  if (missing) return missing;
  const body = eventFromInput({ definition, input, config });
  const semantic = semanticFailure({ input, body }, definition);
  if (semantic) return semantic;
  if (!validate(body)) return refusal("SDK_SCHEMA_VALIDATION_FAILED", validate.errors[0].instancePath);
  return { ok: true, value: body };
}

export function validRedelivery(event) {
  if (!validate(event)) return refusal("SDK_SCHEMA_VALIDATION_FAILED", validate.errors[0].instancePath);
  return null;
}
