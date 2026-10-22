import { familyWorkload } from "./family-workload.mjs";
import { LOCKOUT_CASES } from "./lock-cases.mjs";
import { lockConfigurationInput, lockDenialInput, lockFailureInput, lockModificationInput } from "./lock-inputs.mjs";
import { lockFacts } from "./lock-facts.mjs";
import { instance } from "./runtime.mjs";
import { beginOperation, emitOccurrence, markOperation } from "./workload-steps.mjs";

async function attempt(state, shared) {
  const target = instance(state);
  const input = lockFailureInput(state);
  shared.failure = await emitOccurrence(state, { target, input, id: "attempt", method: "authenticationFailed" });
  lockFacts(shared.failure);
}

async function modification(state, { id, options, build = lockModificationInput, method = "sensitiveResourceModified", linkage }) {
  const target = instance(state);
  const operationInput = linkage === undefined ? undefined : { correlationId: linkage.correlationId };
  const handle = await beginOperation(state, { target, id: `${id}-begin`, input: operationInput });
  await markOperation(state, { target, handle, id: `${id}-mark`, method: "markCommitted" });
  const input = { ...build(state, options), operation: handle };
  // A real captured request is reused, never an invented cross-record equality.
  if (linkage !== undefined) input.request = linkage.request;
  const record = await emitOccurrence(state, { target, handle, input, id, method, refusalExpected: options.tenantless === true });
  lockFacts(record);
  return { target, handle, record };
}

function failureLinkage(failure) {
  if (failure === undefined) return undefined;
  if (failure.captures.length !== 1) return undefined;
  const captured = failure.captures[0].event;
  return { correlationId: captured.correlation.correlation_id, request: captured.request };
}

async function policyLock(state, variant, shared) {
  await variant("policy", async () => {
    shared.lock = await modification(state, { id: "policy", options: {}, linkage: failureLinkage(shared.failure) });
  });
  await variant("tenantless", () => modification(state, { id: "tenantless", options: { tenantless: true } }));
}

async function unapprovedLock(state, variant) {
  await variant("not-applicable", () => modification(state, { id: "not-applicable", options: { decision: "not_applicable" } }));
  await variant("tenantless", () => modification(state, { id: "tenantless", options: { decision: "not_applicable", tenantless: true } }));
}

const CONFIGURATIONS = [{ id: "account", type: "account" }, { id: "relabeled", type: "security_configuration" }];
async function configurationLock(state, variant) {
  for (const { id, type } of CONFIGURATIONS) await variant(id, () => modification(state, {
    id, options: { type }, build: lockConfigurationInput, method: "securityConfigurationChanged" }));
}

const DENIALS = [{ id: "tenant", tenantless: false }, { id: "tenantless", tenantless: true }];
async function deniedLogin(state, variant) {
  for (const { id, tenantless } of DENIALS) await variant(id, async () => {
    const record = await emitOccurrence(state, { target: instance(state), input: lockDenialInput(state, { tenantless }),
      id, method: "authorizationDenied", refusalExpected: tenantless });
    lockFacts(record);
  });
}

const RUNNERS = { K1: attempt, K2a: policyLock, K2b: unapprovedLock, K3: configurationLock, K4: deniedLogin };
export async function lockoutWorkload(state, cases = LOCKOUT_CASES) {
  const shared = {};
  const runners = {
    ...RUNNERS, K1: (current) => RUNNERS.K1(current, shared),
    K2a: (current, variant) => RUNNERS.K2a(current, variant, shared),
  };
  await familyWorkload(state, { cases, runners });
  // No target/handle for other K variants escapes. Caller explicitly passes
  // this one live dependency to U2; no persistence or runtime-private reads.
  return shared.lock;
}
