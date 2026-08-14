/**
 * R15 — one signed governance record binds frozen technical content.
 *
 * Every scenario here is built on real disposable Git history: a technical
 * commit T, a signed record S introduced as a record-only commit after it, and
 * then the specific mutation under test. Nothing is asserted from prose or
 * checkbox state, because freshness derives exclusively from what history shows.
 */

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { after, describe, it } from "node:test";

import { createRepository } from "./support/disposable-repo.mjs";
import {
  ASSESSMENT_PATH,
  POLICY_PATH,
  assertDiagnostic,
  assertNoDiagnostic,
  assertPasses,
  runChecker,
} from "./support/harness.mjs";

const CHANGE = "establish-design-pattern-governance";
const RECORD_PATH = "packages/security-audit-sdk-core/verification-lifecycle.json";
const CHECKER_PATH = "openspec/scripts/check-design-pattern-governance.mjs";
const ACTIVATION_PATH = "openspec/governance/activation-record.json";

// The seeded fixture copies these three subtrees, so each can be bound to the
// fixture's own technical commit.
const REVIEWED_PATHS = [
  "openspec/changes/establish-design-pattern-governance",
  "openspec/governance",
  "openspec/scripts",
];

const repositories = [];
function fixture() {
  const repository = createRepository();
  repositories.push(repository);
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

const check = (repository) => runChecker(repository, { phase: "final" });

function buildRecord(repository, technical, entries) {
  return {
    change: CHANGE,
    policy: "Fixture signed record binding the exact technical commit and its content objects.",
    reviewedCommit: technical,
    reviewedContent: {
      kind: "tree",
      candidateRoot: repository.git(["rev-parse", `${technical}^{tree}`]).trim(),
      entries,
    },
    governedCommits: [technical],
    boundCommits: [technical],
    mergeCommits: [],
    authorizations: { granted: ["fixture-review"], withheld: ["fixture-withheld"] },
    assuranceLimitations: ["Fixture record; not assurance."],
    signed: true,
    reviewer: { name: "Fixture Reviewer", role: "Fixture owner", signedAt: "2099-01-01" },
  };
}

/** Signs the current HEAD as the exact technical commit in a record-only commit. */
function sign(repository, options = {}) {
  const technical = repository.head();
  const entries = REVIEWED_PATHS.map((path) => ({
    path,
    object: repository.git(["rev-parse", `${technical}:${path}`]).trim(),
  }));
  repository.mutateJson(RECORD_PATH, (manifest) => {
    const record = buildRecord(repository, technical, entries);
    if (options.replace) {
      const index = manifest.governanceRecords.findIndex((entry) => entry.change === CHANGE);
      if (index === -1) manifest.governanceRecords.push(record);
      else manifest.governanceRecords[index] = record;
    } else {
      manifest.governanceRecords.push(record);
    }
    return manifest;
  });
  const signed = repository.commit("docs: the signed governance record");
  return { technical, signed, entries };
}

/** Appends a newline so the blob changes while the parsed document stays valid. */
function touch(repository, path) {
  repository.write(path, `${repository.read(path)}\n`);
}

function failureText(result, id) {
  const entry = result.report?.failures?.find((failure) => failure.id === id);
  return entry ? `${entry.path} ${entry.message}` : "";
}

describe("R15 a change that was never signed is a legitimate pre-sign state", () => {
  it("passes final verification with an empty record source", () => {
    assertPasses(check(fixture()));
  });
});

describe("R15 the signed record must be a record-only commit after T", () => {
  it("accepts T followed by a record-only signed record S", () => {
    const repository = fixture();
    const { technical, signed } = sign(repository);
    assert.equal(repository.git(["rev-parse", `${signed}^`]).trim(), technical,
      "S must be T's direct child");
    assertPasses(check(repository));
  });

  it("accepts a governance-record-only commit after S", () => {
    const repository = fixture();
    sign(repository);
    repository.mutateJson(RECORD_PATH, (manifest) => {
      manifest.governanceRecords[0].reviewer.signedAt = "2099-01-02";
      return manifest;
    });
    repository.commit("docs: record-only follow-up to the signed record");

    assertPasses(check(repository));
  });

  it("accepts an identity-preserving merge that carries T and S onto the mainline", () => {
    const repository = fixture();
    repository.branch("feat/governance");
    repository.write("packages/example/src/feature.mjs", "export const feature = 1;\n");
    repository.commit("feat: the reviewed technical commit");
    sign(repository);
    repository.checkout("main");
    repository.git(["merge", "--no-ff", "feat/governance", "-m", "Merge governance"]);

    assertPasses(check(repository));
  });
});

describe("R15 any normative commit after S makes the signed record stale", () => {
  const cases = [
    ["assessment evidence", ASSESSMENT_PATH],
    ["policy", POLICY_PATH],
    ["the checker implementation", CHECKER_PATH],
    ["governance test evidence", "openspec/tests/design-pattern-governance/post-sign.test.mjs"],
    ["CI workflow", ".github/workflows/ci.yml"],
    ["a new normative implementation path", "packages/example/src/feature.mjs"],
  ];

  for (const [label, path] of cases) {
    it(`rejects a post-S change to ${label}`, () => {
      const repository = fixture();
      sign(repository);
      if (path === "openspec/tests/design-pattern-governance/post-sign.test.mjs") {
        repository.write(path, "// post-sign governance evidence\n");
      } else if (path === "packages/example/src/feature.mjs") {
        repository.write(path, "export const feature = 1;\n");
      } else {
        touch(repository, path);
      }
      const commit = repository.commit(`feat: normative change after signing (${label})`);

      const result = check(repository);
      assertDiagnostic(result, "signed-review-stale");
      assert.match(failureText(result, "signed-review-stale"), new RegExp(path.replaceAll("/", "\\/")),
        `the stale diagnostic must name the changed path ${path}`);
      assert.match(failureText(result, "signed-review-stale"), new RegExp(commit),
        "the stale diagnostic must name the offending commit");
    });
  }

  it("rejects a mainline commit merged into the branch after S", () => {
    const repository = fixture();
    repository.branch("feat/governance");
    repository.write("packages/example/src/feature.mjs", "export const feature = 1;\n");
    repository.commit("feat: the reviewed technical commit");
    sign(repository);
    repository.checkout("main");
    repository.write("packages/example/src/mainside.mjs", "export const mainside = 1;\n");
    repository.commit("feat: a mainline normative change");
    repository.checkout("feat/governance");
    repository.git(["merge", "main", "-m", "Merge main into the feature branch"]);

    const result = check(repository);
    assertDiagnostic(result, "signed-review-stale");
    assert.match(failureText(result, "signed-review-stale"), /mainside\.mjs/,
      "the merged mainline change must be caught by the individual commit inspection");
  });
});

describe("R15 a renewed T and S clears the stale state", () => {
  it("accepts a replacement record bound to the new technical head", () => {
    const repository = fixture();
    sign(repository);
    touch(repository, POLICY_PATH);
    repository.commit("feat: a normative commit after signing");
    assertDiagnostic(check(repository), "signed-review-stale");

    const { technical: replacement, signed: replacementSigned } = sign(repository, { replace: true });
    assert.equal(repository.git(["rev-parse", `${replacementSigned}^`]).trim(), replacement,
      "the replacement record must be the replacement technical commit's direct child");
    assertPasses(check(repository));
  });
});

describe("R15 the current record set is closed and unambiguous", () => {
  it("rejects deleting the signed record after it existed", () => {
    const repository = fixture();
    sign(repository);
    repository.mutateJson(RECORD_PATH, (manifest) => {
      manifest.governanceRecords = [];
      return manifest;
    });
    repository.commit("docs: remove the signed record");
    assertDiagnostic(check(repository), "signed-record-removed");
  });

  it("rejects replacing the signed record with an unsigned object", () => {
    const repository = fixture();
    sign(repository);
    repository.mutateJson(RECORD_PATH, (manifest) => {
      const record = manifest.governanceRecords[0];
      record.signed = false;
      delete record.reviewer;
      return manifest;
    });
    repository.commit("docs: unsign the record");
    assertDiagnostic(check(repository), "signed-record-removed");
  });

  it("rejects two signed records for one change", () => {
    const repository = fixture();
    sign(repository);
    repository.mutateJson(RECORD_PATH, (manifest) => {
      manifest.governanceRecords.push({ ...manifest.governanceRecords[0] });
      return manifest;
    });
    repository.commit("docs: duplicate the signed record");
    assertDiagnostic(check(repository), "signed-record-ambiguous");
  });

  it("rejects narrowing the reviewed content while claiming the same reviewed commit", () => {
    const repository = fixture();
    sign(repository);
    repository.mutateJson(RECORD_PATH, (manifest) => {
      manifest.governanceRecords[0].reviewedContent.entries =
        manifest.governanceRecords[0].reviewedContent.entries.slice(0, 2);
      return manifest;
    });
    repository.commit("docs: narrow the reviewed content");
    assertDiagnostic(check(repository), "signed-record-ambiguous");
  });

  it("rejects record bytes that exist only in the working tree", () => {
    const repository = fixture();
    sign(repository);
    repository.mutateJson(RECORD_PATH, (manifest) => {
      manifest.governanceRecords[0].reviewer.signedAt = "2099-12-31";
      return manifest;
    });
    // Deliberately not committed.
    assertDiagnostic(check(repository), "signed-record-uncommitted");
  });

  it("fails closed when the record source is absent", () => {
    const repository = fixture();
    sign(repository);
    repository.remove(RECORD_PATH);
    repository.commit("chore: remove the record source");
    assertDiagnostic(check(repository), "signed-record-source-absent");
  });

  it("fails closed when the record source is not valid JSON", () => {
    const repository = fixture();
    sign(repository);
    repository.write(RECORD_PATH, "{ not json\n");
    repository.commit("chore: corrupt the record source");
    assertDiagnostic(check(repository), "signed-record-source-invalid");
  });

  it("fails closed when the record source exists only uncommitted", () => {
    const repository = fixture();
    repository.remove(RECORD_PATH);
    repository.commit("chore: remove the record source");
    repository.write(RECORD_PATH, `${JSON.stringify({ governanceRecords: [] }, null, 2)}\n`);
    assertDiagnostic(check(repository), "signed-record-uncommitted");
  });
});

describe("R15 incomplete history cannot establish freshness", () => {
  it("fails closed in a shallow clone", () => {
    const repository = fixture();
    sign(repository);
    const shallowRoot = mkdtempSync(join(tmpdir(), "bloodtrail-freshness-shallow-"));
    repositories.push({ dispose: () => rmSync(shallowRoot, { recursive: true, force: true }) });
    execFileSync("git", ["clone", "--quiet", "--no-hardlinks", "--depth", "1", `file://${repository.root}`, shallowRoot]);
    assertDiagnostic(runChecker({ root: shallowRoot }, { phase: "final" }), "signed-review-history-unavailable");
  });

  it("fails closed when the bound technical commit does not resolve", () => {
    const repository = fixture();
    sign(repository);
    repository.mutateJson(RECORD_PATH, (manifest) => {
      manifest.governanceRecords[0].reviewedCommit = "0".repeat(40);
      manifest.governanceRecords[0].boundCommits = ["0".repeat(40)];
      return manifest;
    });
    repository.commit("docs: bind an unresolvable technical commit");
    assertDiagnostic(check(repository), "signed-review-history-unavailable");
  });

  it("fails closed when the bound technical commit is not an ancestor of HEAD", () => {
    const repository = fixture();
    sign(repository);
    repository.branch("side");
    repository.write("docs/side.md", "# side\n");
    const sideCommit = repository.commit("chore: an unmerged side commit");
    repository.checkout("main");
    repository.mutateJson(RECORD_PATH, (manifest) => {
      manifest.governanceRecords[0].reviewedCommit = sideCommit;
      manifest.governanceRecords[0].boundCommits = [sideCommit];
      return manifest;
    });
    repository.commit("docs: rebind to an unmerged commit");
    assertDiagnostic(check(repository), "signed-review-history-unavailable");
  });
});

describe("R15 the activation record is governed by its own closed controls", () => {
  it("does not report the activation record as a stale normative change", () => {
    const repository = fixture();
    sign(repository);
    repository.writeJson(ACTIVATION_PATH, { schema_version: "9.9" });
    repository.commit("feat: the dedicated activation record");

    assertNoDiagnostic(check(repository), "signed-review-stale");
  });
});

describe("R15 a signed record is not orphaned by its change disappearing", () => {
  it("rejects a signed record whose change directory has been renamed", () => {
    const repository = fixture();
    sign(repository);
    repository.git(["mv", "openspec/changes/establish-design-pattern-governance",
      "openspec/changes/renamed-probe"]);
    repository.commit("chore: rename the change directory");

    assertDiagnostic(check(repository), "signed-record-ambiguous");
  });

  it("rejects a signed record whose change directory has been deleted", () => {
    const repository = fixture();
    sign(repository);
    repository.remove("openspec/changes/establish-design-pattern-governance");
    repository.commit("chore: delete the change directory");

    assertDiagnostic(check(repository), "signed-record-ambiguous");
  });

  it("accepts a signed record whose change has been archived", () => {
    const repository = fixture();
    sign(repository);
    repository.write("openspec/changes/archive/.gitkeep", "");
    repository.commit("chore: prepare the archive directory");
    repository.git(["mv", "openspec/changes/establish-design-pattern-governance",
      "openspec/changes/archive/2099-01-01-establish-design-pattern-governance"]);
    repository.commit("chore: archive the change");

    assertNoDiagnostic(check(repository), "signed-record-ambiguous");
  });

  it("does not let a contentless archive directory exempt a signed record", () => {
    const repository = fixture();
    sign(repository);
    repository.remove("openspec/changes/establish-design-pattern-governance");
    repository.write("openspec/changes/archive/2099-01-01-establish-design-pattern-governance/.gitkeep", "");
    repository.commit("chore: replace the change with a decoy archive directory");

    assertDiagnostic(check(repository), "signed-record-ambiguous");
  });

  it("does not let a planted archive artifact exempt a signed record", () => {
    const repository = fixture();
    sign(repository);
    repository.remove("openspec/changes/establish-design-pattern-governance");
    repository.write("openspec/changes/archive/2099-01-01-establish-design-pattern-governance/proposal.md",
      "# Decoy proposal that is not the relocated change artifact\n");
    repository.commit("chore: plant an archive artifact that history never carried at the active path");

    assertDiagnostic(check(repository), "signed-record-ambiguous");
  });

  it("does not let an assessment-less change directory exempt a signed record", () => {
    const repository = fixture();
    sign(repository);
    repository.remove("openspec/changes/establish-design-pattern-governance/assessment.json");
    repository.write("openspec/changes/establish-design-pattern-governance/.gitkeep", "");
    repository.commit("chore: strip the assessment while keeping the directory name");

    assertDiagnostic(check(repository), "signed-record-ambiguous");
  });

  it("does not report another active signed change as dangling when --change scopes the run", () => {
    const repository = fixture();
    const secondId = "second-change";
    const secondAssessment = JSON.parse(repository.read(ASSESSMENT_PATH));
    secondAssessment.change_id = secondId;
    repository.writeJson(`openspec/changes/${secondId}/assessment.json`, secondAssessment);
    repository.commit("feat: introduce a second governed change");

    sign(repository);
    const technical = repository.head();
    repository.mutateJson(RECORD_PATH, (manifest) => {
      manifest.governanceRecords.push({
        ...buildRecord(repository, technical, [
          {
            path: `openspec/changes/${secondId}`,
            object: repository.git(["rev-parse", `${technical}:openspec/changes/${secondId}`]).trim(),
          },
        ]),
        change: secondId,
      });
      return manifest;
    });
    repository.commit("docs: sign the second change");

    const result = runChecker(repository, { phase: "final", change: "establish-design-pattern-governance" });
    assertNoDiagnostic(result, "signed-record-ambiguous");
  });
});
