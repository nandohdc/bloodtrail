import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateCases, materialize } from "../p-d/evaluate.mjs";
import { diagnosticPath } from "../p-d/markers.mjs";
import { EXPECTATIONS, assignPath } from "./pd-fixtures.mjs";

// Hand-derived from source text at dbdd0936ba874d7b622403103644206c4a6fa56f.
// Paths below are relative to packages/security-audit-sdk-core/src/.
// No SDK module is imported; null fields mean no diagnostic on acceptance.
const SOURCE_TABLE = [
  // context.ts:387-391; duplicate-copy-probe.ts:100-101; events.ts:75-78
  { step: "PD-A1/tenant", code: "AUTHORITY_ESCALATION", category: "authority", path: "/tenant", surface: "returned-refusal" },
  // context.ts:355-358,387-391,452-455; sdk.ts:108-109
  { step: "PD-A5/main", code: "AUTHORITY_ESCALATION", category: "authority", path: "/tenant", surface: "thrown-sdk" },
  // context.ts:116-117,387-391; duplicate-copy-probe.ts:100-101
  { step: "PD-B7/main", code: "AUTHORITY_ESCALATION", category: "authority", path: "/tenant", surface: "returned-refusal" },
  // context.ts:225-230,442-448 (claimed actor is not authoritative)
  { step: "PD-B8/delegatedActorContext", code: "AUTHORITY_ESCALATION", category: "authority", path: "/delegation/actor", surface: "thrown-sdk" },
  // operations.ts:212-213; events.ts:215-219; validation/semantic.ts:231-233
  { step: "PD-C4/main", code: "PREMATURE_SUCCESS", category: "validation", path: "/event/commit_state", surface: "returned-refusal" },
  // events.ts:221-224; generated/contract.generated.ts:656-670 (failure supported)
  { step: "PD-C9/mfaRemoved-failure", code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state", surface: "returned-refusal" },
  // events.ts:72-73 precedes branding; validation/prohibited.ts:75-78,85-87
  { step: "PD-D1/main", code: "PROHIBITED_DATA", category: "privacy", path: () => diagnosticPath({ prefix: "/request", recipe: "keyHash" }), surface: "returned-refusal" },
  // events.ts:72-73; validation/prohibited.ts:12,48-50 (16-character threshold)
  { step: "PD-D3/main", code: "PROHIBITED_DATA", category: "privacy", path: "/request/user_agent", surface: "returned-refusal" },
  // context.ts:124,387-391; events.ts:121-122,129 (observed IPv4 retained)
  { step: "PD-E1/main", code: null, category: null, path: null, surface: "accepted" },
  // context.ts:124,387-391; events.ts:121-122,129 (documentation IPv6 retained)
  { step: "PD-E2/main", code: null, category: null, path: null, surface: "accepted" },
  // validation/index.ts:12-15; validation/schema.ts:94-103,135-142
  { step: "PD-F2/main", code: "MISSING_TENANT_CONTEXT", category: "validation", path: "/tenant", surface: "returned-refusal" },
  // validation/index.ts:12-15; validation/schema.ts:94-96,135-142
  { step: "PD-F3/main", code: "MISSING_REQUIRED_ACTOR", category: "validation", path: "/actor", surface: "returned-refusal" },
];

function sourceDiagnostic(entry) {
  if (entry.code === null) return undefined;
  return { code: entry.code, category: entry.category, path: typeof entry.path === "function" ? entry.path() : entry.path };
}

function sourceObservation({ entry, planned }) {
  const record = { step_id: entry.step };
  for (const [path, value] of Object.entries(planned.assertions)) assignPath(record, path, materialize(value));
  record.surface = entry.surface;
  const diagnostic = sourceDiagnostic(entry);
  if (diagnostic) record.diagnostic = diagnostic;
  if (entry.surface === "thrown-sdk") record.json = { ...diagnostic };
  return record;
}

for (const entry of SOURCE_TABLE) {
  test(`independent pinned source diagnostic and surface: ${entry.step}`, () => {
    const caseId = entry.step.split("/")[0];
    const frozen = EXPECTATIONS.cases.find((item) => item.case_id === caseId);
    const planned = frozen.expected.find((item) => item.step_id === entry.step);
    assert.equal(planned.assertions.surface, entry.surface);
    const diagnostic = planned.diagnostic === undefined ? undefined : { ...planned.diagnostic, path: materialize(planned.diagnostic.path) };
    assert.deepEqual(diagnostic, sourceDiagnostic(entry), "exact whole diagnostic must agree with source table");
    const record = sourceObservation({ entry, planned });
    const expectations = { cases: [{ ...frozen, expected: [planned] }], planned_occurrence_budget: { calls_by_case: { [caseId]: 0 } } };
    const [result] = evaluateCases({ expectations, observations: [{ records: [record], ledger: { calls: [] } }] });
    assert.equal(result.matched, true, JSON.stringify(result.notes));
  });
}
