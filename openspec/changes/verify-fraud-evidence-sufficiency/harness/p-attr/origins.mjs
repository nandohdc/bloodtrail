import assert from "node:assert/strict";

export const ORIGINS = Object.freeze(["CP", "SR", "SC"]);

// Content origin, not execution location: transforms never upgrade CP to SC.
export function tagged({ value, origin }) {
  assert(ORIGINS.includes(origin), "unknown content origin");
  return Object.freeze({ value, origin });
}

export function leafOrigins({ value, origin, path = "" }) {
  if (value === null || typeof value !== "object") return { [path]: origin };
  return Object.assign({}, ...Object.entries(value).map(([key, child]) =>
    leafOrigins({ value: child, origin, path: path ? `${path}.${key}` : key })));
}

export function captureOrigins({ event, origins }) {
  const captured = leafOrigins({ value: event, origin: "SC" });
  for (const path of Object.keys(captured)) {
    if (Object.hasOwn(origins, path)) captured[path] = origins[path];
  }
  if (event.correlation.request_id !== undefined) {
    captured["correlation.request_id"] = origins["correlation.request_id"] ?? origins["request.id"] ?? "SC";
  }
  return captured;
}
