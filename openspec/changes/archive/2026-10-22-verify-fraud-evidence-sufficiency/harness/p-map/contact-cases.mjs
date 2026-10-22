// Implementer-default build plan; neither frozen expectations nor evidence.
// Sources re-derived at 8e6cdf781445574c67883a465eb37581ca14b5ab.
const CORE = "packages/security-audit-sdk-core/src/";
const CONTRACT = "contracts/security-audit/source/contract.source.json";
const SCHEMA = "contracts/security-audit/schema/security-audit-event.schema.json";
const CONTACT = [`${CONTRACT}:3814-3855,2286-2296`, `${CORE}events.ts:73-81,205-225,457-472,503-519`,
  `${CORE}validation/semantic.ts:66,227-289,326-330,391-399,426-435`];
const CATEGORIES = [`${CONTRACT}:305-573,2286-2296`, `${SCHEMA}:1197-1207`,
  `${CORE}generated/contract.generated.ts:170`, `${CORE}validation/prohibited.ts:7-12,45-50,65-71`,
  `${CORE}validation/schema.ts:9-17,80-81,123-127`];

export const CONTACT_CASES = [
  { case_id: "C1", setup: "Contact email and non-factor phone changes, opaque category tokens only; fresh committed handles",
    predicted_calls: 24, variants: [{ id: "email", predicted_calls: 12 }, { id: "phone", predicted_calls: 12 }],
    steps: ["email-begin", "email-mark", "email", "phone-begin", "phone-mark", "phone"],
    candidate_verdict: "STRAINED", rubric_reasons: ["Generic sensitive-resource purpose does not name contact changes; category is free-form, authority retained"],
    basis: CONTACT, confidence: "high" },
  { case_id: "C2a", setup: "Fresh constructors/handles for unregistered, empty object, object-with-kind, 4000-character and 8193-byte items",
    predicted_calls: 59, variants: [{ id: "unregistered", predicted_calls: 12 }, { id: "object", predicted_calls: 12 },
      { id: "object-kind", predicted_calls: 12 }, { id: "ascii-4000", predicted_calls: 12 }, { id: "bytes-8193", predicted_calls: 11 }],
    steps: ["unregistered-begin", "unregistered-mark", "unregistered", "object-begin", "object-mark", "object",
      "object-kind-begin", "object-kind-mark", "object-kind", "ascii-4000-begin", "ascii-4000-mark", "ascii-4000",
      "bytes-8193-begin", "bytes-8193-mark", "bytes-8193"],
    candidate_verdict: "STRAINED", rubric_reasons: ["No registry, enum or item maxLength; objects allowed despite compat registry label"],
    finding: "8192-byte input-scan string cap is separate from the schema; category examples define no vocabulary",
    basis: [...CONTACT, ...CATEGORIES], confidence: "medium" },
  { case_id: "C2b", setup: "Seventeen opaque items, below scan array cap 32 but above schema maxItems 16",
    predicted_calls: 11, variants: [{ id: "items-17", predicted_calls: 11 }], steps: ["items-17-begin", "items-17-mark", "items-17"],
    basis: [...CONTACT, ...CATEGORIES], confidence: "high" },
  { case_id: "C3", setup: "Opaque after-value token smuggled alongside contact category; never address-shaped data",
    predicted_calls: 12, variants: [{ id: "after-value", predicted_calls: 12 }], steps: ["after-value-begin", "after-value-mark", "after-value"],
    candidate_verdict: "MISREPRESENTS", rubric_reasons: ["Content instead of a category contradicts no raw before/after payload and the catalog purpose"],
    basis: [...CONTACT, ...CATEGORIES], confidence: "high" },
  { case_id: "C4", setup: "Contact change labelled security configuration, authenticated human and account resource",
    predicted_calls: 10, variants: [{ id: "configuration", predicted_calls: 10 }],
    steps: ["configuration-begin", "configuration-mark", "configuration"],
    candidate_verdict: "MISREPRESENTS", rubric_reasons: ["Contradicts administrator/workload actor rule and configuration resource meaning, despite acceptance"],
    basis: [`${CONTRACT}:3998-4036`, `${CORE}validation/semantic.ts:69,249-280,328-330,391-399`,
      `${CORE}events.ts:205-225,503-519`], confidence: "high" },
  { case_id: "C5", setup: "MFA-factor phone replacement: remove then enroll, same SDK and committed handle; fresh contexts for each emission",
    predicted_calls: 22, variants: [{ id: "removed", predicted_calls: 13 }, { id: "enrolled", predicted_calls: 9 }],
    steps: ["factor-begin", "factor-mark", "removed", "enrolled"],
    candidate_verdict: "FITS", rubric_reasons: ["Catalog explicitly covers MFA-factor lifecycle, retaining credential and commit meanings"],
    non_factor_verdict: "MISREPRESENTS", non_factor_reason: "A contact phone that is not an MFA factor is not a credential; use C1 instead",
    evidence_reuse: "Use these same captures later for MFA-factor rotation, without extra emissions",
    basis: [`${CONTRACT}:2956-2992,3014-3050`, `${CORE}validation/semantic.ts:51-52,249-352`,
      `${CORE}operations.ts:161-181`, `${CORE}sdk.ts:234-282`, `${CORE}events.ts:205-225,503-519`], confidence: "high" },
  { case_id: "C6", setup: "Tenantless contact modification, subject and resource tenant IDs omitted, resource ID retained",
    predicted_calls: 11, variants: [{ id: "tenantless", predicted_calls: 11 }], steps: ["tenantless-begin", "tenantless-mark", "tenantless"],
    basis: CONTACT, confidence: "high" },
];

export const BRAND_CASES = [
  { case_id: "X1", setup: "Single-core resource constructor followed by intentional object spread adding categories",
    predicted_calls: 11, variants: [{ id: "spread", predicted_calls: 11 }], steps: ["spread-begin", "spread-mark", "spread"],
    finding: "A spread loses object-identity authority; DUPLICATE_AUTHORITY requires a foreign-copy-recognized original, not just two installed copies",
    basis: [...CONTACT, `${CORE}context.ts:388-392,430-445`, `${CORE}duplicate-copy-probe.ts:100-102`], confidence: "high" },
];
