import { action } from "./runtime.mjs";
import { commitGate, delivery } from "./delivery.mjs";
import { acknowledgingExchange, scripted } from "./scripts.mjs";
import { businessCounter, caseSummary, counterSnapshot, freshCase, handleFacts, occurrenceFacts, recordStep, runCase } from "./case-steps.mjs";
import { ORDERING_CASES } from "./ordering-cases.mjs";

// Ordering-family workload: truthful and untruthful transaction-critical
// orders driven through the injected runtime. Business commit position is the
// monotonic seq (performance.now()-based), never event.timestamp. Delivery
// uses the harness's frozen boundary-2 capture; its canonical JSON bytes are
// identical to the occurrence the sink stored (implementer default).

const TRUE_PROBE = () => Promise.resolve(true);
const COMMITTED_GATE = () => Promise.resolve("committed");

const CASE_SCRIPTS = {
  "P-E-2": { probe: TRUE_PROBE, gate: COMMITTED_GATE },
  "P-E-2b": { probe: () => Promise.resolve(false), gate: COMMITTED_GATE },
  "P-E-3a": { probe: TRUE_PROBE, gate: COMMITTED_GATE },
  "P-E-3b": { probe: TRUE_PROBE, gate: () => Promise.resolve("declined") },
};

function orderingSetup(state, entry) {
  const { input, target } = freshCase(state, entry.case_id);
  const business = businessCounter();
  const scripts = CASE_SCRIPTS[entry.case_id];
  const made = delivery(state, { exchange: acknowledgingExchange(), durabilityProbe: scripts.probe });
  const gate = commitGate(state, scripts.gate);
  const counters = counterSnapshot({ target, probe: made.probe, gate, boundary: made.boundary, business });
  const begin = state.method(target.sdk, "beginOperation", { boundEvent: "mfaRemoved" });
  return { input, target, business, gate, counters, handle: begin.value, ...made };
}

async function emitStep(state, setup, id) {
  const record = await recordStep(state, { id, target: setup.target, counters: setup.counters,
    run: () => state.method(setup.target.sdk, "mfaRemoved", { ...setup.input, operation: setup.handle }),
    extra: () => ({ handle: handleFacts(setup.handle) }) });
  record.occurrence = occurrenceFacts({ captures: record.captures, handle: setup.handle });
  return record;
}

async function deliverStep(state, setup, event, id) {
  const before = setup.boundary.attempts.length;
  const record = await recordStep(state, { id, target: setup.target, counters: setup.counters,
    run: () => state.method(setup.binding, "deliver", event, setup.handle.transactionId, setup.gate.invoke) });
  record.exchange_attempts = structuredClone(setup.boundary.attempts.slice(before));
  return record;
}

// The two truthful/not-committed deliveries share one runner: the only
// differences are the transition call, the optional host business commit and
// the order names the summary reports.
async function deliveredEmitCase(state, entry, { mark, orderNames }) {
  const seqStart = state.sequence.length;
  const setup = orderingSetup(state, entry);
  if (mark.commits) setup.business.commit(state);
  await recordStep(state, { id: mark.id, target: setup.target, counters: setup.counters,
    run: () => state.method(setup.handle, mark.method), extra: () => ({ handle: handleFacts(setup.handle) }) });
  action(state, mark.method);
  const emit = await emitStep(state, setup, "emit");
  await deliverStep(state, setup, emit.captures[0].event, "deliver");
  return caseSummary(state, entry, { seqStart, actual: setup.counters(), steps: [mark.id, "emit", "deliver"], orderNames });
}

async function truthfulCase(state, entry) {
  return deliveredEmitCase(state, entry, { mark: { id: "mark", method: "markCommitted", commits: true },
    orderNames: ["commit", "markCommitted", "sinkEmit", "probe", "gate", "exchange"] });
}

async function notCommittedCase(state, entry) {
  return deliveredEmitCase(state, entry, { mark: { id: "markNot", method: "markNotCommitted", commits: false },
    orderNames: ["markNotCommitted", "sinkEmit", "probe", "gate", "exchange"] });
}

async function untruthfulCase(state, entry) {
  const seqStart = state.sequence.length;
  const { input, target } = freshCase(state, entry.case_id);
  const business = businessCounter();
  const made = delivery(state, { exchange: acknowledgingExchange(), durabilityProbe: scripted([false, true], false) });
  const gate = commitGate(state, COMMITTED_GATE);
  const counters = counterSnapshot({ target, probe: made.probe, gate, boundary: made.boundary, business });
  const handle = state.method(target.sdk, "beginOperation", { boundEvent: "mfaRemoved" }).value;
  await recordStep(state, { id: "mark", target, counters,
    run: () => state.method(handle, "markCommitted"), extra: () => ({ handle: handleFacts(handle) }) });
  action(state, "markCommitted");
  const emit = await recordStep(state, { id: "emit", target, counters,
    run: () => state.method(target.sdk, "mfaRemoved", { ...input, operation: handle }),
    extra: () => ({ handle: handleFacts(handle) }) });
  emit.occurrence = occurrenceFacts({ captures: emit.captures, handle });
  const falseEventId = emit.captures[0].event.event.id;
  await recordStep(state, { id: "deliver", target, counters,
    run: () => state.method(made.binding, "deliver", emit.captures[0].event, handle.transactionId, gate.invoke) });
  await recordStep(state, { id: "markNot", target, counters, refusalExpected: true,
    run: () => state.method(handle, "markNotCommitted"), extra: () => ({ handle: handleFacts(handle) }) });
  action(state, "markNotCommitted");
  await recordStep(state, { id: "markCancelled", target, counters, refusalExpected: true,
    run: () => state.method(handle, "markCancelled"), extra: () => ({ handle: handleFacts(handle) }) });
  action(state, "markCancelled");
  await recordStep(state, { id: "reemit", target, counters, refusalExpected: true,
    run: () => state.method(target.sdk, "mfaRemoved", { ...input, operation: handle }),
    extra: () => ({ handle: handleFacts(handle) }) });
  let correctiveHandle;
  const fresh = await recordStep(state, { id: "fresh", target, counters,
    run: () => {
      const result = state.method(target.sdk, "beginOperation", { boundEvent: "mfaRemoved",
        transactionId: handle.transactionId, correlationId: handle.correlationId });
      correctiveHandle = result.value;
      return result;
    } });
  fresh.handle = handleFacts(correctiveHandle);
  fresh.linkage = {
    operation_id_minted: correctiveHandle.operationId !== handle.operationId,
    transaction_id_reused: correctiveHandle.transactionId === handle.transactionId,
    correlation_id_reused: correctiveHandle.correlationId === handle.correlationId,
  };
  await recordStep(state, { id: "mark2", target, counters,
    run: () => state.method(correctiveHandle, "markNotCommitted"), extra: () => ({ handle: handleFacts(correctiveHandle) }) });
  action(state, "markNotCommitted");
  const corrective = await recordStep(state, { id: "corrective", target, counters,
    run: () => state.method(target.sdk, "mfaRemoved", { ...input, operation: correctiveHandle,
      retry: { retry_attempt: 1, original_event_id: falseEventId } }),
    extra: () => ({ handle: handleFacts(correctiveHandle) }) });
  corrective.occurrence = occurrenceFacts({ captures: corrective.captures, handle });
  corrective.links_false_occurrence = {
    original_event_id_equals_false_event: corrective.occurrence.original_event_id === falseEventId,
    transaction_id_matches_false_handle: corrective.occurrence.transaction_id_matches_handle,
    correlation_id_matches_false_handle: corrective.occurrence.correlation_id_matches_handle,
    operation_id_matches_false_handle: corrective.occurrence.operation_id_matches_handle,
  };
  await recordStep(state, { id: "reuse", target, counters, refusalExpected: true,
    run: () => state.method(target.sdk, "beginOperation", { operationId: handle.operationId }) });
  await deliverStep(state, { target, boundary: made.boundary, counters, binding: made.binding,
    handle, gate }, corrective.captures[0].event, "corrective-deliver");
  return caseSummary(state, entry, { seqStart, actual: counters(), steps: ["mark", "emit", "deliver", "markNot",
    "markCancelled", "reemit", "fresh", "mark2", "corrective", "reuse", "corrective-deliver"],
    orderNames: ["markCommitted", "sinkEmit", "probe", "markNotCommitted", "markCancelled", "gate", "exchange"] });
}

async function designedVariant(state, { commits, id, totals }) {
  const { input, target } = freshCase(state, "P-E-4b");
  const business = businessCounter();
  const gateScript = async () => {
    if (!commits) return "declined";
    business.commit(state);
    return "committed";
  };
  const made = delivery(state, { exchange: acknowledgingExchange(), durabilityProbe: TRUE_PROBE });
  const gate = commitGate(state, gateScript);
  const counters = counterSnapshot({ target, probe: made.probe, gate, boundary: made.boundary, business });
  const handle = state.method(target.sdk, "beginOperation", { boundEvent: "mfaRemoved" }).value;
  await recordStep(state, { id: `${id}/mark`, target, counters,
    run: () => state.method(handle, "markCommitted"), extra: () => ({ handle: handleFacts(handle) }) });
  action(state, "markCommitted");
  const emit = await emitStep(state, { input, target, handle, counters }, `${id}/emit`);
  await deliverStep(state, { target, boundary: made.boundary, counters, binding: made.binding, handle, gate },
    emit.captures[0].event, `${id}/deliver`);
  const final = counters();
  for (const key of Object.keys(totals)) totals[key] += final[key];
}

async function designedCase(state, entry) {
  const seqStart = state.sequence.length;
  const totals = { probe: 0, gate: 0, exchange: 0, sink: 0, business_commits: 0 };
  await designedVariant(state, { commits: true, id: "main", totals });
  await designedVariant(state, { commits: false, id: "declined", totals });
  return caseSummary(state, entry, { seqStart, actual: totals,
    steps: ["main/mark", "main/emit", "main/deliver", "declined/mark", "declined/emit", "declined/deliver"],
    orderNames: ["markCommitted", "sinkEmit", "probe", "gate", "commit", "exchange"] });
}

const RUNNERS = {
  "P-E-2": truthfulCase,
  "P-E-2b": truthfulCase,
  "P-E-3a": notCommittedCase,
  "P-E-3b": notCommittedCase,
  "P-E-4": untruthfulCase,
  "P-E-4b": designedCase,
};

export async function orderingCase(state, entry) {
  return RUNNERS[entry.case_id](state, entry);
}

export async function orderingWorkload(state, cases = ORDERING_CASES) {
  const rows = [];
  for (const entry of cases) {
    const row = await runCase(state, entry, () => orderingCase(state, entry));
    if (row !== null) rows.push(row);
  }
  state.accounting.push(...rows);
  return rows;
}
