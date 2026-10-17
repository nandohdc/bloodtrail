import { FAILURE_DATASETS, SUCCESS_DATASETS, REQUEST_DATASETS, TARGETS, REPETITIONS } from "./linkage-cases.mjs";
import { linkageBases, linkageInput } from "./linkage-prepare.mjs";
import { actorIdHook } from "./keying.mjs";
import { instance, named } from "./runtime.mjs";
import { callSnapshot, keyedChecks, setupRefusal } from "./carrier-workload.mjs";
import { analyzeRecord } from "./observations.mjs";

const METHODS = new Map([["AF", "authenticationFailed"], ["AS", "authenticationSucceeded"], ["PR", "passwordResetRequested"], ["RA", "accountRegistrationAttempted"]]);
const STAGES = [["L1", FAILURE_DATASETS, REPETITIONS], ["L2", SUCCESS_DATASETS, 1], ["L3", REQUEST_DATASETS, 1]];
function configured({ state, keying, dataset }) {
  if (dataset.entry.hook_mode === "none") return { target: instance(state), facts: [] };
  const contentOrigin = dataset.mode === "honest-control" ? "SR" : "CP";
  const { hook, facts } = actorIdHook({ state, keying, contentOrigin });
  return { target: instance(state, { transformations: [hook] }), facts };
}
function stepId({ stage, dataset, target, attempt }) {
  return `${stage}/${dataset.dataset_id}/${target.target}-${target.suffix}-${attempt}`;
}
function peerId(context) {
  if (context.dataset.family === "AS") return undefined;
  const target = { ...context.target, target: context.target.target === "ex" ? "nx" : "ex" };
  return stepId({ ...context, target });
}
async function emitTarget(context) {
  const { state, dataset, target, configured: setup, stage, repeats } = context;
  const prepared = linkageInput(context);
  for (let attempt = 1; attempt <= repeats; attempt += 1) {
    const id = stepId({ stage, dataset, target, attempt }).slice(stage.length + 1);
    const start = state.calls.length;
    const hookStart = setup.facts.length;
    const record = await named(state, { target: setup.target, method: METHODS.get(dataset.family), ...prepared, id });
    Object.assign(record, { family: dataset.family, account: target.account, contents: structuredClone(prepared.contents),
      existence_peer: peerId({ ...context, attempt }), hook_facts: structuredClone(setup.facts.slice(hookStart)),
      public_calls: state.calls.slice(start).map(callSnapshot),
      keyed_checks: keyedChecks({ record, prepared }),
      linkage: { stage, dataset_id: dataset.dataset_id, target: target.target, suffix: target.suffix, pid: target.pid, attempt } });
  }
}
async function observeSetup({ context, action }) {
  try { return await action(); }
  catch (error) {
    const { state, dataset, stage } = context;
    // No emissions are invented when public setup refuses. Retain that exact
    // surface; missing planned captures remain evaluator mismatches, not stops.
    const stepId = `${stage}/${dataset.dataset_id}/setup-${state.records.length}`;
    const record = setupRefusal({ state, error, stepId });
    Object.assign(record, { family: dataset.family, contents: {},
      linkage: { stage, dataset_id: dataset.dataset_id, setup_refusal: true } });
  }
}
async function emitDataset(context) {
  const { state, stage, dataset } = context;
  state.current = stage;
  const start = state.calls.length;
  try {
    const setup = configured(context);
    const targets = dataset.family === "AS" ? TARGETS.filter((target) => target.target === "ex") : TARGETS;
    for (const target of targets) {
      const emission = { ...context, target, configured: setup };
      await observeSetup({ context: emission, action: () => emitTarget(emission) });
    }
  } finally {
    state.linkage_datasets.push({ dataset_id: dataset.dataset_id, stage,
      public_calls: state.calls.slice(start).map(callSnapshot) });
  }
}
// Caller runs all four positive baselines first; an invalidated baseline means
// no linkage work. Unexpected nonbaseline acceptances/refusals remain observations.
export async function linkageWorkload({ state, keying, analyze = true }) {
  if (state.invalidations.length > 0) return;
  const start = state.calls.length;
  state.linkage_datasets = [];
  const setup = { state, stage: "L1", dataset: { dataset_id: "prepared-contexts", family: "setup" } };
  const bases = await observeSetup({ context: setup, action: () => linkageBases({ state, keying }) });
  if (bases === undefined) {
    state.linkage_calls = state.calls.slice(start).map(callSnapshot);
    return;
  }
  for (const [stage, datasets, repeats] of STAGES) {
    for (const dataset of datasets) {
      const context = { state, keying, bases, stage, dataset, repeats };
      await observeSetup({ context, action: () => emitDataset(context) });
    }
  }
  const records = analyze ? state.records.filter((record) => record.linkage !== undefined) : [];
  for (const record of records) record.analysis = analyzeRecord({ record, records });
  state.linkage_calls = state.calls.slice(start).map(callSnapshot);
}
