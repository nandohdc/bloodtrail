import type { SecurityAuditEvent } from "../generated/contract.generated.js";
import type { AuditResult } from "../errors.js";
import { normalizeCanonicalInput } from "../errors.js";
import { validateBaseSemantics } from "./semantic.js";
import { validateSchemaStructure } from "./schema.js";
import { validateNormalizedNoProhibitedData } from "./prohibited.js";

export function validateSecurityAuditEvent(value: unknown): AuditResult<SecurityAuditEvent> {
  const normalized = normalizeCanonicalInput(value, "/");
  if (!normalized.ok) return normalized;
  const prohibited = validateNormalizedNoProhibitedData(normalized.value.value, normalized.value.bytes);
  if (!prohibited.ok) return prohibited;
  const structural = validateSchemaStructure(normalized.value.value);
  if (!structural.ok) return structural;
  const semantic = validateBaseSemantics(structural.value);
  if (!semantic.ok) return semantic;
  const postScan = validateNormalizedNoProhibitedData(semantic.value, normalized.value.bytes);
  if (!postScan.ok) return postScan;
  return semantic;
}

export { validateNoProhibitedData } from "./prohibited.js";
