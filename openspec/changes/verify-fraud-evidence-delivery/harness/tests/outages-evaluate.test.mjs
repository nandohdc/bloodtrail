// The outages evaluator on fixture observations: an honest run built from the frozen profiles must match
// every case, and each planted deviation must be reported as a mismatch, never absorbed. No kit code runs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { retryDelay, seededJitter } from "../lib/clock.mjs";
import { jsonFile, sha256 } from "../lib/io.mjs";
import { evaluateCases, frozenProfiles, passOf, scheduleOf } from "../outages/evaluate.mjs";
import { validateExpectations } from "../outages/expectations.mjs";
import { outagesSession, smallPassGate } from "../outages/session.mjs";

const FROZEN = validateExpectations(jsonFile(new URL("../expectations/outages.v1.json", import.meta.url)));
const PROFILES = frozenProfiles(FROZEN);
const CONTROLS = { loopback_guard: { holds: true }, write_outside_grant: { holds: true }, synthetic_data: { holds: true } };

function call(profile) {
  return profile.sdk === "accepted" ? { label: "authenticationSucceeded", ok: true, value: { status: "accepted" } } : { label: "authenticationSucceeded", ok: false, error: { code: profile.sdk } };
}

// What the sender and the ingress would report for one pass if every occurrence behaved as frozen.
function honestPass(name) {
  const pass = passOf(FROZEN, name);
  const composition = FROZEN.composition;
  const draw = seededJitter(composition.jitter_seed);
  const sender = { calls: [], deliveries: {}, exchanges: [], callbacks: { scheduled: [], exhausted: [], admitted: [], rejected_overload: [], released: [] }, controls: CONTROLS, guard_violations: [{ host: "192.0.2.1" }] };
  const ingress = { controls: { write_outside_grant: { holds: true } }, records: [], read_back: [] };
  scheduleOf(pass).forEach((scenario, index) => {
    const profile = PROFILES.get(scenario);
    const eventId = `${name}-${index}`;
    const body = sha256(eventId);
    sender.calls.push(call(profile));
    sender.deliveries[eventId] = { status: profile.delivery, attempts: profile.attempts };
    for (const attempt of profile.exchange_attempts) {
      if (attempt > 0) sender.callbacks.scheduled.push([attempt, retryDelay({ composition, next: attempt, draw })]);
      sender.exchanges.push({ event_id: eventId, attempt, body_sha256: body });
    }
    if (profile.delivery === "exhausted") sender.callbacks.exhausted.push([composition.max_attempts]);
    for (const request of profile.requests) ingress.records.push({ event_id: eventId, occurrence: index + 1, ...request, outcome: { kind: request.outcome }, body_sha256: body });
    ingress.read_back.push(profile.stored === 1 ? { event_id: eventId, persisted: true, stored_body_sha256: body } : { event_id: eventId, persisted: false, storage_result: "not_found" });
  });
  sender.shutdown_report = { accepted: pass.occurrences, completed: pass.occurrences, abandoned: 0 };
  return { sender, ingress, occurrence_count: pass.occurrences };
}

const honest = () => ({ passes: { small: honestPass("small"), volume: honestPass("volume") }, gate: { small_matched: true, small_mismatched: [], volume_pass: "completed" } });
const mismatched = (result) => result.evaluations.filter((entry) => !entry.matched).map((entry) => entry.case_id);

test("an honest run built from the frozen profiles matches every case", () => {
  const result = evaluateCases({ observations: honest(), expectations: FROZEN });
  assert.deepEqual(mismatched(result), []);
  assert.deepEqual(result.verdict, { matched: 14, mismatched: 0 });
  assert.deepEqual(smallPassGate({ passes: honest().passes, expectations: FROZEN }), { small_matched: true, small_mismatched: [] });
});

test("the small-pass gate names the mismatched cases, and an evaluator fault closes it without throwing", () => {
  const run = honest();
  run.passes.small.sender.shutdown_report = { accepted: 10, completed: 9, abandoned: 1 };
  assert.deepEqual(smallPassGate({ passes: run.passes, expectations: FROZEN }), { small_matched: false, small_mismatched: ["O-06"] });
  delete run.passes.small.sender.controls;
  const faulted = smallPassGate({ passes: run.passes, expectations: FROZEN });
  assert.equal(faulted.small_matched, false);
  assert.equal(faulted.small_mismatched, null);
  assert.match(faulted.evaluation_fault, /loopback_guard/);
});

test("a skipped volume pass leaves the small cases matched and every volume case unobserved", () => {
  const observations = { passes: { small: honestPass("small"), volume: null }, gate: { small_matched: true, small_mismatched: [], volume_pass: "failed" } };
  const result = evaluateCases({ observations, expectations: FROZEN });
  assert.deepEqual(mismatched(result), ["O-09", "O-10", "O-11", "O-12", "O-13", "O-14"]);
  for (const entry of result.evaluations.filter((row) => row.pass === "volume")) assert.equal(entry.observed, null);
  assert.equal(evaluateCases({ observations: null, expectations: FROZEN }).verdict.mismatched, 14);
});

test("planted defects are reported, never absorbed", () => {
  const plants = [
    // A retry the plan did not ask for: one more attempt for the clean occurrence.
    [(run) => { run.passes.small.sender.exchanges.splice(1, 0, { ...run.passes.small.sender.exchanges[0], attempt: 1 }); }, ["O-01", "O-02", "O-03", "O-05"]],
    // A delay outside the seeded draw, still within its cap.
    [(run) => { run.passes.small.sender.callbacks.scheduled[0][1] += 1; }, ["O-02", "O-05"]],
    // A delay past its backoff cap.
    [(run) => { run.passes.volume.sender.callbacks.scheduled[2][1] = 41; }, ["O-11"]],
    // An exhaustion without its alert.
    [(run) => { run.passes.small.sender.callbacks.exhausted.pop(); }, ["O-02", "O-05"]],
    // An occurrence dropped before the composition: missing from the denominator's account.
    [(run) => { const [first] = Object.keys(run.passes.small.sender.deliveries); delete run.passes.small.sender.deliveries[first]; }, ["O-01", "O-02", "O-03", "O-04", "O-07"]],
    // The collector admitting a redelivery as a second write: the lost acknowledgment's retry persisted, not a duplicate.
    [(run) => { run.passes.small.ingress.records.find((entry) => entry.event_id === "small-6" && entry.attempt === 1).outcome = { kind: "persisted" }; }, ["O-01"]],
    // An occurrence the collector stored, with no stored copy to read back.
    [(run) => { run.passes.small.ingress.read_back[0] = { event_id: "small-0", persisted: false, storage_result: "not_found" }; }, ["O-01", "O-03", "O-04", "O-07"]],
    // A redelivery whose bytes changed between attempts.
    [(run) => { run.passes.small.ingress.records[1].body_sha256 = sha256("changed"); }, ["O-07"]],
    // One volume occurrence (a clean one) that behaves unlike its scenario.
    [(run) => { run.passes.volume.sender.deliveries["volume-10"].status = "exhausted"; }, ["O-09", "O-10", "O-11"]],
    // A shutdown that abandoned an admitted occurrence.
    [(run) => { run.passes.volume.sender.shutdown_report = { accepted: 500, completed: 499, abandoned: 1 }; }, ["O-12"]],
    // A guard control that did not hold.
    [(run) => { run.passes.small.sender.controls = { ...CONTROLS, loopback_guard: { holds: false } }; }, ["O-08"]],
  ];
  for (const [plant, expected] of plants) {
    const run = honest();
    plant(run);
    assert.deepEqual(mismatched(evaluateCases({ observations: run, expectations: FROZEN })), expected, plant.toString());
  }
});

test("the malformed acknowledgment is kept as a disagreement, and the planted-defect control fires on live data", () => {
  const evaluations = evaluateCases({ observations: honest(), expectations: FROZEN }).evaluations;
  const accounting = evaluations.find((entry) => entry.case_id === "O-03").observed;
  assert.deepEqual(accounting.disagreements, { "malformed_acknowledgment:protocol_error": 1 });
  assert.deepEqual(evaluations.find((entry) => entry.case_id === "O-04").observed, { planted_breaks_identity: true, planted_unexplained: 1, null_control_holds: true });
});

// The session's pass sequencing (Q19), with a fixture in place of each pass's role processes.
function fixtureExchange({ small = honestPass("small"), volume = () => honestPass("volume") } = {}) {
  const passes = [];
  const exchange = async ({ pass }) => {
    passes.push(pass.name);
    return pass.name === "small" ? small : volume();
  };
  return { exchange, passes };
}

const session = (exchange) => outagesSession({ service: "unused", storage: "unused", flags: {}, expectations: FROZEN, exchange });

test("the volume pass runs only after every small-pass case matched, and the call counts add up", async () => {
  const matched = fixtureExchange();
  const observations = await session(matched.exchange);
  assert.deepEqual(matched.passes, ["small", "volume"]);
  assert.deepEqual(observations.gate, { small_matched: true, small_mismatched: [], volume_pass: "completed" });
  assert.equal(observations.occurrence_count, 510);
  const small = honestPass("small");
  small.sender.shutdown_report = { accepted: 10, completed: 9, abandoned: 1 };
  const mismatched = fixtureExchange({ small });
  const skipped = await session(mismatched.exchange);
  assert.deepEqual(mismatched.passes, ["small"]);
  assert.deepEqual(skipped.gate, { small_matched: false, small_mismatched: ["O-06"], volume_pass: "skipped" });
  assert.equal(skipped.passes.volume, null);
  assert.equal(skipped.occurrence_count, 10);
});

test("a failed volume pass keeps the small pass's observations on the error, with the call count unknown", async () => {
  const failing = fixtureExchange({ volume: () => { throw new Error("volume sender crashed"); } });
  const error = await session(failing.exchange).then(() => null, (rejection) => rejection);
  assert.equal(error.message, "volume sender crashed");
  assert.deepEqual(error.observations.gate, { small_matched: true, small_mismatched: [], volume_pass: "failed" });
  assert.equal(error.observations.passes.small.occurrence_count, 10);
  assert.equal(error.observations.passes.volume, null);
  assert.equal(error.observations.occurrence_count, null);
  const earlyError = await session(async () => { throw new Error("small ingress crashed"); }).then(() => null, (rejection) => rejection);
  assert.equal(earlyError.message, "small ingress crashed");
  assert.equal(Object.hasOwn(earlyError, "observations"), false);
});

test("a session halted by its deadline starts no further pass", async () => {
  const started = [];
  const exchange = ({ context, pass }) => {
    started.push(pass.name);
    // The small pass outlives the deadline: the halt arrives while it is still settling.
    return new Promise((resolvePass) => { setTimeout(() => resolvePass(honestPass("small")), 50); });
  };
  const expectations = { ...FROZEN, deadline_ms: 10 };
  const error = await outagesSession({ service: "unused", storage: "unused", flags: {}, expectations, exchange }).then(() => null, (rejection) => rejection);
  assert.equal(error.condition, "deadline");
  await new Promise((resolveWait) => { setTimeout(resolveWait, 100); });
  assert.deepEqual(started, ["small"], "no volume pass after the halt");
});
