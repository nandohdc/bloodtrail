import { AsyncLocalStorage } from "node:async_hooks";
import { EXPECTATIONS } from "./pd-fixtures.mjs";

export class FixtureSdkError extends Error {
  constructor(diagnostic) {
    super(diagnostic.code);
    Object.assign(this, diagnostic, { name: "SecurityAuditSdkError" });
  }
  toJSON() { return { code: this.code, category: this.category, path: this.path }; }
}

// Public-shape fixture only: counts/control-flow, not an alternative SDK validator.
export function publicDoubles() {
  let state;
  const attach = (value) => { state = value; };
  const planned = () => EXPECTATIONS.cases.flatMap((entry) => entry.expected).find((entry) => entry.step_id === state.activeStep);
  const verdict = () => {
    const expected = planned();
    if (expected?.assertions.surface === "thrown-sdk") throw new FixtureSdkError(expected.diagnostic);
    if (expected?.diagnostic) return { ok: false, error: expected.diagnostic };
    return { ok: true, value: { status: "accepted" } };
  };
  const constructors = new Proxy({}, { get: (_, method) => (input) => {
    verdict();
    return { ...input, fixture_constructor: method };
  } });
  const core = new Proxy({
    CONTRACT_VERSION: "2.1.0", SecurityAuditSdkError: FixtureSdkError,
    EVENT_CATALOG: transactionCatalog(), EVENT_METHODS: transactionMethods(),
    runWithAuditContext: (frame, callback) => { verdict(); return callback(); },
    validateSecurityAuditEvent: () => verdict(),
  }, { get: (target, key) => key in target ? target[key] : constructors[key] });
  const testing = { createCapturingAuditSink: () => ({ events: [] }) };
  const issued = [];
  const received = [];
  const storage = new AsyncLocalStorage();
  const node = { nodeContextProvider: storage, createNodeSecurityAuditSdk: (config) => {
    verdict();
    const sdk = fakeSdk({ config, verdict, issued, received, storage });
    return sdk;
  } };
  return { core, node, testing, attach, issued, received };
}

function fakeSdk({ config, verdict, issued, received, storage }) {
  const sdk = {
    beginOperation() { const h = fixtureHandle(); issued.push({ sdk, handle: h }); return { ok: true, value: h }; },
    runWithContext(frame, callback) { verdict(); return storage.run(frame, callback); },
  };
  return new Proxy(sdk, { get: (target, key) => {
    if (key in target) return target[key];
    return async (input) => {
      received.push({ sdk, method: key, input, frame: storage.getStore() });
      const result = verdict();
      if (result.ok) {
        for (const hook of config.transformations ?? []) hook.transform({ path: hook.path, value: input.actor.id, purpose: "authentication_failed" });
        config.sink.events.push(Object.freeze({ ...input, event: { id: "evt_fixture", outcome: "failure" }, schema: { version: "2.1.0" } }));
      }
      return result;
    };
  } });
}

function fixtureHandle() {
  class AuditOperationHandleImpl {
    #state = "started";
    get state() { return this.#state; }
    get operationId() { return "op_fixture"; }
    get transactionId() { return "txn_fixture"; }
    get correlationId() { return "cor_fixture"; }
    snapshot() { return { state: this.#state }; }
    markCommitted() {
      if (!(this instanceof AuditOperationHandleImpl)) return { ok: false, error: { code: "SDK_INVALID_OPERATION_TRANSITION", category: "lifecycle", path: "/operation" } };
      this.#state = "committed";
      return { ok: true, value: this.snapshot() };
    }
  }
  return new AuditOperationHandleImpl();
}

function transactionCatalog() {
  const c9 = EXPECTATIONS.cases.find((entry) => entry.case_id === "PD-C9");
  const methods = [...new Set(c9.variants.map((variant) => variant.method))];
  return methods.map((method) => ({ name: method, commit: ["committed"], outcomes: ["success", ...c9.variants.filter((variant) => variant.method === method).map((variant) => variant.outcome)] }));
}
function transactionMethods() { return transactionCatalog().map((entry) => ({ method: entry.name, name: entry.name })); }
