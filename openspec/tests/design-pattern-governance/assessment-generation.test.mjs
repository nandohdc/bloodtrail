import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DEFAULT_SECURITY_JUSTIFICATIONS,
  SECURITY_DIMENSIONS,
  generateAssessment,
  scaffoldSource,
  stableJson
} from "../../scripts/design-pattern-governance/assessment-generation.mjs";
import { ASSESSMENT, createRepository } from "./support/disposable-repo.mjs";
import { assertPasses, runChecker } from "./support/harness.mjs";

function sourceFromAssessment(assessment) {
  return {
    decision: assessment.decision,
    forces: assessment.forces,
    applicability: assessment.applicability,
    candidate_approaches: assessment.candidate_approaches,
    selected_approach_id: assessment.selected_approach_id,
    rejected_alternative_ids: assessment.rejected_alternative_ids,
    rejection_reasons: assessment.rejection_reasons,
    implementation_invariant_ids: assessment.implementation_invariant_ids,
    invariant_evidence: assessment.invariant_evidence,
    security_sensitive: assessment.security_sensitive,
    security_justification: assessment.security_justification,
    verification_task_ids: assessment.verification_task_ids
  };
}

describe("assessment generation and scaffolding", () => {
  it("scaffolds an authored assessment.source.json template", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "scaffold-test-"));
    try {
      const target = scaffoldSource(tempDir);
      const parsed = JSON.parse(readFileSync(target, "utf8"));
      assert.equal(parsed.decision, "direct_implementation");
      assert.equal(parsed.security_sensitive, false);
      assert.ok(Array.isArray(parsed.forces));
      assert.ok(Array.isArray(parsed.candidate_approaches));
      assert.equal(parsed.candidate_approaches.length, 2);

      // Throws if scaffolded twice
      assert.throws(() => scaffoldSource(tempDir), /already exists/);
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("derives all 15 security dimension justifications deterministically when security_sensitive is false", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "derive-test-"));
    try {
      const source = {
        decision: "direct_implementation",
        forces: ["Valid force description with sufficient characters."],
        candidate_approaches: [
          {
            id: "approach-direct-foo",
            kind: "direct_implementation",
            summary: "Direct implementation with sufficient character length.",
            forces_addressed: ["Valid force description with sufficient characters."]
          },
          {
            id: "approach-alt-foo",
            kind: "alternative",
            summary: "Alternative approach with sufficient character length.",
            forces_addressed: ["Valid force description with sufficient characters."]
          }
        ],
        selected_approach_id: "approach-direct-foo",
        rejected_alternative_ids: ["approach-alt-foo"],
        rejection_reasons: {
          "approach-alt-foo": {
            forces: ["Valid force description with sufficient characters."],
            reason: "Detailed force-based rejection reason with at least forty characters."
          }
        },
        implementation_invariant_ids: ["implementation-foo"],
        invariant_evidence: {
          "implementation-foo": {
            task_ids: ["1.1"],
            evidence_ids: ["test-fixture-proof"]
          }
        },
        ordering: {
          proposal_baseline_commit: "1".repeat(40)
        },
        security_sensitive: false
      };

      const assessment = generateAssessment(tempDir, source);
      assert.equal(assessment.schema_version, "1.1");
      assert.equal(assessment.security_sensitive, false);
      assert.ok(assessment.security_justification);

      // Check all 15 dimensions are populated with length >= 20
      for (const dim of SECURITY_DIMENSIONS) {
        const just = assessment.security_justification[dim];
        assert.ok(typeof just === "string", `missing justification for ${dim}`);
        assert.ok(just.length >= 20, `justification too short for ${dim}`);
        assert.equal(just, DEFAULT_SECURITY_JUSTIFICATIONS[dim]);
      }
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("allows custom overrides for security dimension justifications", () => {
    const tempDir = mkdtempSync(join(tmpdir(), "custom-sec-test-"));
    try {
      const customMsg = "Custom justification for trust boundary with over twenty characters.";
      const source = {
        decision: "direct_implementation",
        forces: ["Valid force description with sufficient characters."],
        candidate_approaches: [
          {
            id: "approach-direct-foo",
            kind: "direct_implementation",
            summary: "Direct implementation with sufficient character length.",
            forces_addressed: ["Valid force description with sufficient characters."]
          }
        ],
        selected_approach_id: "approach-direct-foo",
        rejected_alternative_ids: [],
        rejection_reasons: {},
        security_sensitive: false,
        security_justification: {
          trust_boundary: customMsg
        },
        ordering: {
          proposal_baseline_commit: "2".repeat(40)
        }
      };

      const assessment = generateAssessment(tempDir, source);
      assert.equal(assessment.security_justification.trust_boundary, customMsg);
      assert.equal(
        assessment.security_justification.audit_integrity,
        DEFAULT_SECURITY_JUSTIFICATIONS.audit_integrity
      );
    } finally {
      rmSync(tempDir, { recursive: true, force: true });
    }
  });

  it("generated assessment satisfies assessment.schema.json", () => {
    const repo = createRepository();
    try {
      const changeDir = repo.path("openspec/changes/establish-design-pattern-governance");
      const currentDoc = JSON.parse(readFileSync(join(changeDir, "assessment.json"), "utf8"));
      const source = {
        decision: currentDoc.decision,
        forces: currentDoc.forces,
        applicability: currentDoc.applicability,
        candidate_approaches: currentDoc.candidate_approaches,
        selected_approach_id: currentDoc.selected_approach_id,
        rejected_alternative_ids: currentDoc.rejected_alternative_ids,
        rejection_reasons: currentDoc.rejection_reasons,
        implementation_invariant_ids: currentDoc.implementation_invariant_ids,
        invariant_evidence: currentDoc.invariant_evidence,
        security_sensitive: currentDoc.security_sensitive,
        security_justification: currentDoc.security_justification,
        ordering: currentDoc.ordering,
        verification_task_ids: currentDoc.verification_task_ids
      };
      const gen = generateAssessment(changeDir, source, repo.root);
      repo.mutateJson("openspec/changes/establish-design-pattern-governance/assessment.json", () => gen);
      const res = runChecker(repo, { phase: "assessment" });
      assert.equal(res.status, 0, `Checker failed: ${res.stderr}\n${res.stdout}`);
    } finally {
      repo.dispose();
    }
  });

  it("detects drift when assessment.json diverges from assessment.source.json", () => {
    const repo = createRepository();
    try {
      const changeDir = repo.path("openspec/changes/establish-design-pattern-governance");
      const sourcePath = join(changeDir, "assessment.source.json");
      const currentDoc = JSON.parse(readFileSync(join(changeDir, "assessment.json"), "utf8"));

      // Seed assessment.source.json based on currentDoc
      const source = {
        decision: currentDoc.decision,
        forces: currentDoc.forces,
        applicability: currentDoc.applicability,
        candidate_approaches: currentDoc.candidate_approaches,
        selected_approach_id: currentDoc.selected_approach_id,
        rejected_alternative_ids: currentDoc.rejected_alternative_ids,
        rejection_reasons: currentDoc.rejection_reasons,
        implementation_invariant_ids: currentDoc.implementation_invariant_ids,
        invariant_evidence: currentDoc.invariant_evidence,
        security_sensitive: currentDoc.security_sensitive,
        security_justification: currentDoc.security_justification,
        ordering: currentDoc.ordering,
        verification_task_ids: currentDoc.verification_task_ids
      };
      writeFileSync(sourcePath, stableJson(source), "utf8");

      // Synchronize assessment.json to match generated output
      const gen = generateAssessment(changeDir, null, repo.root);
      writeFileSync(join(changeDir, "assessment.json"), stableJson(gen), "utf8");

      // With exact match, checker passes
      const resPass = runChecker(repo, { phase: "assessment" });
      assert.equal(resPass.status, 0);

      // Mutate assessment.json slightly (drift)
      const drifted = { ...gen, forces: [...gen.forces, "Uncommitted force with sufficient characters."] };
      writeFileSync(join(changeDir, "assessment.json"), stableJson(drifted), "utf8");

      const resFail = runChecker(repo, { phase: "assessment" });
      assert.notEqual(resFail.status, 0);
      assert.ok(
        resFail.stderr.includes("assessment-generated-drift") ||
        resFail.stdout.includes("assessment-generated-drift")
      );
    } finally {
      repo.dispose();
    }
  });

  it("rejects generation when the authored proposal baseline is omitted", () => {
    const repo = createRepository();
    try {
      const changeDir = repo.path("openspec/changes/establish-design-pattern-governance");
      const source = sourceFromAssessment(repo.readJson(ASSESSMENT));

      assert.throws(
        () => generateAssessment(changeDir, source, repo.root),
        /ordering\.proposal_baseline_commit as a 40-character Git commit ID/
      );
    } finally {
      repo.dispose();
    }
  });

  it("keeps generated assessments stable across a descendant merge", () => {
    const repo = createRepository();
    try {
      const change = "establish-design-pattern-governance";
      const changeDir = repo.path(`openspec/changes/${change}`);
      const source = sourceFromAssessment(repo.readJson(ASSESSMENT));
      const baseline = repo.head();
      source.ordering = { proposal_baseline_commit: baseline };

      repo.git(["update-ref", "refs/remotes/origin/main", baseline]);
      repo.branch("feature-assessment");
      repo.write(`openspec/changes/${change}/assessment.source.json`, stableJson(source));
      const generated = stableJson(generateAssessment(changeDir, null, repo.root));
      repo.write(ASSESSMENT, generated);
      repo.commit("docs: add generated assessment source");
      assertPasses(runChecker(repo, { phase: "assessment" }), "before descendant merge");

      repo.checkout("main");
      repo.write("README.md", "# Governance fixture\n\nMain-line change.\n");
      repo.commit("docs: create main-line descendant");
      repo.git(["merge", "--no-ff", "feature-assessment", "-m", "merge generated assessment"]);
      repo.git(["update-ref", "refs/remotes/origin/main", repo.head()]);

      assertPasses(runChecker(repo, { phase: "assessment" }), "after descendant merge");
      assert.equal(repo.read(ASSESSMENT), generated);
    } finally {
      repo.dispose();
    }
  });
});
