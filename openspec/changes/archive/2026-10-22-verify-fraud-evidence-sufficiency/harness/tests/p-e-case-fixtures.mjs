import { fixtureState } from "./p-e-runtime-fixtures.mjs";

// Independent public-shape double for the surfaces the construction and
// ordering cases exercise, written from the pinned base sources (each cited
// beside the function that implements it). It is NOT imported by any workload
// module: workloads drive whatever core/node/testing surfaces are injected,
// so these fixtures emulate the real SDK's observable behavior without sharing
// a line of harness case code. Deterministic ids (pe-op-0001, pe-txn-0001,
// pe-event-0001, ...) stand in for the runtime's randomUUID identifiers; the
// records compare ids structurally, never by frozen literal value.

const MFA_EVENT_NAME = "bloodtrail.audit.authentication.mfa.removed";
const FIXED_TIMESTAMP = "2026-07-31T11:55:00.000Z";

// contract.generated.ts:656-671 (mfa.removed catalog entry at abcbefa).
const MFA_DEFINITION = Object.freeze({
  name: MFA_EVENT_NAME,
  outcomes: ["success", "failure", "denied"],
  commit: ["committed", "not_committed"],
});

// http-handoff.ts:14-22 (handoff status per classification code).
const HANDOFF_STATUS = {
  acknowledged: "acknowledged", http_retryable: "retryable", timeout: "retryable",
  transport_failure: "retryable", http_permanent: "non_retryable",
  malformed_acknowledgment: "protocol_error", unexpected_response: "protocol_error",
};

// operations.ts:212-222 (commit state per operation state, transactional flag).
const COMMIT_BY_STATE = {
  started: "pending", committed: "committed", not_committed: "not_committed",
  partially_committed: "partially_committed", compensated: "compensated", cancelled: "not_committed",
};

const failure = (code, category, path) => ({ ok: false, error: { code, category, path } });

function sequence() {
  const counters = { op: 0, txn: 0, cor: 0, event: 0 };
  return {
    next(kind) {
      counters[kind] += 1;
      return `pe-${kind}-${String(counters[kind]).padStart(4, "0")}`;
    },
  };
}

function deepFreeze(value) {
  if (value === null) return value;
  if (typeof value !== "object") return value;
  if (Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const key of Object.getOwnPropertyNames(value)) deepFreeze(value[key]);
  return value;
}

// core/src/index.ts:11-46 (context constructors; frozen public shapes).
const contextConstructors = {
  authenticatedHumanActor: (input) => Object.freeze({ ...input }),
  authoritativeTenant: (input) => Object.freeze({ ...input }),
  authoritativeSubject: (input) => Object.freeze({ ...input }),
  authenticationEvidence: (input) => Object.freeze({ ...input }),
  authorizationEvidence: (input) => Object.freeze({ ...input }),
  authoritativeResource: (input) => Object.freeze({ ...input }),
};

// testing.ts:21-33 (createCapturingAuditSink).
function capturingSink() {
  const events = [];
  return Object.freeze({
    get events() { return events; },
    async emit(event) {
      events.push(deepFreeze(structuredClone(event)));
      return { status: "accepted" };
    },
  });
}

// events.ts:190-198 (defaultOutcome).
function defaultOutcome(definition, operationState) {
  const outcomes = definition.outcomes;
  if (operationState === "cancelled") {
    return outcomes.includes("cancelled") ? "cancelled" : outcomeFallback(outcomes);
  }
  if (operationState === "not_committed") return outcomes.includes("failure") ? "failure" : outcomes[0];
  if (operationState === "partially_committed" || operationState === "compensated") {
    return outcomes.includes("partial") ? "partial" : outcomes[0];
  }
  return outcomes[0];
}

function outcomeFallback(outcomes) {
  return outcomes.includes("failure") ? "failure" : outcomes[0];
}

// events.ts:205-225 (resolveCommitState, including #797's final refusal).
function resolveCommit(definition, outcome, direct, operationCommit) {
  if (terminalDirectConflict(direct, operationCommit, definition)) {
    return failure("PREMATURE_SUCCESS", "validation", "/event/commit_state");
  }
  if (operationCommit !== undefined) {
    if (outcome === "success" && operationCommit === "pending") {
      return failure("PREMATURE_SUCCESS", "validation", "/operation/state");
    }
    return { ok: true, value: operationCommit };
  }
  if (direct !== undefined) return { ok: true, value: direct };
  if (definition.commit.includes("not_applicable")) return { ok: true, value: "not_applicable" };
  return failure("PREMATURE_SUCCESS", "validation", "/operation/state");
}

function terminalDirectConflict(direct, operationCommit, definition) {
  if (direct === undefined) return false;
  if (direct === operationCommit) return false;
  return definition.commit.includes(direct);
}

// semantic.ts:227-238 (validateCommit; the second layer P-E-1e hits).
function validateCommit(definition, outcome, commitState) {
  if (commitState === undefined || !definition.commit.includes(commitState)) {
    if (outcome === "success" && definition.commit.includes("committed")) {
      return failure("PREMATURE_SUCCESS", "validation", "/event/commit_state");
    }
    return failure("SDK_SEMANTIC_VALIDATION_FAILED", "validation", "/event/commit_state");
  }
  return { ok: true };
}

function inputEvent(input) {
  return input.event === undefined ? undefined : input.event;
}

function directCommit(event) {
  return event === undefined ? undefined : event.commit_state;
}

function inputOutcome(event, snapshot) {
  if (event !== undefined && event.outcome !== undefined) return event.outcome;
  return defaultOutcome(MFA_DEFINITION, snapshot === undefined ? undefined : snapshot.state);
}

function inputLifecycle(event) {
  if (event !== undefined && event.lifecycle_phase !== undefined) return event.lifecycle_phase;
  return "completed";
}

// events.ts:531-545 (resolveEventClassification: direct check, pending check,
// then the standalone semantic validator at finalizeNamedEvent).
function classifyEvent({ input, snapshot }) {
  const event = inputEvent(input);
  const outcome = inputOutcome(event, snapshot);
  const commit = resolveCommit(MFA_DEFINITION, outcome, directCommit(event),
    snapshot === undefined ? undefined : snapshot.commit_state);
  if (!commit.ok) return commit;
  const validated = validateCommit(MFA_DEFINITION, outcome, commit.value);
  if (!validated.ok) return validated;
  return { ok: true, value: { lifecycle: inputLifecycle(event), outcome, commit: commit.value } };
}

// events.ts:227-253 (buildCorrelation; ids come from the operation snapshot,
// retry fields from the bounded retry input).
function buildCorrelation({ input, snapshot }) {
  const correlation = {
    correlation_id: snapshot.correlation_id,
    operation_id: snapshot.operation_id,
    transaction_id: snapshot.transaction_id,
    retry_attempt: input.retry === undefined ? 0 : input.retry.retry_attempt,
  };
  if (input.retry !== undefined) correlation.original_event_id = input.retry.original_event_id;
  return correlation;
}

// events.ts:383-394 (operation_type derived from the remove_mfa action).
function withOperationType(resource) {
  if (resource === undefined) return { operation_type: "delete" };
  if (resource.operation_type !== undefined) return resource;
  return { ...resource, operation_type: "delete" };
}

// events.ts:106-143 (the built occurrence; schema, envelope, correlation).
function buildEvent({ input, snapshot, lifecycle, outcome, commit, seq }) {
  return deepFreeze({
    event: { id: seq.next("event"), name: MFA_EVENT_NAME, category: "authentication", action: "remove_mfa",
      lifecycle_phase: lifecycle, outcome, commit_state: commit, timestamp: FIXED_TIMESTAMP,
      observed_at: FIXED_TIMESTAMP, delivery_class: "transaction_critical" },
    schema: { name: "com.bloodtrail.security-audit.event", version: "2.1.0" },
    producer: { name: "pe-synthetic-producer", version: "0.0.0" },
    environment: { name: "synthetic" },
    service: { name: "pe-synthetic-service", version: "0.0.0" },
    actor: input.actor,
    subject: input.subject,
    tenant: input.tenant,
    authentication: input.authentication,
    authorization: input.authorization,
    resource: withOperationType(input.resource),
    correlation: buildCorrelation({ input, snapshot }),
  });
}

// sdk.ts:498-507 (bounded retry attempts bypass the duplicate guard).
function isBoundedRetry(retry) {
  if (retry === undefined) return false;
  return Number.isSafeInteger(retry.retry_attempt) && retry.retry_attempt > 0 && retry.retry_attempt <= 1000;
}

// sdk.ts:475-483 (terminalSuccessEvent).
function terminalSuccessEvent(event) {
  if (event.event.outcome !== "success" || event.event.lifecycle_phase !== "completed") return undefined;
  if (event.correlation.retry_attempt) return undefined;
  if (!event.correlation.operation_id) return undefined;
  return event.event.name;
}

// sdk.ts:248-266 (#rejectDuplicateAttempt).
function rejectDuplicate({ evidence, input }) {
  if (evidence === undefined) return undefined;
  if (input.redelivery !== undefined) return undefined;
  if (isBoundedRetry(input.retry)) return undefined;
  const event = inputEvent(input);
  if (inputLifecycle(event) !== "completed") return undefined;
  if (inputOutcome(event, snapshotFor(evidence)) !== "success") return undefined;
  const completed = evidence.completions.completed;
  if (completed.has(MFA_EVENT_NAME)) {
    return failure("SDK_DUPLICATE_SUCCESS", "lifecycle", "/operation/state");
  }
  return undefined;
}

// sdk.ts:268-276 (#reserveCompletion).
function reserveCompletion(evidence, eventName) {
  if (eventName === undefined || evidence === undefined) return undefined;
  const reserved = evidence.completions.reserved;
  if (reserved.has(eventName)) return failure("SDK_DUPLICATE_SUCCESS", "lifecycle", "/operation/state");
  reserved.add(eventName);
  return undefined;
}

// operations.ts:176-186 (complete/release completion in the settle finally).
function completeCompletion(evidence, eventName) {
  const sets = evidence.completions;
  if (sets.reserved.has(eventName)) {
    sets.reserved.delete(eventName);
    sets.completed.add(eventName);
  }
}

function releaseCompletion(evidence, eventName) {
  const sets = evidence.completions;
  if (sets.reserved.has(eventName)) sets.reserved.delete(eventName);
}

// sdk.ts:279-296,318-338 (#deliverAndSettle over the injected sink).
async function settle({ sink, event, evidence, completionEvent }) {
  try {
    const result = await sink.emit(event);
    if (result.status === "accepted") {
      if (evidence !== undefined && completionEvent !== undefined) completeCompletion(evidence, completionEvent);
      return { ok: true, value: result };
    }
    return failure(result.status === "rejected" ? "SDK_SINK_REJECTED" : "SDK_SINK_FAILURE", "sink", "/sink");
  } catch {
    return failure("SDK_SINK_FAILURE", "sink", "/sink");
  } finally {
    if (evidence !== undefined && completionEvent !== undefined) releaseCompletion(evidence, completionEvent);
  }
}

function snapshotFor(evidence) {
  if (evidence === undefined) return undefined;
  return Object.freeze({
    operation_id: evidence.operationId,
    transaction_id: evidence.transactionId,
    correlation_id: evidence.correlationId,
    state: evidence.state,
    commit_state: evidence.transactional ? COMMIT_BY_STATE[evidence.state] : "not_applicable",
    bound_event: evidence.boundEvent,
    transactional: evidence.transactional,
  });
}

// operations.ts:86-98 (transition guard; same-state returns the snapshot).
function transition(evidence, next, allowedFrom) {
  if (next === evidence.state) return { ok: true, value: snapshotFor(evidence) };
  if (!allowedFrom.includes(evidence.state)) {
    return failure("SDK_INVALID_OPERATION_TRANSITION", "lifecycle", "/operation/state");
  }
  evidence.state = next;
  return { ok: true, value: snapshotFor(evidence) };
}

// operations.ts:31-46,104-122 (the handle surface).
function makeHandle(evidence) {
  return Object.freeze({
    get operationId() { return evidence.operationId; },
    get transactionId() { return evidence.transactionId; },
    get correlationId() { return evidence.correlationId; },
    get boundEvent() { return evidence.boundEvent; },
    get transactional() { return evidence.transactional; },
    get state() { return evidence.state; },
    snapshot() { return snapshotFor(evidence); },
    markCommitted() { return transition(evidence, "committed", ["started"]); },
    markNotCommitted() { return transition(evidence, "not_committed", ["started"]); },
    markPartiallyCommitted() { return transition(evidence, "partially_committed", ["started"]); },
    markCompensated() { return transition(evidence, "compensated", ["committed"]); },
    markCancelled() { return transition(evidence, "cancelled", ["started"]); },
  });
}

// sdk.ts:86-107 (beginOperation; only operationId reuse is refused).
function makeBeginOperation({ seq, issued, evidenceByHandle }) {
  return (input) => {
    const operationId = input.operationId === undefined ? seq.next("op") : input.operationId;
    if (issued.has(operationId)) return failure("SDK_INVALID_IDENTIFIER", "validation", "/operation/operation_id");
    const transactionId = input.transactionId === undefined ? seq.next("txn") : input.transactionId;
    const correlationId = input.correlationId === undefined ? seq.next("cor") : input.correlationId;
    issued.add(operationId);
    const evidence = {
      operationId, transactionId, correlationId, boundEvent: input.boundEvent,
      transactional: input.transactional === undefined ? true : input.transactional, state: "started",
      completions: { completed: new Set(), reserved: new Set() },
    };
    const handle = makeHandle(evidence);
    evidenceByHandle.set(handle, evidence);
    return { ok: true, value: handle };
  };
}

// sdk.ts:208-246 (#emitNamed: duplicate precheck, classification, build,
// reservation, then delivery and settle).
function makeMfaRemoved({ sink, seq, evidenceByHandle }) {
  return async (input) => {
    const evidence = evidenceByHandle.get(input.operation);
    const duplicate = rejectDuplicate({ evidence, input });
    if (duplicate !== undefined) return duplicate;
    const snapshot = snapshotFor(evidence);
    const classified = classifyEvent({ input, snapshot });
    if (!classified.ok) return classified;
    const value = classified.value;
    const event = buildEvent({ input, snapshot, lifecycle: value.lifecycle,
      outcome: value.outcome, commit: value.commit, seq });
    const completionEvent = terminalSuccessEvent(event);
    const reserved = reserveCompletion(evidence, completionEvent);
    if (reserved !== undefined) return reserved;
    return settle({ sink, event, evidence, completionEvent });
  };
}

// http-response-classification.ts:31-33,48-53,55-64,72-78 (classification).
function classifyOutcome(outcome, eventId) {
  if (outcome.kind !== "response") return nonResponseCode(outcome);
  const statusCode = statusCodeFor(outcome);
  if (statusCode !== null) return statusCode;
  return isExactAcknowledgment(outcome.acknowledgments, eventId) ? "acknowledged" : "malformed_acknowledgment";
}

function nonResponseCode(outcome) {
  if (outcome.kind === "timeout") return "timeout";
  if (outcome.kind === "transport_failure") return "transport_failure";
  return "unexpected_response";
}

function statusCodeFor(outcome) {
  const status = outcome.status;
  if (status >= 500) return "http_retryable";
  if (status >= 400) return "http_permanent";
  if (status >= 300 || status < 200) return "unexpected_response";
  return null;
}

function isExactAcknowledgment(acknowledgments, eventId) {
  if (!Array.isArray(acknowledgments) || acknowledgments.length !== 1) return false;
  const acknowledgment = acknowledgments[0];
  return acknowledgment.event_id === eventId && acknowledgment.outcome === "accepted";
}

// http-handoff.ts:98-114,139-163 (projection and one injected exchange).
function projectRequest({ event, path, attempt }) {
  const body = JSON.stringify(event);
  return { method: "POST", path,
    headers: { "content-type": "application/json", "content-length": String(Buffer.byteLength(body)) },
    body, event_id: event.event.id, attempt };
}

function httpHandoff({ path, exchange }) {
  return Object.freeze({
    async handoff(event, attempt = 0) {
      const request = projectRequest({ event, path, attempt });
      try {
        const code = classifyOutcome(await exchange(request), request.event_id);
        return { status: HANDOFF_STATUS[code], code, event_id: request.event_id, attempt };
      } catch {
        return { status: "retryable", code: "transport_failure", event_id: request.event_id, attempt };
      }
    },
  });
}

// delivery-classes.ts:305-335 (admission in one synchronous step).
function admit({ event, transactionId, settled, reserved }) {
  const eventId = event.event.id;
  const mismatch = classMismatch(event);
  if (mismatch !== null) return { key: "", refusal: { status: "refused", code: mismatch, event_id: eventId } };
  if (typeof transactionId !== "string" || transactionId.length === 0) {
    return { key: "", refusal: { status: "refused", code: "transaction_id_required", event_id: eventId } };
  }
  const key = `${eventId}\u0000${transactionId}`;
  if (settled.has(key)) {
    return { key, refusal: { status: "already_delivered", event_id: eventId, transaction_id: transactionId } };
  }
  if (reserved.has(key)) {
    return { key, refusal: { status: "refused", code: "duplicate_transaction_delivery", event_id: eventId } };
  }
  return { key, refusal: null };
}

// delivery-classes.ts:448-455 (exact class match).
function classMismatch(event) {
  return event.event.name === MFA_EVENT_NAME ? null : "delivery_class_mismatch";
}

// delivery-classes.ts:466-479 (failClosed freezes the result).
function failClosed(code, eventId, commitGateInvoked, durabilityAttempted) {
  return Object.freeze({ status: "failed_closed", code, event_id: eventId, commitGateInvoked, durabilityAttempted });
}

// delivery-classes.ts:342-356 (probe, then gate, then one handoff(event, 0)).
async function pipeline({ handoff, durabilityProbe, commitGate, event }) {
  const eventId = event.event.id;
  if (!(await durabilityProbe())) return failClosed("audit_durability_unreachable", eventId, false, false);
  if ((await commitGate()) === "declined") return failClosed("business_commit_declined", eventId, true, false);
  const outcome = await handoff.handoff(event, 0);
  if (outcome.status !== "acknowledged") return failClosed("audit_durability_unreachable", eventId, true, true);
  return null;
}

// delivery-classes.ts:259-285 (the binding: guarantees, synchronous admission,
// settle-on-null-outcome, finally-released reservation).
function transactionCritical({ handoff, durabilityProbe }) {
  const settled = new Set();
  const reserved = new Set();
  return Object.freeze({
    guarantees: Object.freeze({ deliveryClass: "transaction_critical", semantic: "at_least_once",
      claimsAtLeastOnce: true, failsClosedBeforeCommit: true }),
    async deliver(event, transactionId, commitGate) {
      const eventId = event.event.id;
      const admission = admit({ event, transactionId, settled, reserved });
      if (admission.refusal !== null) return admission.refusal;
      const key = admission.key;
      reserved.add(key);
      try {
        const outcome = await pipeline({ handoff, durabilityProbe, commitGate, event });
        if (outcome !== null) return outcome;
        settled.add(key);
        return { status: "committed_and_durable", event_id: eventId, transaction_id: transactionId };
      } finally {
        reserved.delete(key);
      }
    },
  });
}

export function peDouble() {
  const seq = sequence();
  return {
    core: { CONTRACT_VERSION: "2.1.0", ...contextConstructors },
    node: {
      createNodeSecurityAuditSdk: (config) => {
        const issued = new Set();
        const evidenceByHandle = new Map();
        return Object.freeze({
          beginOperation: makeBeginOperation({ seq, issued, evidenceByHandle }),
          mfaRemoved: makeMfaRemoved({ sink: config.sink, seq, evidenceByHandle }),
        });
      },
      createHttpDeliveryHandoff: ({ path, exchange }) => httpHandoff({ path, exchange }),
      createTransactionCriticalDelivery: ({ handoff, durabilityProbe }) => transactionCritical({ handoff, durabilityProbe }),
    },
    testing: { createCapturingAuditSink: () => capturingSink() },
  };
}

// Fixture state wired with the independent double (never used by workloads).
export function peState({ budget = 200 } = {}) {
  const { core, node, testing } = peDouble();
  return fixtureState({ budget, core, node, testing });
}
