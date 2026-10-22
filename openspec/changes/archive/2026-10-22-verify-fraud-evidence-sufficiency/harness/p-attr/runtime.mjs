import { captureOrigins } from "./origins.mjs";
import { counted } from "../lib/counted.mjs";
import { returned, thrown } from "../lib/observe.mjs";

// Shared lib/counted wrapper with the P-attr call shape: raw public results
// are retained (opaque returns are replaced later by callSnapshot), and the
// sticky ledger is re-asserted after every top-level invocation so provider
// containment can never swallow exhaustion.
export function createState({ core, node, testing, ledger }) {
  const state = { core, node, testing, ledger, current: "setup", calls: [], records: [], invalidations: [] };
  // Out-of-band ordinals preserve the serialized public-call shape. An outer
  // rejection overwrites a nested callback's attribution for the same error.
  const failures = new Map();
  const outcomes = new Map();
  const invoke = counted({ ledger, calls: state.calls, keepRaw: true, assertAfter: true,
    onThrow: (error, { ordinal }) => failures.set(error, ordinal),
    projectOutcome: ({ outcome, ordinal }) => {
      outcomes.set(ordinal, outcome);
      return outcome;
    },
  });
  state.thrownCall = (error) => outcomes.get(failures.get(error));
  state.call = (label, fn) => invoke({ label: `${state.current}:${label}`, fn });
  state.c = (name, ...args) => state.call(name, () => core[name](...args));
  state.method = (owner, name, ...args) => state.call(name, () => owner[name](...args));
  return state;
}

export { counted };

export function instance(state, extra = {}) {
  const sink = state.call("createCapturingAuditSink", () => state.testing.createCapturingAuditSink());
  const config = {
    contractVersion: state.core.CONTRACT_VERSION,
    producer: { name: "p-attr-probe", version: "0.0.0" },
    service: { name: "p-attr-probe", version: "0.0.0" },
    environment: { name: "synthetic" }, ...extra, sink,
  };
  const sdk = state.call("createNodeSecurityAuditSdk", () => state.node.createNodeSecurityAuditSdk(config));
  return { sdk, sink };
}

async function outcome({ state, target, method, input }) {
  try { return returned({ raw: await state.method(target.sdk, method, input) }); }
  catch (error) {
    state.ledger.assertAvailable();
    return thrown({ error });
  }
}

export async function named(state, { target, method, input, origins, id = "main" }) {
  const before = target.sink.events.length;
  const observed = await outcome({ state, target, method, input });
  state.ledger.assertAvailable();
  const captures = target.sink.events.slice(before);
  const events = captures.map((event) => structuredClone(event));
  const record = {
    step_id: `${state.current}/${id}`, ...observed, sink_count: captures.length,
    frozen: captures.map(Object.isFrozen), events,
    origins: structuredClone(origins),
    captured_origins: events.map((event) => captureOrigins({ event, origins })),
  };
  state.records.push(record);
  return record;
}
