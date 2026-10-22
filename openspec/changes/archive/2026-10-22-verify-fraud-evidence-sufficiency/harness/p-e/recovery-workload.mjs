import { withHostDatabase } from "./host.mjs";
import { runCase } from "./case-steps.mjs";
import { outboxSetup } from "./outbox-steps.mjs";
import { RECOVERY_CASES } from "./recovery-cases.mjs";
import { recoverySummary } from "./recovery-steps.mjs";
import { COMPENSATION_OPTIONS, RETRY_OPTIONS, compensationBranch, rollbackRetryBranch } from "./rollback-retry-workload.mjs";
import { deferredBranch, firstSinkFault, sinkFailureBranch } from "./deferred-workload.mjs";

const BRANCH_PLANS = {
  "P-E-10b": { options: RETRY_OPTIONS, run: rollbackRetryBranch, replay: true },
  "P-E-10c": { options: ["fault"], run: sinkFailureBranch, sinkOptions: { fault: firstSinkFault } },
  "P-E-10b(v)": { options: ["v"], run: rollbackRetryBranch, replay: true },
  "P-E-10d": { options: COMPENSATION_OPTIONS, run: compensationBranch, replay: true },
  "P-E-9c": { options: ["rollback", "commit"], run: deferredBranch, sinkOptions: { deferred: true } },
};

async function runBranch(state, { entry, plan, option, directory }) {
  return withHostDatabase({ directory, name: `${entry.case_id}-${option}`, work: async (host) => {
    const callStart = state.calls.length;
    const prefix = plan.replay ? `${option}:rollback:` : `${option}:`;
    const setup = outboxSetup(state, { host, caseId: entry.case_id, prefix, sinkOptions: plan.sinkOptions });
    const observed = await plan.run(state, setup, option);
    return { option, ...observed, public_calls: state.calls.length - callStart };
  } });
}

export async function recoveryCase(state, entry, { directory }) {
  const seqStart = state.sequence.length;
  const recordStart = state.records.length;
  const plan = BRANCH_PLANS[entry.case_id];
  const branches = [];
  for (const option of plan.options) branches.push(await runBranch(state, { entry, plan, option, directory }));
  return recoverySummary(state, entry, { branches, seqStart, recordStart });
}

export async function recoveryWorkload(state, { directory, cases = RECOVERY_CASES }) {
  const rows = [];
  for (const entry of cases) {
    const row = await runCase(state, entry, () => recoveryCase(state, entry, { directory }));
    if (row !== null) rows.push(row);
  }
  state.accounting.push(...rows);
  return rows;
}
