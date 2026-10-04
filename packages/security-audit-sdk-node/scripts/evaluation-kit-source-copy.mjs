import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { copyFile, mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, relative, resolve, sep } from "node:path";
import process from "node:process";
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

// Every path the repository index tracks under KIT_SOURCE_PATHS, including uncommitted edits and files
// staged with intent to add.
function trackedKitPaths() {
  const listed = runChecked("git", ["ls-files", "-z", "--cached", "--", ...KIT_SOURCE_PATHS], {
    cwd: repositoryRoot,
    capture: true,
  });
  return listed.split("\0").filter(Boolean);
}

// The tracked kit paths that exist on disk under `fromRoot`; files deleted from the working tree are left out.
function listTrackedSources(fromRoot) {
  return trackedKitPaths().filter((path) => existsSync(resolve(fromRoot, path)));
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

// Asserts `directory` lies outside the repository tree. Defined here because the builder, which imports
// this module, re-exports it under the same name; this module cannot import the builder back.
export async function assertOutsideRepository(directory) {
  const path = relative(await realpath(repositoryRoot), await realpath(directory));
  const outside = path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path);
  assert(outside, `temporary directory ${directory} is inside the repository tree`);
}

// Overlays the live working tree's tracked files under KIT_SOURCE_PATHS onto the clone at `cloneRoot`, so
// uncommitted edits become part of the tree under test. Files the working tree deleted are removed from the
// clone; untracked files are never copied.
async function overlayLiveTrackedSources(cloneRoot) {
  for (const path of trackedKitPaths()) {
    const target = resolve(cloneRoot, path);
    if (existsSync(resolve(repositoryRoot, path))) {
      await mkdir(dirname(target), { recursive: true });
      await copyFile(resolve(repositoryRoot, path), target);
    } else {
      await rm(target, { force: true });
    }
  }
}

// Commits whatever changed in the clone, if anything, under a fixed kit-gate identity with no hooks or
// signing, and returns the clone's HEAD commit. Environment identity overrides are cleared first, so an
// ambient GIT_AUTHOR_* or GIT_COMMITTER_* setting cannot leak into the tree under test.
function commitCloneChanges(cloneRoot) {
  const status = runChecked("git", ["status", "--porcelain"], { cwd: cloneRoot, capture: true }).trim();
  if (status) {
    runChecked("git", ["add", "-A"], { cwd: cloneRoot, capture: true });
    const commitEnv = { ...process.env };
    for (const key of ["GIT_AUTHOR_NAME", "GIT_AUTHOR_EMAIL", "GIT_COMMITTER_NAME", "GIT_COMMITTER_EMAIL"]) {
      delete commitEnv[key];
    }
    runChecked(
      "git",
      [
        "-c",
        "user.name=bloodtrail kit gate",
        "-c",
        "user.email=kit-gate@example.invalid",
        "-c",
        "commit.gpgsign=false",
        "commit",
        "--quiet",
        "--no-verify",
        "-m",
        "kit gate: tree under test",
      ],
      { cwd: cloneRoot, capture: true, env: commitEnv },
    );
  }
  return runChecked("git", ["rev-parse", "HEAD"], { cwd: cloneRoot, capture: true }).trim();
}

/**
 * Clones the repository into a fresh temporary directory outside the repository, overlays the live working
 * tree's tracked files under KIT_SOURCE_PATHS, runs the optional `plant(cloneRoot)` hook (a controls-only
 * JavaScript seam), and commits the result under a fixed kit-gate identity. The live repository is only
 * read. Returns the clone root, its HEAD commit, and a remover.
 */
export async function createKitTreeClone({ plant = null } = {}) {
  const cloneRoot = await mkdtemp(resolve(tmpdir(), "bloodtrail-kit-tree-clone-"));
  try {
    await assertOutsideRepository(cloneRoot);
    runChecked("git", ["clone", "--quiet", "--no-hardlinks", "--", repositoryRoot, cloneRoot], {
      capture: true,
    });
    await overlayLiveTrackedSources(cloneRoot);
    if (plant) {
      await plant(cloneRoot);
    }
    const headCommit = commitCloneChanges(cloneRoot);
    return { cloneRoot, headCommit, remove: () => rm(cloneRoot, { recursive: true, force: true }) };
  } catch (error) {
    await rm(cloneRoot, { recursive: true, force: true });
    throw error;
  }
}

// Parses the one builder output line that starts with `prefix` and returns the rest of the line.
function parseBuilderLine(output, prefix) {
  const lines = output.split("\n").filter((line) => line.startsWith(prefix));
  assert(lines.length === 1, `builder output must print exactly one ${prefix.trim()} line:\n${output}`);
  return lines[0].slice(prefix.length);
}

// True when spawnSync stopped the builder before it exited: either the timeout killed it or it died
// by a signal, both of which leave `status` null.
function cloneBuilderWasStopped(run) {
  return run.error?.code === "ETIMEDOUT" || (run.status === null && run.signal !== null);
}

/**
 * Runs the clone's own builder as a child process with the clone as its working directory, so the code
 * under test builds from the clone: the builder resolves `repositoryRoot` from its own script location,
 * which makes the clone its repository. Returns the kit directory, archive path, and digests the builder
 * printed. A nonzero exit throws with the captured output, which a dirty-tree refusal needs to name its
 * changed path.
 */
export function runCloneBuilder(cloneRoot, destDir) {
  const builderPath = resolve(cloneRoot, KIT_PACKAGES.node, "scripts/build-evaluation-kit.mjs");
  const run = spawnSync(process.execPath, [builderPath, "--distributable", "--dest", destDir], {
    cwd: cloneRoot,
    encoding: "utf8",
    timeout: 15 * 60 * 1000,
  });
  const output = `${run.stdout}${run.stderr}`;
  if (cloneBuilderWasStopped(run)) {
    const error = new Error(`clone builder was stopped by ${run.signal}, probably its 15-minute deadline:\n${output}`);
    error.output = output;
    throw error;
  }
  if (run.error) throw run.error;
  if (run.status !== 0) {
    const error = new Error(`clone builder failed with exit status ${String(run.status)}:\n${output}`);
    error.output = output;
    throw error;
  }
  return {
    kitDir: parseBuilderLine(output, "evaluation kit built successfully at "),
    archivePath: parseBuilderLine(output, "evaluation kit archive created at "),
    kitDigest: parseBuilderLine(output, "kit digest: "),
    archiveDigest: parseBuilderLine(output, "archive digest: "),
  };
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
