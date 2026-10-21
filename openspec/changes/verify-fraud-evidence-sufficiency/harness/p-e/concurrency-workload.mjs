import { parking } from "./parking.mjs";
import { acknowledgingExchange } from "./scripts.mjs";
import { recordStep, occurrenceFacts, runCase } from "./case-steps.mjs";
import { attemptFacts, committedGate, deliverStep, notCommittedSetup, summarize,
  trueProbe, truthfulSetup } from "./redelivery-steps.mjs";
import { CONCURRENCY_CASES } from "./concurrency-cases.mjs";

const scripts = (exchange) => [{ exchange, probe: trueProbe, gate: committedGate }];

async function duplicateCase(state, entry, options) {
  // The deferred MUST predate d1, not be assigned inside the exchange.
  const parked = parking();
  const ack = acknowledgingExchange();
  let enteredAfterRelease = false;
  const exchange = async (request) => {
    enteredAfterRelease = parked.released;
    await parked.promise;
    return ack(request);
  };
  const setup = await truthfulSetup(state, entry, scripts(exchange));
  const unit = setup.deliveries[0];
  const deliver = deliverStep(state, setup, unit);
  const d1 = deliver("d1");
  const synchrony = setup.counters();
  try {
    const d2 = await deliver("d2");
    d2.at_resolution = setup.counters();
    d2.after_d1_start = synchrony;
    // Fixture-only scheduling injection can hold the probe until release.
    if (options.beforeRelease !== undefined) options.beforeRelease();
  } finally {
    parked.release();
  }
  await d1;
  await deliver("third");
  const row = summarize(state, entry, [setup], ["mark", "emit", "d2", "d1", "third"]);
  row.parking = { released: parked.released, exchange_entered_after_release: enteredAfterRelease };
  return row;
}

async function differentPairCase(state, entry) {
  const setupFactory = entry.case_id === "P-E-6c" ? notCommittedSetup : truthfulSetup;
  const setup = await setupFactory(state, entry, scripts(acknowledgingExchange()));
  const unit = setup.deliveries[0];
  await deliverStep(state, setup, unit)("first");
  const firstEvent = setup.event;
  const firstTransaction = setup.handle.transactionId;
  let secondTransaction = firstTransaction;
  const steps = ["mark", "emit", "first"];
  if (entry.case_id === "P-E-6c") {
    const emit = await recordStep(state, { id: "emit-again", target: setup.target, counters: setup.counters,
      run: () => state.method(setup.target.sdk, "mfaRemoved", { ...setup.input, operation: setup.handle }) });
    emit.occurrence = occurrenceFacts({ captures: emit.captures, handle: setup.handle });
    setup.event = emit.captures[0].event;
    steps.push("emit-again");
  } else {
    // Only the caller argument changes; the occurrence is never forged.
    secondTransaction = "pe-txn-other-0001";
  }
  await deliverStep(state, setup, unit)("second", secondTransaction);
  const row = summarize(state, entry, [setup], [...steps, "second"]);
  row.pair_facts = { same_event_id: firstEvent.event.id === setup.event.event.id,
    same_caller_transaction_id: firstTransaction === secondTransaction,
    same_occurrence_transaction_id: firstEvent.correlation.transaction_id === setup.event.correlation.transaction_id,
    caller_transaction_matches_occurrence: secondTransaction === setup.event.correlation.transaction_id };
  row.exchange_identity = attemptFacts(unit.boundary.attempts);
  return row;
}

export async function concurrencyCase(state, entry, options = {}) {
  if (entry.case_id === "P-E-6") return duplicateCase(state, entry, options);
  return differentPairCase(state, entry);
}

export async function concurrencyWorkload(state, cases = CONCURRENCY_CASES) {
  const rows = [];
  for (const entry of cases) {
    const row = await runCase(state, entry, () => concurrencyCase(state, entry));
    if (row !== null) rows.push(row);
  }
  state.accounting.push(...rows);
  return rows;
}
