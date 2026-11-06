import { isDeepStrictEqual } from "node:util";
import { CASES, noObservationThresholds } from "./expectations.mjs";
import { reconcilePhase } from "./reconcile.mjs";
import { OBSERVATION_CONTRACT, observationsHold } from "./observations.mjs";
import { accountingHolds } from "./accounting.mjs";
import { executionObserved } from "./execution.mjs";
import { referenceFiles, resolvePhase } from "./plans.mjs";

function noUnexplained(summary) {
  return summary.unexplained.length === 0;
}

function allCountsHold(summary) {
  return [summary.successful, summary.failed, summary.other, noUnexplained(summary), summary.accounted === summary.denominator].every(Boolean);
}

export function plantedControls({ observations, expectations }) {
  try {
    return checkPlanted({ observations, expectations });
  } catch (error) {
    return { raw_counter_failed: false, distinct_null_passed: false, missing_or_invalid: error.message };
  }
}

function checkPlanted({ observations, expectations }) {
  const honest = expectations.phases.map((phase) => reconcilePhase({ expectations, phase, observed: observations.phases[phase.name] }));
  const raw = expectations.phases.map((phase) => reconcilePhase({ expectations, phase, observed: observations.phases[phase.name], counter: "raw" }));
  return { raw_counter_failed: raw.some((summary) => !allCountsHold(summary)), distinct_null_passed: honest.every(allCountsHold) };
}

function isolationHolds(observed) {
  const sender = observed.sender.controls;
  const ingress = observed.ingress.controls;
  const holds = [sender.loopback_guard.holds, sender.write_outside_grant.holds, sender.synthetic_data.holds, ingress.write_outside_grant.holds];
  const exactViolation = isDeepStrictEqual(observed.sender.guard_violations.map((entry) => entry.host), ["192.0.2.1"]);
  const closure = Object.values(observed.role_closure).every((entry) => entry.code === 0);
  const roles = isDeepStrictEqual(Object.keys(observed.role_closure), ["sender", "ingress"]);
  return [...holds, exactViolation, closure, roles, observed.ingress.quiescent === true].every((value) => value === true);
}

function verifiedPlan({ observed, phase, expectations, unit }) {
  const reference = observed.plan_reference;
  const valid = [reference.hash_verified, reference.executed, unit.hash_verified].every((value) => value === true);
  const frozen = expectations.plans.find((plan) => plan.phase === phase.name);
  const expected = { ...frozen, hash_verified: true, executed: true };
  return [valid, isDeepStrictEqual(reference, expected), executionObserved(unit, observed)].every(Boolean);
}

function perTarget(observed) {
  return observed.per_target === "not_attempted" && observed.per_target_reference === "G33";
}

function phaseChecks({ observations, expectations, phase, counter, files }) {
  const observed = observations.phases[phase.name];
  if (observed.reconciliation?.missing_or_invalid) throw new Error(observed.reconciliation.missing_or_invalid);
  const unit = resolvePhase({ expectations, phase, files });
  const summary = reconcilePhase({ expectations, phase, observed, counter });
  const remainder = noUnexplained(summary);
  return {
    plans: verifiedPlan({ observed, phase, expectations, unit }), successful: summary.successful, failed: summary.failed,
    remainder,
    per_target: perTarget(observed), observations: observationsHold(observed),
    isolation: isolationHolds(observed), accounting: allCountsHold(summary) && accountingHolds({ observed, summary, phase, unit }),
    summary, raw: reconcilePhase({ expectations, phase, observed, counter: "raw" }),
  };
}

function evaluateObserver({ observer, checks, expectations }) {
  if (checks.length === 0) return false;
  if (observer === "planted") return checks.some((check) => !allCountsHold(check.raw)) && checks.every((check) => allCountsHold(check.summary));
  if (observer === "duplicates") {
    const observedDuplicates = checks.some((check) => check.summary.raw_persisted > check.summary.persisted_distinct);
    return observedDuplicates && checks.every((check) => allCountsHold(check.summary));
  }
  const every = checks.every((check) => check[observer] === true);
  if (observer === "observations") return observationCase({ every, expectations });
  return every;
}

function observationCase({ every, expectations }) {
  const frozen = isDeepStrictEqual(expectations.observations, OBSERVATION_CONTRACT);
  return [every, frozen, noObservationThresholds(expectations)].every(Boolean);
}

function collectChecks({ observations, expectations, counter, scope }) {
  try {
    const files = referenceFiles(expectations);
    return { checks: scope.phases.map((phase) => phaseChecks({ observations, expectations, phase, counter, files })) };
  } catch (error) {
    return { missing_or_invalid: error.message };
  }
}

export function evaluateCases({ observations, expectations, pass, counter = "distinct" }) {
  let scope = expectations;
  if (pass === "small") scope = { ...expectations, phases: expectations.phases.filter((phase) => phase.pass === "small") };
  const checked = collectChecks({ observations, expectations, counter, scope });
  const evaluations = expectations.cases.map((entry) => {
    const observed = checked.missing_or_invalid
      ? { holds: false, missing_or_invalid: checked.missing_or_invalid }
      : { holds: evaluateObserver({ observer: entry.observer, checks: checked.checks, expectations: scope }) };
    return { case_id: entry.case_id, pass: entry.pass, expected: entry.expected, observed, matched: isDeepStrictEqual(observed, entry.expected) };
  });
  const matched = evaluations.filter((entry) => entry.matched).length;
  return { evaluations, verdict: { matched, mismatched: CASES.length - matched } };
}
