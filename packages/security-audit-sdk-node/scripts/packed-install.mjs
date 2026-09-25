// The pack-and-install harness (#580). It packs a chosen set of the core, the
// Node binding and the collector, and installs those tarballs into a fresh
// temporary directory outside the repository tree. The caller supplies the
// consumer manifest and the install command, and removes the directory with
// removeTemporaryDirectory(). A failed step removes it before rethrowing.

import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { isAbsolute, relative, resolve, sep } from "node:path";
import { assert, packageRoot, repositoryRoot, runChecked } from "./verification-helpers.mjs";

const collectorRoot = resolve(repositoryRoot, "packages/security-audit-collector");

// CI installs the collector's dependencies only after the Node binding validates, so the
// harness builds the collector in a temporary copy of its working tree. The copy installs its
// own dependencies and the build cleans its own outputs, so only node_modules is skipped.
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

// The directory each package is packed from.
const PACK_DIRECTORIES = {
  core: async () => resolve(repositoryRoot, "packages/security-audit-sdk-core"),
  node: async () => packageRoot,
  collector: buildCollectorCopy,
};

async function assertOutsideRepository(directory) {
  const path = relative(await realpath(repositoryRoot), await realpath(directory));
  const outside = path === ".." || path.startsWith(`..${sep}`) || isAbsolute(path);
  assert(outside, `temporary directory ${directory} is inside the repository tree`);
}

async function packTarball(name, tempRoot) {
  const packOut = JSON.parse(
    runChecked("npm", ["pack", "--json", "--pack-destination", tempRoot, "--ignore-scripts"], {
      cwd: await PACK_DIRECTORIES[name](tempRoot),
      capture: true,
    }),
  );
  const path = resolve(tempRoot, (Array.isArray(packOut) ? packOut[0] : packOut).filename);
  return { path, sha256: createHash("sha256").update(await readFile(path)).digest("hex") };
}

// packages names the tarballs to pack and install: "core", "node" or "collector".
// manifest(tarballs) returns the consumer's package.json, and installer(tarballs)
// returns the { command, args } that installs into it. Each tarball is { path, sha256 },
// and removeTemporaryDirectory() removes the tarballs with the installation.
export async function packedInstall({ packages, manifest, installer }) {
  const unknown = packages.filter((name) => !Object.hasOwn(PACK_DIRECTORIES, name));
  assert(unknown.length === 0, `cannot pack ${unknown.join(", ")}: expected core, node or collector`);
  await assertOutsideRepository(tmpdir());

  const tempRoot = await mkdtemp(resolve(tmpdir(), "bloodtrail-packed-install-"));
  const removeTemporaryDirectory = () => rm(tempRoot, { recursive: true, force: true });
  try {
    const tarballs = {};
    for (const name of packages) tarballs[name] = await packTarball(name, tempRoot);

    const installRoot = resolve(tempRoot, "consumer");
    await mkdir(installRoot);
    await writeFile(resolve(installRoot, "package.json"), JSON.stringify(manifest(tarballs)), "utf8");
    const { command, args } = installer(tarballs);
    runChecked(command, args, { cwd: installRoot, capture: true });
    return { installRoot, tarballs, removeTemporaryDirectory };
  } catch (error) {
    await removeTemporaryDirectory();
    throw error;
  }
}
