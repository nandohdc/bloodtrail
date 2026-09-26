import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { assert, packageRoot, repositoryRoot, runChecked } from "./verification-helpers.mjs";

const collectorRoot = resolve(repositoryRoot, "packages/security-audit-collector");
const coreRoot = resolve(repositoryRoot, "packages/security-audit-sdk-core");

export async function assertOutsideRepository(directory) {
  const path = relative(await realpath(repositoryRoot), await realpath(directory));
  const outside = path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path);
  assert(outside, `temporary directory ${directory} is inside the repository tree`);
}

async function buildCollectorCopy(tempRoot) {
  const copyRoot = resolve(tempRoot, "collector-build");
  await cp(collectorRoot, copyRoot, {
    recursive: true,
    filter: (source) => relative(collectorRoot, source).split(sep)[0] !== "node_modules",
  });
  runChecked("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"], { cwd: copyRoot, capture: true });
  runChecked("npm", ["run", "build"], { cwd: copyRoot, capture: true });
  return copyRoot;
}

export const PACK_DIRECTORIES = {
  core: async () => coreRoot,
  node: async () => packageRoot,
  collector: buildCollectorCopy,
};

export async function packTarball(name, destDir, tempRoot = destDir) {
  const packOut = JSON.parse(
    runChecked("npm", ["pack", "--json", "--pack-destination", destDir, "--ignore-scripts"], {
      cwd: await PACK_DIRECTORIES[name](tempRoot),
      capture: true,
    }),
  );
  const filename = (Array.isArray(packOut) ? packOut[0] : packOut).filename;
  const path = resolve(destDir, filename);
  const data = await readFile(path);
  const sha256 = createHash("sha256").update(data).digest("hex");
  return { name, filename, path, sha256 };
}

export function computePackageSetDigest(artifacts) {
  const sorted = [...artifacts].sort((a, b) => a.filename.localeCompare(b.filename));
  const lines = sorted.map((a) => `${a.sha256}  ${a.filename}\n`).join("");
  return createHash("sha256").update(lines, "utf8").digest("hex");
}

export function computeManifestDigest(manifestContent) {
  return createHash("sha256").update(manifestContent, "utf8").digest("hex");
}

export function computeKitDigest(packageSetDigest, manifestDigest) {
  return createHash("sha256").update(`${packageSetDigest}\n${manifestDigest}\n`, "utf8").digest("hex");
}

export async function verifyKitIdentity(kitDir) {
  const identityPath = resolve(kitDir, "identity.json");
  const manifestPath = resolve(kitDir, "package.json");
  assert(existsSync(identityPath), `identity.json missing in ${kitDir}`);
  assert(existsSync(manifestPath), `package.json missing in ${kitDir}`);

  const identity = JSON.parse(await readFile(identityPath, "utf8"));
  assert(identity.commit, "identity.json must contain commit SHA");
  assert(typeof identity.distributable === "boolean", "identity.json must declare distributable boolean");
  assert(Array.isArray(identity.artifacts) && identity.artifacts.length === 3, "identity.json must declare 3 artifacts");

  for (const artifact of identity.artifacts) {
    const artifactPath = resolve(kitDir, artifact.filename);
    assert(existsSync(artifactPath), `artifact file ${artifact.filename} missing in ${kitDir}`);
    const data = await readFile(artifactPath);
    const actualSha = createHash("sha256").update(data).digest("hex");
    assert(actualSha === artifact.sha256, `SHA-256 mismatch for ${artifact.filename}: expected ${artifact.sha256}, got ${actualSha}`);
  }

  const expectedPkgSetDigest = computePackageSetDigest(identity.artifacts);
  assert(identity.package_set_digest === expectedPkgSetDigest, `package_set_digest mismatch: expected ${expectedPkgSetDigest}, got ${identity.package_set_digest}`);

  const manifestContent = await readFile(manifestPath, "utf8");
  const expectedManifestDigest = computeManifestDigest(manifestContent);
  assert(identity.manifest_digest === expectedManifestDigest, `manifest_digest mismatch: expected ${expectedManifestDigest}, got ${identity.manifest_digest}`);

  const expectedKitDigest = computeKitDigest(identity.package_set_digest, identity.manifest_digest);
  assert(identity.kit_digest === expectedKitDigest, `kit_digest mismatch: expected ${expectedKitDigest}, got ${identity.kit_digest}`);

  return { verified: true, identity };
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

async function packKitArtifacts(kitDir, parentTemp) {
  const tarballs = {};
  const artifacts = [];
  for (const name of ["core", "node", "collector"]) {
    const art = await packTarball(name, kitDir, parentTemp);
    tarballs[name] = art;
    artifacts.push({ name: art.name, filename: art.filename, sha256: art.sha256 });
  }
  artifacts.sort((a, b) => a.filename.localeCompare(b.filename));
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
    pnpm: {
      overrides: {
        "@bloodtrail/security-audit-sdk-core": `./${tarballs.core.filename}`,
      },
    },
  };
}

async function copyKitAssets(kitDir) {
  const examplesSrc = resolve(packageRoot, "examples");
  if (existsSync(examplesSrc)) {
    await cp(examplesSrc, resolve(kitDir, "examples"), { recursive: true });
  }
  const docsSrc = resolve(packageRoot, "docs");
  if (existsSync(docsSrc)) {
    await cp(docsSrc, resolve(kitDir, "docs"), { recursive: true });
  }
  // Copy READMEs into kit docs so their code blocks are type-checked by the evaluation kit gate
  const nodeReadme = resolve(packageRoot, "README.md");
  if (existsSync(nodeReadme)) {
    await cp(nodeReadme, resolve(kitDir, "docs/node-readme.md"));
  }
  const coreReadme = resolve(coreRoot, "README.md");
  if (existsSync(coreReadme)) {
    await cp(coreReadme, resolve(kitDir, "docs/core-readme.md"));
  }
  const rootReadme = resolve(repositoryRoot, "README.md");
  if (existsSync(rootReadme)) {
    await cp(rootReadme, resolve(kitDir, "docs/root-readme.md"));
  }
}

async function writeKitIdentity(kitDir, { commit, distributable, artifacts, manifestContent }) {
  const packageSetDigest = computePackageSetDigest(artifacts);
  const manifestDigest = computeManifestDigest(manifestContent);
  const kitDigest = computeKitDigest(packageSetDigest, manifestDigest);

  const identity = {
    commit,
    distributable,
    artifacts,
    package_set_digest: packageSetDigest,
    manifest_digest: manifestDigest,
    kit_digest: kitDigest,
  };
  await writeFile(resolve(kitDir, "identity.json"), JSON.stringify(identity, null, 2) + "\n", "utf8");
  return identity;
}

function createKitArchive(kitDir, commit) {
  const archivePath = resolve(dirname(kitDir), `bloodtrail-evaluation-kit-${commit.slice(0, 8)}.tar.gz`);
  runChecked("tar", ["-czf", archivePath, "-C", dirname(kitDir), basename(kitDir)]);
  return archivePath;
}

export async function buildEvaluationKit({
  destDir = null,
  mode = "distributable",
  createArchive = true,
} = {}) {
  await assertOutsideRepository(tmpdir());

  const { commit, distributable } = resolveKitGitState(mode);

  const parentTemp = await mkdtemp(resolve(tmpdir(), "bloodtrail-kit-build-"));
  const kitDir = destDir ? resolve(destDir) : resolve(parentTemp, "evaluation-kit");
  const cleanupTarget = destDir ? kitDir : parentTemp;
  await assertOutsideRepository(dirname(kitDir));
  await mkdir(kitDir, { recursive: true });

  const removeKit = () => rm(cleanupTarget, { recursive: true, force: true });

  try {
    const { tarballs, artifacts } = await packKitArtifacts(kitDir, parentTemp);
    const manifest = createConsumerManifest(tarballs);
    const manifestContent = JSON.stringify(manifest, null, 2) + "\n";
    await writeFile(resolve(kitDir, "package.json"), manifestContent, "utf8");

    await copyKitAssets(kitDir);
    const identity = await writeKitIdentity(kitDir, { commit, distributable, artifacts, manifestContent });

    const archivePath = distributable && createArchive ? createKitArchive(kitDir, commit) : null;

    return { kitDir, archivePath, identity, tarballs, removeKit };
  } catch (err) {
    await removeKit();
    throw err;
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
