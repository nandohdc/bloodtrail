import assert from "node:assert/strict";

// Implementer-default plan vocabulary; JSON data only, never executable rules.
export const FAMILIES = ["construction", "ordering", "redelivery", "concurrency", "outbox", "guarantees"];
export const OBSERVED_NOT_FROZEN = "observed_not_frozen";
export const COUNTERS = ["probe", "gate", "exchange", "sink", "business_commits"];
export const CITATION = /^(packages|contracts|openspec)\/.+:\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*$/;
const UNSAFE_PARTS = new Set(["__proto__", "prototype", "constructor"]);

export function object(value, label) {
  assert(value !== null && typeof value === "object", `${label}: object required`);
  assert(!Array.isArray(value), `${label}: object required`);
  return value;
}

export function text(value, label) {
  assert(typeof value === "string" && value.length > 0, `${label}: nonempty text required`);
}

export function list(value, label) {
  assert(Array.isArray(value), `${label}: array required`);
  return value;
}

export function natural(value, label) {
  assert(Number.isSafeInteger(value) && value >= 0, `${label}: nonnegative integer required`);
}

export function keys(value, required, optional = []) {
  object(value, "fields");
  for (const key of required) assert(Object.hasOwn(value, key), `missing ${key}`);
  const allowed = new Set([...required, ...optional]);
  for (const key of Object.keys(value)) assert(allowed.has(key), `unknown field ${key}`);
}

export function counters(value) {
  keys(value, COUNTERS);
  for (const key of COUNTERS) natural(value[key], `counters.${key}`);
}

export function pathParts(path) {
  text(path, "path");
  const parts = path.split(".");
  for (const part of parts) {
    assert(/^[A-Za-z0-9_-]+$/.test(part), "invalid path segment");
    assert(!UNSAFE_PARTS.has(part), "unsafe path segment");
  }
  return parts;
}

export function atPath(value, path) {
  return pathParts(path).reduce((current, key) => {
    if (current === null || current === undefined) return undefined;
    return Object.hasOwn(Object(current), key) ? current[key] : undefined;
  }, value);
}

export function unique(values, label) {
  assert.equal(new Set(values).size, values.length, `duplicate ${label}`);
}

export function owned(id, caseId) {
  text(id, "step_id");
  assert(id.startsWith(`${caseId}/`), `${id}: outside owned namespace ${caseId}`);
  assert(id.length > caseId.length + 1, "empty step suffix");
}
