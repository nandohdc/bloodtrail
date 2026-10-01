import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CHECKSUM_LIST_FILE,
  IDENTITY_FILE,
  sha256Hex,
  verifyChecksumList,
  writeChecksumList,
} from "./evaluation-kit-checksums.mjs";
import { PNPM_SETTINGS_FILE, createPnpmSettings } from "./evaluation-kit-installers.mjs";
import { KIT_PACKAGES, copyTrackedSources } from "./evaluation-kit-source-copy.mjs";
import { assert, byCodePoint, readJson, repositoryRoot, runChecked } from "./verification-helpers.mjs";

export async function assertOutsideRepository(directory) {
  const path = relative(await realpath(repositoryRoot), await realpath(directory));
  const outside = path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path);
  assert(outside, `temporary directory ${directory} is inside the repository tree`);
}

// npm's tarball name for a package manifest, so no package version is ever hard-coded here.
function artifactFilename(manifest) {
  return `${manifest.name.replace(/^@/, "").replaceAll("/", "-")}-${manifest.version}.tgz`;
}

async function readPackedManifest(tarballPath) {
  return JSON.parse(runChecked("tar", ["-xzOf", tarballPath, "package/package.json"], { capture: true }));
}

// Recomputes each artifact's file name from the manifest packed inside it, and checks that the identity
// declares exactly the kit's packages, in code-point order of file name.
async function verifyArtifactNames(kitDir, artifacts) {
  const names = artifacts.map((artifact) => artifact.name).sort(byCodePoint);
  const expectedNames = Object.keys(KIT_PACKAGES).sort(byCodePoint);
  assert(JSON.stringify(names) === JSON.stringify(expectedNames), `identity.json must declare one artifact per kit package: ${expectedNames.join(", ")}`);
  const filenames = artifacts.map((artifact) => artifact.filename);
  const ordered = [...filenames].sort(byCodePoint);
  assert(JSON.stringify(filenames) === JSON.stringify(ordered), `identity.json artifacts must be in code-point order: ${filenames.join(", ")}`);
  for (const { filename } of artifacts) {
    const manifest = await readPackedManifest(resolve(kitDir, filename));
    assert(filename === artifactFilename(manifest), `${filename} must be named after its packed manifest: ${artifactFilename(manifest)}`);
  }
}

function buildPackage(packageDir) {
  runChecked("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: packageDir, capture: true });
  runChecked("npm", ["run", "build"], { cwd: packageDir, capture: true });
}

// Packs whatever `packageDir` holds, exactly as it is on disk, into `destDir`.
export async function packDirectory(packageDir, destDir) {
  const packOut = JSON.parse(
    runChecked("npm", ["pack", "--json", "--pack-destination", destDir, "--ignore-scripts"], {
      cwd: packageDir,
      capture: true,
    }),
  );
  const filename = (Array.isArray(packOut) ? packOut[0] : packOut).filename;
  const path = resolve(destDir, filename);
  return { filename, path, sha256: sha256Hex(await readFile(path)) };
}

async function packArtifact(name, packageDir, destDir) {
  const manifest = await readJson(resolve(packageDir, "package.json"));
  assert(
    manifest.private === true && manifest.license === "UNLICENSED",
    `${manifest.name} must stay private and UNLICENSED`,
  );
  const packed = await packDirectory(packageDir, destDir);
  assert(packed.filename === artifactFilename(manifest), `npm packed ${packed.filename}, expected ${artifactFilename(manifest)}`);
  return { name, ...packed };
}

// Format 2 adds the checksum list, and its kit digest commits to that list. Kit v1 identities carry no
// format version, so a v1 kit digest is never compared with a v2 one.
const IDENTITY_FORMAT_VERSION = 2;

export function computePackageSetDigest(artifacts) {
  const sorted = [...artifacts].sort((a, b) => byCodePoint(a.filename, b.filename));
  return sha256Hex(sorted.map((a) => `${a.sha256}  ${a.filename}\n`).join(""));
}

export function computeKitDigest(packageSetDigest, manifestDigest, checksumListDigest) {
  return sha256Hex(`${packageSetDigest}\n${manifestDigest}\n${checksumListDigest}\n`);
}

// Every kit file other than the artifacts, whose names come from the package manifests.
export const REQUIRED_KIT_ITEMS = Object.freeze([
  IDENTITY_FILE,
  CHECKSUM_LIST_FILE,
  "package.json",
  PNPM_SETTINGS_FILE,
  "examples/evaluation-service.ts",
  "examples/evaluation-driver.ts",
  "examples/evaluation-receiver.ts",
  "examples/seeded-invalid-calls.ts",
  "docs/quickstart.md",
  "docs/error-catalog.md",
  "docs/wire-protocol.md",
  "docs/privacy.md",
  "docs/supported-and-planned.md",
  "docs/known-issues.md",
  "docs/evaluation-guide.md",
  "docs/evaluation-questionnaire.md",
  "docs/seeded-invalid-calls.md",
  "docs/integration-and-testing.md",
]);

export async function verifyKitIdentity(kitDir) {
  const identityPath = resolve(kitDir, IDENTITY_FILE);
  const manifestPath = resolve(kitDir, "package.json");
  assert(existsSync(identityPath), `identity.json missing in ${kitDir}`);
  assert(existsSync(manifestPath), `package.json missing in ${kitDir}`);

  for (const item of REQUIRED_KIT_ITEMS) {
    const itemPath = resolve(kitDir, item);
    assert(existsSync(itemPath), `Required kit item missing: ${item}`);
  }

  const identity = JSON.parse(await readFile(identityPath, "utf8"));
  assert(
    identity.identity_format_version === IDENTITY_FORMAT_VERSION,
    `identity.json must declare identity_format_version ${IDENTITY_FORMAT_VERSION}, got ${identity.identity_format_version}`,
  );
  assert(identity.commit, "identity.json must contain commit SHA");
  assert(/^[0-9a-f]{40}$/i.test(identity.commit), "identity.json commit must be a valid 40-character SHA");
  assert(typeof identity.distributable === "boolean", "identity.json must declare distributable boolean");
  assert(Array.isArray(identity.artifacts), "identity.json must declare its artifacts");

  for (const artifact of identity.artifacts) {
    const artifactPath = resolve(kitDir, artifact.filename);
    assert(existsSync(artifactPath), `artifact file ${artifact.filename} missing in ${kitDir}`);
    const actualSha = sha256Hex(await readFile(artifactPath));
    assert(actualSha === artifact.sha256, `SHA-256 mismatch for ${artifact.filename}: expected ${artifact.sha256}, got ${actualSha}`);
  }
  await verifyArtifactNames(kitDir, identity.artifacts);

  const expectedPkgSetDigest = computePackageSetDigest(identity.artifacts);
  assert(identity.package_set_digest === expectedPkgSetDigest, `package_set_digest mismatch: expected ${expectedPkgSetDigest}, got ${identity.package_set_digest}`);

  const expectedManifestDigest = sha256Hex(await readFile(manifestPath));
  assert(identity.manifest_digest === expectedManifestDigest, `manifest_digest mismatch: expected ${expectedManifestDigest}, got ${identity.manifest_digest}`);

  const checksumListDigest = await verifyRecordedChecksumList(kitDir, identity.checksum_list);

  const expectedKitDigest = computeKitDigest(identity.package_set_digest, identity.manifest_digest, checksumListDigest);
  assert(identity.kit_digest === expectedKitDigest, `kit_digest mismatch: expected ${expectedKitDigest}, got ${identity.kit_digest}`);

  return { verified: true, identity };
}

async function verifyRecordedChecksumList(kitDir, recorded) {
  const checksumListDigest = await verifyChecksumList(kitDir);
  const expected = { path: CHECKSUM_LIST_FILE, sha256: checksumListDigest };
  assert(
    JSON.stringify(recorded) === JSON.stringify(expected),
    `checksum_list mismatch: expected ${JSON.stringify(expected)}, got ${JSON.stringify(recorded)}`,
  );
  return checksumListDigest;
}

function resolveKitGitState(mode, _gitStatus = null) {
  const gitStatus = _gitStatus ?? runChecked("git", ["status", "--porcelain"], { cwd: repositoryRoot, capture: true }).trim();
  const isClean = gitStatus.length === 0;

  if (mode === "distributable" && !isClean) {
    throw new Error(`cannot build distributable evaluation kit from dirty git tree:\n${gitStatus}`);
  }

  const commit = runChecked("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, capture: true }).trim();
  const distributable = mode === "distributable" && isClean;
  return { commit, distributable };
}

// Builds and packs every kit package inside `buildRoot`, a copy of the tracked sources, in build order.
async function packKitArtifacts(kitDir, buildRoot) {
  const tarballs = {};
  const artifacts = [];
  for (const [name, packageDir] of Object.entries(KIT_PACKAGES)) {
    const builtPackageDir = resolve(buildRoot, packageDir);
    buildPackage(builtPackageDir);
    const packed = await packArtifact(name, builtPackageDir, kitDir);
    tarballs[name] = packed;
    artifacts.push({ name, filename: packed.filename, sha256: packed.sha256 });
  }
  artifacts.sort((a, b) => byCodePoint(a.filename, b.filename));
  return { tarballs, artifacts };
}

function createConsumerManifest(tarballs) {
  return {
    name: "bloodtrail-evaluation-consumer",
    version: "0.1.0",
    private: true,
    type: "module",
    dependencies: {
      "@bloodtrail/security-audit-sdk-core": `./${tarballs.core.filename}`,
      "@bloodtrail/security-audit-sdk-node": `./${tarballs.node.filename}`,
      "@bloodtrail/security-audit-collector": `./${tarballs.collector.filename}`,
    },
    overrides: {
      "@bloodtrail/security-audit-sdk-core": `./${tarballs.core.filename}`,
    },
  };
}

async function copyKitAssets(kitDir, buildRoot) {
  const nodeRoot = resolve(buildRoot, KIT_PACKAGES.node);
  const examplesSrc = resolve(nodeRoot, "examples");
  if (existsSync(examplesSrc)) {
    await cp(examplesSrc, resolve(kitDir, "examples"), { recursive: true });
  }
  const docsSrc = resolve(nodeRoot, "docs");
  if (existsSync(docsSrc)) {
    await cp(docsSrc, resolve(kitDir, "docs"), { recursive: true });
  }
  // Copy READMEs into kit docs so their code blocks are type-checked by the evaluation kit gate
  const nodeReadme = resolve(nodeRoot, "README.md");
  if (existsSync(nodeReadme)) {
    await cp(nodeReadme, resolve(kitDir, "docs/node-readme.md"));
  }
  const coreReadme = resolve(buildRoot, KIT_PACKAGES.core, "README.md");
  if (existsSync(coreReadme)) {
    await cp(coreReadme, resolve(kitDir, "docs/core-readme.md"));
  }
  const rootReadme = resolve(buildRoot, "README.md");
  if (existsSync(rootReadme)) {
    await cp(rootReadme, resolve(kitDir, "docs/root-readme.md"));
  }
}

/**
 * Writes the checksum list over every other kit file, then the identity, which commits to the list. Call it
 * after every other kit file is in place. Returns the identity.
 */
export async function sealKitIdentity(kitDir, { commit, distributable, artifacts }) {
  const packageSetDigest = computePackageSetDigest(artifacts);
  const manifestDigest = sha256Hex(await readFile(resolve(kitDir, "package.json")));
  const checksumListDigest = await writeChecksumList(kitDir);

  const identity = {
    identity_format_version: IDENTITY_FORMAT_VERSION,
    commit,
    distributable,
    artifacts,
    package_set_digest: packageSetDigest,
    manifest_digest: manifestDigest,
    checksum_list: { path: CHECKSUM_LIST_FILE, sha256: checksumListDigest },
    kit_digest: computeKitDigest(packageSetDigest, manifestDigest, checksumListDigest),
  };
  await writeFile(resolve(kitDir, IDENTITY_FILE), JSON.stringify(identity, null, 2) + "\n", "utf8");
  return identity;
}

function createKitArchive(kitDir, commit) {
  const archivePath = resolve(dirname(kitDir), `bloodtrail-evaluation-kit-${commit.slice(0, 8)}.tar.gz`);
  runChecked("tar", ["-czf", archivePath, "-C", dirname(kitDir), basename(kitDir)]);
  return archivePath;
}

/**
 * Builds a kit from a clean temporary copy of the tracked sources: at the identity commit for a
 * distributable kit, and from the working tree's tracked files otherwise. `sourceRoot` lets the gate
 * build a verification kit from a disposable copy of those files instead of the repository.
 */
export async function buildEvaluationKit({
  destDir = null,
  mode = "distributable",
  createArchive = true,
  sourceRoot = repositoryRoot,
  _gitStatus = null,
} = {}) {
  await assertOutsideRepository(tmpdir());
  assert(mode !== "distributable" || sourceRoot === repositoryRoot, "a distributable kit is built from the identity commit only");

  const { commit, distributable } = resolveKitGitState(mode, _gitStatus);

  const parentTemp = destDir ? null : await mkdtemp(resolve(tmpdir(), "bloodtrail-kit-build-"));
  const kitDir = destDir ? resolve(destDir) : resolve(parentTemp, "evaluation-kit");
  const cleanupTarget = parentTemp ?? kitDir;
  await assertOutsideRepository(dirname(kitDir));
  await mkdir(kitDir, { recursive: true });

  const removeKit = () => rm(cleanupTarget, { recursive: true, force: true });
  const buildRoot = await mkdtemp(resolve(tmpdir(), "bloodtrail-kit-sources-"));

  try {
    await copyTrackedSources({
      toRoot: buildRoot,
      commit: distributable ? commit : null,
      fromRoot: sourceRoot,
    });
    const { tarballs, artifacts } = await packKitArtifacts(kitDir, buildRoot);
    const manifest = createConsumerManifest(tarballs);
    const manifestContent = JSON.stringify(manifest, null, 2) + "\n";
    await writeFile(resolve(kitDir, "package.json"), manifestContent, "utf8");
    await writeFile(resolve(kitDir, PNPM_SETTINGS_FILE), createPnpmSettings(tarballs.core.filename), "utf8");

    await copyKitAssets(kitDir, buildRoot);
    const identity = await sealKitIdentity(kitDir, { commit, distributable, artifacts });

    const archivePath = distributable && createArchive ? createKitArchive(kitDir, commit) : null;

    return { kitDir, archivePath, identity, tarballs, removeKit };
  } catch (err) {
    await removeKit();
    throw err;
  } finally {
    await rm(buildRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let destDir = null;
  let mode = "distributable";
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--dest" && args[i + 1]) destDir = args[++i];
    else if (args[i] === "--verification") mode = "verification";
    else if (args[i] === "--distributable") mode = "distributable";
  }
  const result = await buildEvaluationKit({ destDir, mode });
  process.stdout.write(`evaluation kit built successfully at ${result.kitDir}\n`);
  if (result.archivePath) {
    process.stdout.write(`evaluation kit archive created at ${result.archivePath}\n`);
  }
  process.stdout.write(`identity kit_digest: ${result.identity.kit_digest}\n`);
}
