import type { NormalizedSdkConfiguration } from "./config.js";
import type { AuditTransformationOutput } from "./config.js";
import type { AuditContextFrame } from "./context.js";
import { mergeAuditContextFrames } from "./context.js";
import type {
  EventDefinition,
  EventForName,
  EventMethodName,
  EventName,
  GeneratedOperationContext,
  NamedAuditEventInputMap,
  SecurityAuditEvent,
} from "./generated/contract.generated.js";
import {
  CONTRACT_SCHEMA_NAME,
  CONTRACT_VERSION,
  EVENT_CATALOG,
  EVENT_METHODS,
} from "./generated/contract.generated.js";
import type { AuditOperationSnapshot } from "./operations.js";
import type { AuditResult } from "./errors.js";
import { failure } from "./errors.js";
import type { DeliveryIntent } from "./internal.js";
import { clonePlain, deepFreeze, fieldPolicyForPath, isTransformableFieldPath, omitUndefined } from "./internal.js";
import { validateNoProhibitedData, validateSecurityAuditEvent } from "./validation/index.js";

type AnyNamedInput = Omit<NamedAuditEventInputMap[EventMethodName], "operation"> & {
  readonly operation?: AuditOperationSnapshot;
  readonly claimedTenant?: { readonly claimed_tenant_id?: string };
};

export interface BuiltNamedAuditEvent<N extends EventName = EventName> {
  readonly event: Readonly<EventForName<N>>;
  readonly deliveryIntent: Extract<DeliveryIntent, { readonly kind: "named_execution" | "named_redelivery" }>;
}

const definitionsByName = new Map<EventName, EventDefinition>(EVENT_CATALOG.map((entry) => [entry.name, entry]));
const methodsByName = new Map<string, (typeof EVENT_METHODS)[number]>(EVENT_METHODS.map((entry) => [entry.method, entry]));
const eventIdPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const terminalCommitStates = new Set(["committed", "not_committed", "partially_committed", "compensated"]);

export function buildNamedAuditEvent<M extends EventMethodName>(
  config: NormalizedSdkConfiguration,
  method: M,
  input: AnyNamedInput,
  activeContext: AuditContextFrame | undefined,
): AuditResult<BuiltNamedAuditEvent> {
  const resolved = resolveEventDefinition(method);
  if (!resolved.ok) return resolved;
  const definition = resolved.value;

  const operation = input.operation;
  if (operation?.bound_event && operation.bound_event !== method) {
    return failure("SDK_OPERATION_EVENT_MISMATCH", "lifecycle", "/operation/bound_event");
  }

  const redelivery = input.redelivery?.event;
  if (redelivery) {
    const validated = validateSecurityAuditEvent(redelivery);
    if (!validated.ok) return validated;
    if (validated.value.event.name !== definition.name) return failure("UNKNOWN_CATALOG_VALUE", "validation", "/event/name");
    const binding = validateNamedRedeliveryBinding(validated.value, operation);
    if (!binding.ok) return binding;
    return {
      ok: true,
      value: {
        event: validated.value as Readonly<EventForName<EventName>>,
        deliveryIntent: { kind: "named_redelivery" },
      },
    };
  }

  const normalizedInput = { ...input, operation } as AnyNamedInput;
  const initialScan = validateNoProhibitedData(normalizedInput);
  if (!initialScan.ok) return initialScan;

  const frameResult = resolveContextFrame(config, activeContext, normalizedInput);
  if (!frameResult.ok) return frameResult;
  const frame = frameResult.value;

  const lifecycle = normalizedInput.event?.lifecycle_phase ?? defaultLifecycle(definition);
  const outcome = normalizedInput.event?.outcome ?? defaultOutcome(definition, operation);
  const commitResult = resolveCommitState(definition, outcome, normalizedInput.event?.commit_state, operation);
  if (!commitResult.ok) return commitResult;
  const commit = commitResult.value;

  const eventId = config.identifiers.eventId();
  if (!eventIdPattern.test(eventId)) return failure("SDK_INVALID_IDENTIFIER", "validation", "/event/id");
  const timestamps = resolveTimestamps(config, normalizedInput);
  if (!timestamps.ok) return timestamps;
  const correlation = buildCorrelation(config, frame, normalizedInput, operation);
  if (!correlation.ok) return correlation;

  const candidate: SecurityAuditEvent = omitUndefined({
    event: {
      id: eventId,
      name: definition.name,
      category: definition.category,
      action: definition.action,
      lifecycle_phase: lifecycle,
      outcome,
      outcome_reason: normalizedInput.event?.outcome_reason,
      commit_state: commit,
      timestamp: timestamps.value.timestamp,
      observed_at: timestamps.value.observedAt,
      delivery_class: definition.delivery,
    },
    schema: { name: CONTRACT_SCHEMA_NAME, version: CONTRACT_VERSION },
    producer: config.producer,
    environment: frame.environment ?? config.environment,
    service: frame.service ?? config.service,
    deployment: frame.deployment ?? config.deployment,
    tenant: buildTenant(frame),
    actor: frame.actor,
    subject: frame.subject,
    authenticated_principal: frame.authenticated_principal,
    delegation: frame.delegation,
    credential: frame.credential,
    initiator: frame.initiator ?? defaultInitiator(config),
    session: frame.session,
    authentication: frame.authentication,
    authorization: frame.authorization,
    source: frame.source,
    destination: frame.destination,
    resource: withDerivedOperationType(frame.resource, definition),
    request: frame.request,
    correlation: correlation.value,
    risk: frame.risk,
    data: {
      classification: frame.data?.classification ?? frame.resource?.data_classification ?? "internal",
      retention_class: frame.data?.retention_class ?? definition.retention,
      field_policy_version: frame.data?.field_policy_version ?? CONTRACT_VERSION,
    },
    integrity: frame.integrity,
    extensions: frame.extensions,
  }) as SecurityAuditEvent;

  const transformed = applyTransformations(config, candidate, definition);
  if (!transformed.ok) return transformed;
  const validated = validateSecurityAuditEvent(transformed.value);
  if (!validated.ok) return validated;
  return {
    ok: true,
    value: {
      event: deepFreeze(clonePlain(validated.value)) as Readonly<EventForName<EventName>>,
      deliveryIntent: { kind: "named_execution" },
    },
  };
}

function validateNamedRedeliveryBinding(
  event: SecurityAuditEvent,
  operation: AuditOperationSnapshot | undefined,
): AuditResult<void> {
  if (!operation) return { ok: true, value: undefined };
  if (event.correlation.operation_id !== operation.operation_id) {
    return failure("SDK_OPERATION_EVENT_MISMATCH", "lifecycle", "/correlation/operation_id");
  }
  if (event.correlation.correlation_id !== operation.correlation_id) {
    return failure("SDK_OPERATION_EVENT_MISMATCH", "lifecycle", "/correlation/correlation_id");
  }
  if (event.correlation.transaction_id !== operation.transaction_id) {
    return failure("SDK_OPERATION_EVENT_MISMATCH", "lifecycle", "/correlation/transaction_id");
  }
  return { ok: true, value: undefined };
}

function pickFrameInput(input: AnyNamedInput): AuditContextFrame {
  return omitUndefined({
    actor: input.actor,
    subject: input.subject,
    authenticated_principal: input.authenticated_principal,
    delegation: input.delegation,
    credential: input.credential,
    tenant: input.tenant,
    claimedTenant: input.claimedTenant,
    resource: input.resource,
    authentication: input.authentication,
    authorization: input.authorization,
    request: input.request,
    source: input.source,
    destination: input.destination,
    session: input.session,
    correlation: input.correlation,
    initiator: input.initiator,
    data: input.data,
    risk: input.risk,
    integrity: input.integrity,
    extensions: input.extensions,
  }) as unknown as AuditContextFrame;
}


function buildTenant(frame: AuditContextFrame): SecurityAuditEvent["tenant"] | undefined {
  if (!frame.tenant) return undefined;
  return omitUndefined({
    ...frame.tenant,
    claimed_tenant_id: frame.claimedTenant?.claimed_tenant_id,
  }) as SecurityAuditEvent["tenant"];
}

function defaultLifecycle(definition: EventDefinition): SecurityAuditEvent["event"]["lifecycle_phase"] {
  const phases = definition.phase as readonly SecurityAuditEvent["event"]["lifecycle_phase"][];
  return phases.includes("completed") ? "completed" : phases[0] ?? "completed";
}

function defaultOutcome(definition: EventDefinition, operation: GeneratedOperationContext | undefined): SecurityAuditEvent["event"]["outcome"] {
  const outcomes = definition.outcomes as readonly SecurityAuditEvent["event"]["outcome"][];
  if (operation?.state === "cancelled") return outcomes.includes("cancelled") ? "cancelled" : (outcomes.includes("failure") ? "failure" : outcomes[0] ?? "unknown");
  if (operation?.state === "not_committed") return outcomes.includes("failure") ? "failure" : outcomes[0] ?? "unknown";
  if (operation?.state === "partially_committed") return outcomes.includes("partial") ? "partial" : outcomes[0] ?? "unknown";
  if (operation?.state === "compensated") return outcomes.includes("partial") ? "partial" : outcomes[0] ?? "unknown";
  return outcomes[0] ?? "unknown";
}

/**
 * Terminal commit states (committed/not_committed/partially_committed/compensated) may only
 * originate from a real operation snapshot. A caller cannot manufacture "committed" by passing
 * `event.commit_state` directly without ever transitioning an operation handle — that would make
 * premature success trivial and discard transition evidence.
 */
function resolveCommitState(
  definition: EventDefinition,
  outcome: string,
  directCommit: SecurityAuditEvent["event"]["commit_state"] | undefined,
  operation: GeneratedOperationContext | undefined,
): AuditResult<SecurityAuditEvent["event"]["commit_state"]> {
  const commits = definition.commit as readonly string[];
  const operationCommit = operation?.commit_state;
  if (directCommit && terminalCommitStates.has(directCommit) && directCommit !== operationCommit) {
    return failure("PREMATURE_SUCCESS", "validation", "/event/commit_state");
  }
  if (operationCommit) {
    if (outcome === "success" && operationCommit === "pending") {
      return failure("PREMATURE_SUCCESS", "validation", "/operation/state");
    }
    return { ok: true, value: operationCommit as SecurityAuditEvent["event"]["commit_state"] };
  }
  if (directCommit) return { ok: true, value: directCommit };
  if (commits.includes("not_applicable")) return { ok: true, value: "not_applicable" };
  if (outcome === "success" && commits.includes("committed")) return failure("PREMATURE_SUCCESS", "validation", "/operation/state");
  return { ok: true, value: (commits[0] as SecurityAuditEvent["event"]["commit_state"]) ?? "unknown" };
}

function buildCorrelation(
  config: NormalizedSdkConfiguration,
  frame: AuditContextFrame,
  input: AnyNamedInput,
  operation: GeneratedOperationContext | undefined,
): AuditResult<SecurityAuditEvent["correlation"]> {
  const retry = input.retry;
  if (retry && retry.retry_attempt > 0 && !retry.original_event_id) {
    return failure("BAD_CAUSALITY", "validation", "/correlation/original_event_id");
  }
  const operationId = operation?.operation_id ?? frame.correlation?.operation_id ?? config.identifiers.operationId();
  const correlationId = (operation as AuditOperationSnapshot | undefined)?.correlation_id ?? frame.correlation?.correlation_id ?? config.identifiers.correlationId();
  const requestId = frame.correlation?.request_id ?? frame.request?.id;
  const messageId = frame.correlation?.message_id ?? frame.request?.message_id;
  return {
    ok: true,
    value: omitUndefined({
      trace_id: frame.correlation?.trace_id,
      span_id: frame.correlation?.span_id,
      correlation_id: correlationId,
      causation_id: retry?.causation_id ?? frame.correlation?.causation_id,
      operation_id: operationId,
      transaction_id: operation?.transaction_id ?? frame.correlation?.transaction_id,
      request_id: requestId,
      message_id: messageId,
      retry_attempt: retry?.retry_attempt ?? frame.correlation?.retry_attempt ?? 0,
      original_event_id: retry?.original_event_id ?? frame.correlation?.original_event_id,
    }) as SecurityAuditEvent["correlation"],
  };
}

function applyTransformations(
  config: NormalizedSdkConfiguration,
  event: SecurityAuditEvent,
  definition: EventDefinition,
): AuditResult<SecurityAuditEvent> {
  if (config.transformations.length === 0) return { ok: true, value: event };
  const candidate = clonePlain(event);
  for (const transformation of config.transformations) {
    const rejection = applyOneTransformation(candidate, transformation, definition);
    if (rejection) return rejection;
  }
  return { ok: true, value: candidate };
}

// Mutates candidate in place. Returns a failure to propagate, or undefined when
// the transformation applied or was skipped.
function applyOneTransformation(
  candidate: SecurityAuditEvent,
  transformation: NormalizedSdkConfiguration["transformations"][number],
  definition: EventDefinition,
): AuditResult<SecurityAuditEvent> | undefined {
  const { hook, path } = transformation;
  const pointer = `/${path.replaceAll(".", "/")}`;
  const policy = fieldPolicyForPath(path);
  if (!policy) return failure("SDK_INVALID_CONFIGURATION", "configuration", `/transformations/${path}`);
  if (!isTransformableFieldPath(path)) return failure("SDK_HOOK_FAILURE", "privacy", pointer);
  const current = readPath(candidate, path);
  if (current === undefined) return undefined;
  if (typeof current !== "string") return failure("SDK_HOOK_FAILURE", "privacy", pointer);
  const preScan = validateNoProhibitedData({ value: current });
  if (!preScan.ok) return preScan;
  let output: AuditTransformationOutput | string | undefined;
  try {
    output = hook.transform(omitUndefined({
      path,
      value: current,
      tenantId: candidate.tenant.effective_tenant_id,
      purpose: definition.semantic,
    }) as Parameters<typeof hook.transform>[0]);
  } catch {
    return failure("SDK_HOOK_FAILURE", "privacy", pointer);
  }
  if (output !== null && typeof output === "object" && typeof (output as { then?: unknown }).then === "function") {
    return failure("SDK_UNSUPPORTED_HOOK_RESULT", "privacy", pointer);
  }
  if (output === undefined) return undefined;
  const next = typeof output === "string" ? output : output.value;
  if (typeof next !== "string" || next.length === 0 || next.length > 512) {
    return failure("SDK_HOOK_FAILURE", "privacy", pointer);
  }
  const postScan = validateNoProhibitedData({ value: next });
  if (!postScan.ok) return postScan;
  writePath(candidate, path, next);
  if (typeof output !== "string" && output.key_id !== undefined) {
    if (typeof output.key_id !== "string" || output.key_id.length > 80) return failure("SDK_HOOK_FAILURE", "privacy", `${pointer}/key_id`);
  }
  return undefined;
}

function readPath(value: SecurityAuditEvent, path: string): unknown {
  let cursor: unknown = value;
  for (const part of path.split(".")) {
    if (!cursor || typeof cursor !== "object") return undefined;
    cursor = (cursor as Record<string, unknown>)[part];
  }
  return cursor;
}

function writePath(value: SecurityAuditEvent, path: string, next: string): void {
  const parts = path.split(".");
  let cursor: Record<string, unknown> = value as unknown as Record<string, unknown>;
  for (const part of parts.slice(0, -1)) {
    const child = cursor[part];
    if (!child || typeof child !== "object") return;
    cursor = child as Record<string, unknown>;
  }
  const leaf = parts.at(-1);
  if (leaf) cursor[leaf] = next;
}

function defaultInitiator(config: NormalizedSdkConfiguration): SecurityAuditEvent["initiator"] {
  return omitUndefined({
    type: "service",
    id: config.service.name,
    version: config.service.version,
  }) as SecurityAuditEvent["initiator"];
}

function withDerivedOperationType(resource: SecurityAuditEvent["resource"] | undefined, definition: EventDefinition): SecurityAuditEvent["resource"] {
  const operationType = operationTypeForAction(definition.action);
  if (resource) return resource.operation_type ? resource : { ...resource, operation_type: operationType };
  return { operation_type: operationType };
}

function operationTypeForAction(action: string): SecurityAuditEvent["resource"]["operation_type"] {
  switch (action) {
    case "register":
    case "enroll_mfa":
    case "create_session":
    case "assign_role":
    case "start_impersonation":
    case "create":
      return "create";
    case "remove_mfa":
    case "revoke_session":
    case "remove_role":
    case "end_impersonation":
    case "delete":
      return "delete";
    case "view":
      return "read";
    case "modify":
    case "complete_password_reset":
      return "update";
    case "export":
      return "export";
    case "change_security_configuration":
      return "configure";
    default:
      return "execute";
  }
}

function nowIso(config: NormalizedSdkConfiguration): AuditResult<string> {
  const value = config.clock.now();
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) {
    return failure("SDK_INVALID_CLOCK", "configuration", "/clock");
  }
  return { ok: true, value: value.toISOString() };
}

function resolveEventDefinition(method: EventMethodName): AuditResult<EventDefinition> {
  const methodDefinition = methodsByName.get(method);
  if (!methodDefinition) return failure("UNKNOWN_CATALOG_VALUE", "validation", "/event/name");
  const definition = definitionsByName.get(methodDefinition.name as EventName);
  if (!definition) return failure("UNKNOWN_CATALOG_VALUE", "validation", "/event/name");
  return { ok: true, value: definition };
}

function resolveContextFrame(
  config: NormalizedSdkConfiguration,
  activeContext: AuditContextFrame | undefined,
  normalizedInput: AnyNamedInput,
): AuditResult<AuditContextFrame> {
  const configAndActive = mergeAuditContextFrames(config.authoritativeContext, activeContext);
  if (!configAndActive.ok) return configAndActive;
  return mergeAuditContextFrames(configAndActive.value, pickFrameInput(normalizedInput));
}

function resolveTimestamps(
  config: NormalizedSdkConfiguration,
  normalizedInput: AnyNamedInput,
): AuditResult<{ readonly timestamp: string; readonly observedAt: string }> {
  const timestampResult = normalizedInput.event?.timestamp === undefined ? nowIso(config) : { ok: true as const, value: normalizedInput.event.timestamp };
  if (!timestampResult.ok) return timestampResult;
  const observedAtResult = normalizedInput.event?.observed_at === undefined ? nowIso(config) : { ok: true as const, value: normalizedInput.event.observed_at };
  if (!observedAtResult.ok) return observedAtResult;
  return { ok: true, value: { timestamp: timestampResult.value, observedAt: observedAtResult.value } };
}
