// Test support: fake roles and rehearsal environment for copies probe (#839, Q180, Q182, Q183, Q185).
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { roleChannel } from "../lib/launcher.mjs";
import { jsonFile } from "../lib/io.mjs";
import { bindIngressProcess } from "../copies/ingress-role.mjs";
import { awaitProcessMessage, senderRun } from "../copies/sender-phases.mjs";
import { copiesSession } from "../copies/session.mjs";
import { makeRestartCollector } from "./collector-fixture.mjs";
import { fakeCore, fakeSdkNode, recordedCall, testSenderSdk } from "./copies-fake-sdk.mjs";

const FROZEN_V2 = jsonFile(new URL("../expectations/copies.v2.json", import.meta.url));

export function serializeIpcMessage(message) {
  return JSON.parse(JSON.stringify(message));
}

function mockSenderControls() {
  return {
    loopback_guard: { holds: true },
    write_outside_grant: { holds: true },
    synthetic_data: { holds: true },
  };
}

function createStubPackages(service) {
  const pkgs = [
    "@bloodtrail/security-audit-collector",
    "@bloodtrail/security-audit-sdk-core",
    "@bloodtrail/security-audit-sdk-node",
  ];
  for (const pkg of pkgs) {
    const dir = join(service, "node_modules", pkg);
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "index.js"), "export {};\n");
  }
}

function makeFakeIngressChild({ service, fakeCollector }) {
  const collectorUrl = pathToFileURL(join(service, "node_modules/@bloodtrail/security-audit-collector/index.js")).href;
  const child = new EventEmitter();
  let closed = false;

  const proc = new EventEmitter();
  proc.send = (message, callback) => {
    if (closed) return;
    const cloned = serializeIpcMessage(message);
    child.emit("message", cloned);
    if (typeof callback === "function") {
      callback();
    }
  };
  proc.exit = (code = 0) => {
    if (closed) return;
    closed = true;
    setImmediate(() => {
      child.emit("exit", code, null);
      child.emit("close", code, null);
    });
  };

  const handlers = bindIngressProcess({
    collector: fakeCollector,
    resolved: { collector: collectorUrl },
    controlsFor: () => ({ write_outside_grant: { holds: true } }),
    proc,
  });

  child.send = (message) => {
    if (closed) return;
    const cloned = serializeIpcMessage(message);
    setImmediate(() => {
      proc.emit("message", cloned);
    });
  };

  child.kill = (signal) => {
    if (closed) return;
    closed = true;
    const doClose = () => {
      setImmediate(() => {
        child.emit("exit", null, signal ?? "SIGKILL");
        child.emit("close", null, signal ?? "SIGKILL");
      });
    };
    Promise.resolve(handlers.stop()).finally(doClose);
  };

  return child;
}

function buildCorruptedHandoffNode(baseNode) {
  return {
    ...baseNode,
    createHttpDeliveryHandoff(handoffOptions) {
      const realHandoff = baseNode.createHttpDeliveryHandoff(handoffOptions);
      return {
        async handoff(event, attempt = 0) {
          if (event.source?.observed?.port === 8443) {
            const corrupted = structuredClone(event);
            delete corrupted.actor;
            return realHandoff.handoff(corrupted, attempt);
          }
          return realHandoff.handoff(event, attempt);
        },
      };
    },
  };
}

async function handleSenderStart(message, service, options, proc) {
  const coreUrl = pathToFileURL(join(service, "node_modules/@bloodtrail/security-audit-sdk-core/index.js")).href;
  const nodeUrl = pathToFileURL(join(service, "node_modules/@bloodtrail/security-audit-sdk-node/index.js")).href;
  const phase = message.expectations?.phase ?? message.input?.phase;
  const shouldHang = Boolean(options.breakGate && phase?.gate_timers);
  const fakeNode = fakeSdkNode({ hangRetryTimers: shouldHang });
  let effectiveNode = options.schemaInvalidConflict
    ? buildCorruptedHandoffNode(fakeNode)
    : fakeNode;

  if (options.rejectNewCall) {
    let rejected = false;
    const prevNode = effectiveNode;
    effectiveNode = {
      ...prevNode,
      createHttpDeliveryHandoff(handoffOptions) {
        const realHandoff = prevNode.createHttpDeliveryHandoff(handoffOptions);
        return {
          async handoff(event, attempt = 0) {
            if (!rejected) {
              rejected = true;
              return {
                status: "non_retryable",
                code: "http_permanent",
                event_id: event.event.id,
                attempt,
              };
            }
            return realHandoff.handoff(event, attempt);
          },
        };
      },
    };
  }

  try {
    const report = await senderRun({
      message,
      deps: {
        core: fakeCore(),
        sdkNode: effectiveNode,
        senderSdk: testSenderSdk,
        senderControls: async () => mockSenderControls(),
        guardViolations: () => [{ host: "192.0.2.1", stage: "before_connect" }],
        resolved: () => ({ core: coreUrl, node: nodeUrl }),
        send: (msg) => proc.send(msg),
        awaitMessage: (type) => awaitProcessMessage(proc, type),
        randomBytes,
        recordedCall,
        onBeforeRun: () => {},
      },
    });
    proc.send(report);
  } catch (error) {
    proc.send({ type: "error", message: error.message });
  }
}

function makeFakeSenderChild({ service, options }) {
  const child = new EventEmitter();
  let closed = false;

  const proc = new EventEmitter();
  proc.send = (message, callback) => {
    if (options.dropIngressRestart && message.type === "request_ingress_restart") {
      return;
    }
    if (closed) return;
    const cloned = serializeIpcMessage(message);
    child.emit("message", cloned);
    if (typeof callback === "function") {
      callback();
    }
  };
  proc.exit = (code = 0) => {
    if (closed) return;
    closed = true;
    setImmediate(() => {
      child.emit("exit", code, null);
      child.emit("close", code, null);
    });
  };

  proc.on("message", (message) => {
    if (message.type === "start") {
      handleSenderStart(message, service, options, proc);
    } else if (message.type === "stop") {
      proc.send({ type: "stopped" }, () => proc.exit(0));
    }
  });

  child.send = (message) => {
    if (closed) return;
    const cloned = serializeIpcMessage(message);
    setImmediate(() => {
      proc.emit("message", cloned);
    });
  };

  child.kill = (signal) => {
    if (closed) return;
    closed = true;
    setImmediate(() => {
      child.emit("exit", null, signal ?? "SIGKILL");
      child.emit("close", null, signal ?? "SIGKILL");
    });
  };

  return child;
}

export function makeFakeSpawn({ fakeCollector, options = {}, spawnedRoles = [] }) {
  return function fakeSpawn({ script, role, service }) {
    const isIngress = role === "ingress" || script.endsWith("ingress-process.mjs");
    const child = isIngress
      ? makeFakeIngressChild({ service, fakeCollector })
      : makeFakeSenderChild({ service, options });
    const channel = { ...roleChannel(child), stderr: () => "" };
    spawnedRoles.push(channel);
    return channel;
  };
}

export function createRehearsalEnv(options = {}) {
  const service = mkdtempSync(join(tmpdir(), "copies-rehearsal-svc-"));
  const storage = mkdtempSync(join(tmpdir(), "copies-rehearsal-storage-"));
  createStubPackages(service);
  const fakeCollector = makeRestartCollector(new Map());
  const spawnedRoles = [];
  const spawn = makeFakeSpawn({ fakeCollector, options, spawnedRoles });
  const cleanup = async () => {
    const errors = [];
    for (const role of spawnedRoles) {
      try {
        role.kill();
        await role.whenClosed();
      } catch (err) {
        errors.push(err);
      }
    }
    try {
      rmSync(service, { recursive: true, force: true });
    } catch (err) {
      errors.push(err);
    }
    try {
      rmSync(storage, { recursive: true, force: true });
    } catch (err) {
      errors.push(err);
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, "Teardown errors in createRehearsalEnv");
    }
  };
  return { service, storage, spawn, cleanup, fakeCollector };
}

export async function runRehearsal({ expectations = FROZEN_V2 } = {}) {
  const { service, storage, spawn, cleanup } = createRehearsalEnv();
  let sessionError = null;
  try {
    return await copiesSession({
      service,
      storage,
      flags: { ingress: [], sender: [] },
      expectations,
      spawn,
    });
  } catch (error) {
    sessionError = error;
    throw error;
  } finally {
    try {
      await cleanup();
    } catch (cleanupError) {
      if (sessionError) {
        sessionError.cause = cleanupError;
      } else {
        throw cleanupError;
      }
    }
  }
}
