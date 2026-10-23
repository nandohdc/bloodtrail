import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { validateProbeInventory } from "../lib/import-closure.mjs";
import { command, jsonFile } from "../lib/io.mjs";
import { ROLE_SCRIPTS } from "../lib/plan.mjs";
import { CHANGE } from "../lib/results.mjs";
import { validateExpectations } from "../load/expectations.mjs";
import { PROBE_FILES } from "../load/files.mjs";
import { senderInput } from "../load/session.mjs";
import { dottedReads, resolves } from "./field-reads.mjs";

const HARNESS = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = command({ program: "git", args: ["rev-parse", "--show-toplevel"], cwd: HARNESS }).trim();
const FROZEN = jsonFile(new URL("../expectations/load.v1.json", import.meta.url));
const source = (path) => readFileSync(join(HARNESS, path), "utf8");
const caseOf = (id) => FROZEN.cases.find((entry) => entry.case_id === id);
const phaseOf = (name) => FROZEN.phases.find((phase) => phase.name === name);

test("the frozen expectations validate, and mutating them is refused", () => {
  assert.equal(validateExpectations(structuredClone(FROZEN)).probe, "S2-load");
  const mutations = [
    (value) => { value.ticket = 837; },
    (value) => { value.cases = value.cases.filter((entry) => entry.pass === "small"); },
    (value) => { value.cases[0].observer = "unknown"; },
    (value) => { value.cases[0].phases = ["best_effort"]; },
    (value) => { value.cases[4].phases = ["overload"]; },
    (value) => { value.cases[5].phases = ["best_effort", "drain"]; },
    (value) => { value.cases[8].phases = ["overload"]; },
    (value) => { value.phases[0].pass = "volume"; },
    (value) => { value.phases[1].after_shutdown = 3; },
    (value) => { value.phases[0].after_shutdown = 1; value.phases[0].cycles = 11; value.planned_call_budget.processes.overload = 11; value.planned_call_budget.total += 1; },
    (value) => { value.scenarios.held_300[0].delay_ms = 5000; },
    (value) => { value.phases[0].schedule = ["dropped"]; },
    (value) => { value.phases[3].composition.capacity = 4; },
    (value) => { value.phases[3].composition.loss_ceiling = 0; },
    (value) => { value.phases[3].shutdown = "after_settle"; },
    (value) => { value.scenarios.dropped = [{ attempt: 0, action: "destroy_after_ingest" }]; },
    (value) => { value.scenarios.dropped = [{ attempt: 1, action: "status", status: 503 }]; },
    (value) => { value.phases[0].composition.capacity = 100_001; },
    (value) => { value.phases[2].kind = "queue"; },
    (value) => { value.phases[4].name = "overload"; },
    (value) => { value.planned_call_budget.processes.drain = 8; value.planned_call_budget.total -= 2; },
    (value) => { value.planned_call_budget.total = 1235; },
    (value) => { value.thresholds.unexplained = 1; },
    (value) => { value.cases[6].phases = ["overload", "drain", "best_effort"]; },
    (value) => { value.cases[13].phases = ["overload_volume", "best_effort_volume"]; },
    (value) => { value.workload.seed = 0; },
  ];
  for (const mutate of mutations) {
    const value = structuredClone(FROZEN);
    mutate(value);
    assert.throws(() => validateExpectations(value), undefined, mutate.toString());
  }
});

test("every basis citation names an existing line of package source at the frozen base", () => {
  for (const entry of FROZEN.cases) {
    for (const citation of entry.basis) {
      const [path, line] = citation.split(":");
      const lines = command({ program: "git", args: ["show", `${FROZEN.base}:${path}`], cwd: REPO }).split("\n");
      assert(Number(line) >= 1 && Number(line) <= lines.length, `${entry.case_id}: ${citation} is past the end of the file`);
      assert(lines[Number(line) - 1].trim().length > 0, `${entry.case_id}: ${citation} cites a blank line`);
    }
  }
});

// The frozen values must agree with the frozen phases, so a slip in hand-derived expectations is caught at
// build time rather than reported as a finding after a spent run.
test("the frozen admission, shutdown and loss values follow from the frozen phases", () => {
  for (const id of ["L-01", "L-09"]) {
    const phase = phaseOf(caseOf(id).phases[0]);
    const { expected } = caseOf(id);
    assert.equal(expected.submitted, phase.occurrences);
    assert.equal(expected.admitted, Math.min(phase.occurrences, phase.composition.capacity));
    assert.equal(expected.rejected_overload + expected.admitted, phase.occurrences);
    assert.equal(expected.ingress_requests, expected.admitted);
  }
  for (const id of ["L-02", "L-03", "L-04", "L-10", "L-11"]) {
    const phase = phaseOf(caseOf(id).phases[0]);
    const { shutdown_report: report, counts } = caseOf(id).expected;
    assert.equal(report.accepted, report.completed + report.abandoned, id);
    assert.equal(Object.values(counts).reduce((sum, count) => sum + count, 0), phase.occurrences + phase.after_shutdown, id);
    assert.equal(counts.admission_signal, phase.after_shutdown + Math.max(0, phase.occurrences - phase.composition.capacity), id);
  }
  for (const id of ["L-05", "L-12"]) {
    const phase = phaseOf(caseOf(id).phases[0]);
    const scheduled = Array.from({ length: phase.occurrences }, (_, index) => phase.schedule[index % phase.schedule.length]);
    // A drop is an occurrence whose scenario refuses its one attempt, whatever the scenario is named.
    const drops = scheduled.filter((name) => FROZEN.scenarios[name].some((rule) => rule.attempt === 0 && rule.action === "status")).length;
    const { expected } = caseOf(id);
    assert.deepEqual(expected.results, { delivered: phase.occurrences - drops, dropped: drops }, id);
    assert.deepEqual(expected.dropped_loss_counts, Array.from({ length: drops }, (_, index) => Math.min(index + 1, phase.composition.loss_ceiling)), id);
    assert.deepEqual(expected.loss_ceiling_reached, drops >= phase.composition.loss_ceiling ? [phase.composition.loss_ceiling] : [], id);
    assert.equal(expected.health.lossCount, Math.min(drops, phase.composition.loss_ceiling), id);
  }
  const abandon = phaseOf("abandon");
  assert(abandon.composition.shutdown_deadline_ms < FROZEN.scenarios[abandon.schedule[0]][0].delay_ms, "the abandon phase's deadline must expire before its held answers");
  for (const name of ["overload", "drain", "overload_volume", "drain_volume"]) {
    const phase = phaseOf(name);
    assert(phase.composition.shutdown_deadline_ms > FROZEN.scenarios[phase.schedule[0]][0].delay_ms, `${name}: the deadline must outlast its held answers`);
  }
});

test("each role's import closure is inside the declared inventory, and a missing module is caught", () => {
  const roleScripts = Object.values(ROLE_SCRIPTS);
  const closure = validateProbeInventory({ repo: REPO, prefix: `${CHANGE}/harness`, probeDirectory: "load", files: PROBE_FILES, roleScripts });
  assert.deepEqual(closure, [...PROBE_FILES].sort(), "the inventory declares exactly the closure");
  const withoutWorkload = PROBE_FILES.filter((path) => path !== "load/workload.mjs");
  assert.throws(() => validateProbeInventory({ repo: REPO, prefix: `${CHANGE}/harness`, probeDirectory: "load", files: withoutWorkload, roleScripts }), /missing from approved inventory: .*load\/workload\.mjs/);
});

test("the load roles import the role guard first; only the sender imports kit code, and only its own packages", () => {
  const [senderFirst] = source("load/sender-process.mjs").match(/^import .*$/m);
  assert.match(senderFirst, /from "\.\.\/lib\/role-guard\.mjs";$/);
  const imports = [...source("load/ingress-process.mjs").matchAll(/^import .*$/gm)].map((match) => match[0]);
  assert.deepEqual(imports, ['import "../lib/role-guard.mjs";', 'import "../tracer/ingress-process.mjs";']);
  const kitImports = (path) => [...source(path).matchAll(/from "(@bloodtrail\/[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(kitImports("load/sender-process.mjs"), ["@bloodtrail/security-audit-sdk-core", "@bloodtrail/security-audit-sdk-node"]);
  for (const path of ["load/workload.mjs", "load/session.mjs", "load/evaluate.mjs", "load/expectations.mjs", "load/files.mjs", "load/run-load.mjs", "lib/gated-session.mjs", "lib/sender-role.mjs"]) {
    assert.deepEqual(kitImports(path), [], `${path} must not import kit code`);
  }
});

test("the approval-gated entry only delegates to the shared runner", () => {
  const entry = source("load/run-load.mjs");
  assert(entry.includes('import { runProbe } from "../lib/probe-runner.mjs";'));
  assert(entry.includes("const session = await runProbe({"));
  assert(entry.includes('probe: "S2-load", ticket: 838, probeDirectory: "load"'));
  assert(entry.includes("process.exitCode = session.exitCode;"));
  assert(!entry.includes("runApprovedSession"));
});

// The view is the load sender's whole input, so every field it reads, directly or through the shared
// sender plumbing, must be in it.
test("every input field the load sender reads is in each phase's view", () => {
  const paths = new Set([
    ...dottedReads({ text: source("load/sender-process.mjs"), name: "input" }),
    ...dottedReads({ text: source("lib/sender-role.mjs"), name: "input" }),
  ]);
  assert(paths.has("phase.kind") && paths.has("planned_call_budget.processes.sender") && paths.has("clock.start"));
  for (const phase of FROZEN.phases) {
    const view = senderInput({ expectations: FROZEN, phase });
    for (const path of paths) assert(resolves({ object: view, path }), `${phase.name}: the view lacks ${path}`);
  }
  const fields = ["occurrences", "shutdown", "after_shutdown", "kind"];
  const used = new Set([...dottedReads({ text: source("load/sender-process.mjs"), name: "phase" })]);
  for (const field of fields) assert(used.has(field) || paths.has(`phase.${field}`), `the sender never reads phase.${field}`);
});
