// In-process session rehearsal gate for the Stage 2 chains probe (#840, Q201-Q216).
import assert from "node:assert/strict";
import { test } from "node:test";
import { jsonFile } from "../lib/io.mjs";
import { evaluateCases } from "../chains/evaluate.mjs";
import { exchangeChainsUnit } from "../chains/session.mjs";
import { reconstructOrderByArrival } from "../chains/reconstruct.mjs";
import { runChainsRehearsal } from "./chains-fakes.mjs";

const FROZEN_V1 = jsonFile(new URL("../expectations/chains.v1.json", import.meta.url));
const SHORTENED_DEADLINE_MS = 25000;

test("chains in-process session rehearsal passes both passes and matches all 11 cases", { timeout: 45000 }, async () => {
  const sessionResult = await runChainsRehearsal();

  assert.equal(sessionResult.gate.small_matched, true);
  assert.deepEqual(sessionResult.gate.small_mismatched, []);
  assert.equal(sessionResult.gate.small_matched, true);
  assert.equal(sessionResult.gate.volume_pass, "completed");

  const smallPhase = sessionResult.phases.chains_small;
  assert(Array.isArray(smallPhase.ingress.persisted_bodies), "ingress must carry persisted_bodies");
  assert.equal(smallPhase.ingress.persisted_bodies.length, 36, "small pass must persist 36 bodies");
  assert(smallPhase.reconstruction.chains, "reconstruction must carry chains");

  const volumePhase = sessionResult.phases.chains_volume;
  assert(Array.isArray(volumePhase.ingress.persisted_bodies), "ingress must carry persisted_bodies");
  assert.equal(volumePhase.ingress.persisted_bodies.length, 360, "volume pass must persist 360 bodies");

  const verdict = evaluateCases({ observations: sessionResult, expectations: FROZEN_V1 });
  assert.equal(verdict.verdict.matched, 11, `Expected 11 matched cases, got ${verdict.verdict.matched}`);
  assert.equal(verdict.verdict.mismatched, 0);
  for (const entry of verdict.evaluations) {
    assert.equal(entry.matched, true, `Case ${entry.case_id} failed`);
  }
});

test("null control: honest rehearsal completes under shortened deadline", { timeout: 45000 }, async () => {
  const shortenedExpectations = { ...FROZEN_V1, deadline_ms: SHORTENED_DEADLINE_MS };
  const sessionResult = await runChainsRehearsal({ expectations: shortenedExpectations });
  assert.equal(sessionResult.gate.small_matched, true);
  assert.equal(sessionResult.gate.volume_pass, "completed");
});

test("seam defect 1: dropped persisted_bodies fails R-01 and gates volume pass", { timeout: 45000 }, async () => {
  const shortenedExpectations = { ...FROZEN_V1, deadline_ms: SHORTENED_DEADLINE_MS };
  const sessionResult = await runChainsRehearsal({
    expectations: shortenedExpectations,
    dropPersistedBodies: true,
  });

  assert.equal(sessionResult.gate.small_matched, false);
  assert.equal(sessionResult.gate.volume_pass, "skipped");

  const verdict = evaluateCases({ observations: sessionResult, expectations: FROZEN_V1 });
  const r01 = verdict.evaluations.find((e) => e.case_id === "R-01");
  assert.equal(r01.matched, false, "R-01 must fail when persisted_bodies are dropped");
});

test("seam defect 2: arrival-order reconstruction fails R-08 under same deadline", { timeout: 45000 }, async () => {
  const arrivalExchange = async (opts) => {
    const result = await exchangeChainsUnit(opts);
    if (result.ingress?.persisted_bodies) {
      result.reconstruction = reconstructOrderByArrival(result.ingress.persisted_bodies);
    }
    return result;
  };

  const shortenedExpectations = { ...FROZEN_V1, deadline_ms: SHORTENED_DEADLINE_MS };
  const sessionResult = await runChainsRehearsal({
    expectations: shortenedExpectations,
    exchange: arrivalExchange,
  });

  assert.equal(sessionResult.gate.small_matched, false);
  assert.equal(sessionResult.gate.volume_pass, "skipped");

  const verdict = evaluateCases({ observations: sessionResult, expectations: FROZEN_V1 });
  const r08 = verdict.evaluations.find((e) => e.case_id === "R-08");
  assert.equal(r08.matched, false, "R-08 must fail when reconstruction orders by arrival");
});
