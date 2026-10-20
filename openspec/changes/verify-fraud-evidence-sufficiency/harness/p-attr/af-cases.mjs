// Build-only descriptors, NOT frozen expectations or run evidence. #802 comments
// 6137582157/6137593009 at draft 5d931ad; re-derived at AF_BASE below.
export const AF_BASE = "cc4fdf5a3309db5077b85c4954c916b9ba902b8e";
const CORE = "packages/security-audit-sdk-core/src/";
const CONTRACT = "contracts/security-audit/";
const SPEC = "openspec/specs/security-audit-event-contract/spec.md:90-104";
const basis = (...paths) => paths.map((path) => `${CORE}${path}`);
const policy = (lines) => `${CONTRACT}policies/field-policy.json:${lines}`;
const catalog = `${CONTRACT}catalog/catalog.json:177-227`;
const authority = `${CONTRACT}docs/authority-matrix.md:12-18`;
const OUTCOMES = {
  accepted: { accepted: true, sink_count: 1 },
  tenant: { accepted: false, sink_count: 0, diagnostic: { code: "MISSING_TENANT_CONTEXT", category: "validation", path: "/tenant" } },
  conflict: { accepted: false, sink_count: 0, diagnostic: { code: "TENANT_RESOURCE_CONFLICT", category: "validation", path: "/tenant/claimed_tenant_id" } },
  actor: { accepted: false, sink_count: 0, diagnostic: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor/provenance/trust_level" } },
  principal: { accepted: false, sink_count: 0, diagnostic: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" } },
  length: { accepted: false, sink_count: 0, diagnostic: { code: "FIELD_LIMIT_EXCEEDED", category: "validation", path: "/authentication/method" } },
  hook: { accepted: false, sink_count: 0, diagnostic: { code: "SDK_HOOK_FAILURE", category: "privacy", path: "/actor/id" } },
  async: { accepted: false, sink_count: 0, diagnostic: { code: "SDK_UNSUPPORTED_HOOK_RESULT", category: "privacy", path: "/actor/id" } },
};

function pair({ calls, nxCalls = calls, mode = "main", outcome = "accepted", ...extra }) {
  return ["ex", "nx"].map((target) => ({
    variant_id: mode === "main" ? target : `${mode}-${target}`, target, mode,
    predicted_calls: target === "ex" ? calls : nxCalls,
    source_outcome: { kind: "returned", ...OUTCOMES[outcome] }, ...extra,
  }));
}

const PLAIN = basis("context.ts:139-196", "events.ts:98-131,238-253,383-414", "sdk.ts:124-125,208-244");
const SUBJECT = [...basis("context.ts:248-254", "validation/semantic.ts:311-314"), policy("373-401"), authority];
const HOOK = basis("events.ts:287-352", "config.ts:27-35,254-266");
const TENANT = basis("context.ts:283-297", "events.ts:177-183", "validation/semantic.ts:392-405", "validation/schema.ts:8-17,96-104,126-129,146-156");
const ESCALATION = basis("validation/semantic.ts:372-379", "context.ts:111-114,387-392", "errors.ts:74", "validation/index.ts:10-16");

const ROWS = [
  ["AF-B", "baseline", "baseline", pair({ calls: 7 }), PLAIN, "Honest targetless control; conforms; no ambiguity, disclosure or misuse."],
  ["AF-C0t", "credential-type", "baseline", pair({ calls: 8 }), basis("context.ts:252-254"), "Credential type only; conforms; no target."],
  ["AF-C1", "claimed", "actor/display", pair({ calls: 8 }), [...PLAIN, policy("313-361"), SPEC], "CP actor.id: ambiguous, occurrence flag, circumvents, misuse; nx grouping."],
  ["AF-C2", "hooked", "hook", [...pair({ calls: 9 }), ...pair({ calls: 7, mode: "absent" })], HOOK, "Hook preserves CP and client_claim; key_id dropped; absent actor.id skips callback."],
  ["AF-C3", "display", "actor/display", pair({ calls: 8 }), [policy("333-341"), SPEC, `${CONTRACT}schema/security-audit-event.schema.json:410-414`], "No ambiguity; circumvents; display text misused; nx covered."],
  ["AF-C3s", "subject-display", "subject/resource", pair({ calls: 8 }), SUBJECT, "No ambiguity; violates; display text misused; nx covered."],
  ["AF-C4", "subject", "subject/resource", pair({ calls: 8 }), SUBJECT, "CP subject: ambiguous, violates, misuse; nx covered."],
  ["AF-C5", "resolved-subject", "subject/resource", pair({ calls: 8, nxCalls: 7 }), SUBJECT, "SR subject: no ambiguity/misuse; violates and discloses existence; ex-only linkage."],
  ["AF-CR", "resource", "subject/resource", [...pair({ calls: 8, resource_type: "account" }), ...pair({ calls: 8, mode: "credential-type", resource_type: "credential" })], [...basis("context.ts:299-303", "events.ts:383-387"), policy("983-1001")], "CP keyed resource: ambiguous, violates, misuse; nx grouping."],
  ["AF-C6", "credential", "credential", pair({ calls: 8 }), [...basis("context.ts:252-254"), policy("493-521"), authority, SPEC], "Keyed CP credential reference: ambiguous, violates, misuse; nx grouping."],
  ["AF-C6s", "credential-subject", "credential", pair({ calls: 9, nxCalls: 8 }), SUBJECT, "CP credential remains ambiguous/misused; SR subject does not. Violates/discloses; nx still has credential target."],
  ["AF-C7", "tenant-claim", "tenant", pair({ calls: 8, claim: "tnt-b02" }), TENANT, "Client tenant remains claim; no target; resource rule n/a."],
  ["AF-C7a", "claim-only", "tenant", pair({ calls: 8, claim: "tnt-b02", outcome: "tenant" }), TENANT, "Refusal is observation, not baseline invalidation."],
  ["AF-C7b", "conflicting-tenant", "tenant", [...pair({ calls: 9, claim: "tnt-b02", outcome: "conflict" }), ...pair({ calls: 9, mode: "equal-claim", claim: "tnt-a01" })], TENANT, "SDK/contract discrepancy is a finding, not an expectation mismatch (spec.md:115-117)."],
  ["AF-C8", "claimed-human", "escalation/extra", pair({ calls: 8, outcome: "actor" }), ESCALATION, "Semantic escalation blocked; constructor itself accepts."],
  ["AF-C9", "principal", "escalation/extra", pair({ calls: 8, outcome: "principal" }), ESCALATION, "Only anonymous actor plus principal is blocked."],
  ["AF-X1", "authoritative-anonymous", "escalation/extra", pair({ calls: 8 }), PLAIN, "Accepted CP authoritative anonymous actor: ambiguous, invisible flag, circumvents, misuse; story-3 finding."],
  ["AF-X2", "fabricated-actor", "escalation/extra", pair({ calls: 8 }), PLAIN, "Accepted CP typed actor: ambiguous, invisible flag, circumvents, misuse; story-3 finding."],
  ["AF-X3", "existence-reason", "escalation/extra", pair({ calls: 8 }), [policy("683-691"), catalog], "Accepted existence oracle, no target; story-3 finding."],
  ["AF-X4", "lookup-principal", "escalation/extra", pair({ calls: 9, nxCalls: 7 }), [...ESCALATION, policy("313-321,413-421"), authority], "CP-only definition yields no ambiguity; lookup violates authenticated_identity allowed source; misuse/circumvents/disclosure, ex-only grouping/linkage."],
  ["AF-F1", "request", "free-form", [...pair({ calls: 7, mode: "id" }), ...pair({ calls: 7, mode: "route" })], [...basis("events.ts:122,238-253"), policy("1133-1157,1243-1251")], "Keyed CP request id echoed into correlation.request_id; route alternative; ambiguous, circumvents, misuse."],
  ["AF-F2", "authentication", "free-form", [...pair({ calls: 8 }), ...pair({ calls: 8, mode: "length-control", outcome: "length" })], [...basis("validation/schema.ts:126-129"), policy("593-601"), `${CONTRACT}schema/security-audit-event.schema.json:694-698`], "Bare 64-hex accepted (ambiguous/circumvents/misuse); 66-char control refused."],
  ["AF-F3", "authorization", "free-form", pair({ calls: 8 }), [...basis("validation/semantic.ts:380-384,416-434"), policy("783-791")], "CP authorization resource_context.id: accepted, ambiguous, circumvents, misuse."],
  ["AF-C2h-t", "tenantless-hook", "hook", pair({ calls: 9, claim: "tnt-b02", outcome: "hook" }), HOOK, "No authoritative tenant: privacy refusal before callback, not missing-tenant validation."],
  ["AF-C2-async", "hooked", "hook", pair({ calls: 9, outcome: "async" }), HOOK, "Promise return refused after one callback; deliberate observation, not precondition invalidation."],
  ["AF-C0r", "resource-type", "baseline", pair({ calls: 8 }), [...basis("events.ts:383-387"), policy("983-991")], "Implementer default: credential type with no id conforms, as catalog example."],
  ["AF-F4", "message", "free-form", pair({ calls: 7 }), [policy("73-81"), `${CONTRACT}schema/security-audit-event.schema.json:161-164`], "Added by implementer default: free text <=512; accepted, ambiguity YES, misuse YES, circumvents."],
];

export const AF_DRAFTING_QUESTION = "Not in story 2, but plausible: event.outcome_reason.message (free text up to 512, authoritative_server) could also carry a presented identifier, and the SDK would accept it. Decide whether to add it as a carrier (expected: accepted, ambiguity YES, misuse YES).";
const ADDITIONS = new Map([
  ...["AF-X4", "AF-F1", "AF-F2", "AF-F3", "AF-C2h-t", "AF-C2-async", "AF-C0r"].map((id) => [id, { added_by: "review" }]),
  ["AF-F4", { added_by: "implementer default", drafting_question: AF_DRAFTING_QUESTION }],
]);

const GROUPS = new Map([["AF-B", "AF-B/C0"], ["AF-C0t", "AF-B/C0"], ["AF-C3s", "AF-C3"], ["AF-C7a", "AF-C7"], ["AF-F4", "Open questions from drafting"]]);
const CORRECTIONS = new Map([
  ["AF-B", { old_text: "ex/nx differ in request.id despite fixed request id", reason: "Keep request.id fixed; correlation.request_id is its echo. Ignore only seven SC metadata leaves, never target-bearing request ids." }],
  ["AF-C1", { old_text: "unscoped occurrence flag also flags actor.type", reason: "Compare policy with occurrence provenance only when actor.id is present." }],
  ["AF-C3", { old_text: "only accepted target carrier with zero ambiguity", reason: "C3s also covers nx without ambiguity; C5, C6s subject and X4 SR values are not ambiguous either, but have no honest nx carrier." }],
  ["AF-C7a", { old_text: "schema.ts:85-94,141-144", reason: "Base schema.ts:8-17,96-104,126-129,146-156 maps first required tenant error; draft line 141-144 citation was invalid." }],
  ["AF-C8", { old_text: "two core copies turn semantic escalation into DUPLICATE_AUTHORITY", reason: "Mixed-copy frame branding refuses every call first at /actor. Semantic validation clones events, so registry misses there remain AUTHORITY_ESCALATION. One core is a matrix precondition; no two-copy install." }],
  ["AF-C6s", { old_text: "L1 gives nx no target", reason: "nx retains keyed credential.reference for grouping, with no success-principal linkage." }],
]);

function descriptor([case_id, scenario, group, variants, sources, classification]) {
  const hook_mode = case_id === "AF-C2-async" ? "async" : "sync";
  return {
    case_id, aliases: case_id === "AF-B" ? ["AF-C0"] : [], source_group: GROUPS.get(case_id) ?? case_id,
    comment_id: ["AF-X4", "AF-F1", "AF-F2", "AF-F3", "AF-C2h-t", "AF-C2-async", "AF-C0r", "AF-F4"].includes(case_id) ? "6137593009" : "6137582157",
    scenario, group, variants, hook_mode: group === "hook" ? hook_mode : "none",
    predicted_calls: variants.reduce((sum, variant) => sum + variant.predicted_calls, 0),
    basis: [...new Set([catalog, ...sources])], corrected_at: AF_BASE, classification,
    confidence: scenario.includes("display") ? "medium" : "high", corrected_from: CORRECTIONS.get(case_id),
    ...ADDITIONS.get(case_id),
  };
}

export const AF_CASES = ROWS.map(descriptor);
export const AF_DEFAULTS = {
  g_log_implementer_defaults: ["Node binding SDK factory", "hook keys use supplied per-event semantic purpose and effective tenant", "keyed display name is meaning misuse"],
  implementer_defaults: ["platform-login is only the absent-effective-tenant hook fallback, not reinstatement of G2", "host K scope is presented-identifier; synthetic ids already equal their lookup-canonical form", "AF-C0r type-only credential resource conforms", "AF-F4 is keyed CP message text, added from the drafting question", "AF-X1/X2/X3 are in story-3 findings", "conflicting-claimed-tenant discrepancy is a finding, not a mismatch"],
};
export const AF_PRECONDITION = "Exactly one installed core copy for the entire matrix; verifyKitIdentity/npm ls evidence is required by the shared runner before any public call.";
