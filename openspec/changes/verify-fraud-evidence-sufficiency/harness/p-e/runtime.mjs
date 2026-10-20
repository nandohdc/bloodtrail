import { counted } from "../lib/counted.mjs";
import { returned, thrown } from "../lib/observe.mjs";
import { bindingOutcome, callOutcome, publicSnapshot } from "./snapshot.mjs";

// G-log implementer default: Node factory. All modules are injected; this
// module loads no package. Every direct call/callback counts before invocation.
export function createState({ core, node, testing, ledger }) {
  const state = { core, node, testing, ledger, current: "setup", calls: [], records: [],
    invalidations: [], sequence: [], accounting: [], case_aborts: [] };
  const invoke = counted({ ledger, calls: state.calls, assertAfter: true, projectOutcome: callOutcome });
  state.call = (label, fn) => invoke({ label: `${state.current}:${label}`, fn });
  state.c = (name, ...args) => state.call(name, () => core[name](...args));
  state.method = (owner, name, ...args) => state.call(name, () => owner[name](...args));
  return state;
}

export function action(state, name) {
  state.sequence.push({ ordinal: state.sequence.length + 1, name, at_ms: performance.now() });
}

export function callback(state, { name, invoke }) {
  const counts = { calls: 0 };
  return { counts, invoke: (...args) => state.call(`${name}.callback`, () => {
    counts.calls += 1;
    action(state, name);
    return invoke(...args);
  }) };
}

export function observeSink(state, sink) {
  const captures = [];
  const countedSink = callback(state, { name: "sinkEmit", invoke: (event) => {
    captures.push({ frozen: Object.isFrozen(event), event: structuredClone(event) });
    return sink.emit(event);
  } });
  return { captures, counts: countedSink.counts, sink: { emit: countedSink.invoke } };
}

export function instance(state, { sink, ...extra } = {}) {
  const actual = sink === undefined ? state.call("createCapturingAuditSink", () => state.testing.createCapturingAuditSink()) : sink;
  const observed = observeSink(state, actual);
  const config = { contractVersion: state.core.CONTRACT_VERSION,
    producer: { name: "pe-synthetic-producer", version: "0.0.0" },
    service: { name: "pe-synthetic-service", version: "0.0.0" },
    environment: { name: "synthetic" }, ...extra, sink: observed.sink };
  const sdk = state.call("createNodeSecurityAuditSdk", () => state.node.createNodeSecurityAuditSdk(config));
  return { sdk, ...observed };
}

async function outcome(state, { run, refusalExpected }) {
  try { return returned({ raw: await run(), refusalExpected }); }
  catch (error) {
    state.ledger.assertAvailable();
    return thrown({ error });
  }
}

// Implementer default: a returned binding refusal is distinct from a throw;
// failed_closed remains a returned result with its full public shape intact.
export async function step(state, { id, run, target = { captures: [] }, refusalExpected = false }) {
  const before = target.captures.length;
  const observed = bindingOutcome(await outcome(state, { run, refusalExpected }));
  state.ledger.assertAvailable();
  const record = { step_id: `${state.current}/${id}`, ...observed,
    raw: publicSnapshot({ label: id, value: observed.raw }),
    captures: structuredClone(target.captures.slice(before)), result_frozen: Object.isFrozen(observed.raw) };
  state.records.push(record);
  return record;
}

export function observations(state) {
  return structuredClone({ records: state.records, public_calls: state.calls, sequence: state.sequence,
    invalidations: state.invalidations, accounting: state.accounting, ledger: state.ledger.report() });
}
