import { readFile, readdir } from "node:fs/promises";
import { relative, resolve } from "node:path";
import { byCodePoint, git, repositoryRoot, splitNull } from "./verification-helpers.mjs";
import { boundedFailure } from "./lifecycle-policy.mjs";

// Scoped to what can actually publish. The repository legitimately contains
// CODECOV_TOKEN, SONAR_TOKEN, CODESCENE_TOKEN, GITHUB_TOKEN and
// RELEASE_PLEASE_TOKEN in workflows, registry.npmjs.org in every lockfile, and
// the words "npm publish" in RELEASING.md. None of those is a publication path,
// and a check that failed on them would be abandoned rather than trusted.
const PUBLICATION_COMMANDS = [
  /\b(?:npm|pnpm|yarn|bun)\s+publish\b/,
  /\bnpm\s+dist-tag\b/,
  /\bnpm\s+access\b/,
  /\bnpm\s+(?:owner|token)\b/,
  /\buses\s*:\s*\S*npm-publish\b/,
  /\buses\s*:\s*\S*publish-npm\b/,
  /\bjsr\s+publish\b/,
];
const PUBLICATION_REGISTRY_CONFIGURATION = [
  /\bregistry-url\s*:/,
  /\bpublishConfig\b/,
  /\.npmrc\b/,
  /\bnpm\s+(?:set|config\s+set)\s+registry\b/,
  // The host segment excludes "/" so the trailing "/:" cannot backtrack.
  /\/\/[^\s"'/]*\/:_authToken/,
];
const PUBLICATION_CREDENTIALS = [
  /\bNPM_TOKEN\b/,
  /\bNPM_AUTH_TOKEN\b/,
  /\bNODE_AUTH_TOKEN\b/,
  /\bNPM_CONFIG_[A-Z_]*AUTH[A-Z_]*\b/,
  /\b_authToken\b/,
];
const CHECKS = [
  ["publication-command", PUBLICATION_COMMANDS, "package publication command"],
  ["publication-registry-config", PUBLICATION_REGISTRY_CONFIGURATION, "package-registry publication configuration"],
  ["publication-credential", PUBLICATION_CREDENTIALS, "package-registry publication credential"],
];

const workflowRoot = resolve(repositoryRoot, ".github/workflows");
const failures = [];
const workflows = await workflowFiles(workflowRoot);

if (workflows.length === 0) {
  failures.push(boundedFailure("publication-scan-empty", ".github/workflows", "no workflow files were scanned; the publication-path exclusion cannot be established by scanning nothing"));
}

let scannedLines = 0;
for (const path of workflows) {
  const relativePath = relative(repositoryRoot, path).replaceAll("\\", "/");
  const lines = (await readFile(path, "utf8")).split("\n");
  for (const [index, rawLine] of lines.entries()) {
    const line = withoutComment(rawLine);
    if (line.trim() === "") continue;
    scannedLines += 1;
    for (const [id, patterns, description] of CHECKS) {
      const pattern = patterns.find((candidate) => candidate.test(line));
      if (pattern) {
        failures.push(boundedFailure(id, `${relativePath}:${index + 1}`, `${description} matched ${pattern}: expected no publication path, found ${line.trim()}`));
      }
    }
  }
}

const trackedFiles = splitNull(git(["ls-files", "-z"]));
for (const path of trackedFiles.filter((entry) => entry === ".npmrc" || entry.endsWith("/.npmrc"))) {
  failures.push(boundedFailure("publication-registry-config", path, "a tracked .npmrc is package-registry publication configuration: expected absent, found present"));
}
let manifestsScanned = 0;
for (const path of trackedFiles.filter((entry) => entry === "package.json" || entry.endsWith("/package.json"))) {
  manifestsScanned += 1;
  const manifest = JSON.parse(await readFile(resolve(repositoryRoot, path), "utf8"));
  if (manifest.publishConfig !== undefined) {
    failures.push(boundedFailure("publication-registry-config", path, "publishConfig is package-registry publication configuration: expected absent, found present"));
  }
}

if (failures.length > 0) {
  const lines = failures.map((failure) => `[${failure.id}] ${failure.file}: ${failure.message}`);
  throw new Error(`publication-path exclusion failed:\n${[...new Set(lines)].sort(byCodePoint).join("\n")}`);
}

process.stdout.write(
  `publication-path exclusion passed: ${workflows.length} workflow file(s)/${scannedLines} effective lines and ${manifestsScanned} tracked package manifest(s) carry no publish command, registry publication configuration, or publication credential\n`,
);

async function workflowFiles(root) {
  let entries;
  try {
    entries = await readdir(root, { withFileTypes: true, recursive: true });
  } catch {
    return [];
  }
  return entries
    .filter((entry) => entry.isFile() && /\.ya?ml$/i.test(entry.name))
    .map((entry) => resolve(entry.parentPath, entry.name))
    .sort(byCodePoint);
}

// Comments are stripped before matching so that documenting the exclusion does
// not violate it. This opens no bypass: a "#" outside a quoted scalar starts a
// YAML comment, and inside a `run:` block it starts a shell comment, so neither
// side of the cut can execute. Quoted "#" characters are preserved and scanned.
function withoutComment(line) {
  let quote = null;
  for (let index = 0; index < line.length; index += 1) {
    const character = line[index];
    if (quote) {
      if (character === quote) quote = null;
    } else if (isQuote(character)) {
      quote = character;
    } else if (startsComment(line, index)) {
      return line.slice(0, index);
    }
  }
  return line;
}

function isQuote(character) {
  if (character === "'") return true;
  return character === '"';
}

function startsComment(line, index) {
  if (line[index] !== "#") return false;
  if (index === 0) return true;
  return /\s/.test(line[index - 1]);
}
