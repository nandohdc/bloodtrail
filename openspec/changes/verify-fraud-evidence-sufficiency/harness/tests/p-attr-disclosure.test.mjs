import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { compareExistence } from "../p-attr/comparison.mjs";
import { existencePeer } from "../p-attr/carrier-workload.mjs";
import { evaluateCases } from "../p-attr/evaluate.mjs";
import { eventView, analyzeRecord } from "../p-attr/observations.mjs";
import { capture, put, observation } from "./p-attr-analysis-fixtures.mjs";

// The frozen planned steps the evaluator must fail: AF-C4/ex is frozen with
// discloses_existence: false, so a rewired peer that discloses must surface
// as a Q7 discloses_existence mismatch, never pass silently.
const EXPECTATIONS = JSON.parse(readFileSync(new URL("../expectations/p-attr.v1.json", import.meta.url), "utf8"));

// Q7: independent disclosure rows, written from source (field-policy.json and
// the #802 existence definition), using the REAL ex/nx step ids and the real
// production peer scheme for AF, PR and RA. Not generated from expectations.
// Each row: the ex capture shape, the nx capture shape, and the expected
// discloses flag. A wrong-peer negative proves the production compareExistence
// fails a peer that does not belong to the same case.
const ACCOUNT = "acct-0001";

function event({ family, subject, resource, principal = false, credential }) {
  const value = capture(family);
  if (subject) value.subject = { type: "account", id: subject };
  if (resource) value.resource = { type: "account", id: resource, operation_type: family === "RA" ? "create" : "execute" };
  if (principal) value.authenticated_principal = { type: "human_user", id: ACCOUNT };
  if (credential) value.credential = { type: "password", reference: credential };
  return value;
}

function leaf(value) {
  const out = {};
  const walk = (cursor, path) => {
    if (cursor === null || typeof cursor !== "object") { out[path] = "SC"; return; }
    for (const [key, child] of Object.entries(cursor)) walk(child, path ? `${path}.${key}` : key);
  };
  walk(value, "");
  return out;
}

// The production peer scheme, exercised exactly as the workload builds it:
// ex -> <case>/nx and nx -> <case>/ex (mode-qualified when the variant has one).
function peerIds({ case_id, mode = "main" }) {
  const ex = mode === "main" ? "ex" : `${mode}-ex`;
  const nx = mode === "main" ? "nx" : `${mode}-nx`;
  return { ex, nx };
}
function producedPeer({ case_id, variant }) {
  return existencePeer({ entry: { case_id }, variant });
}

const DISCLOSURE_ROWS = [
  { family: "AF", case_id: "AF-C5", ex: { subject: ACCOUNT }, nx: {}, contents: { "subject.id": { kind: "resolved_account", source: "safe_resolution" } }, discloses: true,
    basis: "contracts/security-audit/policies/field-policy.json:373-381" },
  { family: "AF", case_id: "AF-C1", ex: {}, nx: {}, contents: { "actor.id": { kind: "presented_identifier", source: "request" } }, discloses: false,
    basis: "contracts/security-audit/policies/field-policy.json:313-321" },
  { family: "PR", case_id: "PR-C5", mode: "subject", ex: { subject: ACCOUNT }, nx: {}, contents: { "subject.id": { kind: "resolved_account", source: "safe_resolution" } }, discloses: true,
    basis: "contracts/security-audit/catalog/catalog.json:483-485" },
  { family: "RA", case_id: "RA-C5", mode: "resource", ex: { resource: ACCOUNT }, nx: {}, contents: { "resource.id": { kind: "resolved_account", source: "safe_resolution" } }, discloses: true,
    basis: "contracts/security-audit/policies/field-policy.json:983-1001" },
  { family: "RA", case_id: "RA-C6", ex: { credential: "a".repeat(64) }, nx: { credential: "b".repeat(64) },
    contents: { "credential.reference": { kind: "presented_identifier", source: "request" } }, discloses: false,
    basis: "contracts/security-audit/policies/field-policy.json:493-521" },
];

for (const row of DISCLOSURE_ROWS) {
  test(`Q7 independent disclosure ${row.case_id}:${row.mode ?? "main"} (${row.basis})`, () => {
    const { ex, nx } = peerIds(row);
    const exEvent = event({ family: row.family, ...row.ex });
    const nxEvent = event({ family: row.family, ...row.nx });
    const exRecord = { step_id: `${row.case_id}/${ex}`, family: row.family, events: [exEvent],
      captured_origins: [leaf(exEvent)], contents: structuredClone(row.contents) };
    const nxRecord = { step_id: `${row.case_id}/${nx}`, family: row.family, events: [nxEvent],
      captured_origins: [leaf(nxEvent)], contents: structuredClone(row.contents) };
    assert.equal(compareExistence({ ex: eventView(exRecord), nx: eventView(nxRecord) }).discloses, row.discloses);
    assert.equal(producedPeer({ case_id: row.case_id, variant: { target: "ex", mode: row.mode ?? "main" } }), `${row.case_id}/${nx}`);
    assert.equal(producedPeer({ case_id: row.case_id, variant: { target: "nx", mode: row.mode ?? "main" } }), `${row.case_id}/${ex}`);
  });
}

test("Q7 wrong-peer negative: production compareExistence fails a peer from another case", () => {
  const exRecord = { step_id: "AF-C5/ex", family: "AF", events: [event({ family: "AF", subject: ACCOUNT })],
    captured_origins: [leaf(event({ family: "AF", subject: ACCOUNT }))],
    contents: { "subject.id": { kind: "resolved_account", source: "safe_resolution" } } };
  const wrongPeer = { step_id: "AF-C4/nx", family: "AF", events: [event({ family: "AF" })],
    captured_origins: [leaf(event({ family: "AF" }))],
    contents: { "subject.id": { kind: "presented_identifier", source: "request" } } };
  const produced = producedPeer({ case_id: "AF-C5", variant: { target: "ex", mode: "main" } });
  assert.equal(produced, "AF-C5/nx");
  assert.notEqual(wrongPeer.step_id, produced, "the wrong peer is not the production peer");
  const result = compareExistence({ ex: eventView(exRecord), nx: eventView(wrongPeer) });
  assert.notEqual(result.discloses, false, "cross-case peer comparison must not silently pass as non-disclosing");
});

test("Q7 wrong-peer negative through the evaluator: rewired AF-C4/ex discloses against AF-C5/nx and fails the frozen plan", () => {
  const contents4 = { "subject.id": { kind: "presented_identifier", source: "request" } };
  const contents5 = { "subject.id": { kind: "resolved_account", source: "safe_resolution" } };
  const ex4 = observation({ id: "AF-C4", event: event({ family: "AF", subject: "pid-ex-0001" }),
    contents: contents4, origins: { "subject.id": "CP" } });
  const nx4 = observation({ id: "AF-C4", event: event({ family: "AF", subject: "pid-nx-0001" }),
    contents: contents4, origins: { "subject.id": "CP" } });
  const ex5 = observation({ id: "AF-C5", event: event({ family: "AF", subject: ACCOUNT }),
    contents: contents5, origins: { "subject.id": "SR" } });
  const nx5 = observation({ id: "AF-C5", event: event({ family: "AF" }), contents: contents5 });
  ex4.step_id = "AF-C4/ex";
  nx4.step_id = "AF-C4/nx";
  ex5.step_id = "AF-C5/ex";
  nx5.step_id = "AF-C5/nx";
  ex4.existence_peer = "AF-C5/nx"; // rewired: the production peer is AF-C4/nx
  nx4.existence_peer = producedPeer({ case_id: "AF-C4", variant: { target: "nx", mode: "main" } });
  ex5.existence_peer = producedPeer({ case_id: "AF-C5", variant: { target: "ex", mode: "main" } });
  nx5.existence_peer = producedPeer({ case_id: "AF-C5", variant: { target: "nx", mode: "main" } });
  const records = [ex4, nx4, ex5, nx5];

  const productionPeer = producedPeer({ case_id: "AF-C4", variant: { target: "ex", mode: "main" } });
  assert.equal(productionPeer, "AF-C4/nx");
  assert.notEqual(ex4.existence_peer, productionPeer, "the rewired peer must not be the production peer");

  const analysis = analyzeRecord({ record: ex4, records });
  assert.equal(analysis.axes.discloses_existence, true, JSON.stringify(analysis));

  const cases = [structuredClone(EXPECTATIONS.cases.find((entry) => entry.case_id === "AF-C4")),
    structuredClone(EXPECTATIONS.cases.find((entry) => entry.case_id === "AF-C5"))];
  const results = evaluateCases({ records, expectations: { cases } });
  const evaluation = results.find((result) => result.case_id === "AF-C4");
  assert.equal(evaluation.matched, false);
  assert.equal(evaluation.mismatches.length, 1, JSON.stringify(evaluation.mismatches));
  assert.match(evaluation.mismatches[0], /discloses_existence/);
  assert.equal(results.find((result) => result.case_id === "AF-C5").matched, true,
    "the supporting AF-C5 pair must still match its frozen plan");
});

test("Q7 real step ids: generated SC metadata alone never discloses", () => {
  const ex = event({ family: "AF" });
  const nx = event({ family: "AF" });
  put(ex, "event.id", "evt-ex-0001");
  put(nx, "event.id", "evt-nx-0001");
  const result = compareExistence({
    ex: eventView({ step_id: "AF-B/ex", family: "AF", events: [ex], captured_origins: [leaf(ex)], contents: {} }),
    nx: eventView({ step_id: "AF-B/nx", family: "AF", events: [nx], captured_origins: [leaf(nx)], contents: {} }),
  });
  assert.equal(result.discloses, false);
});
