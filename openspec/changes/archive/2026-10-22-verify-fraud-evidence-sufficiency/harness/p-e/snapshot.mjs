// Implementer default: snapshot public values at call completion, never live
// SDK closures or handles. Property reads are not extra public invocations.
const OPAQUE = Object.freeze({ representation: "opaque public return" });
const FACTORIES = new Set(["createNodeSecurityAuditSdk", "createCapturingAuditSink", "createHttpDeliveryHandoff", "createTransactionCriticalDelivery"]);
const HANDLE_FIELDS = ["operationId", "transactionId", "correlationId", "boundEvent", "transactional", "state"];

function handleValue(handle) {
  return { representation: "operation handle public getters", frozen: Object.isFrozen(handle),
    ...Object.fromEntries(HANDLE_FIELDS.map((field) => [field, handle[field]])) };
}

function opaque(value) {
  return { ...OPAQUE, value_type: typeof value };
}

function dataSnapshot(value, seen) {
  if (typeof value === "function" || typeof value === "symbol") return opaque(value);
  if (value === null || typeof value !== "object") return value;
  if (seen.has(value)) return opaque(value);
  seen.add(value);
  if (Array.isArray(value)) return value.map((item) => dataSnapshot(item, seen));
  if (![Object.prototype, null].includes(Object.getPrototypeOf(value))) return opaque(value);
  return Object.fromEntries(Object.entries(Object.getOwnPropertyDescriptors(value)).map(([key, descriptor]) =>
    [key, Object.hasOwn(descriptor, "value") ? dataSnapshot(descriptor.value, seen) : opaque(descriptor.get)]));
}

export function publicSnapshot({ label, value }) {
  const method = label.split(":").at(-1);
  if (FACTORIES.has(method)) return { ...OPAQUE, frozen: Object.isFrozen(value) };
  if (method === "beginOperation" && value.ok) return { ok: true, value: handleValue(value.value) };
  return dataSnapshot(value, new WeakSet());
}

export function bindingOutcome(outcome) {
  if (outcome.kind !== "returned") return outcome;
  if (outcome.raw === null || typeof outcome.raw !== "object") return outcome;
  if (outcome.raw.status !== "refused") return outcome;
  return { ...outcome, accepted: false, unexpected_acceptance: false, diagnostic: { code: outcome.raw.code } };
}

export function callOutcome({ outcome, ordinal }) {
  const label = outcome.kind === "returned" ? outcome.label : "";
  return { ...bindingOutcome(outcome), ordinal, raw: publicSnapshot({ label, value: outcome.raw }) };
}
