#!/usr/bin/env node
/**
 * Release changelog deduplication for repositories using GitHub merge commits.
 *
 * Resolves Issue #471: Release Please duplicates changelog entries because GitHub
 * merge commits repeat pull request titles in their bodies, causing Release Please
 * to parse both the merge commit and the branch's individual commits.
 */

import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { isAbsolute, normalize, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ENTRY_REGEX = /^(\s*\*\s+)(.*?)\s*\(\[([a-f0-9]+)\]\(([^)]+)\)\)\s*$/;

/**
 * Resolves a file path safely within rootDir, rejecting path traversal attempts.
 */
export function safeResolvePath(filePath, rootDir = process.cwd()) {
  if (typeof filePath !== "string") {
    throw new Error("Invalid path: must be a string");
  }
  if (filePath.includes("..")) {
    throw new Error(`Invalid path: "${filePath}" contains parent segments`);
  }
  if (isAbsolute(filePath)) {
    throw new Error(`Invalid path: "${filePath}" must be a relative path`);
  }

  const root = resolve(rootDir);
  const normalized = normalize(filePath);
  const target = resolve(root, normalized);
  const relativeToRoot = relative(root, target);

  if (relativeToRoot.startsWith("..")) {
    throw new Error(`Path traversal rejected: "${filePath}" resolves outside root "${root}"`);
  }
  if (isAbsolute(relativeToRoot)) {
    throw new Error(`Path traversal rejected: "${filePath}" resolves outside root "${root}"`);
  }

  return target;
}

function inspectCommitDetails(sha, execGit) {
  try {
    const out = execGit(["log", "-1", "--format=%H%x00%P%x00%s", sha]).trim();
    const [fullSha, rawParents, subject] = out.split("\0");
    const parents = rawParents ? rawParents.split(/\s+/).filter(Boolean) : [];
    const isMerge = parents.length > 1 && (subject?.startsWith("Merge ") ?? false);
    return { fullSha: fullSha || sha, parents, subject: subject || "", isMerge };
  } catch {
    return { fullSha: sha, parents: [], subject: "", isMerge: false };
  }
}

function inspectMergedCommits(parents, execGit) {
  if (parents.length < 2) return [];
  try {
    const revList = execGit(["rev-list", `${parents[0]}..${parents[1]}`]).trim();
    return revList ? revList.split("\n").filter(Boolean) : [];
  } catch {
    return [];
  }
}

/**
 * Creates a commit resolver that caches git inspections.
 * Accepts an injectable execGit function for isolated deterministic unit testing.
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

    const details = inspectCommitDetails(sha, execGit);
    const mergedCommits = details.isMerge ? inspectMergedCommits(details.parents, execGit) : [];
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
 */
export function parseSectionEntries(lines) {
  const entries = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
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
        rawLine: line
      });
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

function findSubjectMergeDuplicates(bySubject, resolveCommit) {
  const toDrop = new Set();
  for (const group of bySubject.values()) {
    if (group.length <= 1) continue;
    const mergeEntries = group.filter((e) => resolveCommit(e.fullSha).isMerge);
    const nonMergeCount = group.length - mergeEntries.length;
    if (mergeEntries.length > 0 && nonMergeCount > 0) {
      for (const m of mergeEntries) toDrop.add(m);
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
 */
export function identifyDuplicateEntries(entries, resolveCommit) {
  const sectionShas = new Set();
  for (const entry of entries) {
    sectionShas.add(entry.fullSha);
    sectionShas.add(entry.shortSha);
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

/**
 * Cleans duplicate entries from a release section string.
 */
export function cleanSection(sectionText, resolveCommit) {
  const lines = sectionText.split("\n");
  const entries = parseSectionEntries(lines);
  const toDrop = identifyDuplicateEntries(entries, resolveCommit);

  if (toDrop.size === 0) {
    return { cleanedText: sectionText, droppedEntries: [] };
  }

  const dropIndices = new Set(Array.from(toDrop, (e) => e.lineIndex));
  const keptLines = lines.filter((_, idx) => !dropIndices.has(idx));

  return {
    cleanedText: keptLines.join("\n"),
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
    const { cleanedText, droppedEntries } = cleanSection(sec.lines.join("\n"), resolveCommit);
    for (const d of droppedEntries) {
      allDropped.push({ ...d, version: sec.version || "snippet" });
    }
    return cleanedText;
  });

  return {
    cleanedContent: cleanedSections.join("\n"),
    droppedEntries: allDropped
  };
}

/**
 * Checks if changelog content has duplicate entries without modifying it.
 */
export function checkChangelog(content, options = {}) {
  const { cleanedContent, droppedEntries } = cleanChangelog(content, options);
  return {
    clean: droppedEntries.length === 0,
    droppedEntries,
    cleanedContent
  };
}

/**
 * Cleans duplicate entries from a pull request description via gh CLI.
 */
export function cleanPullRequestBody(prNumber, resolveCommit) {
  if (!/^[0-9]+$/.test(String(prNumber))) {
    throw new Error(`Invalid PR number: "${prNumber}"`);
  }
  try {
    const body = execFileSync("gh", ["pr", "view", String(prNumber), "--json", "body", "-q", ".body"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"]
    });
    const { cleanedText, droppedEntries } = cleanSection(body, resolveCommit);
    if (droppedEntries.length > 0 && cleanedText !== body) {
      execFileSync("gh", ["pr", "edit", String(prNumber), "--body", cleanedText], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"]
      });
      console.log(`Cleaned ${droppedEntries.length} duplicate entry(ies) in PR #${prNumber} description.`);
    }
  } catch (err) {
    console.warn(`Warning: unable to update PR #${prNumber} body: ${err.message}`);
  }
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

function processCheckResults(droppedEntries) {
  if (droppedEntries.length > 0) {
    console.error(`Changelog check failed: found ${droppedEntries.length} duplicate merge commit entry(ies):`);
    for (const d of droppedEntries) {
      console.error(`  - [${d.version || "candidate"}] ${d.shortSha}: ${d.subject}`);
    }
    return 1;
  }
  console.log("Changelog check passed: no duplicate release entries found.");
  return 0;
}

function processCleanResults(fullPath, filePath, cleanedContent, droppedEntries) {
  if (droppedEntries.length > 0) {
    writeFileSync(fullPath, cleanedContent, "utf8");
    console.log(`Cleaned ${droppedEntries.length} duplicate merge commit entry(ies) in ${filePath}:`);
    for (const d of droppedEntries) {
      console.log(`  - [${d.version || "candidate"}] dropped merge commit ${d.shortSha}: ${d.subject}`);
    }
  } else {
    console.log("Changelog is already clean: no duplicate entries found.");
  }
  return 0;
}

/**
 * Main CLI entry point.
 */
export function main(args = process.argv.slice(2)) {
  const options = parseArgs(args);

  if (options.showHelp) {
    console.log(`Usage: clean-release-changelog.mjs [options]
Options:
  -f, --file <path>       Path to changelog file (default: CHANGELOG.md)
  -c, --check             Fail with non-zero exit if uncleaned duplicates exist
  -s, --section <version> Target a specific release version (e.g. 0.18.0)
  -p, --pr <number>       Clean release notes in pull request body via gh CLI
  -a, --all               Process all release sections
  -h, --help              Show this help message`);
    return 0;
  }

  let fullPath;
  try {
    fullPath = safeResolvePath(options.filePath);
  } catch (err) {
    console.error(`Invalid path: ${err.message}`);
    return 1;
  }

  let content;
  try {
    content = readFileSync(fullPath, "utf8");
  } catch (err) {
    console.error(`Error reading ${fullPath}: ${err.message}`);
    return 1;
  }

  const resolveCommit = createGitResolver();
  const { cleanedContent, droppedEntries } = cleanChangelog(content, {
    resolveCommit,
    targetSection: options.targetSection,
    all: options.all
  });

  if (options.checkOnly) {
    return processCheckResults(droppedEntries);
  }

  const exitCode = processCleanResults(fullPath, options.filePath, cleanedContent, droppedEntries);
  if (options.prNumber) {
    cleanPullRequestBody(options.prNumber, resolveCommit);
  }

  return exitCode;
}

const isDirectRun = process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1]);
if (isDirectRun) {
  process.exit(main());
}
