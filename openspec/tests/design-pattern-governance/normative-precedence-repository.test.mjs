import assert from "node:assert/strict";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";
import {
  discoverRepositorySources,
  inspectRepository,
  transitionAllowed,
  validateActivation,
  validateCompatibilityTransition,
  validatePolicy,
  validateReviewBinding
} from "../../scripts/normative-precedence/model.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const liveRoot = resolve(here, "../../..");
const basePolicy = JSON.parse(readFileSync(resolve(liveRoot, "openspec/governance/normative-source-precedence.json"), "utf8"));
const contractSource = JSON.parse(readFileSync(resolve(liveRoot, "contracts/security-audit/source/contract.source.json"), "utf8"));
const objectA = "a".repeat(40);
const objectB = "b".repeat(40);
const objectC = "c".repeat(40);

function write(root, path, content) {
  const absolute = resolve(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function git(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
}

function gitText(root, args) {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function makeRepository() {
  const root = mkdtempSync(resolve(tmpdir(), "bloodtrail-precedence-"));
  git(root, ["init", "-q"]);
  git(root, ["config", "user.email", "fixture@example.invalid"]);
  git(root, ["config", "user.name", "Fixture"]);
  const policy = structuredClone(basePolicy);
  policy.baseline_conflicts = [];
  const source = structuredClone(contractSource);
  write(root, policy.contract.source_path, `${JSON.stringify(source, null, 2)}\n`);
  write(root, "openspec/governance/normative-source-precedence.json", `${JSON.stringify(policy, null, 2)}\n`);
  for (const capability of policy.capabilities) {
    const body = capability.id === "security-audit-event-contract"
      ? "# Fixture\n\n### Requirement: Schema governance is explicit and compatibility-tested\n\nThe current exact version is `2.1.0`.\n"
      : `# ${capability.id}\n\n### Requirement: Fixture ownership\n\nThe capability is current.\n`;
    write(root, capability.path, body);
  }
  git(root, ["add", "."]);
  git(root, ["commit", "-q", "-m", "fixture baseline"]);
  return { root, policy, source };
}

function withRepository(callback) {
  const fixture = makeRepository();
  try {
    callback(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

function fullReviewBinding(objects = { "contract.source.json": objectA, "schema.json": objectB }) {
  return {
    technical_commit: objectA,
    tree: objectB,
    governed_path_objects: objects,
    contract_version: "2.1.0",
    decision_scope: ["contract"],
    reviewer_identity: "project-owner",
    reviewer_authority: "CODEOWNER",
    authorization_granted: ["merge"],
    authorization_withheld: ["activation"],
    decision_timestamp: "2026-09-15T00:00:00Z"
  };
}

function reviewExpectation(objects = { "contract.source.json": objectA, "schema.json": objectB }) {
  return {
    requiredFields: basePolicy.review_binding.required_fields,
    paths: Object.keys(objects),
    objects
  };
}

function fullActivationRecord() {
  return {
    authorizing_decision_object: objectC,
    activated_commit: objectA,
    activated_tree: objectB,
    governed_path_objects: { "contract.source.json": objectA },
    contract_version: "2.1.0",
    scope: ["contract"],
    effective_event: "record-commit",
    parent_commit: objectA,
    authorization_granted: ["contract-activation"],
    authorization_withheld: ["release"]
  };
}

test("REPO-001 permitted delegated encoding detail passes", () => withRepository(({ root, policy }) => {
  const source = JSON.parse(readFileSync(resolve(root, policy.contract.source_path), "utf8"));
  source.$schema = "https://bloodtrail.dev/contracts/security-audit/source/contract-source.schema.json";
  write(root, policy.contract.source_path, `${JSON.stringify(source, null, 2)}\n`);
  const result = inspectRepository(root, policy, { stage: "candidate" });
  assert.deepEqual(result.diagnostics, []);
}));

test("REPO-002 prohibited source-only semantic addition fails", () => withRepository(({ root, policy, source }) => {
  source.fields[0].unauthorized_security_behavior = "allow";
  write(root, policy.contract.source_path, `${JSON.stringify(source, null, 2)}\n`);
  const result = inspectRepository(root, policy, { stage: "candidate" });
  assert.ok(result.diagnostics.some((entry) => entry.code === "source-property-ownership-missing"));
}));

test("REPO-003 authorized active candidate delta is discovered separately", () => withRepository(({ root, policy }) => {
  write(root, "openspec/changes/change-a/proposal.md", "## Capabilities\n\n- `security-audit-event-contract`\n");
  write(root, "openspec/changes/change-a/specs/security-audit-event-contract/spec.md", "## ADDED Requirements\n");
  git(root, ["add", "."]);
  git(root, ["commit", "-q", "-m", "candidate proposal"]);
  const commit = gitText(root, ["rev-parse", "HEAD"]);
  const tree = gitText(root, ["rev-parse", "HEAD^{tree}"]);
  write(root, "openspec/changes/change-a/apply-authorization.md", `| Authorized proposal commit | \`${commit}\` |\n| Repository tree | \`${tree}\` |\n`);
  const result = discoverRepositorySources(root, policy);
  assert.equal(result.active.find((entry) => entry.change_id === "change-a")?.class, "ACTIVE_CANDIDATE_DELTA");
}));

test("REPO-004 archived change remains historical", () => withRepository(({ root, policy }) => {
  write(root, "openspec/changes/archive/2099-01-01-change-a/specs/security-audit-event-contract/spec.md", "## ADDED Requirements\n");
  const result = discoverRepositorySources(root, policy);
  assert.equal(result.archived[0]?.class, "ARCHIVED_CHANGE_RECORD");
  assert.equal(result.active.length, 0);
}));

test("REPO-005 missing applicable capability fails", () => withRepository(({ root, policy }) => {
  rmSync(resolve(root, policy.capabilities[0].path));
  const result = inspectRepository(root, policy, { stage: "candidate" });
  assert.ok(result.diagnostics.some((entry) => entry.code === "applicable-capability-missing"));
}));

test("REPO-006 ambiguous capability applicability fails", () => {
  const policy = structuredClone(basePolicy);
  policy.capabilities.push(structuredClone(policy.capabilities[0]));
  assert.ok(validatePolicy(policy).some((entry) => entry.code === "capability-applicability-ambiguous"));
});

test("REPO-007 post-review governed blob mutation invalidates review", () => {
  const binding = fullReviewBinding();
  const expected = reviewExpectation({ "contract.source.json": objectC, "schema.json": objectB });
  assert.ok(validateReviewBinding(binding, expected).some((entry) => entry.code === "review-binding-stale"));
});

test("REPO-008 partial reviewed-path binding fails", () => {
  const binding = fullReviewBinding({ "contract.source.json": objectA });
  assert.ok(validateReviewBinding(binding, reviewExpectation()).some((entry) => entry.code === "review-binding-partial"));
});

test("REPO-009 unclassified material compatibility transition fails", () => {
  assert.ok(validateCompatibilityTransition({ material_semantic_change: true }).some((entry) => entry.code === "compatibility-transition-unclassified"));
});

test("REPO-010 activation record without independent authorization fails", () => {
  const record = fullActivationRecord();
  const diagnostics = validateActivation(record, {
    requiredFields: basePolicy.activation.required_fields,
    authorizingDecision: { authorization_granted: [] },
    activationRecordObject: objectB,
    mergeCommit: objectA,
    parentCount: 1
  });
  assert.ok(diagnostics.some((entry) => entry.code === "activation-authorization-missing"));
});

test("REPO-011 activation bound only to branch or version fails", () => {
  const record = fullActivationRecord();
  record.activated_commit = "main";
  const diagnostics = validateActivation(record, {
    requiredFields: basePolicy.activation.required_fields,
    authorizingDecision: { authorization_granted: ["activation"] },
    activationRecordObject: objectB,
    mergeCommit: "main",
    parentCount: 1
  });
  assert.ok(diagnostics.some((entry) => entry.code === "activation-floating-reference"));
});

test("REPO-012 illegal or cross-machine lifecycle transition fails", () => {
  assert.equal(transitionAllowed(basePolicy.change_record_lifecycle, "VERIFIED", "ACTIVATED"), false);
  assert.equal(transitionAllowed(basePolicy.contract_candidate_lifecycle, "MERGED", "RELEASED"), false);
});

test("REPO-013 frozen generated artifact mutation requires a new candidate identity", () => {
  const binding = fullReviewBinding();
  const expected = reviewExpectation({ "contract.source.json": objectA, "schema.json": objectC });
  const diagnostics = validateReviewBinding(binding, expected);
  assert.ok(diagnostics.some((entry) => entry.code === "review-binding-stale"));
});
