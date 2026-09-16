import {
  byCodePoint,
  diagnostic,
  REQUIRED_SEMANTIC_DIMENSIONS,
  unique
} from "./shared.mjs";

function transitionEndpointsAreValid(lifecycle, edge) {
  if (!edge) return false;
  if (typeof edge !== "object") return false;
  return lifecycle.states.includes(edge.from) && lifecycle.states.includes(edge.to);
}

function validateTransitionFields(edge, transitionPath) {
  const diagnostics = [];
  for (const field of ["entering_authority", "semantic_claim", "invalidation"]) {
    const value = edge[field];
    if (typeof value !== "string" || value.length === 0) {
      diagnostics.push(diagnostic("lifecycle-transition-evidence-incomplete", `${transitionPath}.${field}`, "transition governance field is required"));
    }
  }
  for (const field of ["required_evidence", "permitted_operations"]) {
    const value = edge[field];
    if (!Array.isArray(value) || value.length === 0) {
      diagnostics.push(diagnostic("lifecycle-transition-evidence-incomplete", `${transitionPath}.${field}`, "transition governance list is required"));
    }
  }
  return diagnostics;
}

function validateTransition({ lifecycle, path, index, edge, edges }) {
  const transitionPath = `${path}.transitions[${index}]`;
  if (!transitionEndpointsAreValid(lifecycle, edge)) {
    return [diagnostic("lifecycle-transition-invalid", transitionPath, "transition endpoints must belong to this lifecycle")];
  }
  const diagnostics = [];
  const key = `${edge.from}->${edge.to}`;
  if (edges.has(key)) diagnostics.push(diagnostic("lifecycle-transition-duplicate", transitionPath, key));
  edges.add(key);
  diagnostics.push(...validateTransitionFields(edge, transitionPath));
  return diagnostics;
}

export function validateLifecycle(name, lifecycle) {
  const path = `${name}`;
  if (!lifecycle || !Array.isArray(lifecycle.states) || !Array.isArray(lifecycle.transitions)) {
    return [diagnostic("lifecycle-shape-invalid", path, "states and transitions are required")];
  }
  const diagnostics = [];
  if (!unique(lifecycle.states)) {
    diagnostics.push(diagnostic("lifecycle-state-duplicate", `${path}.states`, "states must be unique"));
  }
  const edges = new Set();
  for (const [index, edge] of lifecycle.transitions.entries()) {
    diagnostics.push(...validateTransition({ lifecycle, path, index, edge, edges }));
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

function resolveSchemaReference(schema, root) {
  if (typeof schema.$ref !== "string") return schema;
  if (!schema.$ref.startsWith("#/")) throw new Error(`unsupported schema reference ${schema.$ref}`);
  const resolved = schema.$ref.slice(2).split("/")
    .reduce((node, token) => node?.[token.replaceAll("~1", "/").replaceAll("~0", "~")], root);
  if (!resolved || typeof resolved !== "object") throw new Error(`unresolved schema reference ${schema.$ref}`);
  return resolved;
}

function validateSchemaValue(value, schema, path) {
  const diagnostics = [];
  if (schema.const !== undefined && JSON.stringify(value) !== JSON.stringify(schema.const)) {
    diagnostics.push(diagnostic("policy-schema-const", path, "value differs from schema const"));
  }
  if (schema.enum && !schema.enum.some((entry) => JSON.stringify(entry) === JSON.stringify(value))) {
    diagnostics.push(diagnostic("policy-schema-enum", path, "value is outside the closed enum"));
  }
  const validType = !schema.type || typeMatches(value, schema.type);
  if (!validType) diagnostics.push(diagnostic("policy-schema-type", path, `expected ${schema.type}`));
  return { diagnostics, validType };
}

function validateRequiredProperties(value, schema, path) {
  const diagnostics = [];
  for (const key of schema.required ?? []) {
    if (!(key in value)) diagnostics.push(diagnostic("policy-schema-required", `${path}.${key}`, "required property is absent"));
  }
  return diagnostics;
}

function validateAdditionalProperties(value, schema, path) {
  const diagnostics = [];
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(value)) {
      if (!(key in (schema.properties ?? {}))) diagnostics.push(diagnostic("policy-schema-additional", `${path}.${key}`, "additional property is forbidden"));
    }
  }
  return diagnostics;
}

function validateChildProperties(value, schema, path, root) {
  const diagnostics = [];
  for (const [key, childSchema] of Object.entries(schema.properties ?? {})) {
    if (key in value) diagnostics.push(...validatePolicySchema(value[key], childSchema, `${path}.${key}`, root));
  }
  return diagnostics;
}

function validateSchemaObject(value, schema, path, root) {
  return [
    ...validateRequiredProperties(value, schema, path),
    ...validateAdditionalProperties(value, schema, path),
    ...validateChildProperties(value, schema, path, root)
  ];
}

function validateSchemaArray(value, schema, path, root) {
  const diagnostics = [];
  if (schema.minItems !== undefined && value.length < schema.minItems) diagnostics.push(diagnostic("policy-schema-min-items", path, `minimum is ${schema.minItems}`));
  if (schema.uniqueItems && !unique(value.map((entry) => JSON.stringify(entry)))) diagnostics.push(diagnostic("policy-schema-unique", path, "items must be unique"));
  if (schema.items) value.forEach((entry, index) => diagnostics.push(...validatePolicySchema(entry, schema.items, `${path}[${index}]`, root)));
  return diagnostics;
}

function validateSchemaString(value, schema, path) {
  const diagnostics = [];
  if (schema.minLength !== undefined && value.length < schema.minLength) diagnostics.push(diagnostic("policy-schema-min-length", path, `minimum length is ${schema.minLength}`));
  if (schema.pattern && !new RegExp(schema.pattern).test(value)) diagnostics.push(diagnostic("policy-schema-pattern", path, "value does not match pattern"));
  return diagnostics;
}

export function validatePolicySchema(value, rawSchema, path = "$", root = rawSchema) {
  const schema = resolveSchemaReference(rawSchema, root);
  const valueResult = validateSchemaValue(value, schema, path);
  if (!valueResult.validType) return valueResult.diagnostics;
  const diagnostics = [...valueResult.diagnostics];
  if (schema.type === "object") diagnostics.push(...validateSchemaObject(value, schema, path, root));
  if (schema.type === "array") diagnostics.push(...validateSchemaArray(value, schema, path, root));
  if (schema.type === "string") diagnostics.push(...validateSchemaString(value, schema, path));
  return diagnostics;
}

function validateClassInventory(domains, classes) {
  const diagnostics = [];
  if (!unique(domains)) diagnostics.push(diagnostic("authority-domain-duplicate", "authority_domains", "authority domains must be unique"));
  if (!unique(classes.map((entry) => entry.id))) diagnostics.push(diagnostic("source-class-duplicate", "source_classes", "source class IDs must be unique"));
  for (const entry of classes) {
    if (!domains.includes(entry.domain)) diagnostics.push(diagnostic("source-class-domain-unknown", `source_classes.${entry.id}`, entry.domain));
  }
  return diagnostics;
}

function validateNonAuthorityClasses(classes) {
  const diagnostics = [];
  for (const id of ["AUTHORITATIVE_AUTHORED_CONTRACT", "DERIVED_CONTRACT_ARTIFACT", "DERIVED_SDK_ARTIFACT", "SEMANTIC_IMPLEMENTATION", "TEST_EVIDENCE", "CANDIDATE_GOVERNANCE_CHECKER", "ACTIVATION_EVIDENCE"]) {
    const entry = classes.find((candidate) => candidate.id === id);
    if (!entry || entry.may_define_semantics || entry.may_override_semantics) {
      diagnostics.push(diagnostic("non-authority-can-define-semantics", `source_classes.${id}`, `${id} must not define or override semantics`));
    }
  }
  return diagnostics;
}

function validateActivationClasses(classes) {
  const activationAuthority = classes.find((entry) => entry.id === "ACTIVATING_AUTHORITY");
  const activationEvidence = classes.find((entry) => entry.id === "ACTIVATION_EVIDENCE");
  if (!activationAuthority?.may_authorize_transition || activationEvidence?.may_authorize_transition) {
    return [diagnostic("activation-authority-conflated", "source_classes", "activation authority must authorize; evidence must not")];
  }
  return [];
}

function validateSourceClasses(policy) {
  const domains = policy.authority_domains ?? [];
  const classes = policy.source_classes ?? [];
  return [
    ...validateClassInventory(domains, classes),
    ...validateNonAuthorityClasses(classes),
    ...validateActivationClasses(classes)
  ];
}

function validateSemanticVocabulary(policy) {
  const diagnostics = [];
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
  return diagnostics;
}

function validateRequirementReference(ownership, requirement, capabilities, capabilityIds) {
  const diagnostics = [];
  const path = `requirement_ownership.${ownership.domain}`;
  const capability = capabilities.find((entry) => entry.id === requirement.capability_id);
  if (!capabilityIds.has(requirement.capability_id)) {
    diagnostics.push(diagnostic("applicability-capability-missing", path, requirement.capability_id));
  } else if (!capability.domains?.includes(ownership.domain) && ownership.domain !== "representation_metadata") {
    diagnostics.push(diagnostic("capability-domain-mismatch", path, requirement.capability_id));
  }
  if (typeof requirement.requirement_heading !== "string" || requirement.requirement_heading.length === 0) {
    diagnostics.push(diagnostic("applicability-requirement-heading-missing", path, requirement.capability_id));
  }
  return diagnostics;
}

function validateOwnershipOverlap(policy, ownership, requirements) {
  const diagnostics = [];
  const path = `requirement_ownership.${ownership.domain}`;
  const overlaps = (policy.capability_overlaps ?? []).filter((entry) => entry.domain === ownership.domain);
  if (ownership.overlap === "COMPATIBLE_JOINT_OWNERSHIP") {
    if (overlaps.length !== 1) {
      diagnostics.push(diagnostic("capability-overlap-unclassified", path, "joint ownership requires one exact overlap classification"));
    } else {
      const expectedIds = requirements.map((entry) => entry.capability_id).sort(byCodePoint);
      const boundIds = Object.keys(overlaps[0].capability_objects ?? {}).sort(byCodePoint);
      if (JSON.stringify(expectedIds) !== JSON.stringify(boundIds)) {
        diagnostics.push(diagnostic("capability-overlap-binding-incomplete", `capability_overlaps.${overlaps[0].id}`, "overlap binding must cover every joint owner exactly"));
      }
    }
  } else if (overlaps.length !== 0) {
    diagnostics.push(diagnostic("capability-overlap-unexpected", path, "single-owner domain must not carry an overlap classification"));
  }
  return diagnostics;
}

function validateOwnershipRow(policy, ownership, capabilities, capabilityIds) {
  const diagnostics = [];
  const path = `requirement_ownership.${ownership.domain}`;
  if (!policy.delegation_values.includes(ownership.delegation)) {
    diagnostics.push(diagnostic("delegation-value-unknown", path, ownership.delegation));
  }
  const requirements = ownership.capability_requirements ?? [];
  if ((ownership.overlap === "SINGLE_OWNER" && requirements.length !== 1)
    || (ownership.overlap === "COMPATIBLE_JOINT_OWNERSHIP" && requirements.length < 2)) {
    diagnostics.push(diagnostic("capability-overlap-unclassified", path, "owner count does not match the explicit overlap class"));
  }
  for (const requirement of requirements) {
    diagnostics.push(...validateRequirementReference(ownership, requirement, capabilities, capabilityIds));
  }
  diagnostics.push(...validateOwnershipOverlap(policy, ownership, requirements));
  return diagnostics;
}

function validateOwnership(policy, capabilities, capabilityIds) {
  const diagnostics = [];
  const ownedSections = [];
  for (const ownership of policy.requirement_ownership ?? []) {
    diagnostics.push(...validateOwnershipRow(policy, ownership, capabilities, capabilityIds));
    ownedSections.push(...(ownership.source_sections ?? []));
  }
  if (!unique((policy.capability_overlaps ?? []).map((entry) => entry.id))) {
    diagnostics.push(diagnostic("capability-overlap-id-duplicate", "capability_overlaps", "overlap IDs must be unique"));
  }
  if (!unique(ownedSections)) diagnostics.push(diagnostic("source-section-ownership-ambiguous", "requirement_ownership", "a source section has multiple owners"));
  return diagnostics;
}

function validateRequiredSemanticDimensions(delegationRows) {
  const diagnostics = [];
  for (const dimension of REQUIRED_SEMANTIC_DIMENSIONS) {
    const rows = delegationRows.filter((entry) => entry.dimension === dimension);
    if (rows.length !== 1 || rows[0].classification !== "SEMANTIC_REQUIREMENT") {
      diagnostics.push(diagnostic("semantic-delegation-missing", "semantic_delegation", `${dimension} requires one explicit semantic owner row`));
    }
  }
  return diagnostics;
}

function validateSemanticDelegationRow(policy, row, capabilityIds) {
  const diagnostics = [];
  if (!policy.delegation_values.includes(row.delegation)) {
    diagnostics.push(diagnostic("semantic-delegation-value-unknown", `semantic_delegation.${row.dimension}`, row.delegation));
  }
  for (const id of row.capability_ids ?? []) {
    if (!capabilityIds.has(id)) diagnostics.push(diagnostic("semantic-delegation-owner-missing", `semantic_delegation.${row.dimension}`, id));
  }
  if (row.classification === "SEMANTIC_REQUIREMENT" && row.delegation !== "NONE") {
    diagnostics.push(diagnostic("semantic-delegation-too-broad", `semantic_delegation.${row.dimension}`, "semantic dimensions are default-deny and require capability/delta authorization"));
  }
  return diagnostics;
}

function validateSemanticDelegation(policy, capabilityIds) {
  const delegationRows = policy.semantic_delegation ?? [];
  const diagnostics = validateRequiredSemanticDimensions(delegationRows);
  for (const row of delegationRows) {
    diagnostics.push(...validateSemanticDelegationRow(policy, row, capabilityIds));
  }
  return diagnostics;
}

function validateReviewBindingModel(policy) {
  if (!policy.review_binding?.floating_references_forbidden
    || !policy.review_binding?.partial_bindings_forbidden
    || JSON.stringify(policy.review_binding?.post_review_allowlist) !== JSON.stringify(["governance_record_only"])) {
    return [diagnostic("review-binding-not-exact", "review_binding", "floating and partial bindings must be forbidden")];
  }
  return [];
}

function validateActivationModel(policy) {
  if (policy.activation?.mechanism !== "DEDICATED_POST_MERGE_DIRECT_CHILD_RECORD" || !policy.activation?.record_cannot_self_authorize || !policy.activation?.branch_or_version_only_forbidden) {
    return [diagnostic("activation-model-unsafe", "activation", "activation must use an exact authorized direct-child record")];
  }
  return [];
}

function validateReviewBaseField(policy) {
  if (!policy.review_binding?.required_fields?.includes("base_commit")) {
    return [diagnostic("review-binding-not-exact", "review_binding.required_fields", "review must bind its exact comparison base")];
  }
  return [];
}

function validateRecordOnlyAllowlist(policy) {
  const diagnostics = [];
  const recordPaths = new Set([policy.repository_evidence?.review_record_path, policy.repository_evidence?.activation_record_path]);
  for (const path of policy.repository_evidence?.governance_record_only_paths ?? []) {
    if (!recordPaths.has(path)) {
      diagnostics.push(diagnostic("record-only-allowlist-overbroad", `repository_evidence.governance_record_only_paths.${path}`, "only the exact review and activation records may change after review"));
    }
  }
  return diagnostics;
}

function validateReviewActivationModel(policy) {
  return [
    ...validateReviewBindingModel(policy),
    ...validateActivationModel(policy),
    ...validateReviewBaseField(policy),
    ...validateRecordOnlyAllowlist(policy)
  ];
}

function validateSemanticOverlapBindings(policy) {
  const diagnostics = [];
  for (const row of policy.semantic_delegation ?? []) {
    const owners = [...new Set(row.capability_ids ?? [])].sort(byCodePoint);
    if (owners.length < 2) continue;
    const declared = (policy.capability_overlaps ?? []).some((overlap) => overlap.classification !== "CONTRADICTORY"
      && JSON.stringify(Object.keys(overlap.capability_objects ?? {}).sort(byCodePoint)) === JSON.stringify(owners));
    if (!declared) {
      diagnostics.push(diagnostic("semantic-delegation-overlap-undeclared", `semantic_delegation.${row.dimension}`, "a multi-owner semantic dimension requires a declared non-contradictory capability overlap"));
    }
  }
  return diagnostics;
}

function validateConflictRules(policy) {
  const diagnostics = [];
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

function validatePolicyStatus(policy) {
  if (policy.status === "candidate_requires_exact_owner_review" || policy.status === "activated") return [];
  return [diagnostic("policy-status-invalid", "status", "policy status is not controlled")];
}

function validateCapabilityInventory(policy) {
  const capabilities = policy.capabilities ?? [];
  const diagnostics = [];
  if (!unique(capabilities.map((entry) => entry.id)) || !unique(capabilities.map((entry) => entry.path))) {
    diagnostics.push(diagnostic("capability-applicability-ambiguous", "capabilities", "capability IDs and canonical paths must be unique"));
  }
  return {
    capabilities,
    capabilityIds: new Set(capabilities.map((entry) => entry.id)),
    diagnostics
  };
}

function validateSourceShape(policy) {
  if (unique((policy.source_shape ?? []).map((entry) => entry.path))) return [];
  return [diagnostic("source-shape-path-duplicate", "source_shape", "source shape patterns must be unique")];
}

function validateCheckerTrust(policy) {
  if (policy.checker_trust?.candidate_cannot_self_authorize) return [];
  return [diagnostic("candidate-checker-self-authorizes", "checker_trust", "candidate checker may not authorize itself")];
}

export function validatePolicy(policy, schema = null) {
  const diagnostics = schema ? validatePolicySchema(policy, schema) : [];
  if (policy?.schema !== "bloodtrail.normative-source-precedence.policy") {
    diagnostics.push(diagnostic("policy-schema-invalid", "schema", "unexpected policy schema identity"));
    return diagnostics;
  }
  diagnostics.push(...validatePolicyStatus(policy));
  diagnostics.push(...validateSourceClasses(policy));
  diagnostics.push(...validateSemanticVocabulary(policy));
  const { capabilities, capabilityIds, diagnostics: capabilityDiagnostics } = validateCapabilityInventory(policy);
  diagnostics.push(...capabilityDiagnostics);
  diagnostics.push(...validateOwnership(policy, capabilities, capabilityIds));
  diagnostics.push(...validateSemanticDelegation(policy, capabilityIds));
  diagnostics.push(...validateSourceShape(policy));
  diagnostics.push(...validateLifecycle("change_record_lifecycle", policy.change_record_lifecycle));
  diagnostics.push(...validateLifecycle("contract_candidate_lifecycle", policy.contract_candidate_lifecycle));
  diagnostics.push(...validateReviewActivationModel(policy));
  diagnostics.push(...validateSemanticOverlapBindings(policy));
  diagnostics.push(...validateCheckerTrust(policy));
  diagnostics.push(...validateConflictRules(policy));
  return diagnostics;
}
