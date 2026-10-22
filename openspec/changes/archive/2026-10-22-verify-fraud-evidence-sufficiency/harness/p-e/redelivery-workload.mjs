import { acknowledgingExchange, exchangeScript, mismatchedAckOutcome, statusOutcome } from "./scripts.mjs";
import { attemptFacts, committedGate, deliverStep, quietStep, scriptedDelivery, summarize,
  trueProbe, truthfulSetup } from "./redelivery-steps.mjs";
import { exchangeFaultsCase, retryAfterFailClosedCase, throwingCallbacksCase, unexpectedValuesCase } from "./fault-workload.mjs";
import { runCase } from "./case-steps.mjs";
import { REDELIVERY_CASES, REDELIVERY_K } from "./redelivery-cases.mjs";

// Only injected public surfaces: deliver/redeliver means binding.deliver again,
// never sdk.redeliver. Boundary-3 hashes come from the live recording exchange.
async function retryUntilSettledCase(state, entry, overrides) {
  const exchange = overrides.exchange
    ?? exchangeScript(Array.from({ length: REDELIVERY_K }, () => statusOutcome(503)));
  const setup = await truthfulSetup(state, entry, [{ exchange, probe: trueProbe, gate: committedGate }]);
  const deliver = deliverStep(state, setup, setup.deliveries[0]);
  await deliver("initial");
  await quietStep(state, setup);
  for (let attempt = 1; attempt < REDELIVERY_K; attempt += 1) await deliver(`redeliver-${attempt}`);
  await deliver("settle");
  await deliver("extra");
  const steps = ["mark", "emit", "initial", "quiet",
    ...Array.from({ length: REDELIVERY_K - 1 }, (_, index) => `redeliver-${index + 1}`), "settle", "extra"];
  const summary = summarize(state, entry, [setup], steps);
  summary.k = REDELIVERY_K;
  summary.exchange_identity = attemptFacts(setup.deliveries[0].boundary.attempts);
  return summary;
}

async function freshInstanceCase(state, entry) {
  const setup = await truthfulSetup(state, entry,
    [{ exchange: acknowledgingExchange(), probe: trueProbe, gate: committedGate }]);
  const first = setup.deliveries[0];
  const deliverFirst = deliverStep(state, setup, first);
  await deliverFirst("b1-deliver");
  const second = scriptedDelivery(state, { exchange: acknowledgingExchange(), probe: trueProbe, gate: committedGate });
  setup.deliveries.push(second);
  const b2 = await deliverStep(state, setup, second)("b2-deliver");
  b2.cross_instance = attemptFacts([...first.boundary.attempts, ...second.boundary.attempts]);
  await deliverFirst("b1-again");
  return summarize(state, entry, [setup], ["mark", "emit", "b1-deliver", "b2-deliver", "b1-again"]);
}

async function permanentRejectionCase(state, entry) {
  const factories = [statusOutcome(422), statusOutcome(422), mismatchedAckOutcome(), statusOutcome(302)];
  const setup = await truthfulSetup(state, entry,
    [{ exchange: exchangeScript(factories), probe: trueProbe, gate: committedGate }]);
  const deliver = deliverStep(state, setup, setup.deliveries[0]);
  const steps = ["deliver", "redeliver", "variant-2xx", "variant-3xx"];
  for (const id of steps) await deliver(id);
  return summarize(state, entry, [setup], ["mark", "emit", ...steps]);
}

const RUNNERS = {
  "P-E-5": retryUntilSettledCase,
  "P-E-7": freshInstanceCase,
  "P-E-8": permanentRejectionCase,
  "P-E-x1": throwingCallbacksCase,
  "P-E-2c": retryAfterFailClosedCase,
  "P-E-x2": unexpectedValuesCase,
  "P-E-x3": exchangeFaultsCase,
};

export async function redeliveryCase(state, entry, overrides = {}) {
  return RUNNERS[entry.case_id](state, entry, overrides);
}

export async function redeliveryWorkload(state, cases = REDELIVERY_CASES) {
  const rows = [];
  for (const entry of cases) {
    const row = await runCase(state, entry, () => redeliveryCase(state, entry));
    if (row !== null) rows.push(row);
  }
  state.accounting.push(...rows);
  return rows;
}
