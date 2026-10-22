import { acceptedHostTransaction } from "./outbox-workload.mjs";
import { beginHostTransaction, finishHostTransaction, outboxEmit, outboxSnapshot, outboxTransition } from "./outbox-steps.mjs";
import { recoveryBranchFacts, recoveryIdentity } from "./recovery-steps.mjs";

export function firstSinkFault({ ordinal }) {
  return ordinal === 1 ? new Error("synthetic first sink failure") : null;
}

export async function sinkFailureBranch(state, setup) {
  // First transaction includes markCommitted; the second deliberately uses
  // the SAME still-committed handle, with no retry input or transition.
  await acceptedHostTransaction(state, setup, "rollback");
  const prior = setup.sink.retained[0];
  setup.prefix = "retry:";
  beginHostTransaction(state, setup);
  await outboxEmit(state, setup);
  finishHostTransaction(state, setup, "commit");
  await outboxSnapshot(state, setup);
  return recoveryBranchFacts(setup, { identity: recoveryIdentity({ prior, next: setup.sink.retained[1] }),
    sink_counts: structuredClone(setup.sink.counts) });
}

export async function deferredBranch(state, setup, terminal) {
  beginHostTransaction(state, setup);
  await outboxTransition(state, setup, { id: "mark", method: "markCommitted" });
  await outboxEmit(state, setup, { terminal: () => finishHostTransaction(state, setup, terminal) });
  // All pending insertion work has settled before snapshot and DB cleanup.
  await outboxSnapshot(state, setup);
  return recoveryBranchFacts(setup, { sink_counts: structuredClone(setup.sink.counts) });
}
