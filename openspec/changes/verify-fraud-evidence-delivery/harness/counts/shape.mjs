import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";
import { OBSERVATION_CONTRACT } from "./observations.mjs";

const CALLS = "beginOperation markCommitted authenticationSucceeded authenticationFailed sessionCreated mfaRemoved passwordResetCompleted sessionRevoked redeliver";
const PHASE = {
  name: null, pass: null, seed_offset: null, chain_count: null, failed_count: null,
  tenant_count: null, occurrences: null, extra_call_bound: null,
  basis: { frozen_occurrences: null, formula: null },
  call_plan: Object.fromEntries(CALLS.split(" ").map((name) => [name, { minimum: null, maximum: null }])),
};
const SHAPE = {
  probe: null, ticket: null, version: null, base: null, contract_version: null,
  workload: { seed: null }, clock: { start: null, step_ms: null }, observations: null,
  reconciliation: null, per_target: null, per_target_reference: null, deadline_ms: null,
  planned_call_budget: { total: null, processes: { "*": null } },
  plans: [{ file: null, id: null, sha256: null, phase: null, excluded_reason: null }],
  phases: [PHASE], ground_truth: { "*": { "*": { successful: null, failed: null, other: null } } },
  cases: [{ case_id: null, observer: null, pass: null, setup: null, expected: { holds: null }, basis: [null] }],
};

function inspect(value, shape) {
  if (shape === null) {
    assert(value === null || typeof value !== "object", "unexpected structured value");
    return;
  }
  if (Array.isArray(shape)) {
    assert(Array.isArray(value), "expected array");
    value.forEach((entry) => inspect(entry, shape[0]));
    return;
  }
  Object.entries(value).forEach(([key, entry]) => inspectField({ key, entry, shape }));
}

function inspectField({ key, entry, shape }) {
  const declared = Object.hasOwn(shape, key);
  assert(declared || Object.hasOwn(shape, "*"), `unknown expectations key: ${key}`);
  inspect(entry, declared ? shape[key] : shape["*"]);
}

export function validateShape(expectations) {
  assert(isDeepStrictEqual(expectations.observations, OBSERVATION_CONTRACT), "observation limits or unknown fields");
  const { observations: _observations, ...rest } = expectations;
  inspect(rest, SHAPE);
}
