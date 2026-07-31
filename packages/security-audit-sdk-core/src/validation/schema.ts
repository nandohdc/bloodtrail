import validateSchema from "../generated/schema-validator.generated.cjs";
import type { SecurityAuditEvent } from "../generated/contract.generated.js";
import type { AuditResult } from "../errors.js";
import { failure } from "../errors.js";

export function validateSchemaStructure(value: unknown): AuditResult<SecurityAuditEvent> {
  if (validateSchema(value)) return { ok: true, value: value as SecurityAuditEvent };
  const first = validateSchema.errors?.[0];
  return failure("SDK_SCHEMA_VALIDATION_FAILED", "validation", first?.instancePath || "/");
}
