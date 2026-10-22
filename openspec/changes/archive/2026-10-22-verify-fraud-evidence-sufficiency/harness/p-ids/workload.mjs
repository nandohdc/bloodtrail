import { readCapturingSink } from "../lib/observe.mjs";

export class RoleRefusal extends Error {}

export function publicCall({ state, label, invoke, refusalExpected = false, continueOnRefusal = false }) {
  const check = (result) => {
    if (!result.passed && !continueOnRefusal) throw new RoleRefusal(`${label} refused`);
    return result;
  };
  const result = state.recorder.call({ label, invoke, refusalExpected });
  return result instanceof Promise ? result.then(check) : check(result);
}

export function createInstance({ state, identifiers, omitIdentifiers = true }) {
  const sink = publicCall({ state, label: "createCapturingAuditSink", invoke: () => state.testing.createCapturingAuditSink() }).value;
  state.sinks.push(sink);
  const config = minimalConfig({ sink });
  if (!omitIdentifiers) config.identifiers = identifiers;
  const factory = state.role.startsWith("node-") ? state.node.createNodeSecurityAuditSdk : state.core.createSecurityAuditSdk;
  const result = publicCall({ state, label: "factory", continueOnRefusal: true, invoke: () => factory(config) });
  if (!result.passed) throw new RoleRefusal("measured factory refused");
  state.recorder.outcomes.at(-1).raw = { state: result.value.state, frozen: Object.isFrozen(result.value) };
  return result;
}

export function minimalConfig({ sink }) {
  return { contractVersion: "2.1.0", producer: { name: "pids-producer", version: "0.0.1" }, service: { name: "pids-service" }, environment: { name: "synthetic" }, sink };
}

export function baseInput({ state }) {
  const construct = (label, value) => publicCall({ state, label, invoke: () => state.core[label](value) }).value;
  return {
    actor: construct("anonymousActor", "request_boundary"),
    tenant: construct("authoritativeTenant", { scope: "tenant", actor_tenant_id: "tenant-pids-1", effective_tenant_id: "tenant-pids-1", resource_tenant_id: "tenant-pids-1" }),
    authentication: construct("authenticationEvidence", { method: "password_mfa", assurance_level: "aal1", mfa_state: "not_used", credential_type: "password", identity_provider: "https://idp.synthetic.test", delegated: false, impersonated: false }),
    source: construct("observedSource", { observed: { address: "203.0.113.10", port: 443 } }),
    event: { outcome_reason: { code: "credential_invalid" } },
  };
}

export async function emissions({ state, sdk, input, count, stopOnRefusal = false, refusalAt = -1 }) {
  for (let index = 0; index < count; index += 1) {
    const result = await publicCall({ state, label: "authenticationFailed", continueOnRefusal: true, refusalExpected: index === refusalAt,
      invoke: () => sdk.authenticationFailed({ ...input, request: { id: `req-pids-${index}`, method: "POST", route: "/api/v1/auth/login" } }) });
    if (!result.passed && stopOnRefusal) {
      state.invalidations.push("P-ids-01 emission refused; remaining sequence and roles invalidated");
      return false;
    }
    if (!result.passed && index !== refusalAt) throw new RoleRefusal("emission refused");
  }
  return true;
}

export function operations({ state, sdk, count, input, refusalAt = -1 }) {
  for (let index = 0; index < count; index += 1) {
    const result = publicCall({ state, label: "beginOperation", continueOnRefusal: true, invoke: () => sdk.beginOperation(input), refusalExpected: index === refusalAt });
    if (!result.passed && index !== refusalAt) throw new RoleRefusal("operation refused");
    if (result.passed) {
      const handle = { operationId: result.value.value.operationId, transactionId: result.value.value.transactionId, correlationId: result.value.value.correlationId };
      state.handles.push(handle);
      state.recorder.outcomes.at(-1).raw = { ok: true, value: handle };
    }
  }
}

export function captureState({ state }) {
  const captures = state.sinks.map((sink) => readCapturingSink({ sink }));
  const events = captures.flatMap((capture) => capture.events);
  return {
    role: state.role, outcomes: state.recorder.outcomes, captures, handles: state.handles,
    ids: {
      event_id: events.map((event) => event.event.id),
      operation_id: events.map((event) => event.correlation.operation_id),
      correlation_id: events.map((event) => event.correlation.correlation_id),
      transaction_id: events.filter((event) => Object.hasOwn(event.correlation, "transaction_id")).map((event) => event.correlation.transaction_id),
      handle_operationId: state.handles.map((handle) => handle.operationId),
      handle_transactionId: state.handles.map((handle) => handle.transactionId),
      handle_correlationId: state.handles.map((handle) => handle.correlationId),
      direct: state.direct,
    },
    timestamps: events.map((event) => ({ timestamp: event.event.timestamp, observed_at: event.event.observed_at })),
    retention: state.retention, refusals: state.refusals, invalidations: state.invalidations, ledger: state.ledger.report(),
  };
}
