import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertOutsideRepository,
  buildEvaluationKit,
  computeKitDigest,
  computeManifestDigest,
} from "./build-evaluation-kit.mjs";
import {
  FAILURE_PATHS_PROGRAM,
  checkEvaluationKit,
  installGatePrograms,
  typescriptLegs,
  writeConsumerTsconfig,
} from "./check-evaluation-kit.mjs";
import { extractDocBlocksFromDir } from "./evaluation-kit-doc-blocks.mjs";
import { runChecked } from "./verification-helpers.mjs";

// Every planted defect the harness applies, in order. A control that did not
// run, or ran twice, fails the harness even when every gate run failed closed.
const EXPECTED_CONTROLS = Object.freeze([
  "missing core tarball",
  "wrong override",
  "tampered identity",
  "renamed doc option (across all TypeScript matrix legs)",
  "planted duplicate core",
  "missing kit item",
  "dirty tree build attempt",
  "failure-path program type error (across all TypeScript matrix legs)",
]);

// A type-only defect: the program still runs and passes with a number id, so
// only the gate's type-check can catch it.
const FAILURE_PATHS_TYPE_ERROR = Object.freeze({ anchor: '"timeout-1"', replacement: "1" });

async function assertGateFailsWithoutKitFile(kitDir, { tempPrefix, removedFile, message }) {
  const tempKit = await mkdtemp(resolve(tmpdir(), tempPrefix));
  try {
    await cp(kitDir, tempKit, { recursive: true });
    await rm(resolve(tempKit, removedFile));

    let failed = false;
    try {
      await checkEvaluationKit({ kitDir: tempKit });
    } catch {
      failed = true;
    }
    assert.ok(failed, message);
  } finally {
    await rm(tempKit, { recursive: true, force: true });
  }
}

async function checkMissingCoreControl(kitDir, identity) {
  const coreArtifact = identity.artifacts.find((a) => a.name === "core");
  await assertGateFailsWithoutKitFile(kitDir, {
    tempPrefix: "bloodtrail-ctrl-missing-core-",
    removedFile: coreArtifact.filename,
    message: "gate must fail closed when core tarball is missing",
  });
  return "missing core tarball";
}

async function checkBrokenOverrideControl(kitDir) {
  const tempBrokenOverride = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-broken-override-"));
  try {
    await cp(kitDir, tempBrokenOverride, { recursive: true });
    const pkgPath = resolve(tempBrokenOverride, "package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    pkg.overrides["@bloodtrail/security-audit-sdk-core"] = "./nonexistent-core.tgz";
    const newManifest = JSON.stringify(pkg, null, 2) + "\n";
    await writeFile(pkgPath, newManifest, "utf8");

    // Update identity so identity check passes and npm install failure is isolated
    const idPath = resolve(tempBrokenOverride, "identity.json");
    const id = JSON.parse(await readFile(idPath, "utf8"));
    id.manifest_digest = computeManifestDigest(newManifest);
    id.kit_digest = computeKitDigest(id.package_set_digest, id.manifest_digest);
    await writeFile(idPath, JSON.stringify(id, null, 2) + "\n", "utf8");

    let failed = false;
    try {
      await checkEvaluationKit({ kitDir: tempBrokenOverride });
    } catch {
      failed = true;
    }
    assert.ok(failed, "gate must fail closed when core override is broken");
  } finally {
    await rm(tempBrokenOverride, { recursive: true, force: true });
  }
  return "wrong override";
}

async function checkTamperedIdentityControl(kitDir) {
  const tempTamperedId = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-tampered-id-"));
  try {
    await cp(kitDir, tempTamperedId, { recursive: true });
    const idPath = resolve(tempTamperedId, "identity.json");
    const id = JSON.parse(await readFile(idPath, "utf8"));
    id.artifacts[0].sha256 = "0000000000000000000000000000000000000000000000000000000000000000";
    await writeFile(idPath, JSON.stringify(id, null, 2) + "\n", "utf8");

    let failed = false;
    try {
      await checkEvaluationKit({ kitDir: tempTamperedId });
    } catch {
      failed = true;
    }
    assert.ok(failed, "gate must fail closed when identity is tampered with");
  } finally {
    await rm(tempTamperedId, { recursive: true, force: true });
  }
  return "tampered identity";
}

async function verifyMatrixLegsFailClosed(kitCopy, { failurePathsProgram = FAILURE_PATHS_PROGRAM, expectInOutput }) {
  const brokenInstall = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-broken-install-"));
  try {
    await cp(kitCopy, brokenInstall, { recursive: true });
    runChecked("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline"], {
      cwd: brokenInstall,
      capture: true,
    });
    const docsDir = resolve(brokenInstall, "docs");
    const docBlocksDir = resolve(brokenInstall, "doc-blocks");
    await extractDocBlocksFromDir(docsDir, docBlocksDir);
    await installGatePrograms(brokenInstall, failurePathsProgram);

    const tsconfigPath = await writeConsumerTsconfig(brokenInstall);
    for (const leg of typescriptLegs(tsconfigPath)) {
      const res = spawnSync(leg.command, leg.args, { cwd: brokenInstall, encoding: "utf8" });
      assert.notEqual(res.status, 0, `TypeScript matrix leg ${leg.version} must fail closed on planted type error`);
      assert.ok(
        `${res.stdout}${res.stderr}`.includes(expectInOutput),
        `TypeScript matrix leg ${leg.version} must report the planted type error in ${expectInOutput}`,
      );
    }
  } finally {
    await rm(brokenInstall, { recursive: true, force: true });
  }
}

async function checkBrokenDocControl(kitDir) {
  const tempBrokenDoc = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-broken-doc-"));
  try {
    await cp(kitDir, tempBrokenDoc, { recursive: true });
    const quickstartPath = resolve(tempBrokenDoc, "docs/quickstart.md");
    const quickstartText = await readFile(quickstartPath, "utf8");
    const brokenQuickstart = quickstartText.replace("timeoutMs: 5000,", "timeoutOption: 5000,");
    assert.notEqual(brokenQuickstart, quickstartText, "renamed doc option must be planted in the quickstart");
    await writeFile(quickstartPath, brokenQuickstart, "utf8");

    let failed = false;
    try {
      await checkEvaluationKit({ kitDir: tempBrokenDoc });
    } catch {
      failed = true;
    }
    assert.ok(failed, "gate must fail closed when doc block uses renamed option");

    // Verify that every matrix leg fails individually on the planted type error
    await verifyMatrixLegsFailClosed(tempBrokenDoc, { expectInOutput: "quickstart-block-" });
  } finally {
    await rm(tempBrokenDoc, { recursive: true, force: true });
  }
  return "renamed doc option (across all TypeScript matrix legs)";
}

async function checkDuplicateCoreControl(kitDir) {
  const tempDuplicateCore = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-dup-core-"));
  try {
    await cp(kitDir, tempDuplicateCore, { recursive: true });
    let failed = false;
    let reportedDuplicateAuthority = false;
    try {
      await checkEvaluationKit({ kitDir: tempDuplicateCore, plantDuplicateCore: true });
    } catch (err) {
      failed = true;
      if (err.message?.includes("DUPLICATE_AUTHORITY")) {
        reportedDuplicateAuthority = true;
      }
    }
    assert.ok(failed, "gate must fail closed when duplicate core is planted");
    assert.ok(reportedDuplicateAuthority, "planted duplicate core must report DUPLICATE_AUTHORITY");
  } finally {
    await rm(tempDuplicateCore, { recursive: true, force: true });
  }
  return "planted duplicate core";
}

async function checkMissingItemControl(kitDir) {
  await assertGateFailsWithoutKitFile(kitDir, {
    tempPrefix: "bloodtrail-ctrl-missing-item-",
    removedFile: "docs/evaluation-guide.md",
    message: "gate must fail closed when a required kit item is missing",
  });
  return "missing kit item";
}

async function checkDirtyTreeControl() {
  let dirtyRefused = false;
  try {
    await buildEvaluationKit({ mode: "distributable", _gitStatus: " M dirty-file.ts\n" });
  } catch (err) {
    if (err.message?.includes("cannot build distributable evaluation kit from dirty git tree")) {
      dirtyRefused = true;
    }
  }
  assert.ok(dirtyRefused, "distributable build must refuse dirty git tree");
  return "dirty tree build attempt";
}

async function checkFailurePathTypeErrorControl(kitDir) {
  const tempProgramDir = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-failure-path-type-"));
  try {
    const { anchor, replacement } = FAILURE_PATHS_TYPE_ERROR;
    const source = await readFile(FAILURE_PATHS_PROGRAM, "utf8");
    assert.equal(source.split(anchor).length - 1, 1, `failure-path type error anchor ${anchor} must occur exactly once`);
    const plantedProgram = resolve(tempProgramDir, "evaluation-kit-failure-paths.ts");
    await writeFile(plantedProgram, source.replace(anchor, replacement), "utf8");

    let failure = null;
    try {
      await checkEvaluationKit({ kitDir, failurePathsProgram: plantedProgram });
    } catch (err) {
      failure = err;
    }
    assert.ok(failure, "gate must fail closed when the failure-path program has a type error");
    assert.ok(failure.message.includes("tsc -p"), `failure-path type error must fail the gate's type-check: ${failure.message}`);

    await verifyMatrixLegsFailClosed(kitDir, {
      failurePathsProgram: plantedProgram,
      expectInOutput: "evaluation-kit-failure-paths.ts",
    });
  } finally {
    await rm(tempProgramDir, { recursive: true, force: true });
  }
  return "failure-path program type error (across all TypeScript matrix legs)";
}

export async function checkEvaluationKitControls() {
  await assertOutsideRepository(tmpdir());

  // Build a base verification kit to derive controls from
  const { kitDir, identity, removeKit } = await buildEvaluationKit({ mode: "verification" });

  try {
    const applied = [];
    applied.push(
      await checkMissingCoreControl(kitDir, identity),
      await checkBrokenOverrideControl(kitDir),
      await checkTamperedIdentityControl(kitDir),
      await checkBrokenDocControl(kitDir),
      await checkDuplicateCoreControl(kitDir),
      await checkMissingItemControl(kitDir),
      await checkDirtyTreeControl(),
      await checkFailurePathTypeErrorControl(kitDir),
    );
    assert.deepEqual(applied, EXPECTED_CONTROLS, "control harness must apply every planted defect exactly once");

    process.stdout.write(
      `evaluation kit negative controls passed: ${applied.length} of ${EXPECTED_CONTROLS.length} planted defects applied, and each failed closed: ${applied.join(", ")}\n`,
    );
  } finally {
    await removeKit();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkEvaluationKitControls();
}
