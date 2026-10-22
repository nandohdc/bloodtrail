import { randomUUID } from "node:crypto";
import { baseInput, createInstance, emissions, minimalConfig, operations, publicCall } from "./workload.mjs";

export const IDENTIFIER_KEYS = ["eventId", "operationId", "correlationId", "causationId", "requestId", "messageId", "transactionId"];
const FIXED_EVENT = "00000000-0000-4000-8000-000000000001";
const NEGATIVE_ROWS = [
  ["a", (config) => { delete config.sink; }],
  ["b", (config) => { config.contractVersion = "2.0.0"; }],
  ["c", (config) => { config.producer = { name: "pids-producer" }; }],
  ["d", (config) => { config.service = {}; }],
  ["e", (config) => { delete config.environment; }],
  ["f", (config) => { config.identifiers = { eventId: () => "x" }; }],
];

export function identifierProvider({ state, mode }) {
  let sequence = 0;
  return Object.fromEntries(IDENTIFIER_KEYS.map((key) => [key, () => {
    state.ledger.take(`provider.${key}`);
    sequence += 1;
    if (mode === "random") return randomUUID();
    if (mode === "fixed-event" && key === "eventId") return FIXED_EVENT;
    if (mode === "fixed-correlation" && key !== "eventId") return `pids-constant-${key}`;
    if (key === "eventId") return randomUUID();
    return `pids-ctl-${key}-${sequence}`;
  }]));
}

function configurationCall({ state, factory, row, modify }) {
  const sink = publicCall({ state, label: "createCapturingAuditSink", invoke: () => state.testing.createCapturingAuditSink() }).value;
  const config = minimalConfig({ sink });
  modify(config);
  const result = publicCall({ state, label: `${factory}:${row}`, continueOnRefusal: true, invoke: () => state.factories[factory](config), refusalExpected: row !== "positive" });
  if (row === "positive" && result.passed) {
    state.recorder.outcomes.at(-1).raw = { state: result.value.state, frozen: Object.isFrozen(result.value) };
  }
  return result;
}

export function setupGate({ state }) {
  for (const factory of Object.keys(state.factories)) {
    const positive = configurationCall({ state, factory, row: "positive", modify: () => {} });
    if (!positive.passed) {
      state.invalidations.push("P-ids-00 positive construction refused; stop immediately");
      return;
    }
    for (const [row, modify] of NEGATIVE_ROWS) configurationCall({ state, factory, row, modify });
  }
}

export async function twoInstance({ state }) {
  state.direct.push(publicCall({ state, label: "systemAuditIdentifiers.eventId", invoke: () => state.core.systemAuditIdentifiers.eventId() }).value);
  const input = baseInput({ state });
  for (let index = 0; index < 2; index += 1) {
    const instance = createInstance({ state });
    await emissions({ state, sdk: instance.value, input, count: 1 });
  }
}

export async function collisionControls({ state }) {
  const input = baseInput({ state });
  const identifiers = identifierProvider({ state, mode: "fixed-event" });
  const first = createInstance({ state, identifiers, omitIdentifiers: false }).value;
  await emissions({ state, sdk: first, input, count: 2, refusalAt: 1 });
  const second = createInstance({ state, identifiers, omitIdentifiers: false }).value;
  await emissions({ state, sdk: second, input, count: 1 });
  operations({ state, sdk: first, count: 2, input: { operationId: "pids-op-fixed-1" }, refusalAt: 1 });
  const third = createInstance({ state, identifiers: identifierProvider({ state, mode: "fixed-correlation" }), omitIdentifiers: false }).value;
  await emissions({ state, sdk: third, input, count: 2 });
}
