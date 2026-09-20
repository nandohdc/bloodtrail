import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, relative, resolve } from "node:path";
import {
  diagnostic,
  extractRequirement,
  getJsonPointer,
  gitObject,
  gitObjectAt,
  gitPathsBetween,
  gitStdout,
  introducingCommit,
  isAncestorCommit,
  readJson,
  STAGES,
  walkDirectories
} from "./shared.mjs";
import { transitionAllowed, validatePolicy } from "./policy-validation.mjs";
import { validateActivation, validateCompatibilityTransition, validateReviewBinding } from "./binding-validation.mjs";
import { authorizationCoversDelta, discoverAuthorizations } from "./authorization-discovery.mjs";
import { inspectFold } from "./fold-validation.mjs";
import { selectCurrentPinSet } from "./pin-sets.mjs";
import {
  baselineDebtFor,
  changedPaths,
  classifySourceChanges,
  debtAllowedAtStage,
  sourceSections,
  validateSourceShape
} from "./source-classification.mjs";

export {
  assertRegularFile,
  extractRequirement,
  formatDiagnostics,
  getJsonPointer,
  gitObject,
  loadPolicy,
  POLICY_RELATIVE_PATH,
  readJson,
  STAGES
} from "./shared.mjs";
export {
  transitionAllowed,
  validateLifecycle,
  validatePolicy,
  validatePolicySchema
} from "./policy-validation.mjs";
export {
  evaluatePolicyCase,
  validateActivation,
  validateCompatibilityTransition,
  validateReviewBinding
} from "./binding-validation.mjs";
export {
  changedJsonPointers,
  classifySourceChanges
} from "./source-classification.mjs";

function activeChangeDirectories(repoRoot) {
  const changesRoot = resolve(repoRoot, "openspec/changes");
  return walkDirectories(changesRoot).filter((path) => basename(path) !== "archive");
}

function archivedChangeDirectories(repoRoot) {
  return walkDirectories(resolve(repoRoot, "openspec/changes/archive"));
}

function discoverDeltaSpecs(changeDir, repoRoot) {
  const specs = resolve(changeDir, "specs");
  if (!existsSync(specs)) return [];
  return walkDirectories(specs)
    .map((dir) => resolve(dir, "spec.md"))
    .filter(existsSync)
    .map((path) => ({
      capability_id: basename(dirname(path)),
      path: relative(repoRoot, path),
      object: gitObject(repoRoot, relative(repoRoot, path))
    }));
}

function tableValue(markdown, label) {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return markdown.match(new RegExp(`\\| ${escaped} \\| ([^\\n|]+) \\|`))?.[1].trim() ?? null;
}

function fencedPaths(markdown, heading) {
  const start = markdown.indexOf(`${heading}\n`);
  if (start < 0) return [];
  const afterHeading = markdown.slice(start + heading.length);
  const block = afterHeading.match(/```text\n([\s\S]*?)\n```/);
  return block ? block[1].split("\n").map((entry) => entry.trim()).filter(Boolean) : [];
}

function proposalCapabilities(markdown) {
  const section = markdown.match(/### Modified Capabilities\n([\s\S]*?)(?:\n## |$)/)?.[1] ?? "";
  return [...section.matchAll(/^- `([^`]+)`:/gm)].map((match) => match[1]);
}

function codeValues(value) {
  if (!value) return [];
  return [...value.matchAll(/`([^`]+)`/g)].map((match) => match[1]).filter((entry) => entry !== "none");
}

/**
 * Parses and verifies an exact apply authorization for one change directory.
 * Returns null when the change carries no authorization or proposal; otherwise
 * every generic binding failure is listed in `diagnostics`.
 */
function parseApplyAuthorization(text) {
  const objectId = (label) => tableValue(text, label)?.match(/`([0-9a-f]{40})`/)?.[1] ?? null;
  return {
    proposal_commit: objectId("Authorized proposal commit"),
    proposal_tree: objectId("Repository tree"),
    change_subtree: objectId("Change subtree object"),
    candidate_base: objectId("Candidate A base"),
    authorizing_party: tableValue(text, "Authorizing party"),
    granted: tableValue(text, "Granted"),
    withheld: tableValue(text, "Withheld"),
    capabilities: codeValues(tableValue(text, "Authorized capabilities")),
    semantic_dimensions: codeValues(tableValue(text, "Authorized semantic dimensions")),
    source_pointers: codeValues(tableValue(text, "Authorized source pointers")),
    paths: fencedPaths(text, "## Changed-path allowlist"),
    diagnostics: []
  };
}

function bindsExactProposalObjects(authorization) {
  return ["proposal_commit", "proposal_tree", "change_subtree"].every((field) => Boolean(authorization[field]));
}

function authorizationIdentityProblems(authorization) {
  if (bindsExactProposalObjects(authorization)) return [];
  return ["apply authorization lacks exact proposal commit, tree, or subtree"];
}

function authorizationObjectProblems(authorization, repoRoot, changePath) {
  const problems = [];
  const commit = authorization.proposal_commit;
  if (commit && gitStdout(repoRoot, ["rev-parse", `${commit}^{tree}`]) !== authorization.proposal_tree) problems.push("authorized proposal tree does not match commit");
  if (commit && gitStdout(repoRoot, ["rev-parse", `${commit}:${changePath}`]) !== authorization.change_subtree) problems.push("authorized change subtree does not match proposal commit");
  return problems;
}

function authorizationAncestryProblems(authorization, repoRoot) {
  const commit = authorization.proposal_commit;
  if (!commit) return [];
  const problems = [];
  if (!isAncestorCommit(repoRoot, commit, "HEAD")) problems.push("authorized proposal is not an ancestor of HEAD");
  const base = authorization.candidate_base;
  if (base && !isAncestorCommit(repoRoot, base, commit)) problems.push("authorized candidate base is not an ancestor of the proposal commit");
  return problems;
}

function exactAuthorizationProblems(authorization, repoRoot, changePath) {
  return [
    ...authorizationIdentityProblems(authorization),
    ...authorizationObjectProblems(authorization, repoRoot, changePath),
    ...authorizationAncestryProblems(authorization, repoRoot)
  ];
}

function authorizationScopeProblems(authorization, policy) {
  const problems = [];
  if (authorization.authorizing_party !== `${policy.governance_authorities.apply_authority_identity}, project owner`) problems.push("apply authority identity is not the governed project owner");
  if (!authorization.granted?.toLowerCase().includes("implement") || !authorization.withheld?.toLowerCase().includes("activation")) problems.push("apply grant/withheld scope is incomplete");
  if (authorization.paths.length === 0) problems.push("apply authorization has no bounded path allowlist");
  if (!authorization.candidate_base) problems.push("apply authorization lacks an exact candidate base");
  return problems;
}

export function readApplyAuthorization(changeDir, repoRoot, policy, { changePath = relative(repoRoot, changeDir), verifyRecord = true } = {}) {
  const authorizationPath = resolve(changeDir, policy.repository_evidence.apply_authorization_file);
  if (!existsSync(authorizationPath) || !existsSync(resolve(changeDir, "proposal.md"))) return null;
  const authorization = parseApplyAuthorization(readFileSync(authorizationPath, "utf8"));
  authorization.diagnostics.push(...exactAuthorizationProblems(authorization, repoRoot, changePath));
  authorization.diagnostics.push(...authorizationScopeProblems(authorization, policy));
  // An archived authorization was relocated by the archive commit, so its
  // recording provenance is judged only while the change is active.
  if (verifyRecord) authorization.diagnostics.push(...authorizationRecordProblems(repoRoot, relative(repoRoot, authorizationPath)));
  return authorization;
}

/**
 * The authorization's scope is its content, so that content must be the bytes
 * first recorded by a commit that changed nothing else, and never edited since.
 */
function authorizationRecordProblems(repoRoot, path) {
  const introduced = introducingCommit(repoRoot, path);
  if (introduced === null || gitObject(repoRoot, path) !== gitObjectAt(repoRoot, "HEAD", path)) {
    return ["apply authorization is not committed"];
  }
  const problems = [];
  if (gitObjectAt(repoRoot, `${introduced}^`, path) !== null) problems.push("apply authorization was modified after it was first recorded");
  const parentLine = gitStdout(repoRoot, ["show", "-s", "--format=%P", introduced]);
  const parents = parentLine ? parentLine.split(" ").filter(Boolean) : [];
  const changed = parents.length === 1 ? gitPathsBetween(repoRoot, parents[0], introduced) : null;
  if (!changed || changed.some((entry) => entry !== path)) problems.push("apply authorization was not recorded in a dedicated commit");
  return problems;
}

function emptyActiveDeltaEvidence() {
  return {
    authorized: false,
    lifecycle_state: "PROPOSED",
    authorized_paths: [],
    authorized_capabilities: [],
    authorized_semantic_dimensions: [],
    authorized_source_pointers: [],
    diagnostics: []
  };
}

function activeDeltaProblems(changeDir, capabilityId, repoRoot, authorization) {
  const problems = [];
  const commit = authorization.authorized_proposal_commit;
  const proposalPath = relative(repoRoot, resolve(changeDir, "proposal.md"));
  const proposalAtCommit = commit ? gitStdout(repoRoot, ["show", `${commit}:${proposalPath}`]) : null;
  if (!proposalAtCommit || !proposalCapabilities(proposalAtCommit).includes(capabilityId)) problems.push("capability is not in the structured proposal scope");
  const deltaPath = relative(repoRoot, resolve(changeDir, "specs", capabilityId, "spec.md"));
  const deltaObject = gitObject(repoRoot, deltaPath);
  if (!authorizationCoversDelta(authorization, capabilityId, deltaObject)) {
    problems.push("active delta differs from the exact operation-authorized object");
  }
  return problems;
}

function activeDeltaEvidence(changeDir, capabilityId, { repoRoot, policy, baseCommit }) {
  const evidence = emptyActiveDeltaEvidence();
  const discovered = discoverAuthorizations(changeDir, repoRoot, policy, { operation: "IMPLEMENT", baseCommit });
  const authorization = discovered.current;
  evidence.diagnostics.push(...discovered.diagnostics.map((entry) => `${entry.code}: ${entry.message}`));
  if (authorization === null) return evidence;
  evidence.authorized_capabilities = authorization.authorized_capabilities ?? [];
  evidence.authorized_semantic_dimensions = authorization.authorized_semantic_dimensions ?? [];
  evidence.authorized_source_pointers = authorization.authorized_source_pointers ?? [];
  evidence.authorized_paths = authorization.scope_paths ?? [];
  evidence.diagnostics.push(...activeDeltaProblems(changeDir, capabilityId, repoRoot, authorization));
  evidence.authorized = evidence.diagnostics.length === 0;
  evidence.lifecycle_state = evidence.authorized ? "APPLY_AUTHORIZED" : "PROPOSED";
  evidence.proposal_commit = authorization.authorized_proposal_commit;
  evidence.proposal_tree = authorization.authorized_proposal_tree;
  evidence.change_subtree = authorization.authorized_change_subtree;
  return evidence;
}

function versionApplies(version, declared) {
  return declared.includes("*") || declared.includes(version);
}

export function discoverRepositorySources(repoRoot, policy, { sourcePath = policy.contract?.source_path, contractVersion = null, baseCommit = null } = {}) {
  const current = (policy.capabilities ?? []).map((capability) => ({
    ...capability,
    exists: existsSync(resolve(repoRoot, capability.path)),
    object: gitObject(repoRoot, capability.path),
    applies: capability.path_prefixes.some((prefix) => pathMatchesPrefix(sourcePath, prefix))
      && (contractVersion === null || versionApplies(contractVersion, capability.versions))
  }));
  const active = activeChangeDirectories(repoRoot).flatMap((changeDir) =>
    discoverDeltaSpecs(changeDir, repoRoot).map((delta) => {
      const evidence = activeDeltaEvidence(changeDir, delta.capability_id, { repoRoot, policy, baseCommit });
      return {
        ...delta,
        ...evidence,
        change_id: basename(changeDir),
        class: evidence.authorized ? "ACTIVE_CANDIDATE_DELTA" : "PROPOSED_CANDIDATE_DELTA"
      };
    })
  );
  const archived = archivedChangeDirectories(repoRoot).flatMap((changeDir) =>
    discoverDeltaSpecs(changeDir, repoRoot).map((delta) => ({
      ...delta,
      change_id: basename(changeDir),
      class: "ARCHIVED_CHANGE_RECORD"
    }))
  );
  return { current, active, archived };
}

function pathMatchesPrefix(path, prefix) {
  return path === prefix || (prefix.endsWith("/") && path.startsWith(prefix));
}

function jsonAtCommit(repoRoot, commit, path) {
  const content = gitStdout(repoRoot, ["show", `${commit}:${path}`]);
  if (content === null) return null;
  try {
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function authorizedPathMatches(path, declared) {
  if (declared.endsWith("/**")) return path === declared.slice(0, -3) || path.startsWith(declared.slice(0, -2));
  return pathMatchesPrefix(path, declared);
}

/**
 * The paths owned by the governed change while it is active: its change
 * directory, its exact apply-authorized allowlist, the current capability
 * specifications its deltas fold into, and its review and activation records.
 */
function normalizedAuthorization(record, diagnostics = []) {
  if (!record) return null;
  return {
    candidate_base: record.authorized_base_commit,
    proposal_commit: record.authorized_proposal_commit,
    proposal_tree: record.authorized_proposal_tree,
    change_subtree: record.authorized_change_subtree,
    paths: record.scope_paths ?? [],
    diagnostics
  };
}

function scopeAuthorization(repoRoot, policy, { evidenceRoot, active, baseCommit }) {
  if (!evidenceRoot) return { discovered: { current: null, diagnostics: [] }, authorization: normalizedAuthorization(null, []) };
  const discovered = discoverAuthorizations(resolve(repoRoot, evidenceRoot), repoRoot, policy, { operation: "IMPLEMENT", baseCommit });
  if (active) return { discovered, authorization: normalizedAuthorization(discovered.current, discovered.diagnostics) };
  const historical = (discovered.records ?? []).find((record) => record.operation === "IMPLEMENT" && record.status === "CURRENT");
  return { discovered, authorization: normalizedAuthorization(discovered.current ?? historical, []) };
}

function scopeFoldTargets(repoRoot, evidenceRoot) {
  if (!evidenceRoot) return [];
  return discoverDeltaSpecs(resolve(repoRoot, evidenceRoot), repoRoot)
    .map((delta) => `openspec/specs/${delta.capability_id}/spec.md`);
}

function governedChangeScope(repoRoot, policy, baseCommit) {
  const evidence = policy.repository_evidence;
  const changeRoot = `${evidence.active_changes_root}/${policy.change_id}`;
  const archivedRoot = archivedChangeRoot(repoRoot, policy);
  const active = existsSync(resolve(repoRoot, changeRoot));
  const evidenceRoot = active ? changeRoot : archivedRoot;
  const { discovered: discoveredAuthorization, authorization } = scopeAuthorization(repoRoot, policy, { evidenceRoot, active, baseCommit });
  const foldTargets = scopeFoldTargets(repoRoot, evidenceRoot);
  const recordPaths = [evidence.review_record_path, evidence.activation_record_path];
  return {
    active,
    changeRoot,
    archivedRoot,
    evidenceRoot,
    authorization,
    authorizationDiscovery: discoveredAuthorization,
    recordPaths,
    patterns: [`${changeRoot}/**`, ...(authorization?.paths ?? []), ...foldTargets, ...recordPaths]
  };
}

/** The single dated archive directory of the governed change, or null when there is none or more than one. */
function archivedChangeRoot(repoRoot, policy) {
  const archiveRoot = policy.repository_evidence.archive_root;
  const matches = walkDirectories(resolve(repoRoot, archiveRoot))
    .map((path) => basename(path))
    .filter((name) => name === `${name.slice(0, 11)}${policy.change_id}` && /^\d{4}-\d{2}-\d{2}-$/.test(name.slice(0, 11)));
  return matches.length === 1 ? `${archiveRoot}/${matches[0]}` : null;
}

/**
 * A path only this change owns: its change or archive directory, its records,
 * or an in-scope path that did not exist at the authorized candidate base.
 * Shared files the change also edits (CI, glossary, fold targets) do not place
 * an unrelated range inside the change's scope.
 */
function changeExclusivePath(repoRoot, path, scope) {
  if (authorizedPathMatches(path, `${scope.changeRoot}/**`) || scope.recordPaths.includes(path)) return true;
  if (scope.archivedRoot && authorizedPathMatches(path, `${scope.archivedRoot}/**`)) return true;
  const base = scope.authorization?.candidate_base;
  return Boolean(base) && inGovernedScope(path, scope) && gitObjectAt(repoRoot, base, path) === null;
}

function isRelocatedByArchive(path, scope) {
  if (scope.active) return false;
  if (!scope.archivedRoot) return false;
  return path.startsWith(`${scope.changeRoot}/`);
}

/** Maps an active change path to its archived location while the change is being archived. */
function relocatedPath(path, scope) {
  if (!isRelocatedByArchive(path, scope)) return path;
  return `${scope.archivedRoot}${path.slice(scope.changeRoot.length)}`;
}

/** The activated merge must contain the reviewed commit and objects and be reachable from the protected reference. */
function activatedContentDiagnostics({ repoRoot, policy, path, mergeCommit, review }) {
  if (!mergeCommit || !review) return [];
  const diagnostics = [];
  const technical = review.binding.technical_commit;
  if (typeof technical !== "string" || !isAncestorCommit(repoRoot, technical, mergeCommit)) {
    diagnostics.push(diagnostic("activation-merge-lacks-reviewed-commit", path, "the activated merge does not contain the reviewed technical commit"));
  }
  for (const [boundPath, boundObject] of Object.entries(review.expectedObjects)) {
    if (gitObjectAt(repoRoot, mergeCommit, boundPath) !== boundObject) {
      diagnostics.push(diagnostic("activation-merge-content-mismatch", boundPath, "the activated merge does not carry the reviewed object"));
    }
  }
  const protectedReference = policy.repository_evidence.protected_reference;
  const remoteReference = protectedReference.replace(/^refs\/heads\//, "refs/remotes/origin/");
  const reachable = [protectedReference, remoteReference].some((reference) =>
    gitStdout(repoRoot, ["rev-parse", "--verify", "--quiet", reference]) !== null
    && isAncestorCommit(repoRoot, mergeCommit, reference));
  if (!reachable) {
    diagnostics.push(diagnostic("activation-protected-reference-unreachable", path, `the activated merge is not reachable from ${protectedReference}`));
  }
  return diagnostics;
}

function inGovernedScope(path, scope) {
  return scope.patterns.some((pattern) => authorizedPathMatches(path, pattern));
}

function isResolveDebtPath(path) {
  return path.startsWith("openspec/governance/normative-precedence-pins/");
}

function applyScopeDiagnostics(changes, scope) {
  if (scope.authorization === null) {
    return [
      ...(scope.authorizationDiscovery?.diagnostics ?? []),
      diagnostic("apply-scope-unauthorized", scope.changeRoot, "the range changes an active governed change that has no apply authorization")
    ];
  }
  return [
    ...scope.authorization.diagnostics.map((message) => diagnostic("apply-authorization-invalid", scope.changeRoot, message)),
    ...changes
      .filter((path) => !isResolveDebtPath(path) && !inGovernedScope(path, scope))
      .map((path) => diagnostic("apply-scope-exceeded", path, "changed path is outside the exact apply-authorized scope"))
  ];
}

function validateEvidenceTransitions(field, lifecycle, declared) {
  const diagnostics = [];
  let previous = null;
  for (const [index, transition] of declared.transitions.entries()) {
    const path = `lifecycle.${field}.transitions[${index}]`;
    if (previous !== null && transition.from !== previous) {
      diagnostics.push(diagnostic("lifecycle-evidence-sequence-gap", path, "transition does not continue the declared sequence"));
    }
    if (!transitionAllowed(lifecycle, transition.from, transition.to)) {
      diagnostics.push(diagnostic("lifecycle-transition-illegal", path, `${transition.from}->${transition.to}`));
    }
    if (!Array.isArray(transition.evidence_paths) || transition.evidence_paths.length === 0) {
      diagnostics.push(diagnostic("lifecycle-transition-evidence-missing", path, "repository evidence paths are required"));
    }
    previous = transition.to;
  }
  return { diagnostics, previous };
}

function isNotApplicableCandidate(field, declared) {
  return field === "contract_candidate" && declared?.applicability === "NOT_APPLICABLE";
}

function validateNotApplicableCandidate(declared, path) {
  const valid = typeof declared.reason === "string"
    && declared.reason.length > 0
    && !("current_state" in declared)
    && !("transitions" in declared);
  return valid ? [] : [diagnostic("lifecycle-evidence-shape-invalid", path, "a not-applicable contract candidate carries only its reason")];
}

function lifecycleEvidenceShapeValid(lifecycle, declared) {
  return Boolean(declared)
    && lifecycle.states.includes(declared.current_state)
    && Array.isArray(declared.transitions);
}

function validateInitialLifecycleEvidence(declared, initial, path) {
  const diagnostics = [];
  if (declared.transitions.length === 0 && declared.current_state !== initial) {
    diagnostics.push(diagnostic("lifecycle-evidence-initial-state-missing", path, `${declared.current_state} requires evidenced transitions from ${initial}`));
  }
  if (declared.transitions.length > 0 && declared.transitions[0]?.from !== initial) {
    diagnostics.push(diagnostic("lifecycle-evidence-initial-state-missing", `${path}.transitions[0]`, `transition evidence must start at ${initial}`));
  }
  return diagnostics;
}

function validateFinalLifecycleState(transitions, declared, path) {
  if (transitions.previous === null || transitions.previous === declared.current_state) return [];
  return [diagnostic("lifecycle-current-state-mismatch", `${path}.current_state`, "current state does not equal the final evidenced transition")];
}

function validateLifecycleMachine(field, lifecycle, declared) {
  const path = `lifecycle.${field}`;
  if (isNotApplicableCandidate(field, declared)) return validateNotApplicableCandidate(declared, path);
  if (!lifecycleEvidenceShapeValid(lifecycle, declared)) {
    return [diagnostic("lifecycle-evidence-shape-invalid", path, "current state and transition evidence are required")];
  }
  const diagnostics = validateInitialLifecycleEvidence(declared, lifecycle.states[0], path);
  const transitions = validateEvidenceTransitions(field, lifecycle, declared);
  diagnostics.push(...transitions.diagnostics);
  diagnostics.push(...validateFinalLifecycleState(transitions, declared, path));
  return diagnostics;
}

export function validateLifecycleEvidence(evidence, policy) {
  if (!evidence || evidence.change_id !== policy.change_id) {
    return [diagnostic("lifecycle-evidence-change-mismatch", "lifecycle.change_id", "lifecycle evidence must name the governed change")];
  }
  const diagnostics = [];
  diagnostics.push(...validateLifecycleMachine("change_record", policy.change_record_lifecycle, evidence.change_record));
  diagnostics.push(...validateLifecycleMachine("contract_candidate", policy.contract_candidate_lifecycle, evidence.contract_candidate));
  return diagnostics;
}

function lifecycleEvidencePathDiagnostics(repoRoot, evidence, scope) {
  const diagnostics = [];
  const evidencePaths = [evidence.change_record, evidence.contract_candidate]
    .flatMap((machine) => machine?.transitions ?? [])
    .flatMap((transition) => transition.evidence_paths ?? []);
  for (const evidencePath of evidencePaths) {
    if (!existsSync(resolve(repoRoot, relocatedPath(evidencePath, scope)))) {
      diagnostics.push(diagnostic("lifecycle-transition-evidence-unavailable", evidencePath, "declared transition evidence path does not exist"));
    }
  }
  return diagnostics;
}

function lifecycleStageDiagnostics(evidence, stage, path) {
  const diagnostics = [];
  const changeState = evidence.change_record?.current_state;
  if (stage === "merge" && !["VERIFIED", "FOLDED"].includes(changeState)) {
    diagnostics.push(diagnostic("lifecycle-stage-not-ready", path, "merge requires a verified or folded change record"));
  }
  if (stage === "fold" && !["VERIFIED", "FOLDED"].includes(changeState)) {
    diagnostics.push(diagnostic("lifecycle-stage-not-ready", path, "fold requires a verified change record"));
  }
  if (["activation", "release"].includes(stage) && changeState !== "FOLDED") {
    diagnostics.push(diagnostic("lifecycle-stage-not-ready", path, "activation/release requires every affected delta to be folded"));
  }
  return diagnostics;
}

function contractCandidateStageDiagnostics(candidate, stage, path) {
  if (candidate?.applicability === "NOT_APPLICABLE") return [];
  // ACTIVATED and RELEASED are evidenced by their dedicated records, not by
  // rewriting this reviewed file, so later stages still read MERGED here.
  const requiredStates = { merge: ["MERGE_READY", "MERGED"], fold: ["MERGED"], activation: ["MERGED"], release: ["MERGED"] }[stage];
  if (!requiredStates || requiredStates.includes(candidate?.current_state)) return [];
  return [diagnostic("lifecycle-stage-not-ready", `${path}#contract_candidate`, `${stage} requires a contract candidate in ${requiredStates.join(" or ")}`)];
}

function inspectLifecycleEvidence({ repoRoot, policy, stage, changes, scope, diagnostics, observations }) {
  const path = `${scope.evidenceRoot}/${policy.repository_evidence.lifecycle_evidence_file}`;
  if (!existsSync(resolve(repoRoot, path))) {
    const entry = diagnostic("lifecycle-evidence-pending", path, "repository lifecycle evidence is not yet recorded");
    if (stage === "candidate") observations.push(entry);
    else diagnostics.push(entry);
    return null;
  }
  const evidence = readJson(resolve(repoRoot, path));
  diagnostics.push(...validateLifecycleEvidence(evidence, policy));
  diagnostics.push(...lifecycleEvidencePathDiagnostics(repoRoot, evidence, scope));
  const candidate = evidence.contract_candidate;
  if (candidate?.applicability === "NOT_APPLICABLE") {
    const unproven = stage === "candidate" && changes === null;
    (unproven ? observations : diagnostics).push(...contractCandidateApplicability(policy, path, changes));
  }
  diagnostics.push(...lifecycleStageDiagnostics(evidence, stage, path));
  diagnostics.push(...contractCandidateStageDiagnostics(candidate, stage, path));
  return evidence;
}

/**
 * A change may declare the contract-candidate lifecycle not applicable only
 * when its own range changes no authored contract source or derived output.
 * `changes` is the change's range, null when no exact range exists, or false
 * when the inspected range belongs to some other change.
 */
function contractCandidateApplicability(policy, path, changes) {
  if (changes === false) return [];
  if (!Array.isArray(changes)) {
    return [diagnostic("lifecycle-applicability-unproven", `${path}#contract_candidate`, "a not-applicable contract candidate requires an exact comparison range")];
  }
  const contractPaths = [policy.contract.source_path, ...policy.contract.generated_roots];
  return changes
    .filter((entry) => contractPaths.some((prefix) => pathMatchesPrefix(entry, prefix)))
    .map((entry) => diagnostic("lifecycle-contract-candidate-required", entry, "the range changes contract source or derived output, so the contract-candidate lifecycle applies"));
}

function buildReviewExpectation({ repoRoot, policy, binding, scope, diagnostics, path }) {
  const technicalCommit = binding.technical_commit;
  const reviewBase = reviewComparisonBase(repoRoot, binding, scope, diagnostics);
  const tree = technicalCommit ? gitStdout(repoRoot, ["rev-parse", `${technicalCommit}^{tree}`]) : null;
  const sourceAtTechnical = technicalCommit ? jsonAtCommit(repoRoot, technicalCommit, policy.contract.source_path) : null;
  // Reviewed membership derives from the review's own base, never from the
  // inspected range, so a later unrelated range cannot empty or widen it.
  const changed = reviewBase && technicalCommit ? gitPathsBetween(repoRoot, reviewBase, technicalCommit) : null;
  if (changed === null) diagnostics.push(diagnostic("review-binding-base-unavailable", path, "the review base and technical commit must resolve to prove complete reviewed membership"));
  const recordOnly = policy.repository_evidence.governance_record_only_paths;
  const governedPaths = (changed ?? []).filter((entry) => !recordOnly.includes(entry));
  const expectedObjects = Object.fromEntries(governedPaths.map((entry) => [entry, gitObjectAt(repoRoot, technicalCommit, entry)]));
  return {
    technicalCommit,
    recordOnly,
    expectedObjects,
    validation: {
      requiredFields: policy.review_binding.required_fields,
      paths: governedPaths,
      objects: expectedObjects,
      values: {
        technical_commit: technicalCommit,
        tree,
        contract_version: sourceAtTechnical ? getJsonPointer(sourceAtTechnical, policy.contract.version_pointer) : null,
        decision_scope: [policy.change_id],
        reviewer_identity: policy.governance_authorities.review_authority_identity,
        reviewer_authority: policy.governance_authorities.review_authority_role
      }
    }
  };
}

function isFreshnessGoverned(changed, { scope, recordOnly, expectedObjects }) {
  if (recordOnly.includes(changed)) return false;
  return inGovernedScope(changed, scope) || Object.hasOwn(expectedObjects, changed);
}

function reviewFreshnessDiagnostics(context) {
  const { repoRoot, rangeChanges, scope, expectedObjects } = context;
  const diagnostics = [];
  // Freshness is judged over the change's own inspected range: every path that
  // range changes inside the governed scope or reviewed set must still carry its
  // reviewed object (after any archive relocation). Base-side and unrelated
  // protected-history commits are outside that range and cannot stale the review.
  for (const changed of rangeChanges ?? []) {
    if (!isFreshnessGoverned(changed, context)) continue;
    if (gitObjectAt(repoRoot, "HEAD", relocatedPath(changed, scope)) !== expectedObjects[changed]) {
      diagnostics.push(diagnostic("review-binding-post-review-change", changed, "the range changes a governed path away from its reviewed object"));
    }
  }
  return diagnostics;
}

function reviewIdentityDiagnostics(policy, path, binding) {
  if (binding.change_id === policy.change_id && binding.signed === true) return [];
  return [diagnostic("review-binding-authority-invalid", path, "review must be a signed decision for this exact change")];
}

function requiredReviewGrant(policy, stage) {
  if (stage === "merge") return policy.governance_authorities.merge_grant;
  if (["activation", "release"].includes(stage)) return policy.governance_authorities.activation_grant;
  return null;
}

function reviewGrantDiagnostics(policy, stage, path, binding) {
  const requiredGrant = requiredReviewGrant(policy, stage);
  if (!requiredGrant || binding.authorization_granted?.includes(requiredGrant)) return [];
  return [diagnostic("review-binding-authorization-missing", path, `review does not grant ${requiredGrant}`)];
}

function reviewReachabilityDiagnostics(repoRoot, path, technicalCommit) {
  if (!technicalCommit || isAncestorCommit(repoRoot, technicalCommit, "HEAD")) return [];
  return [diagnostic("review-binding-commit-unreachable", path, "reviewed technical commit is not an ancestor of HEAD")];
}

function reviewAuthorityDiagnostics({ repoRoot, policy, stage, path, binding, technicalCommit }) {
  return [
    ...reviewIdentityDiagnostics(policy, path, binding),
    ...reviewGrantDiagnostics(policy, stage, path, binding),
    ...reviewReachabilityDiagnostics(repoRoot, path, technicalCommit)
  ];
}

function inspectReviewEvidence({ repoRoot, policy, stage, scope, rangeChanges, lifecycle, diagnostics, observations }) {
  const path = policy.repository_evidence.review_record_path;
  if (stage === "fold") {
    observations.push(diagnostic("review-binding-pending", path,
      "fold creates a new exact identity that requires fresh exact-content review"));
    return null;
  }
  const revisionAwaitingReview = stage === "candidate"
    && ["APPLY_AUTHORIZED", "IMPLEMENTED", "VERIFIED"].includes(lifecycle?.change_record?.current_state);
  if (revisionAwaitingReview) {
    observations.push(diagnostic("review-binding-pending", path,
      "the current bounded revision requires a fresh exact-content review; prior review evidence remains historical"));
    return null;
  }
  if (!existsSync(resolve(repoRoot, path))) {
    const entry = diagnostic("review-binding-pending", path, "exact project-owner review record is not yet stored");
    if (stage === "candidate") observations.push(entry);
    else diagnostics.push(entry);
    return null;
  }
  const binding = readJson(resolve(repoRoot, path));
  const expected = buildReviewExpectation({ repoRoot, policy, binding, scope, diagnostics, path });
  diagnostics.push(...validateReviewBinding(binding, expected.validation));
  diagnostics.push(...reviewFreshnessDiagnostics({ repoRoot, rangeChanges, scope, recordOnly: expected.recordOnly, expectedObjects: expected.expectedObjects }));
  diagnostics.push(...reviewAuthorityDiagnostics({ repoRoot, policy, stage, path, binding, technicalCommit: expected.technicalCommit }));
  return { path, binding, object: gitObject(repoRoot, path), expectedObjects: expected.expectedObjects };
}

function reviewComparisonBase(repoRoot, binding, scope, diagnostics) {
  const base = binding.base_commit;
  if (typeof base !== "string" || !/^[0-9a-f]{40}$/.test(base)) {
    diagnostics.push(diagnostic("review-binding-floating", "review.base_commit", "review must bind a full comparison-base object ID"));
    return null;
  }
  const authorizedBase = scope.authorization?.candidate_base ?? null;
  if (authorizedBase === null) {
    diagnostics.push(diagnostic("review-binding-base-unauthorized", "review.base_commit", "the review base must equal an exact apply-authorized candidate base"));
    return null;
  }
  if (base !== authorizedBase) {
    diagnostics.push(diagnostic("review-binding-value-mismatch", "review.base_commit", "review base differs from the apply-authorized candidate base"));
    return null;
  }
  if (typeof binding.technical_commit === "string" && !isAncestorCommit(repoRoot, base, binding.technical_commit)) {
    diagnostics.push(diagnostic("review-binding-base-unavailable", "review.base_commit", "review base is not an ancestor of the reviewed technical commit"));
    return null;
  }
  return base;
}

function activationRepositoryContext(repoRoot, path, diagnostics) {
  // The dedicated activation commit is located from history. HEAD may be a
  // later protected commit or a CI merge ref, neither of which is the record.
  const activationCommit = introducingCommit(repoRoot, path);
  if (activationCommit === null || gitObject(repoRoot, path) !== gitObjectAt(repoRoot, "HEAD", path)) {
    diagnostics.push(diagnostic("activation-record-uncommitted", path, "activation evidence must be committed so its dedicated commit can be located"));
  }
  const parentLine = activationCommit ? gitStdout(repoRoot, ["show", "-s", "--format=%P", activationCommit]) : null;
  const parents = parentLine ? parentLine.split(" ").filter(Boolean) : [];
  const mergeCommit = parents.length === 1 ? parents[0] : null;
  return {
    activationCommit,
    parents,
    mergeCommit,
    mergeTree: mergeCommit ? gitStdout(repoRoot, ["rev-parse", `${mergeCommit}^{tree}`]) : null,
    changed: mergeCommit ? gitPathsBetween(repoRoot, mergeCommit, activationCommit) : null
  };
}

function activationExpectedValues(policy, review, repository) {
  if (!review) return {};
  return {
    activated_commit: repository.mergeCommit,
    activated_tree: repository.mergeTree,
    reviewed_technical_commit: review.binding.technical_commit,
    reviewed_tree: review.binding.tree,
    contract_version: review.binding.contract_version,
    scope: [policy.change_id],
    protected_reference: policy.repository_evidence.protected_reference,
    effective_event: "activation-record-commit",
    parent_commit: repository.mergeCommit,
    authorization_granted: [policy.governance_authorities.activation_grant]
  };
}

function inspectActivationEvidence({ repoRoot, policy, stage, review, diagnostics, observations }) {
  const path = policy.repository_evidence.activation_record_path;
  if (!existsSync(resolve(repoRoot, path))) {
    const entry = diagnostic("activation-evidence-pending", path, "dedicated activation evidence is not yet stored");
    if (["candidate", "merge"].includes(stage)) observations.push(entry);
    else diagnostics.push(entry);
    return null;
  }
  const record = readJson(resolve(repoRoot, path));
  const repository = activationRepositoryContext(repoRoot, path, diagnostics);
  diagnostics.push(...validateActivation(record, {
    requiredFields: policy.activation.required_fields,
    authorizingDecision: review?.binding,
    requiredGrant: policy.governance_authorities.activation_grant,
    authorizingDecisionObject: review?.object,
    activationRecordObject: gitObject(repoRoot, path),
    mergeCommit: repository.mergeCommit,
    mergeTree: repository.mergeTree,
    parentCount: repository.parents.length,
    reviewedObjects: review?.binding.governed_path_objects,
    allowedRecordPaths: [path],
    changedPaths: repository.changed ?? [],
    expectedValues: activationExpectedValues(policy, review, repository)
  }));
  diagnostics.push(...activatedContentDiagnostics({ repoRoot, policy, path, mergeCommit: repository.mergeCommit, review }));
  if (record.required_check_evidence?.verified !== true) diagnostics.push(diagnostic("activation-required-check-unverified", `${path}#required_check_evidence`, "required-check enforcement must be verified"));
  return record;
}

function readContractSource(context) {
  const { repoRoot, policy, diagnostics } = context;
  const sourcePath = policy.contract?.source_path;
  const absoluteSource = resolve(repoRoot, sourcePath ?? "");
  if (!sourcePath || !existsSync(absoluteSource)) {
    diagnostics.push(diagnostic("contract-source-missing", sourcePath ?? "contract.source", "authoritative source is unavailable"));
    return null;
  }
  const source = readJson(absoluteSource);
  let contractVersion = null;
  try {
    contractVersion = getJsonPointer(source, policy.contract.version_pointer);
  } catch (error) {
    diagnostics.push(diagnostic("contract-version-unavailable", `${sourcePath}#${policy.contract.version_pointer}`, error.message));
  }
  diagnostics.push(...validateSourceShape(source, "/", policy.source_shape ?? []));
  return { sourcePath, source, contractVersion };
}

function inspectComparisonBase(context) {
  const { repoRoot, stage, baseCommit, diagnostics, observations } = context;
  const repositoryChanges = changedPaths(repoRoot, baseCommit);
  if (baseCommit && repositoryChanges === null) {
    diagnostics.push(diagnostic("comparison-base-unavailable", "git", baseCommit));
  }
  if (!baseCommit) {
    const entry = diagnostic("comparison-base-required", "base", "an exact comparison base is required to classify changes and scope governed evidence");
    if (stage === "candidate") observations.push(entry);
    else diagnostics.push(entry);
  }
  return repositoryChanges;
}

function inspectSourceSections(context) {
  const { policy, sourcePath, source, diagnostics, observations } = context;
  const covered = sourceSections(policy);
  for (const key of Object.keys(source).filter((key) => !covered.has(key))) {
    diagnostics.push(diagnostic("source-section-ownership-missing", `${sourcePath}#/${key}`, "source section has no governed semantic owner/delegation"));
  }
  for (const key of [...covered].filter((key) => !(key in source))) {
    observations.push(diagnostic("owned-source-section-absent", `${sourcePath}#/${key}`, "owned section is not present in this source revision"));
  }
}

function inspectCapabilityAvailability(discovered, diagnostics) {
  for (const capability of discovered.current) {
    if (capability.applies && !capability.exists) diagnostics.push(diagnostic("applicable-capability-missing", capability.path, capability.id));
  }
}

function inspectCapabilityOverlap(overlap, discovered, diagnostics, observations) {
  const path = `capability_overlaps.${overlap.id}`;
  for (const [capabilityId, expectedObject] of Object.entries(overlap.capability_objects ?? {})) {
    const capability = discovered.current.find((entry) => entry.id === capabilityId);
    if (!capability?.applies) {
      diagnostics.push(diagnostic("capability-overlap-applicability-missing", path, capabilityId));
    } else if (capability.object !== expectedObject) {
      diagnostics.push(diagnostic("capability-overlap-classification-stale", capability.path, `${overlap.id} does not bind the current capability object`));
    }
  }
  if (overlap.classification === "CONTRADICTORY") {
    diagnostics.push(diagnostic("applicable-current-capability-conflict", path, "applicable current capabilities have no automatic winner"));
  } else if (overlap.classification === "DUPLICATE_CONSISTENT") {
    observations.push(diagnostic("capability-overlap-duplicate-consistent", path, "applicable current capabilities restate one consistent requirement; both remain binding"));
  } else if (overlap.classification === "COMPATIBLE_OVERLAP") {
    observations.push(diagnostic("capability-overlap-compatible", path, overlap.rule));
  } else {
    diagnostics.push(diagnostic("capability-overlap-ambiguous", path, "overlap classification is outside the closed classes"));
  }
}

function inspectCapabilityOverlaps(context) {
  const { policy, currentPin, discovered, diagnostics, observations } = context;
  const overlaps = currentPin?.value.overlaps ?? [];
  for (const overlap of overlaps) {
    inspectCapabilityOverlap(overlap, discovered, diagnostics, observations);
  }
  const overlapCount = (name) => overlaps.filter((entry) => entry.classification === name).length;
  const noOverlap = (policy.requirement_ownership ?? []).filter((entry) => entry.overlap === "SINGLE_OWNER").length;
  observations.push(diagnostic("capability-overlap-summary", "current_pin.overlaps",
    [`NO_OVERLAP=${noOverlap}`, ...["COMPATIBLE_OVERLAP", "DUPLICATE_CONSISTENT", "CONTRADICTORY"].map((name) => `${name}=${overlapCount(name)}`)].join(" ")));
}

function inspectOwnedRequirements(context) {
  const { repoRoot, policy, sourcePath, contractVersion, discovered, diagnostics } = context;
  for (const ownership of policy.requirement_ownership ?? []) {
    for (const reference of ownership.capability_requirements ?? []) {
      const capability = discovered.current.find((entry) => entry.id === reference.capability_id);
      if (!capability?.applies) {
        diagnostics.push(diagnostic("applicable-capability-unresolved", `requirement_ownership.${ownership.domain}`, `${reference.capability_id} does not apply to ${sourcePath}@${contractVersion}`));
        continue;
      }
      if (!capability.exists) continue;
      const markdown = readFileSync(resolve(repoRoot, capability.path), "utf8");
      if (!extractRequirement(markdown, reference.requirement_heading)) {
        diagnostics.push(diagnostic("applicable-requirement-missing", capability.path, `${reference.capability_id}: ${reference.requirement_heading}`));
      }
    }
  }
}

function readSemanticAssertionValue(assertion, context) {
  const { sourcePath, source, diagnostics } = context;
  try {
    return { found: true, value: getJsonPointer(source, assertion.source_pointer) };
  } catch (error) {
    diagnostics.push(diagnostic("semantic-assertion-source-missing", `${sourcePath}#${assertion.source_pointer}`, error.message));
    return { found: false, value: undefined };
  }
}

function recordSemanticConflict({ assertion, capability, requirement, value, context }) {
  if (requirement.includes(`\`${String(value)}\``)) return;
  const { repoRoot, stage, baseCommit, repositoryChanges, sourcePath, diagnostics, observations } = context;
  const sourceObject = gitObject(repoRoot, sourcePath);
  const debt = baselineDebtFor(context.currentPin?.value.debts ?? [], assertion, sourceObject, capability.object);
  if (debtAllowedAtStage(debt, stage, baseCommit ? repositoryChanges : null)) {
    observations.push(diagnostic("baseline-conflict-bounded", assertion.id, `${debt.id} is unchanged, scope-bounded, and blocks activation/release`));
    return;
  }
  diagnostics.push(diagnostic(debt ? "baseline-conflict-stage-block" : "source-capability-conflict", assertion.id, `source value ${JSON.stringify(value)} is not authorized by ${assertion.capability_id}`));
}

function inspectSemanticAssertion(assertion, context) {
  const { repoRoot, discovered, diagnostics } = context;
  const capability = discovered.current.find((entry) => entry.id === assertion.capability_id);
  if (!capability?.applies || !capability.exists) return;
  const markdown = readFileSync(resolve(repoRoot, capability.path), "utf8");
  const requirement = extractRequirement(markdown, assertion.requirement_heading);
  if (!requirement) {
    diagnostics.push(diagnostic("applicable-requirement-missing", capability.path, `${assertion.capability_id}: ${assertion.requirement_heading}`));
    return;
  }
  const value = readSemanticAssertionValue(assertion, context);
  if (!value.found) return;
  if (assertion.adapter !== "source-value-present-in-requirement") {
    diagnostics.push(diagnostic("semantic-assertion-adapter-unknown", assertion.id, assertion.adapter));
    return;
  }
  recordSemanticConflict({ assertion, capability, requirement, value: value.value, context });
}

function inspectSemanticAssertions(context) {
  for (const assertion of context.policy.semantic_assertions ?? []) {
    inspectSemanticAssertion(assertion, context);
  }
}

function inspectSourceChange(context) {
  const { repoRoot, policy, baseCommit, sourcePath, source, discovered, diagnostics } = context;
  if (!baseCommit) return { changes: [], diagnostics: [], materialSemanticChange: false };
  const beforeSource = jsonAtCommit(repoRoot, baseCommit, sourcePath);
  if (beforeSource === null) {
    diagnostics.push(diagnostic("comparison-source-unavailable", `${baseCommit}:${sourcePath}`, "cannot classify source changes without the exact baseline source"));
    return { changes: [], diagnostics: [], materialSemanticChange: false };
  }
  const sourceChange = classifySourceChanges(policy, beforeSource, source, discovered.active, sourcePath);
  diagnostics.push(...sourceChange.diagnostics);
  return sourceChange;
}

function inspectCompatibilityDecision(context, sourceChange) {
  if (!sourceChange.materialSemanticChange) return;
  const { repoRoot, sourcePath, diagnostics } = context;
  const decisions = activeChangeDirectories(repoRoot)
    .map((changeDir) => resolve(changeDir, "compatibility-decision.json"))
    .filter(existsSync)
    .map(readJson);
  if (decisions.length !== 1) {
    diagnostics.push(diagnostic("compatibility-transition-unclassified", sourcePath, "a changed authoritative source requires exactly one active compatibility decision"));
  } else {
    diagnostics.push(...validateCompatibilityTransition(decisions[0]));
  }
}

function governedEvidenceRange(context, scope) {
  const { repoRoot, baseCommit, repositoryChanges } = context;
  const rangeChanges = baseCommit && Array.isArray(repositoryChanges) ? repositoryChanges : null;
  const rangeTouchesChange = rangeChanges !== null && rangeChanges.some((path) => changeExclusivePath(repoRoot, path, scope));
  const activeAtBase = rangeChanges !== null
    && gitStdout(repoRoot, ["rev-parse", "--verify", "--quiet", `${baseCommit}:${scope.changeRoot}`]) !== null;
  return { rangeChanges, rangeTouchesChange, removal: !scope.active && activeAtBase && rangeTouchesChange };
}

function evidenceStage(stage, rangeTouchesChange, removal) {
  if (removal) return "activation";
  if (stage === "merge" && !rangeTouchesChange) return "candidate";
  return stage;
}

function lifecycleRangeChanges(rangeChanges, rangeTouchesChange) {
  if (rangeTouchesChange) return rangeChanges;
  return rangeChanges === null ? null : false;
}

function governedEvidenceDisposition(context, scope, range) {
  const { diagnostics, observations } = context;
  if (range.removal && scope.archivedRoot === null) {
    diagnostics.push(diagnostic("governed-change-removed-without-archive", scope.changeRoot, "the range removes the active governed change without exactly one dated archive"));
    return "stop";
  }
  if (!scope.active && !range.removal) {
    observations.push(diagnostic("governed-change-inactive", scope.changeRoot, "change-specific lifecycle, review, and activation evidence applies only while the governed change is active or being archived"));
    return "stop";
  }
  return "continue";
}

function inspectGovernedRange(context, scope, range) {
  const { policy, stage, diagnostics, observations } = context;
  if (range.rangeTouchesChange && !range.removal) {
    diagnostics.push(...applyScopeDiagnostics(range.rangeChanges, scope));
  } else if (!range.rangeTouchesChange && stage === "merge") {
    observations.push(diagnostic("governed-change-out-of-range", scope.changeRoot, `the inspected range does not touch ${policy.change_id}; its merge-stage evidence requirements do not apply`));
  }
}

function inspectGovernedEvidence(context) {
  const { repoRoot, policy, stage, baseCommit } = context;
  const scope = governedChangeScope(repoRoot, policy, baseCommit);
  const range = governedEvidenceRange(context, scope);
  const evidence = { lifecycle: null, review: null, activation: null };
  if (governedEvidenceDisposition(context, scope, range) === "stop") return evidence;
  inspectGovernedRange(context, scope, range);
  const currentStage = evidenceStage(stage, range.rangeTouchesChange, range.removal);
  evidence.lifecycle = inspectLifecycleEvidence({
    ...context,
    stage: currentStage,
    changes: lifecycleRangeChanges(range.rangeChanges, range.rangeTouchesChange),
    scope
  });
  evidence.review = inspectReviewEvidence({
    ...context,
    stage: currentStage,
    scope,
    lifecycle: evidence.lifecycle,
    rangeChanges: range.rangeTouchesChange ? range.rangeChanges : null
  });
  evidence.activation = inspectActivationEvidence({ ...context, stage: currentStage, review: evidence.review });
  return evidence;
}

function observeRepositorySources(discovered, observations) {
  const applicableCount = discovered.current.filter((entry) => entry.applies).length;
  const authorizedDeltaCount = discovered.active.filter((entry) => entry.class === "ACTIVE_CANDIDATE_DELTA").length;
  observations.push(diagnostic("repository-source-discovery", "openspec", `${applicableCount} applicable current capabilities, ${authorizedDeltaCount} active authorized deltas, ${discovered.archived.length} archived deltas`));
}

function inspectStageAuthorization(context) {
  const operations = {
    activation: ["ACTIVATE", "activation", context.policy.governance_authorities.activation_grant],
    release: ["RELEASE", "release", context.policy.governance_authorities.release_grant]
  };
  const expected = operations[context.stage];
  if (!expected) return null;
  const [operation, label, grant] = expected;
  const changeDir = resolve(
    context.repoRoot,
    context.policy.repository_evidence.active_changes_root,
    context.policy.change_id
  );
  const discovery = discoverAuthorizations(changeDir, context.repoRoot, context.policy, {
    operation,
    baseCommit: context.baseCommit
  });
  const structural = discovery.diagnostics.filter((entry) =>
    !["authorization-current-missing", "authorization-inactive"].includes(entry.code));
  context.diagnostics.push(...structural);
  if (!discovery.current) {
    context.diagnostics.push(diagnostic(`${label}-authorization-missing`, context.policy.change_id,
      `${operation} requires one independently verified operation-specific authorization`));
  } else if (discovery.current.grant !== grant) {
    context.diagnostics.push(diagnostic(`${label}-authorization-invalid`, discovery.current.path,
      `authorization does not grant ${grant}`));
  }
  return discovery;
}

export function inspectRepository(repoRoot, policy, { stage = "candidate", schema = null, baseCommit = null } = {}) {
  const context = {
    repoRoot,
    policy,
    stage,
    baseCommit,
    diagnostics: [...validatePolicy(policy, schema)],
    observations: []
  };
  if (!STAGES.includes(stage)) context.diagnostics.push(diagnostic("stage-unknown", "stage", stage));
  const source = readContractSource(context);
  if (source === null) {
    return { diagnostics: context.diagnostics, observations: context.observations, discovered: { current: [], active: [], archived: [] } };
  }
  Object.assign(context, source);
  context.repositoryChanges = inspectComparisonBase(context);
  inspectSourceSections(context);
  const pinSelection = selectCurrentPinSet(repoRoot, policy, { baseCommit });
  context.diagnostics.push(...pinSelection.diagnostics);
  context.currentPin = pinSelection.selected;
  context.pinEvidence = pinSelection;
  context.discovered = discoverRepositorySources(repoRoot, policy, {
    sourcePath: context.sourcePath,
    contractVersion: context.contractVersion,
    baseCommit
  });
  inspectCapabilityAvailability(context.discovered, context.diagnostics);
  inspectCapabilityOverlaps(context);
  inspectOwnedRequirements(context);
  inspectSemanticAssertions(context);
  const sourceChange = inspectSourceChange(context);
  inspectCompatibilityDecision(context, sourceChange);
  const evidence = inspectGovernedEvidence(context);
  const stageAuthorization = inspectStageAuthorization(context);
  const fold = stage === "fold"
    ? inspectFold(repoRoot, policy, { baseCommit })
    : null;
  if (fold) context.diagnostics.push(...fold.diagnostics);
  observeRepositorySources(context.discovered, context.observations);
  return {
    diagnostics: context.diagnostics,
    observations: context.observations,
    discovered: context.discovered,
    currentPin: context.currentPin,
    pinEvidence: context.pinEvidence,
    fold,
    stageAuthorization,
    sourceChange,
    ...evidence
  };
}
