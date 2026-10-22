// FUTURE exact-head S1-gated process only. Never import/execute in build tests.
// Import-safe: importing this module performs no work. The SDK packages and
// all parsing/measurement live inside the direct-execution-only main, so the
// copied inventory imports under --permission without any kit present.
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { createState } from "./runtime.mjs";
import { measure } from "./workload.mjs";
import { P_E_BUDGET } from "./budget.mjs";

export async function main() {
  const { values } = parseArgs({ options: { role: { type: "string" }, budget: { type: "string" },
    "database-directory": { type: "string" } } });
  assert.equal(values.role, "sequential");
  assert.equal(Number(values.budget), P_E_BUDGET.processes.sequential);
  const core = await import("@bloodtrail/security-audit-sdk-core");
  const node = await import("@bloodtrail/security-audit-sdk-node");
  const testing = await import("@bloodtrail/security-audit-sdk-core/testing");
  const ledger = occurrenceLedger({ budget: Number(values.budget) });
  const observed = await measure({ state: createState({ core, node, testing, ledger }),
    directory: values["database-directory"] });
  process.stdout.write(JSON.stringify({ ...observed, resolved_core: import.meta.resolve("@bloodtrail/security-audit-sdk-core") }) + "\n");
}

if (import.meta.main) await main();
