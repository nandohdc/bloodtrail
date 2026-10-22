import assert from "node:assert/strict";
import { keys } from "../p-e/shape.mjs";
import { validateAssertions } from "../p-e/assertions.mjs";
import { nonemptyReasons, validateCommon, VERDICTS } from "./case-validation.mjs";
import { SIGNAL_IDS } from "./plan.mjs";
import { RULES_BY_ID, dependencies, ownerReadings } from "./signal-rules.mjs";

function criterionAlternatives() {
  return [...RULES_BY_ID.values()].flatMap((rule) => ownerReadings(rule).map((reading) => ({ ...reading,
    affected_signal: rule.case_id, criterion_2: "FAIL", misfits: [rule.case_id] })));
}

export function validateAggregate(entry) {
  keys(entry, ["case_id", "setup", "expected", "basis", "confidence", "predicted_calls", "dependencies", "verdict", "rubric_reasons",
    "owner_review_required", "alternative_verdicts"]);
  assert(SIGNAL_IDS.includes(entry.case_id), "unknown signal aggregate");
  validateCommon(entry);
  assert.equal(entry.predicted_calls, 0, "aggregate must not invoke SDK");
  nonemptyReasons(entry.rubric_reasons);
  keys(entry.expected, ["assertions"]);
  validateAssertions(entry.expected.assertions);
  const criterion = entry.case_id === "S-CRIT2";
  const rule = RULES_BY_ID.get(entry.case_id);
  const alternatives = criterion ? criterionAlternatives() : ownerReadings(rule);
  const references = criterion ? SIGNAL_IDS.slice(0, -1) : dependencies(rule);
  assert.deepEqual(entry.dependencies, references, "aggregate references differ");
  assert.deepEqual(entry.alternative_verdicts, alternatives, "alternate readings/conditions differ");
  assert.equal(entry.owner_review_required, alternatives.length > 0, "owner review flag differs");
  const verdicts = criterion ? ["PASS", "FAIL", "INCONCLUSIVE"] : VERDICTS;
  assert(verdicts.includes(entry.verdict), "invalid aggregate verdict");
  validateDerivedAssertions(entry, criterion);
}

function validateDerivedAssertions(entry, criterion) {
  const rules = entry.expected.assertions;
  assert(rules.length > 0, "derived findings must be frozen per row");
  if (criterion) {
    assert(rules.some((rule) => rule.path === "misfits"), "criterion must freeze named misfits");
    assert(rules.some((rule) => rule.path.startsWith("signals")), "criterion must freeze per-signal findings");
    return;
  }
  assert(rules.some((rule) => rule.path.startsWith("findings.observed.")), "observed findings required, not merely a verdict label");
  assert(rules.some((rule) => rule.path.startsWith("components.")), "component findings required");
}
