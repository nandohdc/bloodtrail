// Ingress role handlers for the Stage 2 chains probe (#840, Q207, Q210, Q215).
// Pure module without kit imports; receives collector, resolved mapping, and controls producer.
import { join } from "node:path";
import { faultInjector } from "../lib/faults.mjs";
import { readBack, startIngress } from "../lib/ingress.mjs";
import { requireControls } from "../lib/controls.mjs";
import { defaultControlsProducer } from "../copies/ingress-role.mjs";

export { defaultControlsProducer };

function shouldCloseServer(state) {
  return !state.quiescent && Boolean(state.server);
}

function hasStorageDirectory(without_storage, directory) {
  return !without_storage && Boolean(directory);
}

function isAdmittedStatus(status) {
  return status === 202;
}

function parseStoredBody(body) {
  if (typeof body === "string") {
    return JSON.parse(body);
  }
  return body;
}

function isAdmittedRecord(record) {
  return isAdmittedStatus(record.status) && Boolean(record.event_id);
}

function collectAdmittedEventIds(records) {
  const admitted = new Set();
  if (!records) return admitted;
  for (const record of records) {
    if (isAdmittedRecord(record)) {
      admitted.add(record.event_id);
    }
  }
  return admitted;
}

function extractStoredBody(found) {
  if (!found) return null;
  if (found.kind !== "found") return null;
  if (!found.record) return null;
  if (!found.record.body) return null;
  return parseStoredBody(found.record.body);
}

function hasServerLookups(state) {
  if (!state.server) return false;
  if (!state.server.state) return false;
  return Boolean(state.server.state.lookups);
}

function readLookupBody({ lookup, storage, admittedIds, seen }) {
  const { eventId, scope } = lookup;
  if (!admittedIds.has(eventId)) return null;
  if (seen.has(eventId)) return null;
  seen.add(eventId);
  const found = storage.get(scope, eventId);
  return extractStoredBody(found);
}

function readPersistedBodies({ state, storage }) {
  if (!storage || !hasServerLookups(state)) return [];
  const records = state.server.state.records;
  const admittedIds = collectAdmittedEventIds(records);
  const bodies = [];
  const seen = new Set();
  for (const lookup of state.server.state.lookups.values()) {
    const body = readLookupBody({ lookup, storage, admittedIds, seen });
    if (body !== null) {
      bodies.push(body);
    }
  }
  return bodies;
}

export function createIngressHandlers({ collector, resolved, controlsFor }) {
  if (!resolved) {
    throw new TypeError("resolved is required");
  }
  if (typeof controlsFor !== "function") {
    throw new TypeError("controlsFor is required");
  }

  const state = {
    server: null,
    storage: null,
    quiescent: false,
    directory: null,
    token: null,
    owners: null,
  };

  async function start({ token, fault_plan: faultPlan, storage_directory: directory, owners, without_storage = false }) {
    state.directory = directory;
    state.token = token;
    state.owners = owners;
    const effectiveControls = requireControls(controlsFor(directory));
    if (hasStorageDirectory(without_storage, directory)) {
      state.storage = new collector.SqliteStorage({ location: join(directory, "collector.db") });
    } else {
      state.storage = null;
    }
    const ingressOptions = {
      authenticator: new collector.SyntheticFixtureAuthenticator([token]),
      ...(state.storage ? { storage: { port: state.storage, owners } } : {}),
    };
    state.ingress = new collector.CollectorIngress(ingressOptions);
    state.server = await startIngress({ collector, ingress: state.ingress, faults: faultInjector(faultPlan) });
    return {
      type: "ready",
      port: state.server.port,
      controls: effectiveControls,
      resolved,
    };
  }

  function report() {
    const records = state.server?.state.records ?? [];
    const serverState = state.server?.state ?? { lookups: new Map() };
    return {
      type: "read_back",
      records,
      read_back: readBack({ state: serverState, storage: state.storage }),
    };
  }

  async function stop() {
    let firstError = null;
    try {
      if (shouldCloseServer(state)) {
        await state.server.close();
      }
    } catch (error) {
      firstError = error;
    } finally {
      try {
        if (state.storage) {
          await state.storage.close();
        }
      } catch (error) {
        firstError = firstError ?? error;
      }
    }
    if (firstError) {
      return { type: "error", message: firstError.message };
    }
    return { type: "stopped" };
  }

  async function finalize() {
    await state.server.quiesce();
    state.quiescent = true;
    const persisted_bodies = readPersistedBodies({ state, storage: state.storage });
    return { ...report(), persisted_bodies, quiescent: true };
  }

  return { start, read_back: async () => report(), finalize, stop };
}

function onIngressReplySent(reply, proc) {
  if (reply.type === "stopped") {
    proc.exit(0);
  }
}

function handleIngressMessage(handlers, message, proc) {
  const handler = handlers[message.type];
  if (!handler) return;
  handler(message).then(
    (reply) => proc.send(reply, () => onIngressReplySent(reply, proc)),
    (error) => proc.send({ type: "error", message: error.message }),
  );
}

export function bindIngressProcess({ collector, resolved, controlsFor, proc = process }) {
  const handlers = createIngressHandlers({ collector, resolved, controlsFor });
  proc.on("message", (message) => handleIngressMessage(handlers, message, proc));
  return handlers;
}
