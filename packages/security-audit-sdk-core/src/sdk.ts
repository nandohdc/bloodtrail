import type { NormalizedSdkConfiguration, SecurityAuditSdkConfiguration } from "./config.js";
import { normalizeConfiguration } from "./config.js";
import { failure } from "./errors.js";
import type { AuditResult } from "./errors.js";
import type { SecurityAuditEvent } from "./generated/contract.generated.js";
import type { AuditDeliveryResult } from "./sink.js";
import { validateSecurityAuditEvent } from "./validation/index.js";

export type SecurityAuditSdkState = "ready" | "shutting_down" | "shut_down";

export interface SecurityAuditSdk {
  readonly state: SecurityAuditSdkState;
  emit(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>>;
  flush(): Promise<AuditResult<void>>;
  shutdown(): Promise<AuditResult<void>>;
}

class SecurityAuditSdkImpl implements SecurityAuditSdk {
  #state: SecurityAuditSdkState = "ready";
  readonly #config: NormalizedSdkConfiguration;
  readonly #inFlight = new Set<Promise<unknown>>();
  #shutdownPromise: Promise<AuditResult<void>> | undefined;

  constructor(config: NormalizedSdkConfiguration) { this.#config = config; }
  get state(): SecurityAuditSdkState { return this.#state; }

  async emit(event: SecurityAuditEvent): Promise<AuditResult<AuditDeliveryResult>> {
    if (this.#state !== "ready") return failure(this.#state === "shut_down" ? "SDK_SHUT_DOWN" : "SDK_SHUTTING_DOWN", "lifecycle");
    const validated = validateSecurityAuditEvent(event);
    if (!validated.ok) return validated;
    const frozen = deepFreeze(structuredClone(validated.value));
    const pending = this.#config.sink.emit(frozen);
    this.#inFlight.add(pending);
    try {
      const result = await pending;
      if (result.status === "accepted") return { ok: true, value: result };
      return failure(result.status === "rejected" ? "SDK_SINK_REJECTED" : "SDK_SINK_FAILURE", "sink");
    } catch {
      return failure("SDK_SINK_FAILURE", "sink");
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
  return Object.freeze(new SecurityAuditSdkImpl(normalizeConfiguration(configuration)));
}

function deepFreeze<T>(value: T): Readonly<T> {
  if (value && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
