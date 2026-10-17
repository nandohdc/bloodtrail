import assert from "node:assert/strict";
import test from "node:test";
import { AS_BASE, AS_CASES, AS_DEFAULTS } from "../p-attr/as-cases.mjs";
import { atPath } from "../p-attr/comparison.mjs";
import { AS_COUNTS, asFixtures } from "./p-attr-as-fixtures.mjs";
import { recordAt } from "./p-attr-af-fixtures.mjs";

const state = await asFixtures();
const eventAt = (id) => recordAt(state, id).events[0];
const valueAt = (id, path) => atPath(eventAt(id), path);
const REFUSALS = [
  ["AS-C0/ex", "AUTHORITY_ESCALATION", "authority", "/authenticated_principal"],
  ["AS-C0/without-principal", "SDK_MISSING_EVENT_FIELD", "validation", "/authenticated_principal"],
  ["AS-C1/ex", "AUTHORITY_ESCALATION", "authority", "/authenticated_principal"],
  ["AS-C2/ex", "AUTHORITY_ESCALATION", "authority", "/authenticated_principal"],
  ["AS-C3/anonymous", "AUTHORITY_ESCALATION", "authority", "/authenticated_principal"],
  ["AS-C7a/ex", "MISSING_TENANT_CONTEXT", "validation", "/tenant"],
  ["AS-C7b/ex", "TENANT_RESOURCE_CONFLICT", "validation", "/tenant/claimed_tenant_id"],
  ["AS-C8/ex", "AUTHORITY_ESCALATION", "authority", "/actor/provenance/trust_level"],
  ["AS-C9/ex", "AUTHORITY_ESCALATION", "authority", "/authenticated_principal"],
];

test("all AS descriptors preserve comment order, source citations, variant identities and exact public counts", () => {
  assert.equal(AS_BASE, "cc4fdf5a3309db5077b85c4954c916b9ba902b8e");
  assert.deepEqual(AS_CASES.map((entry) => [entry.case_id, entry.variants.map((variant) => `${variant.variant_id}:${variant.predicted_calls}`).join(" ")]), AS_COUNTS);
  assert.equal(state.records.length, 21);
  assert.equal(state.calls.length, 233);
  for (const entry of AS_CASES) {
    assert.equal(entry.corrected_at, AS_BASE);
    assert(entry.basis.every((path) => /:\d/.test(path)));
    assert.match(entry.setup, /Node SDK/);
    for (const variant of entry.variants.filter((item) => !item.linkage_only)) {
      const record = recordAt(state, `${entry.case_id}/${variant.variant_id}`);
      assert.equal(record.public_calls.length, variant.predicted_calls, record.step_id);
      assert.equal(record.accepted, variant.source_outcome.accepted, record.step_id);
      assert.deepEqual(record.diagnostic, variant.source_outcome.diagnostic);
      assert.equal(record.sink_count, variant.source_outcome.sink_count);
      assert.equal(record.kind, "returned");
      assert.deepEqual(record.analysis.issues, [], record.step_id);
    }
  }
  assert.deepEqual(state.invalidations, []);
});

for (const [id, code, category, path] of REFUSALS) {
  test(`independent pinned-source diagnostic and returned surface: ${id}`, () => {
    const record = recordAt(state, id);
    assert.equal(record.kind, "returned");
    assert.equal(record.accepted, false);
    assert.deepEqual(record.raw, { ok: false, error: { code, category, path } });
    assert.deepEqual(record.diagnostic, { code, category, path });
    assert.equal(record.sink_count, 0);
    assert.deepEqual(record.analysis.axes.ambiguous_fields, []);
    assert.equal(record.analysis.axes.resource_rule, "n/a");
  });
}

test("AS-B is an honest successful-authentication target with direct account chain and keyed session", () => {
  const event = eventAt("AS-B/ex");
  assert.deepEqual(event.event, { name: "bloodtrail.audit.authentication.succeeded", outcome: "success", lifecycle_phase: "completed", commit_state: "not_applicable", delivery_class: "security_significant" });
  assert.equal(event.actor.id, "acct-0001");
  assert.equal(event.actor.id, event.authenticated_principal.id);
  assert.equal(event.credential.reference, "cref-0001");
  assert.match(event.session.id, /^sfp-[0-9a-f]{64}$/);
  assert.equal(event.source.observed.address, "198.51.100.20");
  assert.equal(event.resource.operation_type, "execute");
  assert.equal(event.subject, undefined);
});

test("typed display uses public camelCase input and preserves CP display content under authoritative SR actor", () => {
  const record = recordAt(state, "AS-C3/ex");
  const construction = record.public_calls.filter((call) => call.label.endsWith(":authenticatedHumanActor")).at(-1);
  assert.match(construction.raw.display_name, /^[a-f0-9]{64}$/);
  assert.equal(valueAt("AS-C3/ex", "actor.id"), "acct-0001");
  assert.equal(record.captured_origins[0]["actor.id"], "SR");
  assert.equal(record.captured_origins[0]["actor.display_name"], "CP");
});

test("subject/resource/credential content retains independent origin tags and separate C6s subject semantics", () => {
  const rows = [
    ["AS-C4/ex", "subject.id", "CP", "presented_identifier"],
    ["AS-C5/ex", "subject.id", "SR", "resolved_account"],
    ["AS-CR/ex", "resource.id", "CP", "presented_identifier"],
    ["AS-C6/ex", "credential.reference", "CP", "presented_identifier"],
    ["AS-C6s/ex", "subject.id", "SR", "resolved_account"],
    ["AS-C6s/ex", "credential.reference", "CP", "presented_identifier"],
  ];
  for (const [id, path, origin, kind] of rows) {
    const record = recordAt(state, id);
    assert.equal(record.captured_origins[0][path], origin);
    assert.equal(record.contents[path].kind, kind);
  }
  assert.equal(valueAt("AS-C4/ex", "subject.id"), "pid-ex-0001");
  assert.equal(valueAt("AS-C5/ex", "subject.id"), "acct-0001");
  assert.equal(valueAt("AS-C6s/ex", "credential.key_id"), "k-run-01");
  assert.equal(valueAt("AS-CR/ex", "resource.operation_type"), "execute");
});

test("AS-X2 accepts three CP actor identifiers independently of the three true SR principals", () => {
  for (const suffix of ["0001", "0002", "0003"]) {
    const record = recordAt(state, `AS-X2/ex-${suffix}`);
    assert.equal(record.accepted, true);
    assert.equal(record.events[0].actor.id, `pid-ex-${suffix}`);
    assert.equal(record.events[0].authenticated_principal.id, `acct-${suffix}`);
    assert.equal(record.account, `acct-${suffix}`);
    assert.equal(record.events[0].actor.provenance.trust_level, "authoritative_server");
    assert.equal(record.captured_origins[0]["actor.id"], "CP");
    assert.equal(record.captured_origins[0]["authenticated_principal.id"], "SR");
  }
});

test("AS tenant claim remains a claim and build corrections/defaults stay explicit for freezing later", () => {
  assert.deepEqual(eventAt("AS-C7/ex").tenant, { scope: "tenantless", claimed_tenant_id: "tnt-b02" });
  assert.match(AS_CASES.find((entry) => entry.case_id === "AS-C3").corrected_from.reason, /circumvents/);
  assert.match(AS_CASES.find((entry) => entry.case_id === "AS-C5").corrected_from.reason, /violates/);
  assert.equal(AS_CASES.at(-1).added_by, "review");
  assert(AS_DEFAULTS.some((text) => text.includes("G-log implementer defaults")));
  assert.equal(recordAt(state, "AS-C0/without-principal").public_calls.filter((call) => call.label.endsWith(":authenticatedPrincipal")).length, 1);
});
