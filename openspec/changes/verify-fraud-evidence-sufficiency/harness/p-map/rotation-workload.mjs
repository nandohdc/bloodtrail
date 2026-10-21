import { ROTATION_CASES } from "./rotation-cases.mjs";
import { familyWorkload } from "./family-workload.mjs";
import { tenantlessLoginInput } from "./lm-inputs.mjs";
import { credentialRotationInput, passwordCompletionInput, passwordRequestInput, rotationRoleInput } from "./rotation-inputs.mjs";
import { capturedOriginal, rotationFacts, rotationLinkFacts } from "./rotation-facts.mjs";
import { instance } from "./runtime.mjs";
import { beginOperation, emitOccurrence, markOperation } from "./workload-steps.mjs";

async function completion(state, { target, handle, id, tenantless = false, original }) {
  const input = { ...passwordCompletionInput(state, { tenantless }), operation: handle };
  if (original !== undefined) input.correlation = capturedOriginal(original);
  const record = await emitOccurrence(state, { target, handle, input, id, method: "passwordResetCompleted",
    refusalExpected: original === undefined || tenantless });
  rotationFacts(record);
  if (original !== undefined) record.causality = rotationLinkFacts(original, record);
  return record;
}

async function unlinked(state) {
  const target = instance(state);
  const handle = await beginOperation(state, { target, id: "begin" });
  await markOperation(state, { target, handle, id: "mark", method: "markCommitted" });
  await completion(state, { target, handle, id: "unlinked" });
}

async function requestPair(state, { id, tenantless }) {
  const target = instance(state);
  const handle = await beginOperation(state, { target, id: `${id}-begin` });
  const original = await emitOccurrence(state, { target, id: `${id}-request`, method: "passwordResetRequested",
    input: passwordRequestInput(state, { tenantless, handle }) });
  rotationFacts(original);
  // Check the observed precursor BEFORE synthesizing a commit or using links.
  capturedOriginal(original);
  await markOperation(state, { target, handle, id: `${id}-mark`, method: "markCommitted" });
  await completion(state, { target, handle, id: `${id}-completed`, tenantless, original });
}

const PAIRS = [{ id: "pair", tenantless: false }, { id: "tenantless", tenantless: true }];
async function passwordChange(state, variant) {
  for (const options of PAIRS) await variant(options.id, () => requestPair(state, options));
}

async function loginLink(state) {
  const target = instance(state);
  const original = await emitOccurrence(state, { target, id: "login", method: "authenticationSucceeded", input: tenantlessLoginInput(state) });
  rotationFacts(original);
  capturedOriginal(original);
  const handle = await beginOperation(state, { target, id: "begin" });
  await markOperation(state, { target, handle, id: "mark", method: "markCommitted" });
  await completion(state, { target, handle, id: "completed", original });
}

async function committedRotation(state, { id, options, build = credentialRotationInput, method = "sensitiveResourceModified", refusalExpected = false, prefix = `${id}-` }) {
  const target = instance(state);
  const handle = await beginOperation(state, { target, id: `${prefix}begin` });
  await markOperation(state, { target, handle, id: `${prefix}mark`, method: "markCommitted" });
  const record = await emitOccurrence(state, { target, handle, input: { ...build(state, options), operation: handle }, id, method, refusalExpected });
  rotationFacts(record);
}

const ROTATIONS = [{ id: "human", options: { actor: "human" } }, { id: "service", options: { actor: "service" } },
  { id: "tenantless", options: { actor: "human", tenantless: true }, refusalExpected: true }];
async function otherCredentials(state, variant) {
  for (const options of ROTATIONS) await variant(options.id, () => committedRotation(state, options));
}

function roleRotation(state, actor) {
  return committedRotation(state, { id: actor, options: { actor }, build: rotationRoleInput,
    method: "roleAssigned", prefix: "", refusalExpected: actor === "human" });
}

const RUNNERS = { R1: unlinked, R2: passwordChange, R3: loginLink, R4: otherCredentials,
  R5a: (state) => roleRotation(state, "human"), R5b: (state) => roleRotation(state, "administrator") };
export function rotationWorkload(state, cases = ROTATION_CASES) {
  return familyWorkload(state, { cases, runners: RUNNERS });
}
