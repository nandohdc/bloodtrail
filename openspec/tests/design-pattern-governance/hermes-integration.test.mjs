/**
 * R22 — Hermes integration is executable but non-authoritative.
 *
 * The requirement forbids *assuming* that `Bash(openspec:*)` permits the Node
 * checker. These tests establish what the generated frontmatter actually is and
 * what it actually means, and fail if regeneration changes either.
 *
 * What inspection found (see hermes-allowed-tools-finding.md):
 * `allowed-tools` pre-approves, it does not restrict. The generator's own source
 * says so. So the checker is runnable under Hermes today — it simply is not
 * pre-approved and will prompt. There is no repository-supported way to widen
 * the value: it is a hardcoded constant in the CLI package with no config key,
 * and the generated skill directories must not be hand-edited.
 */

import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const GENERATED_SKILL_DIRECTORIES = [".hermes/skills", ".claude/skills", ".agents/skills"];
const EXPECTED_ALLOWED_TOOLS = "Bash(openspec:*)";
const CHECKER_COMMAND = "node openspec/scripts/check-design-pattern-governance.mjs";

function generatedSkills() {
  const skills = [];
  for (const directory of GENERATED_SKILL_DIRECTORIES) {
    let entries;
    try {
      entries = readdirSync(resolve(repositoryRoot, directory), { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries.filter((candidate) => candidate.isDirectory())) {
      const path = `${directory}/${entry.name}/SKILL.md`;
      try {
        skills.push({ path, text: readFileSync(resolve(repositoryRoot, path), "utf8") });
      } catch {
        continue;
      }
    }
  }
  return skills;
}

describe("R22 generated Hermes frontmatter is inspected, not assumed", () => {
  it("finds generated skills to inspect, so the suite cannot pass vacuously", () => {
    assert.ok(generatedSkills().length > 0,
      "no generated SKILL.md files were found; this suite would otherwise pass by checking nothing");
  });

  it("records the exact allowed-tools value every generated skill carries", () => {
    for (const skill of generatedSkills()) {
      const match = /^allowed-tools:\s*(.+)$/m.exec(skill.text);
      assert.ok(match, `${skill.path} carries no allowed-tools field`);
      assert.equal(match[1].trim(), EXPECTED_ALLOWED_TOOLS,
        `${skill.path} declares an allowed-tools value this repository has not evaluated`);
    }
  });

  it("fails if regeneration drops the allowed-tools field", () => {
    // The drift guard. `openspec update` rewrites these files wholesale, so a
    // change in the CLI can remove the field without anyone editing this repo.
    for (const skill of generatedSkills()) {
      assert.match(skill.text, /^allowed-tools:/m,
        `${skill.path} lost its allowed-tools field; regeneration changed the generated contract`);
    }
  });
});

describe("R22 the checker command is documented where an actor will find it", () => {
  it("names the exact checker command in the actor-neutral policy document", () => {
    const policy = readFileSync(resolve(repositoryRoot, "docs/design-pattern-governance.md"), "utf8");
    assert.ok(policy.includes(CHECKER_COMMAND),
      "the actor-neutral policy document must state the exact checker command");
  });

  it("names the checker command in CONTRIBUTING.md", () => {
    const contributing = readFileSync(resolve(repositoryRoot, "CONTRIBUTING.md"), "utf8");
    assert.ok(contributing.includes(CHECKER_COMMAND),
      "CONTRIBUTING.md must state the exact checker command");
  });

  it("states that Hermes is convenience-only and does not replace required CI", () => {
    const policy = readFileSync(resolve(repositoryRoot, "docs/design-pattern-governance.md"), "utf8");
    assert.match(policy, /convenience/i, "the policy must state that agent checks are convenience only");
    assert.match(policy, /not\s+(?:a\s+)?substitute\s+for\s+the\s+required\s+CI\s+check/is,
      "the policy must state that an agent check does not substitute for required CI");
  });
});

describe("R22 canonical CI governs regardless of the agent", () => {
  it("keeps the governance job in CI, which is what actually enforces the perimeter", () => {
    const workflow = readFileSync(resolve(repositoryRoot, ".github/workflows/ci.yml"), "utf8");
    assert.match(workflow, /^ {2}design-pattern-governance:$/m,
      "the governance CI job is the authoritative enforcement point and must exist");
    assert.ok(workflow.includes("check-design-pattern-governance.mjs"),
      "the governance CI job must run the checker");
  });

  it("does not make any generated skill directory a policy source", () => {
    const policy = JSON.parse(readFileSync(resolve(repositoryRoot, "openspec/governance/design-pattern-policy.json"), "utf8"));
    for (const directory of GENERATED_SKILL_DIRECTORIES) {
      assert.ok(policy.non_authoritative_sources.includes(`${directory}/`),
        `${directory}/ must be recorded as a non-authoritative source`);
      assert.ok(!policy.actor_neutral_documents.some((document) => document.startsWith(directory)),
        `${directory} must not be an actor-neutral policy document`);
    }
  });
});
