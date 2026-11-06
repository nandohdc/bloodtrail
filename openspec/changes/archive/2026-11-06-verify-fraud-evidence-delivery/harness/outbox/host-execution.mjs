// SDK calls within each host SQLite transaction.
import { buildEventInput } from "./workload.mjs";

export function phaseRecorder({ ledger, recordedCall, calls }) {
  return async (step, invoke) => {
    const result = await recordedCall({ ledger, label: step.label, invoke });
    calls.push(result);
    return result;
  };
}

async function emitChange({ item, sdk, core, handle, record, steps, makeInput }) {
  const input = makeInput({ core, method: item.method, identity: item.identity, at: item.at });
  return record(steps[2], () => sdk[item.method]({ ...input, operation: handle }));
}

async function executeSingleChange(ctx, item, steps) {
  const { host, sdk, record } = ctx;
  host.begin();
  host.insertBusiness({ id: item.businessId, transaction_id: item.identity.transactionId });
  const begun = await record(steps[0], () => sdk.beginOperation({
    boundEvent: item.method, transactionId: item.identity.transactionId,
  }));
  if (!begun.ok) return host.rollback();
  const committed = await record(steps[1], () => begun.value.markCommitted());
  if (!committed.ok) return host.rollback();
  const emitted = await emitChange({ ...ctx, item, steps, handle: begun.value });
  if (!emitted.ok) return host.rollback();
  if (ctx.phase.kind === "rollback") return host.rollback();
  host.commit();
}

export async function executeHostWorkload({ workload, makeInput = buildEventInput, ...ctx }) {
  let planIndex = 0;
  for (const item of workload.items) {
    await executeSingleChange({ ...ctx, makeInput }, item, ctx.plan.slice(planIndex, planIndex + 3));
    planIndex += 3;
  }
  return planIndex;
}
