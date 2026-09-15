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
  validateReviewBinding
} from "../../scripts/normative-precedence/model.mjs";
import { isGovernanceCore } from "../../scripts/design-pattern-governance/perimeter.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const liveRoot = resolve(here, "../../..");
const basePolicy = JSON.parse(readFileSync(resolve(liveRoot, "openspec/governance/normative-source-precedence.json"), "utf8"));
const designPolicy = JSON.parse(readFileSync(resolve(liveRoot, "openspec/governance/design-pattern-policy.json"), "utf8"));
const contractSource = JSON.parse(readFileSync(resolve(liveRoot, "contracts/security-audit/source/contract.source.json"), "utf8"));
const objectA = "a".repeat(40);
const objectB = "b".repeat(40);
const objectC = "c".repeat(40);
const DELTA_CHANGE = "openspec/changes/change-a";
const CO_OWNERS = ["derived-field-trust-semantics", "security-audit-event-contract"];
const GENERATED_FIXTURE = "contracts/security-audit/schema/fixture.schema.json";
const FIXTURE_CHECKER = "openspec/scripts/normative-precedence/fixture-checker.mjs";
const SHARED_CI = ".github/workflows/ci.yml";

function write(root, path, content) {
  const absolute = resolve(root, path);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

function json(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function codes(entries) {
  return entries.map((entry) => entry.code);
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

function commitAll(root, message) {
  git(root, ["add", "-A"]);
  git(root, ["commit", "-q", "-m", message]);
  return gitText(root, ["rev-parse", "HEAD"]);
}

function runCli(root, stage, base) {
  return spawnSync(process.execPath, [
    resolve(liveRoot, "openspec/scripts/check-normative-precedence.mjs"),
    "--repo", root,
    "--stage", stage,
    "--base", base,
    "--json"
  ], { encoding: "utf8" });
}

function makeRepository() {
  const root = mkdtempSync(resolve(tmpdir(), "bloodtrail-precedence-"));
  git(root, ["init", "-q", "-b", "main"]);
  git(root, ["config", "user.email", "fixture@example.invalid"]);
  git(root, ["config", "user.name", "Fixture"]);
  const policy = structuredClone(basePolicy);
  policy.baseline_conflicts = [];
  policy.semantic_assertions = [];
  const source = structuredClone(contractSource);
  write(root, policy.contract.source_path, json(source));
  write(root, "openspec/governance/normative-source-precedence.json", json(policy));
  write(root, "openspec/governance/schemas/normative-source-precedence.schema.json", readFileSync(resolve(liveRoot, "openspec/governance/schemas/normative-source-precedence.schema.json"), "utf8"));
  write(root, SHARED_CI, "name: fixture\n");
  for (const capability of policy.capabilities) {
    write(root, capability.path, readFileSync(resolve(liveRoot, capability.path), "utf8"));
  }
  return { root, policy, source, base: commitAll(root, "fixture baseline") };
}

function withRepository(callback) {
  const fixture = makeRepository();
  try {
    callback(fixture);
  } finally {
    rmSync(fixture.root, { recursive: true, force: true });
  }
}

function changeRoot(policy) {
  return `${policy.repository_evidence.active_changes_root}/${policy.change_id}`;
}

function lifecyclePath(policy) {
  return `${changeRoot(policy)}/${policy.repository_evidence.lifecycle_evidence_file}`;
}

function authorizationMarkdown({ commit, tree, subtree, base = null, capabilities = [], dimensions = [], pointers = [], paths }) {
  const code = (values) => (values.length === 0 ? "`none`" : values.map((value) => `\`${value}\``).join(", "));
  return [
    "# Apply Authorization",
    "",
    "| Field | Value |",
    "| --- | --- |",
    `| Authorized proposal commit | \`${commit}\` |`,
    `| Repository tree | \`${tree}\` |`,
    `| Change subtree object | \`${subtree}\` |`,
    ...(base ? [`| Candidate A base | \`${base}\` |`] : []),
    "| Authorizing party | Fernando Homem da Costa (nandohdc), project owner |",
    `| Authorized capabilities | ${code(capabilities)} |`,
    `| Authorized semantic dimensions | ${code(dimensions)} |`,
    `| Authorized source pointers | ${code(pointers)} |`,
    "| Granted | Implement the bounded change |",
    "| Withheld | Merge and activation |",
    "",
    "## Changed-path allowlist",
    "",
    "```text",
    ...paths,
    "```",
    ""
  ].join("\n");
}

function commitProposal(root, changeDir, proposal, extraFiles = {}) {
  for (const [path, content] of Object.entries(extraFiles)) write(root, path, content);
  write(root, `${changeDir}/proposal.md`, proposal);
  const commit = commitAll(root, "proposal");
  return {
    commit,
    tree: gitText(root, ["rev-parse", "HEAD^{tree}"]),
    subtree: gitText(root, ["rev-parse", `${commit}:${changeDir}`])
  };
}

function modifiedProposal(capabilities) {
  return `## Capabilities\n\n### Modified Capabilities\n\n${capabilities.map((id) => `- \`${id}\`: bounded authority change`).join("\n")}\n`;
}

function authorizeDelta({ root, policy, base }, { capabilities = CO_OWNERS, proposalText = null, extraAuthorizationFiles = {} } = {}) {
  const specs = Object.fromEntries(capabilities.map((id) => [`${DELTA_CHANGE}/specs/${id}/spec.md`, "## MODIFIED Requirements\n"]));
  const proposal = commitProposal(root, DELTA_CHANGE, proposalText ?? modifiedProposal(capabilities), specs);
  const authorizationPath = `${DELTA_CHANGE}/${policy.repository_evidence.apply_authorization_file}`;
  write(root, authorizationPath, authorizationMarkdown({
    ...proposal,
    base,
    capabilities,
    dimensions: ["authority"],
    pointers: ["/fields/*/a"],
    paths: [policy.contract.source_path]
  }));
  for (const [path, content] of Object.entries(extraAuthorizationFiles)) write(root, path, content);
  commitAll(root, "apply authorization");
  return authorizationPath;
}

function authorizeGovernedChange({ root, policy, base }, paths, { withBase = true } = {}) {
  const proposal = commitProposal(root, changeRoot(policy), "## Capabilities\n\n### Modified Capabilities\n\nNone.\n");
  write(root, `${changeRoot(policy)}/${policy.repository_evidence.apply_authorization_file}`, authorizationMarkdown({ ...proposal, base: withBase ? base : null, paths }));
  commitAll(root, "apply authorization");
}

function lifecycleEvidence(changeState = "FOLDED", contractState = "MERGED") {
  const edges = (pairs) => pairs.map(([from, to]) => ({ from, to, evidence_paths: [basePolicy.contract.source_path] }));
  const changeEdges = [
    ["PROPOSED", "VALIDATED"],
    ["VALIDATED", "APPLY_AUTHORIZED"],
    ["APPLY_AUTHORIZED", "IMPLEMENTED"],
    ["IMPLEMENTED", "VERIFIED"]
  ];
  if (changeState === "FOLDED") changeEdges.push(["VERIFIED", "FOLDED"]);
  const evidence = {
    change_id: basePolicy.change_id,
    change_record: { current_state: changeState, transitions: edges(changeEdges) }
  };
  if (contractState === null) {
    evidence.contract_candidate = { applicability: "NOT_APPLICABLE", reason: "fixture changes no contract source or derived output" };
    return evidence;
  }
  const contractEdges = [
    ["AUTHORED_CANDIDATE", "GENERATED_CANDIDATE"],
    ["GENERATED_CANDIDATE", "TECHNICALLY_VERIFIED_FROZEN"],
    ["TECHNICALLY_VERIFIED_FROZEN", "REVIEWED_DECIDED"],
    ["REVIEWED_DECIDED", "MERGE_READY"]
  ];
  if (contractState === "MERGED") contractEdges.push(["MERGE_READY", "MERGED"]);
  evidence.contract_candidate = { current_state: contractState, transitions: edges(contractEdges) };
  return evidence;
}

function mutateSource(root, policy, suffix) {
  const source = JSON.parse(readFileSync(resolve(root, policy.contract.source_path), "utf8"));
  source.$schema = `${source.$schema}${suffix}`;
  write(root, policy.contract.source_path, json(source));
  return source;
}

function prepareReviewedRepository(fixture, { grants = null, technicalFiles = {} } = {}) {
  const { root, policy, base } = fixture;
  authorizeGovernedChange(fixture, [
    policy.contract.source_path,
    `${changeRoot(policy)}/**`,
    "contracts/security-audit/schema/",
    "openspec/scripts/normative-precedence/",
    SHARED_CI
  ]);
  write(root, lifecyclePath(policy), json(lifecycleEvidence("FOLDED", "MERGED")));
  const source = mutateSource(root, policy, "#reviewed");
  write(root, SHARED_CI, "name: fixture\n# reviewed candidate step\n");
  for (const [path, content] of Object.entries(technicalFiles)) write(root, path, content);
  const technicalCommit = commitAll(root, "technical candidate");
  const tree = gitText(root, ["rev-parse", "HEAD^{tree}"]);
  const governedPaths = gitText(root, ["diff", "--name-only", `${base}...${technicalCommit}`]).split("\n").filter(Boolean);
  const governedPathObjects = Object.fromEntries(governedPaths.map((path) => [path, gitText(root, ["rev-parse", `${technicalCommit}:${path}`])]));
  const record = {
    schema: "bloodtrail.normative-precedence.review",
    change_id: policy.change_id,
    base_commit: base,
    technical_commit: technicalCommit,
    tree,
    governed_path_objects: governedPathObjects,
    contract_version: source.metadata.schema_version,
    decision_scope: [policy.change_id],
    reviewer_identity: policy.governance_authorities.review_authority_identity,
    reviewer_authority: policy.governance_authorities.review_authority_role,
    authorization_granted: grants ?? [policy.governance_authorities.merge_grant, policy.governance_authorities.activation_grant],
    authorization_withheld: ["release"],
    decision_timestamp: "2026-09-15T00:00:00Z",
    signed: true
  };
  write(root, policy.repository_evidence.review_record_path, json(record));
  const reviewCommit = commitAll(root, "signed exact review");
  return { technicalCommit, tree, governedPathObjects, record, reviewCommit };
}

function commitActivation({ root, policy }, reviewed, overrides = {}) {
  const mergeCommit = gitText(root, ["rev-parse", "HEAD"]);
  const record = {
    authorizing_decision_object: overrides.authorizing_decision_object ?? gitText(root, ["hash-object", policy.repository_evidence.review_record_path]),
    activated_commit: mergeCommit,
    activated_tree: gitText(root, ["rev-parse", "HEAD^{tree}"]),
    reviewed_technical_commit: reviewed.technicalCommit,
    reviewed_tree: reviewed.tree,
    governed_path_objects: reviewed.governedPathObjects,
    contract_version: reviewed.record.contract_version,
    scope: [policy.change_id],
    protected_reference: policy.repository_evidence.protected_reference,
    required_check_evidence: { verified: true },
    effective_event: "activation-record-commit",
    parent_commit: mergeCommit,
    authorization_granted: [policy.governance_authorities.activation_grant],
    authorization_withheld: ["release"],
    ...overrides
  };
  write(root, policy.repository_evidence.activation_record_path, json(record));
  commitAll(root, "dedicated activation");
  return record;
}

function archiveGovernedChange({ root, policy }) {
  const archiveRoot = `${policy.repository_evidence.archive_root}/2099-01-01-${policy.change_id}`;
  mkdirSync(resolve(root, policy.repository_evidence.archive_root), { recursive: true });
  git(root, ["mv", changeRoot(policy), archiveRoot]);
  return commitAll(root, "archive governed change");
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

function deltaFor(root, policy, capabilityId = "security-audit-event-contract") {
  return discoverRepositorySources(root, policy).active.find((entry) => entry.change_id === "change-a" && entry.capability_id === capabilityId);
}

// Repository enforcement cases: each runs against a disposable Git repository.

test("REPO-001 permitted delegated encoding detail passes", () => withRepository(({ root, policy, base }) => {
  const source = JSON.parse(readFileSync(resolve(root, policy.contract.source_path), "utf8"));
  source.$schema = "https://bloodtrail.dev/contracts/security-audit/source/contract-source.schema.json";
  write(root, policy.contract.source_path, json(source));
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.deepEqual(result.diagnostics, []);
}));

test("REPO-002 prohibited source-only semantic addition fails", () => withRepository(({ root, policy, source }) => {
  source.fields[0].unauthorized_security_behavior = "allow";
  write(root, policy.contract.source_path, json(source));
  const result = inspectRepository(root, policy, { stage: "candidate" });
  assert.ok(codes(result.diagnostics).includes("source-property-ownership-missing"));
}));

test("REPO-002a recognized semantic property change requires an authorized delta", () => withRepository(({ root, policy, source, base }) => {
  source.fields[0].a = "client_claim";
  write(root, policy.contract.source_path, json(source));
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.ok(codes(result.diagnostics).includes("source-semantic-change-unauthorized"));
  assert.ok(result.sourceChange.changes.some((entry) => entry.pointer === "/fields/0/a"));
}));

test("REPO-003 authorized active candidate delta is discovered separately", () => withRepository((fixture) => {
  authorizeDelta(fixture);
  assert.equal(deltaFor(fixture.root, fixture.policy)?.class, "ACTIVE_CANDIDATE_DELTA");
}));

test("REPO-003a negative proposal prose cannot create active capability scope", () => withRepository((fixture) => {
  authorizeDelta(fixture, { proposalText: "## Capabilities\n\nThis change MUST NOT modify `security-audit-event-contract`.\n" });
  const delta = deltaFor(fixture.root, fixture.policy);
  assert.equal(delta?.class, "PROPOSED_CANDIDATE_DELTA");
  assert.ok(delta?.diagnostics.includes("capability is not in the structured proposal scope"));
}));

test("REPO-003b authorized semantic pointer change is accepted only within exact delta scope", () => withRepository((fixture) => {
  const { root, policy, source, base } = fixture;
  authorizeDelta(fixture);
  write(root, `${DELTA_CHANGE}/compatibility-decision.json`, json({ material_semantic_change: true, compatibility_classification: "breaking", compatibility_policy_rule: "fixture" }));
  source.fields[0].a = "client_claim";
  write(root, policy.contract.source_path, json(source));
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.equal(codes(result.diagnostics).includes("source-semantic-change-unauthorized"), false);
  assert.equal(codes(result.diagnostics).includes("compatibility-transition-unclassified"), false);
  assert.deepEqual(result.sourceChange.changes.find((entry) => entry.pointer === "/fields/0/a")?.authorized_by, CO_OWNERS.map((id) => `change-a:${id}`));
}));

test("REPO-003c one co-owner's delta cannot authorize a co-owned semantic pointer", () => withRepository((fixture) => {
  const { root, policy, source, base } = fixture;
  authorizeDelta(fixture, { capabilities: ["security-audit-event-contract"] });
  write(root, `${DELTA_CHANGE}/compatibility-decision.json`, json({ material_semantic_change: true, compatibility_classification: "breaking", compatibility_policy_rule: "fixture" }));
  source.fields[0].a = "client_claim";
  write(root, policy.contract.source_path, json(source));
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.ok(result.diagnostics.some((entry) => entry.code === "source-semantic-change-unauthorized" && entry.message.includes("derived-field-trust-semantics")));
}));

test("REPO-003d an apply authorization edited after it was recorded authorizes nothing", () => withRepository((fixture) => {
  const { root, policy } = fixture;
  const authorizationPath = authorizeDelta(fixture);
  write(root, authorizationPath, readFileSync(resolve(root, authorizationPath), "utf8").replace("`/fields/*/a`", "`/fields/*/a`, `/fields/*/trust`"));
  commitAll(root, "widen authorized pointers");
  const delta = deltaFor(root, policy);
  assert.equal(delta?.class, "PROPOSED_CANDIDATE_DELTA");
  assert.ok(delta?.diagnostics.includes("apply authorization was modified after it was first recorded"));
}));

test("REPO-003e an apply authorization recorded alongside other changes authorizes nothing", () => withRepository((fixture) => {
  authorizeDelta(fixture, { extraAuthorizationFiles: { [`${DELTA_CHANGE}/notes.md`]: "bundled with the authorization\n" } });
  const delta = deltaFor(fixture.root, fixture.policy);
  assert.equal(delta?.class, "PROPOSED_CANDIDATE_DELTA");
  assert.ok(delta?.diagnostics.includes("apply authorization was not recorded in a dedicated commit"));
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
  assert.ok(codes(result.diagnostics).includes("applicable-capability-missing"));
}));

test("REPO-006 ambiguous capability applicability fails repository inspection", () => withRepository(({ root, policy, base }) => {
  policy.capabilities.push(structuredClone(policy.capabilities[0]));
  write(root, "openspec/governance/normative-source-precedence.json", json(policy));
  const cli = runCli(root, "candidate", base);
  assert.equal(cli.status, 1, cli.stderr);
  assert.ok(codes(JSON.parse(cli.stdout).diagnostics).includes("capability-applicability-ambiguous"));
}));

test("REPO-006a changed overlapping capability invalidates its exact compatibility classification", () => withRepository(({ root, policy, base }) => {
  const capability = policy.capabilities.find((entry) => entry.id === "derived-field-trust-semantics");
  write(root, capability.path, `${readFileSync(resolve(root, capability.path), "utf8")}\nChanged semantic text.\n`);
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.ok(codes(result.diagnostics).includes("capability-overlap-classification-stale"));
}));

test("REPO-006b explicitly contradictory current capabilities have no automatic winner", () => withRepository(({ root, policy, base }) => {
  policy.capability_overlaps[0].classification = "CONTRADICTORY";
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.ok(codes(result.diagnostics).includes("applicable-current-capability-conflict"));
}));

test("REPO-007 post-review governed blob mutation invalidates review", () => withRepository((fixture) => {
  prepareReviewedRepository(fixture);
  mutateSource(fixture.root, fixture.policy, "#after-review");
  commitAll(fixture.root, "post-review source mutation");
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "merge", baseCommit: fixture.base });
  assert.ok(result.diagnostics.some((entry) => entry.code === "review-binding-post-review-change" && entry.path === fixture.policy.contract.source_path));
}));

test("REPO-008 partial reviewed-path binding fails", () => withRepository((fixture) => {
  const reviewed = prepareReviewedRepository(fixture);
  const record = structuredClone(reviewed.record);
  delete record.governed_path_objects[lifecyclePath(fixture.policy)];
  write(fixture.root, fixture.policy.repository_evidence.review_record_path, json(record));
  commitAll(fixture.root, "narrowed review record");
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "merge", baseCommit: fixture.base });
  assert.ok(codes(result.diagnostics).includes("review-binding-partial"));
}));

test("REPO-009 unclassified material compatibility transition fails", () => withRepository((fixture) => {
  const { root, policy, source, base } = fixture;
  authorizeDelta(fixture);
  source.fields[0].a = "client_claim";
  write(root, policy.contract.source_path, json(source));
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.equal(codes(result.diagnostics).includes("source-semantic-change-unauthorized"), false);
  assert.ok(codes(result.diagnostics).includes("compatibility-transition-unclassified"));
}));

test("REPO-010 activation record without independent authorization fails", () => withRepository((fixture) => {
  const reviewed = prepareReviewedRepository(fixture, { grants: [fixture.policy.governance_authorities.merge_grant] });
  commitActivation(fixture, reviewed);
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "activation", baseCommit: fixture.base });
  assert.ok(codes(result.diagnostics).includes("activation-authorization-missing"));
}));

test("REPO-011 activation bound only to branch or version fails", () => withRepository((fixture) => {
  const reviewed = prepareReviewedRepository(fixture);
  commitActivation(fixture, reviewed, { activated_commit: "refs/heads/main", parent_commit: "refs/heads/main" });
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "activation", baseCommit: fixture.base });
  assert.ok(codes(result.diagnostics).includes("activation-floating-reference"));
}));

test("REPO-012 illegal or cross-machine lifecycle transition fails repository inspection", () => withRepository(({ root, policy, base }) => {
  assert.equal(transitionAllowed(policy.change_record_lifecycle, "VERIFIED", "ACTIVATED"), false);
  const evidence = lifecycleEvidence();
  evidence.contract_candidate.transitions = [{ from: "MERGED", to: "RELEASED", evidence_paths: [policy.contract.source_path] }];
  evidence.contract_candidate.current_state = "RELEASED";
  write(root, lifecyclePath(policy), json(evidence));
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.ok(codes(result.diagnostics).includes("lifecycle-transition-illegal"));
}));

test("REPO-012b lifecycle evidence cannot claim a later state without the chain from the initial state", () => withRepository(({ root, policy, base }) => {
  write(root, lifecyclePath(policy), json({
    change_id: policy.change_id,
    change_record: { current_state: "FOLDED", transitions: [] },
    contract_candidate: { current_state: "MERGED", transitions: [] }
  }));
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.ok(codes(result.diagnostics).includes("lifecycle-evidence-initial-state-missing"));
}));

test("REPO-013 frozen generated artifact mutation requires a new candidate identity", () => withRepository((fixture) => {
  prepareReviewedRepository(fixture, { technicalFiles: { [GENERATED_FIXTURE]: "{\"generated\":true}\n" } });
  write(fixture.root, GENERATED_FIXTURE, "{\"generated\":false}\n");
  commitAll(fixture.root, "post-review generated mutation");
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "merge", baseCommit: fixture.base });
  assert.ok(result.diagnostics.some((entry) => entry.code === "review-binding-post-review-change" && entry.path === GENERATED_FIXTURE));
}));

test("REPO-014 every normative precedence policy/checker path is governance core", () => {
  const paths = [
    "openspec/governance/normative-source-precedence.json",
    "openspec/governance/normative-precedence-activation.json",
    "openspec/scripts/check-normative-precedence.mjs",
    "openspec/scripts/normative-precedence/model.mjs",
    "openspec/governance/schemas/normative-source-precedence.schema.json"
  ];
  for (const path of paths) assert.equal(isGovernanceCore([path], designPolicy), true, path);
});

test("REPO-015 merge-stage CLI inspection loads and validates exact repository review evidence", () => withRepository((fixture) => {
  prepareReviewedRepository(fixture);
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "merge", baseCommit: fixture.base });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.review?.binding.signed, true);
  const cli = runCli(fixture.root, "merge", fixture.base);
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
}));

test("REPO-016 repository inspection rejects a stale reviewed path object", () => withRepository((fixture) => {
  const reviewed = prepareReviewedRepository(fixture);
  const record = structuredClone(reviewed.record);
  record.governed_path_objects[Object.keys(record.governed_path_objects)[0]] = objectC;
  write(fixture.root, fixture.policy.repository_evidence.review_record_path, json(record));
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "merge", baseCommit: fixture.base });
  assert.ok(codes(result.diagnostics).includes("review-binding-stale"));
}));

test("REPO-017 repository inspection validates dedicated activation evidence and exact authority", () => withRepository((fixture) => {
  const reviewed = prepareReviewedRepository(fixture);
  commitActivation(fixture, reviewed);
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "activation", baseCommit: fixture.base });
  assert.deepEqual(result.diagnostics, []);
  assert.equal(result.activation?.protected_reference, "refs/heads/main");
  const cli = runCli(fixture.root, "activation", fixture.base);
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);
}));

test("REPO-018 merge stage fails closed when the range touches the change without a review", () => withRepository((fixture) => {
  const { root, policy, base } = fixture;
  authorizeGovernedChange(fixture, [`${changeRoot(policy)}/**`]);
  write(root, lifecyclePath(policy), json(lifecycleEvidence("VERIFIED", null)));
  commitAll(root, "verified governance-only change");
  const result = inspectRepository(root, policy, { stage: "merge", baseCommit: base });
  assert.ok(codes(result.diagnostics).includes("review-binding-pending"));
  assert.equal(runCli(root, "merge", base).status, 1);
}));

test("REPO-019 an unrelated range after the governed merge is not blocked by that change's evidence", () => withRepository((fixture) => {
  const reviewed = prepareReviewedRepository(fixture);
  write(fixture.root, "docs/unrelated.md", "Unrelated protected-history change.\n");
  commitAll(fixture.root, "unrelated change");
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "merge", baseCommit: reviewed.reviewCommit });
  assert.deepEqual(result.diagnostics, []);
  assert.ok(codes(result.observations).includes("governed-change-out-of-range"));
}));

test("REPO-019b an unrelated later edit to a shared reviewed file neither scopes the range nor stales the review", () => withRepository((fixture) => {
  const reviewed = prepareReviewedRepository(fixture);
  write(fixture.root, SHARED_CI, "name: fixture\n# reviewed candidate step\n# unrelated later step\n");
  commitAll(fixture.root, "unrelated CI change");
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "merge", baseCommit: reviewed.reviewCommit });
  assert.deepEqual(result.diagnostics, []);
  assert.ok(codes(result.observations).includes("governed-change-out-of-range"));
}));

test("REPO-020 a completed change archives byte-identically after activation while its contract stays activated", () => withRepository((fixture) => {
  const reviewed = prepareReviewedRepository(fixture);
  commitActivation(fixture, reviewed);
  const activationCommit = gitText(fixture.root, ["rev-parse", "HEAD"]);
  archiveGovernedChange(fixture);
  assert.equal(transitionAllowed(fixture.policy.change_record_lifecycle, "FOLDED", "ARCHIVED"), true);
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "merge", baseCommit: activationCommit });
  assert.deepEqual(result.diagnostics, []);
}));

test("REPO-020a archiving the governed change before activation fails", () => withRepository((fixture) => {
  const reviewed = prepareReviewedRepository(fixture);
  archiveGovernedChange(fixture);
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "merge", baseCommit: reviewed.reviewCommit });
  assert.ok(codes(result.diagnostics).includes("activation-evidence-pending"));
}));

test("REPO-020b removing the governed change without an archive fails", () => withRepository((fixture) => {
  const reviewed = prepareReviewedRepository(fixture);
  git(fixture.root, ["rm", "-r", "-q", changeRoot(fixture.policy)]);
  commitAll(fixture.root, "delete governed change");
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "merge", baseCommit: reviewed.reviewCommit });
  assert.ok(codes(result.diagnostics).includes("governed-change-removed-without-archive"));
}));

test("REPO-021 a not-applicable contract candidate is rejected when the range changes contract source", () => withRepository((fixture) => {
  const { root, policy, base } = fixture;
  authorizeGovernedChange(fixture, [policy.contract.source_path, `${changeRoot(policy)}/**`]);
  write(root, lifecyclePath(policy), json(lifecycleEvidence("VERIFIED", null)));
  mutateSource(root, policy, "#governance-only-claim");
  commitAll(root, "governance-only claim with source change");
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.ok(codes(result.diagnostics).includes("lifecycle-contract-candidate-required"));
}));

test("REPO-022 a changed path outside the apply-authorized scope fails", () => withRepository((fixture) => {
  const { root, policy, base } = fixture;
  authorizeGovernedChange(fixture, [`${changeRoot(policy)}/**`]);
  write(root, lifecyclePath(policy), json(lifecycleEvidence("VERIFIED", null)));
  write(root, "packages/unrelated/file.txt", "outside the allowlist\n");
  commitAll(root, "out-of-scope implementation");
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.ok(result.diagnostics.some((entry) => entry.code === "apply-scope-exceeded" && entry.path === "packages/unrelated/file.txt"));
}));

test("REPO-022b a change cannot widen its own apply authorization in a later commit", () => withRepository((fixture) => {
  const { root, policy, base } = fixture;
  authorizeGovernedChange(fixture, [`${changeRoot(policy)}/**`]);
  const authorizationPath = `${changeRoot(policy)}/${policy.repository_evidence.apply_authorization_file}`;
  write(root, authorizationPath, readFileSync(resolve(root, authorizationPath), "utf8").replace("```text\n", "```text\npackages/\n"));
  write(root, lifecyclePath(policy), json(lifecycleEvidence("VERIFIED", null)));
  write(root, "packages/unrelated/file.txt", "self-widened scope\n");
  commitAll(root, "self-widened authorization");
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.ok(result.diagnostics.some((entry) => entry.code === "apply-authorization-invalid" && entry.message === "apply authorization was modified after it was first recorded"));
}));

test("REPO-023 merge stage without an exact comparison base fails closed", () => withRepository(({ root, policy }) => {
  const result = inspectRepository(root, policy, { stage: "merge" });
  assert.ok(codes(result.diagnostics).includes("comparison-base-required"));
}));

test("REPO-023b release stage enforces activation even when the range does not touch the change", () => withRepository((fixture) => {
  const { root, policy } = fixture;
  authorizeGovernedChange(fixture, [`${changeRoot(policy)}/**`]);
  write(root, lifecyclePath(policy), json(lifecycleEvidence("VERIFIED", null)));
  const verified = commitAll(root, "verified governance-only change");
  write(root, "docs/release-notes.md", "Release notes.\n");
  commitAll(root, "release preparation");
  const result = inspectRepository(root, policy, { stage: "release", baseCommit: verified });
  assert.ok(codes(result.diagnostics).includes("activation-evidence-pending"));
  assert.ok(codes(result.diagnostics).includes("lifecycle-stage-not-ready"));
}));

test("REPO-024 overlap classes are reported distinctly", () => withRepository(({ root, policy, base }) => {
  const baseline = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  assert.deepEqual(baseline.diagnostics, []);
  assert.equal(baseline.observations.find((entry) => entry.code === "capability-overlap-summary")?.message, "NO_OVERLAP=11 COMPATIBLE_OVERLAP=3 DUPLICATE_CONSISTENT=0 CONTRADICTORY=0");
  assert.equal(codes(baseline.observations).filter((code) => code === "capability-overlap-compatible").length, 3);

  const duplicate = structuredClone(policy);
  duplicate.capability_overlaps[0].classification = "DUPLICATE_CONSISTENT";
  const duplicateResult = inspectRepository(root, duplicate, { stage: "candidate", baseCommit: base });
  assert.deepEqual(duplicateResult.diagnostics, []);
  assert.ok(codes(duplicateResult.observations).includes("capability-overlap-duplicate-consistent"));

  const ambiguous = structuredClone(policy);
  ambiguous.requirement_ownership.push(structuredClone(ambiguous.requirement_ownership.find((entry) => entry.domain === "catalog")));
  assert.ok(codes(inspectRepository(root, ambiguous, { stage: "candidate", baseCommit: base }).diagnostics).includes("source-section-ownership-ambiguous"));
}));

test("REPO-025 activation evidence is located from history when CI checks out a synthetic merge", () => withRepository((fixture) => {
  const { root, policy } = fixture;
  const reviewed = prepareReviewedRepository(fixture);
  git(root, ["branch", "activation-branch"]);
  write(root, "docs/protected-main.md", "Protected main moved on.\n");
  const mainTip = commitAll(root, "unrelated protected change");
  git(root, ["checkout", "-q", "activation-branch"]);
  commitActivation(fixture, reviewed);
  const activationTip = gitText(root, ["rev-parse", "HEAD"]);
  git(root, ["checkout", "-q", "--detach", mainTip]);
  git(root, ["merge", "-q", "--no-ff", "-m", "synthetic pull request merge", activationTip]);
  const result = inspectRepository(root, policy, { stage: "activation", baseCommit: mainTip });
  assert.deepEqual(result.diagnostics, []);
}));

test("REPO-026 activation whose parent lacks the reviewed content fails", () => withRepository((fixture) => {
  const { root, policy, base } = fixture;
  const reviewed = prepareReviewedRepository(fixture);
  const reviewObject = gitText(root, ["hash-object", policy.repository_evidence.review_record_path]);
  git(root, ["checkout", "-q", "-b", "side", base]);
  commitActivation(fixture, reviewed, { authorizing_decision_object: reviewObject });
  git(root, ["checkout", "-q", "main"]);
  git(root, ["merge", "-q", "--no-ff", "-m", "merge side activation", "side"]);
  const result = inspectRepository(root, policy, { stage: "activation", baseCommit: reviewed.reviewCommit });
  assert.ok(codes(result.diagnostics).includes("activation-merge-lacks-reviewed-commit"));
  assert.ok(codes(result.diagnostics).includes("activation-merge-content-mismatch"));
}));

test("REPO-027 a post-review checker change invalidates review", () => withRepository((fixture) => {
  prepareReviewedRepository(fixture, { technicalFiles: { [FIXTURE_CHECKER]: "export const checker = 1;\n" } });
  write(fixture.root, FIXTURE_CHECKER, "export const checker = 2;\n");
  commitAll(fixture.root, "post-review checker change");
  const result = inspectRepository(fixture.root, fixture.policy, { stage: "merge", baseCommit: fixture.base });
  assert.ok(result.diagnostics.some((entry) => entry.code === "review-binding-post-review-change" && entry.path === FIXTURE_CHECKER));
}));

test("REPO-028 a review cannot choose its own base without an authorized candidate base", () => withRepository((fixture) => {
  const { root, policy, base, source } = fixture;
  authorizeGovernedChange(fixture, [`${changeRoot(policy)}/**`], { withBase: false });
  write(root, lifecyclePath(policy), json(lifecycleEvidence("VERIFIED", null)));
  const technical = commitAll(root, "technical candidate");
  write(root, policy.repository_evidence.review_record_path, json({
    schema: "bloodtrail.normative-precedence.review",
    change_id: policy.change_id,
    base_commit: technical,
    technical_commit: technical,
    tree: gitText(root, ["rev-parse", "HEAD^{tree}"]),
    governed_path_objects: {},
    contract_version: source.metadata.schema_version,
    decision_scope: [policy.change_id],
    reviewer_identity: policy.governance_authorities.review_authority_identity,
    reviewer_authority: policy.governance_authorities.review_authority_role,
    authorization_granted: [policy.governance_authorities.merge_grant],
    authorization_withheld: ["activation"],
    decision_timestamp: "2026-09-15T00:00:00Z",
    signed: true
  }));
  commitAll(root, "self-based review");
  const result = inspectRepository(root, policy, { stage: "merge", baseCommit: base });
  assert.ok(codes(result.diagnostics).includes("review-binding-base-unauthorized"));
}));

// Binding-function unit cases: they exercise one validator's field comparison
// directly and are reported separately from repository enforcement.

test("UNIT-001 exact review scalar, scope, and authorization bindings cannot drift", () => {
  const binding = fullReviewBinding();
  const values = {
    technical_commit: binding.technical_commit,
    tree: binding.tree,
    contract_version: binding.contract_version,
    decision_scope: binding.decision_scope,
    reviewer_identity: binding.reviewer_identity,
    reviewer_authority: binding.reviewer_authority,
    authorization_granted: binding.authorization_granted,
    authorization_withheld: binding.authorization_withheld
  };
  const expected = { paths: Object.keys(binding.governed_path_objects), objects: binding.governed_path_objects, values };
  for (const [field, replacement] of [
    ["contract_version", "9.0.0"],
    ["decision_scope", ["other"]],
    ["reviewer_identity", "unknown"],
    ["reviewer_authority", "NONE"],
    ["authorization_granted", ["release"]],
    ["authorization_withheld", []]
  ]) {
    const mutant = structuredClone(binding);
    mutant[field] = replacement;
    assert.ok(codes(validateReviewBinding(mutant, expected)).includes("review-binding-value-mismatch"), field);
  }
});

test("UNIT-002 activation scope, version, review, reference, checks, and grants bind exactly", () => {
  const record = {
    ...fullActivationRecord(),
    reviewed_technical_commit: objectA,
    reviewed_tree: objectB,
    protected_reference: "refs/heads/main",
    required_check_evidence: { verified: true },
    effective_event: "activation-record-commit",
    authorization_granted: ["activation"]
  };
  const expectedValues = {
    reviewed_technical_commit: objectA,
    reviewed_tree: objectB,
    protected_reference: "refs/heads/main",
    effective_event: "activation-record-commit",
    scope: ["contract"],
    contract_version: "2.1.0",
    authorization_granted: ["activation"]
  };
  for (const [field, replacement] of [
    ["reviewed_technical_commit", objectC],
    ["reviewed_tree", objectC],
    ["protected_reference", "refs/heads/other"],
    ["effective_event", "tag"],
    ["scope", ["other"]],
    ["contract_version", "9.0.0"],
    ["authorization_granted", ["release"]]
  ]) {
    const mutant = structuredClone(record);
    mutant[field] = replacement;
    const context = { requiredFields: basePolicy.activation.required_fields, authorizingDecision: { authorization_granted: ["activation"] }, activationRecordObject: objectB, mergeCommit: objectA, mergeTree: objectB, parentCount: 1, expectedValues };
    assert.ok(codes(validateActivation(mutant, context)).includes("activation-binding-mismatch"), field);
  }
});

test("UNIT-003 activation evidence cannot name itself as its authorizing decision", () => {
  const record = fullActivationRecord();
  const context = { authorizingDecision: { authorization_granted: ["activation"] }, activationRecordObject: record.authorizing_decision_object, mergeCommit: objectA, parentCount: 1 };
  assert.ok(codes(validateActivation(record, context)).includes("activation-self-authorized"));
});
