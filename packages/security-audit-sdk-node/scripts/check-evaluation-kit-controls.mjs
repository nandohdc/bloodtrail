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
  computePackageSetDigest,
  packDirectory,
  sealKitIdentity,
} from "./build-evaluation-kit.mjs";
import {
  FAILURE_PATHS_PROGRAM,
  checkEvaluationKit,
  installGatePrograms,
  typescriptLegs,
  writeConsumerTsconfig,
} from "./check-evaluation-kit.mjs";
import { CHECKSUM_LIST_FILE, IDENTITY_FILE, runChecksumListCheck, sha256Hex } from "./evaluation-kit-checksums.mjs";
import { ANSWER_KEY_PATH } from "./evaluation-kit-answer-key.mjs";
import { extractDocBlocksFromDir } from "./evaluation-kit-doc-blocks.mjs";
import {
  PNPM_RELEASES,
  PNPM_SETTINGS_FILE,
  supportedPnpmPhrase,
  verifyPnpmInstall,
} from "./evaluation-kit-installers.mjs";
import { KIT_PACKAGES, verifyStaleBuildOutputExcluded } from "./evaluation-kit-source-copy.mjs";
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
  "pnpm override only in the manifest's pnpm field (pnpm 11 and 12 legs)",
  "ignored pnpm setting reported (pnpm 11 and 12 legs)",
  "installer docs missing the supported pnpm majors",
  "builder packing the build output on disk (with a null control)",
  "document changed after the build",
  "evaluation guide integrity commands that are not shasum, name an unshipped file, print an unrecorded digest, or sit outside an sh block",
  "sink rewriting service.name between the SDK and the receiver",
  "receiver answering a duplicate with 400",
  "receiver rethrowing after replying",
  "mid-body stall mapped to malformed acknowledgment",
  "facilitator answer key content copied into the kit",
  "planted op.commit() in kit document",
]);

// A type-only defect: the program still runs and passes with a number id, so
// only the gate's type-check can catch it.
const FAILURE_PATHS_TYPE_ERROR = Object.freeze({ anchor: '"timeout-1"', replacement: "1" });

// pnpm 11 and later no longer read the manifest's `pnpm` field.
const [PNPM_READING_MANIFEST_FIELD, ...PNPM_IGNORING_MANIFEST_FIELD] = PNPM_RELEASES;

async function withKitCopy(kitDir, tempPrefix, run) {
  const kitCopy = await mkdtemp(resolve(tmpdir(), tempPrefix));
  try {
    await cp(kitDir, kitCopy, { recursive: true });
    await run(kitCopy);
  } finally {
    await rm(kitCopy, { recursive: true, force: true });
  }
}

async function captureFailure(run) {
  try {
    await run();
  } catch (err) {
    return err;
  }
  return null;
}

// Rewrites the checksum list and the identity over a kit copy's edited files, so the planted defect, not
// the identity check, is what the gate meets.
async function resealKit(kitCopy) {
  const { commit, distributable, artifacts } = JSON.parse(await readFile(resolve(kitCopy, IDENTITY_FILE), "utf8"));
  await sealKitIdentity(kitCopy, { commit, distributable, artifacts });
}

async function rewriteKitManifest(kitCopy, mutate) {
  const pkgPath = resolve(kitCopy, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
  mutate(pkg);
  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf8");
  await resealKit(kitCopy);
}

async function rewriteKitFile(kitCopy, path, rewrite) {
  const filePath = resolve(kitCopy, path);
  const text = await readFile(filePath, "utf8");
  const planted = rewrite(text);
  assert.notEqual(planted, text, `the planted defect must change ${path}`);
  await writeFile(filePath, planted, "utf8");
  await resealKit(kitCopy);
}

function copyNpmOverrideIntoPnpmField(pkg) {
  pkg.pnpm = { overrides: { ...pkg.overrides } };
}

async function assertPnpmLegFails(kitCopy, release, expectInMessage) {
  const failure = await captureFailure(() => verifyPnpmInstall(kitCopy, release));
  assert.ok(failure, `pnpm ${release} leg must fail closed`);
  assert.ok(failure.message.includes(`pnpm ${release}`), `pnpm ${release} leg failure must name its release: ${failure.message}`);
  assert.ok(failure.message.includes(expectInMessage), `pnpm ${release} leg must report "${expectInMessage}": ${failure.message}`);
}

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
  await withKitCopy(kitDir, "bloodtrail-ctrl-broken-override-", async (kitCopy) => {
    await rewriteKitManifest(kitCopy, (pkg) => {
      pkg.overrides["@bloodtrail/security-audit-sdk-core"] = "./nonexistent-core.tgz";
    });
    const failure = await captureFailure(() => checkEvaluationKit({ kitDir: kitCopy }));
    assert.ok(failure, "gate must fail closed when core override is broken");
  });
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
    await rewriteKitFile(tempBrokenDoc, "docs/quickstart.md", (text) => text.replace("timeoutMs: 5000,", "timeoutOption: 5000,"));

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

// The kit as built before the settings file: pnpm 10 still reads the manifest field,
// and pnpm 11 and 12 drop it and cannot resolve the core.
async function checkPnpmFieldOnlyOverrideControl(kitDir) {
  await withKitCopy(kitDir, "bloodtrail-ctrl-pnpm-field-only-", async (kitCopy) => {
    await rm(resolve(kitCopy, PNPM_SETTINGS_FILE));
    await rewriteKitManifest(kitCopy, copyNpmOverrideIntoPnpmField);
    await verifyPnpmInstall(kitCopy, PNPM_READING_MANIFEST_FIELD);
    for (const release of PNPM_IGNORING_MANIFEST_FIELD) {
      await assertPnpmLegFails(kitCopy, release, "no longer read");
    }
  });
  return "pnpm override only in the manifest's pnpm field (pnpm 11 and 12 legs)";
}

// With the settings file in place, pnpm 11 and 12 install successfully and only warn
// about the manifest field, so the gate's ignored-setting check is all that fails.
async function checkIgnoredPnpmSettingControl(kitDir) {
  const reported = "reported an ignored kit setting";
  await withKitCopy(kitDir, "bloodtrail-ctrl-ignored-pnpm-setting-", async (kitCopy) => {
    await rewriteKitManifest(kitCopy, copyNpmOverrideIntoPnpmField);
    const [firstIgnoring, ...laterIgnoring] = PNPM_IGNORING_MANIFEST_FIELD;
    const failure = await captureFailure(() => checkEvaluationKit({ kitDir: kitCopy }));
    assert.ok(failure, "gate must fail closed when an installer reports an ignored kit setting");
    assert.ok(
      failure.message.includes(`pnpm ${firstIgnoring} ${reported}`),
      `gate must fail on the pnpm ${firstIgnoring} leg's ignored setting: ${failure.message}`,
    );
    for (const release of laterIgnoring) {
      await assertPnpmLegFails(kitCopy, release, reported);
    }
  });
  return "ignored pnpm setting reported (pnpm 11 and 12 legs)";
}

async function checkInstallerDocsControl(kitDir) {
  await withKitCopy(kitDir, "bloodtrail-ctrl-installer-docs-", async (kitCopy) => {
    await rewriteKitFile(kitCopy, "docs/quickstart.md", (text) => text.replaceAll(supportedPnpmPhrase(), "pnpm (v10+)"));

    const failure = await captureFailure(() => checkEvaluationKit({ kitDir: kitCopy }));
    assert.ok(failure, "gate must fail closed when the quickstart does not name the supported pnpm majors");
    assert.ok(failure.message.includes("docs/quickstart.md"), `installer docs failure must name the quickstart: ${failure.message}`);
  });
  return "installer docs missing the supported pnpm majors";
}

// The builder before #653: it packs whatever build output is on disk under `root` and never rebuilds it.
async function packOnDiskBuildOutput(root) {
  const packDir = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-on-disk-pack-"));
  try {
    const artifacts = [];
    for (const [name, packageDir] of Object.entries(KIT_PACKAGES)) {
      const { filename, sha256 } = await packDirectory(resolve(root, packageDir), packDir);
      artifacts.push({ name, filename, sha256 });
    }
    const packageSetDigest = computePackageSetDigest(artifacts);
    return { artifacts, package_set_digest: packageSetDigest, manifest_digest: "", kit_digest: computeKitDigest(packageSetDigest, "", "") };
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
}

async function checkPackedBuildOutputControl() {
  // Null control: with nothing planted, the on-disk packer reproduces itself, so the planted output is
  // the only difference the check can see.
  await verifyStaleBuildOutputExcluded(packOnDiskBuildOutput, { plant: async () => {} });
  const failure = await captureFailure(() => verifyStaleBuildOutputExcluded(packOnDiskBuildOutput));
  assert.ok(failure, "a builder that packs the build output on disk must fail the stale-output check");
  assert.ok(
    failure.message.includes("untracked files on disk reached the kit"),
    `on-disk packing must fail the stale-output check itself: ${failure.message}`,
  );
  return "builder packing the build output on disk (with a null control)";
}

async function shasumCheckPasses(kitDir) {
  return !(await captureFailure(() => runChecksumListCheck(kitDir)));
}

// No reseal: the edit is the defect. `shasum -a 256 -c` passes on the copy before the edit and fails after it.
async function checkChangedDocumentControl(kitDir) {
  await withKitCopy(kitDir, "bloodtrail-ctrl-changed-document-", async (kitCopy) => {
    assert.ok(await shasumCheckPasses(kitCopy), "shasum -a 256 -c must pass on the kit as built");
    const privacyPath = resolve(kitCopy, "docs/privacy.md");
    await writeFile(privacyPath, `${await readFile(privacyPath, "utf8")}\nEdited after the build.\n`, "utf8");
    assert.ok(!(await shasumCheckPasses(kitCopy)), "shasum -a 256 -c must fail once a listed document changes");

    const failure = await captureFailure(() => checkEvaluationKit({ kitDir: kitCopy }));
    assert.ok(failure, "gate must fail closed when a document changes after the build");
    assert.ok(
      failure.message.includes("docs/privacy.md changed after the build"),
      `a changed document must fail the gate's identity check: ${failure.message}`,
    );
  });
  return "document changed after the build";
}

async function checkGuideIntegrityCommandControl(kitDir) {
  const documented = `shasum -a 256 -c ${CHECKSUM_LIST_FILE}`;
  const plants = [
    { plant: (text) => text.replace(documented, `cat ${IDENTITY_FILE}`), expect: "must use only shasum" },
    { plant: (text) => text.replace(documented, "shasum -a 256 kit-identity.json"), expect: "names a file the kit does not ship" },
    { plant: (text) => text.replace(documented, `shasum -a 256 ${IDENTITY_FILE}`), expect: "printed a digest the kit does not record" },
    { plant: (text) => text.replace("```sh", "```bash"), expect: "may hold only sh blocks" },
  ];
  for (const { plant, expect } of plants) {
    await withKitCopy(kitDir, "bloodtrail-ctrl-guide-command-", async (kitCopy) => {
      await rewriteKitFile(kitCopy, "docs/evaluation-guide.md", plant);
      const failure = await captureFailure(() => checkEvaluationKit({ kitDir: kitCopy }));
      assert.ok(failure, `gate must fail closed on a guide that should fail with "${expect}"`);
      assert.ok(failure.message.includes(expect), `the planted guide must fail with "${expect}": ${failure.message}`);
    });
  }
  return "evaluation guide integrity commands that are not shasum, name an unshipped file, print an unrecorded digest, or sit outside an sh block";
}

// A sink between the SDK and the receiver that rewrites one field. `service.name` is free text, so the
// rewritten event stays valid and the receiver accepts it: only the byte comparison can tell. Rewriting
// `correlation.retry_attempt` instead makes the receiver reject the event before any comparison runs.
async function checkRewritingSinkControl(kitDir) {
  await withKitCopy(kitDir, "bloodtrail-ctrl-rewriting-sink-", async (kitCopy) => {
    await rewriteKitFile(kitCopy, "examples/evaluation-service.ts", (text) =>
      text.replace(
        "      return sink.emit(event);",
        "      return sink.emit({ ...event, service: { ...event.service, name: \"rewritten-in-transit\" } });",
      ),
    );
    const failure = await captureFailure(() => checkEvaluationKit({ kitDir: kitCopy }));
    assert.ok(failure, "gate must fail closed when a sink rewrites a field between the SDK and the receiver");
    assert.ok(
      failure.message.includes("differ from the bytes the SDK validated"),
      `a rewritten field must fail the byte comparison: ${failure.message}`,
    );
  });
  return "sink rewriting service.name between the SDK and the receiver";
}

async function assertReceiverDefectFails(kitDir, { plant, expect, message }) {
  await withKitCopy(kitDir, "bloodtrail-ctrl-receiver-", async (kitCopy) => {
    await rewriteKitFile(kitCopy, "examples/evaluation-receiver.ts", plant);
    const failure = await captureFailure(() => checkEvaluationKit({ kitDir: kitCopy }));
    assert.ok(failure, message);
    assert.ok(failure.message.includes(expect), `${message}, with "${expect}": ${failure.message}`);
  });
}

async function checkDuplicateRejectedControl(kitDir) {
  await assertReceiverDefectFails(kitDir, {
    plant: (text) =>
      text.replace(
        "    console.log(`receiver:duplicate ${result.eventId}`);\n    return acknowledge(result.eventId);",
        '    return reject(state, 400, "duplicate");',
      ),
    expect: "a byte-identical duplicate: expected 2xx, got 400",
    message: "gate must fail closed when the receiver answers a duplicate with 400",
  });
  return "receiver answering a duplicate with 400";
}

// The receiver before #656: it replied, then rethrew out of the request handler, and the process died.
async function checkRethrowingReceiverControl(kitDir) {
  await assertReceiverDefectFails(kitDir, {
    plant: (text) =>
      text
        .replace(
          "      send(res, await handleSubmission(req, state));",
          '      send(res, await handleSubmission(req, state));\n      if (res.statusCode >= 400) throw new Error("rethrown after replying");',
        )
        .replace('    } catch {\n      console.log("receiver:error 500");', "    } catch (err) {\n      throw err;"),
    expect: "the receiver must keep serving",
    message: "gate must fail closed when the receiver rethrows after replying",
  });
  return "receiver rethrowing after replying";
}

async function rewriteKitTarball(kitCopy, packageName, fileInTarball, rewrite) {
  const identityPath = resolve(kitCopy, IDENTITY_FILE);
  const identity = JSON.parse(await readFile(identityPath, "utf8"));
  const artifact = identity.artifacts.find((a) => a.name === packageName);
  assert.ok(artifact, `artifact ${packageName} must exist in identity`);
  const tarballPath = resolve(kitCopy, artifact.filename);
  const extractDir = await mkdtemp(resolve(tmpdir(), `bloodtrail-ctrl-${packageName}-`));
  try {
    runChecked("tar", ["-xzf", tarballPath, "-C", extractDir]);
    const filePath = resolve(extractDir, "package", fileInTarball);
    const text = await readFile(filePath, "utf8");
    const mutated = rewrite(text);
    assert.notEqual(mutated, text, `the planted defect must change ${fileInTarball}`);
    await writeFile(filePath, mutated, "utf8");
    runChecked("tar", ["-czf", tarballPath, "-C", extractDir, "package"]);
    artifact.sha256 = sha256Hex(await readFile(tarballPath));
    const { commit, distributable, artifacts } = identity;
    await sealKitIdentity(kitCopy, { commit, distributable, artifacts });
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
}

async function checkMidBodyStallControl(kitDir) {
  await withKitCopy(kitDir, "bloodtrail-ctrl-mid-body-stall-", async (kitCopy) => {
    await rewriteKitTarball(kitCopy, "node", "dist/fetch-exchange.js", (text) =>
      text.replace(
        "        if (isTimeout(error))\n            throw error;\n",
        "",
      ),
    );
    const failure = await captureFailure(() => checkEvaluationKit({ kitDir: kitCopy }));
    assert.ok(failure, "gate must fail closed when mid-body stall maps to malformed acknowledgment");
    assert.ok(
      failure.message.includes("evaluation-kit-failure-paths.ts"),
      `mid-body stall defect must fail the gate's failure-path check: ${failure.message}`,
    );
  });
  return "mid-body stall mapped to malformed acknowledgment";
}

async function checkAnswerKeyInKitControl(kitDir) {
  const answerKeyText = await readFile(ANSWER_KEY_PATH, "utf8");
  await withKitCopy(kitDir, "bloodtrail-ctrl-answer-key-in-kit-", async (kitCopy) => {
    await rewriteKitFile(kitCopy, "docs/seeded-invalid-calls.md", (text) => `${text}\n\n${answerKeyText}`);
    const failure = await captureFailure(() => checkEvaluationKit({ kitDir: kitCopy }));
    assert.ok(failure, "gate must fail closed when facilitator answer key content is copied into the kit");
    assert.ok(
      failure.message.toLowerCase().includes("answer key"),
      `answer key in kit defect must fail the gate's answer key exclusion check: ${failure.message}`,
    );
  });
  return "facilitator answer key content copied into the kit";
}

async function checkPlantedOpCommitControl(kitDir) {
  await withKitCopy(kitDir, "bloodtrail-ctrl-planted-op-commit-", async (kitCopy) => {
    await rewriteKitFile(kitCopy, "docs/quickstart.md", (text) => `${text}\n\nCall \`op.commit()\` to commit.\n`);
    const failure = await captureFailure(() => checkEvaluationKit({ kitDir: kitCopy }));
    assert.ok(failure, "gate must fail closed when op.commit() is planted in a kit document");
    assert.ok(
      failure.message.includes("op.commit"),
      `planted op.commit() defect must fail the gate's doc references check: ${failure.message}`,
    );
  });
  return "planted op.commit() in kit document";
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
      await checkPnpmFieldOnlyOverrideControl(kitDir),
      await checkIgnoredPnpmSettingControl(kitDir),
      await checkInstallerDocsControl(kitDir),
      await checkPackedBuildOutputControl(),
      await checkChangedDocumentControl(kitDir),
      await checkGuideIntegrityCommandControl(kitDir),
      await checkRewritingSinkControl(kitDir),
      await checkDuplicateRejectedControl(kitDir),
      await checkRethrowingReceiverControl(kitDir),
      await checkMidBodyStallControl(kitDir),
      await checkAnswerKeyInKitControl(kitDir),
      await checkPlantedOpCommitControl(kitDir),
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
