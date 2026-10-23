// Predicates shared by every probe's expectations validator. Each probe validates its own file in its own
// directory, before any approval is claimed, with the same predicates the sender applies after the claim,
// so a malformed file is refused without spending a run.
import assert from "node:assert/strict";
import { seededJitter, syntheticClock } from "./clock.mjs";
import { seededRandom } from "./workload.mjs";

const CASE_KEYS = ["case_id", "setup", "expected", "basis"];
const COMPOSITION_KEYS = ["exchange_timeout_ms", "max_attempts", "base_delay_ms", "max_delay_ms", "jitter_seed", "capacity", "shutdown_deadline_ms"];
// The kit factories' own ceilings at the frozen base: fetch-exchange.ts MAX_TIMEOUT_MS, delivery-retry.ts
// MAX_ATTEMPTS_CEILING, delivery-backpressure.ts MAX_CAPACITY_CEILING and delivery-classes.ts
// BEST_EFFORT_LOSS_CEILING. Past them the factory throws.
export const KIT_CEILINGS = Object.freeze({ exchange_timeout_ms: 60_000, max_attempts: 1000, capacity: 100_000, loss_ceiling: 1_000_000 });
const COMPOSITION_CEILINGS = COMPOSITION_KEYS.filter((key) => Object.hasOwn(KIT_CEILINGS, key));

export function validateComposition(composition) {
  for (const key of COMPOSITION_KEYS) assert(Number.isSafeInteger(composition[key]) && composition[key] > 0, `composition.${key}`);
  for (const key of COMPOSITION_CEILINGS) assert(composition[key] <= KIT_CEILINGS[key], `composition.${key} exceeds the kit ceiling ${KIT_CEILINGS[key]}`);
  assert(composition.max_delay_ms >= composition.base_delay_ms, "composition.max_delay_ms must be at least base_delay_ms");
  seededJitter(composition.jitter_seed);
}

export function validateSeedAndClock(value) {
  seededRandom(value.workload.seed);
  syntheticClock({ start: value.clock.start, stepMs: value.clock.step_ms });
}

export function validateWorkloadInputs(value) {
  validateSeedAndClock(value);
  validateComposition(value.composition);
}

// Case ids run `<prefix>-01`, `<prefix>-02`, … in order, and every case cites package source lines.
export function validateCase({ entry, index, prefix }) {
  assert.equal(entry.case_id, `${prefix}-${String(index + 1).padStart(2, "0")}`);
  for (const key of CASE_KEYS) assert(Object.hasOwn(entry, key), `${entry.case_id}: missing ${key}`);
  assert(entry.setup.length > 0, `${entry.case_id}: empty setup`);
  assert(entry.basis.length > 0, `${entry.case_id}: empty basis`);
  for (const citation of entry.basis) assert.match(citation, /^packages\/.+:[0-9]+$/, `${entry.case_id}: basis must cite package source lines`);
}
