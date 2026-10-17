// FUTURE S1-gated probe only; never import or execute during task 2.1.
import * as core from "@bloodtrail/security-audit-sdk-core";
import * as node from "@bloodtrail/security-audit-sdk-node";
import * as testing from "@bloodtrail/security-audit-sdk-core/testing";
import assert from "node:assert/strict";
import { parseArgs } from "node:util";
import { occurrenceLedger } from "../lib/ledger.mjs";
import { createState } from "./runtime.mjs";
import { measure } from "./workload.mjs";

const { values } = parseArgs({ options: { role: { type: "string" }, budget: { type: "string" } } });
assert.equal(values.role, "integrity");
const ledger = occurrenceLedger({ budget: Number(values.budget) });
const observed = await measure({ state: createState({ core, node, testing, ledger }) });
process.stdout.write(JSON.stringify({ ...observed, resolved_core: import.meta.resolve("@bloodtrail/security-audit-sdk-core") }) + "\n");
