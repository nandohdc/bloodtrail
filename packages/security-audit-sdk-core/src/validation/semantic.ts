import { CONTRACT_SCHEMA_NAME, CONTRACT_VERSION, EVENT_CATALOG } from "../generated/contract.generated.js";
import type { SecurityAuditEvent } from "../generated/contract.generated.js";
import type { AuditResult } from "../errors.js";
import { failure } from "../errors.js";

const byName = new Map(EVENT_CATALOG.map((entry) => [entry.name, entry]));

export function validateBaseSemantics(event: SecurityAuditEvent): AuditResult<SecurityAuditEvent> {
  if (event.schema.name !== CONTRACT_SCHEMA_NAME || event.schema.version !== CONTRACT_VERSION) {
    return failure("UNSUPPORTED_SCHEMA_VERSION", "validation", "/schema/version");
  }
  const definition = byName.get(event.event.name);
  if (!definition) return failure("UNKNOWN_CATALOG_VALUE", "validation", "/event/name");
  if (event.event.category !== definition.category) return failure("UNKNOWN_CATALOG_VALUE", "validation", "/event/category");
  if (event.event.action !== definition.action) return failure("UNKNOWN_CATALOG_VALUE", "validation", "/event/action");
  if (event.event.delivery_class !== definition.delivery) return failure("UNKNOWN_CATALOG_VALUE", "validation", "/event/delivery_class");
  if (!(definition.phase as readonly string[]).includes(event.event.lifecycle_phase)) return failure("SDK_SEMANTIC_VALIDATION_FAILED", "validation", "/event/lifecycle_phase");
  if (!(definition.outcomes as readonly string[]).includes(event.event.outcome)) return failure("SDK_SEMANTIC_VALIDATION_FAILED", "validation", "/event/outcome");
  if (event.event.commit_state === undefined || !(definition.commit as readonly string[]).includes(event.event.commit_state)) return failure("SDK_SEMANTIC_VALIDATION_FAILED", "validation", "/event/commit_state");
  return { ok: true, value: event };
}
