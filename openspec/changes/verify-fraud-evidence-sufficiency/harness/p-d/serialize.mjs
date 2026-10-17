import { sha256 } from "../lib/io.mjs";
import { serializeResults } from "../lib/results.mjs";
import { marker, RECIPES } from "./markers.mjs";

function markerTable() {
  return Object.keys(RECIPES).map((name) => {
    const value = marker(name);
    return { name, value, length: value.length, sha256: sha256(value) };
  });
}

function markerReplacement(table) {
  const names = new Map(table.map(({ name, value }) => [value, name]));
  const alternatives = [...names.keys()].sort((left, right) => right.length - left.length);
  const pattern = new RegExp(alternatives.map((value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "g");
  return (value) => value.replace(pattern, (found) => `<synthetic-marker:${names.get(found)}>`);
}

function representation({ value, replace }) {
  if (typeof value === "string") return replace(value);
  if (Array.isArray(value)) return value.map((item) => representation({ value: item, replace }));
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [replace(key), representation({ value: item, replace })]));
  }
  return value;
}

// Called only after evaluation; neither observations nor evaluated notes are mutated.
export function serializeMarkerResults(result) {
  const table = markerTable();
  const value = representation({ value: result, replace: markerReplacement(table) });
  value.synthetic_markers = table.map(({ value: assembled, ...metadata }) => metadata);
  return serializeResults(value);
}
