import assert from "node:assert/strict";
import test from "node:test";
import { callRecorder, readCapturingSink, recordingExchange } from "../lib/observe.mjs";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { sha256 } from "../lib/io.mjs";

const REFUSAL = { ok: false, error: { code: "FIXTURE_REFUSED", category: "validation", path: "/fixture" } };
const ACCEPTED = { ok: true, value: { status: "accepted" } };
const ERROR = Object.assign(new Error("fixture refusal"), { name: "SecurityAuditSdkError", ...REFUSAL.error });
const CALLS = [
  ["accepted", () => ACCEPTED],
  ["refused", () => REFUSAL],
  ["ordinary", () => { throw new TypeError("fixture type"); }],
  ["sdk", () => { throw ERROR; }],
  ["async", async () => REFUSAL],
];

test("call boundary preserves raw results, real diagnostics and unexpected acceptance", async () => {
  const ledger = occurrenceLedger({ budget: CALLS.length });
  const recorder = callRecorder({ ledger });
  for (const [label, invoke] of CALLS) await recorder.call({ label, invoke, refusalExpected: true });
  const [accepted, refused, ordinary, sdk, asynchronous] = recorder.outcomes;
  assert.equal(accepted.raw, ACCEPTED);
  assert.equal(accepted.unexpected_acceptance, true);
  assert.equal(refused.raw, REFUSAL);
  assert.deepEqual(refused.diagnostic, REFUSAL.error);
  assert.deepEqual(ordinary.diagnostic, {});
  assert.equal(ordinary.raw.name, "TypeError");
  assert.deepEqual(sdk.diagnostic, REFUSAL.error);
  assert.equal(asynchronous.raw, REFUSAL);
  assert.equal(ledger.report().occurrence_count, CALLS.length);
});

test("sink boundary reads captured events without serialization or private inspection", () => {
  const event = Object.freeze({ event: { id: "fixture-id" } });
  const observation = readCapturingSink({ sink: { events: [event] } });
  assert.equal(observation.events[0], event);
  assert.equal(observation.boundary, "capturing_sink");
});

test("exchange records each attempt's actual UTF-8 or byte body and thrown outcomes", async () => {
  const recorder = recordingExchange({ exchange: async (request) => {
    if (request.fail) throw new Error("fixture exchange failure");
    return { kind: "response", status: 200 };
  } });
  const requests = [{ body: "opaque-Ω" }, { body: Buffer.from([0, 255]), fail: true }];
  await recorder.exchange(requests[0]);
  await assert.rejects(recorder.exchange(requests[1]), /fixture exchange failure/);
  requests.forEach((request, index) => {
    const attempt = recorder.attempts[index];
    assert.equal(attempt.attempt, index + 1);
    assert.equal(attempt.body_sha256, sha256(Buffer.from(request.body)));
    assert.equal(attempt.body_bytes, Buffer.from(request.body).length);
  });
  assert.equal(recorder.attempts[1].outcome.kind, "thrown");
});
