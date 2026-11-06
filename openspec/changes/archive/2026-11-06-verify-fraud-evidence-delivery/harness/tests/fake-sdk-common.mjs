// Shared SDK test primitives. Each probe owns a separate authority registry.
export function createBrandRegistry() {
  const brands = new WeakMap();
  return {
    brand(kind, input) {
      const value = Object.freeze(structuredClone(input));
      brands.set(value, kind);
      return value;
    },
    has: (value, kind) => brands.get(value) === kind,
  };
}

export function fakeFailure(code, path, category = "validation") {
  return { ok: false, error: { code, path, category } };
}

export function checkOperationEvidence(evidence, method) {
  if (!evidence) return fakeFailure("SDK_INVALID_OPERATION_TRANSITION", "/operation", "lifecycle");
  const mismatch = evidence.boundEvent !== undefined && evidence.boundEvent !== method;
  if (mismatch) return fakeFailure("SDK_OPERATION_EVENT_MISMATCH", "/operation/bound_event", "lifecycle");
  return null;
}

export async function emitToFakeSink(sink, event, { includeCaughtError = false } = {}) {
  try {
    const result = await sink.emit(event);
    if (result.status === "accepted") return { ok: true, value: result };
    const code = result.status === "rejected" ? "SDK_SINK_REJECTED" : "SDK_SINK_FAILURE";
    return fakeFailure(code, "/sink", "sink");
  } catch (error) {
    const failure = fakeFailure("SDK_SINK_FAILURE", "/sink", "sink");
    return includeCaughtError ? { ...failure, caught_sink_error: error.message } : failure;
  }
}
