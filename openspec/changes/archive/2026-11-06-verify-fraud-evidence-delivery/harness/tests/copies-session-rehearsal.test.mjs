// In-process session rehearsal gate for the Stage 2 copies probe (#839, Q142, Q156, Q160, Q167, Q171).
import assert from "node:assert/strict";
import { test } from "node:test";
import { StopCondition } from "../lib/deadline.mjs";
import { jsonFile } from "../lib/io.mjs";
import { evaluateCases } from "../copies/evaluate.mjs";
import { copiesSession, exchangeCopiesUnit } from "../copies/session.mjs";
import { createRehearsalEnv, runRehearsal } from "./copies-fakes.mjs";

const FROZEN_V2 = jsonFile(new URL("../expectations/copies.v2.json", import.meta.url));
const SHORTENED_DEADLINE_MS = 15000;

function isCompletedPhase(phase) {
  return typeof phase === "object" && phase !== null;
}

test("copies in-process session rehearsal passes both passes and matches all 11 cases", { timeout: 35000 }, async () => {
  const sessionResult = await runRehearsal();

  assert.equal(sessionResult.gate.small_matched, true);
  assert.deepEqual(sessionResult.gate.small_mismatched, []);
  assert.equal(sessionResult.gate.volume_pass, "completed");

  const crPhase = sessionResult.phases.collector_restart;
  assert(Array.isArray(crPhase.ingress.restarts), "ingress must carry restarts array");
  assert.equal(crPhase.ingress.restarts.length, 1, "collector restart handshake must record 1 restart");

  const consPhase = sessionResult.phases.consumer_restart;
  assert(Array.isArray(consPhase.sender.fenced_attempts), "sender must carry fenced_attempts");
  assert.equal(consPhase.sender.fenced_attempts.length, 2);
  assert(consPhase.sender.health?.before_restart, "sender must carry health before restart");
  assert.equal(consPhase.sender.health.before_restart.abandoned, 2);

  const verdict = evaluateCases({ observations: sessionResult, expectations: FROZEN_V2 });
  assert.equal(verdict.verdict.matched, 11, `Expected 11 matched cases, got ${verdict.verdict.matched}`);
  assert.equal(verdict.verdict.mismatched, 0);
  for (const entry of verdict.evaluations) {
    assert.equal(entry.matched, true, `Case ${entry.case_id} failed`);
  }
});

test("seam defect 1: roleExchange dropping restarts causes C-06 mismatch", { timeout: 25000 }, async () => {
  const { service, storage, spawn, cleanup } = createRehearsalEnv();
  try {
    const droppingExchange = async (opts) => {
      const result = await exchangeCopiesUnit(opts);
      if (result.ingress?.restarts) {
        result.ingress = { ...result.ingress, restarts: [] };
      }
      return result;
    };

    const sessionResult = await copiesSession({
      service,
      storage,
      flags: { ingress: [], sender: [] },
      expectations: FROZEN_V2,
      exchange: droppingExchange,
      spawn,
    });

    const verdict = evaluateCases({ observations: sessionResult, expectations: FROZEN_V2 });
    const c06 = verdict.evaluations.find((e) => e.case_id === "C-06");
    assert.equal(c06.matched, false, "C-06 must fail when restarts are dropped");
    assert.equal(c06.observed.restart_count, 0);
  } finally {
    await cleanup();
  }
});

test("planted test: schema-invalid conflicting copy causes C-04 mismatch in rehearsal", { timeout: 35000 }, async () => {
  const { service, storage, spawn, cleanup } = createRehearsalEnv({ schemaInvalidConflict: true });
  try {
    const sessionResult = await copiesSession({
      service,
      storage,
      flags: { ingress: [], sender: [] },
      expectations: FROZEN_V2,
      spawn,
    });

    const verdict = evaluateCases({ observations: sessionResult, expectations: FROZEN_V2 });
    const c04 = verdict.evaluations.find((e) => e.case_id === "C-04");
    assert.equal(c04.matched, false, "C-04 must mismatch when conflicting copy is schema-invalid");
    assert.equal(c04.observed.conflict_rejected, false);
    assert.equal(c04.observed.conflict_code, "COLLECTOR_SCHEMA_INVALID");
  } finally {
    await cleanup();
  }
});

async function runSessionUnderDeadline({ defect, deadlineMs = SHORTENED_DEADLINE_MS } = {}) {
  const options = {};
  if (defect === "drop_ingress_restart") {
    options.dropIngressRestart = true;
  } else if (defect === "break_gate") {
    options.breakGate = true;
  }
  const { service, storage, spawn, cleanup } = createRehearsalEnv(options);
  const shortenedExpectations = { ...FROZEN_V2, deadline_ms: deadlineMs };
  try {
    return await copiesSession({
      service,
      storage,
      flags: { ingress: [], sender: [] },
      expectations: shortenedExpectations,
      spawn,
    });
  } finally {
    await cleanup();
  }
}

async function assertSeamDefect({ defect, completedPhases, uncompletedPhase, deadlineMs = SHORTENED_DEADLINE_MS }) {
  await assert.rejects(
    runSessionUnderDeadline({ defect, deadlineMs }),
    (err) => {
      assert(err instanceof StopCondition, "error must be StopCondition");
      assert.equal(err.condition, "deadline", "condition must be deadline");
      assert(err.observations, "error must carry partial observations");
      const phases = err.observations.phases;
      for (const name of completedPhases) {
        assert(isCompletedPhase(phases[name]), `phase ${name} must be completed`);
      }
      assert(!isCompletedPhase(phases[uncompletedPhase]), `phase ${uncompletedPhase} must not be completed`);
      return true;
    },
  );
}

test("null control: honest rehearsal completes under shortened deadline", { timeout: 35000 }, async () => {
  const sessionResult = await runSessionUnderDeadline({ defect: null, deadlineMs: SHORTENED_DEADLINE_MS });
  assert.equal(sessionResult.gate.small_matched, true);
  assert.equal(sessionResult.gate.volume_pass, "completed");
});

test("seam defect 2: sender dropping request_ingress_restart stops on deadline", { timeout: 35000 }, async () => {
  await assertSeamDefect({
    defect: "drop_ingress_restart",
    completedPhases: ["identities"],
    uncompletedPhase: "collector_restart",
    deadlineMs: SHORTENED_DEADLINE_MS,
  });
});

test("seam defect 3: a retry wait that never resolves stops on deadline", { timeout: 35000 }, async () => {
  await assertSeamDefect({
    defect: "break_gate",
    completedPhases: ["identities", "collector_restart"],
    uncompletedPhase: "consumer_restart",
    deadlineMs: SHORTENED_DEADLINE_MS,
  });
});
