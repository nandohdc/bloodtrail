// One durable-row relay engine; only an exact persisted acknowledgment permits marking.
import assert from "node:assert/strict";

export class RelayCrashError extends Error {
  constructor(message) {
    super(message);
    this.name = "RelayCrashError";
  }
}

export function isAcknowledgedStatus(status) {
  return status === "acknowledged";
}

export function isAcknowledgedResult(result) {
  if (!result.ok) return false;
  return isAcknowledgedStatus(result.value.status);
}

async function deliverOutboxRow({ row, composition, ledger, recordCall, label }) {
  return recordCall({
    ledger, label,
    invoke: async () => ({ ok: true, value: await composition.deliver(JSON.parse(row.body)) }),
  });
}

export async function drainPendingOutbox({
  host, composition, ledger, recordCall, getLabel, onBeforeMark = async () => {},
}) {
  assert(!host.closed, "host database is closed");
  const deliveries = [];
  for (const [index, row] of host.pendingOutboxRows().entries()) {
    const label = getLabel(index);
    const result = await deliverOutboxRow({ row, composition, ledger, recordCall, label });
    deliveries.push({ row, result });
    if (!isAcknowledgedResult(result)) continue;
    await onBeforeMark({ row, index, host, deliveries });
    host.markRelayed({ event_id: row.event_id });
  }
  return deliveries;
}

export async function drainMarkBeforeAck({
  host, composition, ledger, recordCall, getLabel, crashAfterMarkIndex,
}) {
  assert(!host.closed, "host database is closed");
  const deliveries = [];
  for (const [index, row] of host.pendingOutboxRows().entries()) {
    host.markRelayed({ event_id: row.event_id });
    if (index === crashAfterMarkIndex) throw new RelayCrashError("planted mark before ack crash");
    const label = getLabel(index);
    const result = await deliverOutboxRow({ row, composition, ledger, recordCall, label });
    deliveries.push({ row, result });
  }
  return deliveries;
}
