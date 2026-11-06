// Plan and expectations tests for the Stage 2 outbox probe (#842, Q243, Q251, Q252).
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { command, sha256 } from "../lib/io.mjs";
import { validateProbeInventory } from "../lib/import-closure.mjs";
import { ROLE_SCRIPTS } from "../lib/plan.mjs";
import { phaseCallPlan } from "../outbox/call-plan.mjs";
import { validateExpectations } from "../outbox/expectations.mjs";
import { PROBE_FILES } from "../outbox/files.mjs";
import { senderRun } from "../outbox/sender-phases.mjs";
import { hostDbIsolationControl } from "../outbox/controls.mjs";
import { generateWorkloadDefinition } from "../outbox/workload.mjs";

const HARNESS = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = command({ program: "git", args: ["rev-parse", "--show-toplevel"], cwd: HARNESS }).trim();
const EXPECTATIONS_PATH = join(HARNESS, "expectations/outbox.v1.json");
const FROZEN_V1 = JSON.parse(readFileSync(EXPECTATIONS_PATH, "utf8"));

const CITATION_SUBSTRINGS = {
  "H-01": [
    'return transition(this, "committed", ["started"]);',
    "host.commit();",
  ],
  "H-02": [
    'if (ctx.phase.kind === "rollback") return host.rollback();',
    "pending = this.#config.sink.emit(event);",
  ],
  "H-03": [
    "invoke: async () => ({ ok: true, value: await composition.deliver(JSON.parse(row.body)) }),",
    'acknowledged: "acknowledged",',
  ],
  "H-04": [
    'throw new RelayCrashError("disclosed in-process crash before mark");',
    "export function storedExactlyOnce(bodies, readBack)",
    "ON CONFLICT (scope_kind, scope_tenant, event_id) DO NOTHING",
    'if (existing.occurrence_key === record.occurrenceKey) return { kind: "duplicate" };',
  ],
  "H-05": [
    'if (existing.occurrence_key === record.occurrenceKey) return { kind: "duplicate" };',
    'return { kind: "duplicate", eventId: identity.eventId, senderIdentity: identity.senderIdentity, acknowledgment: "persisted" };',
  ],
  "H-06": [
    'bindEvent: db.prepare("UPDATE business_change SET event_id = ? WHERE id = ?"),',
    "transaction_id: operation?.transaction_id ?? frame.correlation?.transaction_id,",
  ],
  "H-07": [
    'rule: rules.get(`${occurrence}/${attempt}`) ?? { action: "acknowledge" }',
    "const recovered = await plannedDrain(ctx);",
  ],
  "H-08": [
    "await drainMarkBeforeAck({ ...options, crashAfterMarkIndex: crashIndex });",
    "await drainPendingOutbox({",
  ],
  "H-09": [
    'flags.push(`--allow-fs-read=${hostDatabase}`, `--allow-fs-write=${hostDatabase}`);',
    'refusedPath: join(dirname(directory), "planted-host-write"),',
  ],
  "H-10": [
    "export async function senderControls({ guard, port })",
  ],
  "H-11": [
    "const accounting = computeAccounting(phase, config.occurrences);",
    "all_phases_hold: allTrue(results.map((result) => result.holds)),",
  ],
};

test("the frozen outbox.v1.json is byte-identical and retains its hash", () => {
  const bytes = readFileSync(EXPECTATIONS_PATH);
  const hash = sha256(bytes);
  assert.equal(hash, "0f3bffd620324ef7ba4d6d5701d92da6ee7e40503870ad832de5c960b81e1a8b");
});

test("the frozen outbox.v1.json validates through validateExpectations", () => {
  const result = validateExpectations(structuredClone(FROZEN_V1));
  assert.equal(result.version, 1);
  assert.equal(result.ticket, 842);
  assert.equal(result.probe, "S2-outbox");
  assert.equal(result.cases.length, 11);
});

test("outbox.v1.json validates, and mutating it is refused", () => {
  assert.equal(validateExpectations(structuredClone(FROZEN_V1)).version, 1);
  const mutations = [
    (val) => { delete val.phases[2].crash_after_acknowledgment; },
    (val) => { val.phases[2].crash_after_acknowledgment = 0; },
    (val) => { val.phases[2].crash_after_acknowledgment = 7; },
    (val) => { val.phases[2].crash_after_acknowledgment = 1.5; },
    (val) => { val.version = 2; },
    (val) => { val.version = "1"; },
    (val) => { val.contract_version = "2.0.0"; },
    (val) => { val.ticket = 999; },
    (val) => { val.cases.pop(); },
    (val) => { val.cases[0].basis = []; },
    (val) => { val.cases[0].basis = ["unrelated/file.mjs:1"]; },
    (val) => { val.cases[0].basis = ["packages/example.ts:0"]; },
    (val) => { delete val.cases[0].expected; },
    (val) => { val.cases[2].case_id = "H-09"; },
    (val) => { val.workload.seed = 0; },
    (val) => { val.clock.step_ms = 0; },
    (val) => { val.phases[0].composition.max_attempts = 0; },
    (val) => { delete val.phases[0].cycles; },
    (val) => { val.phases[0].cycles = 0; },
    (val) => { val.phases[0].unknown_key = true; },
    (val) => { val.planned_call_budget.total = 999; },
    (val) => { val.planned_call_budget.processes.commit_relay = 99; },
    (val) => { val.phases[0].occurrences = 0; },
    (val) => { val.phases[0].distinct_occurrences = 0; },
    (val) => { val.scenarios.unknown_scenario = []; },
    (val) => { val.phases[0].schedule[0] = "unknown_scenario"; },
    (val) => { val.composition.capacity = 100_001; },
    (val) => { val.composition.max_attempts = 1001; },
    (val) => { val.composition.exchange_timeout_ms = 60_001; },
    (val) => { val.composition.max_delay_ms = val.composition.base_delay_ms - 1; },
    (val) => { val.planned_call_budget = { malformed: true }; },
    (val) => { val.unknown_top_level = true; },
  ];

  for (const mutate of mutations) {
    const value = structuredClone(FROZEN_V1);
    mutate(value);
    assert.throws(() => validateExpectations(value), undefined, mutate.toString());
  }
});

test("each role's import closure is inside the declared inventory, and a missing module is caught", () => {
  validateProbeInventory({
    repo: REPO,
    prefix: "openspec/changes/verify-fraud-evidence-delivery/harness",
    probeDirectory: "outbox",
    files: PROBE_FILES,
    roleScripts: Object.values(ROLE_SCRIPTS),
  });
});

test("planned call budget derives from plan and matches expectations", () => {
  const budget = FROZEN_V1.planned_call_budget;
  let totalCalculated = 0;
  for (const phase of FROZEN_V1.phases) {
    const plan = phaseCallPlan(phase);
    const phaseBudget = budget.processes[phase.name];
    assert.equal(phaseBudget, plan.length, `budget mismatch for ${phase.name}`);
    totalCalculated += plan.length;
  }
  assert.equal(budget.total, 539);
  assert.equal(totalCalculated, 539);
});

test("basis citations match exact line numbers and code substrings", () => {
  for (const caseDef of FROZEN_V1.cases) {
    const expectedSubstrings = CITATION_SUBSTRINGS[caseDef.case_id];
    assert(expectedSubstrings, `missing citation substrings for ${caseDef.case_id}`);
    assert.equal(caseDef.basis.length, expectedSubstrings.length, `basis count mismatch for ${caseDef.case_id}`);

    for (let i = 0; i < caseDef.basis.length; i += 1) {
      const citation = caseDef.basis[i];
      const [relPath, lineStr] = citation.split(":");
      const lineNum = Number.parseInt(lineStr, 10);
      const fullPath = join(REPO, relPath);
      const content = readFileSync(fullPath, "utf8");
      const lines = content.split("\n");
      const lineContent = lines[lineNum - 1];
      const expectedSubstring = expectedSubstrings[i];
      assert(
        lineContent.includes(expectedSubstring),
        `Citation ${citation} line ${lineNum} did not contain "${expectedSubstring}". Actual line: "${lineContent}"`,
      );
    }
  }
});

test("workload generation is deterministic from seeds", () => {
  const w1 = generateWorkloadDefinition({ count: 6, seed: 842001 });
  const w2 = generateWorkloadDefinition({ count: 6, seed: 842001 });
  assert.deepEqual(w1, w2);
  assert.equal(w1.items.length, 6);
  assert.equal(w1.items[0].method, "roleAssigned");
  assert.equal(w1.items[1].method, "sensitiveResourceModified");
});

for (const role of ["sender", "ingress"]) {
  test(`${role} installs role-guard as the first import`, () => {
    const text = readFileSync(join(HARNESS, `outbox/${role}-process.mjs`), "utf8");
    const first = text.match(/^\s*import\s+[^;]+from\s+["']([^"']+)["']/m);
    assert(first);
    assert.equal(first[1], "../lib/role-guard.mjs");
  });
}

test("host database isolation refuses a missing or empty directory", () => {
  for (const args of [[], [""]]) {
    assert.throws(() => Reflect.apply(hostDbIsolationControl, undefined, args), /host database directory required/);
  }
});

function assertHygiene(path) {
  const content = readFileSync(path, "utf8");
  assert(content.endsWith("\n"), `missing final newline: ${path}`);
  assert(!content.endsWith("\n\n"), `multiple final newlines: ${path}`);
  assert(!content.includes("\r"), `CR byte: ${path}`);
  assert(!/[\t ]+$/m.test(content), `trailing whitespace: ${path}`);
}

test("outbox and shared edited files have exactly one final newline and clean whitespace", () => {
  const relative = [
    ...readdirSync(join(HARNESS, "outbox")).map((name) => `outbox/${name}`),
    ...readdirSync(join(HARNESS, "tests")).filter((name) => name.startsWith("outbox-")).map((name) => `tests/${name}`),
    "tests/permissions.test.mjs", "README.md", "lib/permissions.mjs",
    "lib/kit-pipeline.mjs", "lib/probe-runner.mjs", "expectations/outbox.v1.json",
  ];
  for (const path of relative) assertHygiene(join(HARNESS, path));
});

function assertSafeImportGraph(path, visited) {
  if (visited.has(path)) return;
  visited.add(path);
  const text = readFileSync(path, "utf8");
  const imports = [...text.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)];
  for (const [, specifier] of imports) {
    assert(!specifier.startsWith("@bloodtrail/"), `kit import from test graph: ${path}`);
    assert(!specifier.endsWith("/role-guard.mjs"), `guard import from test graph: ${path}`);
    assert(!specifier.endsWith("/sender-role.mjs"), `sender role import from test graph: ${path}`);
    if (specifier.startsWith(".")) assertSafeImportGraph(join(dirname(path), specifier), visited);
  }
}

test("all outbox test imports transitively exclude kit packages and process guard modules", () => {
  const files = readdirSync(join(HARNESS, "tests")).filter((name) => name.startsWith("outbox-"));
  const visited = new Set();
  for (const file of files) assertSafeImportGraph(join(HARNESS, "tests", file), visited);
});

test("senderRun always invokes the host isolation producer even with prefilled controls", async () => {
  let invoked = false;
  await assert.rejects(senderRun({
    message: { expectations: { host_database: "/declared" } },
    deps: {
      senderControls: async () => ({ host_db_isolation: { holds: true } }),
      hostDbIsolationControl: (directory) => {
        invoked = true;
        assert.equal(directory, "/declared");
        throw new Error("live control invoked");
      },
    },
  }), /live control invoked/);
  assert.equal(invoked, true);
});
