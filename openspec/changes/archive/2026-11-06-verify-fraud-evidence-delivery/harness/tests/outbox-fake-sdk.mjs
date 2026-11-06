// Deliberately scoped SDK model: context authority, operation authority, catalog and sink boundary.
import { validateSdkConfig } from "./copies-fake-sdk.mjs";
import { buildOutboxAuditEvent } from "./outbox-fake-events.mjs";
import { operationAuthority } from "./outbox-fake-operations.mjs";
import { emitToFakeSink } from "./fake-sdk-common.mjs";

export function createOutboxNodeSecurityAuditSdk(config) {
  validateSdkConfig(config);
  const authority = operationAuthority();
  async function emit(method, input) {
    const invalid = authority.check(input.operation, method);
    if (invalid) return invalid;
    const built = buildOutboxAuditEvent({ method, input, config });
    if (!built.ok) return built;
    return emitToFakeSink(config.sink, built.event);
  }
  return {
    beginOperation: authority.beginOperation,
    roleAssigned: (input) => emit("roleAssigned", input),
    sensitiveResourceModified: (input) => emit("sensitiveResourceModified", input),
  };
}
