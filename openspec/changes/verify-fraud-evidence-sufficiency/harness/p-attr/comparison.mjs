import { isDeepStrictEqual } from "node:util";
import { leafOrigins } from "./origins.mjs";

// events.ts:238-253 at the pinned base: generated metadata and request-id echo.
// Implementer default: ignore ONLY these leaves, and only if they are SC
// metadata, not carrier content. Never drop request/correlation objects.
const GENERATED = new Set([
  "event.id", "event.timestamp", "event.observed_at", "correlation.correlation_id",
  "correlation.operation_id", "request.id", "correlation.request_id",
]);

export function atPath(value, path) {
  return path.split(".").reduce((cursor, part) => cursor == null ? undefined : cursor[part], value);
}

function ignorable({ path, origins, contents }) {
  if (!GENERATED.has(path)) return false;
  if (Object.hasOwn(contents, path)) return false;
  return origins[path] === "SC";
}

function comparisonValue({ value, content }) {
  if (content === undefined) return value;
  // Preserve semantic value class, not the opaque ex/nx literal. Otherwise any
  // uniform pid-ex/pid-nx carrier would falsely disclose account existence.
  return { content_class: content.kind, value_type: typeof value };
}

export function existenceView({ event, origins, contents }) {
  const view = {};
  for (const path of Object.keys(leafOrigins({ value: event, origin: "SC" }))) {
    if (!ignorable({ path, origins, contents })) {
      view[path] = comparisonValue({ value: atPath(event, path), content: contents[path] });
    }
  }
  return view;
}

export function compareExistence({ ex, nx }) {
  const left = existenceView(ex);
  const right = existenceView(nx);
  const paths = new Set([...Object.keys(left), ...Object.keys(right)]);
  const differences = [...paths].filter((path) => !isDeepStrictEqual(left[path], right[path]));
  return { discloses: differences.length > 0, differences };
}

// Content kinds describe the synthetic value's referent, not an expected axis.
const TARGET_KINDS = new Set([
  "presented_identifier", "resolved_account", "performer", "authenticated_principal",
  "credential_reference", "session_fingerprint",
]);

export function targetFacts({ event, contents }) {
  return Object.entries(contents).filter(([path, content]) =>
    TARGET_KINDS.has(content.kind) && atPath(event, path) !== undefined).map(([path, content]) => ({
    path, value: atPath(event, path), kind: content.kind,
  }));
}

// Only predeclared field pairs count. Ground-truth identity is an independent
// fixture fact, never inferred from equality. Full L1-L3 aggregation is later.
export function joinFacts({ from, to, pairs }) {
  if (typeof from.account !== "string") return [];
  if (from.account !== to.account) return [];
  return pairs.filter((pair) => pair.from_family === from.family && pair.to_family === to.family)
    .filter((pair) => matchesPair({ from, to, pair }))
    .map((pair) => ({ ...pair, account: from.account, value: atPath(from.event, pair.from) }));
}

function matchesPair({ from, to, pair }) {
  const value = atPath(from.event, pair.from);
  if (value === undefined) return false;
  return isDeepStrictEqual(value, atPath(to.event, pair.to));
}
