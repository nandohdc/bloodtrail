import { existsSync } from "node:fs";
import { relative, resolve } from "node:path";

import { discoverAuthorizations } from "./authorization-discovery.mjs";
import {
  selectCurrentPinSet,
  validateCurrentPinAgainstRepository,
} from "./pin-sets.mjs";
import {
  diagnostic,
  gitObject,
  gitObjectAt,
  gitStdout,
  readJson,
} from "./shared.mjs";

function previewEntries(preview) {
  return Array.isArray(preview?.targets) ? preview.targets : [];
}

function previewEntryProblem(repoRoot, entry, seenCapabilities) {
  const capabilityId = entry.capability_id ?? "unknown";
  if (seenCapabilities.has(entry.capability_id)) {
    return diagnostic("fold-preview-ambiguous", `fold_preview.${capabilityId}`, "capability appears more than once");
  }
  seenCapabilities.add(entry.capability_id);
  if (gitObject(repoRoot, entry.target_path) === entry.preview_object) return null;
  return diagnostic("fold-preview-mismatch", entry.target_path,
    "actual canonical object differs from the deterministic fold preview");
}

export function validateFoldPreview(repoRoot, preview) {
  const seenCapabilities = new Set();
  const diagnostics = previewEntries(preview)
    .map((entry) => previewEntryProblem(repoRoot, entry, seenCapabilities))
    .filter(Boolean);
  if (seenCapabilities.size === 0) {
    diagnostics.push(diagnostic("fold-preview-missing", "fold_preview", "at least one exact fold target is required"));
  }
  return diagnostics;
}

function requiredFoldReviewPaths(policy, preview, pinPath) {
  return [
    ...previewEntries(preview).map((entry) => entry.target_path),
    `${policy.repository_evidence.active_changes_root}/${policy.change_id}/${policy.repository_evidence.lifecycle_evidence_file}`,
    pinPath,
  ].filter(Boolean);
}

function identityBindsExactTree(repoRoot, identity) {
  const commit = identity.technical_commit;
  if (!commit) return false;
  return gitStdout(repoRoot, ["rev-parse", `${commit}^{tree}`]) === identity.tree;
}

function governedObjectProblem(repoRoot, identity, bound, path) {
  const expected = gitObjectAt(repoRoot, identity.technical_commit, path);
  if (expected && bound[path] === expected) return null;
  return diagnostic("fold-identity-incomplete", path, "fold identity omits or misbinds a required governed object");
}

export function validateFoldIdentity(repoRoot, identity, { policy, preview, pinPath }) {
  const binding = identity ?? {};
  if (!identityBindsExactTree(repoRoot, binding)) {
    return [diagnostic("fold-identity-invalid", "fold_identity", "fold identity must bind an exact commit and tree")];
  }
  const bound = binding.governed_path_objects ?? {};
  return requiredFoldReviewPaths(policy, preview, pinPath)
    .map((path) => governedObjectProblem(repoRoot, binding, bound, path))
    .filter(Boolean);
}

export function validateFoldReviewBinding(policy, preview, pinPath, reviewBinding) {
  return requiredFoldReviewPaths(policy, preview, pinPath)
    .filter((path) => !reviewBinding?.governed_path_objects?.[path])
    .map((path) => diagnostic("review-binding-incomplete", path,
      "fresh folded-content review must bind every changed capability, lifecycle record, and current pin set"));
}

export function validatePostReviewObjects(repoRoot, reviewBinding) {
  return Object.entries(reviewBinding?.governed_path_objects ?? {})
    .filter(([path, object]) => gitObject(repoRoot, path) !== object)
    .map(([path]) => diagnostic("review-binding-post-review-change", path,
      "a governed folded object changed after exact-content review"));
}

export function validateFoldAuthorization(record, policy) {
  if (!record) {
    return [diagnostic("fold-authorization-missing", policy.change_id,
      "fold requires a distinct current FOLD authorization")];
  }
  const diagnostics = [];
  const subject = record.path ?? record.id;
  if (record.operation !== "FOLD" || record.grant !== policy.governance_authorities.fold_grant) {
    diagnostics.push(diagnostic("fold-authorization-invalid", subject,
      "authorization does not grant the governed fold operation"));
  }
  const withheld = record.withheld ?? [];
  if (withheld.includes("ACTIVATE") === false) {
    diagnostics.push(diagnostic("fold-activation-separation-missing", subject,
      "fold authorization must not imply activation authority"));
  }
  return diagnostics;
}

export function validateFoldPinLifecycle(pin, lifecycle) {
  const changeRecord = (lifecycle ?? {}).change_record ?? {};
  if (changeRecord.current_state !== "FOLDED") return [];
  if (pin?.created_for?.lifecycle_state === "FOLDED" && pin?.created_for?.fold_executed === true) return [];
  const pinId = (pin ?? {}).id ?? "pin_set";
  return [diagnostic("fold-pin-set-stale", pinId,
    "FOLDED lifecycle evidence must name a pin created for the folded identity")];
}

export function inspectFold(repoRoot, policy, {
  changeDir = resolve(repoRoot, policy.repository_evidence.active_changes_root, policy.change_id),
  baseCommit = null,
  previewPath = null,
  identity = null,
  reviewBinding = null,
} = {}) {
  const authorization = discoverAuthorizations(changeDir, repoRoot, policy, {
    operation: "FOLD",
    baseCommit,
  });
  const pinSelection = selectCurrentPinSet(repoRoot, policy, { baseCommit });
  const preview = previewPath && existsSync(resolve(repoRoot, previewPath))
    ? readJson(resolve(repoRoot, previewPath))
    : null;
  const lifecyclePath = resolve(changeDir, policy.repository_evidence.lifecycle_evidence_file);
  const lifecycle = existsSync(lifecyclePath) ? readJson(lifecyclePath) : null;
  const diagnostics = [
    ...authorization.diagnostics.filter((entry) =>
      !["authorization-current-missing", "authorization-inactive"].includes(entry.code)),
    ...validateFoldAuthorization(authorization.current, policy),
    ...pinSelection.diagnostics,
  ];
  if (preview) diagnostics.push(...validateFoldPreview(repoRoot, preview));
  else diagnostics.push(diagnostic("fold-preview-missing", previewPath ?? relative(repoRoot, changeDir),
    "fold requires a deterministic isolated preview"));
  const selected = pinSelection.selected ?? null;
  const pinPath = selected === null ? undefined : selected.path;
  diagnostics.push(...validateCurrentPinAgainstRepository(repoRoot, policy, pinSelection));
  diagnostics.push(...validateFoldPinLifecycle(selected === null ? undefined : selected.value, lifecycle));
  diagnostics.push(...foldBindingProblems(repoRoot, policy, { identity, reviewBinding, preview, pinPath }));
  return { diagnostics, authorization, pinSelection, preview };
}

function foldBindingProblems(repoRoot, policy, { identity, reviewBinding, preview, pinPath }) {
  const diagnostics = [];
  if (identity) diagnostics.push(...validateFoldIdentity(repoRoot, identity, { policy, preview, pinPath }));
  if (reviewBinding) diagnostics.push(...validateFoldReviewBinding(policy, preview, pinPath, reviewBinding));
  return diagnostics;
}
