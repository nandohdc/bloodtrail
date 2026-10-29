// Deliberately scoped SDK model: context authority, operation authority, catalog and sink boundary.
import { validateSdkConfig } from "./copies-fake-sdk.mjs";
import { buildOutboxAuditEvent } from "./outbox-fake-events.mjs";
import { failure, operationAuthority } from "./outbox-fake-operations.mjs";

async function emitToSink(sink, event) {
  try {
    const result = await sink.emit(event);
    if (result.status === "accepted") return { ok: true, value: result };
    const code = result.status === "rejected" ? "SDK_SINK_REJECTED" : "SDK_SINK_FAILURE";
    return failure(code, "/sink", "sink");
  } catch {
    return failure("SDK_SINK_FAILURE", "/sink", "sink");
  }
}

export function createOutboxNodeSecurityAuditSdk(config) {
  validateSdkConfig(config);
  const authority = operationAuthority();
  async function emit(method, input) {
    const invalid = authority.check(input.operation, method);
    if (invalid) return invalid;
    const built = buildOutboxAuditEvent({ method, input, config });
    if (!built.ok) return built;
    return emitToSink(config.sink, built.event);
  }
  return {
    beginOperation: authority.beginOperation,
    roleAssigned: (input) => emit("roleAssigned", input),
    sensitiveResourceModified: (input) => emit("sensitiveResourceModified", input),
  };
}
