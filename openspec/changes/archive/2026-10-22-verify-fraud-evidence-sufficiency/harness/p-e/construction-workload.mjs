import { caseSummary, construct, handleFacts, occurrenceFacts, recordStep, runCase } from "./case-steps.mjs";
import { CONSTRUCTION_CASES } from "./construction-cases.mjs";

// Construction-family workload: drives each case through the injected runtime
// (lib/runtime.mjs) against whatever core/node/testing surfaces were injected.
// Every step owns its record via `${case_id}/${step}`; each case ends with a
// summary row comparing predicted and actual counters. No SDK, kit or probe
// code is imported or executed here.

async function pendingHandleCase(state, entry) {
  const seqStart = state.sequence.length;
  const { input, target, counters } = construct(state, entry.case_id);
  const begin = state.method(target.sdk, "beginOperation", { boundEvent: "mfaRemoved" });
  const handle = begin.value;
  await recordStep(state, { id: "refusal", target, counters, refusalExpected: true,
    run: () => state.method(target.sdk, "mfaRemoved", { ...input, operation: handle }),
    extra: () => ({ handle: handleFacts(handle) }) });
  await recordStep(state, { id: "mark", target, counters,
    run: () => state.method(handle, "markCommitted"), extra: () => ({ handle: handleFacts(handle) }) });
  const followup = await recordStep(state, { id: "followup", target, counters,
    run: () => state.method(target.sdk, "mfaRemoved", { ...input, operation: handle }),
    extra: () => ({ handle: handleFacts(handle) }) });
  followup.occurrence = occurrenceFacts({ captures: followup.captures, handle });
  return caseSummary(state, entry, { seqStart, actual: counters(), steps: ["refusal", "mark", "followup"] });
}

// The five single-refusal construction cases share one runner: construct a
// fresh instance, optionally open a handle, then observe the refused named
// call and its zero captures. The variant tables below keep each case's
// input surface distinct (events.ts:205-225 order of checks).
async function refusedConstruction(state, entry, { operation, extraInput = {}, stepId }) {
  const seqStart = state.sequence.length;
  const { input, target, counters } = construct(state, entry.case_id);
  const handle = operation === undefined ? undefined : state.method(target.sdk, "beginOperation", operation).value;
  const run = () => {
    const next = { ...input, ...extraInput };
    if (handle !== undefined) next.operation = handle;
    return state.method(target.sdk, "mfaRemoved", next);
  };
  const extra = handle === undefined ? undefined : () => ({ handle: handleFacts(handle) });
  await recordStep(state, { id: stepId, target, counters, refusalExpected: true, run, extra });
  return caseSummary(state, entry, { seqStart, actual: counters(), steps: [stepId] });
}

async function directCommitCase(state, entry) {
  return refusedConstruction(state, entry, { extraInput: { event: { commit_state: "committed" } }, stepId: "direct" });
}

async function directPrecedenceCase(state, entry) {
  return refusedConstruction(state, entry, { operation: { boundEvent: "mfaRemoved" },
    extraInput: { event: { commit_state: "committed" } }, stepId: "direct-over-pending" });
}

async function neitherCase(state, entry) {
  return refusedConstruction(state, entry, { stepId: "neither" });
}

async function nontransactionalCase(state, entry) {
  return refusedConstruction(state, entry, { operation: { boundEvent: "mfaRemoved", transactional: false },
    stepId: "nontransactional" });
}

async function handlelessFailureCase(state, entry) {
  return refusedConstruction(state, entry, { extraInput: { event: { outcome: "failure" } },
    stepId: "handleless-failure" });
}

const RUNNERS = {
  "P-E-1a": pendingHandleCase,
  "P-E-1b": directCommitCase,
  "P-E-1c": directPrecedenceCase,
  "P-E-1d": neitherCase,
  "P-E-1e": nontransactionalCase,
  "P-E-1f": handlelessFailureCase,
};

export async function constructionCase(state, entry) {
  return RUNNERS[entry.case_id](state, entry);
}

export async function constructionWorkload(state, cases = CONSTRUCTION_CASES) {
  const rows = [];
  for (const entry of cases) {
    const row = await runCase(state, entry, () => constructionCase(state, entry));
    if (row !== null) rows.push(row);
  }
  state.accounting.push(...rows);
  return rows;
}
