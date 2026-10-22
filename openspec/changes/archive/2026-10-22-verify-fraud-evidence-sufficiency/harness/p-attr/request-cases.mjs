// Build hypotheses, NOT frozen expectations or measured run evidence.
// #802 comments 6137582157/6137593009 at 5d931ad, re-derived at REQUEST_BASE.
export const REQUEST_BASE = "cc4fdf5a3309db5077b85c4954c916b9ba902b8e";
const CORE = "packages/security-audit-sdk-core/src/";
const CONTRACT = "contracts/security-audit/";
const basis = (...paths) => paths.map((path) => `${CORE}${path}`);
const policy = (lines) => `${CONTRACT}policies/field-policy.json:${lines}`;
const AUTHORITY = `${CONTRACT}docs/authority-matrix.md:11-18`;
const SPEC = "openspec/specs/security-audit-event-contract/spec.md:90-117";
const PLAIN = basis("context.ts:139-196,244-254,283-323", "events.ts:98-131,177-227,238-253,383-416", "sdk.ts:112-145,208-244,268-276", "testing.ts:21-33");
const ESCALATION = basis("validation/semantic.ts:98-114,249-318,371-389", "context.ts:111-114,387-392", "validation/index.ts:10-16", "errors.ts:74");
const ACTOR = [...ESCALATION, policy("303-361"), AUTHORITY, SPEC];
const SUBJECT = [...basis("context.ts:248-254"), policy("373-421,983-1001"), AUTHORITY];
const CREDENTIAL = [...basis("context.ts:252-254"), policy("493-521"), AUTHORITY, SPEC];
const TENANT = [...basis("context.ts:283-297", "validation/semantic.ts:392-405", "validation/schema.ts:8-17,94-104,123-129,146-153"), policy("293-301"), `${CONTRACT}schema/security-audit-event.schema.json:9-21`];
const FAMILY = new Map([
  ["PR", { method: "passwordResetRequested", purpose: "password_reset_requested", operation: "execute", catalog: "457-511", generated: "737-763", rule: "account only if resolved safely; subject only if safely resolved" }],
  ["RA", { method: "accountRegistrationAttempted", purpose: "account_registration_attempted", operation: "create", catalog: "1-60", generated: "515-548", rule: "account resource only after server resolution; no fabricated principal" }],
]);
const REFUSALS = {
  tenant: { code: "MISSING_TENANT_CONTEXT", category: "validation", path: "/tenant" },
  conflict: { code: "TENANT_RESOURCE_CONFLICT", category: "validation", path: "/tenant/claimed_tenant_id" },
  actor: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor/provenance/trust_level" },
  principal: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" },
};

function pair({ calls = 7, nx = calls, mode = "main", outcome = "accepted", claim } = {}) {
  return ["ex", "nx"].map((target) => ({ target, mode, outcome, claim,
    variant_id: mode === "main" ? target : `${mode}-${target}`, predicted_calls: target === "ex" ? calls : nx }));
}

const ROWS = [
  ["B", "baseline", "baseline", pair({ calls: 6 }), PLAIN, "Honest anonymous targetless baseline; conforms, no ambiguity/misuse/disclosure. B aliases source C0."],
  ["C1", "claimed", "actor", pair(), ACTOR, "CP anonymous actor id accepted: ambiguity YES, scoped occurrence flag YES, circumvents, misuse YES; grouping ex/nx, no principal linkage."],
  ["C2", "hooked", "hook", pair({ calls: 8 }), [...ACTOR, ...basis("events.ts:287-352,503-519", "config.ts:27-35,254-266")], "Synchronous hook uses supplied semantic/effective tenant, preserves CP and client_claim; ambiguity YES, circumvents, misuse YES; no cross-purpose join or serialized hook key_id."],
  ["C3", "display", "display", pair(), [policy("333-341"), SPEC], "Keyed display text stays CP/client_claim: ambiguity NO, circumvents, misuse YES (G-log implementer default)."],
  ["C4", "subject", "subject", pair(), SUBJECT, "Unresolved CP subject accepted but ambiguous, violates and misuses resolved affected-entity meaning."],
  ["C5", "resolved", "subject", [...pair({ calls: 7, nx: 6, mode: "subject" }), ...pair({ calls: 7, nx: 6, mode: "resource" })], SUBJECT, "Safe SR account in subject or resource conforms, ambiguity NO, misuse NO; ex-only target/linkage and consumer existence disclosure YES. nx has neither subject nor resource identity; no package refusal."],
  ["CR", "resource", "resource", pair(), SUBJECT, "Unresolved keyed CP account resource accepted: ambiguity YES, violates, misuse YES; SDK stamps operation type."],
  ["C6", "credential", "credential", pair(), CREDENTIAL, "No credential was used: keyed CP credential is ambiguous, violates and misuses credential-reference meaning; key_id does not upgrade origin."],
  ["C6s", "credential-subject", "credential", pair({ calls: 8, nx: 7 }), [...SUBJECT, ...CREDENTIAL], "SR resolved subject conforms separately and links ex; CP credential violates/misuses on ex/nx. Subject presence discloses existence; nx still groups by credential."],
  ["C7", "tenant-claim", "tenant", pair({ claim: "tnt-b02" }), TENANT, "Tenantless plus client claim accepted; no target/ambiguity/misuse/disclosure, resource class n/a."],
  ["C7a", "claim-only", "tenant", pair({ claim: "tnt-b02", outcome: "tenant" }), TENANT, "Omit authoritative tenant at runtime: schema's first required error maps to MISSING_TENANT_CONTEXT/validation /tenant."],
  ["C7b", "conflicting-tenant", "tenant", pair({ calls: 8, claim: "tnt-b02", outcome: "conflict" }), [...TENANT, SPEC], "Conflicting claimed tenant refused. SDK versus contract scenario discrepancy is a finding, not an expectation mismatch."],
  ["C8", "claimed-human", "escalation", pair({ outcome: "actor" }), ESCALATION, "Constructor accepts claimed typed actor; named method refuses actor trust before principal/tenant consistency checks."],
  ["C9", "principal", "escalation", pair({ outcome: "principal" }), ESCALATION, "Anonymous+principal only is blocked; NOT a general no-fabricated-principal guarantee. See X2."],
  ["X2", "fabricated-principal", "extra", pair({ calls: 8 }), [...ESCALATION, policy("313-321,413-421"), SPEC], "CP authoritative typed actor AND fabricated CP principal accepted: ambiguity YES, occurrence flag NO, circumvents, misuse YES; no honest linkage."],
];
const SOURCE_GROUPS = new Map([["C6s", "C6"], ["C7a", "C7"]]);

function corrections({ family, suffix }) {
  if (suffix === "C7a") return { old_text: "schema.ts:91 (shared 85-94,141-144 tenant mapping)", reason: "Re-derived schema.ts:8-17,94-104,123-129,146-153 and schema required:9-21: first required tenant error; same returned code/category/path, corrected citations." };
  if (family !== "RA") return undefined;
  if (suffix === "C9") return { old_text: "This enforces no fabricated principal", reason: "Skeptic: anonymous+principal only; authoritative typed CP actor plus fabricated principal is accepted in X2. Explicit RA catalog rule is not enforced generally." };
  if (!["B", "C5", "CR"].includes(suffix)) return undefined;
  return { old_text: "Captured event omits derived resource/operation_type", reason: "Skeptic, re-derived events.ts:383-416: register always stamps create, even without resource input; SDK value, not host assertion of committed creation." };
}

function sourceVariant({ variant, operation }) {
  const { outcome, ...setup } = variant;
  const accepted = outcome === "accepted";
  const source_outcome = { kind: "returned", accepted, sink_count: accepted ? 1 : 0 };
  if (accepted) source_outcome.assertions = { "events.0.resource.operation_type": operation };
  else source_outcome.diagnostic = REFUSALS[outcome];
  return { ...setup, source_outcome };
}

function descriptor({ family, row }) {
  const [suffix, scenario, group, variants, sources, classification] = row;
  const spec = FAMILY.get(family);
  return { case_id: `${family}-${suffix}`, family, scenario, group,
    aliases: suffix === "B" ? [`${family}-C0`] : [], source_group: `${family}-${SOURCE_GROUPS.get(suffix) ?? suffix}`,
    comment_id: suffix === "X2" ? "6137593009" : "6137582157", added_by: suffix === "X2" ? "review" : undefined,
    method: spec.method, purpose: spec.purpose, operation_type: spec.operation,
    hook_mode: group === "hook" ? "sync" : "none",
    variants: variants.map((variant) => sourceVariant({ variant, operation: spec.operation })),
    predicted_calls: variants.reduce((sum, variant) => sum + variant.predicted_calls, 0),
    setup: `${family}-B public contexts, ${scenario}; fresh Node SDK per explicit ex/nx variant; ${spec.rule}. Runtime omission negatives remain untyped ESM calls.`,
    basis: [...new Set([`${CONTRACT}catalog/catalog.json:${spec.catalog}`, ...PLAIN, ...basis(`generated/contract.generated.ts:${spec.generated}`, "validation/semantic.ts:46-55,98-114"), ...sources])],
    corrected_at: REQUEST_BASE, classification, confidence: ["C3", "C5"].includes(suffix) ? "medium" : "high",
    corrected_from: corrections({ family, suffix }),
  };
}

export const PR_CASES = ROWS.map((row) => descriptor({ family: "PR", row }));
export const RA_CASES = ROWS.map((row) => descriptor({ family: "RA", row }));
export const REQUEST_DEFAULTS = [
  "G-log implementer defaults: Node factory, SDK-supplied purpose/effective tenant hook scope, keyed display text is meaning misuse",
  "Implementer default: explicit ex/nx pairs for every group; C5 has subject/resource pairs; B aliases C0, not a second emission",
  "Implementer default: host K uses presented-identifier scope; hook platform-login fallback only for absent effective tenant",
  "Implementer default: all accepted captures assert SDK operation type, create for RA and execute for PR, not just B/C5/CR",
  "Implementer default: counts include constructed-but-replaced/omitted contexts; tenant discrepancy is a finding, not a mismatch",
];
export const REQUEST_JOIN_PAIRS = ["PR", "RA"].flatMap((family) => ["subject.id", "resource.id"].map((from) => ({ from_family: family, from, to_family: "AS", to: "authenticated_principal.id" })));
