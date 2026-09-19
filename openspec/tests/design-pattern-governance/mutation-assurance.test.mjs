import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import test from "node:test";

import "./normative-precedence-sequential-authorization-controls.mjs";

import {
  authorizationCoversDelta,
  evaluateAuthorizationSet,
  loadAuthorizationIndex,
  protectedRegistryDiagnostics,
} from "../../scripts/normative-precedence/authorization-discovery.mjs";
import {
  validateFoldAuthorization,
  validateFoldPinLifecycle,
  validateFoldPreview,
  validateFoldReviewBinding,
  validatePostReviewObjects,
} from "../../scripts/normative-precedence/fold-validation.mjs";
import {
  inspectRepository,
  transitionAllowed,
} from "../../scripts/normative-precedence/model.mjs";
import {
  chooseCurrentPinSet,
  evidenceMismatchDiagnostics,
  selectCurrentPinSet,
  validateApplicabilityEvidence,
  validateDebtContinuity,
  validateOverlapFreshness,
  validatePinHistory,
} from "../../scripts/normative-precedence/pin-sets.mjs";
import { debtAllowedAtStage } from "../../scripts/normative-precedence/source-classification.mjs";
import { gitObject, gitObjectAt, gitStdout } from "../../scripts/normative-precedence/shared.mjs";
import {
  checkHiddenImplementation,
  checkOpenSpecAssociation,
  classifyPath,
  requiresOpenSpecAssociation,
} from "../../scripts/design-pattern-governance/perimeter.mjs";
import {
  evaluateMutationSummary,
  loadMutationManifest,
  preflightMutationAnchors,
  sha256Bytes,
} from "../../scripts/normative-precedence/mutation-assurance.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, "../../..");
const changeDir = resolve(root, "openspec/changes/define-normative-precedence-lifecycle");
const policy = JSON.parse(readFileSync(resolve(root, "openspec/governance/normative-source-precedence.json"), "utf8"));
const designPolicy = JSON.parse(readFileSync(resolve(root, "openspec/governance/design-pattern-policy.json"), "utf8"));
const base = "49ab0c255a41cc99328ff2cd5d442ffbc80b1bb1";

function codes(diagnostics) {
  return diagnostics.map((entry) => entry.code);
}

function auth(operation, status = "CURRENT", id = `${operation.toLowerCase()}-auth`) {
  return { id, operation, status, diagnostics: [] };
}

function run(rootDir, args) {
  const result = spawnSync(args[0], args.slice(1), { cwd: rootDir, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function withPinHistory(callback) {
  const repo = mkdtempSync(resolve(tmpdir(), "bloodtrail-pin-history-"));
  try {
    run(repo, ["git", "init", "-q", "-b", "main"]);
    run(repo, ["git", "config", "user.name", "Fixture"]);
    run(repo, ["git", "config", "user.email", "fixture@example.invalid"]);
    const path = "openspec/governance/normative-precedence-pins/legacy.json";
    mkdirSync(dirname(resolve(repo, path)), { recursive: true });
    writeFileSync(resolve(repo, path), "{\"id\":\"legacy\"}\n");
    run(repo, ["git", "add", "-A"]);
    run(repo, ["git", "commit", "-q", "-m", "baseline"]);
    const baseline = run(repo, ["git", "rev-parse", "HEAD"]);
    callback({ repo, path, baseline, pinSets: [{ path }] });
  } finally {
    rmSync(repo, { recursive: true, force: true });
  }
}

test("R3-T001 legacy authorization index preserves exact historical identities", () => {
  const index = loadAuthorizationIndex(changeDir, root, policy);
  assert.deepEqual(index.diagnostics, []);
  assert.equal(index.value.records.length, 6);
  for (const record of index.value.records) {
    assert.equal(gitObject(root, record.path), record.object);
    assert.equal(gitStdout(root, ["log", "-1", "--format=%H", "HEAD", "--", record.path]), record.introducing_commit);
  }
});

test("R3-T002 two changes can carry independent current authorization chains", () => {
  for (const changeId of ["change-a", "change-b"]) {
    const result = evaluateAuthorizationSet([auth("IMPLEMENT", "CURRENT", `${changeId}-auth`)], "IMPLEMENT", policy, { changeId });
    assert.equal(result.current.id, `${changeId}-auth`);
    assert.deepEqual(result.diagnostics, []);
  }
});

test("R3-T003 zero current authorization fails closed", () => {
  assert.ok(codes(evaluateAuthorizationSet([], "IMPLEMENT", policy).diagnostics).includes("authorization-current-missing"));
});

test("R3-T004 conflicting current authorization records fail closed", () => {
  assert.ok(codes(evaluateAuthorizationSet([auth("IMPLEMENT"), auth("IMPLEMENT", "CURRENT", "second")], "IMPLEMENT", policy).diagnostics).includes("authorization-current-conflict"));
});

test("R3-T005 revoked authorization cannot grant current scope", () => {
  assert.ok(codes(evaluateAuthorizationSet([auth("IMPLEMENT", "REVOKED")], "IMPLEMENT", policy).diagnostics).includes("authorization-inactive"));
});

test("R3-T006 archive-only authorization cannot grant current scope", () => {
  assert.ok(codes(evaluateAuthorizationSet([auth("IMPLEMENT")], "IMPLEMENT", policy, { archived: true }).diagnostics).includes("authorization-archive-only"));
});

test("R3-T007 candidate signer enrollment cannot validate its own authorization", () => {
  assert.ok(codes(protectedRegistryDiagnostics("a".repeat(40), "b".repeat(40))).includes("authorization-self-enrolled-signer"));
});

test("R3-T008 VERIFIED may re-enter APPLY_AUTHORIZED only through the governed revision edge", () => {
  assert.equal(transitionAllowed(policy.change_record_lifecycle, "VERIFIED", "APPLY_AUTHORIZED"), true);
});

test("R3-T009 changed delta object is outside its exact authorization", () => {
  assert.equal(authorizationCoversDelta({ authorized_capabilities: ["cap"], authorized_delta_objects: { cap: "a".repeat(40) } }, "cap", "b".repeat(40)), false);
});

test("R3-T010 deterministic fold preview matches canonical target", () => {
  const target = policy.capabilities[0].path;
  assert.deepEqual(validateFoldPreview(root, { targets: [{ capability_id: "cap", target_path: target, preview_object: gitObject(root, target) }] }), []);
});

test("R3-T011 fold preview mismatch fails", () => {
  const target = policy.capabilities[0].path;
  assert.ok(codes(validateFoldPreview(root, { targets: [{ capability_id: "cap", target_path: target, preview_object: "0".repeat(40) }] })).includes("fold-preview-mismatch"));
});

test("R3-T012 merge authority does not imply fold authority", () => {
  assert.ok(codes(validateFoldAuthorization({ operation: "MERGE", grant: policy.governance_authorities.merge_grant, withheld: ["ACTIVATE"], id: "merge" }, policy)).includes("fold-authorization-invalid"));
});

test("R3-T013 fold authority does not imply activation authority", () => {
  const fold = { ...auth("FOLD"), grant: policy.governance_authorities.fold_grant };
  assert.ok(codes(evaluateAuthorizationSet([fold], "ACTIVATE", policy).diagnostics).includes("authorization-current-missing"));
});

test("R3-T014 new pin creation leaves historical pin bytes unchanged", () => withPinHistory(({ repo, baseline, pinSets }) => {
  assert.deepEqual(validatePinHistory(repo, baseline, pinSets), []);
}));

test("R3-T015 edited historical pin fails", () => withPinHistory(({ repo, path, baseline, pinSets }) => {
  writeFileSync(resolve(repo, path), "{\"id\":\"mutated\"}\n");
  assert.ok(codes(validatePinHistory(repo, baseline, pinSets)).includes("pin-set-history-mutated"));
}));

test("R3-T016 no matching current pin fails", () => {
  assert.ok(codes(chooseCurrentPinSet([], "digest").diagnostics).includes("fold-pin-set-missing"));
});

test("R3-T017 two matching current pins fail", () => {
  const pins = ["a", "b"].map((id) => ({ path: id, value: { status: "CURRENT", capability_state_digest: "digest" } }));
  assert.ok(codes(chooseCurrentPinSet(pins, "digest").diagnostics).includes("fold-pin-set-ambiguous"));
});

test("R3-T018 pinned applicability must equal independent recomputation", () => {
  const selection = selectCurrentPinSet(root, policy, { baseCommit: base });
  const mutant = structuredClone(selection.selected.value);
  mutant.applicability.pop();
  mutant.debts = [];
  const mismatches = codes(evidenceMismatchDiagnostics(mutant, selection.expected, selection.selected.path));
  assert.ok(mismatches.includes("fold-applicability-mismatch"));
  assert.ok(mismatches.includes("debt-recomputation-mismatch"));
});

test("R3-T019 ambiguous applicability fails", () => {
  const applicability = [{ domain: "delivery", owners: ["a"], source_sections: ["catalog"] }, { domain: "delivery", owners: ["b"], source_sections: ["catalog"] }];
  assert.ok(codes(validateApplicabilityEvidence(policy, applicability)).includes("fold-applicability-ambiguous"));
  assert.ok(codes(validateFoldPinLifecycle(
    { id: "verified-pin", created_for: { lifecycle_state: "VERIFIED", fold_executed: false } },
    { change_record: { current_state: "FOLDED" } },
  )).includes("fold-pin-set-stale"));
});

test("R3-T020 stale overlap owner object fails", () => {
  const selection = selectCurrentPinSet(root, policy, { baseCommit: base });
  const state = structuredClone(selection.selected.value.repository_state);
  state.capabilities.find((entry) => entry.id === "security-audit-event-contract").object = "0".repeat(40);
  assert.ok(codes(validateOverlapFreshness(selection.selected.value.overlaps, state)).includes("capability-overlap-classification-stale"));
});

test("R3-T021 persisting contract-version debt remains fold-visible and activation-blocking", () => {
  const debt = selectCurrentPinSet(root, policy, { baseCommit: base }).selected.value.debts[0];
  assert.equal(debtAllowedAtStage(debt, "fold", []), true);
  assert.equal(debtAllowedAtStage(debt, "activation", []), false);
});

test("R3-T022 contract-version debt cannot disappear through object churn", () => {
  const selected = { path: "current", value: { debts: [] } };
  const historical = { path: "historical", value: { id: "legacy", debts: [{ id: "candidate-a-current-capability-version-drift" }] } };
  assert.ok(codes(validateDebtContinuity(selected, [historical, selected])).includes("contract-version-boundary-violation"));
});

test("R3-T023 actually resolved non-version debt may leave current pins while history remains", () => {
  const selected = { path: "current", value: { debts: [] } };
  const historical = { path: "historical", value: { id: "legacy", debts: [{ id: "resolved-other-debt" }] } };
  assert.deepEqual(validateDebtContinuity(selected, [historical, selected]), []);
});

test("R3-T024 new conflict cannot masquerade as inherited debt", () => {
  const selected = { path: "current", value: { debts: [{ id: "new", lineage: ["legacy:new"] }] } };
  assert.ok(codes(validateDebtContinuity(selected, [selected])).includes("baseline-conflict-not-inherited"));
});

test("R3-T025 fold review must bind the current pin object", () => {
  const preview = { targets: [{ target_path: policy.capabilities[0].path }] };
  const diagnostics = validateFoldReviewBinding(policy, preview, "pins/current.json", { governed_path_objects: {} });
  assert.ok(diagnostics.some((entry) => entry.code === "review-binding-incomplete" && entry.path === "pins/current.json"));
});

test("R3-T026 post-review folded capability mutation invalidates review", () => {
  const path = policy.capabilities[0].path;
  assert.ok(codes(validatePostReviewObjects(root, { governed_path_objects: { [path]: "0".repeat(40) } })).includes("review-binding-post-review-change"));
});

test("R3-T027 most-specific governance record path is record-only", () => {
  assert.equal(classifyPath("openspec/governance/records/example.json", designPolicy), "governance_record_only");
  assert.equal(requiresOpenSpecAssociation("openspec/governance/records/example.json", designPolicy), false);
});

test("R3-T028 sibling governance policy is not exempted as record-only", () => {
  assert.equal(classifyPath("openspec/governance/example-policy.json", designPolicy), "governance_core");
  assert.equal(requiresOpenSpecAssociation("openspec/governance/example-policy.json", designPolicy), true);
});

test("R3-T029 record-only path containing exported behavior fails hidden-implementation validation", () => {
  const repo = mkdtempSync(resolve(tmpdir(), "bloodtrail-hidden-implementation-"));
  try {
    run(repo, ["git", "init", "-q", "-b", "main"]);
    run(repo, ["git", "config", "user.name", "Fixture"]);
    run(repo, ["git", "config", "user.email", "fixture@example.invalid"]);
    const path = "openspec/governance/records/behavior.mjs";
    mkdirSync(dirname(resolve(repo, path)), { recursive: true });
    writeFileSync(resolve(repo, path), "// record\n");
    run(repo, ["git", "add", "-A"]); run(repo, ["git", "commit", "-q", "-m", "base"]);
    const baseline = run(repo, ["git", "rev-parse", "HEAD"]);
    writeFileSync(resolve(repo, path), "export function hidden() {}\n");
    run(repo, ["git", "add", "-A"]); run(repo, ["git", "commit", "-q", "-m", "hidden behavior"]);
    const head = run(repo, ["git", "rev-parse", "HEAD"]);
    const failures = [];
    checkHiddenImplementation({ paths: [path], byClass: new Map([["governance_record_only", [path]]]), base: baseline, head, cwd: repo, sink: { fail: (...args) => failures.push(args) } });
    assert.equal(failures[0]?.[0], "hidden-implementation");
  } finally { rmSync(repo, { recursive: true, force: true }); }
});

test("R3-T030 mixed commit leaves unrelated governance-core path unowned", () => {
  const failures = [];
  checkOpenSpecAssociation(["openspec/governance/example-policy.json"], [], { fail: (...args) => failures.push(args) });
  assert.equal(failures[0]?.[0], "openspec-association-absent");
});

test("R3-T031 mutation preflight resolves exactly 22 live anchors", () => {
  const manifest = loadMutationManifest(root, "openspec/tests/design-pattern-governance/fixtures/normative-precedence/revision-3-mutants.json");
  assert.equal(manifest.mutants.length, 22);
  assert.deepEqual(preflightMutationAnchors(root, manifest), []);
});

test("R3-T032 missing mutation anchor fails preflight", () => {
  const manifest = { mutants: [{ id: "missing", target_path: "openspec/scripts/normative-precedence/pin-sets.mjs", anchor: "definitely absent mutation anchor" }] };
  assert.ok(codes(preflightMutationAnchors(root, manifest)).includes("mutation-anchor-missing"));
  const ambiguous = { mutants: [{ id: "ambiguous", target_path: "openspec/scripts/normative-precedence/pin-sets.mjs", anchor: "export function" }] };
  assert.ok(codes(preflightMutationAnchors(root, ambiguous)).includes("mutation-anchor-ambiguous"));
});

test("R3-T033 NOT_APPLIED fails mutation assurance before kill-rate interpretation", () => {
  assert.ok(codes(evaluateMutationSummary({ expected: 22, applied: 21, not_applied: 1, survived: 0, dirty_controls: 0, restoration_mismatches: 0 })).includes("mutation-not-applied"));
});

test("R3-T034 null controls and byte-identical restoration are accepted", () => {
  const original = Buffer.from("original");
  const restored = Buffer.from(original);
  assert.equal(sha256Bytes(original), sha256Bytes(restored));
  assert.deepEqual(evaluateMutationSummary({ expected: 22, applied: 22, not_applied: 0, survived: 0, dirty_controls: 0, restoration_mismatches: 0 }), []);
});

test("R3-T035 Revision 3 scope excludes contract source generated contract and SDK outputs", () => {
  const changed = new Set([
    ...(gitStdout(root, ["diff", "--name-only", base]) ?? "").split("\n").filter(Boolean),
    ...(gitStdout(root, ["ls-files", "--others", "--exclude-standard"]) ?? "").split("\n").filter(Boolean),
  ]);
  const forbidden = [...changed].filter((path) => path === policy.contract.source_path
    || policy.contract.generated_roots.some((prefix) => path.startsWith(prefix))
    || path.startsWith("packages/security-audit-sdk-core/src/generated/"));
  assert.deepEqual(forbidden, []);
});

test("R3-T036 activation without grant and dedicated evidence remains blocked", () => {
  const result = inspectRepository(root, policy, { stage: "activation", baseCommit: base });
  assert.ok(codes(result.diagnostics).includes("activation-authorization-missing"));
  assert.ok(codes(result.diagnostics).includes("activation-evidence-pending"));
});

test("R3-T037 contract-version debt remains activation-blocking after correct fold mechanics", () => {
  const result = inspectRepository(root, policy, { stage: "activation", baseCommit: base });
  assert.ok(codes(result.diagnostics).includes("baseline-conflict-stage-block"));
});

test("R3-T038 all three CB-001 deltas remain active and canonical capability blobs remain unchanged", () => {
  const result = inspectRepository(root, policy, { stage: "candidate", baseCommit: base });
  const active = result.discovered.active.filter((entry) => entry.change_id === policy.change_id);
  assert.equal(active.length, 3);
  assert.ok(active.every((entry) => entry.class === "ACTIVE_CANDIDATE_DELTA"));
  for (const entry of active) {
    const canonicalPath = `openspec/specs/${entry.capability_id}/spec.md`;
    assert.equal(gitObject(root, canonicalPath), gitObjectAt(root, base, canonicalPath));
  }
});
