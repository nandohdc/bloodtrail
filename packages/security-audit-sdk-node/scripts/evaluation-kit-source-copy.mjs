import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { assert, repositoryRoot, runChecked } from "./verification-helpers.mjs";

// The packages a kit packs, in build order: the Node binding compiles against the core's build output.
export const KIT_PACKAGES = Object.freeze({
  core: "packages/security-audit-sdk-core",
  node: "packages/security-audit-sdk-node",
  collector: "packages/security-audit-collector",
});

// Everything a kit build reads: the packed packages, the contract the core generates from, and the
// root README the kit copies.
const KIT_SOURCE_PATHS = Object.freeze([...Object.values(KIT_PACKAGES), "contracts/security-audit", "README.md"]);

// The paths the repository index tracks under KIT_SOURCE_PATHS, including uncommitted edits and files
// staged with intent to add. Tracked files deleted from the working tree are left out.
function listTrackedSources(fromRoot) {
  const listed = runChecked("git", ["ls-files", "-z", "--cached", "--", ...KIT_SOURCE_PATHS], {
    cwd: repositoryRoot,
    capture: true,
  });
  return listed.split("\0").filter((path) => path && existsSync(resolve(fromRoot, path)));
}

async function exportCommit(commit, toRoot) {
  const archiveDir = await mkdtemp(resolve(tmpdir(), "bloodtrail-kit-source-archive-"));
  try {
    const archive = resolve(archiveDir, "sources.tar");
    runChecked("git", ["archive", "--format=tar", "-o", archive, commit, "--", ...KIT_SOURCE_PATHS], {
      cwd: repositoryRoot,
      capture: true,
    });
    runChecked("tar", ["-xf", archive, "-C", toRoot], { capture: true });
  } finally {
    await rm(archiveDir, { recursive: true, force: true });
  }
}

/**
 * Copies the kit's sources into `toRoot`, which must exist. Only tracked files are copied, so build output,
 * ignored files and untracked files on disk never reach a kit.
 *
 * - With `commit`, the files come from that commit, as a distributable kit requires.
 * - Without it, they come from the working tree's tracked files, read from `fromRoot`, as a kit the gate
 *   builds requires. `fromRoot` defaults to the repository and is otherwise a copy of its tracked files.
 */
export async function copyTrackedSources({ toRoot, commit = null, fromRoot = repositoryRoot }) {
  if (commit) {
    await exportCommit(commit, toRoot);
    return;
  }
  const paths = listTrackedSources(fromRoot);
  assert(paths.length > 0, "no tracked kit sources found");
  for (const path of paths) {
    const target = resolve(toRoot, path);
    await mkdir(dirname(target), { recursive: true });
    await copyFile(resolve(fromRoot, path), target);
  }
}

// Files a build must never see: output an out-of-date build would leave behind, an untracked source file,
// which the package build would compile into its tarball, and an untracked document, which a kit that copies
// its documents wholesale would list in its checksum list. Any of them changes a digest the identity
// commits to.
const PLANTED_UNTRACKED_FILES = Object.freeze({
  "dist/index.js": 'export const staleBuildOutput = "planted by the evaluation kit gate";\n',
  "dist/stale-build-output.js": 'export const staleBuildOutput = "planted by the evaluation kit gate";\n',
  "src/untracked-source.ts": 'export const untrackedSource = "planted by the evaluation kit gate";\n',
  "docs/untracked-document.md": "# Planted by the evaluation kit gate\n",
});

async function plantUntrackedFiles(root) {
  for (const packageDir of Object.values(KIT_PACKAGES)) {
    for (const [path, content] of Object.entries(PLANTED_UNTRACKED_FILES)) {
      const target = resolve(root, packageDir, path);
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, content, "utf8");
    }
  }
}

function identityDigests(identity) {
  const artifacts = Array.isArray(identity.artifacts)
    ? identity.artifacts.map(({ filename, sha256 }) => `${sha256}  ${filename}`)
    : undefined;
  return {
    commit: identity.commit,
    distributable: identity.distributable,
    artifacts,
    package_set_digest: identity.package_set_digest,
    manifest_digest: identity.manifest_digest,
    kit_digest: identity.kitDigest,
  };
}

export function assertSameIdentityDigests(expected, actual, label) {
  const want = identityDigests(expected);
  const got = identityDigests(actual);
  for (const key of Object.keys(want)) {
    assert(want[key] !== undefined, `${label}: expected ${key} is missing`);
    assert(got[key] !== undefined, `${label}: rebuilt ${key} is missing`);
    assert(
      JSON.stringify(want[key]) === JSON.stringify(got[key]),
      `${label}: ${key} differs: expected ${JSON.stringify(want[key])}, got ${JSON.stringify(got[key])}`,
    );
  }
}

/**
 * Builds the same tree twice from a disposable copy of its tracked files, the second time after stale
 * output is planted in each package's ignored `dist/` and untracked files in its `src/` and `docs/`, and
 * asserts both builds have the same digests. `build(root)` returns a kit identity built from the sources under `root`.
 * The live tree is never written. Returns the first build's identity.
 */
export async function verifyStaleBuildOutputExcluded(build, { plant = plantUntrackedFiles } = {}) {
  const shadowRoot = await mkdtemp(resolve(tmpdir(), "bloodtrail-kit-stale-output-"));
  try {
    await copyTrackedSources({ toRoot: shadowRoot });
    const clean = await build(shadowRoot);
    await plant(shadowRoot);
    const planted = await build(shadowRoot);
    assertSameIdentityDigests(clean, planted, "untracked files on disk reached the kit");
    return clean;
  } finally {
    await rm(shadowRoot, { recursive: true, force: true });
  }
}
