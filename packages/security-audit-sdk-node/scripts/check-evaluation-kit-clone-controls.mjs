import assert from "node:assert/strict";
import { readFile, readlink, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { checkDestinationRefusal, checkDirtyTreeRefusal, checkDistributableKitMatch, checkExistingOutputRefusal } from "./check-evaluation-kit.mjs";
import { sha256Hex } from "./evaluation-kit-checksums.mjs";
import { KIT_PACKAGES, createKitTreeClone, runCloneBuilder } from "./evaluation-kit-source-copy.mjs";
import { runChecked } from "./verification-helpers.mjs";

const SOURCE_COPY_PATH = `${KIT_PACKAGES.node}/scripts/evaluation-kit-source-copy.mjs`;
const BUILD_EVALUATION_KIT_PATH = `${KIT_PACKAGES.node}/scripts/build-evaluation-kit.mjs`;
const LOCAL_ATTRIBUTES_PATH = ".git/info/attributes";
const LOCAL_CONFIG_PATH = ".git/config";
const CLONE_BUILDER_UMASK_PROBE = [
  'import process from "node:process";',
  'const umask = process.umask().toString(8);',
  'console.log("evaluation kit built successfully at " + umask);',
  'console.log("evaluation kit archive created at archive");',
  'console.log("kit digest: kit-digest");',
  'console.log("archive digest: archive-digest");',
].join("\n");

export const CLONE_PLANT_CONTROLS = Object.freeze([
  {
    label: "builder dropping a source path from distributable kits",
    identity: "distributable-kit-match",
    expectConditions: ["missing from the export of"],
    plant: (root, measurements) =>
      replaceMeasuredCloneFile(root, measurements, SOURCE_COPY_PATH, {
        anchor: 'runChecked("git", ["archive", "--format=tar", "-o", archive, commit, "--", ...KIT_SOURCE_PATHS], {',
        replacement:
          'const archivedPaths = (await listTrackedSources(repositoryRoot)).filter((path) => path !== "packages/security-audit-collector/README.md");\n' +
          '    runChecked("git", ["archive", "--format=tar", "-o", archive, commit, "--", ...archivedPaths], {',
      }),
    afterCommit: noCloneChange,
  },
  {
    label: "builder that creates the destination's directories before checking where they are",
    identity: "destination-refusal",
    expectConditions: ["destination-refusal: must create no directory at"],
    plant: (root, measurements) =>
      replaceMeasuredCloneFile(root, measurements, BUILD_EVALUATION_KIT_PATH, {
        anchor: "  await assertOutsideRepository(\n    nearestExistingDestinationPath,",
        replacement:
          "  await mkdir(kitDir, { recursive: true });\n" +
          "  await assertOutsideRepository(\n    nearestExistingDestinationPath,",
      }),
    afterCommit: noCloneChange,
  },
  {
    label: "builder that writes into an existing kit destination",
    identity: "existing-output-refusal",
    expectConditions: ["existing-output-refusal: an existing destination produced a distributable kit"],
    plant: (root, measurements) =>
      replaceMeasuredCloneFile(root, measurements, BUILD_EVALUATION_KIT_PATH, {
        anchor:
          "  await assertPathDoesNotExist(\n" +
          "    kitDir,\n" +
          "    `destination ${kitDir} already exists; choose a path that does not exist yet`,\n" +
          "  );\n",
        replacement: "",
      }),
    afterCommit: noCloneChange,
  },
  {
    label: "builder that overwrites an existing archive",
    identity: "existing-output-refusal",
    expectConditions: ["existing-output-refusal: an existing archive produced a distributable kit"],
    plant: (root, measurements) =>
      replaceMeasuredCloneFile(root, measurements, BUILD_EVALUATION_KIT_PATH, {
        anchor:
          "  if (distributable && createArchive) {\n" +
          "    const archivePath = kitArchivePath(kitDir, commit);\n" +
          "    await assertPathDoesNotExist(\n" +
          "      archivePath,\n" +
          "      `archive ${archivePath} already exists; move it, or choose a destination in another directory`,\n" +
          "    );\n" +
          "  }\n",
        replacement: "",
      }),
    afterCommit: noCloneChange,
  },
  {
    label: "builder that never reads the real tree state",
    identity: "dirty-tree-refusal",
    expectConditions: ["a dirty clone produced a distributable kit"],
    plant: (root, measurements) =>
      replaceMeasuredCloneFile(root, measurements, BUILD_EVALUATION_KIT_PATH, {
        anchor: 'const gitStatus = runChecked("git", ["status", "--porcelain"], { cwd: repositoryRoot, capture: true }).trim();',
        replacement: 'const gitStatus = "";',
      }),
    afterCommit: noCloneChange,
  },
  {
    label: "local attribute dropping a file from the distributable export",
    identity: "distributable-kit-match",
    expectConditions: ["missing from the export of", "docs/privacy.md"],
    plant: noCloneChange,
    afterCommit: (root, measurements) =>
      writeMeasuredCloneFile(
        root,
        measurements,
        LOCAL_ATTRIBUTES_PATH,
        "packages/security-audit-sdk-node/docs/privacy.md export-ignore\n",
      ),
  },
  {
    label: "local filter rewriting a document in the distributable export",
    identity: "distributable-kit-match",
    expectConditions: ["exported file differs from commit"],
    plant: noCloneChange,
    afterCommit: plantMeasuredCloneFilter,
  },
  {
    label: "local line-ending setting in the distributable export",
    identity: "distributable-kit-match",
    expectConditions: ["exported file differs from commit"],
    plant: noCloneChange,
    afterCommit: (root, measurements) =>
      setMeasuredCloneConfig(root, measurements, "core.autocrlf", "true"),
  },
  {
    label: "builder whose packed modes follow the umask",
    identity: "distributable-kit-match",
    expectConditions: ["distributable kit artifacts differ from the verification kit's"],
    plant: (root, measurements) =>
      replaceMeasuredCloneFile(root, measurements, BUILD_EVALUATION_KIT_PATH, {
        anchor: "  await normalizePackageModes(packageDir);",
        replacement: "",
      }),
    afterCommit: noCloneChange,
  },
  {
    label: "tracked symlink in the distributable export",
    identity: "distributable-kit-match",
    expectConditions: ["non-regular file in commit", "docs/planted-link.md"],
    plant: (root, measurements) =>
      writeMeasuredCloneSymlink(
        root,
        measurements,
        `${KIT_PACKAGES.node}/docs/planted-link.md`,
        "../../../../../../../../etc/hosts",
      ),
    afterCommit: noCloneChange,
  },
]);

export function createClonePlantControlRunners(helpers) {
  return CLONE_PLANT_CONTROLS.map((entry) => [
    entry.label,
    ({ kitDir, identity, _disabledChecks }) =>
      checkClonePlantedBuilderControl({
        entry,
        helpers,
        kitDir,
        identity,
        _disabledChecks,
      }),
  ]);
}

function noCloneChange() {
  // A clone-plant control that plants nothing at this stage of the clone's life.
}

async function readCloneFile(filePath) {
  try {
    return await readFile(filePath);
  } catch (error) {
    if (error.code === "ENOENT") return Buffer.from("");
    throw error;
  }
}

async function hashCloneFiles(root, paths) {
  const files = await Promise.all(paths.map((path) => readCloneFile(resolve(root, path))));
  return sha256Hex(Buffer.concat(files));
}

async function recordMeasuredCloneChange(root, measurements, paths, apply) {
  const before = await hashCloneFiles(root, paths);
  await apply();
  const after = await hashCloneFiles(root, paths);
  assert.notEqual(after, before, `the measured plant must change ${paths.join(" and ")}`);
  measurements.push({ path: paths.join(" and "), before, after });
}

async function writeMeasuredCloneFile(root, measurements, path, content) {
  return recordMeasuredCloneChange(root, measurements, [path], () =>
    writeFile(resolve(root, path), content, "utf8"),
  );
}

async function replaceMeasuredCloneFile(root, measurements, path, replacement) {
  const source = (await readCloneFile(resolve(root, path))).toString("utf8");
  const { anchor, replacement: replacementText } = replacement;
  assert.equal(
    source.split(anchor).length - 1,
    1,
    `clone plant anchor must occur exactly once in ${path}: ${anchor}`,
  );
  await writeMeasuredCloneFile(root, measurements, path, source.replace(anchor, replacementText));
}

async function setMeasuredCloneConfig(root, measurements, name, value) {
  return recordMeasuredCloneChange(root, measurements, [LOCAL_CONFIG_PATH], () =>
    runChecked("git", ["config", name, value], { cwd: root, capture: true }),
  );
}

async function plantMeasuredCloneFilter(root, measurements) {
  const paths = [LOCAL_ATTRIBUTES_PATH, LOCAL_CONFIG_PATH];
  return recordMeasuredCloneChange(root, measurements, paths, async () => {
    await writeFile(
      resolve(root, LOCAL_ATTRIBUTES_PATH),
      "packages/security-audit-sdk-node/docs/*.md filter=kit-gate-planted\n",
      "utf8",
    );
    runChecked(
      "git",
      ["config", "filter.kit-gate-planted.smudge", "sed -e '1s/^/planted: /'"],
      { cwd: root, capture: true },
    );
  });
}

async function writeMeasuredCloneSymlink(root, measurements, path, target) {
  const filePath = resolve(root, path);
  const before = sha256Hex(await readCloneFile(filePath));
  await symlink(target, filePath);
  const after = sha256Hex(await readlink(filePath));
  assert.notEqual(after, before, `the measured plant must change ${path}`);
  measurements.push({ path, before, after });
}

function runClonePlantedCheck(entry, cloneRoot, kitDir, identity) {
  if (entry.identity === "destination-refusal") {
    return checkDestinationRefusal({ cloneRoot });
  }
  if (entry.identity === "existing-output-refusal") {
    return checkExistingOutputRefusal({ cloneRoot });
  }
  if (entry.identity === "dirty-tree-refusal") {
    return checkDirtyTreeRefusal({ cloneRoot });
  }
  if (entry.identity === "distributable-kit-match") {
    return checkDistributableKitMatch({
      cloneRoot,
      verificationKitDir: kitDir,
      verificationIdentity: identity,
    });
  }
  assert.fail(`no clone-planted check for ${entry.identity}`);
}

function assertClonePlantConditions(control, failure, conditions) {
  for (const condition of conditions) {
    assert.ok(
      failure.cause.message.includes(condition),
      `${control.label} must report its specific condition "${condition}": ${failure.cause.message}`,
    );
  }
}

async function checkClonePlantedBuilderControl({
  entry,
  helpers,
  kitDir,
  identity,
  _disabledChecks = [],
}) {
  const { controlFor, captureDirectCheckFailure, completeControl } = helpers;
  const control = controlFor(entry.label);
  assert.equal(control.identity, entry.identity, `${control.label} must declare identity ${entry.identity}`);
  const measurements = [];
  const { cloneRoot, remove } = await createKitTreeClone({
    plant: (root) => entry.plant(root, measurements),
    afterCommit: (root) => entry.afterCommit(root, measurements),
  });
  try {
    const failure = await captureDirectCheckFailure(
      control,
      () => runClonePlantedCheck(entry, cloneRoot, kitDir, identity),
      _disabledChecks,
    );
    assertClonePlantConditions(control, failure, entry.expectConditions);
  } finally {
    await remove();
  }
  assert.equal(measurements.length, 1, `${control.label} must record one measured plant`);
  return completeControl(control, measurements);
}

export async function checkCloneUmaskProof() {
  const { cloneRoot, remove } = await createKitTreeClone({
    plant: (root) =>
      writeFile(
        resolve(root, KIT_PACKAGES.node, "scripts/build-evaluation-kit.mjs"),
        CLONE_BUILDER_UMASK_PROBE,
        "utf8",
      ),
  });
  try {
    const built = runCloneBuilder(cloneRoot, resolve(tmpdir(), "bloodtrail-ctrl-umask-probe"));
    assert.equal(built.kitDir, "77", "the clone builder must run under umask 077");
  } finally {
    await remove();
  }
  return "the clone builder ran under umask 077";
}
