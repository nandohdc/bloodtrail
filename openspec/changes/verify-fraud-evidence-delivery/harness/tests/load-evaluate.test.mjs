// The load evaluator on fixture observations: an honest run built from the frozen phases must match every
// case, and each planted deviation must be reported as a mismatch, never absorbed. No kit code runs.
import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonFile, sha256 } from "../lib/io.mjs";
import { evaluateCases } from "../load/evaluate.mjs";
import { validateExpectations } from "../load/expectations.mjs";
import { loadSession } from "../load/session.mjs";

const FROZEN = validateExpectations(jsonFile(new URL("../expectations/load.v1.json", import.meta.url)));
const CONTROLS = { loopback_guard: { holds: true }, write_outside_grant: { holds: true }, synthetic_data: { holds: true } };
const call = (ok, code) => (ok ? { label: "fixture", ok: true, value: { status: "accepted" } } : { label: "fixture", ok: false, error: { code } });

function base(name) {
  return {
    sender: { calls: [], deliveries: {}, delivery_log: [], exchanges: [], callbacks: {}, controls: CONTROLS, guard_violations: [{ host: "192.0.2.1" }] },
    ingress: { controls: { write_outside_grant: { holds: true } }, records: [], read_back: [] },
    id: (index) => `${name}-${index}`,
  };
}

function stores({ ingress, eventId, attempt, action, status }) {
  ingress.records.push({ event_id: eventId, occurrence: ingress.records.length + 1, attempt, action, status, outcome: { kind: "persisted" }, body_sha256: sha256(eventId) });
  ingress.read_back.push({ event_id: eventId, persisted: true, stored_body_sha256: sha256(eventId) });
}

// A burst as frozen: the first `capacity` admitted and held, the rest rejected at the gate, later
// submissions rejected while shutting down; an abandoning shutdown labels every held delivery abandoned and
// logs its late acknowledgment.
function honestBurst(phase) {
  const { sender, ingress, id } = base(phase.name);
  const { capacity, shutdown_deadline_ms: deadline } = phase.composition;
  const admitted = Math.min(phase.occurrences, capacity);
  const abandoning = deadline < FROZEN.scenarios[phase.schedule[0]][0].delay_ms;
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
    stores({ ingress, eventId, attempt: 0, action: "delay", status: 202 });
    sender.deliveries[eventId] = abandoning ? { status: "abandoned", attempts: 0 } : { status: "acknowledged", attempts: 1 };
    if (abandoning) sender.delivery_log.push({ event_id: eventId, status: "acknowledged", attempts: 1, after_shutdown: true });
    sender.calls.push(call(true));
  }
  for (let index = 0; index < phase.after_shutdown; index += 1) {
    sender.deliveries[id(phase.occurrences + index)] = { status: "rejected_shutting_down", attempts: 0 };
    sender.calls.push(call(false, "SDK_SINK_FAILURE"));
  }
  sender.shutdown_report = { accepted: phase.occurrences, completed: abandoning ? 0 : phase.occurrences, abandoned: abandoning ? phase.occurrences : 0 };
  sender.shutdown_elapsed_ms = abandoning ? deadline : 300;
  return { sender, ingress, occurrence_count: phase.occurrences + phase.after_shutdown };
}

function honestSequence(phase) {
  const { sender, ingress, id } = base(phase.name);
  const ceiling = phase.composition.loss_ceiling;
  let lossCount = 0;
  sender.callbacks = { dropped: [], loss_ceiling_reached: [] };
  for (let index = 0; index < phase.occurrences; index += 1) {
    const eventId = id(index);
    const dropped = phase.schedule[index % phase.schedule.length] === "dropped";
    sender.exchanges.push({ event_id: eventId, attempt: 0, body_sha256: sha256(eventId) });
    if (dropped) {
      ingress.records.push({ event_id: eventId, occurrence: index + 1, attempt: 0, action: "status", status: 503, outcome: { kind: "not_ingested" }, body_sha256: sha256(eventId) });
      ingress.read_back.push({ event_id: eventId, persisted: false, storage_result: "not_found" });
      if (lossCount < ceiling && lossCount + 1 === ceiling) sender.callbacks.loss_ceiling_reached.push([ceiling]);
      lossCount = Math.min(lossCount + 1, ceiling);
      sender.callbacks.dropped.push([eventId, lossCount]);
    } else {
      stores({ ingress, eventId, attempt: 0, action: "acknowledge", status: 202 });
    }
    sender.deliveries[eventId] = dropped ? { status: "dropped", attempts: 1, loss_count: lossCount } : { status: "delivered", attempts: 1 };
    sender.calls.push(call(!dropped, "SDK_SINK_FAILURE"));
  }
  sender.health = { deliveryClass: "best_effort", lossCount, lossCeilingReached: lossCount === ceiling, claimsDelivered: false };
  sender.guarantees = { deliveryClass: "best_effort", semantic: "at_most_once", claimsAtLeastOnce: false, failsClosedBeforeCommit: false };
  return { sender, ingress, occurrence_count: phase.occurrences };
}

const honestPhase = (phase) => (phase.kind === "burst" ? honestBurst(phase) : honestSequence(phase));
const honest = () => ({ phases: Object.fromEntries(FROZEN.phases.map((phase) => [phase.name, honestPhase(phase)])), gate: { small_matched: true, small_mismatched: [], volume_pass: "completed" } });
const mismatched = (result) => result.evaluations.filter((entry) => !entry.matched).map((entry) => entry.case_id);

test("an honest run built from the frozen phases matches every case", () => {
  const result = evaluateCases({ observations: honest(), expectations: FROZEN });
  assert.deepEqual(mismatched(result), []);
  assert.deepEqual(result.verdict, { matched: 14, mismatched: 0 });
});

test("a skipped volume pass leaves the small cases matched and every volume case unobserved", () => {
  const run = honest();
  for (const phase of FROZEN.phases.filter((entry) => entry.pass === "volume")) run.phases[phase.name] = null;
  const result = evaluateCases({ observations: run, expectations: FROZEN });
  assert.deepEqual(mismatched(result), ["L-09", "L-10", "L-11", "L-12", "L-13", "L-14"]);
  assert.equal(evaluateCases({ observations: null, expectations: FROZEN }).verdict.mismatched, 14);
});

test("planted defects are reported, never absorbed", () => {
  const plants = [
    // An overload rejection with no rejected-overload callback.
    [(run) => { run.phases.overload.sender.callbacks.rejected_overload.pop(); }, ["L-01", "L-07"]],
    // A rejected occurrence that still reached the exchange (a backlog drained later).
    [(run) => { run.phases.overload.sender.exchanges.push({ event_id: "overload-9", attempt: 0, body_sha256: sha256("overload-9") }); }, ["L-01", "L-07"]],
    // An ingress request beyond the admitted occurrences.
    [(run) => { run.phases.overload_volume.ingress.records.push({ ...run.phases.overload_volume.ingress.records[0] }); }, ["L-09", "L-13"]],
    // A shutdown report whose split does not add up.
    [(run) => { run.phases.drain.sender.shutdown_report = { accepted: 8, completed: 7, abandoned: 0 }; }, ["L-03", "L-06", "L-07"]],
    // A shutdown report that leaves one admitted operation out entirely, though its split adds up.
    [(run) => { run.phases.drain_volume.sender.shutdown_report = { accepted: 199, completed: 199, abandoned: 0 }; }, ["L-11", "L-13"]],
    // A shutdown past its deadline.
    [(run) => { run.phases.abandon.sender.shutdown_elapsed_ms = 5000; }, ["L-04", "L-07"]],
    // A later submission admitted although shutdown had started.
    [(run) => { run.phases.drain.sender.deliveries["drain-8"] = { status: "acknowledged", attempts: 1 }; }, ["L-03"]],
    // A drop with no drop callback.
    [(run) => { run.phases.best_effort.sender.callbacks.dropped.pop(); }, ["L-05", "L-06", "L-07"]],
    // A loss count that wrapped instead of saturating.
    [(run) => { run.phases.best_effort_volume.sender.callbacks.dropped.at(-1)[1] = 1; }, ["L-12", "L-13"]],
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
  assert.deepEqual(started, ["overload", "drain", "abandon", "best_effort"]);
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
  assert.deepEqual(Object.keys(error.observations.phases).filter((name) => error.observations.phases[name] !== null), ["overload", "drain", "abandon", "best_effort", "overload_volume", "drain_volume"]);
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
