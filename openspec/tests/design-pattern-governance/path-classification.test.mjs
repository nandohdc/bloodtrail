import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import {
  classifyPath,
  isGovernanceCore,
  isGovernanceRecordOnly,
  requiresOpenSpecAssociation,
} from "../../scripts/design-pattern-governance/perimeter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const policy = JSON.parse(readFileSync(resolve(root, "openspec/governance/design-pattern-policy.json"), "utf8"));

test("CR-F16 selects the most-specific record-only class under a broad governance parent", () => {
  const path = "openspec/governance/records/define-normative-precedence-lifecycle.json";
  assert.equal(classifyPath(path, policy), "governance_record_only");
  assert.equal(isGovernanceRecordOnly([path], policy), true);
  assert.equal(isGovernanceCore([path], policy), false);
  assert.equal(requiresOpenSpecAssociation(path, policy), false);
});

test("CR-F16 keeps nearby policy and checker files inside active-change association", () => {
  for (const path of [
    "openspec/governance/normative-source-precedence.json",
    "openspec/scripts/check-normative-precedence.mjs",
  ]) {
    assert.equal(classifyPath(path, policy), "governance_core", path);
    assert.equal(requiresOpenSpecAssociation(path, policy), true, path);
  }
});

test("CR-F16 does not treat a mixed record and governance-core change as record-only", () => {
  const paths = [
    "openspec/governance/records/define-normative-precedence-lifecycle.json",
    "openspec/governance/normative-source-precedence.json",
  ];
  assert.equal(isGovernanceRecordOnly(paths, policy), false);
  assert.deepEqual(paths.filter((path) => requiresOpenSpecAssociation(path, policy)), [paths[1]]);
});

test("planning artifacts remain outside implementation association after classification", () => {
  const path = "openspec/changes/define-normative-precedence-lifecycle/proposal.md";
  assert.equal(classifyPath(path, policy), "governed_implementation");
  assert.equal(requiresOpenSpecAssociation(path, policy), false);
});
