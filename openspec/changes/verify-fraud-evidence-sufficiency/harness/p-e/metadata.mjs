import assert from "node:assert/strict";
import { OBSERVED_NOT_FROZEN, keys, list, natural, text } from "./shape.mjs";

function exchangeAttempt(attempt, expected) {
  text(attempt.body_sha256, "body_sha256");
  assert.match(attempt.body_sha256, /^[a-f0-9]{64}$/, "body digest format");
  natural(attempt.body_bytes, "body_bytes");
  assert(attempt.body_bytes > 0, "body bytes required");
  text(attempt.event_id, "exchange event_id");
  natural(attempt.exchange_ordinal, "exchange ordinal");
  assert(attempt.exchange_ordinal > 0);
  assert.equal(attempt.attempt, attempt.exchange_ordinal);
  assert.equal(attempt.request_attempt, expected.request_attempt);
  assert.equal(attempt.method, expected.method);
  assert.equal(attempt.path, expected.path);
  exchangeOutcome(attempt.outcome);
}

function exchangeOutcome(outcome) {
  assert(["returned", "thrown"].includes(outcome.kind), "exchange outcome kind");
  if (outcome.kind === "thrown") {
    text(outcome.raw.name, "exchange error name");
    text(outcome.raw.message, "exchange error message");
    return;
  }
  if (outcome.raw.kind === "timeout") return keys(outcome.raw, ["kind"]);
  assert.equal(outcome.raw.kind, "response");
  natural(outcome.raw.status, "HTTP status");
  assert(outcome.raw.status >= 100 && outcome.raw.status <= 599, "HTTP status range");
  list(outcome.raw.acknowledgments, "acknowledgments");
}

function compareCallbackOrder(step, record) {
  if (step.callback_order === undefined) return;
  if (step.callback_order === OBSERVED_NOT_FROZEN) return;
  assert.deepEqual(record.callback_order, step.callback_order, "callback order differs");
}

function compareExchange(step, record) {
  if (step.exchange === undefined) return;
  if (step.exchange === OBSERVED_NOT_FROZEN) return;
  const attempts = list(record.exchange_attempts, "exchange_attempts");
  assert.equal(attempts.length, step.exchange.count, "exchange attempt count");
  for (const attempt of attempts) exchangeAttempt(attempt, step.exchange);
}

export function metadataIssues(step, record) {
  try {
    compareCallbackOrder(step, record);
    compareExchange(step, record);
    return [];
  } catch (error) { return [`callback/exchange metadata: ${error.message}`]; }
}
