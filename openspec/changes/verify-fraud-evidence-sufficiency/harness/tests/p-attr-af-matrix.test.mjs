import assert from "node:assert/strict";
import test from "node:test";
import { AF_BASE, AF_CASES, AF_DRAFTING_QUESTION, AF_PRECONDITION } from "../p-attr/af-cases.mjs";
import { atPath } from "../p-attr/comparison.mjs";
import { AF_COUNTS, afFixtures, recordAt } from "./p-attr-af-fixtures.mjs";

const state = await afFixtures();
const output = (id) => recordAt(state, id).events[0];
const value = (id, path) => atPath(output(id), path);

test("AF comment groups, aliases, controls and exact per-variant predictions retain stable traceability", () => {
  assert.equal(AF_BASE, "cc4fdf5a3309db5077b85c4954c916b9ba902b8e");
  assert.deepEqual(AF_CASES.map((entry) => [entry.case_id, entry.variants.map((variant) => `${variant.variant_id}:${variant.predicted_calls}`).join(" ")]), AF_COUNTS);
  assert.deepEqual(AF_CASES[0].aliases, ["AF-C0"]);
  assert.equal(AF_CASES.find((entry) => entry.case_id === "AF-C3s").source_group, "AF-C3");
  assert.match(AF_PRECONDITION, /one installed core copy/);
  for (const entry of AF_CASES) {
    assert(entry.basis.length >= 2);
    assert.equal(entry.corrected_at, AF_BASE);
    for (const variant of entry.variants) {
      const record = recordAt(state, `${entry.case_id}/${variant.variant_id}`);
      assert.equal(record.public_calls.length, variant.predicted_calls, record.step_id);
      assert.equal(record.accepted, variant.source_outcome.accepted, record.step_id);
      assert.equal(record.kind, "returned");
      assert.deepEqual(record.diagnostic, variant.source_outcome.diagnostic);
      assert.equal(record.sink_count, variant.source_outcome.sink_count);
      assert.deepEqual(record.analysis.issues, [], record.step_id);
    }
  }
  assert.deepEqual(state.invalidations, []);
});

test("AF baselines, type-only alternatives and fixed request/correlation echo contain no target", () => {
  for (const id of ["AF-B/ex", "AF-C0t/ex", "AF-C0r/ex"]) {
    assert.equal(value(id, "resource.operation_type"), "execute");
    assert.equal(recordAt(state, id).analysis.axes.resource_rule, "conforms");
    assert.equal(recordAt(state, id).analysis.axes.per_target_grouping, false);
  }
  assert.equal(value("AF-C0t/ex", "credential.type"), "password");
  assert.deepEqual(output("AF-C0r/ex").resource, { type: "credential", operation_type: "execute" });
  assert.equal(value("AF-B/ex", "request.id"), value("AF-B/nx", "correlation.request_id"));
});

test("actor, display, subject, resource and credential variants preserve true content origins", () => {
  const cases = [
    ["AF-C1/ex", "actor.id", "pid-ex-0001", "CP"],
    ["AF-C4/nx", "subject.id", "pid-nx-0001", "CP"],
    ["AF-C5/ex", "subject.id", "acct-0001", "SR"],
    ["AF-X4/ex", "authenticated_principal.id", "acct-0001", "SR"],
  ];
  for (const [id, path, expected, origin] of cases) {
    assert.equal(value(id, path), expected);
    assert.equal(recordAt(state, id).captured_origins[0][path], origin);
  }
  for (const [id, path] of [["AF-C3/ex", "actor.display_name"], ["AF-C3s/nx", "subject.display_name"], ["AF-CR/ex", "resource.id"], ["AF-C6/nx", "credential.reference"]]) {
    assert.match(value(id, path), /^[0-9a-f]{64}$/);
    assert.equal(recordAt(state, id).captured_origins[0][path], "CP");
  }
  assert.equal(value("AF-C5/nx", "subject"), undefined);
  assert.equal(value("AF-C6s/nx", "subject"), undefined);
  assert.equal(value("AF-C6s/nx", "credential.key_id"), "k-run-01");
  assert.equal(value("AF-CR/credential-type-ex", "resource.type"), "credential");
});

test("tenant controls and accepted extras retain raw diagnostic surfaces and finding scope", () => {
  assert.deepEqual(output("AF-C7/ex").tenant, { scope: "tenantless", claimed_tenant_id: "tnt-b02" });
  assert.equal(recordAt(state, "AF-C7b/equal-claim-ex").accepted, true);
  assert.equal(value("AF-X1/ex", "actor.provenance.trust_level"), "authoritative_server");
  assert.equal(value("AF-X2/nx", "actor.type"), "authenticated_human");
  assert.equal(value("AF-X3/ex", "authentication.failure_reason"), "credential_invalid");
  assert.equal(value("AF-X3/nx", "event.outcome_reason.code"), "not_found_or_not_disclosed");
  assert.equal(value("AF-X4/nx", "authenticated_principal"), undefined);
  assert.equal(value("AF-X4/nx", "actor.type"), "anonymous");
  for (const id of ["AF-C7a/ex", "AF-C7b/ex", "AF-C8/ex", "AF-C9/ex"]) {
    const record = recordAt(state, id);
    assert.deepEqual(record.raw, { ok: false, error: record.diagnostic });
    assert.equal(record.sink_count, 0);
  }
});

test("free-form carriers retain request echo, length control, authorization id and drafting question", () => {
  assert.equal(value("AF-F1/id-ex", "request.id"), value("AF-F1/id-ex", "correlation.request_id"));
  assert.equal(recordAt(state, "AF-F1/id-ex").captured_origins[0]["correlation.request_id"], "CP");
  assert.equal(value("AF-F1/route-ex", "request.route").length, 71);
  assert.equal(value("AF-F2/ex", "authentication.method").length, 64);
  assert.deepEqual(recordAt(state, "AF-F2/length-control-ex").diagnostic, { code: "FIELD_LIMIT_EXCEEDED", category: "validation", path: "/authentication/method" });
  assert.match(value("AF-F3/ex", "authorization.resource_context.id"), /^[0-9a-f]{64}$/);
  assert.equal(value("AF-F3/ex", "authorization.decision"), "not_applicable");
  assert(value("AF-F4/ex", "event.outcome_reason.message").length <= 512);
  assert.match(AF_DRAFTING_QUESTION, /Not in story 2.*Decide whether to add/);
  assert.match(AF_CASES.at(-1).classification, /Added by implementer default/);
});
