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
    if (!Array.isArray(edge) || edge.length !== 2 || !lifecycle.states.includes(edge[0]) || !lifecycle.states.includes(edge[1])) {
      diagnostics.push(diagnostic("lifecycle-transition-invalid", `${path}.transitions[${index}]`, "transition endpoints must belong to this lifecycle"));
      continue;
    }
    const key = edge.join("->");
    if (edges.has(key)) diagnostics.push(diagnostic("lifecycle-transition-duplicate", `${path}.transitions[${index}]`, key));
    edges.add(key);
  }
  return diagnostics;
}

export function transitionAllowed(lifecycle, from, to) {
  return lifecycle.transitions.some(([left, right]) => left === from && right === to);
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
    for (const id of ownership.capability_ids ?? []) {
      if (!capabilityIds.has(id)) diagnostics.push(diagnostic("applicability-capability-missing", `requirement_ownership.${ownership.domain}`, id));
    }
    ownedSections.push(...(ownership.source_sections ?? []));
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
  if (!policy.review_binding?.floating_references_forbidden || !policy.review_binding?.partial_bindings_forbidden) {
    diagnostics.push(diagnostic("review-binding-not-exact", "review_binding", "floating and partial bindings must be forbidden"));
  }
  if (policy.activation?.mechanism !== "DEDICATED_POST_MERGE_DIRECT_CHILD_RECORD" || !policy.activation?.record_cannot_self_authorize || !policy.activation?.branch_or_version_only_forbidden) {
    diagnostics.push(diagnostic("activation-model-unsafe", "activation", "activation must use an exact authorized direct-child record"));
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

function activeDeltaAuthorized(changeDir, capabilityId, repoRoot) {
  const authorization = resolve(changeDir, "apply-authorization.md");
  const proposal = resolve(changeDir, "proposal.md");
  if (!existsSync(authorization) || !existsSync(proposal)) return false;
  const authorizationText = readFileSync(authorization, "utf8");
  const proposalCommit = authorizationText.match(/Authorized proposal commit \| `([0-9a-f]{40})`/)?.[1];
  const proposalTree = authorizationText.match(/Repository tree(?: at that commit)? \| `([0-9a-f]{40})`/)?.[1];
  if (!proposalCommit || !proposalTree) return false;
  if (gitStdout(repoRoot, ["rev-parse", `${proposalCommit}^{tree}`]) !== proposalTree) return false;
  if (spawnSync("git", ["merge-base", "--is-ancestor", proposalCommit, "HEAD"], { cwd: repoRoot }).status !== 0) return false;
  const proposalAtCommit = gitStdout(repoRoot, ["show", `${proposalCommit}:${relative(repoRoot, proposal)}`]);
  return proposalAtCommit?.includes(`\`${capabilityId}\``) === true;
}

export function discoverRepositorySources(repoRoot, policy) {
  const current = (policy.capabilities ?? []).map((capability) => ({
    ...capability,
    exists: existsSync(resolve(repoRoot, capability.path)),
    object: gitObject(repoRoot, capability.path)
  }));
  const active = activeChangeDirectories(repoRoot).flatMap((changeDir) =>
    discoverDeltaSpecs(changeDir, repoRoot).map((delta) => ({
      ...delta,
      change_id: basename(changeDir),
      class: activeDeltaAuthorized(changeDir, delta.capability_id, repoRoot)
        ? "ACTIVE_CANDIDATE_DELTA"
        : "PROPOSED_CANDIDATE_DELTA"
    }))
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
  diagnostics.push(...validateSourceShape(source, "/", policy.source_shape ?? []));
  const repositoryChanges = changedPaths(repoRoot, baseCommit);
  if (baseCommit && repositoryChanges === null) {
    diagnostics.push(diagnostic("comparison-base-unavailable", "git", baseCommit));
  }
  const covered = sourceSections(policy);
  for (const key of Object.keys(source)) {
    if (!covered.has(key)) diagnostics.push(diagnostic("source-section-ownership-missing", `${sourcePath}#/${key}`, "source section has no governed semantic owner/delegation"));
  }
  for (const key of covered) {
    if (!(key in source)) observations.push(diagnostic("owned-source-section-absent", `${sourcePath}#/${key}`, "owned section is not present in this source revision"));
  }
  const discovered = discoverRepositorySources(repoRoot, policy);
  for (const capability of discovered.current) {
    if (!capability.exists) diagnostics.push(diagnostic("applicable-capability-missing", capability.path, capability.id));
  }
  for (const assertion of policy.semantic_assertions ?? []) {
    const capability = discovered.current.find((entry) => entry.id === assertion.capability_id);
    if (!capability?.exists) continue;
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
    if (assertion.adapter === "source-value-present-in-requirement" && !requirement.includes(`\`${String(value)}\``)) {
      const sourceObject = gitObject(repoRoot, sourcePath);
      const debt = baselineDebtFor(policy, assertion, sourceObject, capability.object);
      if (debtAllowedAtStage(debt, stage, repositoryChanges ?? [])) {
        observations.push(diagnostic("baseline-conflict-bounded", assertion.id, `${debt.id} is unchanged, scope-bounded, and blocks activation/release`));
      } else {
        diagnostics.push(diagnostic(debt ? "baseline-conflict-stage-block" : "source-capability-conflict", assertion.id, `source value ${JSON.stringify(value)} is not authorized by ${assertion.capability_id}`));
      }
    }
  }
  if (repositoryChanges?.includes(sourcePath)) {
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
  observations.push(diagnostic("repository-source-discovery", "openspec", `${discovered.current.length} current capabilities, ${discovered.active.length} active deltas, ${discovered.archived.length} archived deltas`));
  return { diagnostics, observations, discovered };
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
  const entries = binding.governed_path_objects ?? {};
  const expectedPaths = [...(expected.paths ?? [])].sort();
  const actualPaths = Object.keys(entries).sort();
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    diagnostics.push(diagnostic("review-binding-partial", "review.governed_path_objects", "complete governed path membership is required"));
  }
  for (const path of expectedPaths) {
    if (entries[path] !== expected.objects?.[path]) {
      diagnostics.push(diagnostic("review-binding-stale", `review.governed_path_objects.${path}`, "bound object differs from reviewed content"));
    }
  }
  return diagnostics;
}

export function validateActivation(record, context) {
  const diagnostics = [];
  for (const field of context.requiredFields ?? []) {
    if (!(field in (record ?? {}))) diagnostics.push(diagnostic("activation-field-missing", `activation.${field}`, "required activation field is absent"));
  }
  if (!record) return diagnostics;
  if (!context.authorizingDecision?.authorization_granted?.includes("activation")) {
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
    const expectedEntries = Object.entries(context.reviewedObjects).sort(([left], [right]) => left.localeCompare(right));
    const actualEntries = Object.entries(record.governed_path_objects ?? {}).sort(([left], [right]) => left.localeCompare(right));
    if (JSON.stringify(actualEntries) !== JSON.stringify(expectedEntries)) {
      diagnostics.push(diagnostic("activation-governed-objects-mismatch", "activation.governed_path_objects", "activation must bind the complete reviewed object set"));
    }
  }
  if (context.allowedRecordPaths && context.changedPaths?.some((path) => !context.allowedRecordPaths.includes(path))) {
    diagnostics.push(diagnostic("activation-record-scope-invalid", "activation.commit", "dedicated activation commit changed a non-record path"));
  }
  for (const field of ["activated_commit", "activated_tree", "parent_commit", "authorizing_decision_object"]) {
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
