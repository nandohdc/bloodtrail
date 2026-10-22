// FUTURE exact-head S1-gated process only. Never import/execute in build tests.
// Import-safe: importing this module performs no work. The SDK packages and
// all parsing/measurement live inside the direct-execution-only main, so the
// copied inventory imports under --permission without any kit present.
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { createState } from "./runtime.mjs";
import { measure } from "./workload.mjs";
import { P_ATTR_BUDGET } from "./linkage-cases.mjs";

export async function main() {
  const { values } = parseArgs({ options: { role: { type: "string" }, budget: { type: "string" } } });
  assert.equal(values.role, "matrix");
  assert.equal(Number(values.budget), P_ATTR_BUDGET.processes.matrix);
  const core = await import("@bloodtrail/security-audit-sdk-core");
  const node = await import("@bloodtrail/security-audit-sdk-node");
  const testing = await import("@bloodtrail/security-audit-sdk-core/testing");
  const ledger = occurrenceLedger({ budget: Number(values.budget) });
  // analyze:false — the child has no field-policy.json copy and no read grant
  // beyond its own service directory; the parent computes every analysis from
  // the approved checkout instead.
  const observed = await measure({ state: createState({ core, node, testing, ledger }), analyze: false });
  process.stdout.write(JSON.stringify({ ...observed, resolved_core: import.meta.resolve("@bloodtrail/security-audit-sdk-core") }) + "\n");
}

if (import.meta.main) await main();
