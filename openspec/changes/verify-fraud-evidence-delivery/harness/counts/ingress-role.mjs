// Reuse the copies ingress's restart/fault/storage mechanics; instrument persisted storage read-backs.
import { performance } from "node:perf_hooks";
import { storageScopeOf } from "../lib/ingress.mjs";
import { createIngressHandlers as copiesHandlers, defaultControlsProducer } from "../copies/ingress-role.mjs";
import { environmentLabel } from "./environment.mjs";

export { defaultControlsProducer };

function isPersistedResult(result) {
  if (result.kind === "persisted") return true;
  return result.kind === "duplicate" && result.acknowledgment === "persisted";
}

function recordStored({ options, submission, result, state }) {
  if (!isPersistedResult(result)) return;
  const input = JSON.parse(submission.body);
  const found = options.storage.port.get(storageScopeOf(input.tenant), input.event.id);
  if (found.kind !== "found") throw new Error("persisted acknowledgment without readable storage");
  state.raw.push(JSON.parse(found.record.body));
}

function instrumentCollector(collector, state) {
  return {
    ...collector,
    CollectorIngress: class extends collector.CollectorIngress {
      constructor(options) {
        super(options);
        this.countsOptions = options;
      }
      submit(submission) {
        const result = super.submit(submission);
        recordStored({ options: this.countsOptions, submission, result, state });
        return result;
      }
    },
  };
}

export function createIngressHandlers({ collector, resolved, controlsFor }) {
  const state = { raw: [], started: performance.now() };
  const handlers = copiesHandlers({ collector: instrumentCollector(collector, state), resolved, controlsFor });
  async function finalize() {
    const report = await handlers.finalize();
    const ingressWindowMs = performance.now() - state.started;
    const distinct = new Map(state.raw.map((body) => [body.event.id, body]));
    return {
      ...report, raw_persisted_bodies: state.raw, persisted_bodies: [...distinct.values()],
      observation: {
        measured_at: "collector", environment: environmentLabel(), ingress_window_ms: ingressWindowMs,
        persisted_events_per_second: distinct.size / (ingressWindowMs / 1000),
      },
    };
  }
  return { ...handlers, finalize };
}

export function bindIngressProcess({ proc, ...options }) {
  const handlers = createIngressHandlers(options);
  proc.on("message", (message) => dispatch({ handlers, proc, message }));
  return handlers;
}

function dispatch({ handlers, proc, message }) {
  const handler = handlers[message.type];
  if (!handler) return;
  handler(message).then(
    (reply) => proc.send(reply, () => { if (reply.type === "stopped") proc.exit(0); }),
    (error) => proc.send({ type: "error", message: error.message }),
  );
}
