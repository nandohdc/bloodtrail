/**
 * R11-R12 — the perimeter is actor-neutral, behavioural, and fails closed on
 * anything it cannot classify.
 */

import assert from "node:assert/strict";
import { after, describe, it } from "node:test";

import {
  classifyPath,
  isGovernanceCore,
  touchesNormativePath,
} from "../../scripts/design-pattern-governance/perimeter.mjs";
import { createRepository } from "./support/disposable-repo.mjs";
import { POLICY_PATH, assertDiagnostic, assertPasses, runChecker } from "./support/harness.mjs";

const repositories = [];
function fixture() {
  const repository = createRepository();
  repositories.push(repository);
  return repository;
}
after(() => {
  for (const repository of repositories) repository.dispose();
});

const check = (repository, base) => runChecker(repository, { phase: "implementation", base });

describe("R11 unclassified paths fail closed", () => {
  it("rejects a path matching no declared classification", () => {
    const repository = fixture();
    const base = repository.head();
    repository.write("unclassified-territory/thing.mjs", "export const thing = 1;\n");
    repository.commit("feat: add an unclassified path");

    assertDiagnostic(check(repository, base), "path-unclassified");
  });

  it("accepts a path the policy classifies", () => {
    const repository = fixture();
    const base = repository.head();
    repository.write("packages/example/src/feature.mjs", "export const feature = 1;\n");
    repository.commit("feat: add a classified path");

    assertPasses(check(repository, base));
  });
});

describe("R11 behaviour overrides the declared classification", () => {
  it("rejects exported implementation arriving on a documentation-only path", () => {
    const repository = fixture();
    const base = repository.head();
    // docs/ is classified documentation_only. Shipping exported behaviour there
    // is the "documentation-only claim changes implementation" case.
    repository.write("docs/helper.mjs", "export function helper() { return 1; }\n");
    repository.mutateJson(POLICY_PATH, (policy) => {
      policy.path_classes.push({ class: "documentation_only", patterns: ["docs/helper.mjs"] });
      return policy;
    });
    repository.commit("docs: add a documentation file that is really code");

    assertDiagnostic(check(repository, base), "hidden-implementation");
  });

  it("does not flag exported behaviour on a path whose class expects it", () => {
    const repository = fixture();
    const base = repository.head();
    repository.write("packages/example/src/feature.mjs", "export function feature() { return 1; }\n");
    repository.commit("feat: exported behaviour where behaviour belongs");

    const result = check(repository, base);
    assert.ok(!result.ids.includes("hidden-implementation"),
      `governed implementation should not be reported as hidden, got [${result.ids.join(", ")}]`);
  });
});

describe("R11 the material commit range is inspected as a whole", () => {
  it("sees a path introduced in an intermediate commit and reverted at the tip", () => {
    const repository = fixture();
    const base = repository.head();

    repository.write("unclassified-territory/split.mjs", "export const split = 1;\n");
    repository.commit("chore: introduce mid-range");
    repository.remove("unclassified-territory/split.mjs");
    repository.commit("chore: remove before the tip");

    // A tip-only diff shows nothing. Range inspection is what makes splitting a
    // change across commits stop being a way to lower its classification.
    assertDiagnostic(check(repository, base), "path-unclassified");
  });
});

describe("R11 the perimeter is actor-neutral", () => {
  it("returns the identical verdict regardless of who authored the commit", () => {
    const verdicts = ["Human Contributor <human@example.invalid>", "Some Agent <agent@example.invalid>"].map((author) => {
      const repository = fixture();
      const base = repository.head();
      repository.write("unclassified-territory/thing.mjs", "export const thing = 1;\n");
      repository.git(["add", "-A"]);
      repository.git(["commit", "--author", author, "-m", "feat: same change, different author"]);
      const result = check(repository, base);
      return { ids: [...result.ids].sort(), status: result.status };
    });

    assert.deepEqual(verdicts[0], verdicts[1],
      "the same changed paths must produce the same verdict for every actor");
  });
});

describe("R11 the Hermes documentation exception is narrow", () => {
  it("classifies landing plans as documentation", () => {
    const repository = fixture();
    const base = repository.head();
    repository.write(".hermes/plans/example.md", "# Example landing plan\n");
    repository.commit("docs: add a landing plan");

    assertPasses(check(repository, base));
  });

  it("does not let configuration inherit the documentation exception", () => {
    const repository = fixture();
    const base = repository.head();
    repository.write(".hermes/config.yaml", "model: default\n");
    repository.commit("chore: add hermes configuration");

    assertDiagnostic(check(repository, base), "path-unclassified");
  });

  it("does not let scripts inherit the documentation exception", () => {
    const repository = fixture();
    const base = repository.head();
    repository.write(".hermes/scripts/check.mjs", "export function check() { return 1; }\n");
    repository.commit("chore: add a hermes script");

    assertDiagnostic(check(repository, base), "path-unclassified");
  });

  it("classifies generated agent instructions as non-authoritative governance core", () => {
    const repository = fixture();
    const policy = repository.readJson(POLICY_PATH);
    const surfaces = [
      { root: ".agents/skills/", path: ".agents/skills/openspec-apply-change/SKILL.md" },
      { root: ".claude/commands/opsx/", path: ".claude/commands/opsx/apply.md" },
      { root: ".claude/skills/", path: ".claude/skills/openspec-apply-change/SKILL.md" },
      { root: ".hermes/skills/", path: ".hermes/skills/openspec-apply-change/SKILL.md" },
    ];

    for (const { root, path } of surfaces) {
      assert.equal(classifyPath(path, policy), "governance_core", path);
      assert.equal(isGovernanceCore([path], policy), true, path);
      assert.equal(touchesNormativePath([path], policy), true, path);
      assert.ok(policy.non_authoritative_sources.includes(root),
        `${root} must remain a non-authoritative source`);
    }
  });

  it("does not accept an executable hook as documentation", () => {
    const repository = fixture();
    const base = repository.head();
    repository.write(".hermes/hooks/preflight.sh", "#!/bin/sh\necho \"preflight checks\"\n");
    repository.commit("chore: add a hermes hook");

    assertDiagnostic(check(repository, base), "path-unclassified");
  });
});
