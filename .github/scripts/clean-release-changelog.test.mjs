import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, realpathSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  checkChangelog,
  checkReleaseRange,
  cleanChangelog,
  cleanPullRequestBody,
  cleanSection,
  createGitResolver,
  parseSectionEntries
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

test("parseSectionEntries recognises single and multiple issue-reference suffixes", () => {
  const lines = [
    "* **sdk-node:** add the HTTP sink ([#589](https://github.com/issues/589)) ([29f19c8](https://github.com/commit/29f19c8)), closes [#575](https://github.com/issues/575)",
    "* **sdk-node:** handle retries ([310e22d](https://github.com/commit/310e22d)), closes [#10](https://github.com/issues/10), [#20](https://github.com/issues/20)",
    "* **sdk-core:** basic entry without suffix ([a872088](https://github.com/commit/a872088))"
  ];

  const entries = parseSectionEntries(lines);
  assert.equal(entries.length, 3);
  assert.equal(entries[0].subject, "**sdk-node:** add the HTTP sink ([#589](https://github.com/issues/589))");
  assert.equal(entries[0].suffix, ", closes [#575](https://github.com/issues/575)");
  assert.equal(entries[1].subject, "**sdk-node:** handle retries");
  assert.equal(entries[1].suffix, ", closes [#10](https://github.com/issues/10), [#20](https://github.com/issues/20)");
  assert.equal(entries[2].subject, "**sdk-core:** basic entry without suffix");
  assert.equal(entries[2].suffix, "");
});

test("cleanSection de-duplicates merge commit against branch commit with issue-reference suffix", () => {
  const branchEntry = "* **sdk-node:** add the HTTP sink ([#589](https://github.com/issues/589)) ([29f19c8](https://github.com/commit/29f19c8)), closes [#575](https://github.com/issues/575)";
  const mergeEntry = "* **sdk-node:** add the HTTP sink ([#589](https://github.com/issues/589)) ([935d62e](https://github.com/commit/935d62e))";
  const sectionText = `## [0.21.0] (2026-09-28)

### Features

${mergeEntry}
${branchEntry}
`;

  const mockResolver = createMockResolver({
    "935d62e": {
      sha: "935d62e",
      parents: ["p1", "p2"],
      subject: "Merge pull request #589 from feat/http-sink",
      isMerge: true,
      mergedCommits: ["29f19c8"]
    },
    "29f19c8": {
      sha: "29f19c8",
      parents: ["p0"],
      subject: "feat(sdk-node): add the HTTP sink (#589)",
      isMerge: false,
      mergedCommits: []
    }
  });

  const { cleanedText, droppedEntries } = cleanSection(sectionText, mockResolver);
  assert.equal(droppedEntries.length, 1);
  assert.equal(droppedEntries[0].shortSha, "935d62e");
  assert.ok(cleanedText.includes(branchEntry.replace(", closes ", ", refs ")), "Retains branch entry with link intact and non-closing reference");
  assert.ok(!cleanedText.includes("935d62e"), "Drops merge commit entry");
});

test("parseSectionEntries throws and names entry when bullet links commit but has unrecognised format", () => {
  const malformedBullet = "* **core:** unexpected format ([a111111](https://github.com/commit/a111111)) extra invalid text";
  assert.throws(
    () => parseSectionEntries([malformedBullet]),
    (err) => err.message.includes('Unrecognised entry: "* **core:** unexpected format')
  );

  const brokenClosesBullet = "* **core:** broken closes ([a111111](https://github.com/commit/a111111)), closes not-a-link";
  assert.throws(
    () => parseSectionEntries([brokenClosesBullet]),
    (err) => err.message.includes('Unrecognised entry: "* **core:** broken closes')
  );
});

test("createGitResolver throws when git command fails and cleanSection fails closed", () => {
  const failingExecGit = () => {
    throw new Error("fatal: ambiguous argument 'deadbeef': unknown revision");
  };

  const resolver = createGitResolver({ execGit: failingExecGit });
  assert.throws(
    () => resolver("deadbeef"),
    (err) => err.message.includes("Failed to resolve commit deadbeef")
  );

  const sectionText = `## [1.0.0] (2026-09-12)

* **core:** unresolvable entry ([deadbeef](https://github.com/commit/deadbeef))
`;

  assert.throws(
    () => cleanSection(sectionText, resolver),
    (err) => err.message.includes("Unresolvable commit in entry") && err.message.includes("deadbeef")
  );
});

test("cleanPullRequestBody successfully updates and verifies PR body via REST fetch", async () => {
  const initialBody = `### Features

* **core:** feature ([a111111](https://github.com/commit/a111111))
* **core:** feature ([b111111](https://github.com/commit/b111111))
`;

  let patchCalled = false;
  let patchPayload = null;

  const mockFetch = async (url, opts) => {
    assert.ok(url.includes("/repos/nandohdc/bloodtrail/pulls/537"));
    assert.equal(opts.headers.Authorization, "Bearer secret-token");
    assert.equal(opts.headers["X-GitHub-Api-Version"], "2022-11-28");

    if (opts.method === "GET") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ body: initialBody })
      };
    }
    if (opts.method === "PATCH") {
      patchCalled = true;
      patchPayload = JSON.parse(opts.body);
      return {
        ok: true,
        status: 200,
        json: async () => ({ body: patchPayload.body })
      };
    }
    throw new Error(`Unexpected method ${opts.method}`);
  };

  const mockResolver = createMockResolver();
  await cleanPullRequestBody(537, mockResolver, {
    fetch: mockFetch,
    env: {
      GH_TOKEN: "secret-token",
      GITHUB_REPOSITORY: "nandohdc/bloodtrail"
    }
  });

  assert.ok(patchCalled, "PATCH was called");
  assert.ok(patchPayload.body.includes("b111111"));
  assert.ok(!patchPayload.body.includes("a111111"));
});

test("cleanPullRequestBody is a no-op when body is already clean", async () => {
  const cleanBody = `### Features

* **core:** feature ([b111111](https://github.com/commit/b111111))
`;

  let patchCalled = false;
  const mockFetch = async (url, opts) => {
    if (opts.method === "GET") {
      return {
        ok: true,
        status: 200,
        json: async () => ({ body: cleanBody })
      };
    }
    if (opts.method === "PATCH") {
      patchCalled = true;
    }
    return { ok: true, status: 200 };
  };

  const mockResolver = createMockResolver();
  await cleanPullRequestBody(537, mockResolver, {
    fetch: mockFetch,
    env: {
      GH_TOKEN: "token",
      GITHUB_REPOSITORY: "owner/repo"
    }
  });

  assert.equal(patchCalled, false, "PATCH should not be called when body is already clean");
});

test("cleanPullRequestBody fails closed on missing env, non-2xx response, network error, or verification mismatch", async () => {
  const mockResolver = createMockResolver();

  // Missing token
  await assert.rejects(
    () => cleanPullRequestBody(537, mockResolver, { env: { GITHUB_REPOSITORY: "owner/repo" } }),
    (err) => err.message.includes("Missing GH_TOKEN")
  );

  // Missing repository
  await assert.rejects(
    () => cleanPullRequestBody(537, mockResolver, { env: { GH_TOKEN: "token" } }),
    (err) => err.message.includes("Missing GITHUB_REPOSITORY")
  );

  // Non-2xx GET
  await assert.rejects(
    () => cleanPullRequestBody(537, mockResolver, {
      fetch: async () => ({ ok: false, status: 404 }),
      env: { GH_TOKEN: "token", GITHUB_REPOSITORY: "owner/repo" }
    }),
    (err) => err.message.includes("failed with status 404")
  );

  // Verification mismatch
  await assert.rejects(
    () => cleanPullRequestBody(537, mockResolver, {
      fetch: async (url, opts) => {
        if (opts.method === "GET") {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              body: `* **core:** feat ([a111111](https://commit/a111111))\n* **core:** feat ([b111111](https://commit/b111111))`
            })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ body: "completely different body" })
        };
      },
      env: { GH_TOKEN: "token", GITHUB_REPOSITORY: "owner/repo" }
    }),
    (err) => err.message.includes("Verification mismatch")
  );
});

test("checkReleaseRange skips check when base version equals current version", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "bloodtrail-release-skip-"));
  try {
    writeFileSync(join(tempDir, "version.txt"), "0.20.0\n", "utf8");
    const mockExecGit = (args) => {
      if (args[0] === "show" && args[1] === "origin/main:version.txt") {
        return "0.20.0\n";
      }
      throw new Error(`Unexpected git invocation: ${args.join(" ")}`);
    };

    const res = checkReleaseRange(
      { releaseBase: "origin/main" },
      {
        execGit: mockExecGit,
        rootDir: tempDir
      }
    );

    assert.equal(res.skipped, true);
    assert.equal(res.version, "0.20.0");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

test("checkReleaseRange detects bumped version and validates changelog section and event description", () => {
  const tempDir = mkdtempSync(join(tmpdir(), "bloodtrail-release-check-"));
  try {
    writeFileSync(join(tempDir, "version.txt"), "0.21.0\n", "utf8");

    const mockExecGit = (args) => {
      if (args[0] === "show" && args[1].endsWith(":version.txt")) {
        return "0.20.0\n"; // different from current version
      }
      return "";
    };

    // 1. Missing target section in changelog
    writeFileSync(join(tempDir, "CHANGELOG.md"), "## [0.20.0] (2026-09-01)\n\n* **core:** old\n", "utf8");
    assert.throws(
      () => checkReleaseRange(
        { releaseBase: "origin/main", filePath: "CHANGELOG.md" },
        { execGit: mockExecGit, rootDir: tempDir }
      ),
      (err) => err.message.includes("Release section [0.21.0] is missing")
    );

    // 2. Target section has duplicate merge commit
    const duplicateChangelog = `## [0.21.0] (2026-09-28)

### Features

${makeEntry("core", "feature", "a111111")}
${makeEntry("core", "feature", "b111111")}
`;
    writeFileSync(join(tempDir, "CHANGELOG.md"), duplicateChangelog, "utf8");
    const mockResolver = createMockResolver();
    assert.throws(
      () => checkReleaseRange(
        { releaseBase: "origin/main", filePath: "CHANGELOG.md" },
        { execGit: mockExecGit, rootDir: tempDir, resolveCommit: mockResolver }
      ),
      (err) => err.message.includes("Found 1 duplicate entry(ies) in changelog section [0.21.0]")
    );

    // 3. Clean section, but missing GITHUB_EVENT_PATH when --event-description is requested
    const cleanChangelog = `## [0.21.0] (2026-09-28)

### Features

${makeEntry("core", "feature", "b111111")}
`;
    writeFileSync(join(tempDir, "CHANGELOG.md"), cleanChangelog, "utf8");
    assert.throws(
      () => checkReleaseRange(
        { releaseBase: "origin/main", filePath: "CHANGELOG.md", eventDescription: true },
        { execGit: mockExecGit, rootDir: tempDir, resolveCommit: mockResolver, env: {} }
      ),
      (err) => err.message.includes("Missing GITHUB_EVENT_PATH")
    );

    // 4. Duplicate entries in PR description from event file
    const eventFile = join(tempDir, "event.json");
    writeFileSync(eventFile, JSON.stringify({
      pull_request: {
        body: `### Features\n\n${makeEntry("core", "feature", "a111111")}\n${makeEntry("core", "feature", "b111111")}\n`
      }
    }), "utf8");

    assert.throws(
      () => checkReleaseRange(
        { releaseBase: "origin/main", filePath: "CHANGELOG.md", eventDescription: true },
        { execGit: mockExecGit, rootDir: tempDir, resolveCommit: mockResolver, env: { GITHUB_EVENT_PATH: eventFile } }
      ),
      (err) => err.message.includes("Found 1 duplicate entry(ies) in pull request description")
    );

    // 5. Clean changelog section and clean PR description: check passes
    writeFileSync(eventFile, JSON.stringify({
      pull_request: {
        body: `### Features\n\n${makeEntry("core", "feature", "b111111")}\n`
      }
    }), "utf8");

    const passResult = checkReleaseRange(
      { releaseBase: "origin/main", filePath: "CHANGELOG.md", eventDescription: true },
      { execGit: mockExecGit, rootDir: tempDir, resolveCommit: mockResolver, env: { GITHUB_EVENT_PATH: eventFile } }
    );
    assert.equal(passResult.skipped, false);
    assert.equal(passResult.version, "0.21.0");
  } finally {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

const issueLink = "[#649](https://github.com/nandohdc/bloodtrail/issues/649)";
const closingEntry = `${makeEntry("openspec", "propose evaluation kit", "b111111")}, closes ${issueLink}`;
const referenceEntry = closingEntry.replace(", closes ", ", refs ");
const cleanerPath = fileURLToPath(new URL("./clean-release-changelog.mjs", import.meta.url));

test("cleanSection neutralizes keyword-only suffixes preserving links and other bytes", () => {
  const input = `${closingEntry}, [#700](https://github.com/issues/700)  \n`;
  const expected = input.replace(", closes ", ", refs ");
  const result = cleanSection(input, createMockResolver());
  assert.equal(result.cleanedText, expected);
  assert.equal(result.droppedEntries.length, 0);
  assert.equal(cleanSection(expected, createMockResolver()).cleanedText, expected);
});

test("refs suffixes retain multiple-reference grammar and deduplicate against merge twins", () => {
  const branch = `${referenceEntry}, [#700](https://github.com/issues/700) [#701](https://github.com/issues/701)`;
  const merge = makeEntry("openspec", "propose evaluation kit", "a111111");
  const result = cleanSection(`${merge}\n${branch}\n`, createMockResolver());
  assert.equal(result.cleanedText, `${branch}\n`);
  assert.equal(result.droppedEntries.length, 1);
  const second = cleanSection(result.cleanedText, createMockResolver());
  assert.equal(second.cleanedText, result.cleanedText);
  assert.equal(second.droppedEntries.length, 0);
});

test("cleanChangelog neutralizes only selected sections and snippets idempotently", () => {
  const latest = `## [2.0.0]\n\n${closingEntry}\n`;
  const historical = `## [1.0.0]\n\n${closingEntry}\n`;
  const preamble = `# Changelog\n\nHistorical closes ${issueLink}\n\n`;
  const content = preamble + latest + historical;
  const resolver = createMockResolver();
  for (const options of [{}, { targetSection: "2.0.0" }]) {
    const result = cleanChangelog(content, { ...options, resolveCommit: resolver });
    assert.equal(result.cleanedContent, preamble + latest.replace(", closes ", ", refs ") + historical);
    assert.equal(result.droppedEntries.length, 0);
    assert.equal(cleanChangelog(result.cleanedContent, { ...options, resolveCommit: resolver }).cleanedContent, result.cleanedContent);
    assert.equal(checkChangelog(result.cleanedContent, { ...options, resolveCommit: resolver }).clean, true);
  }
  assert.equal(cleanChangelog(content, { targetSection: "1.0.0", resolveCommit: resolver }).cleanedContent,
    preamble + latest + historical.replace(", closes ", ", refs "));
  assert.equal(cleanChangelog(content, { all: true, resolveCommit: resolver }).cleanedContent,
    preamble + (latest + historical).replaceAll(", closes ", ", refs "));
  const snippet = `### Features\n\n${closingEntry}\n`;
  const result = cleanChangelog(snippet, { resolveCommit: resolver });
  assert.equal(result.cleanedContent, snippet.replace(", closes ", ", refs "));
  assert.equal(cleanChangelog(result.cleanedContent, { resolveCommit: resolver }).cleanedContent, result.cleanedContent);
});

test("checkChangelog reports closing keywords from original selected lines despite cleaned output", () => {
  const input = `## [2.0.0]\n\n${closingEntry}\n`;
  const result = checkChangelog(input, { resolveCommit: createMockResolver() });
  assert.equal(result.clean, false);
  assert.equal(result.droppedEntries.length, 0);
  assert.deepEqual(result.closingKeywords, [closingEntry]);
  assert.equal(result.cleanedContent, input.replace(", closes ", ", refs "));
  assert.equal(checkChangelog(result.cleanedContent, { resolveCommit: createMockResolver() }).clean, true);
  const historical = `## [1.0.0]\n\nHistorical closes ${issueLink}\n`;
  assert.equal(checkChangelog(result.cleanedContent + historical, { resolveCommit: createMockResolver() }).clean, true);
  assert.equal(checkChangelog(result.cleanedContent + historical, { all: true, resolveCommit: createMockResolver() }).clean, false);
});

test("PR keyword-only cleanup PATCHes and verifies; a refs description causes no PATCH", async () => {
  const dirty = `closes ${issueLink}\n\n${closingEntry}\nNarrative, closes ${issueLink}\n`;
  const expected = `refs ${issueLink}\n\n${referenceEntry}\nNarrative, refs ${issueLink}\n`;
  const env = { GH_TOKEN: "fixture-token", GITHUB_REPOSITORY: "owner/repo" };
  for (const initialBody of [dirty, expected]) {
    const methods = [];
    await cleanPullRequestBody(672, createMockResolver(), {
      env,
      fetch: async (url, opts) => {
        assert.equal(url, "https://api.github.com/repos/owner/repo/pulls/672");
        assert.equal(opts.headers.Authorization, "Bearer fixture-token");
        methods.push(opts.method);
        if (opts.method === "GET") return { ok: true, json: async () => ({ body: initialBody }) };
        assert.equal(opts.method, "PATCH");
        assert.equal(JSON.parse(opts.body).body, expected);
        // GitHub's CRLF normalization remains accepted by response verification.
        return { ok: true, json: async () => ({ body: expected.replaceAll("\n", "\r\n") }) };
      }
    });
    assert.deepEqual(methods, initialBody === dirty ? ["GET", "PATCH"] : ["GET"]);
  }
});

test("keyword-only PR cleanup retains fatal REST network, PATCH status and verification errors", async () => {
  const env = { GH_TOKEN: "fixture-token", GITHUB_REPOSITORY: "owner/repo" };
  const getBody = { ok: true, json: async () => ({ body: closingEntry }) };
  for (const method of ["GET", "PATCH"]) {
    await assert.rejects(cleanPullRequestBody(672, createMockResolver(), {
      env,
      fetch: async (url, opts) => {
        if (opts.method === method) throw new Error("offline fixture");
        return getBody;
      }
    }), new RegExp(`${method} .*network failure: offline fixture`));
  }
  await assert.rejects(cleanPullRequestBody(672, createMockResolver(), {
    env,
    fetch: async (url, opts) => opts.method === "GET" ? getBody : { ok: false, status: 403 }
  }), /PATCH .*failed with status 403/);
  await assert.rejects(cleanPullRequestBody(672, createMockResolver(), {
    env,
    fetch: async () => getBody
  }), /Verification mismatch/);
});

async function withReleaseFixture(run) {
  // Node resolves module paths through macOS's /var -> /private/var symlink.
  const dir = realpathSync(mkdtempSync(join(tmpdir(), "bloodtrail-closing-keywords-")));
  try {
    const git = (args) => execFileSync("git", args, { cwd: dir, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
    git(["init", "--initial-branch=main"]);
    git(["config", "user.name", "Release test"]);
    git(["config", "user.email", "release-test@example.invalid"]);
    writeFileSync(join(dir, "version.txt"), "1.0.0\n");
    git(["add", "version.txt"]);
    git(["commit", "-m", "chore: fixture baseline"]);
    const base = git(["rev-parse", "HEAD"]);
    writeFileSync(join(dir, "version.txt"), "2.0.0\n");
    const entry = `* **openspec:** fixture proposal ([${base.slice(0, 7)}](https://github.com/commit/${base})), closes ${issueLink}`;
    const reference = entry.replace(", closes ", ", refs ");
    const historical = `\n## [1.0.0]\n\nHistorical closes ${issueLink}\n`;
    const section = (line) => `## [2.0.0]\n\n${line}\n${historical}`;
    const changelog = join(dir, "CHANGELOG.md");
    const event = join(dir, "event.json");
    const setInputs = (line, body = reference) => {
      writeFileSync(changelog, section(line));
      writeFileSync(event, JSON.stringify({ pull_request: { body } }));
    };
    const cli = (args, script = cleanerPath) => spawnSync(process.execPath, [script, ...args], {
      cwd: dir,
      encoding: "utf8",
      env: { ...process.env, GH_TOKEN: "", GITHUB_TOKEN: "", GITHUB_EVENT_PATH: event }
    });
    setInputs(entry);
    await run({ dir, base, entry, reference, section, changelog, event, setInputs, cli });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

function assertReadOnlyCheck(fixture, args, offendingLine = null, script = cleanerPath) {
  const before = [fixture.changelog, fixture.event].map((path) => readFileSync(path, "utf8"));
  const result = fixture.cli(args, script);
  assert.equal(result.error, undefined);
  assert.equal(result.status, offendingLine ? 1 : 0, result.stderr + result.stdout);
  if (offendingLine) {
    assert.ok(result.stderr.includes(offendingLine), result.stderr);
    assert.match(result.stderr, /[Cc]losing keyword/);
    assert.match(result.stderr, /closes\s+\[#649\]/);
  }
  assert.deepEqual([fixture.changelog, fixture.event].map((path) => readFileSync(path, "utf8")), before);
  return result;
}

test("CLI cleaning writes keyword-only changelog changes and refs input is a no-write no-op", async () => {
  await withReleaseFixture(async (fixture) => {
    const result = fixture.cli([]);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(fixture.changelog, "utf8"), fixture.section(fixture.reference));
    utimesSync(fixture.changelog, new Date("2000-01-01"), new Date("2000-01-01"));
    const before = statSync(fixture.changelog).mtimeMs;
    const second = fixture.cli([]);
    assert.equal(second.status, 0, second.stderr);
    assert.match(second.stdout, /already clean/);
    assert.equal(statSync(fixture.changelog).mtimeMs, before, "No write for refs input");
    assert.equal(readFileSync(fixture.changelog, "utf8"), fixture.section(fixture.reference));
  });
});

test("plain CLI --check rejects original closing entries, names them, and never writes or calls REST", async () => {
  await withReleaseFixture(async (fixture) => {
    assertReadOnlyCheck(fixture, ["--check", "--pr", "672"], fixture.entry);
    fixture.setInputs(fixture.reference);
    assertReadOnlyCheck(fixture, ["--check", "--pr", "672"]);
    assertReadOnlyCheck(fixture, ["--check", "--all"], `Historical closes ${issueLink}`);
  });
});

test("release range exports and CLI reject section and description directives independently", async () => {
  await withReleaseFixture(async (fixture) => {
    const options = { releaseBase: fixture.base, eventDescription: true };
    const context = { rootDir: fixture.dir, env: { GITHUB_EVENT_PATH: fixture.event } };
    const args = ["--check", "--release-base", fixture.base, "--event-description"];
    assert.throws(() => checkReleaseRange(options, context), (err) =>
      err.message.includes("changelog section [2.0.0]") && err.message.includes(fixture.entry));
    assertReadOnlyCheck(fixture, args, fixture.entry);
    for (const body of [fixture.entry, `closes ${issueLink} — outside commit bullets`]) {
      fixture.setInputs(fixture.reference, body);
      assert.throws(() => checkReleaseRange(options, context), (err) =>
        err.message.includes("pull request description") && err.message.includes(body));
      assertReadOnlyCheck(fixture, args, body);
    }
    fixture.setInputs(fixture.reference, `refs ${issueLink}\n${fixture.reference}`);
    assert.equal(checkReleaseRange(options, context).skipped, false);
    assertReadOnlyCheck(fixture, args);
    fixture.setInputs(fixture.entry, fixture.entry);
    writeFileSync(join(fixture.dir, "version.txt"), "1.0.0\n");
    assert.equal(checkReleaseRange(options, context).skipped, true);
    assertReadOnlyCheck(fixture, args);
  });
});

test("description closing keywords spanning whitespace are neutralized and rejected before cleanup", () => {
  const input = `closes\n${issueLink}\n`;
  const cleaned = cleanChangelog(input, { resolveCommit: createMockResolver() }).cleanedContent;
  assert.equal(cleaned, `refs\n${issueLink}\n`);
  const result = checkChangelog(input, { resolveCommit: createMockResolver() });
  assert.equal(result.clean, false);
  assert.deepEqual(result.closingKeywords, [`closes\n${issueLink}`]);
});

test("planted identity-neutralizer emits closes but independent CLI checks reject section and description", async () => {
  await withReleaseFixture(async (fixture) => {
    const original = readFileSync(cleanerPath, "utf8");
    const implementation = 'function neutralizeClosingKeywords(text) {\n  return text.replaceAll(/\\bcloses(\\s+\\[#\\d+\\])/g, "refs$1");\n}';
    assert.equal(original.split(implementation).length - 1, 1, "Mutate exactly one neutralizer implementation");
    const mutant = join(fixture.dir, "identity-cleaner.mjs");
    writeFileSync(mutant, original.replace(implementation, "function neutralizeClosingKeywords(text) {\n  return text;\n}"));
    const result = fixture.cli([], mutant);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(fixture.changelog, "utf8"), fixture.section(fixture.entry), "Mutant cleaning leaves the directive in emitted content");
    assertReadOnlyCheck(fixture, ["--check"], fixture.entry, mutant);
    const args = ["--check", "--release-base", fixture.base, "--event-description"];
    assertReadOnlyCheck(fixture, args, fixture.entry, mutant);

    // Drive the mutant's actual PR cleanup too: no transform means GET only, leaving a dirty body.
    const { cleanPullRequestBody: mutantCleanup } = await import(pathToFileURL(mutant).href);
    const dirtyBody = `closes ${issueLink} — mutant description\n${fixture.entry}`;
    let emittedBody = dirtyBody;
    const methods = [];
    await mutantCleanup(672, createGitResolver({ cwd: fixture.dir }), {
      env: { GH_TOKEN: "fixture-token", GITHUB_REPOSITORY: "owner/repo" },
      fetch: async (url, opts) => {
        methods.push(opts.method);
        if (opts.method === "PATCH") emittedBody = JSON.parse(opts.body).body;
        return { ok: true, json: async () => ({ body: emittedBody }) };
      }
    });
    assert.deepEqual(methods, ["GET"]);
    assert.equal(emittedBody, dirtyBody);
    fixture.setInputs(fixture.reference, emittedBody);
    assertReadOnlyCheck(fixture, args, `closes ${issueLink} — mutant description`, mutant);
    assert.equal(readFileSync(cleanerPath, "utf8"), original, "Live source is never mutated");
  });
});
