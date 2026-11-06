// Every pass re-reads pending rows through the shared relay.
import assert from "node:assert/strict";
import { openHostDatabase } from "./host.mjs";
import { drainPendingOutbox, isAcknowledgedResult, RelayCrashError } from "./relay.mjs";

export function plannedDrain(ctx, extra = {}) {
  return drainPendingOutbox({
    host: ctx.host, composition: ctx.composition, ledger: ctx.ledger,
    recordCall: ({ label, invoke }) => ctx.record({ label }, invoke),
    getLabel: () => {
      const step = ctx.plan[ctx.planIndex++];
      assert(step, "relay plan exhausted");
      assert.equal(typeof step.label, "string", "relay plan label required");
      return step.label;
    },
    ...extra,
  });
}

async function crashRelay(ctx) {
  let crashFired = false;
  let acknowledgments = 0;
  try {
    await plannedDrain(ctx, {
      onBeforeMark: async () => {
        acknowledgments += 1;
        if (acknowledgments === ctx.phase.crash_after_acknowledgment) {
          throw new RelayCrashError("disclosed in-process crash before mark");
        }
      },
    });
  } catch (error) {
    assert(error instanceof RelayCrashError, `unexpected relay error: ${error.message}`);
    crashFired = true;
  }
  const before = ctx.host.order;
  ctx.host.close();
  ctx.host = openHostDatabase({ directory: ctx.hostDirectory, name: ctx.phase.name, exists: true });
  try {
    await plannedDrain(ctx);
  } catch (error) {
    ctx.host.close();
    throw error;
  }
  return {
    finalHost: ctx.host, crash_fired: crashFired,
    pending_after_resume: ctx.host.counts().pending_outbox,
    transaction_order: [...before, ...ctx.host.order],
  };
}

async function outageRelay(ctx) {
  const first = await plannedDrain(ctx);
  const failedRows = first.filter(({ result }) => !isAcknowledgedResult(result));
  const initialFailures = failedRows.length;
  const pendingOutbox = ctx.host.counts().pending_outbox;
  const recovered = await plannedDrain(ctx);
  return {
    finalHost: ctx.host, initial_outage_failures: initialFailures,
    pending_outbox: pendingOutbox, outage_failed_event_ids: failedRows.map(({ row }) => row.event_id),
    recovery_read_event_ids: recovered.map(({ row }) => row.event_id),
    recovery_delivered_event_ids: recovered.filter(({ result }) => isAcknowledgedResult(result)).map(({ row }) => row.event_id),
    pending_after_recovery: ctx.host.counts().pending_outbox,
    transaction_order: ctx.host.order,
  };
}

export async function executePhaseRelay(ctx) {
  const runners = { crash_restart: crashRelay, outage_defer: outageRelay };
  const runner = runners[ctx.phase.kind];
  if (runner) return runner(ctx);
  await plannedDrain(ctx);
  return { finalHost: ctx.host, transaction_order: ctx.host.order };
}
