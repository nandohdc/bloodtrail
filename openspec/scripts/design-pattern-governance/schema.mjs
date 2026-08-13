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
  try {
    statSync(absolute);
  } catch {
    sink.fail("schema-absent", relativePath, "schema file does not exist");
    return null;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(absolute, "utf8"));
  } catch (error) {
    sink.fail("schema-invalid-json", relativePath, `schema JSON did not parse: ${String(error?.message ?? error).slice(0, 160)}`);
    return null;
  }
  if (parsed?.schema !== CLOSED_SCHEMA) {
    sink.fail("schema-invalid-json", relativePath, `schema must declare ${CLOSED_SCHEMA}`);
    return null;
  }
  if (parsed.closed !== true) {
    sink.fail("schema-weakened", relativePath, "schema must remain closed; an open schema accepts evidence nobody defined");
    return null;
  }
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
    for (const [name, definition] of Object.entries(parsed.records)) {
      if (definition?.fields === undefined) sink.fail("schema-incomplete", relativePath, `record ${name} lacks fields`);
      if (definition?.rules === undefined) sink.fail("schema-incomplete", relativePath, `record ${name} lacks rules`);
      if (definition?.closed !== true) sink.fail("schema-weakened", relativePath, `record ${name} must remain closed`);
    }
  } else {
    for (const key of ["fields", "rules"]) {
      if (parsed[key] === undefined) sink.fail("schema-incomplete", relativePath, `schema lacks ${key}`);
    }
  }
  return sink.count === before ? Object.freeze(parsed) : null;
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

  const [declaredMajor, declaredMinor] = declared.split(".").map(Number);
  const newest = supported
    .map((version) => version.split(".").map(Number))
    .sort(([leftMajor, leftMinor], [rightMajor, rightMinor]) => (leftMajor - rightMajor) || (leftMinor - rightMinor))
    .at(-1) ?? [0, 0];

  const isNewer = declaredMajor > newest[0] || (declaredMajor === newest[0] && declaredMinor > newest[1]);
  if (isNewer) {
    sink.fail("unknown-new-version", documentPath, `schema_version ${declared} is newer than anything this checker supports (${supported.join(", ")})`);
  } else {
    sink.fail("unsupported-old-version", documentPath, `schema_version ${declared} is older than the supported range (${supported.join(", ")})`);
  }
  return false;
}

export function validateDocument(document, schema, documentPath, context, sink) {
  if (document === null || typeof document !== "object" || Array.isArray(document)) {
    sink.fail("schema-shape", documentPath, "evidence must be a JSON object");
    return false;
  }
  validateObject(document, { type: "object", closed: schema.closed, fields: schema.fields }, documentPath, "", context, sink);
  return sink.ok;
}

export function validateRecord(record, definition, recordPath, context, sink) {
  validateObject(record, { type: "object", closed: definition.closed, fields: definition.fields }, recordPath, "", context, sink);
  return sink.ok;
}

function validateObject(value, spec, documentPath, prefix, context, sink) {
  const fields = spec.fields ?? {};
  if (spec.closed) {
    for (const key of Object.keys(value)) {
      if (fields[key] === undefined) {
        sink.fail("schema-unknown-field", documentPath, `unknown field ${join(prefix, key)} (schema is closed)`);
      }
    }
  }
  for (const [key, fieldSpec] of Object.entries(fields)) {
    const present = Object.hasOwn(value, key);
    if (!present) {
      if (fieldSpec.required) {
        sink.fail("schema-missing-field", documentPath, `required field ${join(prefix, key)} is absent`);
      }
      continue;
    }
    validateValue(value[key], fieldSpec, documentPath, join(prefix, key), context, sink);
  }
}

function validateValue(value, spec, documentPath, label, context, sink) {
  switch (spec.type) {
    case "string":
      validateString(value, spec, documentPath, label, context, sink);
      return;
    case "boolean":
      if (typeof value !== "boolean") sink.fail("schema-type", documentPath, `${label} must be a boolean`);
      return;
    case "integer":
      if (!Number.isInteger(value)) sink.fail("schema-type", documentPath, `${label} must be an integer`);
      return;
    case "array":
      validateArray(value, spec, documentPath, label, context, sink);
      return;
    case "object":
      if (value === null || typeof value !== "object" || Array.isArray(value)) {
        sink.fail("schema-type", documentPath, `${label} must be an object`);
        return;
      }
      validateObject(value, spec, documentPath, label, context, sink);
      return;
    case "map":
      validateMap(value, spec, documentPath, label, context, sink);
      return;
    default:
      sink.fail("schema-shape", documentPath, `${label} declares unsupported type ${String(spec.type)}`);
  }
}

function validateString(value, spec, documentPath, label, context, sink) {
  if (typeof value !== "string") {
    sink.fail("schema-type", documentPath, `${label} must be a string`);
    return;
  }
  if (spec.enum && !spec.enum.includes(value)) {
    sink.fail("schema-enum", documentPath, `${label} must be one of ${spec.enum.join(", ")}`);
  }
  if (spec.controlled_value) {
    const permitted = context.controlledValues?.[spec.controlled_value] ?? [];
    if (!permitted.includes(value)) {
      sink.fail("controlled-value-unknown", documentPath, `${label} value ${value} is not in controlled family ${spec.controlled_value}`);
    }
  }
  if (spec.member_of) {
    const permitted = context.memberships?.[spec.member_of] ?? [];
    if (!permitted.includes(value)) {
      sink.fail("controlled-value-unknown", documentPath, `${label} value ${value} is not a member of ${spec.member_of}`);
    }
  }
  if (spec.pattern && !new RegExp(spec.pattern).test(value)) {
    sink.fail("schema-pattern", documentPath, `${label} does not match ${spec.pattern}`);
  }
  if (spec.min_length !== undefined && value.length < spec.min_length) {
    sink.fail("schema-length", documentPath, `${label} must be at least ${spec.min_length} characters`);
  }
  if (spec.max_length !== undefined && value.length > spec.max_length) {
    sink.fail("schema-length", documentPath, `${label} must be at most ${spec.max_length} characters`);
  }
  if (spec.repository_relative) {
    const problem = pathProblem(value);
    if (problem) sink.fail("schema-path", documentPath, `${label} ${problem}`);
  }
}

function validateArray(value, spec, documentPath, label, context, sink) {
  if (!Array.isArray(value)) {
    sink.fail("schema-type", documentPath, `${label} must be an array`);
    return;
  }
  if (spec.min_items !== undefined && value.length < spec.min_items) {
    sink.fail("schema-cardinality", documentPath, `${label} must have at least ${spec.min_items} entries`);
  }
  if (spec.max_items !== undefined && value.length > spec.max_items) {
    sink.fail("schema-cardinality", documentPath, `${label} must have at most ${spec.max_items} entries`);
  }
  if (!spec.items) return;
  value.forEach((entry, index) => {
    validateValue(entry, spec.items, documentPath, `${label}[${index}]`, context, sink);
  });
}

function validateMap(value, spec, documentPath, label, context, sink) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    sink.fail("schema-type", documentPath, `${label} must be an object map`);
    return;
  }
  for (const [key, entry] of Object.entries(value)) {
    if (spec.key_pattern && !new RegExp(spec.key_pattern).test(key)) {
      sink.fail("schema-pattern", documentPath, `${label} key ${key} does not match ${spec.key_pattern}`);
    }
    if (spec.value) validateValue(entry, spec.value, documentPath, `${label}.${key}`, context, sink);
  }
}

/**
 * Compatibility comparison between a baseline schema and a candidate one. This is
 * the control that stops a governance change from making its own evidence
 * optional: the candidate is judged against the baseline, never against itself.
 */
export function compareSchemaCompatibility(baseline, candidate, documentPath, sink) {
  if (baseline.id !== candidate.id) {
    sink.fail("schema-identity", documentPath, `schema id changed from ${baseline.id} to ${candidate.id}`);
    return;
  }
  if (candidate.closed !== true) {
    sink.fail("schema-weakened", documentPath, "candidate schema is no longer closed");
  }

  const baseFields = flattenRequired(baseline.fields ?? {}, "");
  const candidateFields = flattenRequired(candidate.fields ?? {}, "");

  for (const [label, wasRequired] of baseFields) {
    if (!wasRequired) continue;
    const nowRequired = candidateFields.get(label);
    if (nowRequired === undefined) {
      sink.fail("schema-weakened", documentPath, `mandatory field ${label} was removed`);
    } else if (nowRequired === false) {
      sink.fail("schema-weakened", documentPath, `mandatory field ${label} was made optional`);
    }
  }

  const baseRules = new Set((baseline.rules ?? []).map((rule) => rule.id));
  const candidateRules = new Set((candidate.rules ?? []).map((rule) => rule.id));
  for (const id of baseRules) {
    if (!candidateRules.has(id)) {
      sink.fail("schema-weakened", documentPath, `relational rule ${id} was removed`);
    }
  }

  const versionChange = classifyVersionChange(baseline.version, candidate.version);
  if (versionChange === "invalid") {
    sink.fail("schema-version-malformed", documentPath, `candidate version ${candidate.version} does not follow ${baseline.version}`);
  }
}

function flattenRequired(fields, prefix) {
  const result = new Map();
  for (const [key, spec] of Object.entries(fields)) {
    const label = join(prefix, key);
    result.set(label, Boolean(spec.required));
    if (spec.type === "object" && spec.fields) {
      for (const [nested, required] of flattenRequired(spec.fields, label)) result.set(nested, required);
    }
    if (spec.type === "array" && spec.items?.type === "object" && spec.items.fields) {
      for (const [nested, required] of flattenRequired(spec.items.fields, `${label}[]`)) result.set(nested, required);
    }
  }
  return result;
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
