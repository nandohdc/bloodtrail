// Build hypotheses only, NOT frozen expectations or measured evidence.
// #802 comments 6137582157/6137593009 (5d931ad), re-derived at AS_BASE.
export const AS_BASE = "cc4fdf5a3309db5077b85c4954c916b9ba902b8e";
const CORE = "packages/security-audit-sdk-core/src/";
const CONTRACT = "contracts/security-audit/";
const basis = (...paths) => paths.map((path) => `${CORE}${path}`);
const policy = (lines) => `${CONTRACT}policies/field-policy.json:${lines}`;
const CATALOG = `${CONTRACT}catalog/catalog.json:121-175`;
const SPEC = "openspec/specs/security-audit-event-contract/spec.md:90-104";
const AUTHORITY = `${CONTRACT}docs/authority-matrix.md:12-18`;
const PLAIN = basis("context.ts:139-196,244-254,283-323", "events.ts:98-131,185-227,383-414", "sdk.ts:120-121,208-244,268-276", "testing.ts:21-33", "generated/contract.generated.ts:575-599", "validation/semantic.ts:102-119");
const ESCALATION = basis("validation/semantic.ts:102-119,271-316,371-389", "context.ts:111-114,387-392", "validation/index.ts:10-16", "errors.ts:74");
const SUBJECT = [...basis("context.ts:248-254", "validation/semantic.ts:311-316"), policy("373-421"), AUTHORITY];
const HOOK = [...basis("events.ts:287-352,510-525", "config.ts:27-35,254-266"), ...ESCALATION];
const CREDENTIAL = [...basis("context.ts:252-254"), policy("493-521"), AUTHORITY, SPEC];
const TENANT = basis("context.ts:283-297", "events.ts:177-183", "validation/semantic.ts:392-405", "validation/schema.ts:8-17,96-104,126-129,146-156");
const OUTCOMES = {
  accepted: { accepted: true, sink_count: 1 },
  principal: { accepted: false, sink_count: 0, diagnostic: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" } },
  missing: { accepted: false, sink_count: 0, diagnostic: { code: "SDK_MISSING_EVENT_FIELD", category: "validation", path: "/authenticated_principal" } },
  actor: { accepted: false, sink_count: 0, diagnostic: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor/provenance/trust_level" } },
  tenant: { accepted: false, sink_count: 0, diagnostic: { code: "MISSING_TENANT_CONTEXT", category: "validation", path: "/tenant" } },
  conflict: { accepted: false, sink_count: 0, diagnostic: { code: "TENANT_RESOURCE_CONFLICT", category: "validation", path: "/tenant/claimed_tenant_id" } },
};

function step({ calls = 11, mode = "main", outcome = "accepted", suffix = "0001", id = "ex", ...extra } = {}) {
  return { variant_id: id, target: "ex", account_suffix: suffix, mode, predicted_calls: calls,
    source_outcome: { kind: "returned", ...OUTCOMES[outcome] }, ...extra };
}

const ROWS = [
  ["AS-B", "baseline", "baseline", [step({ calls: 10 })], PLAIN, "Honest success: SR performer/principal/credential/session, identical account ids; conforms, no ambiguity or misuse."],
  ["AS-C0", "anonymous", "actor", [step({ outcome: "principal" }), step({ mode: "without-principal", id: "without-principal", outcome: "missing" })], ESCALATION, "Anonymous actor with principal refuses authority; omitted required principal refuses validation earlier."],
  ["AS-C1", "claimed", "actor", [step({ outcome: "principal" })], ESCALATION, "CP anonymous claimed actor cannot mirror AF-C1 through this shape; AS-X2 supplies the accepted mirror instead."],
  ["AS-C2", "hooked", "hook", [step({ calls: 12, outcome: "principal" }), step({ calls: 11, mode: "honest-control", id: "honest-control" }), step({ calls: 12, mode: "keyed-mirror", id: "keyed-mirror", linkage_only: true })], HOOK, "Hook executes before authority refusal. Honest control rekeys SR actor.id only, breaking its identical-principal chain (G29); no AF-C2 cross-purpose mirror. Q5: the keyed-mirror repeats AS-X2's raw presented actor through the hook instance, keyed under authentication_succeeded; declared before the run and used only by L2, where its purpose scope prevents any C2 join. The refused AS-C2/main stays a separate control row."],
  ["AS-C3", "display", "display", [step(), step({ mode: "anonymous", id: "anonymous", outcome: "principal" })], [...PLAIN, policy("333-341"), SPEC], "Typed-actor display accepted: ambiguity NO, circumvents, misuse YES. Anonymous display with principal refuses."],
  ["AS-C4", "subject", "subject", [step()], SUBJECT, "CP raw subject: ambiguity YES, violates, misuse YES. L2 needs the separately declared subject-to-subject join."],
  ["AS-C5", "resolved-subject", "subject", [step()], SUBJECT, "SR subject: ambiguity NO, violates the literal credential/session-only rule, misuse NO; duplicates true principal and discloses nothing new."],
  ["AS-CR", "resource", "resource", [step()], [...basis("context.ts:299-303", "events.ts:383-414"), policy("983-1001"), AUTHORITY], "CP keyed resource: ambiguity YES, violates, misuse YES; operation_type execute."],
  ["AS-C6", "credential", "credential", [step()], CREDENTIAL, "CP keyed credential: ambiguity YES, form conforms but misuse YES. AF-C6 mirror misrepresents both ends."],
  ["AS-C6s", "credential-subject", "credential", [step({ calls: 12 })], [...SUBJECT, ...CREDENTIAL], "CP credential remains ambiguous/misused and its slot conforms; SR subject has no ambiguity/misuse but violates. Overall violates; success already proves existence."],
  ["AS-C7", "tenant-claim", "tenant", [step({ claim: "tnt-b02" })], TENANT, "Claim remains client_claim, no additional target or ambiguity; honest AS target fields still conform."],
  ["AS-C7a", "claim-only", "tenant", [step({ claim: "tnt-b02", outcome: "tenant" })], TENANT, "No authoritative tenant: first schema required error, returned refusal at /tenant."],
  ["AS-C7b", "conflicting-tenant", "tenant", [step({ calls: 12, claim: "tnt-b02", outcome: "conflict" })], TENANT, "Refused conflicting claim; SDK/contract scenario discrepancy is a finding, not a mismatch (spec.md:115-117)."],
  ["AS-C8", "claimed-human", "escalation", [step({ outcome: "actor" })], ESCALATION, "Claimed typed actor constructor accepts; named call refuses actor trust before checking principal."],
  ["AS-C9", "anonymous", "escalation", [step({ outcome: "principal" })], ESCALATION, "Separate observable escalation negative, intentionally same construction as AS-C0 with principal."],
  ["AS-X2", "raw-actor", "actor", ["0001", "0002", "0003"].map((suffix) => step({ suffix, id: `ex-${suffix}` })), [...PLAIN, ...ESCALATION, ...basis("validation/semantic.ts:392-434"), policy("313-321,413-421"), AUTHORITY], "CP typed actor plus true SR principal accepted: ambiguity YES, occurrence flag NO, circumvents, misuse YES. No actor/principal id equality check; L2 raw-actor mirror for C1/X1/X2."],
];
const GROUPS = new Map([["AS-C6s", "AS-C6"], ["AS-C7a", "AS-C7"]]);
const CORRECTIONS = new Map([
  ["AS-C3", { old_text: "resource_rule=n/a (actor)", reason: "Skeptic: a withheld presented target in actor display text circumvents (catalog:148); G-log implementer default: keyed display text is meaning misuse." }],
  ["AS-C5", { old_text: "outside the literal rule but harmless", reason: "Skeptic and implementer default: subject.* is target-bearing; only credential/session references allowed. Class violates, low harm, no ambiguity/misuse." }],
  ["AS-C7a", { old_text: "schema.ts:91 (and shared 85-94,141-144 mapping)", reason: "Re-derived schema.ts:8-17,96-104,126-129,146-156; first root required tenant error maps to MISSING_TENANT_CONTEXT/validation /tenant." }],
  ["AS-X2", { old_text: "L2: C1 and C2 cannot be mirrored", reason: "Skeptic: only purpose-scoped C2 fails; AS-X2 repeats C1/X1/X2 raw actor ids beside the real principal. Declare actor-to-actor pair before L2." }],
]);

function descriptor([case_id, scenario, group, variants, sources, classification]) {
  const matrixVariants = variants.filter((variant) => !variant.linkage_only);
  return { case_id, scenario, group, variants, source_group: GROUPS.get(case_id) ?? case_id,
    comment_id: case_id === "AS-X2" ? "6137593009" : "6137582157",
    hook_mode: group === "hook" ? "sync" : "none",
    predicted_calls: matrixVariants.reduce((sum, variant) => sum + variant.predicted_calls, 0),
    setup: `AS-B public contexts, scenario ${scenario}; each explicit variant is a fresh Node SDK instance; success ground truth only, no nx success fabricated.`,
    basis: [...new Set([CATALOG, ...PLAIN, ...sources])], corrected_at: AS_BASE, classification,
    confidence: ["AS-C3", "AS-C5", "AS-C6", "AS-C6s"].includes(case_id) ? "medium" : "high",
    corrected_from: CORRECTIONS.get(case_id),
  };
}

export const AS_CASES = ROWS.map(descriptor);
AS_CASES.at(-1).added_by = "review";
export const AS_MIRROR_PAIRS = [
  { from_family: "AF", from: "actor.display_name", to_family: "AS", to: "actor.display_name" },
  { from_family: "AF", from: "subject.id", to_family: "AS", to: "subject.id" },
  { from_family: "AF", from: "resource.id", to_family: "AS", to: "resource.id" },
  { from_family: "AF", from: "credential.reference", to_family: "AS", to: "credential.reference" },
  { from_family: "AF", from: "actor.id", to_family: "AS", to: "actor.id" },
];
export const AS_DEFAULTS = [
  "G-log implementer defaults: Node factory, hooks use SDK-supplied semantic/effective tenant, keyed display text is meaning misuse",
  "Implementer default: success variants have ex ground truth only; existence disclosure n/a, no fabricated nx success",
  "Implementer default: host K uses shared presented-identifier scope; hook fallback platform-login only when effective tenant absent",
  "Implementer default following skeptic: AS-C5 and AS-C6s subject violate literal credential/session-only rule",
  "Implementer default: predictions count constructed-but-replaced/omitted contexts as well as each public callback",
];
