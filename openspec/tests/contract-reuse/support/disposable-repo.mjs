/**
 * Disposable repositories for Contract Reuse Assessment checker fixtures.
 *
 * CRA checker tests use a local copy of their inputs and checker modules. They
 * never mutate the live repository or the shared design-pattern fixture helper:
 * both boundaries matter because the CRA checker itself exercises Git history.
 */

import { execFileSync, spawnSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const liveRepositoryRoot = resolve(here, "../../../..");
export const CHECKER = "openspec/scripts/contract-reuse/check.mjs";
export const CHANGE = "example-contract-change";
export const RECORD = `openspec/changes/${CHANGE}/contract-reuse.json`;
export const CHANGE_ROOT = `openspec/changes/${CHANGE}`;
export const MANIFEST = "packages/security-audit-sdk-core/verification-lifecycle.json";

const SEEDED_PATHS = Object.freeze([
  "contracts/security-audit/source/contract.source.json",
  "openspec/governance/schemas/contract-reuse.schema.json",
  "openspec/scripts/contract-reuse",
  "openspec/scripts/design-pattern-governance",
]);

// A fixture repository must never start Git's background maintenance because a detached repack
// could still be rewriting its .git while a test clones from it or removes it
// (#775, as #772 fixed for the sdk-core verification suite).
const GIT_FIXTURE_CONFIG = Object.freeze([
  "-c", "user.name=CRA Fixture",
  "-c", "user.email=cra-fixture@example.invalid",
  "-c", "commit.gpgsign=false",
  "-c", "maintenance.auto=false",
  "-c", "gc.auto=0",
]);

export class DisposableRepository {
  constructor(root) {
    this.root = root;
  }

  path(relativePath) {
    return join(this.root, relativePath);
  }

  read(relativePath) {
    return readFileSync(this.path(relativePath), "utf8");
  }

  readJson(relativePath) {
    return JSON.parse(this.read(relativePath));
  }

  write(relativePath, contents) {
    const absolute = this.path(relativePath);
    mkdirSync(dirname(absolute), { recursive: true });
    writeFileSync(absolute, contents, "utf8");
  }

  writeJson(relativePath, value) {
    this.write(relativePath, `${JSON.stringify(value, null, 2)}\n`);
  }

  mutateJson(relativePath, mutate) {
    const value = this.readJson(relativePath);
    const replacement = mutate(value);
    this.writeJson(relativePath, replacement === undefined ? value : replacement);
  }

  remove(relativePath) {
    rmSync(this.path(relativePath), { recursive: true, force: true });
  }

  git(args) {
    return execFileSync("git", [...GIT_FIXTURE_CONFIG, ...args], {
      cwd: this.root,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  commit(message) {
    this.git(["add", "-A"]);
    this.git(["commit", "--allow-empty", "-m", message]);
    return this.head();
  }

  head() {
    return this.git(["rev-parse", "HEAD"]).trim();
  }

  dispose() {
    rmSync(this.root, { recursive: true, force: true });
  }
}

export function createRepository(options = {}) {
  const root = mkdtempSync(join(tmpdir(), "bloodtrail-cra-fixture-"));
  const repository = new DisposableRepository(root);
  seedRepository(repository);
  seedActiveChange(repository, CHANGE, options.ownedPaths ?? ["contracts/"]);
  for (const extra of options.extraChanges ?? []) seedActiveChange(repository, extra.id, extra.ownedPaths);
  repository.writeJson(MANIFEST, { governanceRecords: [] });
  repository.write("README.md", "# Contract reuse fixture\n");
  repository.git(["-c", "init.defaultBranch=main", "init"]);
  repository.baseline = repository.commit("chore: seed CRA fixture");
  return repository;
}

function seedRepository(repository) {
  for (const relativePath of SEEDED_PATHS) {
    const source = resolve(liveRepositoryRoot, relativePath);
    const destination = repository.path(relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true });
  }
  seedSupportedContractBaseline(repository);
}

function seedSupportedContractBaseline(repository) {
  // These fixtures exercise CRA records for security-audit@2.1.0, the version the
  // checker currently supports. Pin the seeded baseline explicitly rather than
  // copying whatever the live source happens to say: a future governed version
  // move would otherwise silently retarget every fixture baseline, and the
  // fixtures would stop testing the version their records name.
  repository.mutateJson("contracts/security-audit/source/contract.source.json", (source) => ({
    ...source,
    metadata: { ...source.metadata, schema_version: "2.1.0" },
  }));
}

function seedActiveChange(repository, changeId, ownedPaths = []) {
  repository.writeJson(`openspec/changes/${changeId}/assessment.json`, {
    change_id: changeId,
    applicability: { capabilities: ["contract-reuse-assessment"] },
    owned_paths: ownedPaths,
  });
}

export function canonicalReuseRecord() {
  return JSON.parse(readFileSync(resolve(liveRepositoryRoot,
    "openspec/tests/contract-reuse/fixtures/canonical-reuse.json"), "utf8"));
}

export function canonicalExemptionRecord() {
  return JSON.parse(readFileSync(resolve(liveRepositoryRoot,
    "openspec/tests/contract-reuse/fixtures/canonical-exemption.json"), "utf8"));
}

export function writeReuseRecord(repository, mutate = (record) => record) {
  const record = canonicalReuseRecord();
  const replacement = mutate(record);
  repository.writeJson(RECORD, replacement === undefined ? record : replacement);
}

export function writeExemptionRecord(repository, mutate = (record) => record) {
  const record = canonicalExemptionRecord();
  record.governance_locator.change = CHANGE;
  const replacement = mutate(record);
  repository.writeJson(RECORD, replacement === undefined ? record : replacement);
}

export function addTrigger(repository, kind) {
  if (kind === "contract") {
    repository.write("contracts/fixture-contract-change.json", "{\"fixture\":true}\n");
    return;
  }
  if (kind === "generated") {
    repository.write("packages/security-audit-sdk-core/src/generated/fixture.generated.ts", "export const fixture = true;\n");
    return;
  }
  if (kind === "delta") {
    repository.write(`${CHANGE_ROOT}/specs/security-audit-event-contract/spec.md`, "## Fixture delta\n");
    return;
  }
  throw new Error(`unknown CRA trigger kind: ${kind}`);
}

export function runCraChecker(repository, options = {}) {
  const base = options.base ?? repository.baseline;
  const args = [
    repository.path(CHECKER),
    "--repo-root", repository.root,
    "--change", options.change ?? CHANGE,
    "--base", base,
    "--json",
  ];
  const run = spawnSync(process.execPath, args, { encoding: "utf8", cwd: repository.root });
  let report = null;
  try {
    report = JSON.parse(run.stdout);
  } catch {
    report = null;
  }
  return {
    status: run.status,
    stdout: run.stdout,
    stderr: run.stderr,
    report,
    ids: report?.failures?.map((failure) => failure.id) ?? [],
  };
}

export function signExemption(repository, mutate = (record) => record) {
  const technical = repository.head();
  const record = buildExemptionEvidence(repository, technical);
  const replacement = mutate(record);
  repository.mutateJson(MANIFEST, (manifest) => {
    manifest.governanceRecords.push(replacement === undefined ? record : replacement);
    return manifest;
  });
  const signed = repository.commit("docs: sign CRA exemption evidence");
  return { technical, signed, record: replacement === undefined ? record : replacement };
}

function buildExemptionEvidence(repository, technical) {
  const changeObject = repository.git(["rev-parse", `${technical}:${CHANGE_ROOT}`]).trim();
  return {
    change: CHANGE,
    reviewedCommit: technical,
    reviewedContent: {
      kind: "tree",
      candidateRoot: repository.git(["rev-parse", `${technical}^{tree}`]).trim(),
      entries: [{ path: CHANGE_ROOT, object: changeObject }],
    },
    authorizations: {
      granted: [`contract-reuse-exemption:${CHANGE}`],
      withheld: ["fixture-withheld"],
    },
    signed: true,
    reviewer: { name: "Fernando Homem da Costa (nandohdc)", signedAt: "2099-01-01" },
  };
}
