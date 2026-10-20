import assert from "node:assert/strict";
import { planBudget } from "../lib/ledger.mjs";
import { AF_CASES } from "./af-cases.mjs";
import { AS_CASES } from "./as-cases.mjs";
import { PR_CASES, RA_CASES } from "./request-cases.mjs";
import { DECLARED_PAIRS, FAILURE_DATASETS, MIRRORS, P_ATTR_BUDGET, REPETITIONS, REQUEST_DATASETS, SUCCESS_DATASETS, TARGETS } from "./linkage-cases.mjs";
import { ORIGINS } from "./origins.mjs";
import { DIGEST_FORMAT } from "./keying.mjs";
import { expectedTargets } from "./expected-targets.mjs";

export const CORRECTED_AT = "cc4fdf5a3309db5077b85c4954c916b9ba902b8e";
export const DRAFT_COMMIT = "5d931ad";
export const COMMENT_IDS = ["6137582157", "6137593009"];
const CITATION = /^(packages|contracts|openspec)\/.+:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/;
const AXES_KEYS = ["provenance_ambiguity", "in_occurrence_flag", "resource_rule", "meaning_misuse",
  "discloses_existence", "per_target_grouping", "ambiguous_fields", "allowed_source_violations", "targets"];
const BOOLEAN_AXES = ["provenance_ambiguity", "in_occurrence_flag", "meaning_misuse", "discloses_existence", "per_target_grouping"];
const REQUIRED_DEFAULTS = ["AF-C0r", "AS-C5", "message carrier", "AF-X1..X3 scope", "tenant discrepancy",
  "two-copy install", "Node factory", "supplied purpose/effective tenant", "display-name misuse"];
const SLOT_STAGES = [["L1", FAILURE_DATASETS, REPETITIONS], ["L2", SUCCESS_DATASETS, 1], ["L3", REQUEST_DATASETS, 1]];

// Documented #802 comment order (6137582157 then 6137593009), expanded to one
// entry per explicit case id. The counting distinction is recorded in the
// expectations' counting_manifest and reconciled in the tests.
export const CASE_ORDER = [
  "AF-B", "AF-C0t", "AF-C1", "AF-C2", "AF-C3", "AF-C3s", "AF-C4", "AF-C5", "AF-CR", "AF-C6",
  "AF-C6s", "AF-C7", "AF-C7a", "AF-C7b", "AF-C8", "AF-C9", "AF-X1", "AF-X2", "AF-X3",
  "AS-B", "AS-C0", "AS-C1", "AS-C2", "AS-C3", "AS-C4", "AS-C5", "AS-CR", "AS-C6", "AS-C6s",
  "AS-C7", "AS-C7a", "AS-C7b", "AS-C8", "AS-C9",
  "PR-B", "PR-C1", "PR-C2", "PR-C3", "PR-C4", "PR-C5", "PR-CR", "PR-C6", "PR-C6s", "PR-C7",
  "PR-C7a", "PR-C7b", "PR-C8", "PR-C9",
  "RA-B", "RA-C1", "RA-C2", "RA-C3", "RA-C4", "RA-C5", "RA-CR", "RA-C6", "RA-C6s", "RA-C7",
  "RA-C7a", "RA-C7b", "RA-C8", "RA-C9",
  "AS-X2", "AF-X4", "RA-X2", "PR-X2", "AF-F1", "AF-F2", "AF-F3", "AF-C2h-t", "AF-C2-async",
  "AF-C0r", "AF-F4",
];

const DESCRIPTORS = new Map([...AF_CASES, ...AS_CASES, ...PR_CASES, ...RA_CASES].map((entry) => [entry.case_id, entry]));

function validateHeader(value) {
  assert.equal(value.probe, "P-attr");
  assert.equal(value.version, 1);
  assert.equal(value.corrected_at, CORRECTED_AT);
  assert.equal(value.drafted_from.commit, DRAFT_COMMIT);
  for (const id of COMMENT_IDS) {
    assert(value.drafted_from.comments.some((comment) => comment.endsWith(`#issuecomment-${id}`)),
      `drafted_from must name #802 comment ${id}`);
  }
  assert.equal(value.definitions.origins.join(","), ORIGINS.join(","));
  for (const key of ["axes", "in_occurrence_flag", "linkage", "acceptance", "existence_disclosure", "meaning_misuse", "resource_rule"]) {
    assert(typeof value.definitions[key] === "string" && value.definitions[key].length > 0, `definitions.${key} required`);
  }
  assert.equal(value.hmac_key_handling.key_source, "crypto.randomBytes");
  assert.equal(value.hmac_key_handling.key_storage, "in-memory closure only");
  assert.match(value.hmac_key_handling.key_id_derivation, /never derived from the key/);
  assert.equal(value.hmac_key_handling.digest_format, DIGEST_FORMAT);
  assert.equal(value.hmac_key_handling.expectations_hold_digests, false);
  assert.deepEqual(value.declared_join_pairs, DECLARED_PAIRS);
  for (const key of REQUIRED_DEFAULTS) {
    assert(typeof value.decisions.implementer_defaults[key] === "string" && value.decisions.implementer_defaults[key].length > 0,
      `implementer default ${key} must be recorded`);
  }
  for (const rule of value.decisions.data_rules) {
    assert(typeof rule === "string" && rule.length > 0, "data rules must be recorded as text");
  }
  const budget = planBudget(value.planned_occurrence_budget);
  assert.deepEqual(budget, { processes: P_ATTR_BUDGET.processes, total: P_ATTR_BUDGET.total, limit: 5000 });
  assert.equal(value.predicted_total, P_ATTR_BUDGET.predicted_total);
  assert.equal(value.planned_occurrence_budget.predicted_total, P_ATTR_BUDGET.predicted_total);
  assert(P_ATTR_BUDGET.total <= 5000, "authorization cap exceeded");
  assert.equal(value.counting_manifest.case_ids, 73);
  assert.equal(value.counting_manifest.drafted_case_ids, 62);
  assert.equal(value.counting_manifest.review_added_case_ids, 10);
  assert.equal(value.counting_manifest.implementer_default_case_ids, 1);
  assert(typeof value.counting_manifest.distinction === "string" && value.counting_manifest.distinction.length > 0);
}

function validateCase(entry, index) {
  assert.equal(entry.case_id, CASE_ORDER[index], `case order: expected ${CASE_ORDER[index]}`);
  const descriptor = DESCRIPTORS.get(entry.case_id);
  assert(descriptor, `${entry.case_id}: no descriptor`);
  assert.equal(entry.predicted_calls, descriptor.predicted_calls, `${entry.case_id}: predicted_calls must match the re-derived descriptor`);
  for (const field of ["setup", "expected", "basis", "classification", "confidence", "source_group", "comment_id"]) {
    assert(entry[field], `${entry.case_id}: missing ${field}`);
  }
  assert(entry.basis.length > 0);
  for (const citation of entry.basis) assert.match(citation, CITATION, `${entry.case_id}: invalid citation ${citation}`);
  assert(["high", "medium"].includes(entry.confidence));
  assert.equal(String(entry.comment_id), descriptor.comment_id);
  assert.equal(entry.added_by ?? null, descriptor.added_by ?? null, `${entry.case_id}: added_by provenance must match the source`);
  validateCorrection(entry);
  if (entry.case_id === "AF-F4") {
    assert.equal(entry.added_by, "implementer default");
    assert(entry.drafting_question.includes("outcome_reason.message"), "AF-F4 must record the drafting question");
  }
  const matrixVariants = descriptor.variants.filter((variant) => !variant.linkage_only);
  assert.deepEqual(entry.expected.map((step) => step.step_id), matrixVariants.map((variant) => `${entry.case_id}/${variant.variant_id}`),
    `${entry.case_id}: step ids must be exactly the comment-ordered variants`);
  // Strong transcription cross-check against the re-derived source descriptors:
  // surfaces, diagnostics and sink counts must match exactly.
  entry.expected.forEach((step, stepIndex) => {
    const variant = matrixVariants[stepIndex];
    assert.equal(step.accepted, variant.source_outcome.accepted, step.step_id);
    assert.equal(step.sink_count, variant.source_outcome.sink_count, step.step_id);
    assert.deepEqual(step.diagnostic ?? null, variant.source_outcome.diagnostic ?? null, step.step_id);
    assert.deepEqual(step.assertions, variant.source_outcome.assertions ?? {}, step.step_id);
    if (step.accepted) assert.deepEqual(step.axes.targets, expectedTargets({ entry: descriptor, variant }),
      `${step.step_id}: axes.targets must match prepared carrier descriptors`);
  });
  for (const step of entry.expected) validateStep(entry, step);
}

function validateCorrection(entry) {
  const descriptor = DESCRIPTORS.get(entry.case_id);
  if (!descriptor.corrected_from) return;
  assert(entry.corrected_from, `${entry.case_id}: corrected_from required`);
  assert(entry.corrected_from.old_text.length > 0 && entry.corrected_from.reason.length > 0);
}

function validateSurface(entry, step) {
  assert(["returned", "thrown"].includes(step.kind));
  assert.equal(typeof step.accepted, "boolean");
  if (step.kind === "thrown") assert.equal(step.accepted, false, `${step.step_id}: thrown steps are refusals`);
  assert(Number.isInteger(step.sink_count) && step.sink_count >= 0);
  assert(Array.isArray(step.frozen) && step.frozen.every((frozen) => frozen === true || frozen === false));
  assert(typeof step.family === "string" && step.step_id.startsWith(`${entry.case_id}/`));
  assert(typeof step.assertions === "object" && step.assertions !== null, `${step.step_id}: assertions must be explicit, empty {} when none`);
}

function validateOutcome(step) {
  if (step.accepted) {
    assert.equal(step.diagnostic, undefined);
    assert.equal(step.sink_count, 1);
    assert.equal(step.frozen.length, 1);
    return;
  }
  assert(step.diagnostic && typeof step.diagnostic.code === "string" && typeof step.diagnostic.category === "string"
    && typeof step.diagnostic.path === "string", `${step.step_id}: refused step needs the exact diagnostic triple`);
  assert.equal(step.sink_count, 0);
  assert.equal(step.frozen.length, 0);
}

function validateStep(entry, step) {
  validateSurface(entry, step);
  validateOutcome(step);
  validateAxes(step);
}

function validateAxisDomain(step) {
  for (const key of BOOLEAN_AXES) {
    assert([true, false, "n/a"].includes(step.axes[key]), `${step.step_id}: invalid axes.${key}`);
  }
  assert(["conforms", "violates", "circumvents", "n/a"].includes(step.axes.resource_rule), `${step.step_id}: invalid resource_rule`);
}

function validateKeyedTarget(step, target) {
  // Q1: keyed targets are structural; a frozen digest would mismatch every
  // per-run random key.
  assert(!Object.hasOwn(target, "value"), `${step.step_id}: keyed target ${target.path} must not freeze a digest value`);
  assert.equal(target.keyed.digest_format, DIGEST_FORMAT);
  assert(ORIGINS.includes(target.keyed.input_origin));
  assert(typeof target.keyed.key_scope.purpose === "string" && target.keyed.key_scope.purpose.length > 0);
  assert(target.keyed.key_scope.tenant === null || typeof target.keyed.key_scope.tenant === "string");
  assert.equal(typeof target.keyed.matches_declared_input, "boolean");
}

function validatePlainTarget(step, target) {
  assert(Object.hasOwn(target, "value"), `${step.step_id}: plain target ${target.path} needs a value`);
  assert(!/^[0-9a-f]{64}$/.test(String(target.value)), `${step.step_id}: plain target ${target.path} must not freeze a digest`);
}

function validateTarget(step, target) {
  assert(typeof target.path === "string" && typeof target.kind === "string");
  if (target.keyed === undefined) {
    validatePlainTarget(step, target);
    return;
  }
  validateKeyedTarget(step, target);
}

function validateAxes(step) {
  assert(typeof step.axes === "object" && step.axes !== null, `${step.step_id}: axes required`);
  for (const key of AXES_KEYS) assert(Object.hasOwn(step.axes, key), `${step.step_id}: axes.${key} required`);
  for (const key of ["ambiguous_fields", "allowed_source_violations", "targets"]) assert(Array.isArray(step.axes[key]));
  validateAxisDomain(step);
  for (const target of step.axes.targets) validateTarget(step, target);
}

function expectedSlotCount() {
  return SLOT_STAGES.reduce((sum, [, datasets, repeats]) => sum + datasets.reduce((total, dataset) =>
    total + (dataset.family === "AS" ? 3 : TARGETS.length) * repeats, 0), 0);
}

function validateLinkageHeader(value) {
  assert(value.linkage_expectations && value.linkage_inventory, "linkage expectations and inventory required");
  assert.equal(value.linkage_inventory.declared_slot_count, expectedSlotCount());
}

function validateStageRows(stage, rows) {
  assert.equal(rows.length, stage[1].length);
  assert.deepEqual(rows.map((row) => row.from), stage[1].map((dataset) => dataset.dataset_id));
}

function declaredPair(row) {
  if (row.declared_pair === null) {
    assert.equal(row.ex.linkage.numerator, 0, `${row.from}: a null declared pair must expect no join`);
    return;
  }
  assert(DECLARED_PAIRS.some((pair) => pair.from_family === row.declared_pair.from_family && pair.from === row.declared_pair.from
    && pair.to_family === row.declared_pair.to_family && pair.to === row.declared_pair.to), `${row.from}: pair must be pre-declared`);
}

function validateRowTarget(metrics) {
  for (const metric of ["attempts", "accepted"]) {
    assert(Number.isInteger(metrics[metric]) && metrics[metric] >= 0);
  }
  for (const metric of ["target_coverage", "linkage"]) {
    assert(Number.isInteger(metrics[metric].numerator) && Number.isInteger(metrics[metric].denominator)
      && metrics[metric].denominator > 0 && metrics[metric].numerator <= metrics[metric].denominator);
  }
  assert(Array.isArray(metrics.groups));
}

function validateLinkageRow(row) {
  declaredPair(row);
  validateRowTarget(row.ex);
  validateRowTarget(row.nx);
  assert(typeof row.honesty.honest === "boolean" && typeof row.honesty.reason === "string");
  assert(Array.isArray(row.basis) && row.basis.length > 0);
}

function validateLinkageRows(value) {
  validateLinkageHeader(value);
  const l1 = value.linkage_expectations.L1;
  validateStageRows(SLOT_STAGES[0], l1);
  for (const row of l1) assert.equal(row.to, "AS-B/main");
  assert.deepEqual(value.linkage_expectations.L2.map((row) => `${row.from} -> ${row.to}`), MIRRORS.map((row) => `${row.from} -> ${row.to}`));
  validateStageRows(SLOT_STAGES[2], value.linkage_expectations.L3);
  for (const row of [...l1, ...value.linkage_expectations.L2, ...value.linkage_expectations.L3]) validateLinkageRow(row);
}

export function validateExpectations(value) {
  assert(typeof value === "object" && value !== null);
  validateHeader(value);
  assert.deepEqual(value.cases.map((entry) => entry.case_id), CASE_ORDER);
  value.cases.forEach(validateCase);
  const stepIds = value.cases.flatMap((entry) => entry.expected.map((step) => step.step_id));
  assert.equal(new Set(stepIds).size, stepIds.length, "duplicate planned step ids");
  const matrixSum = value.cases.reduce((sum, entry) => sum + entry.predicted_calls, 0);
  assert.equal(matrixSum, P_ATTR_BUDGET.matrix_predicted, "per-case predictions must sum to the matrix prediction");
  validateLinkageRows(value);
  return value;
}
