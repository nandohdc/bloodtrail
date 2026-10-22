import { AUTHZ } from "./baselines.mjs";
import { commit, named, operation, step } from "./runtime.mjs";

const removed = (state, target, input, id = "main") => named(state, { id, target, method: "mfaRemoved", input: { ...state.mr, ...input } });

async function direct(state, target) {
  await removed(state, target, { event: { commit_state: "committed" } });
  await named(state, { id: "af", target, input: { ...state.af, event: { ...state.af.event, commit_state: "committed" } } });
}

async function pending(state, target) {
  const h = operation(state, target);
  await removed(state, target, { operation: h }, "pending");
  await step(state, "transition", target, () => commit(state, h));
  await removed(state, target, { operation: h }, "committed");
}

async function forgedFrame(state, target) {
  let callbacks = 0;
  const operation = { operation_id: "op_synthetic_0002", transaction_id: "txn_synthetic_0002", state: "committed", commit_state: "committed", transactional: true };
  await step(state, "main", target, () => state.method(target.sdk, "runWithContext", { operation }, () => {
    callbacks += 1;
    return state.method(target.sdk, "mfaRemoved", state.mr);
  }), () => ({ callbacks }));
}

// #797: every catalog-supported transaction-bound non-success combination.
export function transactionVariants(core) {
  return core.EVENT_CATALOG.filter((entry) => entry.commit.includes("committed")).flatMap((entry) => {
    const method = core.EVENT_METHODS.find((candidate) => candidate.name === entry.name).method;
    return entry.outcomes.filter((outcome) => outcome !== "success").map((outcome) => ({ method, outcome }));
  });
}

async function noHandle(state, target) {
  for (const { method, outcome } of transactionVariants(state.core)) {
    const input = { ...state.mr, event: { outcome } };
    if (outcome === "denied") input.authorization = state.c("authorizationEvidence", { ...AUTHZ, decision: "deny", decision_reason: "policy_denied" });
    await named(state, { id: `${method}-${outcome}`, target, method, input });
  }
}

async function explicitDenial(state, target) {
  const authorization = state.c("authorizationEvidence", { ...AUTHZ, decision: "deny", decision_reason: "policy_denied" });
  await removed(state, target, { authorization, event: { outcome: "denied", commit_state: "not_committed" } });
}

async function retries(state) {
  const target = state.baselineM;
  for (const attempt of [1, 1001]) {
    await removed(state, target, { operation: state.completed, retry: { retry_attempt: attempt, original_event_id: "evt_synthetic_0001" } }, String(attempt));
  }
}

export const C_COMMIT_CASES = [
  ["PD-C1", 4, direct], ["PD-C2", 3, (s, t) => removed(s, t, {})], ["PD-C3", 6, pending],
  ["PD-C4", 4, (s, t) => removed(s, t, { operation: operation(s, t, { transactional: false }) })],
  ["PD-C5", 4, (s, t) => removed(s, t, { operation: operation(s, t), event: { commit_state: "committed" } })],
  ["PD-C8", 4, forgedFrame], ["PD-C9", 50, noHandle], ["PD-C10", 4, explicitDenial],
  ["PD-C12", 1, (s) => removed(s, s.baselineM, { operation: s.completed })], ["PD-C13", 2, retries],
];
