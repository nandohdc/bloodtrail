// Future S1-gated entry only. Never imported by the fixture tests.
import * as core from "@bloodtrail/security-audit-sdk-core";
import * as node from "@bloodtrail/security-audit-sdk-node";
import * as testing from "@bloodtrail/security-audit-sdk-core/testing";
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { callRecorder } from "../lib/observe.mjs";
import { ROLES } from "./roles.mjs";
import { captureState } from "./workload.mjs";
import { measureRole } from "./measure.mjs";

const { values } = parseArgs({ options: { role: { type: "string" }, budget: { type: "string" } } });
const plan = ROLES.find((entry) => entry.role === values.role);
assert(plan, "unknown probe role");
const ledger = occurrenceLedger({ budget: Number(values.budget) });
const state = {
  core, node, testing, ledger, recorder: callRecorder({ ledger }), role: plan.role,
  factories: { core: core.createSecurityAuditSdk, node: node.createNodeSecurityAuditSdk },
  sinks: [], handles: [], direct: [], invalidations: [], retention: null,
};

await measureRole({ state, plan });
const output = { ...captureState({ state }), resolved_core: import.meta.resolve("@bloodtrail/security-audit-sdk-core") };
process.stdout.write(JSON.stringify(output) + "\n");
// Parent consumes partial observations and decides the run's exit status.
