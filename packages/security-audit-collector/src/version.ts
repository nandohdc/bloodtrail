// Collector-side contract version stage: an explicitly enumerated finite
// supported set, per the ratified asymmetric version policy (#75/#76). The
// producer binds EXACT_ONE; a separately authorized collector MAY support an
// explicit finite set for migration. The set is derived from the frozen
// contract's schema version — never configured locally (F1 of the #107 plan).

import { SUPPORTED_CONTRACT_VERSIONS } from "./generated/bounds.generated.js";

export { SUPPORTED_CONTRACT_VERSIONS };

export function isSupportedVersion(value: unknown): value is string {
  if (typeof value !== "string") return false;
  const supported: readonly string[] = SUPPORTED_CONTRACT_VERSIONS;
  return supported.includes(value);
}

export function schemaVersionOf(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return undefined;
  const schema = (value as { readonly schema?: unknown }).schema;
  if (typeof schema !== "object" || schema === null) return undefined;
  return (schema as { readonly version?: unknown }).version;
}
