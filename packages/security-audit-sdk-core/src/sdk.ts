import type { NormalizedSdkConfiguration, SecurityAuditSdkConfiguration } from "./config.js";
import { normalizeConfiguration } from "./config.js";
import type { AuditContextFrameInput } from "./context.js";
import { currentAuditContext, runWithAuditContext } from "./context.js";
import { buildNamedAuditEvent } from "./events.js";
import { failure, normalizeCanonicalInput } from "./errors.js";
import type { AuditResult } from "./errors.js";
import type { EventDefinition, EventMethodName, EventName, GeneratedOperationContext, NamedAuditEventInputMap, SecurityAuditEvent } from "./generated/contract.generated.js";
import { EVENT_CATALOG, EVENT_METHODS } from "./generated/contract.generated.js";
import type { AuditOperationAuthority, AuditOperationHandle, AuditOperationInput, AuditOperationSnapshot } from "./operations.js";
import { createAuditOperationAuthority } from "./operations.js";
import type { AuditDeliveryResult } from "./sink.js";
import { validateSecurityAuditEvent } from "./validation/index.js";
import type { DeliveryIntent } from "./internal.js";
import { BoundedFifoSet } from "./bounded-fifo.js";

export type SecurityAuditSdkState = "ready" | "shutting_down" | "shut_down";

type RetryContext = { readonly correlation?: { readonly retry_attempt?: number } };

export interface SdkRetentionStateForTesting {
  readonly generatedEventIds: { readonly size: number; readonly capacity: number };
  readonly issuedOperationIds: { readonly size: number; readonly capacity: number };
}

interface SdkRetentionStores {
  readonly generatedEventIds: BoundedFifoSet<string>;
  readonly issuedOperationIds: BoundedFifoSet<string>;
}

const retentionStoresBySdk = new WeakMap<object, SdkRetentionStores>();

type WithOperationHandle<T> =
  T extends { readonly operation: infer O }
    ? Omit<T, "operation"> & { readonly operation: AuditOperationHandle }
    : Omit<T, "operation"> & { readonly operation?: AuditOperationHandle };

export type NamedSecurityAuditApi = {
  readonly [M in EventMethodName]: (input: WithOperationHandle<NamedAuditEventInputMap[M]>) => Promise<AuditResult<AuditDeliveryResult>>;
};

export type SecurityAuditSdk = NamedSecurityAuditApi & {
  readonly state: SecurityAuditSdkState;
  emit(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>>;
  redeliver(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>>;
  beginOperation(input?: AuditOperationInput): AuditResult<AuditOperationHandle>;
  runWithContext<T>(frame: AuditContextFrameInput, callback: () => T): T;
  flush(): Promise<AuditResult<void>>;
  shutdown(): Promise<AuditResult<void>>;
};

class SecurityAuditSdkImpl implements SecurityAuditSdk {
  #state: SecurityAuditSdkState = "ready";
  readonly #config: NormalizedSdkConfiguration;
  readonly #inFlight = new Set<Promise<unknown>>();
  readonly #generatedEventIds: BoundedFifoSet<string>;
  readonly #issuedOperationIds: BoundedFifoSet<string>;
  readonly #operationAuthority: AuditOperationAuthority;
  #shutdownPromise: Promise<AuditResult<void>> | undefined;

  constructor(config: NormalizedSdkConfiguration) {
    this.#config = config;
    this.#generatedEventIds = new BoundedFifoSet(config.retention.recentGeneratedEventIds);
    this.#issuedOperationIds = new BoundedFifoSet(config.retention.recentIssuedOperationIds);
    this.#operationAuthority = createAuditOperationAuthority(config.identifiers);
    retentionStoresBySdk.set(this, {
      generatedEventIds: this.#generatedEventIds,
      issuedOperationIds: this.#issuedOperationIds,
    });
  }
  get state(): SecurityAuditSdkState { return this.#state; }

  async emit(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#deliverValidatedEvent(event, { kind: "generic_emit" });
  }

  async redeliver(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#deliverValidatedEvent(event, { kind: "pure_redelivery" });
  }

  beginOperation(input: AuditOperationInput = {}): AuditResult<AuditOperationHandle> {
    if (this.#state !== "ready") return failure(this.#state === "shut_down" ? "SDK_SHUT_DOWN" : "SDK_SHUTTING_DOWN", "lifecycle");
    const normalized = normalizeCanonicalInput(input, "/operation");
    if (!normalized.ok) return normalized;
    const normalizedInput = normalized.value.value;
    if (normalizedInput.boundEvent !== undefined && !EVENT_METHODS.some((entry) => entry.method === normalizedInput.boundEvent)) {
      return failure("UNKNOWN_CATALOG_VALUE", "validation", "/operation/bound_event");
    }
    const operation = this.#operationAuthority.issue(normalizedInput);
    const valid = validateGeneratedIdentifier(operation.operationId, "/operation/operation_id")
      ?? validateGeneratedIdentifier(operation.transactionId, "/operation/transaction_id")
      ?? validateGeneratedIdentifier(operation.correlationId, "/operation/correlation_id");
    if (valid) return valid;
    if (this.#issuedOperationIds.has(operation.operationId)) {
      return failure("SDK_INVALID_IDENTIFIER", "validation", "/operation/operation_id");
    }
    this.#issuedOperationIds.add(operation.operationId);
    return { ok: true, value: operation };
  }

  runWithContext<T>(frame: AuditContextFrameInput, callback: () => T): T {
    return runWithAuditContext(frame, callback);
  }

  accountRegistrationAttempted(input: WithOperationHandle<NamedAuditEventInputMap["accountRegistrationAttempted"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("accountRegistrationAttempted", input);
  }

  accountRegistrationCompleted(input: WithOperationHandle<NamedAuditEventInputMap["accountRegistrationCompleted"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("accountRegistrationCompleted", input);
  }

  authenticationSucceeded(input: WithOperationHandle<NamedAuditEventInputMap["authenticationSucceeded"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("authenticationSucceeded", input);
  }

  authenticationFailed(input: WithOperationHandle<NamedAuditEventInputMap["authenticationFailed"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("authenticationFailed", input);
  }

  mfaEnrolled(input: WithOperationHandle<NamedAuditEventInputMap["mfaEnrolled"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("mfaEnrolled", input);
  }

  mfaRemoved(input: WithOperationHandle<NamedAuditEventInputMap["mfaRemoved"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("mfaRemoved", input);
  }

  sessionCreated(input: WithOperationHandle<NamedAuditEventInputMap["sessionCreated"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("sessionCreated", input);
  }

  sessionRevoked(input: WithOperationHandle<NamedAuditEventInputMap["sessionRevoked"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("sessionRevoked", input);
  }

  passwordResetRequested(input: WithOperationHandle<NamedAuditEventInputMap["passwordResetRequested"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("passwordResetRequested", input);
  }

  passwordResetCompleted(input: WithOperationHandle<NamedAuditEventInputMap["passwordResetCompleted"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("passwordResetCompleted", input);
  }

  authorizationAllowed(input: WithOperationHandle<NamedAuditEventInputMap["authorizationAllowed"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("authorizationAllowed", input);
  }

  authorizationDenied(input: WithOperationHandle<NamedAuditEventInputMap["authorizationDenied"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("authorizationDenied", input);
  }

  roleAssigned(input: WithOperationHandle<NamedAuditEventInputMap["roleAssigned"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("roleAssigned", input);
  }

  roleRemoved(input: WithOperationHandle<NamedAuditEventInputMap["roleRemoved"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("roleRemoved", input);
  }

  privilegeElevated(input: WithOperationHandle<NamedAuditEventInputMap["privilegeElevated"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("privilegeElevated", input);
  }

  impersonationStarted(input: WithOperationHandle<NamedAuditEventInputMap["impersonationStarted"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("impersonationStarted", input);
  }

  impersonationEnded(input: WithOperationHandle<NamedAuditEventInputMap["impersonationEnded"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("impersonationEnded", input);
  }

  sensitiveResourceViewed(input: WithOperationHandle<NamedAuditEventInputMap["sensitiveResourceViewed"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("sensitiveResourceViewed", input);
  }

  sensitiveResourceCreated(input: WithOperationHandle<NamedAuditEventInputMap["sensitiveResourceCreated"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("sensitiveResourceCreated", input);
  }

  sensitiveResourceModified(input: WithOperationHandle<NamedAuditEventInputMap["sensitiveResourceModified"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("sensitiveResourceModified", input);
  }

  sensitiveResourceDeleted(input: WithOperationHandle<NamedAuditEventInputMap["sensitiveResourceDeleted"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("sensitiveResourceDeleted", input);
  }

  sensitiveDataExported(input: WithOperationHandle<NamedAuditEventInputMap["sensitiveDataExported"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("sensitiveDataExported", input);
  }

  securityConfigurationChanged(input: WithOperationHandle<NamedAuditEventInputMap["securityConfigurationChanged"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("securityConfigurationChanged", input);
  }

  tenantContextViolationDetected(input: WithOperationHandle<NamedAuditEventInputMap["tenantContextViolationDetected"]>): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitNamed("tenantContextViolationDetected", input);
  }

  async #emitNamed<M extends EventMethodName>(
    method: M,
    input: WithOperationHandle<NamedAuditEventInputMap[M]>,
  ): Promise<AuditResult<AuditDeliveryResult>> {
    if (this.#state !== "ready") return failure(this.#state === "shut_down" ? "SDK_SHUT_DOWN" : "SDK_SHUTTING_DOWN", "lifecycle");
    let suppliedOperation: unknown;
    try {
      suppliedOperation = (input as { readonly operation?: unknown }).operation;
    } catch {
      return failure("SDK_INVALID_INPUT", "validation", "/operation");
    }
    const operation = this.#operationAuthority.resolve(suppliedOperation);
    if (!operation.ok) return operation;
    const activeContext = currentAuditContext();
    let candidateEvent: EventName | undefined;
    try {
      candidateEvent = terminalSuccessAttemptEvent(method, operation.value, input, activeContext, this.#config.authoritativeContext);
    } catch {
      return failure("SDK_INVALID_INPUT", "validation", "/");
    }
    if (candidateEvent && suppliedOperation !== undefined) {
      const completion = this.#operationAuthority.completionState(suppliedOperation, candidateEvent);
      if (!completion.ok) return completion;
      if (completion.value !== undefined) {
        return failure("SDK_DUPLICATE_SUCCESS", "lifecycle", "/operation/state");
      }
    }
    let built;
    try {
      built = buildNamedAuditEvent(
        this.#config,
        method,
        { ...input, operation: operation.value } as never,
        activeContext,
      );
    } catch {
      return failure("SDK_INVALID_INPUT", "validation", "/");
    }
    if (!built.ok) return built;
    if (built.value.deliveryIntent.kind === "named_redelivery") {
      return this.#deliverValidatedEvent(built.value.event, built.value.deliveryIntent);
    }
    if (this.#generatedEventIds.has(built.value.event.event.id)) {
      return failure("SDK_INVALID_IDENTIFIER", "validation", "/event/id");
    }
    const completionEvent = terminalSuccessEvent(built.value.event);
    if (completionEvent && suppliedOperation !== undefined) {
      const reserved = this.#operationAuthority.reserveCompletion(suppliedOperation, completionEvent);
      if (!reserved.ok) return reserved;
      if (!reserved.value) return failure("SDK_DUPLICATE_SUCCESS", "lifecycle", "/operation/state");
    }
    this.#generatedEventIds.add(built.value.event.event.id);
    try {
      const result = await this.#deliverValidatedEvent(built.value.event, built.value.deliveryIntent);
      if (result.ok && completionEvent && suppliedOperation !== undefined) {
        this.#operationAuthority.completeCompletion(suppliedOperation, completionEvent);
      }
      return result;
    } finally {
      if (completionEvent && suppliedOperation !== undefined) {
        this.#operationAuthority.releaseCompletion(suppliedOperation, completionEvent);
      }
    }
  }

  async #deliverValidatedEvent(
    event: SecurityAuditEvent,
    intent: DeliveryIntent,
  ): Promise<AuditResult<AuditDeliveryResult>> {
    if (this.#state !== "ready") return failure(this.#state === "shut_down" ? "SDK_SHUT_DOWN" : "SDK_SHUTTING_DOWN", "lifecycle");
    const validated = validateSecurityAuditEvent(event);
    if (!validated.ok) return validated;
    return this.#handoffValidatedEvent(validated.value, intent);
  }

  async #handoffValidatedEvent(
    event: Readonly<SecurityAuditEvent>,
    intent: DeliveryIntent,
  ): Promise<AuditResult<AuditDeliveryResult>> {
    assertDeliveryIntent(intent);
    let pending: Promise<AuditDeliveryResult>;
    try {
      pending = this.#config.sink.emit(event);
    } catch {
      return failure("SDK_SINK_FAILURE", "sink", "/sink", {
        eventName: event.event.name,
      });
    }
    this.#inFlight.add(pending);
    try {
      const result = await pending;
      if (result.status === "accepted") return { ok: true, value: result };
      return failure(result.status === "rejected" ? "SDK_SINK_REJECTED" : "SDK_SINK_FAILURE", "sink", "/sink", {
        eventName: event.event.name,
      });
    } catch {
      return failure("SDK_SINK_FAILURE", "sink", "/sink", {
        eventName: event.event.name,
      });
    } finally {
      this.#inFlight.delete(pending);
    }
  }

  async flush(): Promise<AuditResult<void>> {
    if (this.#state === "shut_down") return failure("SDK_SHUT_DOWN", "lifecycle");
    try { await this.#config.sink.flush?.(); return { ok: true, value: undefined }; }
    catch { return failure("SDK_SINK_FAILURE", "sink"); }
  }

  shutdown(): Promise<AuditResult<void>> {
    if (this.#state === "shut_down") return Promise.resolve(failure("SDK_SHUT_DOWN", "lifecycle"));
    this.#shutdownPromise ??= this.#performShutdown();
    return this.#shutdownPromise;
  }

  async #performShutdown(): Promise<AuditResult<void>> {
    if (this.#state === "shut_down") return failure("SDK_SHUT_DOWN", "lifecycle");
    this.#state = "shutting_down";
    const timeout = createShutdownTimeout(this.#config.shutdownTimeoutMs);
    try {
      const settled = Promise.allSettled([...this.#inFlight]).then(() => true);
      if (!(await Promise.race([settled, timeout.promise]))) {
        this.#state = "shut_down";
        return failure("SDK_SHUTDOWN_TIMEOUT", "lifecycle");
      }
      try {
        await this.#config.sink.flush?.();
        await this.#config.sink.shutdown?.();
        this.#state = "shut_down";
        return { ok: true, value: undefined };
      } catch {
        this.#state = "shut_down";
        return failure("SDK_SINK_FAILURE", "sink");
      }
    } finally {
      timeout.cancel();
    }
  }
}

function assertDeliveryIntent(intent: DeliveryIntent): void {
  switch (intent.kind) {
    case "generic_emit":
    case "pure_redelivery":
    case "named_execution":
    case "named_redelivery":
      return;
  }
  const exhaustive: never = intent;
  throw new TypeError(`unsupported delivery intent: ${String(exhaustive)}`);
}

type ShutdownTimeout = {
  readonly promise: Promise<false>;
  cancel(): void;
};

function createShutdownTimeout(timeoutMs: number): ShutdownTimeout {
  let cancelled = false;
  let resolveTimeout: (value: false) => void = () => {};
  const promise = new Promise<false>((resolve) => {
    resolveTimeout = resolve;
  });
  const timer = setTimeout(() => resolveTimeout(false), timeoutMs);
  timer.unref();
  return {
    promise,
    cancel() {
      if (cancelled) return;
      cancelled = true;
      clearTimeout(timer);
    },
  };
}

export function createSecurityAuditSdk(configuration: SecurityAuditSdkConfiguration): SecurityAuditSdk {
  return Object.freeze(new SecurityAuditSdkImpl(normalizeConfiguration(configuration)));
}

export function inspectSdkRetentionForTesting(sdk: unknown): SdkRetentionStateForTesting | undefined {
  if ((typeof sdk !== "object" && typeof sdk !== "function") || sdk === null) return undefined;
  const stores = retentionStoresBySdk.get(sdk);
  if (!stores) return undefined;
  return Object.freeze({
    generatedEventIds: Object.freeze({ size: stores.generatedEventIds.size, capacity: stores.generatedEventIds.capacity }),
    issuedOperationIds: Object.freeze({ size: stores.issuedOperationIds.size, capacity: stores.issuedOperationIds.capacity }),
  });
}

function terminalSuccessEvent(event: SecurityAuditEvent): EventName | undefined {
  if (event.event.outcome !== "success" || event.event.lifecycle_phase !== "completed") return undefined;
  if (event.correlation.retry_attempt) return undefined; // explicit retries are a sanctioned re-attempt mechanism, not a duplicate
  if (!event.correlation.operation_id) return undefined;
  return event.event.name;
}

const eventDefinitionByMethod = new Map<EventMethodName, EventDefinition>(EVENT_METHODS.flatMap((entry) => {
  const definition = EVENT_CATALOG.find((candidate) => candidate.name === entry.name);
  return definition ? [[entry.method, definition]] : [];
}));

function terminalSuccessAttemptEvent(
  method: EventMethodName,
  operation: AuditOperationSnapshot | undefined,
  input: unknown,
  activeContext: RetryContext | undefined,
  authoritativeContext: RetryContext,
): EventName | undefined {
  if (!operation) return undefined;
  const candidate = input as {
    readonly redelivery?: { readonly event?: unknown };
    readonly event?: { readonly lifecycle_phase?: string; readonly outcome?: string };
    readonly correlation?: { readonly retry_attempt?: number };
  };
  if (candidate.redelivery?.event) return undefined;
  const retryAttempt = candidate.correlation?.retry_attempt
    ?? activeContext?.correlation?.retry_attempt
    ?? authoritativeContext.correlation?.retry_attempt;
  if (retryAttempt) return undefined;
  const definition = eventDefinitionByMethod.get(method);
  if (!definition) return undefined;
  const phases = definition.phase as readonly SecurityAuditEvent["event"]["lifecycle_phase"][];
  const lifecycle = candidate.event?.lifecycle_phase ?? (phases.includes("completed") ? "completed" : phases[0]);
  if (lifecycle !== "completed") return undefined;
  const outcome = candidate.event?.outcome ?? defaultOperationOutcome(definition, operation);
  if (outcome !== "success") return undefined;
  return definition.name;
}

function defaultOperationOutcome(definition: EventDefinition, operation: GeneratedOperationContext): SecurityAuditEvent["event"]["outcome"] | undefined {
  const outcomes = definition.outcomes as readonly SecurityAuditEvent["event"]["outcome"][];
  if (operation.state === "cancelled") return outcomes.includes("cancelled") ? "cancelled" : (outcomes.includes("failure") ? "failure" : outcomes[0]);
  if (operation.state === "not_committed") return outcomes.includes("failure") ? "failure" : outcomes[0];
  if (operation.state === "partially_committed" || operation.state === "compensated") return outcomes.includes("partial") ? "partial" : outcomes[0];
  return outcomes[0];
}

const trustedIdentifierPattern = /^[\x21-\x7e]+$/;

function validateGeneratedIdentifier(value: string, path: string): AuditResult<never> | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 128 || !trustedIdentifierPattern.test(value)) {
    return failure("SDK_INVALID_IDENTIFIER", "validation", path);
  }
  return undefined;
}
