import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  checkChangelog,
  cleanChangelog,
  cleanSection,
  createGitResolver,
  identifyDuplicateEntries,
  parseSectionEntries,
  splitChangelogSections
} from "./clean-release-changelog.mjs";

test("cleanSection drops duplicate merge commits and retains branch commits", () => {
  const sectionText = `## [1.0.0] (2026-09-12)

### Features

* **core:** add primary feature ([#10](https://github.com/nandohdc/bloodtrail/issues/10)) ([a111111](https://github.com/nandohdc/bloodtrail/commit/a111111111111111111111111111111111111111))
* **core:** add primary feature ([#10](https://github.com/nandohdc/bloodtrail/issues/10)) ([b111111](https://github.com/nandohdc/bloodtrail/commit/b111111111111111111111111111111111111111))
`;

  const mockResolver = (sha) => {
    if (sha.startsWith("a111111")) {
      return {
        sha,
        parents: ["p1", "p2"],
        subject: "Merge pull request #10 from feat/feature",
        isMerge: true,
        mergedCommits: ["b111111111111111111111111111111111111111"]
      };
    }
    return {
      sha,
      parents: ["p1"],
      subject: "feat(core): add primary feature (#10)",
      isMerge: false,
      mergedCommits: []
    };
  };

  const { cleanedText, droppedEntries } = cleanSection(sectionText, mockResolver);

  assert.equal(droppedEntries.length, 1);
  assert.equal(droppedEntries[0].shortSha, "a111111");
  assert.ok(cleanedText.includes("b111111"));
  assert.ok(!cleanedText.includes("a111111"));
});

test("cleanSection preserves intermediate commits in multi-commit PRs", () => {
  const sectionText = `## [1.0.0] (2026-09-12)

### Features

* **core:** add primary feature ([#10](https://github.com/nandohdc/bloodtrail/issues/10)) ([a111111](https://github.com/nandohdc/bloodtrail/commit/a111111111111111111111111111111111111111))
* **core:** add primary feature ([#10](https://github.com/nandohdc/bloodtrail/issues/10)) ([b111111](https://github.com/nandohdc/bloodtrail/commit/b111111111111111111111111111111111111111))

### Bug Fixes

* **core:** fix edge case in parser ([#10](https://github.com/nandohdc/bloodtrail/issues/10)) ([b222222](https://github.com/nandohdc/bloodtrail/commit/b222222222222222222222222222222222222222))
* **core:** eliminate unused helper ([#10](https://github.com/nandohdc/bloodtrail/issues/10)) ([b333333](https://github.com/nandohdc/bloodtrail/commit/b33333333333333333333333333333333333333))
`;

  const mockResolver = (sha) => {
    if (sha.startsWith("a111111")) {
      return {
        sha,
        parents: ["p1", "p2"],
        subject: "Merge pull request #10 from feat/feature",
        isMerge: true,
        mergedCommits: [
          "b111111111111111111111111111111111111111",
          "b222222222222222222222222222222222222222",
          "b33333333333333333333333333333333333333"
        ]
      };
    }
    return {
      sha,
      parents: ["p0"],
      subject: "branch commit",
      isMerge: false,
      mergedCommits: []
    };
  };

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

* **docs:** update readme instructions ([#5](https://github.com/nandohdc/bloodtrail/issues/5)) ([b111111](https://github.com/nandohdc/bloodtrail/commit/b111111111111111111111111111111111111111))
* **docs:** update readme instructions ([#5](https://github.com/nandohdc/bloodtrail/issues/5)) ([b222222](https://github.com/nandohdc/bloodtrail/commit/b222222222222222222222222222222222222222))
`;

  const mockResolver = (sha) => ({
    sha,
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

* **collector:** add fail-closed client-evidence envelope stage ([#126](https://github.com/nandohdc/bloodtrail/issues/126)) ([c499499](https://github.com/nandohdc/bloodtrail/commit/c49949999999999999999999999999999999999))
* **collector:** add the fail-closed client-evidence envelope stage ([#126](https://github.com/nandohdc/bloodtrail/issues/126)) ([b111111](https://github.com/nandohdc/bloodtrail/commit/b111111111111111111111111111111111111111))
`;

  const mockResolver = (sha) => {
    if (sha.startsWith("c499499")) {
      return {
        sha,
        parents: ["p1", "p2"],
        subject: "Merge pull request #499 from feat/client-evidence-ingress",
        isMerge: true,
        mergedCommits: ["b111111111111111111111111111111111111111"]
      };
    }
    return {
      sha,
      parents: ["p0"],
      subject: "feat(collector): add the fail-closed client-evidence envelope stage (#126)",
      isMerge: false,
      mergedCommits: []
    };
  };

  const { cleanedText, droppedEntries } = cleanSection(sectionText, mockResolver);

  assert.equal(droppedEntries.length, 1);
  assert.equal(droppedEntries[0].shortSha, "c499499");
  assert.ok(cleanedText.includes("b111111"));
  assert.ok(!cleanedText.includes("c499499"));
});

test("cleanSection retains merge commits when no merged commits are in the section", () => {
  const sectionText = `## [1.0.0] (2026-09-12)

### Features

* **core:** squash-merged feature ([#20](https://github.com/nandohdc/bloodtrail/issues/20)) ([c202020](https://github.com/nandohdc/bloodtrail/commit/c202020202020202020202020202020202020202))
`;

  const mockResolver = (sha) => ({
    sha,
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

* **core:** feat A ([a111111](https://github.com/nandohdc/bloodtrail/commit/a111111111111111111111111111111111111111))
* **core:** feat A ([b111111](https://github.com/nandohdc/bloodtrail/commit/b111111111111111111111111111111111111111))

## [1.0.0] (2026-09-01)

* **core:** feat B ([a222222](https://github.com/nandohdc/bloodtrail/commit/a222222222222222222222222222222222222222))
* **core:** feat B ([b222222](https://github.com/nandohdc/bloodtrail/commit/b222222222222222222222222222222222222222))
`;

  const mockResolver = (sha) => {
    const isMerge = sha.startsWith("a");
    return {
      sha,
      parents: isMerge ? ["p1", "p2"] : ["p1"],
      subject: isMerge ? "Merge pull request #..." : "feat",
      isMerge,
      mergedCommits: []
    };
  };

  const { cleanedContent, droppedEntries } = cleanChangelog(content, {
    resolveCommit: mockResolver,
    targetSection: "2.0.0"
  });

  assert.equal(droppedEntries.length, 1);
  assert.equal(droppedEntries[0].shortSha, "a111111");
  assert.ok(!cleanedContent.includes("a111111"));
  assert.ok(cleanedContent.includes("a222222")); // 1.0.0 untouched
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
  assert.ok(!realContent.includes("bbe79f7")); // merge commit dropped
  assert.ok(realContent.includes("cbd45d4"));  // branch commit retained
  assert.ok(!realContent.includes("a4b22dc")); // merge commit dropped
  assert.ok(realContent.includes("b1caaa1"));  // branch commit retained
});

test("checkChangelog returns clean: false and dropped entries when duplicates exist", () => {
  const content = `## [1.0.0] (2026-09-12)

* **feat:** duplicate entry ([a111111](https://github.com/nandohdc/bloodtrail/commit/a111111111111111111111111111111111111111))
* **feat:** duplicate entry ([b111111](https://github.com/nandohdc/bloodtrail/commit/b111111111111111111111111111111111111111))
`;

  const mockResolver = (sha) => {
    const isMerge = sha.startsWith("a");
    return {
      sha,
      parents: isMerge ? ["p1", "p2"] : ["p1"],
      subject: isMerge ? "Merge pull request #..." : "feat",
      isMerge,
      mergedCommits: isMerge ? ["b111111111111111111111111111111111111111"] : []
    };
  };

  const result = checkChangelog(content, { resolveCommit: mockResolver });
  assert.equal(result.clean, false);
  assert.equal(result.droppedEntries.length, 1);
  assert.equal(result.droppedEntries[0].shortSha, "a111111");
});

test("checkChangelog returns clean: true when no duplicates exist", () => {
  const content = `## [1.0.0] (2026-09-12)

* **feat:** clean entry ([b111111](https://github.com/nandohdc/bloodtrail/commit/b111111111111111111111111111111111111111))
`;

  const mockResolver = (sha) => ({
    sha,
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

* **core:** feature ([a111111](https://github.com/nandohdc/bloodtrail/commit/a111111111111111111111111111111111111111))
* **core:** feature ([b111111](https://github.com/nandohdc/bloodtrail/commit/b111111111111111111111111111111111111111))
`;

  const mockResolver = (sha) => {
    const isMerge = sha.startsWith("a");
    return {
      sha,
      parents: isMerge ? ["p1", "p2"] : ["p1"],
      subject: isMerge ? "Merge pull request #..." : "feat",
      isMerge,
      mergedCommits: ["b111111111111111111111111111111111111111"]
    };
  };

  const { cleanedText, droppedEntries } = cleanSection(sectionText, mockResolver);
  assert.equal(droppedEntries.length, 1);
  assert.ok(cleanedText.includes("### ⚠ BREAKING CHANGES"));
  assert.ok(cleanedText.includes("* **core:** breaking change description without commit link"));
});

test("cleanChangelog cleans standalone release notes snippet without version header", () => {
  const snippet = `### Features

* **core:** feature ([a111111](https://github.com/nandohdc/bloodtrail/commit/a111111111111111111111111111111111111111))
* **core:** feature ([b111111](https://github.com/nandohdc/bloodtrail/commit/b111111111111111111111111111111111111111))
`;

  const mockResolver = (sha) => {
    const isMerge = sha.startsWith("a");
    return {
      sha,
      parents: isMerge ? ["p1", "p2"] : ["p1"],
      subject: isMerge ? "Merge pull request #..." : "feat",
      isMerge,
      mergedCommits: ["b111111111111111111111111111111111111111"]
    };
  };

  const { cleanedContent, droppedEntries } = cleanChangelog(snippet, { resolveCommit: mockResolver });
  assert.equal(droppedEntries.length, 1);
  assert.ok(cleanedContent.includes("b111111"));
  assert.ok(!cleanedContent.includes("a111111"));
});
