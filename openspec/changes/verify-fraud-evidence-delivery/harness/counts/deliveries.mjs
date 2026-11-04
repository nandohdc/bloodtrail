import { sha256 } from "../lib/io.mjs";

// Preserve a separate settled report for every body, including copies sharing an event.id.
export function observeComposition(composition, reports) {
  const pending = new Set();
  return {
    ...composition,
    async deliver(event) {
      const report = { event_id: event.event.id, body_sha256: sha256(JSON.stringify(event)), status: "pending" };
      reports.push(report);
      pending.add(report);
      try {
        const result = await composition.deliver(event);
        if (report.status !== "abandoned") report.status = result.status;
        return result;
      } finally {
        pending.delete(report);
      }
    },
    async shutdown() {
      const result = await composition.shutdown();
      for (const report of pending) recordAbandonment(composition, report);
      return result;
    },
  };
}

function recordAbandonment(composition, report) {
  if (composition.deliveries.get(report.event_id)?.status === "abandoned") report.status = "abandoned";
}
