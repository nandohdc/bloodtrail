#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { DECLARED_PACKAGES, repositoryRoot } from "./check-package-discovery.mjs";

/**
 * Asserts that no statement describing present behaviour names a superseded
 * canonical contract version.
 *
 * #95 moved the contract from `1.0.0` to `1.1.0` and eleven statements across
 * five workspaces and the repository documents went on describing the old one
 * (#453). One of them, the collector README's supported set, said the opposite
 * of what the collector's version stage admits.
 *
 * The rule that should have held this, `adr-contract` in
 * `packages/security-audit-sdk-core/scripts/check-coherence.mjs`, asserts that
 * ``contract `1.1.0` `` appears *somewhere across all ADRs concatenated*. It
 * checks presence, never absence, so one ADR naming the new version satisfies
 * it while another asserts the old one — and it is that package's own script,
 * so the Node binding, the collector and the repository documents are outside
 * its reach entirely.
 *
 * Neither version is restated here. The current one is read from the canonical
 * contract source; the superseded set is the contract-reuse schema's version
 * enum minus the current version, a record `CLAUDE.md` already requires to gain
 * each new version and keep the old ones.
 *
 * Whether an occurrence is a current-tense assertion or a historical record is
 * a human judgement recorded once, not a heuristic. `adr/008`'s "Only version
 * 1.0.0 … are typed and accepted" and `adr/010`'s "has no … contract `1.0.0`
 * compatibility impact" are grammatically indistinguishable and sit in the same
 * directory; every heuristic considered either missed one or flagged both.
 */

const CONTRACT_SOURCE = "contracts/security-audit/source/contract.source.json";
const CONTRACT_VERSION_RECORD = "openspec/governance/schemas/contract-reuse.schema.json";

/** Source extensions inside a package's `src/` that carry prose in comments. */
const SOURCE_EXTENSIONS = Object.freeze([".ts", ".mts", ".cts", ".mjs", ".cjs", ".js"]);

/**
 * Repository documents that are not part of any package. They cannot be derived
 * from `DECLARED_PACKAGES`, so they are named — and asserted to exist, so a
 * rename fails rather than silently checking one document fewer.
 */
export const NAMED_REPOSITORY_DOCUMENTS = Object.freeze([
  "README.md",
  "SECURITY.md",
  "CLAUDE.md",
  "AGENTS.md",
  ".hermes.md",
  "CONTRIBUTING.md",
  "RELEASING.md",
]);

/**
 * Trees deliberately outside the checked set. Each carries its reason, because
 * an unexplained absence is the omission this repository has recorded four
 * times (#412, #441 twice, #452).
 */
export const RECORDED_EXCLUSIONS = Object.freeze([
  {
    prefix: "openspec/specs/",
    reason:
      "ratified specification text states what was decided; correcting it is a governed spec delta, and the founding requirements are frozen byte-for-byte by check-coherence, so a gate demanding the correction would require the change the repository forbids",
  },
  {
    prefix: "contracts/",
    reason:
      "a protected prefix test:changed-paths refuses to write, and contracts/security-audit/adr/adr-001.md legitimately records 1.0.0 as the design basis at Contract Commit A",
  },
  {
    prefix: "openspec/changes/archive/",
    reason: "an archived change is a record of what was true when it was written",
  },
  {
    prefix: ".hermes/plans/",
    reason: "agent plans are records of what was true when they were written",
  },
]);

/**
 * Occurrences that are legitimate historical or policy references, each with the
 * reason it was left. This is #453's "say why each was left", recorded where a
 * gate can check it rather than in prose nobody re-reads.
 *
 * `quote` must appear on the matching line. An entry with no `quote` excuses the
 * whole file and must say why the whole file is historical.
 */
export const RECORDED_HISTORICAL_REFERENCES = Object.freeze([
  {
    path: "packages/security-audit-sdk-core/MIGRATION.md",
    reason:
      "a migration document is by construction a record of past transitions; every version literal in it describes a transition that already happened, including the 0.2.0 entry that tells callers to move from 1.0.0 to 1.1.0",
  },
  {
    path: "packages/security-audit-sdk-core/API.md",
    quote: "fail with `SDK_UNSUPPORTED_CONTRACT_VERSION`",
    reason: "names 1.0.0 as a rejected value, which is what the SDK does with it",
  },
  {
    path: "packages/security-audit-sdk-core/API.md",
    quote: "F-11 changes no public signature",
    reason: "states what was true of F-11 when it landed",
  },
  {
    path: "packages/security-audit-sdk-core/API.md",
    quote: "This runtime procedure does not replace lifecycle-appropriate",
    reason: "states what was true of the lifecycle repair when it landed",
  },
  {
    path: "packages/security-audit-sdk-core/README.md",
    quote: "Unsupported versions, including",
    reason: "names 1.0.0 as a rejected value, which is what the SDK does with it",
  },
  {
    path: "packages/security-audit-sdk-core/adr/007-transaction-operations.md",
    quote: "A same-instance event brand and `SDK_INVALID_REDELIVERY` are rejected",
    reason: "states what was true of the contract when the decision was taken",
  },
  {
    path: "packages/security-audit-sdk-core/adr/009-package-contract-compatibility.md",
    quote: "SDK package versions use `EXACT_ONE`",
    reason: "states the policy using the version in force when the decision was taken",
  },
  {
    path: "packages/security-audit-sdk-core/adr/009-package-contract-compatibility.md",
    quote: "Package patch releases may fix behavior",
    reason: "states the policy using the version in force when the decision was taken",
  },
  {
    path: "packages/security-audit-sdk-core/adr/010-canonical-verification-and-scope.md",
    quote: "This verification-only correction has no SDK runtime API",
    reason: "states what was true of that correction when it landed",
  },
  {
    path: "packages/security-audit-sdk-node/README.md",
    quote: "service: { id:",
    reason: "a service version in an example payload, unrelated to the canonical contract",
  },
  {
    path: "SECURITY.md",
    quote: "Once `1.0.0` ships",
    reason: "the SDK package's own future 1.0.0, not the canonical contract's",
  },
  {
    path: "RELEASING.md",
    quote: "the separate `security-audit-event-contract` governance process",
    reason:
      "the contract workspace's package.json version, which really is 1.0.0 and is deliberately independent of the canonical schema version",
  },
  {
    path: "RELEASING.md",
    quote: "would otherwise fall back to its default first version",
    reason: "Release Please's default first version, unrelated to the canonical contract",
  },
  {
    path: "RELEASING.md",
    quote: "Breaking change (post-1.0)",
    reason: "a semver illustration, unrelated to the canonical contract",
  },
  {
    path: "CLAUDE.md",
    quote: "places than `npm run generate` reaches",
    reason: "names the 1.0.0 to 1.1.0 move itself, which is a historical event",
  },
]);

function fail(diagnostics) {
  throw new Error(`contract version currency assertion failed:\n  ${diagnostics.join("\n  ")}`);
}

function readJson(relativePath, repoRoot) {
  const absolute = resolve(repoRoot, relativePath);
  if (!existsSync(absolute)) fail([`[contract-version-source-absent] ${relativePath} does not exist`]);
  return JSON.parse(readFileSync(absolute, "utf8"));
}

/** The current canonical version, from the single source of truth the generators read. */
export function currentContractVersion(repoRoot = repositoryRoot) {
  const version = readJson(CONTRACT_SOURCE, repoRoot)?.metadata?.schema_version;
  if (typeof version !== "string" || version.length === 0) {
    fail([`[contract-version-source-unreadable] ${CONTRACT_SOURCE} declares no metadata.schema_version`]);
  }
  return version;
}

/** Every contract version the repository records as having existed. */
export function recordedContractVersions(repoRoot = repositoryRoot) {
  const enumeration = readJson(CONTRACT_VERSION_RECORD, repoRoot)?.records?.assessment?.fields?.contract?.enum;
  if (!Array.isArray(enumeration) || enumeration.length === 0) {
    fail([`[contract-version-record-unreadable] ${CONTRACT_VERSION_RECORD} declares no contract enum`]);
  }
  return enumeration.map((entry) => String(entry).split("@").at(-1));
}

/**
 * The superseded set. A current version absent from the record fails: that is
 * the #426 shape — a version move that updates the contract and forgets the
 * record would otherwise leave this checking against an incomplete set.
 */
export function supersededContractVersions(current, recorded) {
  if (!recorded.includes(current)) {
    fail([
      `[contract-version-record-incomplete] current contract version ${current} is absent from ${CONTRACT_VERSION_RECORD}`,
    ]);
  }
  return recorded.filter((version) => version !== current);
}

function isExcluded(relativePath) {
  return RECORDED_EXCLUSIONS.some((entry) => relativePath.startsWith(entry.prefix));
}

function listSourceFiles(repoRoot, relativeDir, collected) {
  const absolute = resolve(repoRoot, relativeDir);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) return;
  for (const name of readdirSync(absolute).sort()) {
    const child = join(relativeDir, name);
    if (statSync(resolve(repoRoot, child)).isDirectory()) {
      if (name !== "generated") listSourceFiles(repoRoot, child, collected);
      continue;
    }
    if (SOURCE_EXTENSIONS.some((extension) => name.endsWith(extension))) collected.push(child);
  }
}

function listMarkdown(repoRoot, relativeDir) {
  const absolute = resolve(repoRoot, relativeDir);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory()) return [];
  return readdirSync(absolute)
    .sort()
    .filter((name) => name.endsWith(".md"))
    .map((name) => join(relativeDir, name))
    .filter((path) => statSync(resolve(repoRoot, path)).isFile());
}

/**
 * The checked set: every declared package's documents, decision records and
 * sources, derived from `DECLARED_PACKAGES` so a sixth package is covered
 * without being taught, plus the named repository documents.
 */
export function scannedFiles(repoRoot = repositoryRoot, declaredPackages = DECLARED_PACKAGES) {
  const files = [];
  for (const manifest of declaredPackages) {
    const packageRoot = manifest.replace(/\/package\.json$/, "");
    files.push(...listMarkdown(repoRoot, packageRoot));
    files.push(...listMarkdown(repoRoot, join(packageRoot, "adr")));
    listSourceFiles(repoRoot, join(packageRoot, "src"), files);
  }
  const missing = NAMED_REPOSITORY_DOCUMENTS.filter((name) => !existsSync(resolve(repoRoot, name)));
  if (missing.length > 0) {
    fail([`[contract-version-document-absent] named repository document(s) no longer exist: ${missing.join(", ")}`]);
  }
  files.push(...NAMED_REPOSITORY_DOCUMENTS);
  return files.filter((path) => !isExcluded(path));
}

function excusedBy(references, relativePath, line) {
  return references.find((entry) => {
    if (entry.path !== relativePath) return false;
    return entry.quote === undefined || line.includes(entry.quote);
  });
}

function occurrencesIn(text, relativePath, superseded) {
  const found = [];
  text.split("\n").forEach((line, index) => {
    const version = superseded.find((candidate) => line.includes(candidate));
    if (version !== undefined) found.push({ path: relativePath, line: index + 1, text: line, version });
  });
  return found;
}

function staleReferenceDiagnostics(references, used) {
  return references
    .filter((entry) => !used.has(entry))
    .map(
      (entry) =>
        `[contract-version-exception-stale] recorded exception matches no occurrence and can be removed: ${entry.path}${entry.quote === undefined ? "" : ` — ${entry.quote}`}`,
    );
}

/** Asserts currency across the checked set, failing closed in both directions. */
export function assertContractVersionCurrency(
  repoRoot = repositoryRoot,
  references = RECORDED_HISTORICAL_REFERENCES,
  declaredPackages = DECLARED_PACKAGES,
) {
  const current = currentContractVersion(repoRoot);
  const superseded = supersededContractVersions(current, recordedContractVersions(repoRoot));
  const files = scannedFiles(repoRoot, declaredPackages);
  const used = new Set();
  const failures = [];
  let occurrenceCount = 0;

  for (const relativePath of files) {
    for (const occurrence of occurrencesIn(readFileSync(resolve(repoRoot, relativePath), "utf8"), relativePath, superseded)) {
      occurrenceCount += 1;
      const excuse = excusedBy(references, occurrence.path, occurrence.text);
      if (excuse === undefined) {
        failures.push(
          `[contract-version-stale] ${occurrence.path}:${occurrence.line} names superseded contract version ${occurrence.version}, and is not a recorded historical reference`,
        );
        continue;
      }
      used.add(excuse);
    }
  }

  failures.push(...staleReferenceDiagnostics(references, used));
  if (failures.length > 0) fail(failures);

  return {
    current,
    superseded,
    fileCount: files.length,
    occurrenceCount,
    message: `Contract version currency passed: ${files.length} file(s) checked against current ${current}; ${occurrenceCount} recorded historical reference(s) to ${superseded.join(", ")}\n`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(assertContractVersionCurrency().message);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
