import type { SecurityAuditEvent } from "../generated/contract.generated.js";
import type { AuditResult } from "../errors.js";
import { validateBaseSemantics } from "./semantic.js";
import { validateSchemaStructure } from "./schema.js";

export function validateSecurityAuditEvent(value: unknown): AuditResult<SecurityAuditEvent> {
  const structural = validateSchemaStructure(value);
  if (!structural.ok) return structural;
  return validateBaseSemantics(structural.value);
}
