import { lstat, readFile, readdir } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";
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

// The scanned surface, and the exact boundary of the claim this gate makes.
//
// A publication command can be reached indirectly: held in a manifest script and
// invoked with `npm run`, or held in a local action or repository script a
// workflow calls. Following those chains would require analysing shell
// call-graphs, and a regex that claimed to do that would be the kind of
// unenforceable assertion this gate exists to replace. So the gate enforces a
// stronger and decidable property instead: no tracked package manifest script,
// no file under the automation directory, and no local path a workflow
// references may *contain* publication capability, whether or not anything
// invokes it. Content a workflow references but the gate cannot read fails
// closed, because an exclusion cannot be established over what was not scanned.
//
// Documentation and lockfiles stay outside the surface, and manifests are read
// as structured data rather than as text, which is what keeps RELEASING.md and
// every package-lock.json from being false positives.
const AUTOMATION_ROOT = ".github";
const WORKFLOW_ROOT = `${AUTOMATION_ROOT}/workflows`;
// "#" starts a comment in YAML and in shell, so stripping it can hide nothing
// executable. No such guarantee holds for other file types, where lines are
// scanned verbatim.
const COMMENT_STRIPPED = /\.(?:ya?ml|sh|bash|zsh)$/i;
const LOCAL_REFERENCE = /\buses\s*:\s*(\.[^\s"']+)/;

const failures = [];
const localReferences = new Map();
let scannedLines = 0;

const workflows = await filesUnder(resolve(repositoryRoot, WORKFLOW_ROOT), /\.ya?ml$/i);
if (workflows.length === 0) {
  fail("publication-scan-empty", WORKFLOW_ROOT, "no workflow files were scanned; the publication-path exclusion cannot be established by scanning nothing");
}

// Tracked and on-disk are unioned deliberately: an untracked local action can
// still publish from a developer machine, and a tracked file deleted from the
// working tree still publishes for everyone who checks it out.
const trackedFiles = splitNull(git(["ls-files", "-z"]));
const automationFiles = union(
  (await filesUnder(resolve(repositoryRoot, AUTOMATION_ROOT))).map(toRepositoryPath),
  trackedFiles.filter((entry) => entry.startsWith(`${AUTOMATION_ROOT}/`)),
);
for (const path of automationFiles) await scanAutomationFile(path);

for (const reference of [...localReferences.keys()].sort(byCodePoint)) {
  await scanLocalReference(reference, localReferences.get(reference));
}

for (const path of trackedFiles.filter((entry) => entry === ".npmrc" || entry.endsWith("/.npmrc"))) {
  fail("publication-registry-config", path, "a tracked .npmrc is package-registry publication configuration: expected absent, found present");
}

let manifestsScanned = 0;
let scriptsScanned = 0;
for (const path of trackedFiles.filter((entry) => entry === "package.json" || entry.endsWith("/package.json"))) {
  manifestsScanned += 1;
  scanManifest(path, JSON.parse(await readFile(resolve(repositoryRoot, path), "utf8")));
}
if (manifestsScanned === 0) {
  fail("publication-scan-empty", "package.json", "no tracked package manifests were scanned; the publication-path exclusion cannot be established by scanning nothing");
}

if (failures.length > 0) {
  const lines = failures.map((failure) => `[${failure.id}] ${failure.file}: ${failure.message}`);
  throw new Error(`publication-path exclusion failed:\n${[...new Set(lines)].sort(byCodePoint).join("\n")}`);
}

process.stdout.write(
  `publication-path exclusion passed: ${workflows.length} workflow file(s)/${automationFiles.length} automation file(s)/${scannedLines} effective lines, ${localReferences.size} local automation reference(s), and ${manifestsScanned} private tracked package manifest(s)/${scriptsScanned} script(s) carry no publish command, registry publication configuration, or publication credential\n`,
);

function fail(id, file, message) {
  failures.push(boundedFailure(id, file, message));
}

function matchLine(line, location) {
  for (const [id, patterns, description] of CHECKS) {
    const pattern = patterns.find((candidate) => candidate.test(line));
    if (pattern) {
      fail(id, location, `${description} matched ${pattern}: expected no publication path, found ${line.trim()}`);
    }
  }
}

async function scanAutomationFile(relativePath) {
  let text;
  try {
    text = await readFile(resolve(repositoryRoot, relativePath), "utf8");
  } catch {
    fail("publication-unscannable-automation", relativePath, "automation content could not be read: expected a readable file, found none; the exclusion cannot be established over unscanned content");
    return;
  }
  const stripped = COMMENT_STRIPPED.test(relativePath);
  for (const [index, rawLine] of text.split("\n").entries()) {
    const line = stripped ? withoutComment(rawLine) : rawLine;
    if (line.trim() === "") continue;
    scannedLines += 1;
    matchLine(line, `${relativePath}:${index + 1}`);
    const reference = LOCAL_REFERENCE.exec(line)?.[1];
    if (reference && !localReferences.has(reference)) {
      localReferences.set(reference, `${relativePath}:${index + 1}`);
    }
  }
}

// A reference under the automation directory was already scanned above; one
// outside it is resolved and scanned here. Either way, an unresolvable
// reference is a failure rather than an absence of evidence.
async function scanLocalReference(reference, origin) {
  const absolute = resolve(repositoryRoot, reference);
  const contained = absolute === repositoryRoot || absolute.startsWith(`${repositoryRoot}${sep}`);
  if (!contained) {
    fail("publication-unscannable-automation", origin, `local reference ${reference} resolves outside the repository: expected a repository path, found an external one`);
    return;
  }
  const referenced = (await filesUnder(absolute)).map(toRepositoryPath);
  if (referenced.length === 0) {
    fail("publication-unscannable-automation", origin, `local reference ${reference} resolves to no readable file: expected scannable automation, found none`);
    return;
  }
  for (const path of referenced) {
    if (automationFiles.includes(path)) continue;
    await scanAutomationFile(path);
  }
}

function scanManifest(path, manifest) {
  if (manifest.private !== true) {
    fail("publication-publishable-manifest", path, `a tracked package manifest is a publishable workspace: expected private: true, found ${JSON.stringify(manifest.private) ?? "nothing"}`);
  }
  if (manifest.publishConfig !== undefined) {
    fail("publication-registry-config", path, "publishConfig is package-registry publication configuration: expected absent, found present");
  }
  for (const [name, body] of Object.entries(manifest.scripts ?? {})) {
    scriptsScanned += 1;
    matchLine(String(body), `${path}#scripts.${name}`);
  }
}

async function filesUnder(root, pattern) {
  let stat;
  try {
    stat = await lstat(root);
  } catch {
    return [];
  }
  if (stat.isFile()) return [root];
  if (!stat.isDirectory()) return [];
  const entries = await readdir(root, { withFileTypes: true, recursive: true });
  return entries
    .filter((entry) => entry.isFile() && (pattern === undefined || pattern.test(entry.name)))
    .map((entry) => resolve(entry.parentPath, entry.name))
    .sort(byCodePoint);
}

function union(left, right) {
  return [...new Set([...left, ...right])].sort(byCodePoint);
}

function toRepositoryPath(absolute) {
  return relative(repositoryRoot, absolute).replaceAll("\\", "/");
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
