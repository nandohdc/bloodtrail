import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { diagnostic, readJson } from "./shared.mjs";

function occurrences(text, anchor) {
  if (!anchor) return 0;
  let count = 0;
  let offset = 0;
  while ((offset = text.indexOf(anchor, offset)) !== -1) {
    count += 1;
    offset += anchor.length;
  }
  return count;
}

export function loadMutationManifest(repoRoot, path) {
  return readJson(resolve(repoRoot, path));
}

export function preflightMutationAnchors(repoRoot, manifest) {
  const diagnostics = [];
  for (const mutant of manifest.mutants ?? []) {
    const text = readFileSync(resolve(repoRoot, mutant.target_path), "utf8");
    const count = occurrences(text, mutant.anchor);
    if (count === 0) diagnostics.push(diagnostic("mutation-anchor-missing", mutant.id, mutant.target_path));
    if (count > 1) diagnostics.push(diagnostic("mutation-anchor-ambiguous", mutant.id,
      `${mutant.target_path} contains ${count} matching anchors`));
  }
  return diagnostics;
}

export function evaluateMutationSummary(summary) {
  const diagnostics = [];
  if (summary.applied !== summary.expected || summary.not_applied !== 0) {
    diagnostics.push(diagnostic("mutation-not-applied", "mutation", `EXPECTED=${summary.expected} APPLIED=${summary.applied} NOT_APPLIED=${summary.not_applied}`));
  }
  if (summary.survived !== 0) diagnostics.push(diagnostic("mutation-survived", "mutation", `${summary.survived} mutant(s) survived`));
  if (summary.dirty_controls !== 0) diagnostics.push(diagnostic("mutation-null-control-dirty", "mutation", `${summary.dirty_controls} null control(s) were dirty`));
  if (summary.restoration_mismatches !== 0) diagnostics.push(diagnostic("mutation-restoration-mismatch", "mutation", `${summary.restoration_mismatches} restoration mismatch(es)`));
  return diagnostics;
}

export function sha256Bytes(value) {
  return createHash("sha256").update(value).digest("hex");
}
