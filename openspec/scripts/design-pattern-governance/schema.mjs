/**
 * Closed-schema validation and version compatibility.
 *
 * The schema files under openspec/governance/schemas/ are data; this module is
 * the interpreter. That split exists because the repository permits no runtime
 * dependency here, so there is no JSON Schema library to lean on — and because
 * a data-driven field table is auditable in a way that a thousand hand-written
 * `if` statements is not.
 *
 * Cross-field relations are deliberately NOT expressed in the data. They live in
 * rules.mjs under named identifiers, so every relational control has a name a
 * mutation test can demand by id.
 */

import { readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { pathProblem } from "./paths.mjs";

export const CLOSED_SCHEMA = "bloodtrail.design-pattern-governance.closed-schema";

export function loadSchema(repositoryRoot, relativePath, sink) {
  const before = sink.count;
  const absolute = resolve(repositoryRoot, relativePath);
  if (!schemaFileExists(absolute, relativePath, sink)) return null;
  const parsed = parseSchemaFile(absolute, relativePath, sink);
  if (parsed === null) return null;
  if (!validateSchemaIdentity(parsed, relativePath, sink)) return null;

  validateSchemaContents(parsed, relativePath, sink);
  return sink.count === before ? Object.freeze(parsed) : null;
}

function schemaFileExists(absolute, relativePath, sink) {
  try {
    statSync(absolute);
    return true;
  } catch {
    sink.fail("schema-absent", relativePath, "schema file does not exist");
    return false;
  }
}

function parseSchemaFile(absolute, relativePath, sink) {
  try {
    return JSON.parse(readFileSync(absolute, "utf8"));
  } catch (error) {
    sink.fail("schema-invalid-json", relativePath, `schema JSON did not parse: ${String(error?.message ?? error).slice(0, 160)}`);
    return null;
  }
}

function validateSchemaIdentity(parsed, relativePath, sink) {
  if (parsed?.schema !== CLOSED_SCHEMA) {
    sink.fail("schema-invalid-json", relativePath, `schema must declare ${CLOSED_SCHEMA}`);
    return false;
  }
  if (parsed.closed === true) return true;
  sink.fail("schema-weakened", relativePath, "schema must remain closed; an open schema accepts evidence nobody defined");
  return false;
}

function validateSchemaContents(parsed, relativePath, sink) {
  for (const key of ["id", "version", "supported_versions"]) {
    if (parsed[key] === undefined) {
      sink.fail("schema-incomplete", relativePath, `schema lacks ${key}`);
    }
  }
  // A schema is either a single document shape (fields plus relational rules) or
  // a set of named record shapes that each carry their own. Neither form may be
  // missing its rules: a field table with no relations checks shape and nothing
  // that shape was introduced to guarantee.
  if (parsed.records !== undefined) {
    validateNamedRecords(parsed.records, relativePath, sink);
    return;
  }
  validateDocumentDefinition(parsed, relativePath, sink);
}

function validateNamedRecords(records, relativePath, sink) {
  for (const [name, definition] of Object.entries(records)) {
    if (definition?.fields === undefined) sink.fail("schema-incomplete", relativePath, `record ${name} lacks fields`);
    if (definition?.rules === undefined) sink.fail("schema-incomplete", relativePath, `record ${name} lacks rules`);
    if (definition?.closed !== true) sink.fail("schema-weakened", relativePath, `record ${name} must remain closed`);
  }
}

function validateDocumentDefinition(parsed, relativePath, sink) {
  for (const key of ["fields", "rules"]) {
    if (parsed[key] === undefined) sink.fail("schema-incomplete", relativePath, `schema lacks ${key}`);
  }
}

/**
 * Version acceptance. An unknown newer version and an unsupported older version
 * are different failures with different identifiers: the first means this checker
 * is behind the evidence, the second means the evidence is behind the policy.
 * Collapsing them would hide which way the mismatch runs.
 */
export function checkDocumentVersion(document, schema, documentPath, sink) {
  const declared = document?.schema_version;
  if (typeof declared !== "string" || declared.length === 0) {
    sink.fail("schema-version-absent", documentPath, "evidence lacks schema_version");
    return false;
  }
  if (!/^\d+\.\d+$/.test(declared)) {
    sink.fail("schema-version-malformed", documentPath, `schema_version ${declared} is not major.minor`);
    return false;
  }
  const supported = schema.supported_versions ?? [];
  if (supported.includes(declared)) return true;

  if (versionIsNewerThanSupported(declared, supported)) {
    sink.fail("unknown-new-version", documentPath, `schema_version ${declared} is newer than anything this checker supports (${supported.join(", ")})`);
  } else {
    sink.fail("unsupported-old-version", documentPath, `schema_version ${declared} is older than the supported range (${supported.join(", ")})`);
  }
  return false;
}

function versionIsNewerThanSupported(declared, supported) {
  const [declaredMajor, declaredMinor] = declared.split(".").map(Number);
  const [newestMajor, newestMinor] = newestSupportedVersion(supported);
  if (declaredMajor > newestMajor) return true;
  return declaredMajor === newestMajor && declaredMinor > newestMinor;
}

function newestSupportedVersion(supported) {
  return supported
    .map((version) => version.split(".").map(Number))
    .sort(([leftMajor, leftMinor], [rightMajor, rightMinor]) => (leftMajor - rightMajor) || (leftMinor - rightMinor))
    .at(-1) ?? [0, 0];
}

export function validateDocument(document, schema, { documentPath, context, sink }) {
  if (!isRecord(document)) {
    sink.fail("schema-shape", documentPath, "evidence must be a JSON object");
    return false;
  }
  validateObject(document, { type: "object", closed: schema.closed, fields: schema.fields }, {
    documentPath, label: "", context, sink,
  });
  return sink.ok;
}

export function validateRecord(record, definition, { recordPath, context, sink }) {
  validateObject(record, { type: "object", closed: definition.closed, fields: definition.fields }, {
    documentPath: recordPath, label: "", context, sink,
  });
  return sink.ok;
}

function validateObject(value, spec, state) {
  const fields = spec.fields ?? {};
  if (spec.closed) reportUnknownFields(value, fields, state);
  for (const [key, fieldSpec] of Object.entries(fields)) {
    validateField(value, key, fieldSpec, state);
  }
}

function reportUnknownFields(value, fields, state) {
  for (const key of Object.keys(value)) {
    if (fields[key] !== undefined) continue;
    state.sink.fail("schema-unknown-field", state.documentPath,
      `unknown field ${join(state.label, key)} (schema is closed)`);
  }
}

function validateField(value, key, fieldSpec, state) {
  const label = join(state.label, key);
  if (Object.hasOwn(value, key)) {
    validateValue(value[key], fieldSpec, { ...state, label });
    return;
  }
  if (fieldSpec.required) {
    state.sink.fail("schema-missing-field", state.documentPath, `required field ${label} is absent`);
  }
}

const VALUE_VALIDATORS = Object.freeze({
  string: validateString,
  boolean: validateBoolean,
  integer: validateInteger,
  array: validateArray,
  object: validateNestedObject,
  map: validateMap,
});

function validateValue(value, spec, state) {
  const validator = VALUE_VALIDATORS[spec.type];
  if (validator) {
    validator(value, spec, state);
    return;
  }
  state.sink.fail("schema-shape", state.documentPath,
    `${state.label} declares unsupported type ${String(spec.type)}`);
}

function validateBoolean(value, spec, state) {
  if (typeof value !== "boolean") {
    state.sink.fail("schema-type", state.documentPath, `${state.label} must be a boolean`);
  }
  void spec;
}

function validateInteger(value, spec, state) {
  if (!Number.isInteger(value)) {
    state.sink.fail("schema-type", state.documentPath, `${state.label} must be an integer`);
  }
  void spec;
}

function validateNestedObject(value, spec, state) {
  if (!isRecord(value)) {
    state.sink.fail("schema-type", state.documentPath, `${state.label} must be an object`);
    return;
  }
  validateObject(value, spec, state);
}

function validateString(value, spec, state) {
  if (typeof value !== "string") {
    state.sink.fail("schema-type", state.documentPath, `${state.label} must be a string`);
    return;
  }
  validateStringEnum(value, spec, state);
  validateControlledString(value, spec, state);
  validateMemberString(value, spec, state);
  validateStringPattern(value, spec, state);
  validateStringLength(value, spec, state);
  validateRepositoryPath(value, spec, state);
}

function validateStringEnum(value, spec, state) {
  if (!spec.enum || spec.enum.includes(value)) return;
  state.sink.fail("schema-enum", state.documentPath,
    `${state.label} must be one of ${spec.enum.join(", ")}`);
}

function validateControlledString(value, spec, state) {
  if (!spec.controlled_value) return;
  const permitted = state.context.controlledValues?.[spec.controlled_value] ?? [];
  if (permitted.includes(value)) return;
  state.sink.fail("controlled-value-unknown", state.documentPath,
    `${state.label} value ${value} is not in controlled family ${spec.controlled_value}`);
}

function validateMemberString(value, spec, state) {
  if (!spec.member_of) return;
  const permitted = state.context.memberships?.[spec.member_of] ?? [];
  if (permitted.includes(value)) return;
  state.sink.fail("controlled-value-unknown", state.documentPath,
    `${state.label} value ${value} is not a member of ${spec.member_of}`);
}

function validateStringPattern(value, spec, state) {
  if (!spec.pattern || new RegExp(spec.pattern).test(value)) return;
  state.sink.fail("schema-pattern", state.documentPath, `${state.label} does not match ${spec.pattern}`);
}

function validateStringLength(value, spec, state) {
  if (spec.min_length !== undefined && value.length < spec.min_length) {
    state.sink.fail("schema-length", state.documentPath,
      `${state.label} must be at least ${spec.min_length} characters`);
  }
  if (spec.max_length !== undefined && value.length > spec.max_length) {
    state.sink.fail("schema-length", state.documentPath,
      `${state.label} must be at most ${spec.max_length} characters`);
  }
}

function validateRepositoryPath(value, spec, state) {
  if (!spec.repository_relative) return;
  const problem = pathProblem(value);
  if (problem) state.sink.fail("schema-path", state.documentPath, `${state.label} ${problem}`);
}

function validateArray(value, spec, state) {
  if (!Array.isArray(value)) {
    state.sink.fail("schema-type", state.documentPath, `${state.label} must be an array`);
    return;
  }
  if (spec.min_items !== undefined && value.length < spec.min_items) {
    state.sink.fail("schema-cardinality", state.documentPath,
      `${state.label} must have at least ${spec.min_items} entries`);
  }
  if (spec.max_items !== undefined && value.length > spec.max_items) {
    state.sink.fail("schema-cardinality", state.documentPath,
      `${state.label} must have at most ${spec.max_items} entries`);
  }
  if (!spec.items) return;
  value.forEach((entry, index) => {
    validateValue(entry, spec.items, { ...state, label: `${state.label}[${index}]` });
  });
}

function validateMap(value, spec, state) {
  if (!isRecord(value)) {
    state.sink.fail("schema-type", state.documentPath, `${state.label} must be an object map`);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    validateMapEntry(key, entry, spec, state);
  }
}

function validateMapEntry(key, entry, spec, state) {
  if (spec.key_pattern && !new RegExp(spec.key_pattern).test(key)) {
    state.sink.fail("schema-pattern", state.documentPath,
      `${state.label} key ${key} does not match ${spec.key_pattern}`);
  }
  if (spec.value) validateValue(entry, spec.value, { ...state, label: `${state.label}.${key}` });
}

function isRecord(value) {
  if (value === null) return false;
  if (typeof value !== "object") return false;
  return !Array.isArray(value);
}

/**
 * Compatibility comparison between a baseline schema and a candidate one. This is
 * the control that stops a governance change from making its own evidence
 * optional: the candidate is judged against the baseline, never against itself.
 */
export function compareSchemaCompatibility(baseline, candidate, documentPath, sink) {
  if (!compareSchemaIdentity(baseline, candidate, documentPath, sink)) return;

  const baseFields = flattenRequired(baseline.fields ?? {}, "");
  const candidateFields = flattenRequired(candidate.fields ?? {}, "");
  compareRequiredFields(baseFields, candidateFields, documentPath, sink);

  const baseRules = new Set((baseline.rules ?? []).map((rule) => rule.id));
  const candidateRules = new Set((candidate.rules ?? []).map((rule) => rule.id));
  compareRequiredRules(baseRules, candidateRules, documentPath, sink);

  const versionChange = classifyVersionChange(baseline.version, candidate.version);
  if (versionChange !== "invalid") return;
  sink.fail("schema-version-malformed", documentPath,
    `candidate version ${candidate.version} does not follow ${baseline.version}`);
}

function compareSchemaIdentity(baseline, candidate, documentPath, sink) {
  if (baseline.id !== candidate.id) {
    sink.fail("schema-identity", documentPath, `schema id changed from ${baseline.id} to ${candidate.id}`);
    return false;
  }
  if (candidate.closed !== true) {
    sink.fail("schema-weakened", documentPath, "candidate schema is no longer closed");
  }
  return true;
}

function compareRequiredFields(baseFields, candidateFields, documentPath, sink) {
  for (const [label, wasRequired] of baseFields) {
    if (!wasRequired) continue;
    compareRequiredField(label, candidateFields.get(label), documentPath, sink);
  }
}

function compareRequiredField(label, nowRequired, documentPath, sink) {
  if (nowRequired === undefined) {
    sink.fail("schema-weakened", documentPath, `mandatory field ${label} was removed`);
    return;
  }
  if (nowRequired === false) {
    sink.fail("schema-weakened", documentPath, `mandatory field ${label} was made optional`);
  }
}

function compareRequiredRules(baseRules, candidateRules, documentPath, sink) {
  for (const id of baseRules) {
    if (candidateRules.has(id)) continue;
    sink.fail("schema-weakened", documentPath, `relational rule ${id} was removed`);
  }
}

function flattenRequired(fields, prefix) {
  const result = new Map();
  for (const [key, spec] of Object.entries(fields)) {
    const label = join(prefix, key);
    result.set(label, Boolean(spec.required));
    addNestedRequiredFields(result, spec, label);
  }
  return result;
}

function addNestedRequiredFields(result, spec, label) {
  const nestedFields = nestedObjectFields(spec);
  if (nestedFields === null) return;
  const nestedPrefix = spec.type === "array" ? `${label}[]` : label;
  for (const [nested, required] of flattenRequired(nestedFields, nestedPrefix)) {
    result.set(nested, required);
  }
}

function nestedObjectFields(spec) {
  if (spec.type === "object") return spec.fields ?? null;
  if (spec.type === "array" && spec.items?.type === "object") return spec.items.fields ?? null;
  return null;
}

export function classifyVersionChange(before, after) {
  if (!/^\d+\.\d+$/.test(before ?? "") || !/^\d+\.\d+$/.test(after ?? "")) return "invalid";
  const [beforeMajor, beforeMinor] = before.split(".").map(Number);
  const [afterMajor, afterMinor] = after.split(".").map(Number);
  if (afterMajor === beforeMajor && afterMinor === beforeMinor) return "same";
  if (afterMajor === beforeMajor && afterMinor > beforeMinor) return "minor";
  if (afterMajor > beforeMajor) return "major";
  return "invalid";
}

function join(prefix, key) {
  return prefix.length === 0 ? key : `${prefix}.${key}`;
}
