/**
 * Disposable repositories for governance fixtures.
 *
 * Every fixture builds its own throwaway Git repository and mutates that. None
 * touches the live working tree — sibling test files run in parallel and snapshot
 * the same tree, so a write here would corrupt *other* test files rather than
 * only the one doing the writing. That failure mode is silent and confusing, and
 * it is the reason this module exists rather than a `chdir`.
 */

import { execFileSync } from "node:child_process";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const liveRepositoryRoot = resolve(here, "../../../..");
export const checkerPath = resolve(liveRepositoryRoot, "openspec/scripts/check-design-pattern-governance.mjs");
export const dualCheckPath = resolve(liveRepositoryRoot, "openspec/scripts/run-governance-dual-check.mjs");

/** Paths copied verbatim from the live repository into every fixture. */
const SEEDED_PATHS = Object.freeze([
  "openspec/governance",
  "openspec/scripts",
  "docs/design-pattern-governance.md",
  "CONTRIBUTING.md",
  ".github/PULL_REQUEST_TEMPLATE.md",
  ".github/workflows/ci.yml",
  "openspec/changes/establish-design-pattern-governance/assessment.json",
]);

export const ASSESSMENT = "openspec/changes/establish-design-pattern-governance/assessment.json";

const GIT_IDENTITY = Object.freeze([
  "-c", "user.name=Governance Fixture",
  "-c", "user.email=fixture@example.invalid",
  "-c", "commit.gpgsign=false",
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

  /** Reads, applies `mutate` to the parsed value, and writes it back. */
  mutateJson(relativePath, mutate) {
    const value = this.readJson(relativePath);
    const mutated = mutate(value);
    this.writeJson(relativePath, mutated === undefined ? value : mutated);
  }

  remove(relativePath) {
    rmSync(this.path(relativePath), { recursive: true, force: true });
  }

  git(args) {
    return execFileSync("git", [...GIT_IDENTITY, ...args], {
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

  branch(name) {
    this.git(["switch", "-c", name]);
  }

  checkout(name) {
    this.git(["switch", name]);
  }

  dispose() {
    rmSync(this.root, { recursive: true, force: true });
  }
}

/**
 * Builds a fixture repository whose governance artifacts are a copy of the live
 * ones, so a fixture starts from a state that genuinely passes. A fixture seeded
 * with hand-written stand-ins would prove only that the stand-ins are consistent.
 */
export function createRepository(options = {}) {
  const root = mkdtempSync(join(tmpdir(), "bloodtrail-governance-fixture-"));
  const repository = new DisposableRepository(root);

  for (const relativePath of SEEDED_PATHS) {
    const source = resolve(liveRepositoryRoot, relativePath);
    const destination = join(root, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    cpSync(source, destination, { recursive: true });
  }

  repository.write("README.md", "# Governance fixture\n");
  // The signed-record source the policy names. Fixtures seed an empty manifest
  // because the live one binds real commits that do not exist here; a fixture
  // with no signed records is the legitimate pre-signing technical state.
  repository.write("packages/security-audit-sdk-core/verification-lifecycle.json",
    `${JSON.stringify({ governanceRecords: [] }, null, 2)}\n`);
  if (options.seedChange === false) {
    // For fixtures that must start with no OpenSpec change at all, so the
    // association check sees a genuinely empty set rather than a deletion.
    rmSync(join(root, "openspec/changes"), { recursive: true, force: true });
  }
  repository.git(["-c", "init.defaultBranch=main", "init"]);
  const baseline = repository.commit("chore: seed governance fixture");

  if (options.recordBaseline !== false && options.seedChange !== false) {
    // Rebind the seeded evidence to the fixture's own history. Left pointing at
    // the live repository's commits, every fixture would fail for that reason
    // alone and no mutation below it would prove anything.
    repository.mutateJson("openspec/governance/design-pattern-policy.json", (policy) => {
      policy.grandfathering = [];
      return policy;
    });
    repository.mutateJson(ASSESSMENT, (assessment) => {
      assessment.ordering.proposal_baseline_commit = baseline;
      // Fixtures write throwaway implementation under packages/example/src/.
      // The seeded change has to own it, or every fixture would trip the
      // OpenSpec-association check instead of the relation it is testing.
      assessment.owned_paths = [...assessment.owned_paths, "packages/example/src/"];
      return assessment;
    });
    repository.commit("chore: scope fixture evidence to fixture history");
  }

  repository.baseline = baseline;
  return repository;
}

/** Runs a repository's *own* copy of the checker, so checker mutations take effect. */
export function localCheckerPath(repository) {
  return repository.path("openspec/scripts/check-design-pattern-governance.mjs");
}
