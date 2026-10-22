// Only synthetic public-shape doubles. This is not an SDK implementation or probe.
import { occurrenceLedger } from "../lib/ledger.mjs";
import { callRecorder } from "../lib/observe.mjs";

let sequence = 100;
const next = () => `00000000-0000-4000-8000-${String(++sequence).padStart(12, "0")}`;
const accepted = () => ({ ok: true, value: { status: "accepted" } });
const refused = (path) => ({ ok: false, error: { code: "SDK_INVALID_IDENTIFIER", category: "validation", path } });
const CONFIGURATION = [
  ["/sink", (config) => !config.sink],
  ["/producer/version", (config) => !config.producer.version],
  ["/service/name", (config) => !config.service.name],
  ["/environment", (config) => !config.environment],
  ["/identifiers/operationId", (config) => config.identifiers && !config.identifiers.operationId],
];

function factory(config) {
  let code = "SDK_INVALID_CONFIGURATION";
  let path;
  if (config.contractVersion !== "2.1.0") {
    code = "SDK_UNSUPPORTED_CONTRACT_VERSION";
    path = "/contractVersion";
  } else {
    const row = CONFIGURATION.find(([, check]) => check(config));
    if (row) path = row[0];
  }
  if (path) throw Object.assign(new Error("synthetic refusal"), { code, category: "configuration", path });
  return fixtureSdk(config);
}

function containProvider({ invoke, path }) {
  try {
    return invoke();
  } catch {
    return refused(path);
  }
}

function fixtureSdk(config) {
  const identifiers = config.identifiers || { eventId: next, operationId: next, transactionId: next, correlationId: next };
  const seenEvents = new Set();
  const seenOperations = new Set();
  return Object.freeze({
    state: "ready",
    async authenticationFailed(input) {
      return containProvider({ path: "/event/id", invoke: () => {
        const id = identifiers.eventId();
        const operation_id = identifiers.operationId();
        const correlation_id = identifiers.correlationId();
        if (seenEvents.has(id)) return refused("/event/id");
        seenEvents.add(id);
        config.sink.events.push({ event: { id, timestamp: "synthetic-time", observed_at: "synthetic-time" }, correlation: { operation_id, correlation_id }, request: input.request });
        return accepted();
      } });
    },
    beginOperation(input = {}) {
      return containProvider({ path: "/operation/operation_id", invoke: () => {
        const operationId = input.operationId || identifiers.operationId();
        const transactionId = identifiers.transactionId();
        const correlationId = identifiers.correlationId();
        if (seenOperations.has(operationId)) return refused("/operation/operation_id");
        seenOperations.add(operationId);
        return { ok: true, value: { operationId, transactionId, correlationId } };
      } });
    },
  });
}

export function fixtureState({ role, budget }) {
  const ledger = occurrenceLedger({ budget });
  const core = {
    createSecurityAuditSdk: factory,
    anonymousActor: (value) => value,
    authoritativeTenant: (value) => value,
    authenticationEvidence: (value) => value,
    observedSource: (value) => value,
    systemAuditIdentifiers: { eventId: next },
  };
  return {
    role, core, node: { createNodeSecurityAuditSdk: factory }, ledger, recorder: callRecorder({ ledger }),
    testing: {
      createCapturingAuditSink: () => ({ events: [] }),
      inspectSdkRetentionForTesting: () => ({ generatedEventIds: { size: 100, capacity: 4096 }, issuedOperationIds: { size: 0, capacity: 4096 } }),
    },
    factories: { core: factory, node: factory },
    sinks: [], handles: [], direct: [], invalidations: [], retention: null,
  };
}
