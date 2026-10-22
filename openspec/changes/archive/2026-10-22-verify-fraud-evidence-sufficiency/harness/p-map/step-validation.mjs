import assert from "node:assert/strict";
import { keys, list, natural, owned, pathParts, unique } from "../p-e/shape.mjs";
import { validateAssertions } from "../p-e/assertions.mjs";

// Reuse P-E's structural/peer assertions: runtime identities cannot be literals.
// A deliberately unfrozen field must be named, never silently ignored.
export function validateStep(step, caseId) {
  keys(step, ["step_id", "kind", "accepted", "sink_count", "assertions"], ["observed_not_frozen"]);
  owned(step.step_id, caseId);
  assert(["returned", "thrown"].includes(step.kind), "invalid public surface");
  assert.equal(typeof step.accepted, "boolean", "acceptance boolean required");
  natural(step.sink_count, "sink_count");
  validateAssertions(step.assertions);
  assert(step.assertions.length > 0, "explicit step assertions required");
  validateOutcome(step);
  validateUnfrozen(step);
}

function validateUnfrozen(step) {
  if (step.observed_not_frozen === undefined) return;
  const paths = list(step.observed_not_frozen, "observed_not_frozen");
  unique(paths, "unfrozen paths");
  for (const path of paths) {
    pathParts(path);
    assert(!["step_id", "kind", "accepted", "sink_count"].includes(path), "cannot unfreeze a public boundary");
    assert(step.assertions.every((rule) => disjoint(path, rule.path)), "unfrozen field also has a frozen assertion");
  }
}

export function covers(parent, child) {
  return child === parent || child.startsWith(`${parent}.`);
}

function disjoint(left, right) {
  return !covers(left, right) && !covers(right, left);
}

function validateOutcome(step) {
  if (step.accepted) {
    assert.equal(step.kind, "returned", "a throw cannot be accepted");
    return;
  }
  assert.equal(step.sink_count, 0, "refusal cannot reach sink");
  for (const name of ["code", "category", "path"]) {
    assert(step.assertions.some((rule) => diagnosticAssertion(rule, name)), `diagnostic ${name} required`);
  }
}

function diagnosticAssertion(rule, name) {
  if (rule.path !== `diagnostic.${name}`) return false;
  if (rule.op !== "equal") return false;
  return typeof rule.value === "string" && rule.value.length > 0;
}

export function validatePeers(cases) {
  const steps = cases.flatMap((entry) => Array.isArray(entry.expected) ? entry.expected : []);
  const ids = new Set(steps.map((step) => step.step_id));
  const aggregates = cases.filter((entry) => !Array.isArray(entry.expected));
  const rules = [...steps, ...aggregates.map((entry) => entry.expected)];
  for (const item of rules) for (const rule of item.assertions) {
    if (rule.peer !== undefined) assert(ids.has(rule.peer.step_id), `unknown relation reference ${rule.peer.step_id}`);
  }
}
