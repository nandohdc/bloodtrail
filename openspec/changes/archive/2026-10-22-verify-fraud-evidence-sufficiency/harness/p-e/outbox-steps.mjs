import { action, instance } from "./runtime.mjs";
import { mfaInput } from "./inputs.mjs";
import { counterSnapshot, handleFacts, occurrenceFacts, recordStep } from "./case-steps.mjs";
import { hostSink } from "./sink.mjs";
import { sha256 } from "../lib/io.mjs";
import { emissionFacts } from "./outbox-input-facts.mjs";

// Boundary 2 is the host-owned sink, not a capturing-sink substitute. The
// runtime also retains public captures; neither observer reads SDK authority.
export function outboxSetup(state, { host, caseId, prefix = "", sinkOptions = {} }) {
  state.current = caseId;
  const input = mfaInput(state);
  const sink = hostSink({ host, ...sinkOptions });
  const target = instance(state, { sink });
  const business = { get commits() { return host.order.filter(isCommit).length; } };
  const counters = counterSnapshot({ target, business });
  const handle = state.method(target.sdk, "beginOperation", { boundEvent: "mfaRemoved" }).value;
  return { host, input, sink, target, business, counters, handle, prefix };
}

function isCommit(entry) {
  return entry.op === "commit";
}

export function beginHostTransaction(state, setup) {
  setup.host.begin();
  action(state, "begin");
  setup.host.insertBusiness({ id: "pe-change-0001" });
  action(state, "businessInsert");
}

export function finishHostTransaction(state, setup, method) {
  setup.host[method]();
  action(state, method);
}

export async function outboxTransition(state, setup, { id, method, refusalExpected = false }) {
  return recordStep(state, { id: setup.prefix + id, target: setup.target, counters: setup.counters, refusalExpected,
    run: () => {
      const result = state.method(setup.handle, method);
      action(state, method);
      return result;
    }, extra: () => ({ handle: handleFacts(setup.handle) }) });
}

export async function outboxEmit(state, setup, options = {}) {
  const { id = "emit", refusalExpected = false, input = {}, method = "mfaRemoved", terminal = noTerminal } = options;
  const before = setup.sink.records.length;
  const immediate = {};
  const record = await recordStep(state, { id: setup.prefix + id, target: setup.target, counters: setup.counters, refusalExpected,
    run: () => {
      const argument = method === "redeliver" ? input : { ...setup.input, operation: setup.handle, ...input };
      immediate.input = emissionFacts({ method, argument });
      const pending = state.method(setup.target.sdk, method, argument);
      // MUST remain immediately after the public call, before ANY await.
      immediate.sink_ran_before_await = setup.sink.counts.entries > before;
      immediate.inserts_before_await = setup.sink.counts.inserts;
      return settleAfterTerminal(pending, terminal);
    }, extra: () => ({ handle: handleFacts(setup.handle), ...immediate,
      transaction_open_after_await: setup.host.isTransaction, database: hostFacts(setup),
      host_sink: structuredClone(setup.sink.records.slice(before)) }) });
  record.occurrence = occurrenceFacts({ captures: record.captures, handle: setup.handle });
  return record;
}

function noTerminal() {}

// terminal executes synchronously, BEFORE the first await. Even a host action
// failure cannot let finally cleanup close the DB while an insert is pending.
async function settleAfterTerminal(pending, terminal) {
  try { terminal(); }
  finally { await pending; }
  return pending;
}

function outboxRowFacts(setup, row) {
  const parsed = JSON.parse(row.body);
  const capture = setup.sink.captures.find((entry) => entry.event.event.id === row.event_id);
  return {
    event_id_matches_body: row.event_id === parsed.event.id,
    transaction_id_matches_body: row.transaction_id === parsed.correlation.transaction_id,
    transaction_id_matches_handle: row.transaction_id === setup.handle.transactionId,
    operation_id_matches_handle: parsed.correlation.operation_id === setup.handle.operationId,
    correlation_id_matches_handle: parsed.correlation.correlation_id === setup.handle.correlationId,
    body_matches_capture: capture !== undefined && row.body === JSON.stringify(capture.event),
    commit_state: parsed.event.commit_state,
    body_sha256: sha256(Buffer.from(row.body)),
  };
}

export function hostFacts(setup) {
  const rows = setup.host.outboxRows();
  return { is_transaction: setup.host.isTransaction, counts: setup.host.counts(),
    business_ids: setup.host.businessIds(), outbox_rows: rows,
    row_facts: rows.map((row) => outboxRowFacts(setup, row)) };
}

export async function outboxSnapshot(state, setup) {
  return recordStep(state, { id: setup.prefix + "snapshot", target: setup.target, counters: setup.counters,
    run: () => state.method(setup.handle, "snapshot"),
    extra: () => ({ handle: handleFacts(setup.handle), database: hostFacts(setup) }) });
}
