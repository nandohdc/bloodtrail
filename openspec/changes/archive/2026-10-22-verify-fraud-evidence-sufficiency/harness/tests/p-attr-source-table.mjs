// INDEPENDENT HAND-WRITTEN ORACLE. Transcribed from source text at cc4fdf5,
// not from P-attr expectations, workload labels, or computeAxes output.
// Tuple: ambiguity, actor.id flag, rule, misuse, disclosure, grouping.
const SEMANTIC = "packages/security-audit-sdk-core/src/validation/semantic.ts";
const FIELDS = "contracts/security-audit/policies/field-policy.json";
const CATALOG = "contracts/security-audit/catalog/catalog.json";
const SPEC = "openspec/specs/security-audit-event-contract/spec.md";
const EVENTS = "packages/security-audit-sdk-core/src/events.ts";
const NA = ["n/a", "n/a", "n/a", "n/a", "n/a", "n/a"];

// Q1: keyed targets are structural. The independent table freezes the declared
// key scope, input origin, digest format and the expected matches boolean;
// it never freezes a digest, so a fresh per-run random key can never mismatch.
const HOST_KEYED = { key_scope: { purpose: "presented-identifier", tenant: null },
  input_origin: "CP", digest_format: "sha256-hex-64", matches_declared_input: true };

function keyedTarget(path, kind = "presented_identifier") {
  return { path, kind, keyed: HOST_KEYED };
}

export const SOURCE_TABLE = [
  { id: "AF-C1", axes: [true, true, "circumvents", true, "n/a", true], ambiguous: ["actor.id"], sources: [], targets: [{ path: "actor.id", value: "pid-ex-0001", kind: "presented_identifier" }], basis: [`${FIELDS}:313-321`, `${SEMANTIC}:372-379`, `${SPEC}:90-92`] },
  { id: "AF-C3", axes: [false, false, "circumvents", true, "n/a", true], ambiguous: [], sources: [], targets: [keyedTarget("actor.display_name")], basis: [`${FIELDS}:333-341`, `${CATALOG}:202`, `${SPEC}:92`] },
  { id: "AF-C8", axes: NA, diagnostic: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor/provenance/trust_level" }, basis: [`${SEMANTIC}:372-376`] },
  { id: "AF-X4", axes: [false, false, "circumvents", true, "n/a", true], ambiguous: [], sources: ["actor.id", "authenticated_principal.id"], targets: [{ path: "actor.id", value: "acct-0001", kind: "resolved_account" }, { path: "authenticated_principal.id", value: "acct-0001", kind: "resolved_account" }], basis: [`${SEMANTIC}:372-379`, "contracts/security-audit/docs/authority-matrix.md:12", `${FIELDS}:313-321,413-421`] },
  { id: "AS-C3", axes: [false, false, "circumvents", true, "n/a", true], ambiguous: [], sources: [], targets: [keyedTarget("actor.display_name")], basis: [`${FIELDS}:333-341`, `${CATALOG}:148`], correction: "n/a -> circumvents; a withheld target in a non-resource field" },
  { id: "AS-C5", axes: [false, false, "violates", false, "n/a", true], ambiguous: [], sources: [], targets: [{ path: "subject.id", value: "acct-0001", kind: "resolved_account" }], basis: [`${FIELDS}:373-381`, `${CATALOG}:148`], correction: "outside but harmless -> violates; subject identity is not a credential/session reference" },
  { id: "AS-C0", axes: NA, diagnostic: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" }, basis: [`${SEMANTIC}:377-379`] },
  { id: "PR-C4", axes: [true, false, "violates", true, "n/a", true], ambiguous: ["subject.id"], sources: [], targets: [{ path: "subject.id", value: "pid-ex-0001", kind: "presented_identifier" }], basis: [`${FIELDS}:373-381`, `${CATALOG}:483-485`] },
  { id: "PR-C5", axes: [false, false, "conforms", false, "n/a", true], ambiguous: [], sources: [], targets: [{ path: "subject.id", value: "acct-0001", kind: "resolved_account" }], basis: [`${FIELDS}:373-381`, `${CATALOG}:483-485`] },
  { id: "PR-C8", axes: NA, diagnostic: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/actor/provenance/trust_level" }, basis: [`${SEMANTIC}:372-376`] },
  { id: "RA-B", axes: [false, false, "conforms", false, "n/a", false], ambiguous: [], sources: [], targets: [], assertions: { "events.0.resource.operation_type": "create" }, basis: [`${EVENTS}:383-397`, `${CATALOG}:32-33`], correction: "omitted derived resource -> create; SDK-stamped, not host input" },
  { id: "RA-C5", axes: [false, false, "conforms", false, "n/a", true], ambiguous: [], sources: [], targets: [{ path: "resource.id", value: "acct-0001", kind: "resolved_account" }], assertions: { "events.0.resource.operation_type": "create" }, basis: [`${CATALOG}:33`, `${EVENTS}:383-397`] },
  { id: "RA-C9", axes: NA, diagnostic: { code: "AUTHORITY_ESCALATION", category: "authority", path: "/authenticated_principal" }, basis: [`${SEMANTIC}:377-379`, `${CATALOG}:32`], correction: "general no-fabricated-principal enforcement -> anonymous+principal shape only" },
];

export function tableAxes(row) {
  const [ambiguity, flag, rule, misuse, disclosure, grouping] = row.axes;
  return {
    provenance_ambiguity: ambiguity, in_occurrence_flag: flag, resource_rule: rule,
    meaning_misuse: misuse, discloses_existence: disclosure, per_target_grouping: grouping,
    ambiguous_fields: row.ambiguous ?? [], allowed_source_violations: row.sources ?? [], targets: row.targets ?? [],
  };
}

export function tablePlan(row) {
  const accepted = row.diagnostic === undefined;
  return {
    step_id: `${row.id}/main`, kind: "returned", accepted, diagnostic: row.diagnostic,
    sink_count: accepted ? 1 : 0, frozen: accepted ? [true] : [],
    axes: tableAxes(row), assertions: row.assertions ?? {},
  };
}

export function tableExpectations() {
  return { cases: SOURCE_TABLE.map((row) => ({ case_id: row.id, predicted_calls: 0, expected: [tablePlan(row)] })) };
}
