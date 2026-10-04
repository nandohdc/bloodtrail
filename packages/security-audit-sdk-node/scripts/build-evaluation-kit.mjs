import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  CHECKSUM_LIST_FILE,
  IDENTITY_FILE,
  KIT_DIGEST_FILE,
  readKitDigest,
  sha256Hex,
  verifyChecksumList,
  writeChecksumList,
  writeKitDigest,
} from "./evaluation-kit-checksums.mjs";
import { PNPM_SETTINGS_FILE, createPnpmSettings } from "./evaluation-kit-installers.mjs";
import { KIT_PACKAGES, assertOutsideRepository, copyTrackedSources } from "./evaluation-kit-source-copy.mjs";
// Re-exported under the same name so existing imports of the builder keep working, the controls' included.
export { assertOutsideRepository };
import { assert, byCodePoint, readJson, repositoryRoot, runChecked } from "./verification-helpers.mjs";

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

const IDENTITY_FORMAT_VERSION = 3;
const IDENTITY_FORMAT_THREE_KEYS = Object.freeze([
  "identity_format_version",
  "commit",
  "distributable",
  "artifacts",
  "package_set_digest",
  "manifest_digest",
]);

function assertIdentityFormat(identity) {
  assert(identity && typeof identity === "object" && !Array.isArray(identity), "identity.json must contain an object");
  if (identity.identity_format_version === undefined) {
    throw new Error("identity.json is a kit v1 identity and is refused");
  }
  if (identity.identity_format_version === 2) {
    throw new Error("identity.json declares format 2, which is refused");
  }
  assert(
    identity.identity_format_version === IDENTITY_FORMAT_VERSION,
    `identity.json must declare identity format ${IDENTITY_FORMAT_VERSION}, got ${identity.identity_format_version}`,
  );
}

function assertIdentityKeys(identity) {
  const actualKeys = Object.keys(identity).sort(byCodePoint);
  const expectedKeys = [...IDENTITY_FORMAT_THREE_KEYS].sort(byCodePoint);
  assert(
    JSON.stringify(actualKeys) === JSON.stringify(expectedKeys),
    `identity.json format 3 must contain exactly these keys: ${IDENTITY_FORMAT_THREE_KEYS.join(", ")}`,
  );
}

function assertArtifactRecord(artifact) {
  assert(artifact && typeof artifact === "object" && !Array.isArray(artifact), "identity.json artifact must contain an object");
  assert(typeof artifact.name === "string" && artifact.name.length > 0, "identity.json artifact must declare a name");
  assert(typeof artifact.filename === "string" && artifact.filename.length > 0, "identity.json artifact must declare a filename");
  assert(/^[0-9a-f]{64}$/i.test(artifact.sha256), `identity.json artifact ${artifact.filename} must declare a valid SHA-256`);
}

export function computePackageSetDigest(artifacts) {
  const sorted = [...artifacts].sort((a, b) => byCodePoint(a.filename, b.filename));
  return sha256Hex(sorted.map((a) => `${a.sha256}  ${a.filename}\n`).join(""));
}

// Every kit file other than the artifacts, whose names come from the package manifests.
export const REQUIRED_KIT_ITEMS = Object.freeze([
  IDENTITY_FILE,
  CHECKSUM_LIST_FILE,
  KIT_DIGEST_FILE,
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

  // Format refusal comes before any identity digest or checksum material is read.
  const identity = JSON.parse(await readFile(identityPath, "utf8"));
  assertIdentityFormat(identity);
  assertIdentityKeys(identity);

  assert(existsSync(manifestPath), `package.json missing in ${kitDir}`);
  for (const item of REQUIRED_KIT_ITEMS) {
    const itemPath = resolve(kitDir, item);
    assert(existsSync(itemPath), `Required kit item missing: ${item}`);
  }

  assert(typeof identity.commit === "string", "identity.json must contain commit SHA");
  assert(/^[0-9a-f]{40}$/i.test(identity.commit), "identity.json commit must be a valid 40-character SHA");
  assert(typeof identity.distributable === "boolean", "identity.json must declare distributable boolean");
  assert(Array.isArray(identity.artifacts), "identity.json must declare its artifacts");

  for (const artifact of identity.artifacts) {
    assertArtifactRecord(artifact);
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

  const checksumListDigest = await verifyChecksumList(kitDir);
  const kitDigest = await readKitDigest(kitDir);
  assert(kitDigest === checksumListDigest, `${KIT_DIGEST_FILE} must record the SHA-256 of ${CHECKSUM_LIST_FILE}`);

  return { verified: true, identity, kitDigest };
}

function resolveKitGitState(mode) {
  const gitStatus = runChecked("git", ["status", "--porcelain"], { cwd: repositoryRoot, capture: true }).trim();
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
 * Rewrites the checksum material over the identity already on disk. This keeps format-3's identity in the
 * checksum list while letting a caller reseal a deliberately rewritten identity without recreating it.
 */
export async function sealKitChecksumMaterial(kitDir) {
  await writeChecksumList(kitDir);
  return writeKitDigest(kitDir);
}

/**
 * Writes the identity, then seals the checksum list over every other kit file and its separately stored digest.
 * Call it after every other kit file is in place. Returns the identity.
 */
export async function sealKitIdentity(kitDir, { commit, distributable, artifacts }) {
  const identity = {
    identity_format_version: IDENTITY_FORMAT_VERSION,
    commit,
    distributable,
    artifacts,
    package_set_digest: computePackageSetDigest(artifacts),
    manifest_digest: sha256Hex(await readFile(resolve(kitDir, "package.json"))),
  };
  await writeFile(resolve(kitDir, IDENTITY_FILE), JSON.stringify(identity, null, 2) + "\n", "utf8");
  await sealKitChecksumMaterial(kitDir);
  return identity;
}

async function createKitArchive(kitDir, commit, makeArchive) {
  if (!makeArchive) return { archivePath: null, archiveDigest: null };
  const archivePath = resolve(dirname(kitDir), `bloodtrail-evaluation-kit-${commit.slice(0, 8)}.tar.gz`);
  runChecked("tar", ["-czf", archivePath, "-C", dirname(kitDir), basename(kitDir)]);
  return { archivePath, archiveDigest: sha256Hex(await readFile(archivePath)) };
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
} = {}) {
  await assertOutsideRepository(tmpdir());
  assert(mode !== "distributable" || sourceRoot === repositoryRoot, "a distributable kit is built from the identity commit only");

  const { commit, distributable } = resolveKitGitState(mode);

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
    const kitDigest = await readKitDigest(kitDir);
    const archive = await createKitArchive(kitDir, commit, distributable && createArchive);

    return { kitDir, ...archive, identity, kitDigest, tarballs, removeKit };
  } catch (err) {
    await removeKit();
    throw err;
  } finally {
    await rm(buildRoot, { recursive: true, force: true });
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
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
  process.stdout.write(`kit digest: ${result.kitDigest}\n`);
  if (result.archiveDigest) {
    process.stdout.write(`archive digest: ${result.archiveDigest}\n`);
  }
}
