import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { spawnSync } from "node:child_process";

export const POLICY_RELATIVE_PATH = "openspec/governance/normative-source-precedence.json";
export const STAGES = Object.freeze(["candidate", "merge", "activation", "release"]);

const REQUIRED_SEMANTIC_DIMENSIONS = Object.freeze([
  "requiredness", "conditional_requiredness", "authority", "trust", "privacy",
  "retention", "delivery", "compatibility", "extension_ownership",
  "interoperability_mapping", "derivation", "validation_rejection",
  "authorization", "integrity", "lifecycle"
]);

function diagnostic(code, path, message) {
  return { code, path, message };
}

function unique(values) {
  return new Set(values).size === values.length;
}

function byCodePoint(left, right) {
  if (left < right) return -1;
  return left > right ? 1 : 0;
}

function walkDirectories(root) {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => join(root, entry.name));
}

export function readJson(path) {
  return JSON.parse(readFileSync(path, "utf8"));
}

export function loadPolicy(repoRoot, policyPath = POLICY_RELATIVE_PATH) {
  const absolute = resolve(repoRoot, policyPath);
  const policy = readJson(absolute);
  const schemaPath = resolve(dirname(absolute), policy.$schema);
  return { path: absolute, policy, schemaPath, schema: readJson(schemaPath) };
}

export function getJsonPointer(document, pointer) {
  if (pointer === "") return document;
  if (!pointer.startsWith("/")) throw new Error(`invalid JSON pointer ${pointer}`);
  return pointer.slice(1).split("/").reduce((value, token) => {
    const key = token.replaceAll("~1", "/").replaceAll("~0", "~");
    if (value === null || typeof value !== "object" || !(key in value)) {
      throw new Error(`missing JSON pointer ${pointer}`);
    }
    return value[key];
  }, document);
}

export function extractRequirement(markdown, heading) {
  const marker = `### Requirement: ${heading}`;
  const start = markdown.split("\n").findIndex((line) => line.trimEnd() === marker);
  if (start < 0) return null;
  const lines = markdown.split("\n");
  let end = lines.length;
  for (let index = start + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("### Requirement: ")) {
      end = index;
      break;
    }
  }
  return lines.slice(start, end).join("\n");
}

export function gitObject(repoRoot, path) {
  const result = spawnSync("git", ["hash-object", "--", path], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  return result.status === 0 ? result.stdout.trim() : null;
}

export function validateLifecycle(name, lifecycle) {
  const diagnostics = [];
  const path = `${name}`;
  if (!lifecycle || !Array.isArray(lifecycle.states) || !Array.isArray(lifecycle.transitions)) {
    return [diagnostic("lifecycle-shape-invalid", path, "states and transitions are required")];
  }
  if (!unique(lifecycle.states)) {
    diagnostics.push(diagnostic("lifecycle-state-duplicate", `${path}.states`, "states must be unique"));
  }
  const edges = new Set();
  for (const [index, edge] of lifecycle.transitions.entries()) {
    if (!edge || typeof edge !== "object" || !lifecycle.states.includes(edge.from) || !lifecycle.states.includes(edge.to)) {
      diagnostics.push(diagnostic("lifecycle-transition-invalid", `${path}.transitions[${index}]`, "transition endpoints must belong to this lifecycle"));
      continue;
    }
    const key = `${edge.from}->${edge.to}`;
    if (edges.has(key)) diagnostics.push(diagnostic("lifecycle-transition-duplicate", `${path}.transitions[${index}]`, key));
    edges.add(key);
    for (const field of ["entering_authority", "semantic_claim", "invalidation"]) {
      if (typeof edge[field] !== "string" || edge[field].length === 0) {
        diagnostics.push(diagnostic("lifecycle-transition-evidence-incomplete", `${path}.transitions[${index}].${field}`, "transition governance field is required"));
      }
    }
    for (const field of ["required_evidence", "permitted_operations"]) {
      if (!Array.isArray(edge[field]) || edge[field].length === 0) {
        diagnostics.push(diagnostic("lifecycle-transition-evidence-incomplete", `${path}.transitions[${index}].${field}`, "transition governance list is required"));
      }
    }
  }
  return diagnostics;
}

export function transitionAllowed(lifecycle, from, to) {
  return lifecycle.transitions.some((edge) => edge.from === from && edge.to === to);
}

function typeMatches(value, type) {
  if (type === "array") return Array.isArray(value);
  if (type === "object") return value !== null && typeof value === "object" && !Array.isArray(value);
  if (type === "integer") return Number.isInteger(value);
  return typeof value === type;
}

export function validatePolicySchema(value, schema, path = "$") {
  const diagnostics = [];
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    diagnostics.push(diagnostic("policy-schema-const", path, "value differs from schema const"));
  }
  if (schema.enum && !schema.enum.some((entry) => JSON.stringify(entry) === JSON.stringify(value))) {
    diagnostics.push(diagnostic("policy-schema-enum", path, "value is outside the closed enum"));
  }
  if (schema.type && !typeMatches(value, schema.type)) {
    diagnostics.push(diagnostic("policy-schema-type", path, `expected ${schema.type}`));
    return diagnostics;
  }
  if (schema.type === "object") {
    for (const key of schema.required ?? []) {
      if (!(key in value)) diagnostics.push(diagnostic("policy-schema-required", `${path}.${key}`, "required property is absent"));
    }
    if (schema.additionalProperties === false) {
      for (const key of Object.keys(value)) {
        if (!(key in (schema.properties ?? {}))) diagnostics.push(diagnostic("policy-schema-additional", `${path}.${key}`, "additional property is forbidden"));
      }
    }
    for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
      if (key in value) diagnostics.push(...validatePolicySchema(value[key], childSchema, `${path}.${key}`));
    }
  }
  if (schema.type === "array") {
    if (schema.minItems !== undefined && value.length < schema.minItems) diagnostics.push(diagnostic("policy-schema-min-items", path, `minimum is ${schema.minItems}`));
    if (schema.uniqueItems && !unique(value.map((entry) => JSON.stringify(entry)))) diagnostics.push(diagnostic("policy-schema-unique", path, "items must be unique"));
    if (schema.items) value.forEach((entry, index) => diagnostics.push(...validatePolicySchema(entry, schema.items, `${path}[${index}]`)));
  }
  if (schema.type === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) diagnostics.push(diagnostic("policy-schema-min-length", path, `minimum length is ${schema.minLength}`));
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) diagnostics.push(diagnostic("policy-schema-pattern", path, "value does not match pattern"));
  }
  return diagnostics;
}

export function validatePolicy(policy, schema = null) {
  const diagnostics = [];
  if (schema) diagnostics.push(...validatePolicySchema(policy, schema));
  if (policy?.schema !== "bloodtrail.normative-source-precedence.policy") {
    diagnostics.push(diagnostic("policy-schema-invalid", "schema", "unexpected policy schema identity"));
    return diagnostics;
  }
  if (policy.status !== "candidate_requires_exact_owner_review" && policy.status !== "activated") {
    diagnostics.push(diagnostic("policy-status-invalid", "status", "policy status is not controlled"));
  }
  const domains = policy.authority_domains ?? [];
  if (!unique(domains)) diagnostics.push(diagnostic("authority-domain-duplicate", "authority_domains", "authority domains must be unique"));
  const classes = policy.source_classes ?? [];
  if (!unique(classes.map((entry) => entry.id))) diagnostics.push(diagnostic("source-class-duplicate", "source_classes", "source class IDs must be unique"));
  for (const entry of classes) {
    if (!domains.includes(entry.domain)) diagnostics.push(diagnostic("source-class-domain-unknown", `source_classes.${entry.id}`, entry.domain));
  }
  for (const id of ["AUTHORITATIVE_AUTHORED_CONTRACT", "DERIVED_CONTRACT_ARTIFACT", "DERIVED_SDK_ARTIFACT", "SEMANTIC_IMPLEMENTATION", "TEST_EVIDENCE", "CANDIDATE_GOVERNANCE_CHECKER", "ACTIVATION_EVIDENCE"]) {
    const entry = classes.find((candidate) => candidate.id === id);
    if (!entry || entry.may_define_semantics || entry.may_override_semantics) {
      diagnostics.push(diagnostic("non-authority-can-define-semantics", `source_classes.${id}`, `${id} must not define or override semantics`));
    }
  }
  const activationAuthority = classes.find((entry) => entry.id === "ACTIVATING_AUTHORITY");
  const activationEvidence = classes.find((entry) => entry.id === "ACTIVATION_EVIDENCE");
  if (!activationAuthority?.may_authorize_transition || activationEvidence?.may_authorize_transition) {
    diagnostics.push(diagnostic("activation-authority-conflated", "source_classes", "activation authority must authorize; evidence must not"));
  }
  if (policy.default_unclassified_dimension !== "SEMANTIC_REQUIREMENT") {
    diagnostics.push(diagnostic("semantic-default-not-deny", "default_unclassified_dimension", "unclassified source dimensions must default to semantic"));
  }
  for (const dimension of REQUIRED_SEMANTIC_DIMENSIONS) {
    if (!policy.semantic_dimensions?.includes(dimension)) {
      diagnostics.push(diagnostic("semantic-dimension-missing", "semantic_dimensions", dimension));
    }
  }
  if (JSON.stringify(policy.delegation_values) !== JSON.stringify(["NONE", "CONCRETE_PARAMETER", "REPRESENTATION_DETAIL"])) {
    diagnostics.push(diagnostic("delegation-vocabulary-invalid", "delegation_values", "delegation vocabulary must be closed"));
  }
  const capabilities = policy.capabilities ?? [];
  if (!unique(capabilities.map((entry) => entry.id)) || !unique(capabilities.map((entry) => entry.path))) {
    diagnostics.push(diagnostic("capability-applicability-ambiguous", "capabilities", "capability IDs and canonical paths must be unique"));
  }
  const capabilityIds = new Set(capabilities.map((entry) => entry.id));
  const ownedSections = [];
  for (const ownership of policy.requirement_ownership ?? []) {
    if (!policy.delegation_values.includes(ownership.delegation)) {
      diagnostics.push(diagnostic("delegation-value-unknown", `requirement_ownership.${ownership.domain}`, ownership.delegation));
    }
    const requirements = ownership.capability_requirements ?? [];
    if ((ownership.overlap === "SINGLE_OWNER" && requirements.length !== 1)
      || (ownership.overlap === "COMPATIBLE_JOINT_OWNERSHIP" && requirements.length < 2)) {
      diagnostics.push(diagnostic("capability-overlap-unclassified", `requirement_ownership.${ownership.domain}`, "owner count does not match the explicit overlap class"));
    }
    for (const requirement of requirements) {
      const capability = capabilities.find((entry) => entry.id === requirement.capability_id);
      if (!capabilityIds.has(requirement.capability_id)) {
        diagnostics.push(diagnostic("applicability-capability-missing", `requirement_ownership.${ownership.domain}`, requirement.capability_id));
      } else if (!capability.domains?.includes(ownership.domain) && ownership.domain !== "representation_metadata") {
        diagnostics.push(diagnostic("capability-domain-mismatch", `requirement_ownership.${ownership.domain}`, requirement.capability_id));
      }
      if (typeof requirement.requirement_heading !== "string" || requirement.requirement_heading.length === 0) {
        diagnostics.push(diagnostic("applicability-requirement-heading-missing", `requirement_ownership.${ownership.domain}`, requirement.capability_id));
      }
    }
    const overlaps = (policy.capability_overlaps ?? []).filter((entry) => entry.domain === ownership.domain);
    if (ownership.overlap === "COMPATIBLE_JOINT_OWNERSHIP") {
      if (overlaps.length !== 1) {
        diagnostics.push(diagnostic("capability-overlap-unclassified", `requirement_ownership.${ownership.domain}`, "joint ownership requires one exact overlap classification"));
      } else {
        const expectedIds = requirements.map((entry) => entry.capability_id).sort();
        const boundIds = Object.keys(overlaps[0].capability_objects ?? {}).sort();
        if (JSON.stringify(expectedIds) !== JSON.stringify(boundIds)) {
          diagnostics.push(diagnostic("capability-overlap-binding-incomplete", `capability_overlaps.${overlaps[0].id}`, "overlap binding must cover every joint owner exactly"));
        }
      }
    } else if (overlaps.length !== 0) {
      diagnostics.push(diagnostic("capability-overlap-unexpected", `requirement_ownership.${ownership.domain}`, "single-owner domain must not carry an overlap classification"));
    }
    ownedSections.push(...(ownership.source_sections ?? []));
  }
  if (!unique((policy.capability_overlaps ?? []).map((entry) => entry.id))) {
    diagnostics.push(diagnostic("capability-overlap-id-duplicate", "capability_overlaps", "overlap IDs must be unique"));
  }
  if (!unique(ownedSections)) diagnostics.push(diagnostic("source-section-ownership-ambiguous", "requirement_ownership", "a source section has multiple owners"));
  const delegationRows = policy.semantic_delegation ?? [];
  for (const dimension of REQUIRED_SEMANTIC_DIMENSIONS) {
    const rows = delegationRows.filter((entry) => entry.dimension === dimension);
    if (rows.length !== 1 || rows[0].classification !== "SEMANTIC_REQUIREMENT") {
      diagnostics.push(diagnostic("semantic-delegation-missing", "semantic_delegation", `${dimension} requires one explicit semantic owner row`));
    }
  }
  for (const row of delegationRows) {
    if (!policy.delegation_values.includes(row.delegation)) diagnostics.push(diagnostic("semantic-delegation-value-unknown", `semantic_delegation.${row.dimension}`, row.delegation));
    for (const id of row.capability_ids ?? []) {
      if (!capabilityIds.has(id)) diagnostics.push(diagnostic("semantic-delegation-owner-missing", `semantic_delegation.${row.dimension}`, id));
    }
    if (row.classification === "SEMANTIC_REQUIREMENT" && row.delegation !== "NONE") {
      diagnostics.push(diagnostic("semantic-delegation-too-broad", `semantic_delegation.${row.dimension}`, "semantic dimensions are default-deny and require capability/delta authorization"));
    }
  }
  if (!unique((policy.source_shape ?? []).map((entry) => entry.path))) {
    diagnostics.push(diagnostic("source-shape-path-duplicate", "source_shape", "source shape patterns must be unique"));
  }
  diagnostics.push(...validateLifecycle("change_record_lifecycle", policy.change_record_lifecycle));
  diagnostics.push(...validateLifecycle("contract_candidate_lifecycle", policy.contract_candidate_lifecycle));
  // State labels are namespaced by their machine. Sharing a word such as
  // SUPERSEDED does not merge the lifecycles or permit a cross-machine edge.
  if (!policy.review_binding?.floating_references_forbidden
    || !policy.review_binding?.partial_bindings_forbidden
    || JSON.stringify(policy.review_binding?.post_review_allowlist) !== JSON.stringify(["governance_record_only"])) {
    diagnostics.push(diagnostic("review-binding-not-exact", "review_binding", "floating and partial bindings must be forbidden"));
  }
  if (policy.activation?.mechanism !== "DEDICATED_POST_MERGE_DIRECT_CHILD_RECORD" || !policy.activation?.record_cannot_self_authorize || !policy.activation?.branch_or_version_only_forbidden) {
    diagnostics.push(diagnostic("activation-model-unsafe", "activation", "activation must use an exact authorized direct-child record"));
  }
  if (!policy.review_binding?.required_fields?.includes("base_commit")) {
    diagnostics.push(diagnostic("review-binding-not-exact", "review_binding.required_fields", "review must bind its exact comparison base"));
  }
  const recordPaths = new Set([policy.repository_evidence?.review_record_path, policy.repository_evidence?.activation_record_path]);
  for (const path of policy.repository_evidence?.governance_record_only_paths ?? []) {
    if (!recordPaths.has(path)) {
      diagnostics.push(diagnostic("record-only-allowlist-overbroad", `repository_evidence.governance_record_only_paths.${path}`, "only the exact review and activation records may change after review"));
    }
  }
  for (const row of delegationRows) {
    const owners = [...new Set(row.capability_ids ?? [])].sort(byCodePoint);
    if (owners.length < 2) continue;
    const declared = (policy.capability_overlaps ?? []).some((overlap) => overlap.classification !== "CONTRADICTORY"
      && JSON.stringify(Object.keys(overlap.capability_objects ?? {}).sort(byCodePoint)) === JSON.stringify(owners));
    if (!declared) {
      diagnostics.push(diagnostic("semantic-delegation-overlap-undeclared", `semantic_delegation.${row.dimension}`, "a multi-owner semantic dimension requires a declared non-contradictory capability overlap"));
    }
  }
  if (!policy.checker_trust?.candidate_cannot_self_authorize) {
    diagnostics.push(diagnostic("candidate-checker-self-authorizes", "checker_trust", "candidate checker may not authorize itself"));
  }
  const rules = policy.conflict_rules ?? [];
  if (rules.length !== 26 || !unique(rules.map((rule) => rule.id))) {
    diagnostics.push(diagnostic("conflict-rule-inventory-invalid", "conflict_rules", "exactly 26 unique rules are required"));
  }
  for (const rule of rules) {
    if (!rule.controlling || !rule.merge || !rule.activation || !rule.release) {
      diagnostics.push(diagnostic("conflict-rule-incomplete", `conflict_rules.${rule.id}`, "controlling source and stage effects are required"));
    }
  }
  return diagnostics;
}

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

function gitStdout(repoRoot, args) {
  const result = spawnSync("git", args, { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : null;
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

function isAncestorCommit(repoRoot, ancestor, descendant) {
  return spawnSync("git", ["merge-base", "--is-ancestor", ancestor, descendant], { cwd: repoRoot }).status === 0;
}

/**
 * Parses and verifies an exact apply authorization for one change directory.
 * Returns null when the change carries no authorization or proposal; otherwise
 * every generic binding failure is listed in `diagnostics`.
 */
export function readApplyAuthorization(changeDir, repoRoot, policy) {
  const authorizationPath = resolve(changeDir, policy.repository_evidence.apply_authorization_file);
  if (!existsSync(authorizationPath) || !existsSync(resolve(changeDir, "proposal.md"))) return null;
  const text = readFileSync(authorizationPath, "utf8");
  const objectId = (label) => tableValue(text, label)?.match(/`([0-9a-f]{40})`/)?.[1] ?? null;
  const authorization = {
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
  const commit = authorization.proposal_commit;
  const problems = authorization.diagnostics;
  if (!commit || !authorization.proposal_tree || !authorization.change_subtree) problems.push("apply authorization lacks exact proposal commit, tree, or subtree");
  if (commit && gitStdout(repoRoot, ["rev-parse", `${commit}^{tree}`]) !== authorization.proposal_tree) problems.push("authorized proposal tree does not match commit");
  if (commit && gitStdout(repoRoot, ["rev-parse", `${commit}:${relative(repoRoot, changeDir)}`]) !== authorization.change_subtree) problems.push("authorized change subtree does not match proposal commit");
  if (commit && !isAncestorCommit(repoRoot, commit, "HEAD")) problems.push("authorized proposal is not an ancestor of HEAD");
  if (commit && authorization.candidate_base && !isAncestorCommit(repoRoot, authorization.candidate_base, commit)) problems.push("authorized candidate base is not an ancestor of the proposal commit");
  if (authorization.authorizing_party !== `${policy.governance_authorities.apply_authority_identity}, project owner`) problems.push("apply authority identity is not the governed project owner");
  if (!authorization.granted?.toLowerCase().includes("implement") || !authorization.withheld?.toLowerCase().includes("activation")) problems.push("apply grant/withheld scope is incomplete");
  if (authorization.paths.length === 0) problems.push("apply authorization has no bounded path allowlist");
  return authorization;
}

function activeDeltaEvidence(changeDir, capabilityId, repoRoot, policy) {
  const evidence = {
    authorized: false,
    lifecycle_state: "PROPOSED",
    authorized_paths: [],
    authorized_capabilities: [],
    authorized_semantic_dimensions: [],
    authorized_source_pointers: [],
    diagnostics: []
  };
  const authorization = readApplyAuthorization(changeDir, repoRoot, policy);
  if (authorization === null) return evidence;
  const commit = authorization.proposal_commit;
  evidence.authorized_capabilities = authorization.capabilities;
  evidence.authorized_semantic_dimensions = authorization.semantic_dimensions;
  evidence.authorized_source_pointers = authorization.source_pointers;
  evidence.authorized_paths = authorization.paths;
  evidence.diagnostics.push(...authorization.diagnostics);
  const proposalPath = relative(repoRoot, resolve(changeDir, "proposal.md"));
  const proposalAtCommit = commit ? gitStdout(repoRoot, ["show", `${commit}:${proposalPath}`]) : null;
  if (!proposalAtCommit || !proposalCapabilities(proposalAtCommit).includes(capabilityId)) evidence.diagnostics.push("capability is not in the structured proposal scope");
  if (!evidence.authorized_capabilities.includes(capabilityId)) evidence.diagnostics.push("capability is not in the exact apply authorization scope");
  const deltaPath = relative(repoRoot, resolve(changeDir, "specs", capabilityId, "spec.md"));
  const authorizedDeltaObject = commit ? gitStdout(repoRoot, ["rev-parse", `${commit}:${deltaPath}`]) : null;
  if (!authorizedDeltaObject || authorizedDeltaObject !== gitObject(repoRoot, deltaPath)) evidence.diagnostics.push("active delta differs from the exact apply-authorized object");
  evidence.authorized = evidence.diagnostics.length === 0;
  evidence.lifecycle_state = evidence.authorized ? "APPLY_AUTHORIZED" : "PROPOSED";
  evidence.proposal_commit = commit;
  evidence.proposal_tree = authorization.proposal_tree;
  evidence.change_subtree = authorization.change_subtree;
  return evidence;
}

function versionApplies(version, declared) {
  return declared.includes("*") || declared.includes(version);
}

export function discoverRepositorySources(repoRoot, policy, { sourcePath = policy.contract?.source_path, contractVersion = null } = {}) {
  const current = (policy.capabilities ?? []).map((capability) => ({
    ...capability,
    exists: existsSync(resolve(repoRoot, capability.path)),
    object: gitObject(repoRoot, capability.path),
    applies: capability.path_prefixes.some((prefix) => pathMatchesPrefix(sourcePath, prefix))
      && (contractVersion === null || versionApplies(contractVersion, capability.versions))
  }));
  const active = activeChangeDirectories(repoRoot).flatMap((changeDir) =>
    discoverDeltaSpecs(changeDir, repoRoot).map((delta) => {
      const evidence = activeDeltaEvidence(changeDir, delta.capability_id, repoRoot, policy);
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

function baselineDebtFor(policy, assertion, sourceObject, capabilityObject) {
  return (policy.baseline_conflicts ?? []).find((entry) =>
    entry.assertion_id === assertion.id &&
    entry.source_blob === sourceObject &&
    entry.capability_blob === capabilityObject
  );
}

function changedPaths(repoRoot, baseCommit) {
  if (!baseCommit) return [];
  const result = spawnSync("git", ["diff", "--name-only", `${baseCommit}...HEAD`], {
    cwd: repoRoot,
    encoding: "utf8"
  });
  if (result.status !== 0) return null;
  return result.stdout.split("\n").filter(Boolean);
}

function pathMatchesPrefix(path, prefix) {
  return path === prefix || (prefix.endsWith("/") && path.startsWith(prefix));
}

function debtAllowedAtStage(debt, stage, repositoryChanges) {
  if (!debt?.allowed_stages?.includes(stage)) return false;
  if (stage !== "merge") return true;
  if (!Array.isArray(repositoryChanges)) return false;
  return repositoryChanges.every((path) =>
    debt.allowed_merge_path_prefixes?.some((prefix) => pathMatchesPrefix(path, prefix))
  );
}

function sourceSections(policy) {
  return new Set((policy.requirement_ownership ?? []).flatMap((entry) => entry.source_sections));
}

function shapePatternMatches(pattern, path) {
  const patternParts = pattern.split("/").slice(1);
  const pathParts = path.split("/").slice(1);
  return patternParts.length === pathParts.length && patternParts.every((part, index) => part === "*" || part === pathParts[index]);
}

function pointerPatternCovers(pattern, pointer) {
  const patternParts = pattern.split("/").slice(1);
  const pointerParts = pointer.split("/").slice(1);
  return patternParts.length <= pointerParts.length
    && patternParts.every((part, index) => part === "*" || part === pointerParts[index]);
}

function pointerToken(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

export function changedJsonPointers(before, after, path = "") {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const changes = [];
    const length = Math.max(before.length, after.length);
    for (let index = 0; index < length; index += 1) {
      changes.push(...changedJsonPointers(before[index], after[index], `${path}/${index}`));
    }
    return changes;
  }
  if (before && after && typeof before === "object" && typeof after === "object") {
    const changes = [];
    for (const key of [...new Set([...Object.keys(before), ...Object.keys(after)])].sort()) {
      changes.push(...changedJsonPointers(before[key], after[key], `${path}/${pointerToken(key)}`));
    }
    return changes;
  }
  return [path || "/"];
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
function governedChangeScope(repoRoot, policy) {
  const evidence = policy.repository_evidence;
  const changeRoot = `${evidence.active_changes_root}/${policy.change_id}`;
  const changeDir = resolve(repoRoot, changeRoot);
  const active = existsSync(changeDir);
  const authorization = active ? readApplyAuthorization(changeDir, repoRoot, policy) : null;
  const foldTargets = active ? discoverDeltaSpecs(changeDir, repoRoot).map((delta) => `openspec/specs/${delta.capability_id}/spec.md`) : [];
  return {
    active,
    changeRoot,
    authorization,
    patterns: [`${changeRoot}/**`, ...(authorization?.paths ?? []), ...foldTargets, evidence.review_record_path, evidence.activation_record_path]
  };
}

function inGovernedScope(path, scope) {
  return scope.patterns.some((pattern) => authorizedPathMatches(path, pattern));
}

function applyScopeDiagnostics(changes, scope) {
  if (scope.authorization === null) {
    return [diagnostic("apply-scope-unauthorized", scope.changeRoot, "the range changes an active governed change that has no apply authorization")];
  }
  return [
    ...scope.authorization.diagnostics.map((message) => diagnostic("apply-authorization-invalid", scope.changeRoot, message)),
    ...changes
      .filter((path) => !inGovernedScope(path, scope))
      .map((path) => diagnostic("apply-scope-exceeded", path, "changed path is outside the exact apply-authorized scope"))
  ];
}

/** The commit that introduced the HEAD bytes of a path, located from history rather than from HEAD's parents. */
function introducingCommit(repoRoot, path) {
  const current = gitObjectAt(repoRoot, "HEAD", path);
  const commit = current ? gitStdout(repoRoot, ["log", "-1", "--format=%H", "HEAD", "--", path]) : null;
  return commit && gitObjectAt(repoRoot, commit, path) === current ? commit : null;
}

export function classifySourceChanges(policy, before, after, activeDeltas, sourcePath) {
  const diagnostics = [];
  const changes = changedJsonPointers(before, after);
  const results = [];
  for (const pointer of changes) {
    const rows = (policy.semantic_delegation ?? []).filter((row) =>
      row.source_patterns.some((pattern) => pointerPatternCovers(pattern, pointer))
    );
    const semanticRows = rows.filter((row) => row.classification === "SEMANTIC_REQUIREMENT");
    const representationOnly = rows.length > 0 && semanticRows.length === 0
      && rows.every((row) => row.classification === "REPRESENTATION_DETAIL" && row.delegation === "REPRESENTATION_DETAIL");
    if (representationOnly) {
      results.push({ pointer, classification: "REPRESENTATION_DETAIL", authorized_by: [] });
      continue;
    }
    const requiredCapabilities = new Set(semanticRows.flatMap((row) => row.capability_ids));
    const authorizers = activeDeltas.filter((delta) =>
      delta.class === "ACTIVE_CANDIDATE_DELTA"
      && requiredCapabilities.has(delta.capability_id)
      && delta.authorized_paths.some((entry) => authorizedPathMatches(sourcePath, entry))
      && semanticRows.some((row) => delta.authorized_semantic_dimensions.includes(row.dimension))
      && delta.authorized_source_pointers.some((pattern) => pointerPatternCovers(pattern, pointer))
    );
    if (semanticRows.length === 0) {
      diagnostics.push(diagnostic("source-semantic-classification-missing", `${sourcePath}#${pointer}`, "changed source property defaults to semantic and has no explicit owner/delegation mapping"));
    } else if (authorizers.length === 0) {
      diagnostics.push(diagnostic("source-semantic-change-unauthorized", `${sourcePath}#${pointer}`, `semantic change requires an exact apply-authorized delta for ${[...requiredCapabilities].join(", ")}`));
    }
    results.push({
      pointer,
      classification: "SEMANTIC_REQUIREMENT",
      dimensions: semanticRows.map((row) => row.dimension),
      authorized_by: authorizers.map((entry) => `${entry.change_id}:${entry.capability_id}`)
    });
  }
  return { changes: results, diagnostics, materialSemanticChange: results.some((entry) => entry.classification === "SEMANTIC_REQUIREMENT") };
}

function validateSourceShape(value, path, rules) {
  const diagnostics = [];
  if (Array.isArray(value)) {
    value.forEach((entry) => diagnostics.push(...validateSourceShape(entry, `${path === "/" ? "" : path}/*`, rules)));
    return diagnostics;
  }
  if (value === null || typeof value !== "object") return diagnostics;
  const rule = rules.find((entry) => shapePatternMatches(entry.path, path));
  if (!rule) {
    diagnostics.push(diagnostic("source-object-shape-unclassified", path, "object shape has no governed ownership/delegation rule"));
    return diagnostics;
  }
  for (const key of Object.keys(value)) {
    if (!rule.allowed_keys.includes(key)) {
      diagnostics.push(diagnostic("source-property-ownership-missing", `${path === "/" ? "" : path}/${key}`, "property has no explicit semantic or representation classification"));
      continue;
    }
    diagnostics.push(...validateSourceShape(value[key], `${path === "/" ? "" : path}/${key}`, rules));
  }
  return diagnostics;
}

function gitPathsBetween(repoRoot, from, to) {
  const result = spawnSync("git", ["diff", "--name-only", `${from}...${to}`], { cwd: repoRoot, encoding: "utf8" });
  return result.status === 0 ? result.stdout.split("\n").filter(Boolean) : null;
}

function gitObjectAt(repoRoot, commit, path) {
  return gitStdout(repoRoot, ["rev-parse", `${commit}:${path}`]);
}

function pathCoveredBy(path, boundPath) {
  return path === boundPath || path.startsWith(`${boundPath}/`);
}

export function validateLifecycleEvidence(evidence, policy) {
  const diagnostics = [];
  if (!evidence || evidence.change_id !== policy.change_id) {
    return [diagnostic("lifecycle-evidence-change-mismatch", "lifecycle.change_id", "lifecycle evidence must name the governed change")];
  }
  for (const [field, lifecycle] of [
    ["change_record", policy.change_record_lifecycle],
    ["contract_candidate", policy.contract_candidate_lifecycle]
  ]) {
    const declared = evidence[field];
    if (field === "contract_candidate" && declared?.applicability === "NOT_APPLICABLE") {
      if (typeof declared.reason !== "string" || declared.reason.length === 0 || "current_state" in declared || "transitions" in declared) {
        diagnostics.push(diagnostic("lifecycle-evidence-shape-invalid", `lifecycle.${field}`, "a not-applicable contract candidate carries only its reason"));
      }
      continue;
    }
    if (!declared || !lifecycle.states.includes(declared.current_state) || !Array.isArray(declared.transitions)) {
      diagnostics.push(diagnostic("lifecycle-evidence-shape-invalid", `lifecycle.${field}`, "current state and transition evidence are required"));
      continue;
    }
    let previous = null;
    for (const [index, transition] of declared.transitions.entries()) {
      if (previous !== null && transition.from !== previous) {
        diagnostics.push(diagnostic("lifecycle-evidence-sequence-gap", `lifecycle.${field}.transitions[${index}]`, "transition does not continue the declared sequence"));
      }
      if (!transitionAllowed(lifecycle, transition.from, transition.to)) {
        diagnostics.push(diagnostic("lifecycle-transition-illegal", `lifecycle.${field}.transitions[${index}]`, `${transition.from}->${transition.to}`));
      }
      if (!Array.isArray(transition.evidence_paths) || transition.evidence_paths.length === 0) {
        diagnostics.push(diagnostic("lifecycle-transition-evidence-missing", `lifecycle.${field}.transitions[${index}]`, "repository evidence paths are required"));
      }
      previous = transition.to;
    }
    if (previous !== null && previous !== declared.current_state) {
      diagnostics.push(diagnostic("lifecycle-current-state-mismatch", `lifecycle.${field}.current_state`, "current state does not equal the final evidenced transition"));
    }
  }
  return diagnostics;
}

function inspectLifecycleEvidence(repoRoot, policy, { stage, changes }, diagnostics, observations) {
  const path = `${policy.repository_evidence.active_changes_root}/${policy.change_id}/${policy.repository_evidence.lifecycle_evidence_file}`;
  if (!existsSync(resolve(repoRoot, path))) {
    const entry = diagnostic("lifecycle-evidence-pending", path, "repository lifecycle evidence is not yet recorded");
    if (stage === "candidate") observations.push(entry);
    else diagnostics.push(entry);
    return null;
  }
  const evidence = readJson(resolve(repoRoot, path));
  diagnostics.push(...validateLifecycleEvidence(evidence, policy));
  for (const machine of [evidence.change_record, evidence.contract_candidate]) {
    for (const transition of machine?.transitions ?? []) {
      for (const evidencePath of transition.evidence_paths ?? []) {
        if (!existsSync(resolve(repoRoot, evidencePath))) {
          diagnostics.push(diagnostic("lifecycle-transition-evidence-unavailable", evidencePath, "declared transition evidence path does not exist"));
        }
      }
    }
  }
  const candidate = evidence.contract_candidate;
  const candidateApplies = candidate?.applicability !== "NOT_APPLICABLE";
  if (!candidateApplies) {
    const unproven = stage === "candidate" && changes === null;
    (unproven ? observations : diagnostics).push(...contractCandidateApplicability(policy, path, changes));
  }
  const changeState = evidence.change_record?.current_state;
  if (stage === "merge" && !["VERIFIED", "FOLDED"].includes(changeState)) {
    diagnostics.push(diagnostic("lifecycle-stage-not-ready", path, "merge requires a verified or folded change record"));
  }
  if (["activation", "release"].includes(stage) && changeState !== "FOLDED") {
    diagnostics.push(diagnostic("lifecycle-stage-not-ready", path, "activation/release requires every affected delta to be folded"));
  }
  // ACTIVATED and RELEASED are evidenced by their dedicated records, not by
  // rewriting this reviewed file, so later stages still read MERGED here.
  const requiredCandidateStates = { merge: ["MERGE_READY", "MERGED"], activation: ["MERGED"], release: ["MERGED"] }[stage];
  if (candidateApplies && requiredCandidateStates && !requiredCandidateStates.includes(candidate?.current_state)) {
    diagnostics.push(diagnostic("lifecycle-stage-not-ready", `${path}#contract_candidate`, `${stage} requires a contract candidate in ${requiredCandidateStates.join(" or ")}`));
  }
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

function inspectReviewEvidence(repoRoot, policy, { stage, scope }, diagnostics, observations) {
  const path = policy.repository_evidence.review_record_path;
  if (!existsSync(resolve(repoRoot, path))) {
    const entry = diagnostic("review-binding-pending", path, "exact project-owner review record is not yet stored");
    if (stage === "candidate") observations.push(entry);
    else diagnostics.push(entry);
    return null;
  }
  const binding = readJson(resolve(repoRoot, path));
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
  const postReview = technicalCommit ? gitPathsBetween(repoRoot, technicalCommit, "HEAD") : null;
  if (technicalCommit && postReview === null) {
    diagnostics.push(diagnostic("review-binding-history-unavailable", path, "cannot enumerate changes after the reviewed technical commit"));
  }
  diagnostics.push(...validateReviewBinding(binding, {
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
    },
    // Only the governed change's own paths or its reviewed set can stale the
    // review; unrelated protected-history commits after merge cannot.
    changedPaths: (postReview ?? []).filter((entry) => inGovernedScope(entry, scope) || governedPaths.includes(entry)),
    allowedRecordPaths: recordOnly
  }));
  for (const [boundPath, boundObject] of Object.entries(expectedObjects)) {
    if (gitObjectAt(repoRoot, "HEAD", boundPath) !== boundObject) {
      diagnostics.push(diagnostic("review-binding-post-review-change", `review.governed_path_objects.${boundPath}`, "a reviewed object differs at HEAD"));
    }
  }
  if (binding.change_id !== policy.change_id || binding.signed !== true) diagnostics.push(diagnostic("review-binding-authority-invalid", path, "review must be a signed decision for this exact change"));
  const requiredGrant = stage === "merge" ? policy.governance_authorities.merge_grant
    : ["activation", "release"].includes(stage) ? policy.governance_authorities.activation_grant : null;
  if (requiredGrant && !binding.authorization_granted?.includes(requiredGrant)) {
    diagnostics.push(diagnostic("review-binding-authorization-missing", path, `review does not grant ${requiredGrant}`));
  }
  if (technicalCommit && !isAncestorCommit(repoRoot, technicalCommit, "HEAD")) {
    diagnostics.push(diagnostic("review-binding-commit-unreachable", path, "reviewed technical commit is not an ancestor of HEAD"));
  }
  return { path, binding, object: gitObject(repoRoot, path), expectedObjects };
}

function reviewComparisonBase(repoRoot, binding, scope, diagnostics) {
  const base = binding.base_commit;
  if (typeof base !== "string" || !/^[0-9a-f]{40}$/.test(base)) {
    diagnostics.push(diagnostic("review-binding-floating", "review.base_commit", "review must bind a full comparison-base object ID"));
    return null;
  }
  const authorizedBase = scope.authorization?.candidate_base ?? null;
  if (authorizedBase && base !== authorizedBase) {
    diagnostics.push(diagnostic("review-binding-value-mismatch", "review.base_commit", "review base differs from the apply-authorized candidate base"));
  }
  if (typeof binding.technical_commit === "string" && !isAncestorCommit(repoRoot, base, binding.technical_commit)) {
    diagnostics.push(diagnostic("review-binding-base-unavailable", "review.base_commit", "review base is not an ancestor of the reviewed technical commit"));
    return null;
  }
  return base;
}

function inspectActivationEvidence(repoRoot, policy, stage, review, diagnostics, observations) {
  const path = policy.repository_evidence.activation_record_path;
  if (!existsSync(resolve(repoRoot, path))) {
    const entry = diagnostic("activation-evidence-pending", path, "dedicated activation evidence is not yet stored");
    if (["candidate", "merge"].includes(stage)) observations.push(entry);
    else diagnostics.push(entry);
    return null;
  }
  const record = readJson(resolve(repoRoot, path));
  // The dedicated activation commit is located from history. HEAD may be a
  // later protected commit or a CI merge ref, neither of which is the record.
  const activationCommit = introducingCommit(repoRoot, path);
  if (activationCommit === null || gitObject(repoRoot, path) !== gitObjectAt(repoRoot, "HEAD", path)) {
    diagnostics.push(diagnostic("activation-record-uncommitted", path, "activation evidence must be committed so its dedicated commit can be located"));
  }
  const parentLine = activationCommit ? gitStdout(repoRoot, ["show", "-s", "--format=%P", activationCommit]) : null;
  const parents = parentLine ? parentLine.split(" ").filter(Boolean) : [];
  const mergeCommit = parents.length === 1 ? parents[0] : null;
  const mergeTree = mergeCommit ? gitStdout(repoRoot, ["rev-parse", `${mergeCommit}^{tree}`]) : null;
  const changed = mergeCommit ? gitPathsBetween(repoRoot, mergeCommit, activationCommit) : null;
  const expectedValues = review ? {
    activated_commit: mergeCommit,
    activated_tree: mergeTree,
    reviewed_technical_commit: review.binding.technical_commit,
    reviewed_tree: review.binding.tree,
    contract_version: review.binding.contract_version,
    scope: [policy.change_id],
    protected_reference: policy.repository_evidence.protected_reference,
    effective_event: "activation-record-commit",
    parent_commit: mergeCommit,
    authorization_granted: [policy.governance_authorities.activation_grant]
  } : {};
  diagnostics.push(...validateActivation(record, {
    requiredFields: policy.activation.required_fields,
    authorizingDecision: review?.binding,
    requiredGrant: policy.governance_authorities.activation_grant,
    authorizingDecisionObject: review?.object,
    activationRecordObject: gitObject(repoRoot, path),
    mergeCommit,
    mergeTree,
    parentCount: parents.length,
    reviewedObjects: review?.binding.governed_path_objects,
    allowedRecordPaths: [path],
    changedPaths: changed ?? [],
    expectedValues
  }));
  if (record.required_check_evidence?.verified !== true) diagnostics.push(diagnostic("activation-required-check-unverified", `${path}#required_check_evidence`, "required-check enforcement must be verified"));
  return record;
}

export function inspectRepository(repoRoot, policy, { stage = "candidate", schema = null, baseCommit = null } = {}) {
  const diagnostics = [...validatePolicy(policy, schema)];
  const observations = [];
  if (!STAGES.includes(stage)) diagnostics.push(diagnostic("stage-unknown", "stage", stage));
  const sourcePath = policy.contract?.source_path;
  const absoluteSource = resolve(repoRoot, sourcePath ?? "");
  if (!sourcePath || !existsSync(absoluteSource)) {
    diagnostics.push(diagnostic("contract-source-missing", sourcePath ?? "contract.source", "authoritative source is unavailable"));
    return { diagnostics, observations, discovered: { current: [], active: [], archived: [] } };
  }
  const source = readJson(absoluteSource);
  let contractVersion = null;
  try {
    contractVersion = getJsonPointer(source, policy.contract.version_pointer);
  } catch (error) {
    diagnostics.push(diagnostic("contract-version-unavailable", `${sourcePath}#${policy.contract.version_pointer}`, error.message));
  }
  diagnostics.push(...validateSourceShape(source, "/", policy.source_shape ?? []));
  const repositoryChanges = changedPaths(repoRoot, baseCommit);
  if (baseCommit && repositoryChanges === null) {
    diagnostics.push(diagnostic("comparison-base-unavailable", "git", baseCommit));
  }
  if (!baseCommit) {
    const entry = diagnostic("comparison-base-required", "base", "an exact comparison base is required to classify changes and scope governed evidence");
    if (stage === "candidate") observations.push(entry);
    else diagnostics.push(entry);
  }
  const covered = sourceSections(policy);
  for (const key of Object.keys(source)) {
    if (!covered.has(key)) diagnostics.push(diagnostic("source-section-ownership-missing", `${sourcePath}#/${key}`, "source section has no governed semantic owner/delegation"));
  }
  for (const key of covered) {
    if (!(key in source)) observations.push(diagnostic("owned-source-section-absent", `${sourcePath}#/${key}`, "owned section is not present in this source revision"));
  }
  const discovered = discoverRepositorySources(repoRoot, policy, { sourcePath, contractVersion });
  for (const capability of discovered.current) {
    if (capability.applies && !capability.exists) diagnostics.push(diagnostic("applicable-capability-missing", capability.path, capability.id));
  }
  for (const overlap of policy.capability_overlaps ?? []) {
    for (const [capabilityId, expectedObject] of Object.entries(overlap.capability_objects ?? {})) {
      const capability = discovered.current.find((entry) => entry.id === capabilityId);
      if (!capability?.applies) {
        diagnostics.push(diagnostic("capability-overlap-applicability-missing", `capability_overlaps.${overlap.id}`, capabilityId));
      } else if (capability.object !== expectedObject) {
        diagnostics.push(diagnostic("capability-overlap-classification-stale", capability.path, `${overlap.id} does not bind the current capability object`));
      }
    }
    if (overlap.classification === "CONTRADICTORY") {
      diagnostics.push(diagnostic("applicable-current-capability-conflict", `capability_overlaps.${overlap.id}`, "applicable current capabilities have no automatic winner"));
    } else if (overlap.classification === "DUPLICATE_CONSISTENT") {
      observations.push(diagnostic("capability-overlap-duplicate-consistent", `capability_overlaps.${overlap.id}`, "applicable current capabilities restate one consistent requirement; both remain binding"));
    } else if (overlap.classification === "COMPATIBLE_OVERLAP") {
      observations.push(diagnostic("capability-overlap-compatible", `capability_overlaps.${overlap.id}`, overlap.rule));
    } else {
      diagnostics.push(diagnostic("capability-overlap-ambiguous", `capability_overlaps.${overlap.id}`, "overlap classification is outside the closed classes"));
    }
  }
  const overlapCount = (name) => (policy.capability_overlaps ?? []).filter((entry) => entry.classification === name).length;
  const noOverlap = (policy.requirement_ownership ?? []).filter((entry) => entry.overlap === "SINGLE_OWNER").length;
  observations.push(diagnostic("capability-overlap-summary", "capability_overlaps",
    [`NO_OVERLAP=${noOverlap}`, ...["COMPATIBLE_OVERLAP", "DUPLICATE_CONSISTENT", "CONTRADICTORY"].map((name) => `${name}=${overlapCount(name)}`)].join(" ")));
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
  for (const assertion of policy.semantic_assertions ?? []) {
    const capability = discovered.current.find((entry) => entry.id === assertion.capability_id);
    if (!capability?.applies || !capability.exists) continue;
    const markdown = readFileSync(resolve(repoRoot, capability.path), "utf8");
    const requirement = extractRequirement(markdown, assertion.requirement_heading);
    if (!requirement) {
      diagnostics.push(diagnostic("applicable-requirement-missing", capability.path, `${assertion.capability_id}: ${assertion.requirement_heading}`));
      continue;
    }
    let value;
    try {
      value = getJsonPointer(source, assertion.source_pointer);
    } catch (error) {
      diagnostics.push(diagnostic("semantic-assertion-source-missing", `${sourcePath}#${assertion.source_pointer}`, error.message));
      continue;
    }
    if (assertion.adapter !== "source-value-present-in-requirement") {
      diagnostics.push(diagnostic("semantic-assertion-adapter-unknown", assertion.id, assertion.adapter));
      continue;
    }
    if (!requirement.includes(`\`${String(value)}\``)) {
      const sourceObject = gitObject(repoRoot, sourcePath);
      const debt = baselineDebtFor(policy, assertion, sourceObject, capability.object);
      if (debtAllowedAtStage(debt, stage, repositoryChanges ?? [])) {
        observations.push(diagnostic("baseline-conflict-bounded", assertion.id, `${debt.id} is unchanged, scope-bounded, and blocks activation/release`));
      } else {
        diagnostics.push(diagnostic(debt ? "baseline-conflict-stage-block" : "source-capability-conflict", assertion.id, `source value ${JSON.stringify(value)} is not authorized by ${assertion.capability_id}`));
      }
    }
  }
  let sourceChange = { changes: [], diagnostics: [], materialSemanticChange: false };
  if (baseCommit) {
    const beforeSource = jsonAtCommit(repoRoot, baseCommit, sourcePath);
    if (beforeSource === null) {
      diagnostics.push(diagnostic("comparison-source-unavailable", `${baseCommit}:${sourcePath}`, "cannot classify source changes without the exact baseline source"));
    } else {
      sourceChange = classifySourceChanges(policy, beforeSource, source, discovered.active, sourcePath);
      diagnostics.push(...sourceChange.diagnostics);
    }
  }
  if (sourceChange.materialSemanticChange) {
    const decisions = activeChangeDirectories(repoRoot)
      .map((changeDir) => resolve(changeDir, "compatibility-decision.json"))
      .filter(existsSync)
      .map(readJson);
    if (decisions.length !== 1) {
      diagnostics.push(diagnostic("compatibility-transition-unclassified", sourcePath, "a changed authoritative source requires exactly one active compatibility decision"));
    } else {
      diagnostics.push(...validateCompatibilityTransition(decisions[0], policy));
    }
  }
  const scope = governedChangeScope(repoRoot, policy);
  const rangeChanges = baseCommit && Array.isArray(repositoryChanges) ? repositoryChanges : null;
  const rangeTouchesChange = rangeChanges !== null && rangeChanges.some((path) => inGovernedScope(path, scope));
  let lifecycle = null;
  let review = null;
  let activation = null;
  if (scope.active) {
    if (rangeTouchesChange) {
      diagnostics.push(...applyScopeDiagnostics(rangeChanges, scope));
    } else if (stage !== "candidate") {
      observations.push(diagnostic("governed-change-out-of-range", scope.changeRoot, `the inspected range does not touch ${policy.change_id}; its ${stage}-stage evidence requirements do not apply`));
    }
    // A range that does not touch the governed change cannot be blocked by that
    // change's stage requirements, but its existing records are still verified.
    const evidenceStage = rangeTouchesChange ? stage : "candidate";
    let lifecycleChanges = false;
    if (rangeTouchesChange) lifecycleChanges = rangeChanges;
    else if (rangeChanges === null) lifecycleChanges = null;
    lifecycle = inspectLifecycleEvidence(repoRoot, policy, { stage: evidenceStage, changes: lifecycleChanges }, diagnostics, observations);
    review = inspectReviewEvidence(repoRoot, policy, { stage: evidenceStage, scope }, diagnostics, observations);
    activation = inspectActivationEvidence(repoRoot, policy, evidenceStage, review, diagnostics, observations);
  } else {
    observations.push(diagnostic("governed-change-inactive", scope.changeRoot, "change-specific lifecycle, review, and activation evidence applies only while the governed change is active"));
  }
  const applicableCount = discovered.current.filter((entry) => entry.applies).length;
  const authorizedDeltaCount = discovered.active.filter((entry) => entry.class === "ACTIVE_CANDIDATE_DELTA").length;
  observations.push(diagnostic("repository-source-discovery", "openspec", `${applicableCount} applicable current capabilities, ${authorizedDeltaCount} active authorized deltas, ${discovered.archived.length} archived deltas`));
  return { diagnostics, observations, discovered, sourceChange, lifecycle, review, activation };
}

export function validateReviewBinding(binding, expected) {
  const diagnostics = [];
  for (const field of expected.requiredFields ?? []) {
    if (!(field in (binding ?? {}))) diagnostics.push(diagnostic("review-binding-field-missing", `review.${field}`, "required exact review field is absent"));
  }
  if (!binding) return diagnostics;
  for (const field of ["technical_commit", "tree"]) {
    if (typeof binding[field] !== "string" || !/^[0-9a-f]{40}$/.test(binding[field])) {
      diagnostics.push(diagnostic("review-binding-floating", `review.${field}`, "binding must be a full object ID"));
    }
  }
  for (const field of ["technical_commit", "tree", "contract_version", "reviewer_identity", "reviewer_authority"]) {
    if (expected.values && field in expected.values && JSON.stringify(binding[field]) !== JSON.stringify(expected.values[field])) {
      diagnostics.push(diagnostic("review-binding-value-mismatch", `review.${field}`, "bound value differs from the exact reviewed expectation"));
    }
  }
  for (const field of ["decision_scope", "authorization_granted", "authorization_withheld"]) {
    if (expected.values && field in expected.values) {
      const actual = Array.isArray(binding[field]) ? [...binding[field]].sort() : binding[field];
      const wanted = Array.isArray(expected.values[field]) ? [...expected.values[field]].sort() : expected.values[field];
      if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
        diagnostics.push(diagnostic("review-binding-value-mismatch", `review.${field}`, "bound set differs from the exact reviewed expectation"));
      }
    }
  }
  const entries = binding.governed_path_objects ?? {};
  const expectedPaths = [...(expected.paths ?? [])].sort();
  const actualPaths = Object.keys(entries).sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    diagnostics.push(diagnostic("review-binding-partial", "review.governed_path_objects", "complete governed path membership is required"));
  }
  for (const path of expectedPaths) {
    if (typeof entries[path] !== "string" || !/^[0-9a-f]{40}$/.test(entries[path])) {
      diagnostics.push(diagnostic("review-binding-floating", `review.governed_path_objects.${path}`, "governed object must be a full object ID"));
    }
    if (entries[path] !== expected.objects?.[path]) {
      diagnostics.push(diagnostic("review-binding-stale", `review.governed_path_objects.${path}`, "bound object differs from reviewed content"));
    }
  }
  if (expected.changedPaths?.some((path) => !expected.allowedRecordPaths?.includes(path))) {
    diagnostics.push(diagnostic("review-binding-post-review-change", "review.changed_paths", "a post-review path is outside the closed governance-record-only allowlist"));
  }
  return diagnostics;
}

export function validateActivation(record, context) {
  const diagnostics = [];
  for (const field of context.requiredFields ?? []) {
    if (!(field in (record ?? {}))) diagnostics.push(diagnostic("activation-field-missing", `activation.${field}`, "required activation field is absent"));
  }
  if (!record) return diagnostics;
  for (const [field, expected] of Object.entries(context.expectedValues ?? {})) {
    const actual = Array.isArray(record[field]) ? [...record[field]].sort() : record[field];
    const wanted = Array.isArray(expected) ? [...expected].sort() : expected;
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      diagnostics.push(diagnostic("activation-binding-mismatch", `activation.${field}`, "activation value differs from the exact authorized expectation"));
    }
  }
  const requiredGrant = context.requiredGrant ?? "activation";
  if (!context.authorizingDecision?.authorization_granted?.includes(requiredGrant)) {
    diagnostics.push(diagnostic("activation-authorization-missing", "activation.authorizing_decision_object", "an independent exact reviewed decision must grant activation"));
  }
  if (record.authorizing_decision_object === context.activationRecordObject) {
    diagnostics.push(diagnostic("activation-self-authorized", "activation.authorizing_decision_object", "activation evidence cannot authorize itself"));
  }
  if (context.authorizingDecisionObject && record.authorizing_decision_object !== context.authorizingDecisionObject) {
    diagnostics.push(diagnostic("activation-decision-binding-mismatch", "activation.authorizing_decision_object", "record does not bind the independently reviewed decision object"));
  }
  if (record.activated_commit !== context.mergeCommit || record.parent_commit !== context.mergeCommit || context.parentCount !== 1) {
    diagnostics.push(diagnostic("activation-parentage-invalid", "activation.parent_commit", "activation must be a dedicated direct child of the exact merge"));
  }
  if (context.mergeTree && record.activated_tree !== context.mergeTree) {
    diagnostics.push(diagnostic("activation-tree-binding-mismatch", "activation.activated_tree", "record does not bind the activated merge tree"));
  }
  if (context.reviewedObjects) {
    const expectedEntries = Object.entries(context.reviewedObjects).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    const actualEntries = Object.entries(record.governed_path_objects ?? {}).sort(([left], [right]) => left < right ? -1 : left > right ? 1 : 0);
    if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
      diagnostics.push(diagnostic("activation-governed-objects-mismatch", "activation.governed_path_objects", "activation must bind the complete reviewed object set"));
    }
  }
  for (const [path, object] of Object.entries(record.governed_path_objects ?? {})) {
    if (typeof object !== "string" || !/^[0-9a-f]{40}$/.test(object)) {
      diagnostics.push(diagnostic("activation-floating-reference", `activation.governed_path_objects.${path}`, "governed object must be a full object ID"));
    }
  }
  if (context.allowedRecordPaths && context.changedPaths?.some((path) => !context.allowedRecordPaths.includes(path))) {
    diagnostics.push(diagnostic("activation-record-scope-invalid", "activation.commit", "dedicated activation commit changed a non-record path"));
  }
  for (const field of [
    "activated_commit",
    "activated_tree",
    "reviewed_technical_commit",
    "reviewed_tree",
    "parent_commit",
    "authorizing_decision_object"
  ]) {
    if (typeof record[field] !== "string" || !/^[0-9a-f]{40}$/.test(record[field])) {
      diagnostics.push(diagnostic("activation-floating-reference", `activation.${field}`, "branch/version-only activation is forbidden"));
    }
  }
  return diagnostics;
}

export function validateCompatibilityTransition(change, policy) {
  if (!change?.material_semantic_change) return [];
  if (!change.compatibility_classification || !change.compatibility_policy_rule) {
    return [diagnostic("compatibility-transition-unclassified", "compatibility", "material semantic transition requires policy-backed classification")];
  }
  return [];
}

export function evaluatePolicyCase(policy, testCase) {
  const rule = policy.conflict_rules.find((entry) => entry.id === testCase.ruleId);
  if (!rule) return { ok: false, diagnostics: [diagnostic("policy-case-rule-missing", testCase.ruleId, "conflict rule not found")] };
  const mismatches = [];
  const expected = {
    result: testCase.expectedResult,
    controlling: testCase.expectedControllingSource,
    merge: testCase.expectedMergeEffect,
    activation: testCase.expectedActivationEffect,
    release: testCase.expectedReleaseEffect
  };
  for (const [field, value] of Object.entries(expected)) {
    if (rule[field] !== value) mismatches.push(diagnostic("policy-case-mismatch", `${rule.id}.${field}`, `expected ${value}; actual ${rule[field]}`));
  }
  return { ok: mismatches.length === 0, diagnostics: mismatches, rule };
}

export function formatDiagnostics(result) {
  return result.map((entry) => `${entry.code} ${entry.path}: ${entry.message}`).join("\n");
}

export function assertRegularFile(path) {
  return existsSync(path) && statSync(path).isFile();
}
