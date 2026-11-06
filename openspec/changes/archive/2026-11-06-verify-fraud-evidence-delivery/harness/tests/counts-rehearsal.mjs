// In-process roles retain the real roleChannel, roleExchange, exchangeUnit and gatedSession.
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { pathToFileURL } from "node:url";
import { Worker } from "node:worker_threads";
import { roleChannel } from "../lib/launcher.mjs";
import { jsonFile } from "../lib/io.mjs";
import { countsSession } from "../counts/session.mjs";
import { senderRun, awaitProcessMessage } from "../counts/sender-phases.mjs";
import { countsCore, fakeCountsNode, recordedCall, testSenderSdk } from "./counts-fakes.mjs";

export const FROZEN = jsonFile(new URL("../expectations/counts.v1.json", import.meta.url));
export const cloneIpc = (message) => JSON.parse(JSON.stringify(message));
const grant = () => ({ holds: true, planted_refused: true, null_control_allowed: true });

export function mockControls() {
  return {
    loopback_guard: { holds: true, planted: { refused: true, fired: true }, null_control: { connected: true, silent: true } },
    write_outside_grant: grant(), synthetic_data: { holds: true, planted_refused: true, null_control_passed: true },
  };
}

function childPair(transform, receive = (message) => message) {
  const child = new EventEmitter();
  const proc = new EventEmitter();
  let closed = false;
  const close = (code, signal) => {
    if (closed) return;
    closed = true;
    setImmediate(() => { child.emit("exit", code, signal); child.emit("close", code, signal); });
  };
  proc.send = (message, callback) => {
    if (closed) return;
    child.emit("message", cloneIpc(transform(message)));
    if (callback) callback();
  };
  proc.exit = (code) => close(code, null);
  child.send = (message) => {
    const cloned = cloneIpc(receive(message));
    setImmediate(() => { if (!closed) proc.emit("message", cloned); });
  };
  return { child, proc, close };
}

function packageUrls(service) {
  const urls = {};
  for (const name of ["core", "node", "collector"]) {
    const path = join(service, `${name}.mjs`);
    writeFileSync(path, "export {};\n");
    urls[name] = pathToFileURL(path).href;
  }
  return urls;
}

function senderDeps({ proc, urls, options }) {
  const core = countsCore();
  if (options.plainContext) coreOverride(core, options);
  return {
    core: options.core ?? core, sdkNode: fakeCountsNode(), senderSdk: options.senderSdk ?? testSenderSdk, recordedCall,
    senderControls: async () => mockControls(), guardViolations: () => [{ host: "192.0.2.1", stage: "before_connect" }],
    resolved: () => ({ core: urls.core, node: urls.node }), send: (message) => proc.send(message),
    awaitMessage: (type) => awaitProcessMessage(proc, type), onBeforeRun: () => {},
  };
}

function coreOverride(core, options) {
  options.core = { ...core, authenticatedHumanActor: (input) => ({ ...core.authenticatedHumanActor(input) }) };
}

function senderChild({ urls, options }) {
  const pair = childPair(options.transformSender ?? ((value) => value));
  const deps = senderDeps({ proc: pair.proc, urls, options });
  pair.proc.on("message", (message) => {
    if (message.type === "start") senderRun({ deps, message }).then(
      (report) => pair.proc.send(report), (error) => pair.proc.send({ type: "error", message: error.message }),
    );
    if (message.type === "stop") pair.proc.send({ type: "stopped" }, () => pair.proc.exit(0));
  });
  pair.child.kill = (signal) => pair.close(null, signal);
  return pair.child;
}

function ingressChild({ urls, options }) {
  const child = new EventEmitter();
  const worker = options.ingressWorkerFactory
    ? options.ingressWorkerFactory({ collector: urls.collector })
    : new Worker(new URL("./counts-ingress-worker.mjs", import.meta.url), { workerData: { collector: urls.collector } });
  let killed = false;
  worker.on("message", (message) => child.emit("message", cloneIpc((options.transformIngress ?? ((value) => value))(message))));
  worker.on("error", (error) => child.emit("message", { type: "error", message: error.message }));
  worker.on("messageerror", (error) => child.emit("message", { type: "error", message: error.message }));
  worker.on("exit", (code) => {
    const signal = killed ? "SIGKILL" : null;
    child.emit("exit", killed ? null : code, signal);
    child.emit("close", killed ? null : code, signal);
  });
  child.send = (message) => worker.postMessage(cloneIpc((options.transformIngressInput ?? ((value) => value))(message)));
  child.kill = () => { killed = true; void worker.terminate().catch((error) => child.emit("message", { type: "error", message: error.message })); };
  queueMicrotask(() => {
    try {
      options.onIngressWorker?.(worker);
    } catch (error) {
      child.emit("message", { type: "error", message: error.message });
      child.kill();
    }
  });
  return child;
}

export async function rehearsal({ expectations = FROZEN, ...options } = {}) {
  const root = mkdtempSync(join(tmpdir(), "counts-rehearsal-"));
  const service = join(root, "service");
  const storage = join(root, "storage");
  let failure;
  try {
    mkdirSync(service);
    mkdirSync(storage);
    const urls = packageUrls(service);
    return await countsSession({
      service, storage, flags: { sender: [], ingress: [] }, expectations,
      read: options.read, exchange: options.exchange, evaluate: options.evaluate,
      spawn: ({ role }) => {
        if (options.onSpawn) options.onSpawn(role);
        const child = role === "sender" ? senderChild({ urls, options }) : ingressChild({ urls, options });
        return { ...roleChannel(child), stderr: () => "" };
      },
    });
  } catch (error) {
    failure = error;
    if (failure.role_closure_confirmed === false) failure.rehearsal_scratch = root;
    throw failure;
  } finally {
    if (failure?.role_closure_confirmed !== false) rmSync(root, { recursive: true, force: true });
  }
}
