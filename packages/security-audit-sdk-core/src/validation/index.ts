import type { SecurityAuditEvent } from "../generated/contract.generated.js";
import type { AuditResult } from "../errors.js";
import { validateBaseSemantics } from "./semantic.js";
import { validateSchemaStructure } from "./schema.js";
import { validateNoProhibitedData } from "./prohibited.js";

export function validateSecurityAuditEvent(value: unknown): AuditResult<SecurityAuditEvent> {
  const prohibited = validateNoProhibitedData(value);
  if (!prohibited.ok) return prohibited;
  const structural = validateSchemaStructure(value);
  if (!structural.ok) return structural;
  const semantic = validateBaseSemantics(structural.value);
  if (!semantic.ok) return semantic;
  const postScan = validateNoProhibitedData(semantic.value);
  if (!postScan.ok) return postScan;
  return semantic;
}

export { validateNoProhibitedData } from "./prohibited.js";
