import assert from "node:assert/strict";
import test from "node:test";
import { PR_CASES, RA_CASES, REQUEST_BASE, REQUEST_DEFAULTS } from "../p-attr/request-cases.mjs";
import { atPath } from "../p-attr/comparison.mjs";
import { recordAt } from "./p-attr-af-fixtures.mjs";
import { REQUEST_COUNTS, REQUEST_FAMILIES, requestFixtures } from "./p-attr-request-fixtures.mjs";

const CASES = new Map([["PR", PR_CASES], ["RA", RA_CASES]]);
// Independent semantic:98-114,371-405; schema:8-17,94-104,123-129,146-153
// and schema JSON required:9-21 at cc4fdf5.
const DIAGNOSTICS = [
  ["C7a", "MISSING_TENANT_CONTEXT", "validation", "/tenant"],
  ["C7b", "TENANT_RESOURCE_CONFLICT", "validation", "/tenant/claimed_tenant_id"],
  ["C8", "AUTHORITY_ESCALATION", "authority", "/actor/provenance/trust_level"],
  ["C9", "AUTHORITY_ESCALATION", "authority", "/authenticated_principal"],
];
const CONTENTS = [
  ["C1/ex", "actor.id", "CP", "presented_identifier"],
  ["C2/ex", "actor.id", "CP", "presented_identifier"],
  ["C3/ex", "actor.display_name", "CP", "presented_identifier"],
  ["C4/ex", "subject.id", "CP", "presented_identifier"],
  ["C5/subject-ex", "subject.id", "SR", "resolved_account"],
  ["C5/resource-ex", "resource.id", "SR", "resolved_account"],
  ["CR/ex", "resource.id", "CP", "presented_identifier"],
  ["C6/ex", "credential.reference", "CP", "presented_identifier"],
  ["C6s/ex", "subject.id", "SR", "resolved_account"],
  ["X2/ex", "actor.id", "CP", "presented_identifier"],
  ["X2/ex", "authenticated_principal.id", "CP", "presented_identifier"],
];

for (const row of REQUEST_FAMILIES) {
  const { family } = row;
  const state = await requestFixtures({ family });
  const cases = CASES.get(family);
  const record = (suffix) => recordAt(state, `${family}-${suffix}`);

  test(`${family} complete source-comment roster, variants and hand-counted public calls`, () => {
    assert.equal(REQUEST_BASE, "cc4fdf5a3309db5077b85c4954c916b9ba902b8e");
    const roster = cases.map((entry) => [entry.case_id.slice(3), entry.variants.map((variant) => `${variant.variant_id}:${variant.predicted_calls}`).join(" ")]);
    assert.deepEqual(roster, REQUEST_COUNTS);
    assert.equal(state.records.length, 32);
    assert.equal(state.calls.length, 227);
    for (const entry of cases) checkDescriptor({ state, entry, row });
    assert.deepEqual(cases[0].aliases, [`${family}-C0`]);
    assert.equal(cases.at(-1).added_by, "review");
    assert.equal(cases.at(-1).comment_id, "6137593009");
    assert.deepEqual(state.invalidations, []);
    for (const suffix of ["C1", "C2"]) {
      const actor = cases.find((entry) => entry.case_id === `${family}-${suffix}`);
      assert(actor.basis.includes("contracts/security-audit/policies/field-policy.json:303-361"));
    }
    const tenant = cases.find((entry) => entry.case_id === `${family}-C7a`);
    assert(tenant.basis.includes("contracts/security-audit/schema/security-audit-event.schema.json:9-21"));
  });

  for (const [suffix, code, category, path] of DIAGNOSTICS) {
    test(`${family}-${suffix} source-derived exact returned diagnostic, ex and nx`, () => {
      for (const target of ["ex", "nx"]) {
        const observed = record(`${suffix}/${target}`);
        assert.equal(observed.kind, "returned");
        assert.deepEqual(observed.raw, { ok: false, error: { code, category, path } });
        assert.deepEqual(observed.diagnostic, { code, category, path });
        assert.equal(observed.sink_count, 0);
        assert.equal(observed.analysis.axes.resource_rule, "n/a");
      }
    });
  }

  test(`${family} baseline defaults and SDK-stamped operation for EVERY accepted path`, () => {
    const event = record("B/ex").events[0];
    assert.deepEqual(event.event, { name: `bloodtrail.audit.${row.name}`, outcome: "success", lifecycle_phase: "attempted", commit_state: "not_applicable", delivery_class: "security_significant" });
    assert.deepEqual(event.request, { id: `req-${family.toLowerCase()}-0001`, method: "POST", route: row.route });
    assert.deepEqual(event.source.observed, { address: row.address, port: row.port });
    assert.equal(event.subject, undefined);
    assert.equal(event.authenticated_principal, undefined);
    for (const observed of state.records.filter((item) => item.accepted)) {
      assert.equal(observed.events[0].resource.operation_type, row.operation, observed.step_id);
      assert.equal(observed.captured_origins[0]["resource.operation_type"], "SC");
      assert.equal(observed.origins["resource.operation_type"], undefined);
      assert.deepEqual(observed.frozen, [true]);
    }
  });

  test(`${family} carrier origins refer to contents, not constructors or HMAC computation`, () => {
    for (const [suffix, path, origin, kind] of CONTENTS) {
      const observed = record(suffix);
      assert.notEqual(atPath(observed.events[0], path), undefined);
      assert.equal(observed.captured_origins[0][path], origin);
      assert.equal(observed.contents[path].kind, kind);
    }
    assert.equal(record("C4/ex").events[0].subject.id, "pid-ex-0001");
    assert.equal(record("C5/resource-ex").events[0].resource.id, "acct-0001");
    assert.equal(record("C6/ex").events[0].credential.key_id, "k-run-01");
    assert.match(record("C3/ex").events[0].actor.display_name, /^[a-f0-9]{64}$/);
  });

  test(`${family} anonymous principal refusal does not conceal accepted typed actor AND fabricated principal`, () => {
    const event = record("X2/nx").events[0];
    assert.equal(event.actor.id, "pid-nx-0001");
    assert.equal(event.authenticated_principal.id, "pid-nx-0001");
    assert.equal(event.actor.provenance.trust_level, "authoritative_server");
    assert.equal(record("X2/nx").account, undefined);
    assert.equal(record("C9/ex").accepted, false);
    assert.deepEqual(record("C7/ex").events[0].tenant, { scope: "tenantless", claimed_tenant_id: "tnt-b02" });
  });
}

function checkDescriptor({ state, entry, row }) {
  assert.equal(entry.corrected_at, REQUEST_BASE);
  assert(entry.basis.some((path) => path.endsWith(`catalog.json:${row.family === "RA" ? "1-60" : "457-511"}`)));
  assert(entry.basis.every((path) => /:\d/.test(path)));
  assert.match(entry.setup, /fresh Node SDK/);
  assert.equal(entry.predicted_calls, entry.variants.reduce((sum, variant) => sum + variant.predicted_calls, 0));
  for (const variant of entry.variants) checkVariant({ state, entry, variant });
}

function checkVariant({ state, entry, variant }) {
  const observed = recordAt(state, `${entry.case_id}/${variant.variant_id}`);
  const expected = variant.source_outcome;
  assert.equal(observed.public_calls.length, variant.predicted_calls, observed.step_id);
  assert.equal(observed.accepted, expected.accepted);
  assert.deepEqual(observed.diagnostic, expected.diagnostic);
  assert.equal(observed.sink_count, expected.sink_count);
  assert.deepEqual(observed.analysis.issues, []);
  for (const [path, value] of Object.entries(expected.assertions ?? {})) assert.equal(atPath(observed, path), value);
}

test("PR and RA retain distinct catalog rules and explicit schema/RA skeptic corrections for later freezing", () => {
  assert.match(PR_CASES[0].setup, /resolved safely; subject only if safely resolved/);
  assert.match(RA_CASES[0].setup, /after server resolution; no fabricated principal/);
  for (const suffix of ["B", "C5", "CR"]) assert.match(RA_CASES.find((entry) => entry.case_id === `RA-${suffix}`).corrected_from.reason, /stamps create/);
  assert.match(RA_CASES.find((entry) => entry.case_id === "RA-C9").corrected_from.reason, /anonymous\+principal only/);
  assert(REQUEST_DEFAULTS.every((text) => /^(G-log implementer defaults|Implementer default):/.test(text)));
});
