import { acknowledgingExchange } from "./scripts.mjs";
import { committedGate, summarize, trueProbe, truthfulSetup } from "./redelivery-steps.mjs";
import { recordStep } from "./case-steps.mjs";
import { ADMISSION_CASE } from "./admission-cases.mjs";

// SDK-constructed authentication.failed, not a renamed/cloned MFA occurrence.
// Conformance row: core/tests/conformance-account-authentication-session.test.ts:
// 26-98,190-213. All context constructors remain counted public calls.
function authenticationInput(state) {
  return {
    actor: state.c("authenticatedHumanActor", { id: "pe-actor-0002" }),
    tenant: state.c("authoritativeTenant", { scope: "tenant", actor_tenant_id: "pe-tenant-0001",
      effective_tenant_id: "pe-tenant-0001", resource_tenant_id: "pe-tenant-0001" }),
    authentication: state.c("authenticationEvidence", { method: "password", credential_type: "password",
      mfa_state: "not_used", failure_reason: "credential_invalid" }),
    source: state.c("observedSource", { observed: { address: "203.0.113.10", port: 51000 } }),
    request: { id: "pe-request-0002", method: "POST", route: "/login" },
    correlation: {}, event: { outcome_reason: { code: "credential_invalid" } },
  };
}

const REFUSALS = [
  { id: "undefined", transactionId: undefined },
  { id: "empty", transactionId: "" },
  { id: "class", transactionId: "pe-txn-0002" },
];

export async function admissionCase(state, entry = ADMISSION_CASE) {
  const setup = await truthfulSetup(state, entry,
    [{ exchange: acknowledgingExchange(), probe: trueProbe, gate: committedGate }]);
  const input = authenticationInput(state);
  const auth = await recordStep(state, { id: "auth", target: setup.target, counters: setup.counters,
    run: () => state.method(setup.target.sdk, "authenticationFailed", input) });
  const authEvent = auth.captures[0].event;
  const unit = setup.deliveries[0];
  const steps = ["mark", "emit", "auth"];
  for (const refusal of REFUSALS) {
    const event = refusal.id === "class" ? authEvent : setup.event;
    for (const suffix of ["first", "repeat"]) {
      const id = `${refusal.id}-${suffix}`;
      await recordStep(state, { id, target: setup.target, counters: setup.counters, refusalExpected: true,
        run: () => state.method(unit.binding, "deliver", event, refusal.transactionId, unit.gate.invoke) });
      steps.push(id);
    }
  }
  return summarize(state, entry, [setup], steps);
}
