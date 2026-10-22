import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { openHostDatabase } from "../p-e/host.mjs";

// Synthetic emitted event in the public shape the SDK passes to its sink.
export const EVENT = Object.freeze({
  event: Object.freeze({ id: "pe-event-0001", type: "mfa.removed", occurred_at: "synthetic" }),
  correlation: Object.freeze({ transaction_id: "pe-txn-0001" }),
});

export function scratchDirectory(t, prefix) {
  const directory = mkdtempSync(join(tmpdir(), prefix));
  t.after(() => rmSync(directory, { recursive: true, force: true }));
  return directory;
}

export function temporaryHost(t, name = "case") {
  const directory = scratchDirectory(t, "pe-host-");
  const host = openHostDatabase({ directory, name });
  return { directory, host };
}
