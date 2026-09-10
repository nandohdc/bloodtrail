import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";
import {
  NAMED_REPOSITORY_DOCUMENTS,
  RECORDED_EXCLUSIONS,
  RECORDED_HISTORICAL_REFERENCES,
  assertContractVersionCurrency,
  currentContractVersion,
  recordedContractVersions,
  scannedFiles,
  supersededContractVersions,
} from "./check-contract-version-currency.mjs";

/**
 * Controls for the contract version currency assertion.
 *
 * Each failing arm is paired with the healthy input that must still pass, so an
 * arm cannot go vacuous unnoticed. The fixtures are whole disposable
 * repositories rather than injected strings, because the property under test is
 * about which files are reached, and a fixture that hands the checker its file
 * list would not test that.
 */

const CONTRACT_SOURCE = "contracts/security-audit/source/contract.source.json";
const VERSION_RECORD = "openspec/governance/schemas/contract-reuse.schema.json";

function write(root, relativePath, text) {
  const absolute = resolve(root, relativePath);
  mkdirSync(dirname(absolute), { recursive: true });
  writeFileSync(absolute, text);
}

/** A disposable repository with one declared package and every named document. */
function makeRepository(options = {}) {
  const root = mkdtempSync(join(tmpdir(), "contract-currency-"));
  const current = options.current ?? "1.1.0";
  const recorded = options.recorded ?? ["security-audit@1.0.0", "security-audit@1.1.0"];

  write(root, CONTRACT_SOURCE, JSON.stringify({ metadata: { schema_version: current } }));
  write(root, VERSION_RECORD, JSON.stringify({ records: { assessment: { fields: { contract: { enum: recorded } } } } }));
  for (const name of NAMED_REPOSITORY_DOCUMENTS) {
    if (options.omitDocument === name) continue;
    write(root, name, `# ${name}\n\nNothing version-shaped here.\n`);
  }
  write(root, "packages/alpha/package.json", JSON.stringify({ name: "alpha" }));
  write(root, "packages/alpha/README.md", "# alpha\n\nNothing version-shaped here.\n");
  return { root, declared: ["packages/alpha/package.json"] };
}

function run(repo, references = []) {
  return assertContractVersionCurrency(repo.root, references, repo.declared);
}

function cleanup(repo) {
  rmSync(repo.root, { recursive: true, force: true });
}

test("a healthy repository passes and reports what it checked", () => {
  const repo = makeRepository();
  try {
    const result = run(repo);
    assert.equal(result.current, "1.1.0");
    assert.deepEqual(result.superseded, ["1.0.0"]);
    assert.equal(result.occurrenceCount, 0);
    assert.ok(result.fileCount >= NAMED_REPOSITORY_DOCUMENTS.length);
  } finally {
    cleanup(repo);
  }
});

test("a superseded version in a package document fails, naming the file and line", () => {
  const repo = makeRepository();
  try {
    write(repo.root, "packages/alpha/README.md", "# alpha\n\nThe supported set is `1.0.0`.\n");
    assert.throws(() => run(repo), /contract-version-stale.*packages\/alpha\/README\.md:3/s);
  } finally {
    cleanup(repo);
  }
});

test("a superseded version in a package source comment fails", () => {
  const repo = makeRepository();
  try {
    write(repo.root, "packages/alpha/src/thing.ts", "// Contract 1.0.0 bounds are the ceiling.\nexport const a = 1;\n");
    assert.throws(() => run(repo), /contract-version-stale.*packages\/alpha\/src\/thing\.ts:1/s);
  } finally {
    cleanup(repo);
  }
});

test("a superseded version in a package decision record fails", () => {
  const repo = makeRepository();
  try {
    write(repo.root, "packages/alpha/adr/001-thing.md", "# ADR\n\nOnly version 1.0.0 namespaces are accepted.\n");
    assert.throws(() => run(repo), /contract-version-stale.*packages\/alpha\/adr\/001-thing\.md:3/s);
  } finally {
    cleanup(repo);
  }
});

test("a superseded version in a named repository document fails", () => {
  const repo = makeRepository();
  try {
    write(repo.root, "CLAUDE.md", "# CLAUDE\n\nThe canonical contract is frozen at `1.0.0`.\n");
    assert.throws(() => run(repo), /contract-version-stale.*CLAUDE\.md:3/s);
  } finally {
    cleanup(repo);
  }
});

test("a recorded exception with a quote passes, and the same line without it fails", () => {
  const repo = makeRepository();
  const line = "Unsupported versions, including `1.0.0`, fail safely.";
  try {
    write(repo.root, "packages/alpha/README.md", `# alpha\n\n${line}\n`);
    assert.doesNotThrow(() =>
      run(repo, [
        { path: "packages/alpha/README.md", quote: "Unsupported versions, including", reason: "names it as rejected" },
      ]),
    );
    assert.throws(() => run(repo, []), /contract-version-stale/);
  } finally {
    cleanup(repo);
  }
});

test("a quoted exception does not excuse a different line in the same file", () => {
  const repo = makeRepository();
  try {
    write(repo.root, "packages/alpha/README.md", "# alpha\n\nRejected: `1.0.0`.\n\nSupported set is `1.0.0`.\n");
    assert.throws(
      () => run(repo, [{ path: "packages/alpha/README.md", quote: "Rejected:", reason: "names it as rejected" }]),
      /contract-version-stale.*packages\/alpha\/README\.md:5/s,
    );
  } finally {
    cleanup(repo);
  }
});

test("a file-scope exception excuses every occurrence in that file only", () => {
  const repo = makeRepository();
  try {
    write(repo.root, "packages/alpha/MIGRATION.md", "# migration\n\nFrom `1.0.0`.\n\nAnd again `1.0.0`.\n");
    write(repo.root, "packages/alpha/README.md", "# alpha\n\nSupported set is `1.0.0`.\n");
    assert.throws(
      () => run(repo, [{ path: "packages/alpha/MIGRATION.md", reason: "a migration document is historical" }]),
      /contract-version-stale.*packages\/alpha\/README\.md/s,
    );
    write(repo.root, "packages/alpha/README.md", "# alpha\n\nNothing version-shaped here.\n");
    assert.doesNotThrow(() =>
      run(repo, [{ path: "packages/alpha/MIGRATION.md", reason: "a migration document is historical" }]),
    );
  } finally {
    cleanup(repo);
  }
});

test("a recorded exception that matches no occurrence fails, so the set cannot outlive its text", () => {
  const repo = makeRepository();
  try {
    assert.throws(
      () => run(repo, [{ path: "packages/alpha/README.md", quote: "gone now", reason: "stale" }]),
      /contract-version-exception-stale/,
    );
    write(repo.root, "packages/alpha/README.md", "# alpha\n\ngone now `1.0.0`.\n");
    assert.doesNotThrow(() => run(repo, [{ path: "packages/alpha/README.md", quote: "gone now", reason: "stale" }]));
  } finally {
    cleanup(repo);
  }
});

test("the current version absent from the version record fails", () => {
  const repo = makeRepository({ recorded: ["security-audit@1.0.0"] });
  try {
    assert.throws(() => run(repo), /contract-version-record-incomplete/);
  } finally {
    cleanup(repo);
  }
  const healthy = makeRepository();
  try {
    assert.doesNotThrow(() => run(healthy));
  } finally {
    cleanup(healthy);
  }
});

test("a named repository document that no longer exists fails", () => {
  const repo = makeRepository({ omitDocument: "RELEASING.md" });
  try {
    assert.throws(() => run(repo), /contract-version-document-absent.*RELEASING\.md/s);
  } finally {
    cleanup(repo);
  }
});

test("a newly declared package is covered with no further edit", () => {
  const repo = makeRepository();
  try {
    write(repo.root, "packages/beta/package.json", JSON.stringify({ name: "beta" }));
    write(repo.root, "packages/beta/README.md", "# beta\n\nSupported set is `1.0.0`.\n");
    assert.doesNotThrow(() => run(repo), "beta is invisible while undeclared");

    const declared = { ...repo, declared: [...repo.declared, "packages/beta/package.json"] };
    assert.throws(() => run(declared), /contract-version-stale.*packages\/beta\/README\.md/s);
  } finally {
    cleanup(repo);
  }
});

test("generated output inside a package's src is not scanned", () => {
  const repo = makeRepository();
  try {
    write(repo.root, "packages/alpha/src/generated/bounds.generated.ts", "// contract 1.0.0\nexport const a = 1;\n");
    assert.doesNotThrow(() => run(repo));
    const files = scannedFiles(repo.root, repo.declared);
    assert.ok(!files.some((path) => path.includes("/generated/")));
  } finally {
    cleanup(repo);
  }
});

test("every recorded exclusion carries a reason, and ratified specs are among them", () => {
  for (const entry of RECORDED_EXCLUSIONS) {
    assert.equal(typeof entry.reason, "string");
    assert.ok(entry.reason.length > 0, `${entry.prefix} has no reason`);
  }
  assert.ok(RECORDED_EXCLUSIONS.some((entry) => entry.prefix === "openspec/specs/"));
  assert.ok(RECORDED_EXCLUSIONS.some((entry) => entry.prefix === "contracts/"));
});

test("every recorded historical reference carries a reason", () => {
  for (const entry of RECORDED_HISTORICAL_REFERENCES) {
    assert.equal(typeof entry.path, "string");
    assert.equal(typeof entry.reason, "string");
    assert.ok(entry.reason.length > 0, `${entry.path} has no reason`);
  }
});

test("the real repository passes, and its versions are derived rather than restated", () => {
  const current = currentContractVersion();
  const recorded = recordedContractVersions();
  const superseded = supersededContractVersions(current, recorded);
  assert.ok(superseded.length > 0, "no superseded version to check against");

  const result = assertContractVersionCurrency();
  assert.equal(result.current, current);
  assert.ok(result.fileCount > NAMED_REPOSITORY_DOCUMENTS.length);
});
