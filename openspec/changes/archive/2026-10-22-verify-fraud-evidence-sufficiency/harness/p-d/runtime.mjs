import { counted } from "../lib/counted.mjs";

// Implementer default: property reads are not extra calls; reflection invocations are.

export function createState({ core, node, testing, ledger }) {
  const state = { core, node, testing, ledger, records: [], invalidations: [], instances: [], current: "setup", calls: [], publicErrors: new Set() };
  state.invoke = counted({ ledger, calls: state.calls, onThrow: (error) => state.publicErrors.add(error), stepIds: true, keepRaw: false });
  state.call = (label, fn) => state.invoke({ label: `${state.current}:${label}`, fn });
  state.c = (name, ...args) => state.call(name, () => core[name](...args));
  state.method = (owner, name, ...args) => state.call(name, () => owner[name](...args));
  return state;
}

export function instance(state, extra = {}) {
  const sink = state.call("createCapturingAuditSink", () => state.testing.createCapturingAuditSink());
  const config = {
    contractVersion: state.core.CONTRACT_VERSION, producer: { name: "pd-probe", version: "0.0.0" },
    service: { name: "pd-probe", version: "0.0.0" }, environment: { name: "synthetic" }, sink, ...extra,
  };
  const sdk = state.call("createNodeSecurityAuditSdk", () => state.node.createNodeSecurityAuditSdk(config));
  const value = { sdk, sink, config };
  state.instances.push(value);
  return value;
}

export class SetupRefusal extends Error {
  constructor(result) { super("public setup call refused"); this.result = result; }
}

export function thrownOutcome({ error, state }) {
  if (error instanceof SetupRefusal) return returnedOutcome(error.result);
  if (error instanceof state.core.SecurityAuditSdkError) {
    return { surface: "thrown-sdk", diagnostic: Object.fromEntries(Object.entries(error).filter(([key]) => key !== "name")), json: state.method(error, "toJSON"), name: error.name, message: error.message };
  }
  return { surface: "raw-throw", name: error.constructor.name, message: error.message };
}

function returnedOutcome(raw) {
  if (raw?.ok === false) return { surface: "returned-refusal", diagnostic: raw.error };
  return { surface: "accepted", raw };
}

export async function step(state, id, target, fn, facts = () => ({})) {
  const before = target.sink.events.length;
  state.activeStep = `${state.current}/${id}`;
  let outcome;
  try { outcome = returnedOutcome(await fn()); }
  catch (error) { state.ledger.assertAvailable(); outcome = thrownOutcome({ error, state }); }
  state.ledger.assertAvailable();
  const events = target.sink.events.slice(before);
  const record = {
    step_id: `${state.current}/${id}`, ...outcome, sink_count: events.length,
    frozen: events.map((event) => Object.isFrozen(event)), events,
    facts: facts(), value_frozen: Object.isFrozen(outcome.raw?.value),
  };
  state.records.push(record);
  state.activeStep = null;
  return record;
}

export function named(state, { id = "main", target, input, method = "authenticationFailed", facts }) {
  return step(state, id, target, () => state.method(target.sdk, method, input), facts);
}

export function operation(state, target, input = {}) {
  const result = state.method(target.sdk, "beginOperation", input);
  if (!result.ok) throw new SetupRefusal(result);
  return result.value;
}

export function commit(state, handle) {
  return state.method(handle, "markCommitted");
}

export const jsonClone = (value) => JSON.parse(JSON.stringify(value));
export const spreadClone = (value) => ({ ...value });
