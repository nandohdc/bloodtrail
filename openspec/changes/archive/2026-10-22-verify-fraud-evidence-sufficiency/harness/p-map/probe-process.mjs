// FUTURE exact-head S1-gated process. Build tests must never import/spawn it.
// No package resolution, parsing or measurement outside guarded main.
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { createState } from "./runtime.mjs";
import { measure } from "./workload.mjs";
import { P_MAP_BUDGET } from "./budget.mjs";

export async function main() {
  const { values } = parseArgs({ options: { role: { type: "string" }, budget: { type: "string" } } });
  assert.equal(values.role, "sequential");
  assert.equal(Number(values.budget), P_MAP_BUDGET.processes.sequential);
  const core = await import("@bloodtrail/security-audit-sdk-core");
  const node = await import("@bloodtrail/security-audit-sdk-node");
  const testing = await import("@bloodtrail/security-audit-sdk-core/testing");
  const ledger = occurrenceLedger({ budget: Number(values.budget) });
  const observed = await measure({ state: createState({ core, node, testing, ledger }) });
  process.stdout.write(JSON.stringify({ ...observed,
    resolved_core: import.meta.resolve("@bloodtrail/security-audit-sdk-core") }) + "\n");
}

if (import.meta.main) await main();
