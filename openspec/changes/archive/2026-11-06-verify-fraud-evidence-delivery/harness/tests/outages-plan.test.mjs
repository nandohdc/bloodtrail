import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { retryDelay, seededJitter } from "../lib/clock.mjs";
import { validateProbeInventory } from "../lib/import-closure.mjs";
import { command, jsonFile } from "../lib/io.mjs";
import { ROLE_SCRIPTS } from "../lib/plan.mjs";
import { CHANGE } from "../lib/results.mjs";
import { validateExpectations } from "../outages/expectations.mjs";
import { PROBE_FILES } from "../outages/files.mjs";
import { flatRoles, senderInput } from "../outages/session.mjs";
import { dottedReads, resolves } from "./field-reads.mjs";

const HARNESS = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = command({ program: "git", args: ["rev-parse", "--show-toplevel"], cwd: HARNESS }).trim();
const FROZEN = jsonFile(new URL("../expectations/outages.v1.json", import.meta.url));
const source = (path) => readFileSync(join(HARNESS, path), "utf8");
const caseOf = (id) => FROZEN.cases.find((entry) => entry.case_id === id);

test("the frozen expectations validate, and mutating them is refused", () => {
  assert.equal(validateExpectations(structuredClone(FROZEN)).probe, "S2-outages");
  const mutations = [
    (value) => { value.ticket = 836; },
    (value) => { value.cases = value.cases.filter((entry) => entry.pass === "small"); },
    (value) => { value.cases[8].pass = "small"; },
    (value) => { value.cases[0].pass = "volume"; },
    (value) => { value.cases[3].observer = "unknown"; },
    (value) => { value.cases[1].observer = "profiles"; },
    (value) => { value.cases.splice(8, 1); value.cases.forEach((entry, index) => { entry.case_id = `O-${String(index + 1).padStart(2, "0")}`; }); },
    (value) => { value.cases[0].expected.pop(); },
    (value) => { value.cases[3].basis = ["openspec/changes/verify-fraud-evidence-delivery/harness/lib/accounting.mjs:1"]; },
    (value) => { value.scenarios.exhausted.push({ attempt: 4, action: "status", status: 503 }); },
    (value) => { value.scenarios.timeout[0].delay_ms = value.composition.exchange_timeout_ms; },
    (value) => { value.scenarios.clean.push({ occurrence: 1, attempt: 0, action: "acknowledge" }); },
    (value) => { value.scenarios.unused = []; },
    (value) => { value.passes[0].schedule.push("clean"); value.passes[0].occurrences += 1; },
    (value) => { value.passes[1].schedule = value.passes[1].schedule.slice(1); },
    (value) => { value.passes[1].occurrences = 499; },
    (value) => { value.passes.reverse(); },
    (value) => { value.planned_call_budget = { processes: { small: 10, volume: 499 }, total: 509 }; },
    (value) => { value.planned_call_budget = { processes: { sender: 510 }, total: 510 }; },
    (value) => { value.planned_call_budget.total = 511; },
    (value) => { value.composition.max_attempts = 1001; },
    (value) => { value.thresholds.unexplained = 1; },
    (value) => { value.workload.seed = 0; },
    // A rule the frozen profile does not follow, and a rule no attempt reaches: refused before the claim.
    (value) => { value.scenarios.status_429.push({ attempt: 2, action: "status", status: 429 }); },
    (value) => { value.scenarios.permanent_400.push({ attempt: 1, action: "status", status: 503 }); },
    (value) => { value.cases[0].expected[1].exchange_attempts = [0]; },
    (value) => { value.cases[0].expected[0].attempts = 2; },
    // Profiles the rules cannot produce: a wrong status, a terminal outcome for a retried answer, a retry
    // stopped early.
    (value) => { value.cases[0].expected[2].requests[0].status = 503; },
    (value) => { Object.assign(value.cases[0].expected[7], { delivery: "acknowledged", sdk: "accepted", stored: 1 }); },
    (value) => {
      const profile = value.cases[0].expected[1];
      Object.assign(profile, { delivery: "exhausted", sdk: "SDK_SINK_FAILURE", attempts: 1, exchange_attempts: [0], requests: [profile.requests[0]], stored: 0 });
    },
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

// The frozen values must agree with each other and with the frozen inputs, so a slip in hand-derived
// expectations is caught at build time rather than reported as a finding after a spent run.
test("the frozen delays are the seeded draws applied to each attempt's backoff cap", () => {
  const draw = seededJitter(FROZEN.composition.jitter_seed);
  for (const { next, delay_ms: delay } of caseOf("O-02").expected.scheduled) assert.equal(delay, retryDelay({ composition: FROZEN.composition, next, draw }));
  const retries = caseOf("O-01").expected.flatMap((profile) => profile.exchange_attempts.filter((attempt) => attempt > 0));
  assert.equal(caseOf("O-02").expected.scheduled.length, retries.length);
  assert.equal(caseOf("O-03").expected.scheduled_delays, retries.length);
});

// The validator refuses a profile its scenario's rules cannot produce; the pass totals must follow from the
// profiles.
test("the pass totals follow from the frozen profiles", () => {
  const profiles = caseOf("O-01").expected;
  const [small, volume] = FROZEN.passes;
  const stored = profiles.filter((profile) => profile.stored === 1).length;
  assert.equal(caseOf("O-03").expected.counts.persisted, stored);
  assert.equal(caseOf("O-03").expected.counts.reported_undelivered, small.occurrences - stored);
  assert.equal(caseOf("O-10").expected.counts.persisted, stored * volume.cycles);
  assert.equal(caseOf("O-10").expected.scheduled_delays, caseOf("O-03").expected.scheduled_delays * volume.cycles);
  assert.deepEqual(Object.values(caseOf("O-09").expected.conforming), small.schedule.map(() => volume.cycles));
  assert.equal(caseOf("O-12").expected.shutdown_report.accepted, volume.occurrences);
});

test("each role's import closure is inside the declared inventory, and a missing module is caught", () => {
  const roleScripts = Object.values(ROLE_SCRIPTS);
  const closure = validateProbeInventory({ repo: REPO, prefix: `${CHANGE}/harness`, probeDirectory: "outages", files: PROBE_FILES, roleScripts });
  assert.deepEqual(closure, [...PROBE_FILES].sort(), "the inventory declares exactly the closure");
  const withoutTracer = PROBE_FILES.filter((path) => path !== "tracer/sender-process.mjs");
  assert.throws(() => validateProbeInventory({ repo: REPO, prefix: `${CHANGE}/harness`, probeDirectory: "outages", files: withoutTracer, roleScripts }), /missing from approved inventory: .*tracer\/sender-process\.mjs/);
});

test("each outages role imports the role guard first, then only the tracer's role, and no kit code", () => {
  for (const [role, script] of Object.entries(ROLE_SCRIPTS)) {
    const imports = [...source(`outages/${script}`).matchAll(/^import .*$/gm)].map((match) => match[0]);
    assert.deepEqual(imports, ['import "../lib/role-guard.mjs";', `import "../tracer/${script}";`], role);
  }
  const orchestration = ["outages/run-outages.mjs", "outages/session.mjs", "outages/evaluate.mjs", "outages/expectations.mjs", "outages/files.mjs"];
  for (const path of orchestration) assert.doesNotMatch(source(path), /from "@bloodtrail\//, `${path} must not import kit code`);
});

test("the approval-gated entry only delegates to the shared runner", () => {
  const entry = source("outages/run-outages.mjs");
  assert(entry.includes('import { runProbe } from "../lib/probe-runner.mjs";'));
  assert(entry.includes("const session = await runProbe({"));
  assert(entry.includes('probe: "S2-outages", ticket: 837, probeDirectory: "outages"'));
  assert(entry.includes("process.exitCode = session.exitCode;"));
  assert(!entry.includes("runApprovedSession"));
});

// The view is an adapter over the tracer's sender, so every field that role reads must be in it.
test("every expectations field the tracer's sender reads is in the pass view", () => {
  const view = senderInput({ expectations: FROZEN, pass: FROZEN.passes[1] });
  const paths = new Set([
    ...dottedReads({ text: source("tracer/sender-process.mjs"), name: "expectations" }),
    ...dottedReads({ text: source("lib/sender-role.mjs"), name: "input" }),
  ]);
  assert(paths.has("clock.start") && paths.has("planned_call_budget.processes.sender"));
  for (const path of paths) assert(resolves({ object: view, path }), `the view lacks ${path}`);
  const missing = senderInput({ expectations: FROZEN, pass: FROZEN.passes[1] });
  delete missing.clock;
  assert(![...paths].every((path) => resolves({ object: missing, path })), "a view without the clock must be caught");
});

test("each pass hands the tracer's sender only its own occurrences and budget", () => {
  const [small, volume] = FROZEN.passes;
  const input = senderInput({ expectations: FROZEN, pass: volume });
  assert.deepEqual(Object.keys(input).sort(), ["clock", "composition", "contract_version", "planned_call_budget", "workload"]);
  assert.deepEqual(input.workload, { seed: FROZEN.workload.seed, occurrences: 500 });
  assert.deepEqual(input.planned_call_budget, { processes: { sender: 500 } });
  assert.equal(senderInput({ expectations: FROZEN, pass: small }).planned_call_budget.processes.sender, 10);
  assert.deepEqual(Object.keys(flatRoles({ small: { ingress: 1, sender: 2 }, volume: { ingress: 3 } })), ["small_ingress", "small_sender", "volume_ingress"]);
});
