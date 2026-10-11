#!/usr/bin/env node
// Validates the PR title and *every* commit subject in the PR against Conventional Commits.
//
// There is deliberately no merge-commit exemption: a `Merge branch 'main' into ...` subject
// fails this check. CONTRIBUTING.md tells contributors to rebase rather than merge `main`
// into a PR branch, and that rule is only real if this check enforces it.
//
// Usage:
//   node .github/scripts/check-conventional-commits.mjs \
//     --title "<pr title>" --github-pr "<owner/repo>" "<pr number>"

// Verbatim from CONTRIBUTING.md; `security` is intentional and non-standard.
const ALLOWED_TYPES = [
  "build", "chore", "ci", "docs", "feat", "fix",
  "perf", "refactor", "revert", "security", "style", "test",
];

// type(optional-scope)optional-!: description
// The description must start and end with a non-space, which rejects both an empty
// description and a trailing space that would otherwise survive review.
const SUBJECT = new RegExp(
  String.raw`^(?:${ALLOWED_TYPES.join("|")})(?:\([^()\n]+\))?!?: (\S(?:.*\S)?)$`,
);
const WORK_ITEM_DESCRIPTION = /^[A-Z][A-Z0-9]*-\d+(?: - |:)/;

function subjectFailure(subject) {
  const match = SUBJECT.exec(subject);
  if (!match) return subject;
  if (WORK_ITEM_DESCRIPTION.test(match[1])) {
    return `${subject} (a work-item ID is not a change description)`;
  }
  return null;
}

function parseArguments(argv) {
  const options = { title: undefined, repository: undefined, pullRequest: undefined };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--title") {
      options.title = argv[++index];
    } else if (argument === "--github-pr") {
      options.repository = argv[++index];
      options.pullRequest = argv[++index];
    } else {
      throw new Error(`unsupported argument ${argument}`);
    }
  }
  return options;
}

async function fetchCommitSubjects(repository, pullRequest, token) {
  const subjects = [];
  for (let page = 1; page <= 10; page += 1) {
    const url = `https://api.github.com/repos/${repository}/pulls/${pullRequest}/commits?per_page=100&page=${page}`;
    const response = await fetch(url, {
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": "2022-11-28",
        "user-agent": "bloodtrail-conventional-commits",
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!response.ok) {
      throw new Error(`GitHub API ${response.status} ${response.statusText} for ${url}`);
    }
    const batch = await response.json();
    if (!Array.isArray(batch)) throw new Error("unexpected commits payload");
    for (const entry of batch) {
      const message = entry?.commit?.message ?? "";
      subjects.push({ sha: (entry?.sha ?? "").slice(0, 8), subject: message.split("\n")[0] });
    }
    if (batch.length < 100) break;
  }
  return subjects;
}

const options = parseArguments(process.argv.slice(2));
const failures = [];

if (options.title !== undefined) {
  const failure = subjectFailure(options.title);
  if (failure !== null) failures.push(`PR title: ${failure}`);
}

if (options.repository && options.pullRequest) {
  const commits = await fetchCommitSubjects(
    options.repository,
    options.pullRequest,
    process.env.GITHUB_TOKEN,
  );
  if (commits.length === 0) failures.push("no commits were returned for this pull request");
  for (const { sha, subject } of commits) {
    const failure = subjectFailure(subject);
    if (failure !== null) failures.push(`commit ${sha}: ${failure}`);
  }
  process.stdout.write(`checked PR title and ${commits.length} commit subject(s)\n`);
}

if (failures.length > 0) {
  process.stderr.write(
    [
      "Conventional Commits check failed:",
      ...failures.map((entry) => `  - ${entry}`),
      "",
      "Expected: type(scope)!: description",
      `Allowed types: ${ALLOWED_TYPES.join(", ")}`,
      "",
      "A `Merge branch 'main' into ...` subject fails here by design - rebase instead.",
      "See CONTRIBUTING.md.",
      "",
    ].join("\n"),
  );
  process.exit(1);
}

process.stdout.write("Conventional Commits check passed\n");
