import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { CALL_LIMIT, occurrenceLedger, planBudget } from "../lib/ledger.mjs";
import { CHANGE, RUN_LIMIT, resultRecord } from "../lib/results.mjs";
import { requireProbe, roleProcessPath } from "../lib/plan.mjs";
import { StopCondition, withDeadline } from "../lib/deadline.mjs";
import { COMMAND_TIMEOUT_MS, command } from "../lib/io.mjs";
import { fallbackRecord, runProbe } from "../lib/probe-runner.mjs";

test("G42: the per-run SDK call cap is 50,000", () => {
  assert.equal(CALL_LIMIT, 50_000);
  assert.deepEqual(planBudget({ processes: { sender: 50_000 }, total: 50_000 }).total, 50_000);
  assert.throws(() => planBudget({ processes: { sender: 50_001 }, total: 50_001 }), /authorization cap exceeded/);
  assert.throws(() => planBudget({ processes: { sender: 2, other: 2 }, total: 3 }), /mechanically summed/);
  assert.throws(() => planBudget({ processes: { sender: 1 }, total: 1, limit: 60_000 }), /authorization cap exceeded/);
});

test("the ledger refuses the call past its budget and reports what it counted", () => {
  const ledger = occurrenceLedger({ budget: 2 });
  ledger.take("a");
  ledger.take("b");
  assert.throws(() => ledger.take("c"), /budget exhausted: 2/);
  assert.throws(() => ledger.assertAvailable(), /exhausted/);
  assert.deepEqual(ledger.report(), { budget: 2, exhausted: true, occurrence_count: 2, calls: [{ ordinal: 1, label: "a" }, { ordinal: 2, label: "b" }] });
  assert.throws(() => occurrenceLedger({ budget: CALL_LIMIT + 1 }), /invalid local budget/);
});

test("probe ids are Stage 2 ids, and role scripts resolve inside the harness prefix", () => {
  assert.doesNotThrow(() => requireProbe({ probe: "S2-tracer", ticket: 836 }));
  for (const probe of ["P-ids", "S2-Tracer", "S2-", "tracer"]) assert.throws(() => requireProbe({ probe, ticket: 836 }), undefined, probe);
  assert.equal(roleProcessPath({ prefix: "service/harness", probeDirectory: "tracer", role: "sender" }), "service/harness/tracer/sender-process.mjs");
  assert.equal(roleProcessPath({ prefix: "service/harness", probeDirectory: "tracer", role: "ingress" }), "service/harness/tracer/ingress-process.mjs");
  assert.throws(() => roleProcessPath({ prefix: "service/harness", probeDirectory: "tracer", role: "orchestrator" }), /unknown role/);
  assert.throws(() => roleProcessPath({ prefix: "service/harness", probeDirectory: "../lib", role: "sender" }), /invalid probe directory/);
});

test("a result record cites G42 and the change, and refuses a run outside the authorization", () => {
  const base = {
    probe: "S2-tracer", ticket: 836, runNumber: 1, approvedHead: "1".repeat(40), approval: {}, expectations: {},
    started: "2026-10-23T00:00:00.000Z", ended: "2026-10-23T00:00:01.000Z", provenance: { driver: { lane: "claude-code" } },
    cases: {}, invalidations: [], occurrenceCount: 1, callBound: 1,
  };
  const record = resultRecord(base);
  assert.deepEqual([record.occurrence_count, record.call_bound], [1, 1]);
  assert.equal(resultRecord({ ...base, occurrenceCount: null }).occurrence_count, null, "a failed run records an unknown count");
  assert.throws(() => resultRecord({ ...base, occurrenceCount: 2 }), /outside its bound/);
  assert.throws(() => resultRecord({ ...base, callBound: undefined }), /call bound/);
  assert.match(record.authorization.G42, /issuecomment-6346915049$/);
  assert.match(record.authorization.G46, /issuecomment-6449640834$/);
  assert.equal(record.authorization.reference, `${CHANGE}/proposal.md#run-authorization at ${"1".repeat(40)}`);
  assert.deepEqual(record.scratch_deletion, { not_created: true });
  assert.equal(RUN_LIMIT, 16, "G46 amends the G42 run limit to 16");
  assert.equal(resultRecord({ ...base, runNumber: 16 }).run_id, 16);
  assert.throws(() => resultRecord({ ...base, runNumber: RUN_LIMIT + 1 }), /run number outside/);
  assert.throws(() => resultRecord({ ...base, ended: "2026-10-22T23:59:59.000Z" }), /invalid UTC interval/);
});

test("S2 deadline: work past its deadline halts with a stop condition and kills the roles", async () => {
  assert.equal(await withDeadline({ ms: 1000, onTimeout: () => assert.fail("no timeout expected"), work: async () => "done" }), "done");
  let killed = false;
  await assert.rejects(
    withDeadline({ ms: 10, onTimeout: () => { killed = true; }, work: () => new Promise(() => {}) }),
    (error) => error instanceof StopCondition && error.condition === "deadline",
  );
  assert.equal(killed, true);
  await assert.rejects(withDeadline({ ms: 0, onTimeout() {}, work: async () => {} }), /deadline must be a positive integer/);
});

test("a throwing deadline halt hook still rejects with the S2 stop condition", async () => {
  let fire;
  const timers = { setTimeout(callback) { fire = callback; return 1; }, clearTimeout() {} };
  const pending = withDeadline({ ms: 10, timers, work: () => new Promise(() => {}), onTimeout() { throw new Error("fixture kill failed"); } });
  const observed = pending.catch((error) => error);
  assert.doesNotThrow(() => fire(), "the timer callback must not escape S2 handling");
  const failure = await observed;
  assert(failure instanceof StopCondition);
  assert.equal(failure.condition, "deadline");
  assert.equal(failure.halt_error, "fixture kill failed");
  assert.equal(failure.role_closure_confirmed, false);
});

test("every child command is bounded: a stalled one is killed and fails instead of hanging", () => {
  assert.equal(COMMAND_TIMEOUT_MS, 600_000);
  assert.throws(() => command({ program: process.execPath, args: ["-e", "setTimeout(() => {}, 10_000)"], timeout: 200 }), (error) => error.code === "ETIMEDOUT" || error.signal === "SIGKILL");
});

test("a fault while building the record keeps the spent run's provenance and observations", () => {
  const context = {
    plan: { probe: "S2-tracer", ticket: 836 }, options: { "run-number": "1", approvedHead: "1".repeat(40) }, approval: { url: "u" },
    expectationsPath: "e.json", expectationHash: "h", expectations: { planned_call_budget: { total: 1 } }, started: "2026-10-23T00:00:01.000Z",
  };
  const record = fallbackRecord(context, {
    provenance: { kit_digest: "k" }, observations: { sender: {} }, cases: { verdict: null }, invalidations: [{ message: "m" }], occurrenceCount: null,
    error: new Error("invalid UTC interval"), ended: "2026-10-23T00:00:00.000Z",
  });
  assert.equal(record.record_fault, true);
  assert.deepEqual([record.ticket, record.call_bound, record.started_at, record.ended_at], [836, 1, "2026-10-23T00:00:01.000Z", "2026-10-23T00:00:00.000Z"]);
  assert.match(record.authorization.G42, /issuecomment-6346915049$/);
  assert.match(record.authorization.G46, /issuecomment-6449640834$/);
  assert.deepEqual([record.provenance, record.observations, record.occurrence_count], [{ kit_digest: "k" }, { sender: {} }, null]);
  assert.deepEqual(record.invalidations, [{ message: "m" }, { message: "result record fault: invalid UTC interval" }]);
});

test("runProbe refuses run 17 before any I/O", async () => {
  const originalArgv = process.argv;
  const args = [
    "--approved-head", "1".repeat(40),
    "--approval-body-file", "f",
    "--approval-url", "u",
    "--approval-created-at", "c",
    "--approval-updated-at", "u",
    "--approval-sha256", "s",
    "--once-marker", "m",
    "--run-number", "17",
    "--results", "r",
    "--window-opened-at", "w",
    "--driver-lane", "claude-code",
    "--driver-model", "test",
  ];
  process.argv = [originalArgv[0], "probe.mjs", ...args];
  try {
    await assert.rejects(
      () => runProbe({ probe: "S2-tracer", ticket: 836 }),
      /run number outside shared authorization/,
    );
  } finally {
    process.argv = originalArgv;
  }
});

test("run cap consistency: proposal, ledger, design, README and assessment match RUN_LIMIT", () => {
  const proposalPath = new URL("../../proposal.md", import.meta.url);
  const ledgerPath = new URL("../run-ledger.md", import.meta.url);
  const designPath = new URL("../../design.md", import.meta.url);
  const readmePath = new URL("../README.md", import.meta.url);
  const assessmentPath = new URL("../../assessment.json", import.meta.url);

  const proposalText = readFileSync(proposalPath, "utf8");
  const ledgerText = readFileSync(ledgerPath, "utf8");
  const designText = readFileSync(designPath, "utf8");
  const readmeText = readFileSync(readmePath, "utf8");
  const assessmentText = readFileSync(assessmentPath, "utf8");

  const proposalMatch = proposalText.match(/at most \*\*([0-9]+) runs\*\*/);
  const ledgerHeaderMatch = ledgerText.match(/\*\*([0-9]+) runs\*\*/);
  const designMatch = designText.match(/at most ([0-9]+) under G42/);
  const readmeMatch = readmeText.match(/never holds more than the ([0-9]+) runs/);
  const ledgerRangeMatch = ledgerText.match(/1 to ([0-9]+)/);
  const assessmentMatch = assessmentText.match(/within ([0-9]+) runs/);

  assert(proposalMatch !== null, "proposal must declare at most **N runs**");
  assert(ledgerHeaderMatch !== null, "run-ledger.md header must declare **N runs**");
  assert(designMatch !== null, "design.md Budget must declare at most N under G42");
  assert(readmeMatch !== null, "README must declare never holds more than the N runs");
  assert(ledgerRangeMatch !== null, "run-ledger.md must declare 1 to N");
  assert(assessmentMatch !== null, "assessment.json must declare within N runs");

  assert.equal(Number(proposalMatch[1]), RUN_LIMIT, "proposal run limit must match RUN_LIMIT");
  assert.equal(Number(ledgerHeaderMatch[1]), RUN_LIMIT, "ledger header run limit must match RUN_LIMIT");
  assert.equal(Number(designMatch[1]), RUN_LIMIT, "design run limit must match RUN_LIMIT");
  assert.equal(Number(readmeMatch[1]), RUN_LIMIT, "README run limit must match RUN_LIMIT");
  assert.equal(Number(ledgerRangeMatch[1]), RUN_LIMIT, "ledger range must match RUN_LIMIT");
  assert.equal(Number(assessmentMatch[1]), RUN_LIMIT, "assessment run limit must match RUN_LIMIT");
});
