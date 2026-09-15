import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  evaluatePolicyCase,
  validatePolicy
} from "../../scripts/normative-precedence/model.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const policy = JSON.parse(readFileSync(resolve(root, "openspec/governance/normative-source-precedence.json"), "utf8"));
const schema = JSON.parse(readFileSync(resolve(root, "openspec/governance/schemas/normative-source-precedence.schema.json"), "utf8"));
const cases = JSON.parse(readFileSync(resolve(here, "fixtures/normative-precedence/policy-cases.json"), "utf8"));
const controls = JSON.parse(readFileSync(resolve(here, "fixtures/normative-precedence/negative-controls.json"), "utf8"));

function clone(value) {
  return structuredClone(value);
}

function setPath(value, path, replacement) {
  const parts = path.split(".");
  const leaf = parts.pop();
  const parent = parts.reduce((current, part) => current[part], value);
  parent[leaf] = replacement;
}

test("candidate policy is relationally valid", () => {
  assert.deepEqual(validatePolicy(policy, schema), []);
});

for (const policyCase of cases) {
  test(`${policyCase.testId} ${policyCase.description}`, () => {
    const result = evaluatePolicyCase(policy, policyCase);
    assert.equal(result.ok, true, result.diagnostics.map((entry) => entry.message).join("; "));
  });
}

test("policy corpus preserves seven valid and nineteen invalid cases", () => {
  assert.equal(cases.filter((entry) => entry.expectedResult === "PASS").length, 7);
  assert.equal(cases.filter((entry) => entry.expectedResult === "FAIL").length, 19);
});

for (const control of controls) {
  test(`${control.id} detects ${control.description}`, () => {
    const mutant = clone(policy);
    if (control.kind === "policy") {
      setPath(mutant, control.mutation.path, control.mutation.value);
      assert.ok(validatePolicy(mutant).some((entry) => entry.code === control.expected_code));
      return;
    }
    const rule = mutant.conflict_rules.find((entry) => entry.id === control.rule_id);
    rule[control.mutation.field] = control.mutation.value;
    const policyCase = cases.find((entry) => entry.ruleId === control.rule_id);
    assert.equal(evaluatePolicyCase(mutant, policyCase).ok, false);
  });
}
