import { peDouble } from "./p-e-case-fixtures.mjs";
import { fixtureState } from "./p-e-runtime-fixtures.mjs";

// Offline public-shape auth extension. Source: generated/contract.generated.ts:
// 601-625; sdk.ts:208-246,318-338; events.ts:106-143,227-255. This double
// constructs a new security_significant occurrence on the named public call;
// the workload must never clone/rename an MFA occurrence to bypass validation.
export function authenticationFailed(sink) {
  let ordinal = 0;
  return async (input) => {
    ordinal += 1;
    const event = Object.freeze({
      event: Object.freeze({ id: `pe-auth-event-${ordinal}`, name: "bloodtrail.audit.authentication.failed",
        delivery_class: "security_significant", outcome: "failure", commit_state: "not_applicable" }),
      actor: input.actor, tenant: input.tenant, source: input.source, authentication: input.authentication,
      correlation: Object.freeze({ retry_attempt: 0 }),
    });
    const delivered = await sink.emit(event);
    return { ok: true, value: delivered };
  };
}

export function concurrencyState({ probeWait, transformBinding, budget = 500 } = {}) {
  const modules = peDouble();
  const originalFactory = modules.node.createNodeSecurityAuditSdk;
  const originalDelivery = modules.node.createTransactionCriticalDelivery;
  modules.core.observedSource = (input) => Object.freeze(structuredClone(input));
  modules.node.createNodeSecurityAuditSdk = (config) => Object.freeze({ ...originalFactory(config),
    authenticationFailed: authenticationFailed(config.sink) });
  modules.node.createTransactionCriticalDelivery = (options) => {
    const probe = options.durabilityProbe;
    const durabilityProbe = probeWait === undefined ? probe : async () => {
      const value = probe();
      await probeWait;
      return value;
    };
    const binding = originalDelivery({ ...options, durabilityProbe });
    return transformBinding === undefined ? binding : transformBinding(binding);
  };
  return fixtureState({ budget, ...modules });
}
