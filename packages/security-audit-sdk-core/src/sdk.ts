import type { NormalizedSdkConfiguration, SecurityAuditSdkConfiguration } from "./config.js";
import { normalizeConfiguration } from "./config.js";
import type { AuditContextFrameInput } from "./context.js";
import { currentAuditContext, runWithAuditContext } from "./context.js";
import { buildNamedAuditEvent } from "./events.js";
import { failure } from "./errors.js";
import type { AuditResult } from "./errors.js";
import type { EventMethodName, GeneratedOperationContext, NamedAuditEventInputMap, SecurityAuditEvent } from "./generated/contract.generated.js";
import { EVENT_METHODS } from "./generated/contract.generated.js";
import type { AuditOperationHandle, AuditOperationInput } from "./operations.js";
import { createAuditOperation } from "./operations.js";
import type { AuditDeliveryResult } from "./sink.js";
import { validateSecurityAuditEvent } from "./validation/index.js";
import { clonePlain, deepFreeze } from "./internal.js";

export type SecurityAuditSdkState = "ready" | "shutting_down" | "shut_down";

type WithOperationHandle<T> =
  T extends { readonly operation: infer O }
    ? Omit<T, "operation"> & { readonly operation: O | AuditOperationHandle }
    : T & { readonly operation?: GeneratedOperationContext | AuditOperationHandle };

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

class SecurityAuditSdkImpl {
  #state: SecurityAuditSdkState = "ready";
  readonly #config: NormalizedSdkConfiguration;
  readonly #inFlight = new Set<Promise<unknown>>();
  readonly #generatedEventIds = new Set<string>();
  readonly #completedOperations = new Set<string>();
  readonly #issuedOperationIds = new Set<string>();
  #shutdownPromise: Promise<AuditResult<void>> | undefined;

  constructor(config: NormalizedSdkConfiguration) { this.#config = config; }
  get state(): SecurityAuditSdkState { return this.#state; }

  async emit(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitValidatedEvent(event);
  }

  async redeliver(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>> {
    return this.#emitValidatedEvent(event);
  }

  beginOperation(input: AuditOperationInput = {}): AuditResult<AuditOperationHandle> {
    if (this.#state !== "ready") return failure(this.#state === "shut_down" ? "SDK_SHUT_DOWN" : "SDK_SHUTTING_DOWN", "lifecycle");
    if (input.boundEvent !== undefined && !EVENT_METHODS.some((entry) => entry.method === input.boundEvent)) {
      return failure("UNKNOWN_CATALOG_VALUE", "validation", "/operation/bound_event");
    }
    const operation = createAuditOperation(this.#config.identifiers, input);
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
    const built = buildNamedAuditEvent(this.#config, method, input as never, currentAuditContext());
    if (!built.ok) return built;
    if (built.value.redelivery) return this.#emitValidatedEvent(built.value.event);
    if (this.#generatedEventIds.has(built.value.event.event.id)) {
      return failure("SDK_INVALID_IDENTIFIER", "validation", "/event/id");
    }
    const dedupeKey = successDedupeKey(built.value.event);
    if (dedupeKey && this.#completedOperations.has(dedupeKey)) {
      return failure("SDK_DUPLICATE_SUCCESS", "lifecycle", "/operation/state");
    }
    this.#generatedEventIds.add(built.value.event.event.id);
    const result = await this.#emitValidatedEvent(built.value.event);
    if (result.ok && dedupeKey) this.#completedOperations.add(dedupeKey);
    return result;
  }

  async #emitValidatedEvent(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>> {
    if (this.#state !== "ready") return failure(this.#state === "shut_down" ? "SDK_SHUT_DOWN" : "SDK_SHUTTING_DOWN", "lifecycle");
    const validated = validateSecurityAuditEvent(event);
    if (!validated.ok) return validated;
    const frozen = deepFreeze(clonePlain(validated.value));
    const pending = this.#config.sink.emit(frozen);
    this.#inFlight.add(pending);
    try {
      const result = await pending;
      if (result.status === "accepted") return { ok: true, value: result };
      return failure(result.status === "rejected" ? "SDK_SINK_REJECTED" : "SDK_SINK_FAILURE", "sink", "/sink", {
        eventName: validated.value.event.name,
        eventId: validated.value.event.id,
      });
    } catch {
      return failure("SDK_SINK_FAILURE", "sink", "/sink", {
        eventName: validated.value.event.name,
        eventId: validated.value.event.id,
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
    const settled = Promise.allSettled([...this.#inFlight]).then(() => true);
    const timedOut = new Promise<false>((resolve) => setTimeout(() => resolve(false), this.#config.shutdownTimeoutMs));
    if (!(await Promise.race([settled, timedOut]))) {
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
  }
}

export function createSecurityAuditSdk(configuration: SecurityAuditSdkConfiguration): SecurityAuditSdk {
  return Object.freeze(new SecurityAuditSdkImpl(normalizeConfiguration(configuration))) as SecurityAuditSdk;
}

function successDedupeKey(event: SecurityAuditEvent): string | undefined {
  if (event.event.outcome !== "success" || event.event.lifecycle_phase !== "completed") return undefined;
  if (event.correlation.retry_attempt) return undefined; // explicit retries are a sanctioned re-attempt mechanism, not a duplicate
  const operationId = event.correlation.operation_id;
  if (!operationId) return undefined;
  return `${operationId}:${event.event.name}`;
}

const trustedIdentifierPattern = /^[\x21-\x7e]+$/;

function validateGeneratedIdentifier(value: string, path: string): AuditResult<never> | undefined {
  if (typeof value !== "string" || value.length === 0 || value.length > 128 || !trustedIdentifierPattern.test(value)) {
    return failure("SDK_INVALID_IDENTIFIER", "validation", path);
  }
  return undefined;
}
