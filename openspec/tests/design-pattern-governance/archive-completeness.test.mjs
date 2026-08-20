/**
 * R25 — an archive relocation must be complete in the commit.
 *
 * The defect these cover passed every gate: an archive commit that added the
 * dated archive directory and never staged the removal of the active one. The
 * local battery folds the working tree into the inspected range and seeds active
 * change ids from disk, so it validated the move that was *performed*; CI saw
 * only legitimately covered added paths and never asked whether the active
 * directory was still there.
 *
 * A fixture cannot half-stage an index through `commit()`, which runs `git add
 * -A`. It does not need to: copying the directory onto the archive path and
 * leaving the original in place produces the identical committed end state —
 * both present at HEAD — which is exactly what the defect produced.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { cpSync, mkdirSync } from "node:fs";
import { join } from "node:path";

import { createRepository, localCheckerPath } from "./support/disposable-repo.mjs";
import { assertDiagnostic, assertNoDiagnostic, assertPasses, runChecker } from "./support/harness.mjs";

const ACTIVE = "openspec/changes/establish-design-pattern-governance";
const ARCHIVE = "openspec/changes/archive/2026-08-16-establish-design-pattern-governance";
const CHECKER = "openspec/scripts/check-design-pattern-governance.mjs";
const INCOMPLETE = "archive-relocation-incomplete";

const repositories = [];
function fixture() {
  const repository = createRepository();
  repositories.push(repository);
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

const check = (repository, base, options = {}) =>
  runChecker(repository, { phase: "implementation", base, ...options });

function archiveParent(repository) {
  mkdirSync(join(repository.root, "openspec/changes/archive"), { recursive: true });
}

/** The complete move: the active directory is gone at HEAD. */
function relocate(repository) {
  archiveParent(repository);
  repository.git(["mv", ACTIVE, ARCHIVE]);
}

/** The defect: the archive is added and the active directory is left behind. */
function copyWithoutRemoving(repository) {
  archiveParent(repository);
  cpSync(join(repository.root, ACTIVE), join(repository.root, ARCHIVE), { recursive: true });
}

describe("R25 an archive relocation is complete in the commit", () => {
  it("rejects a relocation that adds the archive without removing the active directory", () => {
    const repository = fixture();
    const base = repository.head();
    copyWithoutRemoving(repository);
    repository.commit("docs(openspec): archive the governed change");

    const result = check(repository, base);
    assertDiagnostic(result, INCOMPLETE);
    assertDiagnosticPath(result, INCOMPLETE, ARCHIVE);
  });

  it("accepts a relocation that removes the active directory in the same commit", () => {
    const repository = fixture();
    const base = repository.head();
    relocate(repository);
    repository.write(`${ARCHIVE}/tasks.md`, "- [x] 10.9 Create the separate governed archive commit\n");
    repository.commit("docs(openspec): archive the governed change");

    const result = check(repository, base);
    assertPasses(result);
    assertNoDiagnostic(result, INCOMPLETE);
  });

  it("does not fire on an archive directory whose relocation an earlier range introduced", () => {
    const repository = fixture();
    relocate(repository);
    repository.write(`${ARCHIVE}/tasks.md`, "- [x] 10.9 Create the separate governed archive commit\n");
    repository.commit("docs(openspec): archive the governed change");
    const base = repository.head();

    // The only shape that could produce a false positive: the id is re-opened
    // as a new active change, and a later commit touches the finished archive.
    repository.write(`${ACTIVE}/proposal.md`, "# Re-opened under the same id\n");
    repository.write(`${ARCHIVE}/notes.md`, "A later edit to a directory this range did not relocate.\n");
    repository.commit("docs(openspec): re-open the id and touch the finished archive");

    assertNoDiagnostic(check(repository, base), INCOMPLETE);
  });

  it("does not fire when a completed relocation and a re-opened id share one range", () => {
    const repository = fixture();
    const base = repository.head();
    relocate(repository);
    repository.write(`${ARCHIVE}/tasks.md`, "- [x] 10.9 Create the separate governed archive commit\n");
    repository.commit("docs(openspec): archive the governed change");

    // The move is complete. What lands next is a *new* change that happens to
    // reuse the id, so the active directory at HEAD is not the one relocated —
    // and `base` cannot tell the two apart, because it predates both commits.
    repository.write(`${ACTIVE}/proposal.md`, "# Re-opened under the same id\n");
    repository.commit("docs(openspec): re-open the id as new work");

    assertNoDiagnostic(check(repository, base), INCOMPLETE);
  });

  it("stops reporting when the call site is removed, so the control is known to be wired", () => {
    const repository = fixture();
    const base = repository.head();
    removeCompletenessCallSite(repository);
    copyWithoutRemoving(repository);
    repository.commit("chore: remove the completeness call site");

    const result = check(repository, base, { checker: localCheckerPath(repository) });
    assert.notEqual(result.report, null,
      `the mutated checker produced no JSON report, so its silence proves nothing; stderr:\n${result.stderr}`);
    assertNoDiagnostic(result, INCOMPLETE);
  });
});

/**
 * Asserts which path a diagnostic is reported against.
 *
 * `assertDiagnostic` checks the id and the exit code only, and the path is
 * contract-relevant: the dual check compares baseline and candidate diagnostics
 * as id-and-path pairs, so a control reporting the wrong path would break a
 * signed baseline-disagreement acceptance without changing any id.
 */
function assertDiagnosticPath(result, id, expectedPath) {
  const paths = result.report.failures.filter((entry) => entry.id === id).map((entry) => entry.path);
  assert.deepEqual(paths, [expectedPath],
    `expected "${id}" to be reported against ${expectedPath}, got [${paths.join(", ") || "none"}]`);
}

/**
 * Cuts the one wire between the checker and the control.
 *
 * The assertion matters as much as the edit: if the call site is renamed or
 * reshaped, this fails loudly instead of removing nothing and reporting a
 * mutation that never happened.
 */
function removeCompletenessCallSite(repository) {
  const source = repository.read(CHECKER);
  const mutated = source.replace(/^[^\n]*checkRelocationCompleteness\(\{[^\n]*\n/m, "");
  // assert.ok, not assert.notEqual: an inequality assertion on two 15 KB sources
  // dumps both into the failure output and buries the one line that matters.
  assert.ok(mutated !== source, "no checkRelocationCompleteness call site was found to remove");
  repository.write(CHECKER, mutated);
}
