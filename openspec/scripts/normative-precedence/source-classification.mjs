import { spawnSync } from "node:child_process";
import {
  byCodePoint,
  diagnostic
} from "./shared.mjs";

export function baselineDebtFor(debts, assertion, sourceObject, capabilityObject) {
  return (debts ?? []).find((entry) =>
    entry.assertion_id === assertion.id
    && entry.source_blob === sourceObject
    && entry.capability_blob === capabilityObject
  );
}

export function changedPaths(repoRoot, baseCommit) {
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

export function debtAllowedAtStage(debt, stage, repositoryChanges) {
  if (!debt?.allowed_stages?.includes(stage)) return false;
  if (stage !== "merge") return true;
  if (!Array.isArray(repositoryChanges)) return false;
  return repositoryChanges.every((path) =>
    debt.allowed_merge_path_prefixes?.some((prefix) => pathMatchesPrefix(path, prefix))
  );
}

export function sourceSections(policy) {
  return new Set((policy.requirement_ownership ?? []).flatMap((entry) => entry.source_sections));
}

function shapePatternMatches(pattern, path) {
  const patternParts = pattern.split("/").slice(1);
  const pathParts = path.split("/").slice(1);
  return patternParts.length === pathParts.length
    && patternParts.every((part, index) => part === "*" || part === pathParts[index]);
}

function pointerPatternCovers(pattern, pointer) {
  const patternParts = pattern.split("/").slice(1);
  const pointerParts = pointer.split("/").slice(1);
  return patternParts.length <= pointerParts.length
    && patternParts.every((part, index) => part === "*" || part === pointerParts[index]);
}

function pointerToken(value) {
  return String(value).replaceAll("~", "~0").replaceAll("/", "~1");
}

export function changedJsonPointers(before, after, path = "") {
  if (JSON.stringify(before) === JSON.stringify(after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) return changedArrayPointers(before, after, path);
  if (bothJsonObjects(before, after)) return changedObjectPointers(before, after, path);
  return [path || "/"];
}

function bothJsonObjects(before, after) {
  return before !== null && after !== null && typeof before === "object" && typeof after === "object";
}

function changedArrayPointers(before, after, path) {
  const changes = [];
  const length = Math.max(before.length, after.length);
  for (let index = 0; index < length; index += 1) {
    changes.push(...changedJsonPointers(before[index], after[index], `${path}/${index}`));
  }
  return changes;
}

function changedObjectPointers(before, after, path) {
  const changes = [];
  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort(byCodePoint);
  for (const key of keys) {
    changes.push(...changedJsonPointers(before[key], after[key], `${path}/${pointerToken(key)}`));
  }
  return changes;
}

function deltaAuthorizesPointer(delta, { capabilityId, ownedDimensions, sourcePath, pointer }) {
  return delta.class === "ACTIVE_CANDIDATE_DELTA"
    && delta.capability_id === capabilityId
    && delta.authorized_paths.some((declared) => authorizedPathMatches(sourcePath, declared))
    && ownedDimensions.every((dimension) => delta.authorized_semantic_dimensions.includes(dimension))
    && delta.authorized_source_pointers.some((pattern) => pointerPatternCovers(pattern, pointer));
}

function authorizedPathMatches(path, declared) {
  if (declared.endsWith("/**")) return path === declared.slice(0, -3) || path.startsWith(declared.slice(0, -2));
  return pathMatchesPrefix(path, declared);
}

function pointerAuthorizers(semanticRows, activeDeltas, sourcePath, pointer) {
  const requiredCapabilities = [...new Set(semanticRows.flatMap((row) => row.capability_ids))].sort(byCodePoint);
  const authorizers = [];
  const missing = [];
  for (const capabilityId of requiredCapabilities) {
    const ownedDimensions = semanticRows.filter((row) => row.capability_ids.includes(capabilityId)).map((row) => row.dimension);
    const delta = activeDeltas.find((entry) => deltaAuthorizesPointer(entry, { capabilityId, ownedDimensions, sourcePath, pointer }));
    if (delta) authorizers.push(delta);
    else missing.push(`${capabilityId} (${ownedDimensions.join(", ")})`);
  }
  return { authorizers, missing };
}

function classifyChangedPointer(policy, pointer, activeDeltas, sourcePath) {
  const diagnostics = [];
  const rows = (policy.semantic_delegation ?? []).filter((row) =>
    row.source_patterns.some((pattern) => pointerPatternCovers(pattern, pointer))
  );
  const semanticRows = rows.filter((row) => row.classification === "SEMANTIC_REQUIREMENT");
  const representationOnly = rows.length > 0 && semanticRows.length === 0
    && rows.every((row) => row.classification === "REPRESENTATION_DETAIL" && row.delegation === "REPRESENTATION_DETAIL");
  if (representationOnly) {
    return { result: { pointer, classification: "REPRESENTATION_DETAIL", authorized_by: [] }, diagnostics };
  }
  const authorization = pointerAuthorizers(semanticRows, activeDeltas, sourcePath, pointer);
  if (semanticRows.length === 0) {
    diagnostics.push(diagnostic("source-semantic-classification-missing", `${sourcePath}#${pointer}`, "changed source property defaults to semantic and has no explicit owner/delegation mapping"));
  } else if (authorization.missing.length > 0) {
    diagnostics.push(diagnostic("source-semantic-change-unauthorized", `${sourcePath}#${pointer}`, `semantic change requires exact apply-authorized deltas for ${authorization.missing.join("; ")}`));
  }
  return {
    result: {
      pointer,
      classification: "SEMANTIC_REQUIREMENT",
      dimensions: semanticRows.map((row) => row.dimension),
      authorized_by: authorization.authorizers.map((entry) => `${entry.change_id}:${entry.capability_id}`)
    },
    diagnostics
  };
}

export function classifySourceChanges(policy, before, after, ...context) {
  const [activeDeltas, sourcePath] = context;
  const diagnostics = [];
  const results = [];
  for (const pointer of changedJsonPointers(before, after)) {
    const classified = classifyChangedPointer(policy, pointer, activeDeltas, sourcePath);
    results.push(classified.result);
    diagnostics.push(...classified.diagnostics);
  }
  return { changes: results, diagnostics, materialSemanticChange: results.some((entry) => entry.classification === "SEMANTIC_REQUIREMENT") };
}

export function validateSourceShape(value, path, rules) {
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
