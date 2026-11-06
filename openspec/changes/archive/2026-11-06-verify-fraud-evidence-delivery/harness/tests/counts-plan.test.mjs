import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateExpectations } from "../counts/expectations.mjs";
import { plannedCalls, readPlanFile, referenceFiles, resolvePhase, verifyReferences } from "../counts/plans.mjs";
import { PROBE_FILES } from "../counts/files.mjs";
import { senderInput } from "../counts/session.mjs";
import { validateProbeInventory } from "../lib/import-closure.mjs";
import { ROLE_SCRIPTS } from "../lib/plan.mjs";
import { sha256 } from "../lib/io.mjs";
import { FROZEN } from "./counts-rehearsal.mjs";

test("frozen counts v1 validates all references, ground truth, sizes and volume bound", () => {
  assert.equal(sha256(readFileSync(new URL("../expectations/counts.v1.json", import.meta.url))), "44e230aaa2a732b21e506b68098cfe9089e922932768ac34eb6487f56d9080d0");
  validateExpectations(structuredClone(FROZEN));
  assert.equal(FROZEN.planned_call_budget.total, 4017);
  assert(FROZEN.planned_call_budget.total <= 20000);
  assert.equal(FROZEN.phases.reduce((sum, phase) => sum + plannedCalls(phase), 0), 4017);
  assert.equal(FROZEN.plans.length, 23);
});

const mutations = [
  ["version", (value) => { value.version = 2; }],
  ["ticket", (value) => { value.ticket = 842; }],
  ["missing plan", (value) => { value.plans.pop(); }],
  ["hash", (value) => { value.plans[0].sha256 = "0".repeat(64); }],
  ["volume", (value) => { value.planned_call_budget.total = 20001; }],
  ["phase budget", (value) => { value.planned_call_budget.processes.outages_clean += 1; }],
  ["size", (value) => { value.phases[0].chain_count += 1; }],
  ["ground truth", (value) => { delete value.ground_truth.outages_clean; }],
  ["case", (value) => { value.cases[0].observer = "failed"; }],
  ["threshold", (value) => { value.thresholds = { latency: 2 }; }],
  ["deadline", (value) => { value.deadline_ms = 999; }],
  ["frozen call plan", (value) => { value.phases[0].call_plan.authenticationSucceeded.maximum += 1; }],
];
for (const [name, mutate] of mutations) {
  test(`expectations refuse altered ${name}`, () => {
    const value = structuredClone(FROZEN);
    mutate(value);
    assert.throws(() => validateExpectations(value));
  });
}

test("referenced bytes are hash-checked before parsing traffic inputs", () => {
  const tamper = (file) => Buffer.concat([readPlanFile(file), Buffer.from(" ")]);
  assert.throws(() => verifyReferences(FROZEN, tamper), /hash mismatch/);
});

test("validated reference files are reused and resolved phases carry no unused fault plan", () => {
  const expectations = structuredClone(FROZEN);
  const reads = [];
  validateExpectations(expectations, (file) => { reads.push(file); return readPlanFile(file); });
  const files = referenceFiles(expectations);
  const phase = resolvePhase({ expectations, phase: expectations.phases[0], files });
  assert.equal(phase.hash_verified, true);
  assert.equal(Object.hasOwn(phase, "fault_plan"), false);
  assert.equal(reads.length, 3);
  const unverified = resolvePhase({ expectations, phase: expectations.phases[0], files: { ...files } });
  assert.equal(unverified.hash_verified, false);
});

test("logic-free shells install role guard as their FIRST import and declare their closure", () => {
  const source = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
  for (const role of ["sender", "ingress"]) {
    const text = source(`counts/${role}-process.mjs`);
    assert.match(text.match(/^import .+$/m)[0], /from "\.\.\/lib\/role-guard\.mjs";/);
    assert.doesNotMatch(text, /\b(?:function|async|class|if|for|while)\b/);
  }
  validateProbeInventory({
    repo: fileURLToPath(new URL("../../../../../", import.meta.url)),
    prefix: "openspec/changes/verify-fraud-evidence-delivery/harness",
    probeDirectory: "counts", files: PROBE_FILES, roleScripts: Object.values(ROLE_SCRIPTS),
  });
});

test("sender field-read parity includes every phase and borrowed runner input", () => {
  const files = verifyReferences(FROZEN);
  for (const phase of FROZEN.phases) {
    const resolved = resolvePhase({ expectations: FROZEN, phase, files });
    const input = senderInput({ expectations: FROZEN, phase: resolved });
    const paths = ["clock.start", "clock.step_ms", "contract_version", "workload.seed", "composition.capacity", "phase.kind", "phase.schedule", "phase.cycles", "phase.occurrences", "phase.chain_count", "phase.failed_count", "phase.tenant_count", "phase.seed_offset", "planned_call_budget.processes.sender"];
    paths.forEach((path) => assert.notEqual(path.split(".").reduce((value, key) => value[key], input), undefined, path));
  }
});

const BASIS_LINES = {
  "packages/security-audit-collector/src/sqlite-storage.ts:55": "PRIMARY KEY (scope_kind, scope_tenant, event_id)",
  "packages/security-audit-collector/src/ingress.ts:194": 'if (written.kind === "duplicate")',
  "packages/security-audit-sdk-node/src/http-handoff.ts:19": 'http_permanent: "non_retryable"',
  "packages/security-audit-sdk-node/src/http-handoff.ts:20": 'malformed_acknowledgment: "protocol_error"',
  "packages/security-audit-sdk-node/src/http-response-classification.ts:52": '"acknowledged" : "malformed_acknowledgment"',
  "packages/security-audit-sdk-node/src/delivery-retry.ts:103": 'terminal("exhausted", "retry_exhausted"',
  "packages/security-audit-sdk-node/src/delivery-backpressure.ts:54": 'status: "rejected_overload"',
  "packages/security-audit-sdk-node/src/delivery-shutdown.ts:57": 'status: "rejected_shutting_down"',
  "packages/security-audit-sdk-node/src/fetch-exchange.ts:45": 'await fetch(`${origin}${request.path}`',
};

test("every frozen package basis line shows the cited persistence, classification or transport behavior", () => {
  const references = new Set(FROZEN.cases.flatMap((entry) => entry.basis).filter((basis) => basis.startsWith("packages/")));
  for (const reference of references) {
    const [path, line] = reference.split(":");
    const source = readFileSync(new URL(`../../../../../${path}`, import.meta.url), "utf8");
    assert(BASIS_LINES[reference], reference);
    assert(source.split("\n")[Number(line) - 1].includes(BASIS_LINES[reference]), reference);
  }
});
