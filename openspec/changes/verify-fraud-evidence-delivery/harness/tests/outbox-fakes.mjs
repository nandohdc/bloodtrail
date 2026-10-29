// Test support: fake roles and rehearsal environment for outbox probe (#842, Q243-Q258).
// Extends chains-fakes.mjs without modifying or copying it.
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { roleChannel } from "../lib/launcher.mjs";
import { jsonFile } from "../lib/io.mjs";
import { syntheticClock } from "../lib/clock.mjs";
import { bindIngressProcess } from "../outbox/ingress-role.mjs";
import { senderRun } from "../outbox/sender-phases.mjs";
import { outboxSession } from "../outbox/session.mjs";
import {
  serializeIpcMessage,
} from "./chains-fakes.mjs";
import { makeRestartCollector } from "./collector-fixture.mjs";
import {
  createBoundedDeliveryBackpressure,
  createBoundedDeliveryRetry,
  createDeliveryShutdown,
  createFetchHttpExchange,
  createHttpDeliveryHandoff,
  nodeTimers,
} from "./copies-fake-binding.mjs";
import {
  SecurityAuditSdkError,
  recordedCall,
} from "./copies-fake-sdk.mjs";

export { SecurityAuditSdkError, serializeIpcMessage };
export { outboxCore } from "./outbox-fake-core.mjs";
export { createOutboxNodeSecurityAuditSdk } from "./outbox-fake-sdk.mjs";
import { outboxCore } from "./outbox-fake-core.mjs";
import { fakeProcess } from "./outbox-fake-process.mjs";
import { createOutboxNodeSecurityAuditSdk } from "./outbox-fake-sdk.mjs";

const FROZEN_OUTBOX_V1 = jsonFile(new URL("../expectations/outbox.v1.json", import.meta.url));

export function fakeOutboxSdkNode() {
  return {
    nodeTimers,
    createFetchHttpExchange,
    createHttpDeliveryHandoff,
    createBoundedDeliveryRetry,
    createBoundedDeliveryBackpressure,
    createDeliveryShutdown,
    createNodeSecurityAuditSdk: createOutboxNodeSecurityAuditSdk,
  };
}

export function testOutboxSenderSdk({ sdkNode, input, sink }) {
  return sdkNode.createNodeSecurityAuditSdk({
    contractVersion: input.contract_version,
    producer: { name: "stage-2-harness", version: "1.0.0" },
    service: { name: "stage-2-own-service", version: "1.0.0" },
    environment: { name: "synthetic" },
    sink,
    clock: syntheticClock({ start: input.clock.start, stepMs: input.clock.step_ms }),
  });
}

function mockOutboxSenderControls() {
  return {
    loopback_guard: { holds: true, planted: { refused: true, fired: true }, null_control: { connected: true, silent: true } },
    write_outside_grant: { holds: true, planted_refused: true, null_control_allowed: true },
    synthetic_data: { holds: true, planted_refused: true, null_control_passed: true },
    host_db_isolation: {
      host_database_grant_isolated: true,
      planted_write_refused: true,
      null_control_allowed: true,
      holds: true,
    },
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

function makeFakeIngressChild({ service, fakeCollector, options }) {
  const transform = (message) => {
    if (!options.dropPersistedBodies) return message;
    if (!message.persisted_bodies) return message;
    return { ...message, persisted_bodies: [] };
  };
  const { child, proc, setStop } = fakeProcess(transform);
  const collectorUrl = pathToFileURL(join(service, "node_modules/@bloodtrail/security-audit-collector/index.js")).href;
  const handlers = bindIngressProcess({
    collector: fakeCollector, resolved: { collector: collectorUrl },
    controlsFor: () => ({ write_outside_grant: { holds: true, planted_refused: true, null_control_allowed: true } }),
    proc,
  });
  setStop(handlers.stop);
  return child;
}

async function handleOutboxSenderStart({ message, service, proc, options }) {
  const coreUrl = pathToFileURL(join(service, "node_modules/@bloodtrail/security-audit-sdk-core/index.js")).href;
  const nodeUrl = pathToFileURL(join(service, "node_modules/@bloodtrail/security-audit-sdk-node/index.js")).href;
  const fakeNode = fakeOutboxSdkNode();
  if (options.bindingAbsorbsOutage) message.expectations.composition.max_attempts = 3;

  try {
    const report = await senderRun({
      message,
      deps: {
        core: outboxCore(),
        sdkNode: fakeNode,
        senderSdk: testOutboxSenderSdk,
        senderControls: async () => mockOutboxSenderControls(),
        guardViolations: () => [{ host: "192.0.2.1", stage: "before_connect" }],
        resolved: () => ({ core: coreUrl, node: nodeUrl }),
        hostDbIsolationControl: () => mockOutboxSenderControls().host_db_isolation,
        ...options.senderDeps,
        recordedCall,
        onBeforeRun: () => {},
      },
    });
    proc.send(report);
  } catch (error) {
    proc.send({ type: "error", message: error.message });
  }
}

function makeFakeOutboxSenderChild({ service, options }) {
  const { child, proc } = fakeProcess();
  proc.on("message", (message) => {
    if (message.type === "start") handleOutboxSenderStart({ message, service, proc, options });
    if (message.type === "stop") proc.send({ type: "stopped" }, () => proc.exit(0));
  });
  return child;
}

export function makeFakeOutboxSpawn({ fakeCollector, options = {}, spawnedRoles = [] }) {
  return function fakeSpawn({ role, service }) {
    const isIngress = role === "ingress";
    const child = isIngress
      ? makeFakeIngressChild({ service, fakeCollector, options })
      : makeFakeOutboxSenderChild({ service, options });
    const channel = { ...roleChannel(child), stderr: () => "" };
    spawnedRoles.push(channel);
    return channel;
  };
}

export function createOutboxRehearsalEnv(options = {}) {
  const service = mkdtempSync(join(tmpdir(), "outbox-rehearsal-svc-"));
  const storage = mkdtempSync(join(tmpdir(), "outbox-rehearsal-storage-"));
  const hostDatabase = mkdtempSync(join(tmpdir(), "outbox-rehearsal-host-"));
  createStubPackages(service);
  const fakeCollector = makeRestartCollector(new Map());
  const spawnedRoles = [];
  const spawn = makeFakeOutboxSpawn({ fakeCollector, options, spawnedRoles });

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
    for (const dir of [service, storage, hostDatabase]) {
      try {
        rmSync(dir, { recursive: true, force: true });
      } catch (err) {
        errors.push(err);
      }
    }
    if (errors.length > 0) {
      throw new AggregateError(errors, "Teardown errors in createOutboxRehearsalEnv");
    }
  };

  return { service, storage, hostDatabase, spawn, cleanup, fakeCollector };
}

async function cleanRehearsal(cleanup, sessionError) {
  try {
    await cleanup();
  } catch (error) {
    if (!sessionError) throw error;
    throw new AggregateError([sessionError, error], "session and cleanup failed");
  }
}

export async function runOutboxRehearsal({ expectations = FROZEN_OUTBOX_V1, exchange, ...options } = {}) {
  const { service, storage, hostDatabase, spawn, cleanup } = createOutboxRehearsalEnv(options);
  let sessionError = null;
  try {
    return await outboxSession({
      service,
      storage,
      hostDatabase,
      flags: { ingress: [], sender: [] },
      expectations,
      spawn,
      ...(exchange ? { exchange } : {}),
    });
  } catch (error) {
    sessionError = error;
    throw error;
  } finally {
    await cleanRehearsal(cleanup, sessionError);
  }
}
