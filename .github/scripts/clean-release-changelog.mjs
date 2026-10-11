#!/usr/bin/env node
/**
 * Release changelog deduplication for repositories using GitHub merge commits.
 *
 * Resolves Issue #471: Release Please duplicates changelog entries because GitHub
 * merge commits repeat pull request titles in their bodies, causing Release Please
 * to parse both the merge commit and the branch's individual commits.
 *
 * Resolves Issue #642: Recognise issue-reference suffixes, fail closed on unrecognised
 * entries or unresolvable commits, update PR descriptions via REST fetch, and enforce
 * de-duplication in required checks.
 *
 * Resolves Issue #744: Replace release closing directives with non-closing references
 * and reject any remaining directive in check mode, independently of cleanup.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ENTRY_REGEX = /^(\s*\*\s+)(.*?)\s*\(\[([a-f0-9]+)\]\(([^)]+)\)\)((?:(?:\s*,\s*|\s+)(?:closes|refs)\s+\[[^\]]+\]\([^)]+\)(?:(?:,\s*|\s+)\[[^\]]+\]\([^)]+\))*)?)\s*$/;
export const COMMIT_LINK_REGEX = /\(\[[a-f0-9]+\]\([^)]+\)\)/;

function validateRelativePath(filePath) {
  if (typeof filePath !== "string") {
    throw new Error("Invalid path: must be a string");
  }
  if (filePath.includes("..")) {
    throw new Error(`Invalid path: "${filePath}" contains parent segments`);
  }
  if (isAbsolute(filePath)) {
    throw new Error(`Invalid path: "${filePath}" must be a relative path`);
  }
}

/**
 * Resolves a file path safely within rootDir, rejecting path traversal attempts.
 */
export function safeResolvePath(filePath, rootDir = process.cwd()) {
  validateRelativePath(filePath);

  const root = resolve(rootDir);
  const target = resolve(root, normalize(filePath));
  const relativeToRoot = relative(root, target);

  if (relativeToRoot.startsWith("..") || isAbsolute(relativeToRoot)) {
    throw new Error(`Path traversal rejected: "${filePath}" resolves outside root "${root}"`);
  }

  return target;
}

function inspectCommitDetails(sha, execGit) {
  const out = execGit(["log", "-1", "--format=%H%x00%P%x00%s", sha]).trim();
  const [fullSha, rawParents, subject] = out.split("\0");
  const parents = rawParents ? rawParents.split(/\s+/).filter(Boolean) : [];
  const isMerge = parents.length > 1 && (subject?.startsWith("Merge ") ?? false);
  return { fullSha: fullSha || sha, parents, subject: subject || "", isMerge };
}

function inspectMergedCommits(parents, execGit) {
  if (parents.length < 2) return [];
  const revList = execGit(["rev-list", `${parents[0]}..${parents[1]}`]).trim();
  return revList ? revList.split("\n").filter(Boolean) : [];
}

/**
 * Creates a commit resolver that caches git inspections.
 * Accepts an injectable execGit function for isolated deterministic unit testing.
 * Fails closed on any git inspection error.
 */
export function createGitResolver(options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const execGit = options.execGit ?? ((args) => execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }));

  const cache = new Map();

  return function resolveCommit(sha) {
    if (!sha) {
      return { sha: "", parents: [], subject: "", isMerge: false, mergedCommits: [] };
    }
    if (cache.has(sha)) {
      return cache.get(sha);
    }

    let details;
    try {
      details = inspectCommitDetails(sha, execGit);
    } catch (err) {
      throw new Error(`Failed to resolve commit ${sha}: ${err.message}`);
    }

    let mergedCommits = [];
    if (details.isMerge) {
      try {
        mergedCommits = inspectMergedCommits(details.parents, execGit);
      } catch (err) {
        throw new Error(`Failed to inspect merged commits for ${sha} (${details.parents[0]}..${details.parents[1]}): ${err.message}`);
      }
    }
    const info = { ...details, sha: details.fullSha, mergedCommits };

    cache.set(sha, info);
    if (details.fullSha !== sha) {
      cache.set(details.fullSha, info);
    }
    return info;
  };
}

/**
 * Parses bullet point entries from release section lines.
 * Fails closed if any bullet links a commit but fails to match the recognised grammar.
 */
export function parseSectionEntries(lines) {
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*\*\s+/.test(line)) {
      const match = line.match(ENTRY_REGEX);
      if (match) {
        const url = match[4];
        const commitMatch = url.match(/\/commit\/([a-f0-9]+)/);
        const fullSha = commitMatch ? commitMatch[1] : match[3];
        entries.push({
          lineIndex: i,
          prefix: match[1],
          subject: match[2].trim(),
          shortSha: match[3],
          fullSha,
          suffix: match[5] || "",
          rawLine: line
        });
      } else if (COMMIT_LINK_REGEX.test(line)) {
        throw new Error(`Unrecognised entry: "${line.trim()}"`);
      }
    }
  }
  return entries;
}

function groupEntriesBySubject(entries) {
  const bySubject = new Map();
  for (const entry of entries) {
    let group = bySubject.get(entry.subject);
    if (!group) {
      group = [];
      bySubject.set(entry.subject, group);
    }
    group.push(entry);
  }
  return bySubject;
}

function extractDuplicateMergeEntries(group, resolveCommit) {
  if (group.length <= 1) return [];
  const mergeEntries = group.filter((e) => resolveCommit(e.fullSha).isMerge);
  const hasNonMerge = mergeEntries.length < group.length;
  return (mergeEntries.length > 0 && hasNonMerge) ? mergeEntries : [];
}

function findSubjectMergeDuplicates(bySubject, resolveCommit) {
  const toDrop = new Set();
  for (const group of bySubject.values()) {
    for (const entry of extractDuplicateMergeEntries(group, resolveCommit)) {
      toDrop.add(entry);
    }
  }
  return toDrop;
}

function findMergedBranchDuplicates(entries, sectionShas, resolveCommit, alreadyDropped) {
  const toDrop = new Set();
  for (const entry of entries) {
    if (alreadyDropped.has(entry)) continue;
    const info = resolveCommit(entry.fullSha);
    if (!info.isMerge || info.mergedCommits.length === 0) continue;
    if (info.mergedCommits.some((c) => sectionShas.has(c))) {
      toDrop.add(entry);
    }
  }
  return toDrop;
}

/**
 * Identifies duplicate merge commit entries to drop within a release section.
 * Fails closed if any commit cannot be resolved.
 */
export function identifyDuplicateEntries(entries, resolveCommit) {
  const sectionShas = new Set();
  for (const entry of entries) {
    sectionShas.add(entry.fullSha);
    sectionShas.add(entry.shortSha);
    try {
      resolveCommit(entry.fullSha);
    } catch (err) {
      throw new Error(`Unresolvable commit in entry "${entry.rawLine.trim()}": ${err.message}`);
    }
  }

  const bySubject = groupEntriesBySubject(entries);
  const droppedBySubject = findSubjectMergeDuplicates(bySubject, resolveCommit);
  const droppedByMerged = findMergedBranchDuplicates(entries, sectionShas, resolveCommit, droppedBySubject);

  const combined = new Set(droppedBySubject);
  for (const item of droppedByMerged) {
    combined.add(item);
  }
  return combined;
}

// A release merges into the default branch, where GitHub executes closing directives.
// Preserve issue links, but never let a release make an issue completion decision.
function neutralizeClosingKeywords(text) {
  return text.replaceAll(/\bcloses(\s+\[#\d+\])/g, "refs$1");
}

function findClosingKeywordLines(text) {
  const lines = Array.from(text.matchAll(/\bcloses\s+\[#\d+\]/g), (match) => {
    const start = text.lastIndexOf("\n", match.index - 1) + 1;
    const end = text.indexOf("\n", match.index + match[0].length);
    return text.slice(start, end === -1 ? text.length : end).trim();
  });
  return [...new Set(lines)];
}

function verifyNoClosingKeywords(text, location) {
  const lines = findClosingKeywordLines(text);
  if (lines.length > 0) {
    throw new Error(`Closing keyword in ${location}: ${lines.join("; ")}`);
  }
}

/**
 * Cleans duplicate entries and closing keywords from a release section string.
 */
export function cleanSection(sectionText, resolveCommit) {
  const lines = sectionText.split("\n");
  const entries = parseSectionEntries(lines);
  const toDrop = identifyDuplicateEntries(entries, resolveCommit);

  const dropIndices = new Set(Array.from(toDrop, (e) => e.lineIndex));
  const keptLines = lines.filter((_, idx) => !dropIndices.has(idx));

  return {
    cleanedText: neutralizeClosingKeywords(keptLines.join("\n")),
    droppedEntries: Array.from(toDrop)
  };
}

/**
 * Splits changelog content into sections by release header.
 */
export function splitChangelogSections(content) {
  const lines = content.split("\n");
  const sections = [];
  let currentHeader = null;
  let currentVersion = null;
  let currentLines = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const match = line.match(/^## (?:\[([0-9]+\.[0-9]+\.[0-9]+)\]|([0-9]+\.[0-9]+\.[0-9]+))/);
    if (match) {
      if (currentLines.length > 0 || currentHeader !== null) {
        sections.push({
          header: currentHeader,
          version: currentVersion,
          lines: currentLines
        });
      }
      currentHeader = line;
      currentVersion = match[1] || match[2];
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0 || currentHeader !== null) {
    sections.push({
      header: currentHeader,
      version: currentVersion,
      lines: currentLines
    });
  }

  return sections;
}

function shouldCleanSection(sec, { cleanAll, isSnippet, targetSection, firstCleaned }) {
  if (cleanAll || isSnippet) return true;
  if (targetSection !== null) return sec.version === targetSection;
  return !firstCleaned;
}

/**
 * Cleans release changelog content across targeted sections.
 */
export function cleanChangelog(content, options = {}) {
  const resolveCommit = options.resolveCommit ?? createGitResolver({ cwd: options.cwd });
  const targetSection = options.targetSection ?? null;
  const cleanAll = Boolean(options.all);

  const sections = splitChangelogSections(content);
  const allDropped = [];
  const closingKeywords = [];
  let firstCleaned = false;

  const isSnippet = sections.length === 1 && !sections[0].version;

  const cleanedSections = sections.map((sec) => {
    if (!sec.version && !isSnippet) {
      return sec.lines.join("\n");
    }

    const shouldClean = shouldCleanSection(sec, { cleanAll, isSnippet, targetSection, firstCleaned });
    if (!shouldClean) {
      return sec.lines.join("\n");
    }

    firstCleaned = true;
    const sectionText = sec.lines.join("\n");
    closingKeywords.push(...findClosingKeywordLines(sectionText));
    const { cleanedText, droppedEntries } = cleanSection(sectionText, resolveCommit);
    for (const d of droppedEntries) {
      allDropped.push({ ...d, version: sec.version || "snippet" });
    }
    return cleanedText;
  });

  return {
    cleanedContent: cleanedSections.join("\n"),
    droppedEntries: allDropped,
    closingKeywords
  };
}

/**
 * Checks original selected content for duplicate entries and closing keywords without modifying it.
 */
export function checkChangelog(content, options = {}) {
  const { cleanedContent, droppedEntries, closingKeywords } = cleanChangelog(content, options);
  return {
    clean: droppedEntries.length === 0 && closingKeywords.length === 0,
    droppedEntries,
    closingKeywords,
    cleanedContent
  };
}

function getPrClientConfig(options) {
  const env = options.env ?? process.env;
  const token = env.GH_TOKEN || env.GITHUB_TOKEN;
  const repository = env.GITHUB_REPOSITORY;
  const apiUrl = (env.GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, "");

  if (!token) {
    throw new Error("Missing GH_TOKEN environment variable for PR description cleanup");
  }
  if (!repository) {
    throw new Error("Missing GITHUB_REPOSITORY environment variable for PR description cleanup");
  }

  return {
    token,
    repository,
    apiUrl,
    fetchFn: options.fetch ?? globalThis.fetch
  };
}

async function fetchPullRequestBody(url, token, fetchFn) {
  let res;
  try {
    res = await fetchFn(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "clean-release-changelog"
      }
    });
  } catch (err) {
    throw new Error(`GitHub API GET ${url} network failure: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`GitHub API GET ${url} failed with status ${res.status}`);
  }

  const data = await res.json();
  return data.body ?? "";
}

async function updatePullRequestBody(target, prNumber, cleanedText) {
  const { url, token, fetchFn } = target;
  let res;
  try {
    res = await fetchFn(url, {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "clean-release-changelog"
      },
      body: JSON.stringify({ body: cleanedText })
    });
  } catch (err) {
    throw new Error(`GitHub API PATCH ${url} network failure: ${err.message}`);
  }

  if (!res.ok) {
    throw new Error(`GitHub API PATCH ${url} failed with status ${res.status}`);
  }

  const data = await res.json();
  const normalizedExpected = cleanedText.replace(/\r\n/g, "\n");
  const normalizedActual = (data.body ?? "").replace(/\r\n/g, "\n");
  if (normalizedExpected !== normalizedActual) {
    throw new Error(`Verification mismatch after updating PR #${prNumber} description`);
  }
}

/**
 * Cleans duplicate entries from a pull request description via GitHub REST API.
 * Fails closed on missing credentials, network errors, non-2xx responses, or verification mismatch.
 */
export async function cleanPullRequestBody(prNumber, resolveCommit, options = {}) {
  if (!/^[0-9]+$/.test(String(prNumber))) {
    throw new Error(`Invalid PR number: "${prNumber}"`);
  }

  const { token, repository, apiUrl, fetchFn } = getPrClientConfig(options);
  const pullUrl = `${apiUrl}/repos/${repository}/pulls/${prNumber}`;
  const body = await fetchPullRequestBody(pullUrl, token, fetchFn);

  const { cleanedText, droppedEntries } = cleanSection(body, resolveCommit);
  if (cleanedText === body) {
    console.log(`PR #${prNumber} description is already clean: no duplicates or closing keywords found.`);
    return;
  }

  await updatePullRequestBody({ url: pullUrl, token, fetchFn }, prNumber, cleanedText);
  console.log(`Cleaned PR #${prNumber} description: removed ${droppedEntries.length} duplicate entry(ies) and neutralized closing keywords.`);
}

function readBaseVersion(execGit, releaseBase) {
  try {
    return execGit(["show", `${releaseBase}:version.txt`]).trim();
  } catch {
    return null;
  }
}

function verifyChangelogSectionClean(filePath, rootDir, version, resolveCommit) {
  const changelogPath = safeResolvePath(filePath, rootDir);
  let changelogContent;
  try {
    changelogContent = readFileSync(changelogPath, "utf8");
  } catch (err) {
    throw new Error(`Unable to read changelog file at ${changelogPath}: ${err.message}`);
  }

  const sections = splitChangelogSections(changelogContent);
  const targetSection = sections.find((s) => s.version === version);
  if (!targetSection) {
    throw new Error(`Release section [${version}] is missing from ${filePath}`);
  }

  const sectionText = targetSection.lines.join("\n");
  verifyNoClosingKeywords(sectionText, `changelog section [${version}]`);
  const { droppedEntries } = cleanSection(sectionText, resolveCommit);
  if (droppedEntries.length > 0) {
    throw new Error(`Found ${droppedEntries.length} duplicate entry(ies) in changelog section [${version}]`);
  }
}

function readEventPullRequestBody(eventPath) {
  if (!eventPath) {
    throw new Error("Missing GITHUB_EVENT_PATH environment variable for --event-description check");
  }

  let eventData;
  try {
    eventData = JSON.parse(readFileSync(eventPath, "utf8"));
  } catch (err) {
    throw new Error(`Failed to read event file at ${eventPath}: ${err.message}`);
  }

  const pullRequest = eventData ? eventData.pull_request : null;
  const body = pullRequest ? pullRequest.body : null;
  if (typeof body !== "string") {
    throw new Error(`Missing pull_request.body in event file ${eventPath}`);
  }

  return body;
}

function verifyEventDescriptionClean(eventPath, resolveCommit) {
  const body = readEventPullRequestBody(eventPath);
  verifyNoClosingKeywords(body, "pull request description");
  const { droppedEntries } = cleanSection(body, resolveCommit);
  if (droppedEntries.length > 0) {
    throw new Error(`Found ${droppedEntries.length} duplicate entry(ies) in pull request description`);
  }
}

/**
 * Evaluates a release range against base ref version.txt and checks for duplicates.
 */
export function checkReleaseRange(options = {}, context = {}) {
  const rootDir = context.rootDir ?? process.cwd();
  const execGit = context.execGit ?? ((args) => execFileSync("git", args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"]
  }));
  const env = context.env ?? process.env;
  const resolveCommit = context.resolveCommit ?? createGitResolver({ cwd: rootDir, execGit });

  const versionPath = safeResolvePath("version.txt", rootDir);
  const currentVersion = readFileSync(versionPath, "utf8").trim();
  const baseVersion = readBaseVersion(execGit, options.releaseBase);

  if (baseVersion === currentVersion) {
    console.log(`No release in range (${currentVersion} unchanged): skipping changelog check.`);
    return { skipped: true, version: currentVersion };
  }

  console.log(`Release detected: version changed from ${baseVersion ?? "(none)"} to ${currentVersion}. Checking changelog section and PR description...`);

  const changelogFile = options.filePath ?? "CHANGELOG.md";
  verifyChangelogSectionClean(changelogFile, rootDir, currentVersion, resolveCommit);

  if (options.eventDescription) {
    verifyEventDescriptionClean(env.GITHUB_EVENT_PATH, resolveCommit);
  }

  console.log(`Changelog check passed: section [${currentVersion}] and pull request description contain no duplicate entries or closing keywords.`);
  return { skipped: false, version: currentVersion };
}

const CLI_FLAG_HANDLERS = {
  "--file": (opts, val) => { opts.filePath = val; return 1; },
  "-f": (opts, val) => { opts.filePath = val; return 1; },
  "--check": (opts) => { opts.checkOnly = true; return 0; },
  "-c": (opts) => { opts.checkOnly = true; return 0; },
  "--all": (opts) => { opts.all = true; return 0; },
  "-a": (opts) => { opts.all = true; return 0; },
  "--section": (opts, val) => { opts.targetSection = val; return 1; },
  "-s": (opts, val) => { opts.targetSection = val; return 1; },
  "--pr": (opts, val) => { opts.prNumber = val; return 1; },
  "-p": (opts, val) => { opts.prNumber = val; return 1; },
  "--release-base": (opts, val) => { opts.releaseBase = val; return 1; },
  "--event-description": (opts) => { opts.eventDescription = true; return 0; },
  "--help": (opts) => { opts.showHelp = true; return 0; },
  "-h": (opts) => { opts.showHelp = true; return 0; },
};

/**
 * Parses CLI arguments.
 */
export function parseArgs(args) {
  const options = {
    filePath: "CHANGELOG.md",
    checkOnly: false,
    all: false,
    targetSection: null,
    prNumber: null,
    releaseBase: null,
    eventDescription: false,
    showHelp: false
  };

  let i = 0;
  while (i < args.length) {
    const handler = CLI_FLAG_HANDLERS[args[i]];
    if (handler) {
      i += 1 + handler(options, args[i + 1]);
    } else {
      i += 1;
    }
  }
  return options;
}

function processCheckResults(droppedEntries, closingKeywords) {
  for (const line of closingKeywords) {
    console.error(`Changelog check failed: closing keyword in entry/line: ${line}`);
  }
  if (droppedEntries.length > 0) {
    console.error(`Changelog check failed: found ${droppedEntries.length} duplicate merge commit entry(ies):`);
    for (const d of droppedEntries) {
      console.error(`  - [${d.version || "candidate"}] ${d.shortSha}: ${d.subject}`);
    }
    return 1;
  }
  if (closingKeywords.length > 0) return 1;
  console.log("Changelog check passed: no duplicate release entries or closing keywords found.");
  return 0;
}

function processCleanResults({ fullPath, filePath, content, cleanedContent, droppedEntries }) {
  if (cleanedContent !== content) {
    writeFileSync(fullPath, cleanedContent, "utf8");
    console.log(`Cleaned ${filePath}: removed ${droppedEntries.length} duplicate merge commit entry(ies) and neutralized closing keywords.`);
    for (const d of droppedEntries) {
      console.log(`  - [${d.version || "candidate"}] dropped merge commit ${d.shortSha}: ${d.subject}`);
    }
  } else {
    console.log("Changelog is already clean: no duplicates or closing keywords found.");
  }
  return 0;
}

/**
 * Main CLI entry point.
 */
export async function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);

  if (options.showHelp) {
    console.log(`Usage: clean-release-changelog.mjs [options]
Options:
  -f, --file <path>          Path to changelog file (default: CHANGELOG.md)
  -c, --check                Fail with non-zero exit if duplicates or closing keywords exist
  -s, --section <version>    Target a specific release version (e.g. 0.18.0)
  -p, --pr <number>          Clean release notes in pull request body via REST API
  -a, --all                  Process all release sections
  --release-base <ref>       Check release section and event description against base ref
  --event-description        Include pull request description from GITHUB_EVENT_PATH in check
  -h, --help                 Show this help message`);
    return 0;
  }

  let fullPath;
  try {
    fullPath = safeResolvePath(options.filePath);
  } catch (err) {
    console.error(`Invalid path: ${err.message}`);
    return 1;
  }

  const resolveCommit = createGitResolver();

  if (options.releaseBase) {
    try {
      checkReleaseRange(options, { resolveCommit });
      return 0;
    } catch (err) {
      console.error(`Check failed: ${err.message}`);
      return 1;
    }
  }

  let content;
  try {
    content = readFileSync(fullPath, "utf8");
  } catch (err) {
    console.error(`Error reading ${fullPath}: ${err.message}`);
    return 1;
  }

  let cleanedContent;
  let droppedEntries;
  let closingKeywords;
  try {
    const res = checkChangelog(content, {
      resolveCommit,
      targetSection: options.targetSection,
      all: options.all
    });
    cleanedContent = res.cleanedContent;
    droppedEntries = res.droppedEntries;
    closingKeywords = res.closingKeywords;
  } catch (err) {
    console.error(`Error: ${err.message}`);
    return 1;
  }

  if (options.checkOnly) {
    return processCheckResults(droppedEntries, closingKeywords);
  }

  const exitCode = processCleanResults({
    fullPath,
    filePath: options.filePath,
    content,
    cleanedContent,
    droppedEntries
  });
  if (options.prNumber) {
    try {
      await cleanPullRequestBody(options.prNumber, resolveCommit);
    } catch (err) {
      console.error(`Error cleaning PR #${options.prNumber} description: ${err.message}`);
      return 1;
    }
  }

  return exitCode;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  main().then((code) => process.exit(code)).catch((err) => {
    console.error(`Fatal error: ${err.message}`);
    process.exit(1);
  });
}
