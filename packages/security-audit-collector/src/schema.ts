// Structural validation through the EXACT generated validator the SDK core
// produces. The collector runs a byte-identical vendored copy (drift-gated by
// scripts/check-validator-drift.mjs), so producer and collector cannot
// disagree about what is valid (F2 of the #107 plan).

import validateGenerated from "./generated/schema-validator.generated.cjs";

export interface StructuralFailure {
  // The Ajv keyword of the first error (fixed vocabulary) and the bounded
  // schema pointer it failed against. Both come from the generated schema,
  // never from the submitted payload, so no caller data is disclosed.
  readonly keyword: string;
  readonly schemaPath: string;
}

export type StructuralResult =
  | { readonly valid: true }
  | { readonly valid: false; readonly failure: StructuralFailure };

const MAX_SCHEMA_PATH = 128;

export function validateStructural(value: unknown): StructuralResult {
  const ok = validateGenerated(value);
  if (ok) return { valid: true };
  const first = validateGenerated.errors?.[0];
  const keyword = typeof first?.keyword === "string" ? first.keyword : "unknown";
  const rawPath = typeof first?.schemaPath === "string" ? first.schemaPath : "";
  return {
    valid: false,
    failure: { keyword, schemaPath: rawPath.slice(0, MAX_SCHEMA_PATH) },
  };
}
