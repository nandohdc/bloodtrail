import { byCodePoint, diagnostic } from "./shared.mjs";

const FULL_OBJECT_ID = /^[0-9a-f]{40}$/;

function missingFields({ subject, value, fields, code, message }) {
  const diagnostics = [];
  for (const field of fields ?? []) {
    if (!(field in (value ?? {}))) diagnostics.push(diagnostic(code, `${subject}.${field}`, message));
  }
  return diagnostics;
}

function validateReviewObjectIds(binding) {
  const diagnostics = [];
  for (const field of ["technical_commit", "tree"]) {
    if (typeof binding[field] !== "string" || !FULL_OBJECT_ID.test(binding[field])) {
      diagnostics.push(diagnostic("review-binding-floating", `review.${field}`, "binding must be a full object ID"));
    }
  }
  return diagnostics;
}

function expectsExactValue(expected, field) {
  if (!expected.values) return false;
  return field in expected.values;
}

function validateReviewScalarValues(binding, expected) {
  const diagnostics = [];
  for (const field of ["technical_commit", "tree", "contract_version", "reviewer_identity", "reviewer_authority"]) {
    if (expectsExactValue(expected, field) && JSON.stringify(binding[field]) !== JSON.stringify(expected.values[field])) {
      diagnostics.push(diagnostic("review-binding-value-mismatch", `review.${field}`, "bound value differs from the exact reviewed expectation"));
    }
  }
  return diagnostics;
}

function validateReviewSetValues(binding, expected) {
  const diagnostics = [];
  for (const field of ["decision_scope", "authorization_granted", "authorization_withheld"]) {
    if (!expectsExactValue(expected, field)) continue;
    const actual = Array.isArray(binding[field]) ? [...binding[field]].sort(byCodePoint) : binding[field];
    const wanted = Array.isArray(expected.values[field]) ? [...expected.values[field]].sort(byCodePoint) : expected.values[field];
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      diagnostics.push(diagnostic("review-binding-value-mismatch", `review.${field}`, "bound set differs from the exact reviewed expectation"));
    }
  }
  return diagnostics;
}

function validateReviewedMembership(entries, expectedPaths) {
  const actualPaths = Object.keys(entries).sort(byCodePoint);
  if (JSON.stringify(actualPaths) === JSON.stringify(expectedPaths)) return [];
  return [diagnostic("review-binding-partial", "review.governed_path_objects", "complete governed path membership is required")];
}

function validateReviewedObjectValues(entries, expected, expectedPaths) {
  const diagnostics = [];
  for (const path of expectedPaths) {
    if (typeof entries[path] !== "string" || !FULL_OBJECT_ID.test(entries[path])) {
      diagnostics.push(diagnostic("review-binding-floating", `review.governed_path_objects.${path}`, "governed object must be a full object ID"));
    }
    if (entries[path] !== expected.objects?.[path]) {
      diagnostics.push(diagnostic("review-binding-stale", `review.governed_path_objects.${path}`, "bound object differs from reviewed content"));
    }
  }
  return diagnostics;
}

function validateReviewedObjects(binding, expected) {
  const entries = binding.governed_path_objects ?? {};
  const expectedPaths = [...(expected.paths ?? [])].sort(byCodePoint);
  return [
    ...validateReviewedMembership(entries, expectedPaths),
    ...validateReviewedObjectValues(entries, expected, expectedPaths)
  ];
}

export function validateReviewBinding(binding, expected) {
  const diagnostics = missingFields({
    subject: "review",
    value: binding,
    fields: expected.requiredFields,
    code: "review-binding-field-missing",
    message: "required exact review field is absent"
  });
  if (!binding) return diagnostics;
  diagnostics.push(...validateReviewObjectIds(binding));
  diagnostics.push(...validateReviewScalarValues(binding, expected));
  diagnostics.push(...validateReviewSetValues(binding, expected));
  diagnostics.push(...validateReviewedObjects(binding, expected));
  if (expected.changedPaths?.some((path) => !expected.allowedRecordPaths?.includes(path))) {
    diagnostics.push(diagnostic("review-binding-post-review-change", "review.changed_paths", "a post-review path is outside the closed governance-record-only allowlist"));
  }
  return diagnostics;
}

function validateActivationExpectedValues(record, context) {
  const diagnostics = [];
  for (const [field, expected] of Object.entries(context.expectedValues ?? {})) {
    const actual = Array.isArray(record[field]) ? [...record[field]].sort(byCodePoint) : record[field];
    const wanted = Array.isArray(expected) ? [...expected].sort(byCodePoint) : expected;
    if (JSON.stringify(actual) !== JSON.stringify(wanted)) {
      diagnostics.push(diagnostic("activation-binding-mismatch", `activation.${field}`, "activation value differs from the exact authorized expectation"));
    }
  }
  return diagnostics;
}

function validateActivationGrant(context) {
  const requiredGrant = context.requiredGrant ?? "activation";
  if (context.authorizingDecision?.authorization_granted?.includes(requiredGrant)) return [];
  return [diagnostic("activation-authorization-missing", "activation.authorizing_decision_object", "an independent exact reviewed decision must grant activation")];
}

function validateActivationSelfAuthorization(record, context) {
  if (record.authorizing_decision_object !== context.activationRecordObject) return [];
  return [diagnostic("activation-self-authorized", "activation.authorizing_decision_object", "activation evidence cannot authorize itself")];
}

function validateActivationDecisionBinding(record, context) {
  if (!context.authorizingDecisionObject || record.authorizing_decision_object === context.authorizingDecisionObject) return [];
  return [diagnostic("activation-decision-binding-mismatch", "activation.authorizing_decision_object", "record does not bind the independently reviewed decision object")];
}

function validateActivationAuthority(record, context) {
  return [
    ...validateActivationGrant(context),
    ...validateActivationSelfAuthorization(record, context),
    ...validateActivationDecisionBinding(record, context)
  ];
}

function isDedicatedDirectChild(record, context) {
  if (context.parentCount !== 1) return false;
  return record.activated_commit === context.mergeCommit && record.parent_commit === context.mergeCommit;
}

function validateActivationParentage(record, context) {
  const diagnostics = [];
  if (!isDedicatedDirectChild(record, context)) {
    diagnostics.push(diagnostic("activation-parentage-invalid", "activation.parent_commit", "activation must be a dedicated direct child of the exact merge"));
  }
  if (context.mergeTree && record.activated_tree !== context.mergeTree) {
    diagnostics.push(diagnostic("activation-tree-binding-mismatch", "activation.activated_tree", "record does not bind the activated merge tree"));
  }
  return diagnostics;
}

function validateActivationGovernedMembership(record, context) {
  if (!context.reviewedObjects) return [];
  const expectedEntries = Object.entries(context.reviewedObjects).sort(([left], [right]) => byCodePoint(left, right));
  const actualEntries = Object.entries(record.governed_path_objects ?? {}).sort(([left], [right]) => byCodePoint(left, right));
  if (JSON.stringify(actualEntries) === JSON.stringify(expectedEntries)) return [];
  return [diagnostic("activation-governed-objects-mismatch", "activation.governed_path_objects", "activation must bind the complete reviewed object set")];
}

function validateActivationGovernedObjectIds(record) {
  const diagnostics = [];
  for (const [path, object] of Object.entries(record.governed_path_objects ?? {})) {
    if (typeof object !== "string" || !FULL_OBJECT_ID.test(object)) {
      diagnostics.push(diagnostic("activation-floating-reference", `activation.governed_path_objects.${path}`, "governed object must be a full object ID"));
    }
  }
  return diagnostics;
}

function validateActivationGovernedObjects(record, context) {
  return [
    ...validateActivationGovernedMembership(record, context),
    ...validateActivationGovernedObjectIds(record)
  ];
}

function validateActivationScope(record, context) {
  const diagnostics = [];
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
    if (typeof record[field] !== "string" || !FULL_OBJECT_ID.test(record[field])) {
      diagnostics.push(diagnostic("activation-floating-reference", `activation.${field}`, "branch/version-only activation is forbidden"));
    }
  }
  return diagnostics;
}

export function validateActivation(record, context) {
  const diagnostics = missingFields({
    subject: "activation",
    value: record,
    fields: context.requiredFields,
    code: "activation-field-missing",
    message: "required activation field is absent"
  });
  if (!record) return diagnostics;
  diagnostics.push(...validateActivationExpectedValues(record, context));
  diagnostics.push(...validateActivationAuthority(record, context));
  diagnostics.push(...validateActivationParentage(record, context));
  diagnostics.push(...validateActivationGovernedObjects(record, context));
  diagnostics.push(...validateActivationScope(record, context));
  return diagnostics;
}

export function validateCompatibilityTransition(change) {
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
