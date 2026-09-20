import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { basename, resolve } from "node:path";

import {
  byCodePoint,
  diagnostic,
  extractRequirement,
  getJsonPointer,
  gitObject,
  gitObjectAt,
  readJson,
} from "./shared.mjs";
import { validatePolicySchema } from "./policy-validation.mjs";
import { validateDebtRetirements } from "./debt-retirement.mjs";

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`;
  if (value !== null && typeof value === "object") {
    return `{${Object.keys(value).sort(byCodePoint).map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function sha256(value) {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

function pathObject(repoRoot, path, commit = null) {
  return { path, object: commit ? gitObjectAt(repoRoot, commit, path) : gitObject(repoRoot, path) };
}

export function computeRepositoryState(repoRoot, policy, commit = null) {
  return {
    source: pathObject(repoRoot, policy.contract.source_path, commit),
    policy: pathObject(repoRoot, "openspec/governance/normative-source-precedence.json", commit),
    authority_registry: pathObject(repoRoot, policy.repository_evidence.authority_registry_path, commit),
    capabilities: (policy.capabilities ?? [])
      .map((capability) => ({
        id: capability.id,
        ...pathObject(repoRoot, capability.path, commit),
        domains: [...(capability.domains ?? [])].sort(byCodePoint),
        path_prefixes: [...(capability.path_prefixes ?? [])].sort(byCodePoint),
        versions: [...(capability.versions ?? [])].sort(byCodePoint),
      }))
      .sort((left, right) => byCodePoint(left.id, right.id)),
  };
}

export function capabilityStateDigest(repositoryState) {
  const entries = [
    repositoryState.source,
    repositoryState.policy,
    repositoryState.authority_registry,
    ...(repositoryState.capabilities ?? []),
  ].filter((entry) => entry?.path && entry?.object)
    .map((entry) => `${entry.object}  ${entry.path}\n`)
    .sort(byCodePoint);
  return sha256(entries.join(""));
}

export function recomputeApplicability(policy) {
  return (policy.requirement_ownership ?? [])
    .map((row) => ({
      domain: row.domain,
      source_sections: [...(row.source_sections ?? [])].sort(byCodePoint),
      owners: [...new Set((row.capability_requirements ?? []).map((entry) => entry.capability_id))].sort(byCodePoint),
    }))
    .sort((left, right) => byCodePoint(left.domain, right.domain));
}

function hasDuplicateOwners(row) {
  const owners = row?.owners ?? [];
  return new Set(owners).size !== owners.length;
}

function isAmbiguousApplicability(rows) {
  return rows.length !== 1 || hasDuplicateOwners(rows[0]);
}

function applicabilityDomainProblem(policy, domain, rows) {
  if (isAmbiguousApplicability(rows)) {
    return diagnostic("fold-applicability-ambiguous", domain,
      "each domain requires one deterministic applicability row with unique owners");
  }
  if ((rows[0].owners?.length ?? 0) <= 1) return null;
  const overlapCount = (policy.overlap_rules ?? []).filter((entry) => entry.domain === domain).length;
  if (overlapCount === 1) return null;
  return diagnostic("fold-applicability-ambiguous", domain,
    "multi-owner applicability requires one governed overlap rule");
}

export function validateApplicabilityEvidence(policy, applicability) {
  return [...new Set(applicability.map((entry) => entry.domain))]
    .map((domain) => applicabilityDomainProblem(policy, domain, applicability.filter((entry) => entry.domain === domain)))
    .filter(Boolean);
}

export function recomputeOverlaps(policy, repositoryState) {
  const objects = new Map((repositoryState.capabilities ?? []).map((entry) => [entry.id, entry.object]));
  return (policy.overlap_rules ?? [])
    .map((rule) => {
      const ownership = (policy.requirement_ownership ?? []).find((entry) => entry.domain === rule.domain);
      const ownerIds = [...new Set((ownership?.capability_requirements ?? []).map((entry) => entry.capability_id))].sort(byCodePoint);
      return {
        id: rule.id,
        domain: rule.domain,
        capability_objects: Object.fromEntries(ownerIds.map((id) => [id, objects.get(id) ?? null])),
        classification: rule.classification,
        rule: rule.rule,
      };
    })
    .sort((left, right) => byCodePoint(left.id, right.id));
}

function overlapStaleDiagnostics(overlap, objects) {
  const diagnostics = [];
  for (const [capabilityId, object] of Object.entries(overlap.capability_objects ?? {})) {
    if (objects.get(capabilityId) !== object) diagnostics.push(diagnostic(
      "capability-overlap-classification-stale",
      overlap.id,
      `${capabilityId} is bound to a non-current capability object`,
    ));
  }
  return diagnostics;
}

export function validateOverlapFreshness(overlaps, repositoryState) {
  const objects = new Map((repositoryState.capabilities ?? []).map((entry) => [entry.id, entry.object]));
  return (overlaps ?? []).flatMap((overlap) => overlapStaleDiagnostics(overlap, objects));
}

function contractVersionDebtMissing(selected, historical) {
  const historicalContractDebt = [...historical].some((entry) =>
    entry.endsWith(":candidate-a-current-capability-version-drift"));
  if (!historicalContractDebt) return false;

  const currentContractDebt = (selected.value.debts ?? []).some((debt) =>
    debt.assertion_id === "contract-version-is-current-capability-literal");
  if (currentContractDebt) return false;

  const retiredContractDebt = (selected.value.retired_debts ?? []).some((debt) =>
    debt.assertion_id === "contract-version-is-current-capability-literal");
  return !retiredContractDebt;
}

function uninheritedLineageDiagnostics(selected, historical) {
  const diagnostics = [];
  for (const debt of selected.value.debts ?? []) {
    const uninherited = (debt.lineage ?? []).filter((lineage) => !historical.has(lineage));
    for (const lineage of uninherited) {
      diagnostics.push(diagnostic("baseline-conflict-not-inherited", selected.path,
        `${debt.id} claims inherited lineage ${lineage} that is not present in historical pins`));
    }
  }
  return diagnostics;
}

export function validateDebtContinuity(selected, pinSets) {
  if (!selected) return [];
  const historical = new Set(pinSets
    .filter((entry) => entry.path !== selected.path)
    .flatMap((entry) => (entry.value.debts ?? []).map((debt) => `${entry.value.id}:${debt.id}`)));
  const diagnostics = [...uninheritedLineageDiagnostics(selected, historical)];
  if (contractVersionDebtMissing(selected, historical)) {
    diagnostics.push(diagnostic(
      "contract-version-boundary-violation",
      selected.path,
      "contract-version debt disappeared without the separately authorized semantic remediation",
    ));
  }
  return diagnostics;
}

function recomputedDebt(rule, assertion, repositoryState) {
  const capability = repositoryState.capabilities.find((entry) => entry.id === assertion.capability_id);
  return {
    id: rule.id,
    assertion_id: assertion.id,
    source_path: repositoryState.source.path,
    source_blob: repositoryState.source.object,
    capability_path: capability.path,
    capability_blob: capability.object,
    allowed_stages: rule.allowed_stages,
    merge_scope: rule.merge_scope,
    allowed_merge_path_prefixes: rule.allowed_merge_path_prefixes,
    activation_effect: rule.activation_effect,
    release_effect: rule.release_effect,
    recomputed: true,
    lineage: [`${policyLineageId(rule.id)}`],
  };
}

function policyLineageId(debtId) {
  return `revision-2-inline-bindings:${debtId}`;
}

function readJsonAt(repoRoot, path, commit) {
  if (!commit) return readJson(resolve(repoRoot, path));
  const result = spawnSync("git", ["show", `${commit}:${path}`], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? JSON.parse(result.stdout) : null;
}

function readTextAt(repoRoot, path, commit) {
  if (!commit) return readFileSync(resolve(repoRoot, path), "utf8");
  const result = spawnSync("git", ["show", `${commit}:${path}`], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout : null;
}

function assertionDebt(assertion, policy, repositoryState, { source, requirement }) {
  let value;
  try {
    value = getJsonPointer(source, assertion.source_pointer);
  } catch {
    return null;
  }
  if (assertion.adapter === "source-value-present-in-requirement" && requirement.includes(`\`${String(value)}\``)) return null;
  const rule = (policy.debt_rules ?? []).find((entry) => entry.assertion_id === assertion.id);
  return rule ? recomputedDebt(rule, assertion, repositoryState) : null;
}

function tryCollectDebt({ assertion, policy, repositoryState, source, readCapability }) {
  const capability = repositoryState.capabilities.find((entry) => entry.id === assertion.capability_id);
  const capabilityText = readCapability(capability);
  if (capabilityText === null) return null;
  const requirement = extractRequirement(capabilityText, assertion.requirement_heading);
  if (requirement === null) return null;
  return assertionDebt(assertion, policy, repositoryState, { source, requirement });
}

function collectDebts(policy, repositoryState, source, readCapability) {
  if (source === null) return [];
  return (policy.semantic_assertions ?? [])
    .map((assertion) => tryCollectDebt({ assertion, policy, repositoryState, source, readCapability }))
    .filter(Boolean)
    .sort((left, right) => byCodePoint(left.id, right.id));
}

function evidenceFrom(policy, repositoryState, debts) {
  return {
    capability_state_digest: capabilityStateDigest(repositoryState),
    repository_state: repositoryState,
    applicability: recomputeApplicability(policy),
    overlaps: recomputeOverlaps(policy, repositoryState),
    debts,
  };
}

export function recomputeDebts(repoRoot, policy, repositoryState, commit = null) {
  return collectDebts(
    policy,
    repositoryState,
    readJsonAt(repoRoot, policy.contract.source_path, commit),
    (capability) => (capability?.object ? readTextAt(repoRoot, capability.path, commit) : null),
  );
}

export function recomputePinEvidence(repoRoot, policy, commit = null) {
  const repositoryState = computeRepositoryState(repoRoot, policy, commit);
  return evidenceFrom(policy, repositoryState, recomputeDebts(repoRoot, policy, repositoryState, commit));
}

function blobText(repoRoot, object) {
  if (!object) return null;
  const result = spawnSync("git", ["cat-file", "-p", object], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout : null;
}

function pinnedSource(repoRoot, repositoryState) {
  const sourceText = blobText(repoRoot, repositoryState.source?.object);
  return sourceText === null ? null : JSON.parse(sourceText);
}

function recomputePinnedDebts(repoRoot, policy, repositoryState) {
  return collectDebts(
    policy,
    repositoryState,
    pinnedSource(repoRoot, repositoryState),
    (capability) => (capability ? blobText(repoRoot, capability.object) : null),
  );
}

export function recomputePinnedEvidence(repoRoot, policy, repositoryState) {
  return evidenceFrom(policy, repositoryState, recomputePinnedDebts(repoRoot, policy, repositoryState));
}

export function loadPinSets(repoRoot, policy) {
  const root = resolve(repoRoot, policy.repository_evidence.pin_sets_root);
  if (!existsSync(root)) return [];
  const schema = readJson(resolve(repoRoot, policy.pinning.schema_path));
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => {
      const path = `${policy.repository_evidence.pin_sets_root}/${entry.name}`;
      const value = readJson(resolve(repoRoot, path));
      return { path, value, object: gitObject(repoRoot, path), diagnostics: validatePolicySchema(value, schema, path, schema) };
    })
    .sort((left, right) => byCodePoint(left.path, right.path));
}

export function evidenceMismatchDiagnostics(pin, expected, path) {
  const fields = [
    ["repository_state", "fold-repository-state-mismatch"],
    ["applicability", "fold-applicability-mismatch"],
    ["overlaps", "fold-overlap-recomputation-mismatch"],
    ["debts", "debt-recomputation-mismatch"],
  ];
  return fields
    .filter(([field]) => canonicalJson(pin[field]) !== canonicalJson(expected[field]))
    .map(([field, code]) => diagnostic(code, `${path}#/${field}`, "pinned evidence differs from independent repository recomputation"));
}

export function selectCurrentPinSet(repoRoot, policy, { baseCommit = null } = {}) {
  const diagnostics = [];
  const pinSets = loadPinSets(repoRoot, policy);
  for (const entry of pinSets) diagnostics.push(...entry.diagnostics);
  const headDigest = recomputePinEvidence(repoRoot, policy).capability_state_digest;
  const selection = chooseCurrentPinSet(pinSets, headDigest, policy.repository_evidence.pin_sets_root);
  diagnostics.push(...selection.diagnostics);
  const selected = selection.selected;
  const expected = selected ? recomputePinnedEvidence(repoRoot, policy, selected.value.repository_state) : null;
  diagnostics.push(...selectedPinProblems({ repoRoot, policy, selected, expected, pinSets, baseCommit }));
  if (baseCommit) diagnostics.push(...validatePinHistory(repoRoot, baseCommit, pinSets));
  return { selected, pinSets, expected, diagnostics };
}

function selectedPinProblems({ repoRoot, policy, selected, expected, pinSets, baseCommit }) {
  if (!selected) return [];
  const diagnostics = [];
  if (selected.value.capability_state_digest !== expected.capability_state_digest) {
    diagnostics.push(diagnostic("fold-pin-set-stale", selected.path,
      "the current pin digest does not match its exact repository-state binding"));
  }
  diagnostics.push(...evidenceMismatchDiagnostics(selected.value, expected, selected.path));
  diagnostics.push(...validateApplicabilityEvidence(policy, selected.value.applicability));
  diagnostics.push(...validateOverlapFreshness(selected.value.overlaps, selected.value.repository_state));
  diagnostics.push(...validateDebtContinuity(selected, pinSets));
  diagnostics.push(...validateDebtRetirements({ repoRoot, policy, selected, pinSets, baseCommit }));
  return diagnostics;
}

export function chooseCurrentPinSet(pinSets, headDigest, path = "pin_sets") {
  const current = pinSets.filter((entry) => entry.value.status === "CURRENT");
  const matching = current.length <= 1
    ? current
    : current.filter((entry) => entry.value.capability_state_digest === headDigest);
  if (current.length === 0 || matching.length === 0) {
    return {
      selected: null,
      diagnostics: [diagnostic("fold-pin-set-missing", path,
        current.length === 0 ? "no current pin set exists" : `no current pin set matches ${headDigest}`)],
    };
  }
  if (matching.length > 1) {
    return {
      selected: null,
      diagnostics: [diagnostic("fold-pin-set-ambiguous", path,
        `${matching.length} current pin sets match ${headDigest}`)],
    };
  }
  return { selected: matching[0], diagnostics: [] };
}

export function validateCurrentPinAgainstRepository(repoRoot, policy, selection) {
  if (!selection?.selected) return selection?.diagnostics ?? [];
  const expected = recomputePinEvidence(repoRoot, policy);
  const diagnostics = [];
  if (selection.selected.value.capability_state_digest !== expected.capability_state_digest) {
    diagnostics.push(diagnostic("fold-pin-set-stale", selection.selected.path,
      "the selected pin set does not bind the current folded repository state"));
  }
  diagnostics.push(...evidenceMismatchDiagnostics(selection.selected.value, expected, selection.selected.path));
  return diagnostics;
}

export function validatePinHistory(repoRoot, baseCommit, pinSets) {
  const diagnostics = [];
  const currentPaths = new Set(pinSets.map((entry) => entry.path));
  const baseFiles = (gitObjectAt(repoRoot, baseCommit, "openspec/governance/normative-precedence-pins")
    ? (readTreePaths(repoRoot, baseCommit, "openspec/governance/normative-precedence-pins") ?? [])
    : []);
  for (const path of baseFiles) {
    const before = gitObjectAt(repoRoot, baseCommit, path);
    const after = gitObject(repoRoot, path);
    if (!currentPaths.has(path) || before !== after) {
      diagnostics.push(diagnostic("pin-set-history-mutated", path, "an existing pin-set object changed or was removed"));
    }
  }
  return diagnostics;
}

function readTreePaths(repoRoot, commit, root) {
  const result = spawnSync("git", ["ls-tree", "-r", "--name-only", commit, "--", root], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  const output = result.status === 0 ? result.stdout.trim() : null;
  return output === null ? null : output.split("\n").filter(Boolean);
}

export function pinFileName(pin) {
  return `${basename(pin.id)}.json`;
}
