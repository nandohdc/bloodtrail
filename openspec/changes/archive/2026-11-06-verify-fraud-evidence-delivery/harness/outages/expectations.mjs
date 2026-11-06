// The outages probe's expectations are validated before any approval is claimed, with the same predicates
// the session and the sender apply after the claim, so a malformed file is refused without spending a run.
import assert from "node:assert/strict";
import { validateCase, validateWorkloadInputs } from "../lib/expectations.mjs";
import { scheduledFaultPlan } from "../lib/faults.mjs";
import { occurrenceLedger, planBudget } from "../lib/ledger.mjs";
import { OBSERVERS } from "./evaluate.mjs";

const PASSES = Object.freeze(["small", "volume"]);

// A scenario is a list of per-attempt rules within the attempt budget. A delay is a timeout only if it
// outlasts the exchange deadline.
function validateScenarios({ scenarios, composition }) {
  for (const [name, rules] of Object.entries(scenarios)) {
    assert.match(name, /^[a-z0-9_]+$/, `invalid scenario name: ${name}`);
    assert(Array.isArray(rules), `${name}: rules must be a list`);
    for (const rule of rules) {
      assert(!Object.hasOwn(rule, "occurrence"), `${name}: the schedule assigns occurrences`);
      assert(Number.isSafeInteger(rule.attempt) && rule.attempt < composition.max_attempts, `${name}: attempt outside the budget`);
      if (rule.action === "delay") assert(rule.delay_ms > composition.exchange_timeout_ms, `${name}: a delay must outlast the exchange deadline`);
    }
  }
}

// The small pass runs every scenario once; the volume pass repeats the same schedule, so each volume
// occurrence has a frozen small-pass profile to conform to.
function validatePasses({ passes, scenarios }) {
  assert.deepEqual(passes.map((pass) => pass.name), PASSES);
  const [small, volume] = passes;
  for (const pass of passes) {
    assert.equal(pass.occurrences, pass.schedule.length * pass.cycles, `${pass.name}: occurrences must equal schedule length times cycles`);
    scheduledFaultPlan({ scenarios, schedule: pass.schedule, cycles: pass.cycles });
  }
  assert.equal(small.cycles, 1, "the small pass runs its schedule once");
  assert.deepEqual(volume.schedule, small.schedule, "the volume pass repeats the small pass's schedule");
  assert.deepEqual(new Set(small.schedule), new Set(Object.keys(scenarios)), "the small pass runs every scenario");
  assert.equal(new Set(small.schedule).size, small.schedule.length, "the small pass runs every scenario exactly once");
}

function validateBudget({ budget, passes }) {
  planBudget(budget);
  assert.deepEqual(Object.keys(budget.processes), PASSES, "the outages probe budgets one sender per pass");
  for (const pass of passes) {
    assert.equal(budget.processes[pass.name], pass.occurrences, `${pass.name}: the call budget equals its planned occurrences`);
    occurrenceLedger({ budget: budget.processes[pass.name] });
  }
}

// What the binding does with each planned answer (http-response-classification.ts, http-handoff.ts): 408,
// 425, 429 and any 5xx are retried, any other 4xx is permanent, a 2xx that acknowledges nothing is a protocol
// error, and a timeout or a destroyed socket is retried. The collector stores the first body that reaches it
// and answers every later one as a duplicate (collector ingress.ts).
const RETRYABLE_CLIENT_STATUSES = new Set([408, 425, 429]);
const INGESTING = new Set(["acknowledge", "delay", "destroy_after_ingest", "malformed_after_ingest"]);
const WIRE_STATUS = Object.freeze({
  acknowledge: () => 202, delay: () => 202, malformed_after_ingest: () => 202,
  destroy_before_ingest: () => null, destroy_after_ingest: () => null, status: (rule) => rule.status,
});
const SDK_RESULT = Object.freeze({ acknowledged: "accepted", non_retryable: "SDK_SINK_REJECTED", protocol_error: "SDK_SINK_FAILURE", exhausted: "SDK_SINK_FAILURE" });

function answerOf(rule) {
  if (rule.action === "acknowledge") return "acknowledged";
  if (rule.action === "malformed_after_ingest") return "protocol_error";
  if (rule.action !== "status") return "retry";
  return rule.status >= 500 || RETRYABLE_CLIENT_STATUSES.has(rule.status) ? "retry" : "non_retryable";
}

function ingestOutcome({ ingests, stored }) {
  if (!ingests) return "not_ingested";
  return stored ? "duplicate" : "persisted";
}

// The profile a scenario's rules produce under bounded retry, derived without reading the frozen one.
export function derivedProfile({ scenario, rules, maxAttempts }) {
  const planned = new Map(rules.map((rule) => [rule.attempt, rule]));
  const requests = [];
  let stored = false;
  let delivery = "exhausted";
  for (let attempt = 0; attempt < maxAttempts && delivery === "exhausted"; attempt += 1) {
    const rule = planned.get(attempt) ?? { action: "acknowledge" };
    const ingests = INGESTING.has(rule.action);
    requests.push({ attempt, action: rule.action, status: WIRE_STATUS[rule.action](rule), outcome: ingestOutcome({ ingests, stored }) });
    stored = stored || ingests;
    const answer = answerOf(rule);
    if (answer !== "retry") delivery = answer;
  }
  const attempts = requests.map((request) => request.attempt);
  return { scenario, sdk: SDK_RESULT[delivery], delivery, attempts: requests.length, exchange_attempts: attempts, requests, stored: stored ? 1 : 0 };
}

// Each frozen small-pass profile must equal the profile its scenario's rules produce, and every rule must be
// reached. A profile its rules cannot produce is refused before the claim.
function validateProfiles({ profiles, scenarios, composition }) {
  for (const profile of profiles) {
    const derived = derivedProfile({ scenario: profile.scenario, rules: scenarios[profile.scenario], maxAttempts: composition.max_attempts });
    assert.deepEqual(profile, derived, `${profile.scenario}: the frozen profile is not the one its rules produce`);
    for (const rule of scenarios[profile.scenario]) assert(rule.attempt < derived.attempts, `${profile.scenario}: the rule for attempt ${rule.attempt} is never reached`);
  }
}

// Each case names its pass and its observer, and the small pass's cases come first. The small pass freezes
// exactly one profiles case, one profile per occurrence: the reference the volume pass's one conformance
// case compares every occurrence with.
function validateCases({ cases, passes, scenarios, composition }) {
  cases.forEach((entry, index) => {
    validateCase({ entry, index, prefix: "O" });
    assert(PASSES.includes(entry.pass), `${entry.case_id}: unknown pass`);
    assert(Object.hasOwn(OBSERVERS, entry.observer), `${entry.case_id}: unknown observer`);
  });
  const order = cases.map((entry) => PASSES.indexOf(entry.pass));
  assert.deepEqual(order, [...order].sort((left, right) => left - right), "small-pass cases come before volume-pass cases");
  for (const pass of PASSES) assert(order.includes(PASSES.indexOf(pass)), `the ${pass} pass has no case`);
  const profiles = cases.filter((entry) => entry.observer === "profiles");
  assert(profiles.length === 1 && profiles[0].pass === "small", "exactly one profiles case, in the small pass");
  const conformance = cases.filter((entry) => entry.observer === "conformance");
  assert(conformance.length === 1 && conformance[0].pass === "volume", "exactly one conformance case, in the volume pass");
  assert.deepEqual(profiles[0].expected.map((profile) => profile.scenario), passes[0].schedule, "the profiles case freezes one profile per small-pass occurrence");
  validateProfiles({ profiles: profiles[0].expected, scenarios, composition });
}

export function validateExpectations(value) {
  assert.equal(value.probe, "S2-outages");
  assert.equal(value.version, 1);
  assert.equal(value.ticket, 837);
  assert.match(value.base, /^[0-9a-f]{40}$/);
  assert.equal(value.contract_version, "2.1.0");
  validateWorkloadInputs(value);
  validateScenarios(value);
  validatePasses(value);
  validateBudget({ budget: value.planned_call_budget, passes: value.passes });
  assert(Number.isSafeInteger(value.deadline_ms) && value.deadline_ms > 0);
  assert.equal(value.thresholds.unexplained, 0);
  validateCases(value);
  return value;
}
