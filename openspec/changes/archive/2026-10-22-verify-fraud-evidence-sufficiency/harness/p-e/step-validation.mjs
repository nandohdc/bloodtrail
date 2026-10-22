import assert from "node:assert/strict";
import { OBSERVED_NOT_FROZEN, counters, keys, list, natural, owned, text } from "./shape.mjs";
import { validateAssertions } from "./assertions.mjs";
import { validateResult } from "./result-shapes.mjs";

export function validateStep(step, caseId) {
  keys(step, ["step_id", "result", "counters", "assertions"], ["exchange", "callback_order"]);
  owned(step.step_id, caseId);
  validateResult(step.result);
  if (step.counters !== OBSERVED_NOT_FROZEN) counters(step.counters);
  validateAssertions(step.assertions);
  if (["observation", "sdk_value"].includes(step.result.variant)) {
    assert(step.assertions.length > 0, "observational/value result needs explicit assertions");
  }
  if (step.exchange !== undefined) validateExchange(step.exchange);
  if (step.callback_order !== undefined) validateCallbackOrder(step.callback_order);
}

function validateCallbackOrder(order) {
  if (order === OBSERVED_NOT_FROZEN) return;
  for (const name of list(order, "callback_order")) text(name, "callback name");
}

function validateExchange(exchange) {
  if (exchange === OBSERVED_NOT_FROZEN) return;
  keys(exchange, ["count", "request_attempt", "method", "path"]);
  natural(exchange.count, "exchange.count");
  assert.equal(exchange.request_attempt, 0);
  assert.equal(exchange.method, "POST");
  assert.equal(exchange.path, "/v1/security-audit");
}

export function validateAggregate(aggregate, caseId) {
  keys(aggregate, ["aggregate_id", "source", "step_id", "assertions"]);
  owned(aggregate.aggregate_id, caseId);
  owned(aggregate.step_id, caseId);
  assert(["guarantees", "contract"].includes(aggregate.source), "unknown aggregate source");
  validateAssertions(aggregate.assertions);
  assert(aggregate.assertions.length > 0, "aggregate assertions required");
}

export function validateReferences({ cases, stepIds }) {
  for (const entry of cases) {
    const rules = [...entry.expected, ...entry.aggregates, entry.summary];
    for (const rule of rules) {
      for (const assertion of rule.assertions) validatePeer(assertion, stepIds);
    }
    for (const aggregate of entry.aggregates) {
      assert(stepIds.has(aggregate.step_id), `aggregate owns absent step ${aggregate.step_id}`);
    }
  }
}

function validatePeer(assertion, stepIds) {
  if (assertion.peer === undefined) return;
  assert(stepIds.has(assertion.peer.step_id), `unknown relation reference ${assertion.peer.step_id}`);
}
