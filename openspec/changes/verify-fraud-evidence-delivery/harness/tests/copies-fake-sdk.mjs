// Test support: fake Core and Node SDK logic for copies tests (#839, Q166, Q180, Q183, Q184, Q185).
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { syntheticClock } from "../lib/clock.mjs";
import { jsonFile } from "../lib/io.mjs";
import {
  createBoundedDeliveryBackpressure,
  createBoundedDeliveryRetry,
  createDeliveryShutdown,
  createFetchHttpExchange,
  createHttpDeliveryHandoff,
  nodeTimers,
} from "./copies-fake-binding.mjs";

const require = createRequire(import.meta.url);
const validateGeneratedSchema = require("../../../../../packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs");
const CANONICAL_POSITIVE_EXAMPLE = jsonFile(new URL("../../../../../contracts/security-audit/examples/positive/bloodtrail.audit.authentication.succeeded.json", import.meta.url));

export class SecurityAuditSdkError extends Error {
  constructor(code, category, path) {
    super(code);
    this.name = "SecurityAuditSdkError";
    this.code = code;
    this.category = category;
    this.path = path;
  }
}

function isConfigRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConfigNonEmptyString(value) {
  return typeof value === "string" && value.length > 0;
}

function requireConfigRecord(value, path) {
  if (!isConfigRecord(value)) {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", path);
  }
}

function requireConfigString(value, path) {
  if (!isConfigNonEmptyString(value)) {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", path);
  }
}

export function validateSdkConfig(config) {
  requireConfigRecord(config, "/configuration");
  if (config.contractVersion !== "2.1.0") {
    throw new SecurityAuditSdkError("SDK_UNSUPPORTED_CONTRACT_VERSION", "configuration", "/contractVersion");
  }
  requireConfigRecord(config.producer, "/producer");
  requireConfigString(config.producer.name, "/producer/name");
  requireConfigString(config.producer.version, "/producer/version");

  requireConfigRecord(config.service, "/service");
  requireConfigString(config.service.name, "/service/name");

  requireConfigRecord(config.environment, "/environment");
  requireConfigString(config.environment.name, "/environment/name");

  if (!config.sink || typeof config.sink.emit !== "function") {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/sink");
  }
  if (!config.clock || typeof config.clock.now !== "function") {
    throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/clock");
  }
}

export function mapActor(actor) {
  if (actor === null) return null;
  if (!actor) return undefined;
  const tenantId = actor.tenant_id ? actor.tenant_id : actor.tenantId;
  const source = actor.source ? actor.source : "synthetic-server-authentication-authority";
  return {
    type: actor.type ? actor.type : "authenticated_human",
    id: actor.id,
    tenant_id: tenantId,
    provenance: actor.provenance ? actor.provenance : {
      trust_level: "authoritative_server",
      source,
    },
  };
}

function buildCorrelation(canonicalCorrelation, retry) {
  const correlation = {
    ...canonicalCorrelation,
    retry_attempt: retry ? retry.retry_attempt : 0,
  };
  if (retry && retry.original_event_id) {
    correlation.original_event_id = retry.original_event_id;
  }
  return correlation;
}

function assignDefinedFields(target, entries) {
  for (const [key, value] of entries) {
    if (value !== undefined) {
      target[key] = value;
    }
  }
}

const CONTEXT_OVERRIDE_KEYS = [
  "event", "schema", "initiator", "resource", "request", "risk", "data", "integrity",
];

function assignContextOverrides(target, input) {
  for (const key of CONTEXT_OVERRIDE_KEYS) {
    if (input[key] !== undefined) {
      target[key] = input[key];
    }
  }
}

function hasRedeliveryEvent(input) {
  return Boolean(input.redelivery && input.redelivery.event);
}

export function buildMappedEvent({ input, config }) {
  if (hasRedeliveryEvent(input)) {
    return structuredClone(input.redelivery.event);
  }
  const base = structuredClone(CANONICAL_POSITIVE_EXAMPLE);
  base.event.id = randomUUID();
  base.producer = config.producer;
  base.service = config.service;
  base.environment = config.environment;
  base.correlation = buildCorrelation(base.correlation, input.retry);

  assignDefinedFields(base, [
    ["actor", mapActor(input.actor)],
    ["tenant", input.tenant],
    ["authenticated_principal", input.authenticated_principal],
    ["authentication", input.authentication],
    ["credential", input.credential],
    ["session", input.session],
    ["source", input.source],
  ]);

  assignContextOverrides(base, input);
  return base;
}

function buildAuditEvent({ input, config }) {
  const event = buildMappedEvent({ input, config });
  if (!validateGeneratedSchema(event)) {
    const first = validateGeneratedSchema.errors?.[0];
    const schemaPath = first ? first.schemaPath : null;
    const path = typeof schemaPath === "string" ? schemaPath.slice(0, 128) : "/";
    return { ok: false, error: new SecurityAuditSdkError("SDK_SCHEMA_VALIDATION_FAILED", "validation", path) };
  }
  return { ok: true, event };
}

export function createNodeSecurityAuditSdk(config) {
  validateSdkConfig(config);
  return {
    async authenticationSucceeded(input) {
      const built = buildAuditEvent({ input, config });
      if (!built.ok) {
        return {
          ok: false,
          error: {
            code: built.error.code,
            category: built.error.category,
            path: built.error.path,
            eventName: "bloodtrail.audit.authentication.succeeded",
          },
        };
      }
      const event = built.event;
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
    },
  };
}

export function fakeSdkNode(options = {}) {
  return {
    nodeTimers,
    createFetchHttpExchange,
    createHttpDeliveryHandoff,
    createBoundedDeliveryRetry: (retryOptions) => createBoundedDeliveryRetry(retryOptions, options),
    createBoundedDeliveryBackpressure,
    createDeliveryShutdown,
    createNodeSecurityAuditSdk,
  };
}

export function testSenderSdk({ sdkNode, input, sink }) {
  return sdkNode.createNodeSecurityAuditSdk({
    contractVersion: input.contract_version, producer: { name: "stage-2-harness", version: "1.0.0" },
    service: { name: "stage-2-own-service", version: "1.0.0" }, environment: { name: "synthetic" },
    sink, clock: syntheticClock({ start: input.clock.start, stepMs: input.clock.step_ms }),
  });
}

export function fakeCore() {
  const plainCopy = (args) => Object.freeze({ ...args });
  return Object.freeze({
    authenticatedHumanActor: plainCopy,
    authoritativeTenant: plainCopy,
    authenticatedPrincipal: plainCopy,
    observedSource: plainCopy,
    sessionEvidence: plainCopy,
    authenticationEvidence: plainCopy,
    credentialReference: plainCopy,
  });
}

export async function recordedCall({ ledger, label, invoke }) {
  ledger.take(label);
  const result = await invoke();
  return { label, ok: result.ok, value: result.ok ? result.value : undefined, error: result.ok ? undefined : result.error };
}
