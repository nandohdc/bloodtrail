/**
 * R26 — the declared path classification must cover the tracked repository.
 *
 * The defect these cover is not a false pass on a change; it is a *latent* gap.
 * Classification is evaluated over the commit range, so a tracked path that
 * matches no declared pattern is invisible until some unrelated change happens
 * to touch it, and then it fails that change. Nine such paths accumulated in the
 * live repository before a release pull request found two of them.
 *
 * The distinction from `path-unclassified` is the question asked. That rule asks
 * "is every path this change touched classified?"; these controls ask "does the
 * declared classification cover the repository at all?" — which is why an
 * emergency record satisfies the first and must not satisfy the second: an R21
 * record ends when its change merges, and a tracked file does not.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { rmSync } from "node:fs";
import { join } from "node:path";

import { createRepository } from "./support/disposable-repo.mjs";
import {
  POLICY_PATH,
  assertDiagnostic,
  assertNoDiagnostic,
  assertPasses,
  runChecker,
} from "./support/harness.mjs";

const INCOMPLETE = "path-classification-incomplete";
const UNAVAILABLE = "tracked-paths-unavailable";
const UNCLASSIFIED = "path-unclassified";

/** A marker no diagnostic may echo: contents stay out of the output entirely. */
const SECRET = "PROBE-CONTENT-MUST-NOT-APPEAR";

const repositories = [];
function fixture(options) {
  const repository = createRepository(options);
  repositories.push(repository);
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

const check = (repository, options = {}) =>
  runChecker(repository, { phase: "implementation", ...options });

/** Adds a tracked file that matches no declared pattern. */
function addUnclassified(repository, path) {
  repository.write(path, `${SECRET}\n`);
}

function addPattern(repository, pathClass, pattern) {
  repository.mutateJson(POLICY_PATH, (policy) => {
    const entry = policy.path_classes.find((candidate) => candidate.class === pathClass);
    entry.patterns = [...entry.patterns, pattern];
    return policy;
  });
}

function removePattern(repository, pathClass, pattern) {
  repository.mutateJson(POLICY_PATH, (policy) => {
    const entry = policy.path_classes.find((candidate) => candidate.class === pathClass);
    entry.patterns = entry.patterns.filter((candidate) => candidate !== pattern);
    return policy;
  });
}

function diagnosticPaths(result, id) {
  return (result.report?.failures ?? [])
    .filter((entry) => entry.id === id)
    .map((entry) => entry.path);
}

describe("R26 path classification covers the tracked repository", () => {
  it("passes on a fully classified tree and reports how many paths it classified", () => {
    const repository = fixture();
    const base = repository.head();
    repository.write("packages/example/src/probe.ts", "export const probe = 1;\n");
    repository.commit("feat: add probe");

    const result = check(repository, { base });
    assertPasses(result);
    assertNoDiagnostic(result, INCOMPLETE);

    // An enumeration that silently returned nothing would read as trivially
    // complete, so the count is asserted positive rather than merely present.
    const tracked = repository.git(["ls-files"]).split("\n").filter((line) => line.length > 0);
    assert.equal(result.report.classifiedPaths, tracked.length,
      "the reported count must equal the repository's tracked file count");
    assert.ok(result.report.classifiedPaths > 0, "a zero count must never read as complete");
  });

  it("M-CL-A rejects a tracked path that matches no declared pattern and names it", () => {
    const repository = fixture();
    const base = repository.head();
    addUnclassified(repository, "unclassified-probe.txt");
    repository.commit("chore: add an unclassified path");

    const result = check(repository, { base });
    assertDiagnostic(result, INCOMPLETE);
    assert.deepEqual(diagnosticPaths(result, INCOMPLETE), ["unclassified-probe.txt"]);
  });

  it("M-CL-B names every uncovered path, not only the first", () => {
    const repository = fixture();
    const base = repository.head();
    addUnclassified(repository, "probe-b.txt");
    addUnclassified(repository, "probe-a.txt");
    repository.commit("chore: add two unclassified paths");

    const result = check(repository, { base });
    assertDiagnostic(result, INCOMPLETE);
    // Sorted, so one edit fixes the whole gap rather than a sequence of
    // rediscoveries as each newly-first path surfaces.
    assert.deepEqual(diagnosticPaths(result, INCOMPLETE), ["probe-a.txt", "probe-b.txt"]);
  });

  it("M-CL-C rejects coverage withdrawn by deleting a pattern", () => {
    const repository = fixture();
    const base = repository.head();
    removePattern(repository, "documentation_only", "README.md");
    repository.commit("chore: narrow the documentation patterns");

    const result = check(repository, { base });
    assertDiagnostic(result, INCOMPLETE);
    assert.ok(diagnosticPaths(result, INCOMPLETE).includes("README.md"),
      "a path left uncovered by a pattern deletion must be named");
  });

  it("M-CL-D accepts a path added together with its classification", () => {
    const repository = fixture();
    const base = repository.head();
    addUnclassified(repository, "release-metadata.txt");
    addPattern(repository, "documentation_only", "release-metadata.txt");
    repository.commit("chore: add a classified path");

    const result = check(repository, { base });
    assertPasses(result);
    assertNoDiagnostic(result, INCOMPLETE);
  });

  it("M-CL-E disregards untracked and ignored files", () => {
    const repository = fixture();
    const base = repository.head();
    repository.write(".gitignore", "ignored-probe.txt\n");
    addPattern(repository, "documentation_only", ".gitignore");
    repository.commit("chore: ignore a probe path");

    // Neither is tracked: one is ignored, the other simply never added.
    repository.write("ignored-probe.txt", `${SECRET}\n`);
    repository.write("untracked-probe.txt", `${SECRET}\n`);

    const result = check(repository, { base });
    assertNoDiagnostic(result, INCOMPLETE);
  });

  it("M-CL-F fails closed when tracked paths cannot be enumerated", () => {
    const repository = fixture();
    // Removing the repository metadata is the only way to make enumeration fail
    // without also hand-editing the checker. Every other check degrades too,
    // which is why this asserts the specific diagnostic rather than non-zero.
    rmSync(join(repository.root, ".git"), { recursive: true, force: true });

    const result = check(repository);
    assertDiagnostic(result, UNAVAILABLE);
    assert.notEqual(result.report?.classifiedPaths, 0,
      "a failed enumeration must not report zero classified paths as success");
  });

  it("M-CL-G does not accept an emergency record as permanent coverage", () => {
    const repository = fixture();
    const base = repository.head();
    addUnclassified(repository, "emergency-probe.txt");
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.emergency_records = [{
        change: "establish-design-pattern-governance",
        proposal_baseline_commit: base,
        affected_paths: ["emergency-probe.txt"],
        conservative_path_class: "governed_implementation",
        disposition: "conservative_full_assessment",
        reason: "An exact-change emergency classification covering a probe path for this control.",
        incident_reference: "control",
        follow_up: "control",
        owner_governance_commit: base,
        terminated_by: "pending",
      }];
      return policy;
    });
    repository.commit("chore: add an emergency record");

    const result = check(repository, { base });
    // The emergency record is what R21 provides, and it is enough for the
    // range-scoped rule. It must not be enough for the repository-scoped one.
    assertDiagnostic(result, INCOMPLETE);
    assert.ok(diagnosticPaths(result, INCOMPLETE).includes("emergency-probe.txt"));
    assertNoDiagnostic(result, UNCLASSIFIED);
  });

  it("runs in a phase that does not inspect the range", () => {
    const repository = fixture();
    addUnclassified(repository, "assessment-phase-probe.txt");
    repository.commit("chore: add an unclassified path");

    // The assessment phase inspects no commit range, so a range-scoped rule
    // cannot see this path at all; completeness must still.
    const result = check(repository, { phase: "assessment" });
    assertDiagnostic(result, INCOMPLETE);
  });

  it("bounds its diagnostics and never echoes file contents", () => {
    const repository = fixture();
    const base = repository.head();
    for (let index = 0; index < 80; index += 1) {
      addUnclassified(repository, `probe-${String(index).padStart(3, "0")}.txt`);
    }
    repository.commit("chore: add many unclassified paths");

    const result = check(repository, { base });
    assertDiagnostic(result, INCOMPLETE);
    assert.ok(!result.stdout.includes(SECRET) && !result.stderr.includes(SECRET),
      "diagnostics must name paths, never their contents");
    for (const entry of result.report.failures) {
      assert.ok(entry.message.length <= 240, `diagnostic message is unbounded: ${entry.message.length}`);
      assert.ok(!/[\u0000-\u001f]/u.test(entry.path), "control characters must be escaped out of a path");
    }
  });
});
