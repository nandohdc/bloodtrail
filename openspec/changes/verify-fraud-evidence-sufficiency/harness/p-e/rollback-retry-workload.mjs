import { rollbackReplay } from "./outbox-workload.mjs";
import { beginHostTransaction, finishHostTransaction, hostFacts, outboxEmit, outboxTransition } from "./outbox-steps.mjs";
import { recoveryBranchFacts, recoveryHandle, recoveryIdentity } from "./recovery-steps.mjs";

export const RETRY_OPTIONS = ["i", "ii", "iii-sdk", "iii-named", "iv"];
export const COMPENSATION_OPTIONS = ["a", "b", "c", "d"];

async function freshHandle(state, setup, { prior, reuseIds }) {
  const ids = reuseIds ? { transactionId: prior.correlation.transaction_id, correlationId: prior.correlation.correlation_id } : {};
  const begun = await recoveryHandle(state, setup, ids);
  if (!begun.accepted) return;
  await outboxTransition(state, setup, { id: "mark", method: "markCommitted" });
  await outboxEmit(state, setup);
}

function retryInput(prior) {
  return { retry: { retry_attempt: 1, original_event_id: prior.event.id } };
}

const RETRY_ACTIONS = {
  i: (state, setup, prior) => freshHandle(state, setup, { prior, reuseIds: false }),
  ii: (state, setup, prior) => outboxEmit(state, setup, { input: retryInput(prior), refusalExpected: true }),
  "iii-sdk": (state, setup, prior) => outboxEmit(state, setup, { method: "redeliver", input: prior }),
  "iii-named": (state, setup, prior) => outboxEmit(state, setup, { input: { redelivery: { event: prior } } }),
  iv: (state, setup, prior) => recoveryHandle(state, setup, { operationId: prior.correlation.operation_id }),
  v: (state, setup, prior) => freshHandle(state, setup, { prior, reuseIds: true }),
};
const COMPENSATION_INPUTS = {
  a: () => ({}),
  b: () => ({ event: { outcome: "failure" } }),
  c: () => ({ event: { outcome: "failure", commit_state: "not_committed" } }),
  d: retryInput,
};

async function replay(state, setup) {
  await rollbackReplay(state, setup);
  return { prior: setup.sink.retained[0], rollback: hostFacts(setup),
    compensated_before_branch: setup.handle.state === "compensated" };
}

export async function rollbackRetryBranch(state, setup, option) {
  const baseline = await replay(state, setup);
  setup.prefix = `${option}:retry:`;
  beginHostTransaction(state, setup);
  const sinkBefore = setup.sink.retained.length;
  await RETRY_ACTIONS[option](state, setup, baseline.prior);
  finishHostTransaction(state, setup, "commit");
  return recoveryBranchFacts(setup, { rollback: baseline.rollback,
    compensated_before_branch: baseline.compensated_before_branch,
    retained_frozen: Object.isFrozen(baseline.prior),
    identity: recoveryIdentity({ prior: baseline.prior, next: setup.sink.retained[sinkBefore] }) });
}

export async function compensationBranch(state, setup, option) {
  const baseline = await replay(state, setup);
  setup.prefix = `${option}:compensation:`;
  await outboxEmit(state, setup, { input: COMPENSATION_INPUTS[option](baseline.prior), refusalExpected: true });
  return recoveryBranchFacts(setup, { compensated_before_branch: baseline.compensated_before_branch,
    new_sink_events: setup.sink.retained.length - 1 });
}
