// Construct a fresh envelope from the catalog, never from canonical example events.
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { jsonFile } from "../lib/io.mjs";
import { unbrandedPath } from "./outbox-fake-core.mjs";
import { validateContexts } from "./outbox-fake-context.mjs";
import { failure } from "./outbox-fake-operations.mjs";

const require = createRequire(import.meta.url);
const schema = require("../../../../../packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs");
const catalog = jsonFile(new URL("../../../../../contracts/security-audit/catalog/catalog.json", import.meta.url));
export const EVENT_NAMES = {
  roleAssigned: "bloodtrail.audit.authorization.role.assigned",
  sensitiveResourceModified: "bloodtrail.audit.data.sensitive_resource.modified",
};

function operationCommitted(input) {
  if (!input.operation) return false;
  return input.operation.state === "committed";
}

function envelope({ input, config, definition }) {
  const handle = input.operation;
  return {
    schema: { name: "com.bloodtrail.security-audit.event", version: config.contractVersion },
    event: {
      id: randomUUID(), name: definition.name, category: definition.category, action: definition.action,
      lifecycle_phase: "completed", outcome: "success", ...input.event,
      commit_state: "committed", delivery_class: definition.delivery, observed_at: config.clock.now().toISOString(),
    },
    producer: config.producer, service: config.service, environment: config.environment,
    initiator: { type: "service", id: config.service.name, version: config.service.version },
    actor: input.actor, tenant: input.tenant, subject: input.subject,
    resource: input.resource, authorization: input.authorization,
    correlation: {
      ...input.correlation, operation_id: handle.operationId, transaction_id: handle.transactionId,
      correlation_id: handle.correlationId, retry_attempt: 0,
    },
    data: {
      classification: "confidential", retention_class: definition.retention, field_policy_version: config.contractVersion,
    },
  };
}

export function buildOutboxAuditEvent({ method, input, config }) {
  const path = unbrandedPath(input);
  if (path) return failure("AUTHORITY_ESCALATION", path, "authority");
  if (!operationCommitted(input)) return failure("PREMATURE_SUCCESS", "/operation/state");
  const definition = catalog.find((entry) => entry.name === EVENT_NAMES[method]);
  if (!definition) return failure("UNKNOWN_CATALOG_VALUE", "/event/name");
  const base = JSON.parse(JSON.stringify(envelope({ input, config, definition })));
  const invalid = validateContexts(base, definition);
  if (invalid) return invalid;
  if (!schema(base)) return failure("SDK_SCHEMA_VALIDATION_FAILED", schema.errors[0].instancePath);
  return { ok: true, event: base };
}
