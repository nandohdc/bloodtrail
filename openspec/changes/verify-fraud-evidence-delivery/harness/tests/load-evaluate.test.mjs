// The load evaluator on fixture observations: an honest run built from the frozen phases must match every
// case, and each planted deviation must be reported as a mismatch, never absorbed. No kit code runs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonFile, sha256 } from "../lib/io.mjs";
import { evaluateCases } from "../load/evaluate.mjs";
import { validateExpectations } from "../load/expectations.mjs";
import { loadSession } from "../load/session.mjs";

const FROZEN = validateExpectations(jsonFile(new URL("../expectations/load.v1.json", import.meta.url)));
const CONTROLS = { loopback_guard: { holds: true }, write_outside_grant: { holds: true }, synthetic_data: { holds: true }, accounting_checks: { holds: true } };
const closed = () => ({ sender: { code: 0, signal: null }, ingress: { code: 0, signal: null } });
const call = (ok, code) => (ok ? { label: "fixture", ok: true, value: { status: "accepted" } } : { label: "fixture", ok: false, error: { code } });

function base(name) {
  return {
    sender: { calls: [], deliveries: {}, delivery_log: [], exchanges: [], callbacks: {}, controls: structuredClone(CONTROLS), guard_violations: [{ host: "192.0.2.1" }] },
    ingress: { controls: { write_outside_grant: { holds: true } }, records: [], read_back: [], quiescent: true },
    id: (index) => `${name}-${index}`,
  };
}

function stores({ ingress, eventId, attempt, action, status }) {
  ingress.records.push({ event_id: eventId, occurrence: ingress.records.length + 1, attempt, action, status, outcome: { kind: "persisted" }, body_sha256: sha256(eventId) });
  ingress.read_back.push({ event_id: eventId, persisted: true, stored_body_sha256: sha256(eventId) });
}

function burstTrace(sender, capacity, retrying) {
  const trace = [];
  const push = (eventId, kind, fields = {}) => trace.push({ sequence: trace.length + 1, event_id: eventId, kind, ...fields });
  let admitted = 0;
  for (const [eventId, delivery] of Object.entries(sender.deliveries)) {
    if (delivery.status === "rejected_overload") push(eventId, "rejected_overload", { values: [delivery.depth, delivery.capacity] });
    else if (delivery.status !== "rejected_shutting_down") {
      push(eventId, "admitted", { values: [++admitted, capacity] });
      push(eventId, "operation_started");
      for (const attempt of sender.exchanges.filter((entry) => entry.event_id === eventId && (!retrying || entry.attempt === 0))) push(eventId, "exchange", { attempt: attempt.attempt });
      if (retrying) push(eventId, "scheduled", { values: sender.callbacks.scheduled[admitted - 1] });
    }
    push(eventId, "result", { status: delivery.status, after_shutdown: false });
  }
  push(null, "shutdown_report", { report: sender.shutdown_report });
  if (retrying) {
    const ids = Object.keys(sender.deliveries).filter((id) => sender.deliveries[id].status === "abandoned");
    ids.forEach((eventId, index) => {
      push(eventId, "exchange", { attempt: 1 });
      push(eventId, "scheduled", { values: sender.callbacks.scheduled[ids.length + index] });
      push(eventId, "exchange", { attempt: 2 });
      push(eventId, "exhausted", { values: [3] });
    });
  }
  for (const entry of sender.delivery_log.filter((delivery) => delivery.after_shutdown)) push(entry.event_id, "result", { status: entry.status, after_shutdown: true });
  return trace;
}

// A burst as frozen: the first `capacity` admitted and held, the rest rejected at the gate, later
// submissions rejected while shutting down; an abandoning shutdown labels every held delivery abandoned and
// logs its late acknowledgment.
function honestBurst(phase) {
  const { sender, ingress, id } = base(phase.name);
  const { capacity, shutdown_deadline_ms: deadline } = phase.composition;
  const admitted = Math.min(phase.occurrences, capacity);
  const retrying = phase.shutdown === "after_retry_scheduled";
  const abandoning = retrying || deadline < FROZEN.scenarios[phase.schedule[0]][0].delay_ms;
  sender.callbacks = { scheduled: [], exhausted: [], admitted: [], rejected_overload: [], released: [] };
  for (let index = 0; index < phase.occurrences; index += 1) {
    const eventId = id(index);
    if (index >= admitted) {
      sender.deliveries[eventId] = { status: "rejected_overload", attempts: 0, depth: capacity, capacity };
      sender.callbacks.rejected_overload.push([capacity, capacity]);
      sender.calls.push(call(false, "SDK_SINK_FAILURE"));
      continue;
    }
    sender.callbacks.admitted.push([index + 1, capacity]);
    sender.exchanges.push({ event_id: eventId, attempt: 0, body_sha256: sha256(eventId) });
    if (retrying) {
      for (let attempt = 0; attempt < 3; attempt += 1) {
        if (attempt > 0) sender.exchanges.push({ event_id: eventId, attempt, body_sha256: sha256(eventId) });
        ingress.records.push({ event_id: eventId, attempt, action: "status", status: 503, outcome: { kind: "not_ingested" }, body_sha256: sha256(eventId) });
      }
      ingress.read_back.push({ event_id: eventId, persisted: false, storage_result: "not_found" });
    } else stores({ ingress, eventId, attempt: 0, action: "delay", status: 202 });
    sender.deliveries[eventId] = abandoning ? { status: "abandoned", attempts: 0 } : { status: "acknowledged", attempts: 1 };
    if (abandoning) sender.delivery_log.push({ event_id: eventId, status: retrying ? "exhausted" : "acknowledged", attempts: retrying ? 3 : 1, after_shutdown: true });
    sender.calls.push(call(!retrying, "SDK_SINK_FAILURE"));
  }
  for (let index = 0; index < phase.after_shutdown; index += 1) {
    sender.deliveries[id(phase.occurrences + index)] = { status: "rejected_shutting_down", attempts: 0 };
    sender.calls.push(call(false, "SDK_SINK_FAILURE"));
  }
  if (retrying) {
    // Independently frozen worked example for seed 838: four first retries, then four second retries.
    sender.callbacks.scheduled = [[1, 14], [1, 2], [1, 16], [1, 16], [2, 35], [2, 3], [2, 12], [2, 6]];
    sender.callbacks.exhausted = [[3], [3], [3], [3]];
  }
  sender.shutdown_report = { accepted: phase.occurrences, completed: abandoning ? phase.occurrences - admitted : phase.occurrences, abandoned: abandoning ? admitted : 0 };
  sender.shutdown_elapsed_ms = abandoning ? deadline : 300;
  sender.trace = burstTrace(sender, capacity, retrying);
  return { sender, ingress, role_closure: closed(), occurrence_count: phase.occurrences + phase.after_shutdown };
}

function honestSequence(phase) {
  const { sender, ingress, id } = base(phase.name);
  sender.trace = [];
  const trace = (eventId, kind, fields = {}) => sender.trace.push({ sequence: sender.trace.length + 1, event_id: eventId, kind, ...fields });
  const ceiling = phase.composition.loss_ceiling;
  let lossCount = 0;
  sender.callbacks = { dropped: [], loss_ceiling_reached: [] };
  for (let index = 0; index < phase.occurrences; index += 1) {
    const eventId = id(index);
    const dropped = phase.schedule[index % phase.schedule.length] === "dropped";
    sender.exchanges.push({ event_id: eventId, attempt: 0, body_sha256: sha256(eventId) });
    trace(eventId, "exchange", { attempt: 0 });
    if (dropped) {
      ingress.records.push({ event_id: eventId, occurrence: index + 1, attempt: 0, action: "status", status: 503, outcome: { kind: "not_ingested" }, body_sha256: sha256(eventId) });
      ingress.read_back.push({ event_id: eventId, persisted: false, storage_result: "not_found" });
      if (lossCount < ceiling && lossCount + 1 === ceiling) {
        sender.callbacks.loss_ceiling_reached.push([ceiling]);
        trace(eventId, "loss_ceiling_reached", { loss_count: ceiling });
      }
      lossCount = Math.min(lossCount + 1, ceiling);
      sender.callbacks.dropped.push([eventId, lossCount]);
      trace(eventId, "dropped", { loss_count: lossCount });
    } else {
      stores({ ingress, eventId, attempt: 0, action: "acknowledge", status: 202 });
    }
    sender.deliveries[eventId] = dropped ? { status: "dropped", attempts: 1, loss_count: lossCount } : { status: "delivered", attempts: 1 };
    trace(eventId, "result", { status: dropped ? "dropped" : "delivered" });
    sender.calls.push(call(!dropped, "SDK_SINK_FAILURE"));
  }
  sender.health = { deliveryClass: "best_effort", lossCount, lossCeilingReached: lossCount === ceiling, claimsDelivered: false };
  sender.guarantees = { deliveryClass: "best_effort", semantic: "at_most_once", claimsAtLeastOnce: false, failsClosedBeforeCommit: false };
  return { sender, ingress, role_closure: closed(), occurrence_count: phase.occurrences };
}

const honestPhase = (phase) => (phase.kind === "burst" ? honestBurst(phase) : honestSequence(phase));
const honest = () => ({ phases: Object.fromEntries(FROZEN.phases.map((phase) => [phase.name, honestPhase(phase)])), gate: { small_matched: true, small_mismatched: [], volume_pass: "completed" } });
const mismatched = (result) => result.evaluations.filter((entry) => !entry.matched).map((entry) => entry.case_id);

test("an honest run built from the frozen phases matches every case", () => {
  const result = evaluateCases({ observations: honest(), expectations: FROZEN });
  assert.deepEqual(mismatched(result), []);
  assert.deepEqual(result.verdict, { matched: 17, mismatched: 0 });
});

test("the shutdown deadline has no rounding or grace margin", () => {
  for (const elapsed of [200.001, 200.49, 201]) {
    const run = honest();
    run.phases.abandon.sender.shutdown_elapsed_ms = elapsed;
    const failed = mismatched(evaluateCases({ observations: run, expectations: FROZEN }));
    assert(failed.includes("L-04") && failed.includes("L-07"), `an elapsed ${elapsed} ms must fail a 200 ms deadline`);
  }
});

test("a duplicated post-ceiling callback cannot hide an unreported drop", () => {
  const run = honest();
  const dropped = run.phases.best_effort.sender.callbacks.dropped;
  dropped.at(-1)[0] = dropped.at(-2)[0];
  assert(mismatched(evaluateCases({ observations: run, expectations: FROZEN })).includes("L-07"));
});

test("the ceiling signal belongs to the first saturating drop before its result", () => {
  for (const late of [false, true]) {
    const run = honest();
    const trace = run.phases.best_effort.sender.trace;
    const index = trace.findIndex((entry) => entry.kind === "loss_ceiling_reached");
    if (late) trace.push(trace.splice(index, 1)[0]);
    else trace[index].event_id = "another-drop";
    run.phases.best_effort.sender.trace = trace.map((entry, at) => ({ ...entry, sequence: at + 1 }));
    assert(mismatched(evaluateCases({ observations: run, expectations: FROZEN })).includes("L-07"));
  }
});

test("rejection evidence requires an attributed callback before the result and no operation start", () => {
  for (const mutate of [
    (trace) => trace.filter((entry) => !(entry.event_id === "overload-9" && entry.kind === "rejected_overload")),
    (trace) => [...trace, { event_id: "overload-9", kind: "operation_started" }],
    (trace) => {
      const callback = trace.find((entry) => entry.event_id === "overload-9" && entry.kind === "rejected_overload");
      return [...trace.filter((entry) => entry !== callback), callback];
    },
  ]) {
    const run = honest();
    run.phases.overload.sender.trace = mutate(run.phases.overload.sender.trace).map((entry, index) => ({ ...entry, sequence: index + 1 }));
    assert(mismatched(evaluateCases({ observations: run, expectations: FROZEN })).includes("L-07"));
  }
});

test("combined retry accounting detects hidden delays, exhaustion, attempts and storage uncertainty", () => {
  for (const mutate of [
    (phase) => { phase.sender.callbacks.scheduled.pop(); },
    (phase) => { phase.sender.callbacks.exhausted.pop(); },
    (phase) => { phase.sender.trace.find((entry) => entry.kind === "scheduled").event_id = "unrelated"; },
    (phase) => { phase.sender.exchanges[0].attempt = 3; },
    (phase) => { phase.ingress.read_back[0].storage_result = "unknown"; },
    (phase) => { phase.sender.trace.find((entry) => entry.kind === "scheduled").values[1] += 1; },
  ]) {
    const run = honest();
    mutate(run.phases.retry_shutdown);
    assert(mismatched(evaluateCases({ observations: run, expectations: FROZEN })).includes("L-11"), mutate.toString());
  }
});

test("a valid load result requires runtime accounting controls, final quiescence and confirmed closure", () => {
  for (const mutate of [
    (phase) => { phase.sender.controls.accounting_checks.holds = false; },
    (phase) => { phase.ingress.quiescent = false; },
    (phase) => { phase.role_closure.sender.code = null; phase.role_closure.sender.signal = "SIGKILL"; },
  ]) {
    const run = honest();
    mutate(run.phases.abandon);
    assert(mismatched(evaluateCases({ observations: run, expectations: FROZEN })).includes("L-08"));
  }
});

test("a skipped volume pass leaves the small cases matched and every volume case unobserved", () => {
  const run = honest();
  for (const phase of FROZEN.phases.filter((entry) => entry.pass === "volume")) run.phases[phase.name] = null;
  const result = evaluateCases({ observations: run, expectations: FROZEN });
  assert.deepEqual(mismatched(result), ["L-12", "L-13", "L-14", "L-15", "L-16", "L-17"]);
  assert.equal(evaluateCases({ observations: null, expectations: FROZEN }).verdict.mismatched, 17);
});

test("planted defects are reported, never absorbed", () => {
  const plants = [
    // An overload rejection with no rejected-overload callback.
    [(run) => { run.phases.overload.sender.callbacks.rejected_overload.pop(); }, ["L-01", "L-07"]],
    // A rejected occurrence that still reached the exchange (a backlog drained later).
    [(run) => { run.phases.overload.sender.exchanges.push({ event_id: "overload-9", attempt: 0, body_sha256: sha256("overload-9") }); }, ["L-01", "L-07"]],
    // An ingress request beyond the admitted occurrences.
    [(run) => { run.phases.overload_volume.ingress.records.push({ ...run.phases.overload_volume.ingress.records[0] }); }, ["L-12", "L-16"]],
    // A shutdown report whose split does not add up.
    [(run) => { run.phases.drain.sender.shutdown_report = { accepted: 8, completed: 7, abandoned: 0 }; }, ["L-03", "L-06", "L-07"]],
    // A shutdown report that leaves one admitted operation out entirely, though its split adds up.
    [(run) => { run.phases.drain_volume.sender.shutdown_report = { accepted: 199, completed: 199, abandoned: 0 }; }, ["L-14", "L-16"]],
    // A shutdown past its deadline.
    [(run) => { run.phases.abandon.sender.shutdown_elapsed_ms = 5000; }, ["L-04", "L-07"]],
    // A later submission admitted although shutdown had started.
    [(run) => { run.phases.drain.sender.deliveries["drain-8"] = { status: "acknowledged", attempts: 1 }; }, ["L-03"]],
    // A drop with no drop callback.
    [(run) => { run.phases.best_effort.sender.callbacks.dropped.pop(); }, ["L-05", "L-06", "L-07"]],
    // A loss count that wrapped instead of saturating.
    [(run) => { run.phases.best_effort_volume.sender.callbacks.dropped.at(-1)[1] = 1; }, ["L-15", "L-16"]],
    // A drop whose own result reports another loss count than its callback.
    [(run) => { Object.values(run.phases.best_effort.sender.deliveries).find((delivery) => delivery.status === "dropped").loss_count = 9; }, ["L-07"]],
    // A shutdown that overran a 200 ms deadline by more than half of it.
    [(run) => { run.phases.abandon.sender.shutdown_elapsed_ms = 350; }, ["L-04", "L-07"]],
    // A ceiling signal that never fired.
    [(run) => { run.phases.best_effort.sender.callbacks.loss_ceiling_reached = []; }, ["L-05", "L-07"]],
    // A binding that claims delivery of a dropped occurrence.
    [(run) => { run.phases.best_effort.sender.health = { ...run.phases.best_effort.sender.health, claimsDelivered: true }; }, ["L-05", "L-07"]],
    // An occurrence lost without any result.
    [(run) => { delete run.phases.overload.sender.deliveries["overload-0"]; }, ["L-01", "L-02"]],
    // A guard control that did not hold.
    [(run) => { run.phases.abandon.sender.controls = { ...CONTROLS, loopback_guard: { holds: false } }; }, ["L-08"]],
  ];
  for (const [plant, expected] of plants) {
    const run = honest();
    plant(run);
    assert.deepEqual(mismatched(evaluateCases({ observations: run, expectations: FROZEN })), expected, plant.toString());
  }
});

// The session's sequencing, with a fixture in place of each phase's role processes.
test("the volume phases run only after every small-pass case matched", async () => {
  const started = [];
  const exchange = async ({ phase }) => {
    started.push(phase.name);
    return honestPhase(phase);
  };
  const observations = await loadSession({ service: "unused", storage: "unused", flags: {}, expectations: FROZEN, exchange });
  assert.deepEqual(started, FROZEN.phases.map((phase) => phase.name));
  assert.deepEqual(observations.gate, { small_matched: true, small_mismatched: [], volume_pass: "completed" });
  assert.equal(observations.occurrence_count, FROZEN.planned_call_budget.total);
  started.length = 0;
  const failing = async ({ phase }) => {
    started.push(phase.name);
    const observed = honestPhase(phase);
    if (phase.name === "drain") observed.sender.shutdown_report = { accepted: 8, completed: 7, abandoned: 0 };
    return observed;
  };
  const skipped = await loadSession({ service: "unused", storage: "unused", flags: {}, expectations: FROZEN, exchange: failing });
  assert.deepEqual(started, ["overload", "drain", "abandon", "best_effort", "retry_shutdown"]);
  assert.deepEqual(skipped.gate, { small_matched: false, small_mismatched: ["L-03", "L-06", "L-07"], volume_pass: "skipped" });
  assert.equal(skipped.phases.overload_volume, null);
});

test("a failed volume phase keeps every completed phase's observations, with the call count unknown", async () => {
  const exchange = async ({ phase }) => {
    if (phase.name === "best_effort_volume") throw new Error("volume sender crashed");
    return honestPhase(phase);
  };
  const error = await loadSession({ service: "unused", storage: "unused", flags: {}, expectations: FROZEN, exchange }).then(() => null, (rejection) => rejection);
  assert.equal(error.message, "volume sender crashed");
  assert.equal(error.observations.gate.volume_pass, "failed");
  assert.deepEqual(Object.keys(error.observations.phases).filter((name) => error.observations.phases[name] !== null), ["overload", "drain", "abandon", "best_effort", "retry_shutdown", "overload_volume", "drain_volume"]);
  assert.equal(error.observations.phases.best_effort_volume, null);
  assert.equal(error.observations.occurrence_count, null);
});

test("a failed small-pass phase keeps the phases completed before it, with the gate not yet judged", async () => {
  const exchange = async ({ phase }) => {
    if (phase.name === "best_effort") throw new Error("best_effort sender crashed");
    return honestPhase(phase);
  };
  const error = await loadSession({ service: "unused", storage: "unused", flags: {}, expectations: FROZEN, exchange }).then(() => null, (rejection) => rejection);
  assert.equal(error.message, "best_effort sender crashed");
  assert.deepEqual(error.observations.gate, { small_matched: null, small_mismatched: null, volume_pass: "skipped" });
  assert.deepEqual(Object.keys(error.observations.phases).filter((name) => error.observations.phases[name] !== null), ["overload", "drain", "abandon"]);
  assert.equal(error.observations.occurrence_count, null);
  const first = await loadSession({ service: "unused", storage: "unused", flags: {}, expectations: FROZEN, exchange: async () => { throw new Error("first sender crashed"); } }).then(() => null, (rejection) => rejection);
  assert.equal(Object.hasOwn(first, "observations"), false, "nothing completed, so nothing is kept");
});
