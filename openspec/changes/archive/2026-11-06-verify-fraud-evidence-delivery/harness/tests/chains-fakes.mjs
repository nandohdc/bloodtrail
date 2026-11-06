// Test support: fake roles and rehearsal environment for chains probe (#840, Q201-Q230).
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { roleChannel } from "../lib/launcher.mjs";
import { jsonFile } from "../lib/io.mjs";
import { syntheticClock } from "../lib/clock.mjs";
import { bindIngressProcess } from "../chains/ingress-role.mjs";
import { awaitProcessMessage, senderRun } from "../chains/sender-phases.mjs";
import { chainsSession } from "../chains/session.mjs";
import { chainsControls } from "../chains/controls.mjs";
import { makeRestartCollector } from "./collector-fixture.mjs";
import { serializeIpcMessage } from "./copies-fake-roles.mjs";
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
  mapActor,
  recordedCall,
  validateSdkConfig,
} from "./copies-fake-sdk.mjs";

export { serializeIpcMessage };

const require = createRequire(import.meta.url);
const validateGeneratedSchema = require("../../../../../packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs");
const FROZEN_V1 = jsonFile(new URL("../expectations/chains.v1.json", import.meta.url));
const CATALOG = jsonFile(new URL("../../../../../contracts/security-audit/catalog/catalog.json", import.meta.url));
const CATALOG_BY_NAME = new Map(CATALOG.map((entry) => [entry.name, entry]));

const METHOD_TO_EVENT_NAME = Object.freeze({
  authenticationSucceeded: "bloodtrail.audit.authentication.succeeded",
  sessionCreated: "bloodtrail.audit.session.created",
  mfaRemoved: "bloodtrail.audit.authentication.mfa.removed",
  passwordResetCompleted: "bloodtrail.audit.account.password_reset.completed",
  sessionRevoked: "bloodtrail.audit.session.revoked",
  authenticationFailed: "bloodtrail.audit.authentication.failed",
});

const CANONICAL_EXAMPLES = Object.freeze({
  authenticationSucceeded: jsonFile(new URL("../../../../../contracts/security-audit/examples/positive/bloodtrail.audit.authentication.succeeded.json", import.meta.url)),
  sessionCreated: jsonFile(new URL("../../../../../contracts/security-audit/examples/positive/bloodtrail.audit.session.created.json", import.meta.url)),
  mfaRemoved: jsonFile(new URL("../../../../../contracts/security-audit/examples/positive/bloodtrail.audit.authentication.mfa.removed.json", import.meta.url)),
  passwordResetCompleted: jsonFile(new URL("../../../../../contracts/security-audit/examples/positive/bloodtrail.audit.account.password_reset.completed.json", import.meta.url)),
  sessionRevoked: jsonFile(new URL("../../../../../contracts/security-audit/examples/positive/bloodtrail.audit.session.revoked.json", import.meta.url)),
  authenticationFailed: jsonFile(new URL("../../../../../contracts/security-audit/examples/positive/bloodtrail.audit.authentication.failed.json", import.meta.url)),
});

function mockSenderControls() {
  return {
    loopback_guard: { holds: true, planted: { refused: true, fired: true }, null_control: { connected: true, silent: true } },
    write_outside_grant: { holds: true, planted_refused: true, null_control_allowed: true },
    synthetic_data: { holds: true, planted_refused: true, null_control_passed: true },
    chains_checks: chainsControls(),
  };
}

export function chainsCore() {
  const plainCopy = (args) => Object.freeze({ ...args });
  return Object.freeze({
    anonymousActor: (source) => Object.freeze({
      type: "anonymous",
      provenance: { trust_level: "client_claim", source: source ?? "request_boundary" },
    }),
    authenticatedHumanActor: plainCopy,
    authoritativeTenant: plainCopy,
    authenticatedPrincipal: plainCopy,
    observedSource: plainCopy,
    sessionEvidence: plainCopy,
    authenticationEvidence: plainCopy,
    credentialReference: plainCopy,
    authoritativeSubject: plainCopy,
    authorizationEvidence: plainCopy,
    authoritativeResource: plainCopy,
  });
}

function createFakeOperationHandle(options = {}) {
  let state = "started";
  const boundEvent = options.boundEvent;
  const operationId = options.operationId || `op_${randomUUID()}`;
  const transactionId = options.transactionId || `tx_${randomUUID()}`;
  const correlationId = options.correlationId || `cor_${randomUUID()}`;

  const handle = {
    get operationId() { return operationId; },
    get transactionId() { return transactionId; },
    get correlationId() { return correlationId; },
    get boundEvent() { return boundEvent; },
    get state() { return state; },
    snapshot() {
      return Object.freeze({
        operation_id: operationId,
        transaction_id: transactionId,
        correlation_id: correlationId,
        state,
        commit_state: state === "committed" ? "committed" : "pending",
        ...(boundEvent ? { bound_event: boundEvent } : {}),
        transactional: true,
      });
    },
    markCommitted() {
      if (state !== "started") {
        return { ok: false, error: new SecurityAuditSdkError("SDK_INVALID_OPERATION_TRANSITION", "lifecycle", "/operation/state") };
      }
      state = "committed";
      return { ok: true, value: handle.snapshot() };
    },
  };
  return handle;
}

function stripInheritedFields(base) {
  delete base.request;
  delete base.subject;
  delete base.credential;
  delete base.presented_identifier;
  delete base.session;
  delete base.authorization;
  delete base.authentication;
  delete base.resource;
  delete base.source;
  if (base.event) {
    delete base.event.commit_state;
  }
  if (base.correlation) {
    delete base.correlation.causation_id;
    delete base.correlation.original_event_id;
  }
}

const DIRECT_INPUT_FIELDS = Object.freeze([
  "source", "request", "subject", "credential", "session",
  "authentication", "authorization",
]);

const ACTION_OP_TYPES = Object.freeze({
  create_session: "create",
  enroll_mfa: "create",
  revoke_session: "delete",
  remove_mfa: "delete",
});

function resolveOperationType(action) {
  return ACTION_OP_TYPES[action] ?? "execute";
}

function applyActor(base, input) {
  if (input.actor !== undefined) {
    base.actor = mapActor(input.actor);
  } else {
    delete base.actor;
  }
}

function applyTenant(base, input) {
  if (input.tenant !== undefined) {
    base.tenant = input.tenant;
  } else {
    delete base.tenant;
  }
}

function applyPrincipal(base, input) {
  if (input.authenticated_principal !== undefined) {
    base.authenticated_principal = input.authenticated_principal;
  } else {
    delete base.authenticated_principal;
  }
}

function applyDirectFields(base, input) {
  for (const field of DIRECT_INPUT_FIELDS) {
    if (input[field] !== undefined) {
      base[field] = input[field];
    }
  }
}

function applyResource(base, input, definition) {
  const opType = resolveOperationType(definition.action);
  if (input.resource !== undefined) {
    base.resource = { operation_type: opType, ...input.resource };
  } else {
    base.resource = { operation_type: opType };
  }
}

function applyCorrelation(base, input) {
  if (input.correlation !== undefined) {
    base.correlation = { ...base.correlation, ...input.correlation };
  }
}

function applyInputFields(base, input, definition) {
  applyActor(base, input);
  applyTenant(base, input);
  applyPrincipal(base, input);
  applyDirectFields(base, input);
  applyResource(base, input, definition);
  applyCorrelation(base, input);
}

function checkActorContext(base) {
  const actor = base.actor;
  if (!actor) return false;
  return actor.type === "anonymous" || Boolean(actor.id);
}

function checkTenantContext(base) {
  const tenant = base.tenant;
  if (!tenant) return false;
  return Boolean(tenant.effective_tenant_id) || tenant.scope === "tenantless";
}

function validateActorContext(base) {
  if (checkActorContext(base)) return null;
  return { code: "MISSING_REQUIRED_ACTOR", path: "/actor" };
}

function validateTenantContext(base) {
  if (checkTenantContext(base)) return null;
  return { code: "MISSING_TENANT_CONTEXT", path: "/tenant" };
}

function validatePrincipalContext(base) {
  if (base.authenticated_principal) return null;
  return { code: "SDK_MISSING_EVENT_FIELD", path: "/authenticated_principal" };
}

function validateAuthenticationContext(base) {
  if (base.authentication) return null;
  return { code: "SDK_MISSING_EVENT_FIELD", path: "/authentication" };
}

function validateSessionContext(base) {
  if (base.session) return null;
  return { code: "SDK_MISSING_EVENT_FIELD", path: "/session" };
}

function validateSourceContext(base) {
  if (base.source) return null;
  return { code: "SDK_MISSING_EVENT_FIELD", path: "/source" };
}

function validateRequestContext(base) {
  if (base.request) return null;
  return { code: "SDK_MISSING_EVENT_FIELD", path: "/request" };
}

function validateCredentialContext(base) {
  if (base.credential) return null;
  return { code: "SDK_MISSING_EVENT_FIELD", path: "/credential" };
}

function validateSubjectContext(base) {
  if (base.subject) return null;
  return { code: "SDK_MISSING_EVENT_FIELD", path: "/subject" };
}

function validateAuthorizationContext(base) {
  const auth = base.authorization;
  if (auth) {
    if (auth.decision) return null;
  }
  return { code: "SDK_MISSING_EVENT_FIELD", path: "/authorization" };
}

function validateResourceContext(base) {
  const res = base.resource;
  if (res) {
    if (res.type) return null;
  }
  return { code: "SDK_MISSING_EVENT_FIELD", path: "/resource/type" };
}

const CONTEXT_ENTRIES = Object.freeze([
  { name: "actor", check: validateActorContext },
  { name: "tenant", check: validateTenantContext },
  { name: "authenticated_principal", check: validatePrincipalContext },
  { name: "authentication", check: validateAuthenticationContext },
  { name: "session", check: validateSessionContext },
  { name: "source", check: validateSourceContext },
  { name: "request", check: validateRequestContext },
  { name: "credential", check: validateCredentialContext },
  { name: "subject", check: validateSubjectContext },
  { name: "authorization", check: validateAuthorizationContext },
  { name: "resource", check: validateResourceContext },
]);

const CONTEXT_VALIDATORS = Object.freeze(
  Object.fromEntries(CONTEXT_ENTRIES.map((entry) => [entry.name, entry.check]))
);

function validateSingleContext(base, context) {
  const validator = CONTEXT_VALIDATORS[context];
  if (!validator) return { ok: true };
  const err = validator(base);
  if (err) {
    return { ok: false, error: new SecurityAuditSdkError(err.code, "validation", err.path) };
  }
  return { ok: true };
}

function validateRequiredContext(base, definition) {
  for (const context of definition.required_context) {
    const check = validateSingleContext(base, context);
    if (!check.ok) return check;
  }
  return { ok: true };
}

function validateCommitState(base, definition, input) {
  const commits = definition.commit || [];
  const isTransactionBound = !commits.includes("not_applicable");
  if (!isTransactionBound) {
    base.event.commit_state = "not_applicable";
    return { ok: true };
  }
  const handle = input.operation;
  if (!handle || handle.state !== "committed") {
    return { ok: false, error: new SecurityAuditSdkError("PREMATURE_SUCCESS", "validation", "/operation/state") };
  }
  base.event.commit_state = "committed";
  base.correlation = base.correlation || {};
  base.correlation.operation_id = handle.operationId;
  base.correlation.transaction_id = handle.transactionId;
  return { ok: true };
}

const ASYNC_COMPLETION_SEMANTICS = new Set(["account_registration_completed", "password_reset_completed"]);

function validateAsyncCompletion(base, definition) {
  if (!ASYNC_COMPLETION_SEMANTICS.has(definition.semantic)) return { ok: true };
  const outcome = base.event?.outcome ?? "success";
  if (outcome !== "success") return { ok: true };
  if (!base.correlation?.causation_id || !base.correlation?.original_event_id) {
    return { ok: false, error: new SecurityAuditSdkError("BAD_CAUSALITY", "validation", "/correlation") };
  }
  return { ok: true };
}

function validateAuthority(base, definition) {
  const actor = base.actor;
  if (actor?.type === "anonymous" && definition.actor_rule !== "anonymous actor permitted") {
    return { ok: false, error: new SecurityAuditSdkError("MISSING_REQUIRED_ACTOR", "validation", "/actor/type") };
  }
  return { ok: true };
}

function isConflictingTenant(tenant, owning) {
  if (!owning) return false;
  if (!tenant) return false;
  const effective = tenant.effective_tenant_id;
  if (!effective) return false;
  return owning !== effective;
}

function isExemptTenantScope(scope) {
  if (scope === "cross_tenant") return true;
  if (scope === "platform") return true;
  return false;
}

function validateTenantResourceConflict(base) {
  const res = base.resource;
  const owning = res ? res.owning_tenant_id : undefined;
  const tenant = base.tenant;
  if (isConflictingTenant(tenant, owning)) {
    const scope = tenant ? tenant.scope : undefined;
    if (!isExemptTenantScope(scope)) {
      return { ok: false, error: new SecurityAuditSdkError("TENANT_RESOURCE_CONFLICT", "validation", "/resource/owning_tenant_id") };
    }
  }
  return { ok: true };
}

const NON_CREDENTIAL_TARGETS = Object.freeze([
  ["/subject/type", (ev) => Boolean(ev.subject && (ev.subject.type === undefined ? (ev.subject.id !== undefined || ev.subject.tenant_id !== undefined) : ev.subject.type !== "credential"))],
  ["/subject/display_name", (ev) => Boolean(ev.subject?.display_name !== undefined)],
  ["/resource/type", (ev) => Boolean(ev.resource && (ev.resource.type === undefined ? ev.resource.id !== undefined : ev.resource.type !== "credential"))],
  ["/resource/parent_type", (ev) => Boolean(ev.resource?.parent_type !== undefined)],
  ["/resource/parent_id", (ev) => Boolean(ev.resource?.parent_id !== undefined)],
  ["/authorization/resource_context/type", (ev) => {
    const ctx = ev.authorization?.resource_context;
    if (!ctx) return false;
    return ctx.type === undefined ? ctx.id !== undefined : ctx.type !== "credential";
  }],
]);

function validateCredentialOnlyTarget(base, definition) {
  if (definition.semantic !== "authentication_failed") return { ok: true };
  for (const [pointer, predicate] of NON_CREDENTIAL_TARGETS) {
    if (predicate(base)) {
      return { ok: false, error: new SecurityAuditSdkError("SDK_SEMANTIC_VALIDATION_FAILED", "validation", pointer) };
    }
  }
  return { ok: true };
}

function validateEventSchema(base) {
  if (validateGeneratedSchema(base)) return { ok: true };
  const first = validateGeneratedSchema.errors?.[0];
  const schemaPath = first ? first.schemaPath : null;
  const path = typeof schemaPath === "string" ? schemaPath.slice(0, 128) : "/";
  return { ok: false, error: new SecurityAuditSdkError("SDK_SCHEMA_VALIDATION_FAILED", "validation", path) };
}

function validateEvent(base, definition, input) {
  const checks = [
    () => validateRequiredContext(base, definition),
    () => validateCommitState(base, definition, input),
    () => validateAsyncCompletion(base, definition),
    () => validateAuthority(base, definition),
    () => validateTenantResourceConflict(base),
    () => validateCredentialOnlyTarget(base, definition),
  ];
  for (const check of checks) {
    const res = check();
    if (!res.ok) return res;
  }
  return validateEventSchema(base);
}

function populateEventMetadata(base, config, input) {
  base.event.id = randomUUID();
  base.producer = config.producer;
  base.service = config.service;
  base.environment = config.environment;
  if (input.event?.timestamp) {
    base.event.timestamp = input.event.timestamp;
    base.event.observed_at = input.event.timestamp;
  }
}

function buildAuditEvent({ method, input, config }) {
  const example = CANONICAL_EXAMPLES[method];
  const base = structuredClone(example);
  populateEventMetadata(base, config, input);
  const eventName = METHOD_TO_EVENT_NAME[method];
  const definition = CATALOG_BY_NAME.get(eventName);
  if (!definition) {
    return { ok: false, error: new SecurityAuditSdkError("SDK_UNKNOWN_EVENT", "validation", "/event/name") };
  }
  stripInheritedFields(base);
  applyInputFields(base, input, definition);
  const valResult = validateEvent(base, definition, input);
  if (!valResult.ok) return valResult;
  return { ok: true, event: base };
}

async function deliverAuditEvent({ event, config }) {
  try {
    const deliveryResult = await config.sink.emit(event);
    if (deliveryResult.status === "accepted" || deliveryResult.status === "acknowledged") {
      return { ok: true, value: { status: "accepted" } };
    }
    const code = deliveryResult.status === "rejected" ? "SDK_SINK_REJECTED" : "SDK_SINK_FAILURE";
    return {
      ok: false,
      error: { code, category: "sink", path: "/sink", eventName: event.event.name },
    };
  } catch {
    return {
      ok: false,
      error: { code: "SDK_SINK_FAILURE", category: "sink", path: "/sink", eventName: event.event.name },
    };
  }
}

export function createChainsNodeSecurityAuditSdk(config) {
  validateSdkConfig(config);

  function beginOperation(options) {
    const handle = createFakeOperationHandle(options);
    return { ok: true, value: handle };
  }

  async function emitMethod(method, input) {
    const built = buildAuditEvent({ method, input, config });
    if (!built.ok) {
      return {
        ok: false,
        error: {
          code: built.error.code,
          category: built.error.category,
          path: built.error.path,
          eventName: CANONICAL_EXAMPLES[method].event.name,
        },
      };
    }
    return deliverAuditEvent({ event: built.event, config });
  }

  return {
    beginOperation,
    authenticationSucceeded: (input) => emitMethod("authenticationSucceeded", input),
    sessionCreated: (input) => emitMethod("sessionCreated", input),
    mfaRemoved: (input) => emitMethod("mfaRemoved", input),
    passwordResetCompleted: (input) => emitMethod("passwordResetCompleted", input),
    sessionRevoked: (input) => emitMethod("sessionRevoked", input),
    authenticationFailed: (input) => emitMethod("authenticationFailed", input),
  };
}

export function fakeChainsSdkNode() {
  return {
    nodeTimers,
    createFetchHttpExchange,
    createHttpDeliveryHandoff,
    createBoundedDeliveryRetry,
    createBoundedDeliveryBackpressure,
    createDeliveryShutdown,
    createNodeSecurityAuditSdk: createChainsNodeSecurityAuditSdk,
  };
}

export function testChainsSenderSdk({ sdkNode, input, sink }) {
  return sdkNode.createNodeSecurityAuditSdk({
    contractVersion: input.contract_version, producer: { name: "stage-2-harness", version: "1.0.0" },
    service: { name: "stage-2-own-service", version: "1.0.0" }, environment: { name: "synthetic" },
    sink, clock: syntheticClock({ start: input.clock.start, stepMs: input.clock.step_ms }),
  });
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

function makeFakeIngressChild({ service, fakeCollector, options = {} }) {
  const collectorUrl = pathToFileURL(join(service, "node_modules/@bloodtrail/security-audit-collector/index.js")).href;
  const child = new EventEmitter();
  let closed = false;

  const proc = new EventEmitter();
  proc.send = (message, callback) => {
    if (closed) return;
    let payload = message;
    if (options.dropPersistedBodies && message?.persisted_bodies) {
      payload = { ...message, persisted_bodies: [] };
    }
    const cloned = serializeIpcMessage(payload);
    child.emit("message", cloned);
    if (typeof callback === "function") callback();
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
    controlsFor: () => ({ write_outside_grant: { holds: true, planted_refused: true, null_control_allowed: true } }),
    proc,
  });

  child.send = (message) => {
    if (closed) return;
    const cloned = serializeIpcMessage(message);
    setImmediate(() => proc.emit("message", cloned));
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

async function handleSenderStart(message, service, proc) {
  const coreUrl = pathToFileURL(join(service, "node_modules/@bloodtrail/security-audit-sdk-core/index.js")).href;
  const nodeUrl = pathToFileURL(join(service, "node_modules/@bloodtrail/security-audit-sdk-node/index.js")).href;
  const fakeNode = fakeChainsSdkNode();

  try {
    const report = await senderRun({
      message,
      deps: {
        core: chainsCore(),
        sdkNode: fakeNode,
        senderSdk: testChainsSenderSdk,
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

function makeFakeSenderChild({ service }) {
  const child = new EventEmitter();
  let closed = false;

  const proc = new EventEmitter();
  proc.send = (message, callback) => {
    if (closed) return;
    const cloned = serializeIpcMessage(message);
    child.emit("message", cloned);
    if (typeof callback === "function") callback();
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
      handleSenderStart(message, service, proc);
    } else if (message.type === "stop") {
      proc.send({ type: "stopped" }, () => proc.exit(0));
    }
  });

  child.send = (message) => {
    if (closed) return;
    const cloned = serializeIpcMessage(message);
    setImmediate(() => proc.emit("message", cloned));
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
      ? makeFakeIngressChild({ service, fakeCollector, options })
      : makeFakeSenderChild({ service });
    const channel = { ...roleChannel(child), stderr: () => "" };
    spawnedRoles.push(channel);
    return channel;
  };
}

export function createChainsRehearsalEnv(options = {}) {
  const service = mkdtempSync(join(tmpdir(), "chains-rehearsal-svc-"));
  const storage = mkdtempSync(join(tmpdir(), "chains-rehearsal-storage-"));
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
      throw new AggregateError(errors, "Teardown errors in createChainsRehearsalEnv");
    }
  };

  return { service, storage, spawn, cleanup, fakeCollector };
}

export async function runChainsRehearsal({ expectations = FROZEN_V1, exchange, ...options } = {}) {
  const { service, storage, spawn, cleanup } = createChainsRehearsalEnv(options);
  let sessionError = null;
  try {
    return await chainsSession({
      service,
      storage,
      flags: { ingress: [], sender: [] },
      expectations,
      spawn,
      ...(exchange ? { exchange } : {}),
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
