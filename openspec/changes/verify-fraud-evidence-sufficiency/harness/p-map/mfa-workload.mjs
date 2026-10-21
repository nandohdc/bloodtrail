import { familyWorkload } from "./family-workload.mjs";
import { MFA_CASES } from "./mfa-cases.mjs";
import { failureInput, resolvedFailureSubject } from "./lm-inputs.mjs";
import { failureFacts } from "./lm-facts.mjs";
import { instance } from "./runtime.mjs";
import { beginOperation, emitOccurrence } from "./workload-steps.mjs";

async function emitFailure(state, { input, ...options }) {
  const record = await emitOccurrence(state, { method: "authenticationFailed", input, ...options });
  failureFacts(record);
}

async function failureVariant(state, { id, options = {}, subject = false }) {
  const target = instance(state);
  const input = failureInput(state, options);
  if (subject) input.subject = resolvedFailureSubject(state);
  await emitFailure(state, { target, input, id });
}

async function targetlessFailures(state, variant) {
  await variant("tenantless", () => failureVariant(state, { id: "tenantless" }));
  await variant("tenant", () => failureVariant(state, { id: "tenant", options: { tenantless: false } }));
}

async function handleFailure(state, { id, input: operationInput, refusalExpected }) {
  const target = instance(state);
  const input = failureInput(state);
  const handle = await beginOperation(state, { target, id: `${id}-begin`, input: operationInput });
  await emitFailure(state, { target, handle, id, refusalExpected, input: { ...input, operation: handle } });
}

async function handleVariants(state, variant) {
  await variant("transactional", () => handleFailure(state, { id: "transactional", refusalExpected: true }));
  await variant("nontransactional", () => handleFailure(state,
    { id: "nontransactional", input: { transactional: false }, refusalExpected: false }));
}

const RUNNERS = {
  M1: targetlessFailures,
  M2: (state) => failureVariant(state, { id: "resolved-subject", subject: true }),
  M3: (state) => failureVariant(state, { id: "authenticated-actor", options: { actor: "human" } }),
  M4: handleVariants,
};

export async function mfaWorkload(state, cases = MFA_CASES) {
  await familyWorkload(state, { cases, runners: RUNNERS });
}
