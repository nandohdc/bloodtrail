// Ingress role handlers for the Stage 2 copies probe (#839, Q142, Q158, Q168, Q169, Q175).
// Pure module without kit imports; receives collector and resolved mapping.
import { join } from "node:path";
import { faultInjector } from "../lib/faults.mjs";
import { startIngress } from "../lib/ingress.mjs";
import { requireControls, writeControls } from "../lib/controls.mjs";
import { reportReadBack, restartIngress } from "./restart.mjs";

export function defaultControlsProducer(directory) {
  return {
    write_outside_grant: writeControls({
      refusedPath: join(process.cwd(), "planted-write"),
      allowedPath: join(directory, "null-control-write"),
    }),
  };
}

function shouldCloseServer(state) {
  return !state.quiescent && Boolean(state.server);
}

function hasStorageDirectory(without_storage, directory) {
  return !without_storage && Boolean(directory);
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

  async function restart() {
    await restartIngress({ state, collector });
    return { type: "restarted", port: state.server.port };
  }

  function report() {
    return reportReadBack({ state, storage: state.storage });
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
    return { ...report(), quiescent: true };
  }

  return { start, restart, read_back: async () => report(), finalize, stop };
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
