import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  checkChangelog,
  cleanChangelog,
  cleanSection,
  createGitResolver
} from "./clean-release-changelog.mjs";

function makeEntry(scope, desc, shortSha, issue = null) {
  const fullSha = shortSha.padEnd(40, shortSha.slice(-1));
  const issuePart = issue ? ` ([#${issue}](https://github.com/nandohdc/bloodtrail/issues/${issue}))` : "";
  return `* **${scope}:** ${desc}${issuePart} ([${shortSha}](https://github.com/nandohdc/bloodtrail/commit/${fullSha}))`;
}

function createMockResolver(overrides = {}) {
  return (sha) => {
    for (const [prefix, val] of Object.entries(overrides)) {
      if (sha === prefix || sha.startsWith(prefix)) {
        return typeof val === "function" ? val(sha) : val;
      }
    }
    const isMerge = sha.startsWith("a");
    return {
      sha,
      parents: isMerge ? ["p1", "p2"] : ["p0"],
      subject: isMerge ? "Merge pull request #10 from feat/branch" : "branch commit",
      isMerge,
      mergedCommits: isMerge ? ["b111111111111111111111111111111111111111"] : []
    };
  };
}

test("cleanSection drops duplicate merge commits and retains branch commits", () => {
  const sectionText = `## [1.0.0] (2026-09-12)

### Features

${makeEntry("core", "add primary feature", "a111111", 10)}
${makeEntry("core", "add primary feature", "b111111", 10)}
`;

  const mockResolver = createMockResolver({
    b111111: {
      sha: "b111111",
      parents: ["p1"],
      subject: "feat(core): add primary feature (#10)",
      isMerge: false,
      mergedCommits: []
    }
  });

  const { cleanedText, droppedEntries } = cleanSection(sectionText, mockResolver);

  assert.equal(droppedEntries.length, 1);
  assert.equal(droppedEntries[0].shortSha, "a111111");
  assert.ok(cleanedText.includes("b111111"));
  assert.ok(!cleanedText.includes("a111111"));
});

test("cleanSection preserves intermediate commits in multi-commit PRs", () => {
  const sectionText = `## [1.0.0] (2026-09-12)

### Features

${makeEntry("core", "add primary feature", "a111111", 10)}
${makeEntry("core", "add primary feature", "b111111", 10)}

### Bug Fixes

${makeEntry("core", "fix edge case in parser", "b222222", 10)}
${makeEntry("core", "eliminate unused helper", "b333333", 10)}
`;

  const mockResolver = createMockResolver({
    a111111: {
      sha: "a111111",
      parents: ["p1", "p2"],
      subject: "Merge pull request #10 from feat/feature",
      isMerge: true,
      mergedCommits: [
        "b111111111111111111111111111111111111111",
        "b222222222222222222222222222222222222222",
        "b33333333333333333333333333333333333333"
      ]
    }
  });

  const { cleanedText, droppedEntries } = cleanSection(sectionText, mockResolver);

  assert.equal(droppedEntries.length, 1);
  assert.equal(droppedEntries[0].shortSha, "a111111");
  assert.ok(cleanedText.includes("b111111"));
  assert.ok(cleanedText.includes("b222222"));
  assert.ok(cleanedText.includes("b333333"));
  assert.ok(!cleanedText.includes("a111111"));
});

test("cleanSection preserves distinct non-merge commits with identical subjects", () => {
  const sectionText = `## [1.0.0] (2026-09-12)

### Bug Fixes

${makeEntry("docs", "update readme instructions", "b111111", 5)}
${makeEntry("docs", "update readme instructions", "b222222", 5)}
`;

  const mockResolver = () => ({
    sha: "b",
    parents: ["p0"],
    subject: "docs: update readme instructions",
    isMerge: false,
    mergedCommits: []
  });

  const { cleanedText, droppedEntries } = cleanSection(sectionText, mockResolver);

  assert.equal(droppedEntries.length, 0);
  assert.ok(cleanedText.includes("b111111"));
  assert.ok(cleanedText.includes("b222222"));
});

test("cleanSection drops merge commits whose merged commits are already in section even if subjects differ slightly", () => {
  const sectionText = `## [1.0.0] (2026-09-12)

### Features

${makeEntry("collector", "add fail-closed client-evidence envelope stage", "c499499", 126)}
${makeEntry("collector", "add the fail-closed client-evidence envelope stage", "b111111", 126)}
`;

  const mockResolver = createMockResolver({
    c499499: {
      sha: "c499499",
      parents: ["p1", "p2"],
      subject: "Merge pull request #499 from feat/client-evidence-ingress",
      isMerge: true,
      mergedCommits: ["b111111111111111111111111111111111111111"]
    },
    b111111: {
      sha: "b111111",
      parents: ["p0"],
      subject: "feat(collector): add the fail-closed client-evidence envelope stage (#126)",
      isMerge: false,
      mergedCommits: []
    }
  });

  const { cleanedText, droppedEntries } = cleanSection(sectionText, mockResolver);

  assert.equal(droppedEntries.length, 1);
  assert.equal(droppedEntries[0].shortSha, "c499499");
  assert.ok(cleanedText.includes("b111111"));
  assert.ok(!cleanedText.includes("c499499"));
});

test("cleanSection retains merge commits when no merged commits are in the section", () => {
  const sectionText = `## [1.0.0] (2026-09-12)

### Features

${makeEntry("core", "squash-merged feature", "c202020", 20)}
`;

  const mockResolver = () => ({
    sha: "c202020",
    parents: ["p1", "p2"],
    subject: "Merge pull request #20 from feat/squashed",
    isMerge: true,
    mergedCommits: ["c99999999999999999999999999999999999999"]
  });

  const { cleanedText, droppedEntries } = cleanSection(sectionText, mockResolver);

  assert.equal(droppedEntries.length, 0);
  assert.ok(cleanedText.includes("c202020"));
});

test("cleanChangelog cleans only target section when specified", () => {
  const content = `# Changelog

## [2.0.0] (2026-09-12)

${makeEntry("core", "feat A", "a111111")}
${makeEntry("core", "feat A", "b111111")}

## [1.0.0] (2026-09-01)

${makeEntry("core", "feat B", "a222222")}
${makeEntry("core", "feat B", "b222222")}
`;

  const mockResolver = createMockResolver({
    a111111: {
      sha: "a111111",
      parents: ["p1", "p2"],
      subject: "Merge pull request #...",
      isMerge: true,
      mergedCommits: []
    },
    a222222: {
      sha: "a222222",
      parents: ["p1", "p2"],
      subject: "Merge pull request #...",
      isMerge: true,
      mergedCommits: []
    }
  });

  const { cleanedContent, droppedEntries } = cleanChangelog(content, {
    resolveCommit: mockResolver,
    targetSection: "2.0.0"
  });

  assert.equal(droppedEntries.length, 1);
  assert.equal(droppedEntries[0].shortSha, "a111111");
  assert.ok(!cleanedContent.includes("a111111"));
  assert.ok(cleanedContent.includes("a222222"));
});

test("cleanChangelog on actual CHANGELOG.md 0.18.0 asserts clean status", () => {
  const realContent = readFileSync("CHANGELOG.md", "utf8");
  const resolver = createGitResolver();

  const { clean, droppedEntries } = checkChangelog(realContent, {
    resolveCommit: resolver,
    targetSection: "0.18.0"
  });

  assert.equal(clean, true);
  assert.equal(droppedEntries.length, 0);
  assert.ok(!realContent.includes("bbe79f7"));
  assert.ok(realContent.includes("cbd45d4"));
  assert.ok(!realContent.includes("a4b22dc"));
  assert.ok(realContent.includes("b1caaa1"));
});

test("checkChangelog returns clean: false and dropped entries when duplicates exist", () => {
  const content = `## [1.0.0] (2026-09-12)

${makeEntry("feat", "duplicate entry", "a111111")}
${makeEntry("feat", "duplicate entry", "b111111")}
`;

  const mockResolver = createMockResolver();
  const result = checkChangelog(content, { resolveCommit: mockResolver });
  assert.equal(result.clean, false);
  assert.equal(result.droppedEntries.length, 1);
  assert.equal(result.droppedEntries[0].shortSha, "a111111");
});

test("checkChangelog returns clean: true when no duplicates exist", () => {
  const content = `## [1.0.0] (2026-09-12)

${makeEntry("feat", "clean entry", "b111111")}
`;

  const mockResolver = () => ({
    sha: "b111111",
    parents: ["p1"],
    subject: "feat",
    isMerge: false,
    mergedCommits: []
  });

  const result = checkChangelog(content, { resolveCommit: mockResolver });
  assert.equal(result.clean, true);
  assert.equal(result.droppedEntries.length, 0);
});

test("cleanSection preserves breaking changes without commit links", () => {
  const sectionText = `## [1.0.0] (2026-09-12)

### ⚠ BREAKING CHANGES

* **core:** breaking change description without commit link

### Features

${makeEntry("core", "feature", "a111111")}
${makeEntry("core", "feature", "b111111")}
`;

  const mockResolver = createMockResolver();
  const { cleanedText, droppedEntries } = cleanSection(sectionText, mockResolver);
  assert.equal(droppedEntries.length, 1);
  assert.ok(cleanedText.includes("### ⚠ BREAKING CHANGES"));
  assert.ok(cleanedText.includes("* **core:** breaking change description without commit link"));
});

test("cleanChangelog cleans standalone release notes snippet without version header", () => {
  const snippet = `### Features

${makeEntry("core", "feature", "a111111")}
${makeEntry("core", "feature", "b111111")}
`;

  const mockResolver = createMockResolver();
  const { cleanedContent, droppedEntries } = cleanChangelog(snippet, { resolveCommit: mockResolver });
  assert.equal(droppedEntries.length, 1);
  assert.ok(cleanedContent.includes("b111111"));
  assert.ok(!cleanedContent.includes("a111111"));
});
