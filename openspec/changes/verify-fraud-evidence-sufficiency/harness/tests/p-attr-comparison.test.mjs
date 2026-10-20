import assert from "node:assert/strict";
import test from "node:test";
import { compareExistence, existenceView, joinFacts } from "../p-attr/comparison.mjs";
import { eventView } from "../p-attr/observations.mjs";
import { capture, observation, withTarget, put } from "./p-attr-analysis-fixtures.mjs";

function baseline() {
  return eventView(observation({ id: "AF-B", event: capture("AF") }));
}
const METADATA = ["event.id", "event.timestamp", "event.observed_at", "correlation.correlation_id", "correlation.operation_id", "request.id", "correlation.request_id"];
const DISCLOSURES = [
  ["subject presence", (view) => { view.event.subject = { type: "account", id: "acct-0001" }; }],
  ["principal presence", (view) => { view.event.authenticated_principal = { type: "human_user", id: "acct-0001" }; }],
  ["actor type", (view) => { view.event.actor.type = "authenticated_human"; }],
  ["failure reason", (view) => { view.event.event.outcome_reason = { code: "credential_invalid" }; }],
];

test("existence comparison ignores exactly generated leaves, never whole containers", () => {
  const ex = baseline();
  const nx = baseline();
  for (const path of METADATA) put(nx.event, path, "generated-0002");
  assert.deepEqual(compareExistence({ ex, nx }), { discloses: false, differences: [] });
  nx.event.correlation.causation_id = "cause-0002";
  assert.deepEqual(compareExistence({ ex, nx }).differences, ["correlation.causation_id"]);
});

for (const [label, mutate] of DISCLOSURES) {
  test(`existence detects ${label}, not generated noise`, () => {
    const ex = baseline();
    mutate(ex);
    assert.equal(compareExistence({ ex, nx: baseline() }).discloses, true);
  });
}

for (const path of ["request.id", "correlation.request_id", "request.route", "correlation.correlation_id", "correlation.operation_id"]) {
  test(`carrier-bearing ${path} is retained; uniform CP is not existence disclosure`, () => {
    const ex = eventView(withTarget({ id: "AF-F1", path }));
    const nx = eventView(withTarget({ id: "AF-F1", path, value: "pid-nx-0001" }));
    assert(Object.hasOwn(existenceView(ex), path));
    assert.equal(compareExistence({ ex, nx }).discloses, false);
    nx.contents[path].kind = "resolved_account";
    assert.deepEqual(compareExistence({ ex, nx }).differences, [path]);
    // Metadata explicitly tagged as a carrier must remain even if SC.
    nx.origins[path] = "SC";
    assert(Object.hasOwn(existenceView(nx), path));
  });
}

test("lookup X4 and safe subject disclose existence, including value-class changes", () => {
  const ex = eventView(withTarget({ id: "AF-X4", path: "actor.id", origin: "SR", kind: "resolved_account", source: "lookup" }));
  ex.event.actor.type = "authenticated_human";
  assert.equal(compareExistence({ ex, nx: baseline() }).discloses, true);
  const unresolved = eventView(withTarget({ id: "PR-C4", path: "subject.id" }));
  const resolved = eventView(withTarget({ id: "PR-C5", path: "subject.id", origin: "SR", kind: "resolved_account", source: "safe_resolution" }));
  assert.deepEqual(compareExistence({ ex: resolved, nx: unresolved }).differences, ["subject.id"]);
});

test("joins require a declared pair, equal observed values and independent ground truth", () => {
  const from = { family: "AF", account: "acct-0001", event: { subject: { id: "pid-ex-0001" } } };
  const to = { family: "AS", account: "acct-0001", event: { subject: { id: "pid-ex-0001" } } };
  const pair = { from_family: "AF", to_family: "AS", from: "subject.id", to: "subject.id" };
  assert.deepEqual(joinFacts({ from, to, pairs: [] }), []);
  assert.equal(joinFacts({ from, to, pairs: [pair] }).length, 1);
  for (const account of [null, "acct-0002"]) assert.deepEqual(joinFacts({ from: { ...from, account }, to, pairs: [pair] }), []);
  delete from.event.subject.id;
  assert.deepEqual(joinFacts({ from, to, pairs: [pair] }), []);
});
