import { actorIdHook } from "./keying.mjs";
import { analyzeRecord, shapeIssues } from "./observations.mjs";
import { atPath } from "./comparison.mjs";
import { instance, named } from "./runtime.mjs";
import { AF_CASES } from "./af-cases.mjs";
import { AF_CARRIERS, prepareAf } from "./af-inputs.mjs";
import { AF_CONTROLS } from "./af-controls.mjs";
import { AS_CASES } from "./as-cases.mjs";
import { AS_BUILDERS, prepareAs } from "./as-inputs.mjs";
import { PR_CASES, RA_CASES } from "./request-cases.mjs";
import { prepareRequest, REQUEST_BUILDERS } from "./request-inputs.mjs";

const OPAQUE_RETURNS = new Set(["createNodeSecurityAuditSdk", "createCapturingAuditSink"]);

const PURPOSES = new Map([["AF", "authentication_failed"], ["AS", "authentication_succeeded"],
  ["PR", "password_reset_requested"], ["RA", "account_registration_attempted"]]);

// Q1: the run reports keyed targets as declared key scope plus a boolean
// matches_declared_input; the digest itself never leaves the probe process
// as an expectation. The raw digest may remain in captured events as an
// observation, never as the key.
export function keyedChecks({ record, prepared }) {
  const checks = [];
  for (const [path, spec] of Object.entries(prepared.keyedInputs ?? {})) {
    if (!record.accepted || record.events.length !== 1) continue;
    const captured = atPath(record.events[0], path);
    checks.push({ path, key_scope: spec.key_scope, input_origin: spec.input_origin,
      digest_format: spec.digest_format,
      matches_declared_input: captured !== undefined && captured === spec.expected });
  }
  return checks;
}

export function callSnapshot(call) {
  if (!OPAQUE_RETURNS.has(call.label.split(":")[1])) return structuredClone(call);
  if (call.kind !== "returned") return structuredClone(call);
  // Live public objects have methods/closures. Never inspect private SDK state.
  return { ...call, raw: { representation: "opaque public return" } };
}

function configuredHook(context) {
  const hooked = actorIdHook({ state: context.state, keying: context.keying, contentOrigin: context.plan.hookOrigin(context) });
  if (context.entry.hook_mode === "async") {
    const sync = hooked.hook.transform;
    hooked.hook.transform = (input) => Promise.resolve(sync(input));
  }
  return hooked;
}

function setup(context) {
  if (context.entry.hook_mode === "none") return { target: instance(context.state), facts: [] };
  const { hook, facts } = configuredHook(context);
  return { target: instance(context.state, { transformations: [hook] }), facts };
}

async function executeVariant(context) {
  context.plan.prepare(context);
  context.plan.builders.get(context.entry.scenario)(context);
  // Every variant gets a fresh instance, including hook configuration changes.
  const configured = setup(context);
  context.facts = configured.facts;
  return named(context.state, { target: configured.target, method: context.plan.method, ...context.prepared, id: context.variant.variant_id });
}

export function setupRefusal({ state, error, stepId }) {
  state.ledger.assertAvailable();
  const { label, ...surface } = state.calls.at(-1);
  if (surface.kind !== "thrown") throw error;
  const record = { step_id: stepId, ...surface,
    sink_count: 0, frozen: [], events: [], origins: {}, captured_origins: [] };
  state.records.push(record);
  return record;
}

async function attemptVariant(context) {
  try { return await executeVariant(context); }
  catch (error) {
    return setupRefusal({ state: context.state, error, stepId: `${context.entry.case_id}/${context.variant.variant_id}` });
  }
}

export async function carrierVariant({ state, entry, variant, keying, plan }) {
  state.current = entry.case_id;
  const start = state.calls.length;
  const context = { state, entry, variant, keying, plan, prepared: { contents: {} }, facts: [] };
  const record = await attemptVariant(context);
  Object.assign(record, {
    family: plan.family, variant_id: variant.variant_id, contents: structuredClone(context.prepared.contents),
    existence_peer: plan.existencePeer(context), hook_facts: structuredClone(context.facts),
    public_calls: state.calls.slice(start).map(callSnapshot), predicted_calls: variant.predicted_calls,
    keyed_checks: keyedChecks({ record, prepared: context.prepared }),
    account: context.variant.target === "ex" ? context.account : undefined,
  });
  return record;
}

function baselineInvalid({ state, entry, record, plan }) {
  if (entry.case_id !== plan.baselineId) return false;
  const issues = shapeIssues(record);
  if (!record.accepted) issues.push("baseline refused");
  if (issues.length === 0) return false;
  state.invalidations.push({ message: `${record.step_id} precondition failed; remaining ${plan.family} cases stopped`, issues });
  return true;
}

async function executeEntry(context) {
  for (const variant of context.entry.variants.filter((item) => !item.linkage_only)) {
    const record = await carrierVariant({ ...context, variant });
    if (baselineInvalid({ ...context, record })) return false;
  }
  return true;
}

// Declaration/comment order is stable; execution always puts the positive
// baseline first, even if a caller supplies descriptors in another order.
export async function carrierWorkload({ state, keying, cases, plan, analyze = true }) {
  const baselines = cases.filter((entry) => entry.case_id === plan.baselineId);
  const observations = cases.filter((entry) => entry.case_id !== plan.baselineId);
  for (const entry of [...baselines, ...observations]) {
    if (!await executeEntry({ state, keying, entry, plan })) return;
  }
  if (!analyze) return;
  for (const record of state.records.filter((item) => item.family === plan.family)) {
    record.analysis = analyzeRecord({ record, records: state.records });
  }
}

export function existencePeer({ entry, variant }) {
  const peer = variant.target === "ex" ? "nx" : "ex";
  const id = variant.mode === "main" ? peer : `${variant.mode}-${peer}`;
  return `${entry.case_id}/${id}`;
}
const AF_PLAN = {
  family: "AF", method: "authenticationFailed", baselineId: "AF-B", prepare: prepareAf,
  builders: new Map([...AF_CARRIERS, ...AF_CONTROLS]), hookOrigin: () => "CP", existencePeer,
  purpose: "authentication_failed",
};
const AS_PLAN = {
  family: "AS", method: "authenticationSucceeded", baselineId: "AS-B", prepare: prepareAs,
  builders: AS_BUILDERS, hookOrigin: ({ variant }) => variant.mode === "honest-control" ? "SR" : "CP",
  existencePeer: () => undefined, purpose: "authentication_succeeded",
};
const REQUEST_CASES = new Map([["PR", PR_CASES], ["RA", RA_CASES]]);
const METHODS = new Map([["PR", "passwordResetRequested"], ["RA", "accountRegistrationAttempted"]]);
function requestPlan(family) {
  if (!METHODS.has(family)) throw new Error(`unsupported request family ${family}`);
  return { family, method: METHODS.get(family), baselineId: `${family}-B`, prepare: prepareRequest,
    builders: REQUEST_BUILDERS, hookOrigin: () => "CP", existencePeer,
    purpose: PURPOSES.get(family) };
}
export function afVariant(context) { return carrierVariant({ ...context, plan: AF_PLAN }); }
export function asVariant(context) { return carrierVariant({ ...context, plan: AS_PLAN }); }
export function requestVariant({ family, ...context }) { return carrierVariant({ ...context, plan: requestPlan(family) }); }
export function afWorkload({ state, keying, cases = AF_CASES, analyze = true }) {
  return carrierWorkload({ state, keying, cases, plan: AF_PLAN, analyze });
}
export function asWorkload({ state, keying, cases = AS_CASES, analyze = true }) {
  return carrierWorkload({ state, keying, cases, plan: AS_PLAN, analyze });
}
export function requestWorkload({ family, state, keying, cases = REQUEST_CASES.get(family), analyze = true }) {
  return carrierWorkload({ state, keying, cases, plan: requestPlan(family), analyze });
}
