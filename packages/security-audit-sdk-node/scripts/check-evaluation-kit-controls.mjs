import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, realpath, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  assertOutsideRepository,
  buildEvaluationKit,
  computePackageSetDigest,
  packDirectory,
  sealKitChecksumMaterial,
  sealKitIdentity,
  verifyKitIdentity,
} from "./build-evaluation-kit.mjs";
import {
  FAILURE_PATHS_PROGRAM,
  KIT_DIR_NOTE,
  KIT_GATE_CHECK_IDENTITIES,
  checkEvaluationKit,
  composeVerificationSummary,
  runKitGateCheck,
  verifyBuiltKitIdentity,
  installGatePrograms,
  typescriptLegs,
  writeConsumerTsconfig,
} from "./check-evaluation-kit.mjs";
import { CHECKSUM_LIST_FILE, IDENTITY_FILE, KIT_DIGEST_FILE, runChecksumListCheck, runKitDigestCheck, sha256Hex, writeChecksumList } from "./evaluation-kit-checksums.mjs";
import { ANSWER_KEY_PATH } from "./evaluation-kit-answer-key.mjs";
import { extractDocBlocksFromDir } from "./evaluation-kit-doc-blocks.mjs";
import { verifyPnpmInstall } from "./evaluation-kit-installers.mjs";
import { KIT_PACKAGES, createKitTreeClone, verifyStaleBuildOutputExcluded } from "./evaluation-kit-source-copy.mjs";
import { CLONE_PLANT_CONTROLS, checkCloneUmaskProof, createClonePlantControlRunners } from "./check-evaluation-kit-clone-controls.mjs";
import { ANSWER_KEY_CONTROL_DEFINITIONS, createAnswerKeyControlRunners } from "./check-evaluation-kit-answer-key-controls.mjs";
import { DOCUMENT_CONTROL_DEFINITIONS, createDocumentControlRunners } from "./check-evaluation-kit-document-controls.mjs";
import { RECEIVER_CONTROL_DEFINITIONS, createReceiverControlRunners } from "./check-evaluation-kit-receiver-controls.mjs";
import { INSTALLER_CONTROL_DEFINITIONS, createInstallerControlRunners } from "./check-evaluation-kit-installer-controls.mjs";
import { byCodePoint, runChecked } from "./verification-helpers.mjs";

// Every planted-defect control declares the one check that must reject its measured plant. This remains the
// completeness list's source, so a missing, duplicate, or unknown control identity fails the harness early.
const CONTROL_DEFINITIONS = Object.freeze([
  { label: "missing core tarball", identity: "kit-identity" },
  { label: "wrong override", identity: "npm-installation" },
  { label: "tampered identity", identity: "kit-identity" },
  { label: "kit commit changed after the build", identity: "kit-identity" },
  { label: "kit distributable flag flipped after the build", identity: "kit-identity" },
  { label: "identity in format 2 or with no format version", identity: "kit-identity" },
  { label: "renamed doc option (across all TypeScript matrix legs)", identity: "kit-source-typecheck" },
  { label: "planted duplicate core", identity: "npm-single-core-copy" },
  { label: "missing kit item", identity: "kit-identity" },
  ...CLONE_PLANT_CONTROLS.map(({ label, identity }) => ({ label, identity })),
  { label: "failure-path program type error (across all TypeScript matrix legs)", identity: "kit-source-typecheck" },
  ...INSTALLER_CONTROL_DEFINITIONS,
  { label: "builder packing the build output on disk (with a null control)", identity: "reproducible-identity" },
  { label: "document changed after the build", identity: "kit-identity" },
  { label: "evaluation guide integrity commands that are not shasum, name an unshipped file, print an unrecorded digest, or sit outside an sh block", identity: "unpacked-kit-integrity" },
  { label: "sink rewriting service.name between the SDK and the receiver", identity: "loopback-example-exchange" },
  ...RECEIVER_CONTROL_DEFINITIONS,
  ...DOCUMENT_CONTROL_DEFINITIONS,
  { label: "mid-body stall mapped to malformed acknowledgment", identity: "http-audit-sink-failure-paths" },
  { label: "facilitator answer key content copied into the kit", identity: "answer-key-exclusion" },
  ...ANSWER_KEY_CONTROL_DEFINITIONS,
  { label: "invented API calls named in a kit document (op.commit(), handle.commit())", identity: "document-references" },
  { label: "retries listed as supported in the supported-versus-planned table", identity: "planned-feature-documentation" },
  { label: "429 classified as a permanent failure in the packed Node binding", identity: "http-audit-sink-failure-paths" },
  { label: "first-event example whose sink rejects the event", identity: "first-event-example" },
  { label: "seeded invalid call 1 given the actor it omits", identity: "seeded-invalid-calls" },
  { label: "createHttpAuditSink removed from the packed entry point's runtime exports", identity: "document-block-execution" },
]);

function validateControlDefinitions(definitions) {
  const labels = new Set();
  for (const control of definitions) {
    assert.ok(control.label, "every control must declare a label");
    assert.ok(!labels.has(control.label), `control declared twice: ${control.label}`);
    assert.ok(
      KIT_GATE_CHECK_IDENTITIES.includes(control.identity),
      `control ${control.label} declares an unknown kit gate identity: ${control.identity}`,
    );
    labels.add(control.label);
  }
}

validateControlDefinitions(CONTROL_DEFINITIONS);
const EXPECTED_CONTROLS = Object.freeze(CONTROL_DEFINITIONS.map(({ label }) => label));
const CONTROLS_BY_LABEL = new Map(CONTROL_DEFINITIONS.map((control) => [control.label, control]));

// What a run that builds its own kit claims about that build. A --kit-dir run builds and rebuilds nothing.
const REBUILD_CLAIMS = Object.freeze([
  "verification kit built from tracked sources",
  "verification-kit identity reproduced after stale build output and untracked sources were planted",
]);
const EXPECTED_BUILD_CHECK_IDENTITIES = Object.freeze([
  "verification-kit-build",
  "kit-identity",
  "answer-key-exclusion",
  "unpacked-kit-integrity",
  "installer-documentation",
  "planned-feature-documentation",
  "document-fence-languages",
  "reproducible-identity",
  "distributable-kit-match",
  "dirty-tree-refusal",
  "npm-installation",
  "document-references",
  "npm-single-core-copy",
  "kit-source-typecheck",
  "document-block-execution",
  "facilitator-answer-key-fix-typecheck",
  "first-event-example",
  "loopback-example-exchange",
  "seeded-invalid-calls",
  "http-audit-sink-failure-paths",
  "pnpm-installations",
]);
const EXPECTED_KIT_DIR_CHECK_IDENTITIES = Object.freeze([
  "kit-identity",
  "answer-key-exclusion",
  "unpacked-kit-integrity",
  "installer-documentation",
  "planned-feature-documentation",
  "document-fence-languages",
  "npm-installation",
  "document-references",
  "npm-single-core-copy",
  "kit-source-typecheck",
  "document-block-execution",
  "facilitator-answer-key-fix-typecheck",
  "first-event-example",
  "loopback-example-exchange",
  "seeded-invalid-calls",
  "http-audit-sink-failure-paths",
  "pnpm-installations",
]);
const REVISED_INSTALLER_CLAUSES = Object.freeze([
  {
    identity: "npm-installation",
    clause: "kit installed outside any workspace with npm, and no setting the kit ships reported as unknown, ignored or no longer read",
  },
  {
    identity: "pnpm-installations",
    clause: "kit installed outside any workspace with pnpm 10.17.0, 11.28.2, 12.8.1, with no setting the kit ships reported as unknown, ignored or no longer read, a passing first-event example, and one core copy per installation",
  },
]);
const VERIFICATION_SUMMARY_PREFIX = "evaluation kit verification passed: ";
const LOOPBACK_EXAMPLE_EXCHANGE_CLAUSE = "loopback examples verified: the bytes the receiver received equal the bytes the SDK handed to the HTTP audit sink, and the receiver answered 401, 413, 400, 422 and 409, the 422 to an event that passed the ingress's structural check but failed SDK validation, acknowledged the corrected event with the SDK-invalid event's identity, a byte-identical duplicate and a redelivered event, and kept serving after each; it required the Bearer scheme in any letter case, answered 404 to a POST on another path and 405 with Allow: POST to another method, and counted a client abort as neither a 500 nor a rejection; after answering 401, 404 and 413 to a body past its bound it closed the connection, accepting no more than the socket buffers hold";
const DISTRIBUTABLE_KIT_UMASK_CLAUSE = "distributable kit built under umask 077 from a disposable clean clone of the tree under test, with the same artifacts and checksum list as the verification kit apart from its identity file";
const SCRIPT_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const NON_REGULAR_SOURCE_PATH = `${KIT_PACKAGES.node}/docs/planted-link.md`;
const NON_REGULAR_KIT_PATH = "docs/planted-link.md";

// A type-only defect: the program still runs and passes with a number id, so
// only the gate's type-check can catch it.
const FAILURE_PATHS_TYPE_ERROR = Object.freeze({ anchor: '"timeout-1"', replacement: "1" });


async function withKitCopy(kitDir, tempPrefix, run) {
  const kitCopy = await mkdtemp(resolve(tmpdir(), tempPrefix));
  try {
    await cp(kitDir, kitCopy, { recursive: true });
    await run(kitCopy);
  } finally {
    await rm(kitCopy, { recursive: true, force: true });
  }
}

async function withExternalScriptSymlink(scriptName, run) {
  const linkDirectory = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-script-symlink-"));
  const linkPath = resolve(linkDirectory, scriptName);
  try {
    await symlink(resolve(SCRIPT_DIRECTORY, scriptName), linkPath);
    return await run(linkPath);
  } finally {
    await rm(linkDirectory, { recursive: true, force: true });
  }
}

function clauseForCheck(check) {
  const summary = composeVerificationSummary([check]);
  assert.ok(summary.startsWith(VERIFICATION_SUMMARY_PREFIX), `verification summary must start with ${VERIFICATION_SUMMARY_PREFIX}`);
  return summary.slice(VERIFICATION_SUMMARY_PREFIX.length, -1);
}

async function captureFailure(run) {
  try {
    await run();
  } catch (err) {
    return err;
  }
  return null;
}

function controlFor(label) {
  const control = CONTROLS_BY_LABEL.get(label);
  assert.ok(control, `control must be declared: ${label}`);
  return control;
}

function completeControl(control, measurements) {
  assert.ok(measurements.length > 0, `${control.label} must record a measured plant`);
  return { label: control.label, identity: control.identity, measuredPlants: measurements.length };
}

function assertTaggedFailure(control, failure) {
  assert.ok(failure, `${control.label} must fail closed`);
  assert.equal(
    failure.checkIdentity,
    control.identity,
    `${control.label} must fail at ${control.identity}, got ${failure.checkIdentity ?? "an untagged failure"}`,
  );
  return failure;
}

async function captureGateFailure(control, kitDir, options = {}) {
  const failure = await captureFailure(() => checkEvaluationKit({ kitDir, ...options }));
  return assertTaggedFailure(control, failure);
}

async function captureDirectCheckFailure(control, run, _disabledChecks = []) {
  const failure = await captureFailure(() => runKitGateCheck({ identity: control.identity, _disabledChecks, run }));
  return assertTaggedFailure(control, failure);
}

async function measureFilePlant(kitCopy, path, rewrite) {
  const filePath = resolve(kitCopy, path);
  const before = sha256Hex(await readFile(filePath));
  const original = await readFile(filePath, "utf8");
  const planted = rewrite(original);
  await writeFile(filePath, planted, "utf8");
  const after = sha256Hex(await readFile(filePath));
  assert.notEqual(after, before, `the measured plant must change ${path}`);
  return { path, before, after };
}

async function removeMeasuredKitFile(kitCopy, path) {
  const filePath = resolve(kitCopy, path);
  const before = sha256Hex(await readFile(filePath));
  await rm(filePath);
  const after = await captureFailure(() => readFile(filePath));
  assert.ok(after, `the measured plant must remove ${path}`);
  return { path, before, after: null };
}

async function applyMeasuredPlant(measurements, apply) {
  const measurement = await apply();
  assert.notEqual(measurement.before, measurement.after, `the measured plant must change ${measurement.path}`);
  measurements.push(measurement);
  return measurement;
}

// A plant context pairs a disposable kit copy with the list that records what each plant measurably changed.
async function rewriteMeasuredKitFile({ kitCopy, measurements }, path, rewrite, { reseal = true } = {}) {
  const measurement = await applyMeasuredPlant(measurements, () => measureFilePlant(kitCopy, path, rewrite));
  if (reseal) await resealKit(kitCopy);
  return measurement;
}

// Rewrites the checksum list and the identity over a kit copy's edited files, so the planted defect, not
// the identity check, is what the gate meets.
async function resealKit(kitCopy) {
  const { commit, distributable, artifacts } = JSON.parse(await readFile(resolve(kitCopy, IDENTITY_FILE), "utf8"));
  await sealKitIdentity(kitCopy, { commit, distributable, artifacts });
}

// All format-3 identity plants change the identity first, then optionally reseal only the material their
// scenario permits. A resealed identity must also change the facilitator-visible kit digest.
async function rewriteIdentityPlant({ kitCopy, measurements }, rewrite, reseal = null) {
  const kitDigestBefore = await readFile(resolve(kitCopy, KIT_DIGEST_FILE), "utf8");
  await rewriteMeasuredKitFile({ kitCopy, measurements }, IDENTITY_FILE, (text) => {
    const identity = JSON.parse(text);
    rewrite(identity);
    return JSON.stringify(identity, null, 2) + "\n";
  }, { reseal: false });
  if (reseal) {
    await reseal(kitCopy);
    const kitDigestAfter = await readFile(resolve(kitCopy, KIT_DIGEST_FILE), "utf8");
    assert.notEqual(kitDigestAfter, kitDigestBefore, "resealing an identity plant must change kit-digest.sha256");
  }
}

function rewriteManifest(text, mutate) {
  const manifest = JSON.parse(text);
  mutate(manifest);
  return JSON.stringify(manifest, null, 2) + "\n";
}

async function assertPnpmLegFails(kitCopy, release, expectedPhrases) {
  const failure = await captureFailure(() => verifyPnpmInstall(kitCopy, release));
  assert.ok(failure, `pnpm ${release} leg must fail closed`);
  assert.ok(failure.message.includes(`pnpm ${release}`), `pnpm ${release} leg failure must name its release: ${failure.message}`);
  for (const phrase of expectedPhrases) {
    assert.ok(failure.message.includes(phrase), `pnpm ${release} leg must report "${phrase}": ${failure.message}`);
  }
}

async function checkMissingCoreControl(kitDir, identity, { _disabledChecks = [] } = {}) {
  const control = controlFor("missing core tarball");
  const measurements = [];
  const coreArtifact = identity.artifacts.find((artifact) => artifact.name === "core");
  assert.ok(coreArtifact, "the base kit must contain the core artifact");
  await withKitCopy(kitDir, "bloodtrail-ctrl-missing-core-", async (kitCopy) => {
    await applyMeasuredPlant(measurements, () => removeMeasuredKitFile(kitCopy, coreArtifact.filename));
    // Without a reseal the checksum list inside kit-identity also rejects the removal. Resealed, the
    // artifact-name check still reads the missing tarball, so the message pins the existence condition.
    await resealKit(kitCopy);
    const failure = await captureGateFailure(control, kitCopy, { _disabledChecks });
    assert.ok(
      failure.cause.message.includes(`artifact file ${coreArtifact.filename} missing`),
      `missing core tarball must fail the artifact existence condition: ${failure.cause.message}`,
    );
    assert.equal(measurements.length, 1, "missing core control must record one measured plant");
  });
  return completeControl(control, measurements);
}

async function checkBrokenOverrideControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("wrong override");
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-broken-override-", async (kitCopy) => {
    await rewriteMeasuredKitFile(
      { kitCopy, measurements },
      "package.json",
      (text) =>
        rewriteManifest(text, (pkg) => {
          pkg.overrides["@bloodtrail/security-audit-sdk-core"] = "./nonexistent-core.tgz";
        }),
    );
    await captureGateFailure(control, kitCopy, { _disabledChecks });
    assert.equal(measurements.length, 1, "wrong override control must record one measured plant");
  });
  return completeControl(control, measurements);
}

async function checkTamperedIdentityControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("tampered identity");
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-tampered-id-", async (kitCopy) => {
    await rewriteMeasuredKitFile(
      { kitCopy, measurements },
      IDENTITY_FILE,
      (text) => {
        const identity = JSON.parse(text);
        assert.ok(identity.artifacts[0], "the base kit identity must declare an artifact");
        identity.artifacts[0].sha256 = "0".repeat(64);
        return JSON.stringify(identity, null, 2) + "\n";
      },
    );
    // Resealing updates the list over the tampered artifact record, leaving its SHA-256 comparison as the
    // only kit-identity condition that can reject the copy.
    const failure = await captureGateFailure(control, kitCopy, { _disabledChecks });
    assert.ok(
      failure.cause.message.includes("SHA-256 mismatch for "),
      `tampered identity must fail the artifact SHA-256 condition: ${failure.cause.message}`,
    );
    assert.equal(measurements.length, 1, "tampered identity control must record one measured plant");
  });
  return completeControl(control, measurements);
}

function differentCommit(commit) {
  assert(/^[0-9a-f]{40}$/i.test(commit), "the recorded commit must be a well-formed SHA");
  const last = commit.slice(-1).toLowerCase();
  return `${commit.slice(0, -1)}${last === "0" ? "1" : "0"}`;
}

const TREE_BOUND_IDENTITY_CONTROLS = Object.freeze([
  {
    label: "kit commit changed after the build",
    rewrite: (identity) => (identity.commit = differentCommit(identity.commit)),
    directCondition: "identity.json commit must match the tree the gate built from",
  },
  {
    label: "kit distributable flag flipped after the build",
    rewrite(identity) {
      assert.equal(identity.distributable, false, "the built verification kit must start non-distributable");
      identity.distributable = true;
    },
    directCondition: "a kit the gate builds must be marked non-distributable",
  },
]);

async function checkTreeBoundIdentityControl(kitDir, definition, { _disabledChecks = [] } = {}) {
  const control = controlFor(definition.label);
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-identity-unresealed-", async (kitCopy) => {
    await rewriteIdentityPlant({ kitCopy, measurements }, definition.rewrite);
    const failure = await captureGateFailure(control, kitCopy, { _disabledChecks });
    assert.ok(
      failure.cause.message.includes(`${CHECKSUM_LIST_FILE}: ${IDENTITY_FILE} changed after the build`),
      `${control.label} must fail the changed identity checksum condition: ${failure.cause.message}`,
    );
  });
  await withKitCopy(kitDir, "bloodtrail-ctrl-identity-resealed-", async (kitCopy) => {
    await rewriteIdentityPlant({ kitCopy, measurements }, definition.rewrite, resealKit);
    const failure = await captureDirectCheckFailure(control, () => verifyBuiltKitIdentity(kitCopy), _disabledChecks);
    assert.ok(
      failure.cause.message.includes(definition.directCondition),
      `${control.label} must fail its tree-bound identity condition: ${failure.cause.message}`,
    );
  });
  assert.equal(measurements.length, 2, `${control.label} must record two measured plants`);
  return completeControl(control, measurements);
}

function formatTwoIdentity(identity, checksumList) {
  const formatTwoChecksumList = checksumList.split("\n").filter((line) => !line.endsWith(`  ${IDENTITY_FILE}`)).join("\n");
  const checksumListDigest = sha256Hex(formatTwoChecksumList);
  return {
    ...identity,
    identity_format_version: 2,
    checksum_list: { path: CHECKSUM_LIST_FILE, sha256: checksumListDigest },
    kit_digest: sha256Hex(`${identity.package_set_digest}\n${identity.manifest_digest}\n${checksumListDigest}\n`),
  };
}

const OLDER_IDENTITY_FORMAT_PLANTS = Object.freeze([
  {
    prefix: "bloodtrail-ctrl-format-two-identity-",
    refusal: "format-2 identity must be refused by name",
    rewrite: (identity, checksumList) => Object.assign(identity, formatTwoIdentity(identity, checksumList)),
    expectedMessage: "identity.json declares format 2, which is refused",
  },
  {
    prefix: "bloodtrail-ctrl-versionless-identity-",
    refusal: "versionless identity must be refused as kit v1 by name",
    rewrite: (identity) => delete identity.identity_format_version,
    expectedMessage: "identity.json is a kit v1 identity and is refused",
  },
]);

async function checkOlderIdentityFormatControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("identity in format 2 or with no format version");
  const measurements = [];
  for (const plant of OLDER_IDENTITY_FORMAT_PLANTS) {
    await withKitCopy(kitDir, plant.prefix, async (kitCopy) => {
      const checksumList = await readFile(resolve(kitCopy, CHECKSUM_LIST_FILE), "utf8");
      await rewriteIdentityPlant({ kitCopy, measurements }, (identity) => plant.rewrite(identity, checksumList), sealKitChecksumMaterial);
      const failure = await captureGateFailure(control, kitCopy, { _disabledChecks });
      assert.ok(failure.cause.message.includes(plant.expectedMessage), `${plant.refusal}: ${failure.cause.message}`);
    });
  }
  assert.equal(measurements.length, 2, "older identity format control must record two measured plants");
  return completeControl(control, measurements);
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

async function checkBrokenDocControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("renamed doc option (across all TypeScript matrix legs)");
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-broken-doc-", async (kitCopy) => {
    await rewriteMeasuredKitFile(
      { kitCopy, measurements },
      "docs/quickstart.md",
      (text) => text.replace("timeoutMs: 5000,", "timeoutOption: 5000,"),
    );
    await captureGateFailure(control, kitCopy, { _disabledChecks });
    // Verify that every matrix leg fails individually after the tagged kit-gate failure.
    await verifyMatrixLegsFailClosed(kitCopy, { expectInOutput: "quickstart-block-" });
    assert.equal(measurements.length, 1, "renamed document option control must record one measured plant");
  });
  return completeControl(control, measurements);
}

async function plantMeasuredDuplicateCore(tempInstall, measurements) {
  const nestedCore = resolve(
    tempInstall,
    "node_modules/@bloodtrail/security-audit-sdk-node/node_modules/@bloodtrail/security-audit-sdk-core",
  );
  await applyMeasuredPlant(measurements, async () => {
    assert.ok(!existsSync(nestedCore), "duplicate core plant must start without a nested core copy");
    await cp(resolve(tempInstall, "node_modules/@bloodtrail/security-audit-sdk-core"), nestedCore, { recursive: true });
    return { path: "nested core copy", before: "absent", after: existsSync(nestedCore) ? "present" : "absent" };
  });
  assert.ok(existsSync(nestedCore), "duplicate core plant must create the nested core copy");
}

async function checkDuplicateCoreControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("planted duplicate core");
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-dup-core-", async (kitCopy) => {
    await captureGateFailure(control, kitCopy, {
      _disabledChecks,
      _plantDuplicateCore: (tempInstall) => plantMeasuredDuplicateCore(tempInstall, measurements),
    });
    assert.equal(measurements.length, 1, "duplicate core control must record one measured plant");
  });
  return completeControl(control, measurements);
}

async function checkMissingItemControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("missing kit item");
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-missing-item-", async (kitCopy) => {
    await applyMeasuredPlant(measurements, () => removeMeasuredKitFile(kitCopy, "docs/evaluation-guide.md"));
    // Resealing removes the deleted guide from the checksum list, so the required-item loop is the only
    // kit-identity condition that can reject it.
    await resealKit(kitCopy);
    const failure = await captureGateFailure(control, kitCopy, { _disabledChecks });
    assert.ok(
      failure.cause.message.includes("Required kit item missing: docs/evaluation-guide.md"),
      `missing kit item failure must name the one absent item: ${failure.cause.message}`,
    );
    assert.equal(measurements.length, 1, "missing item control must record one measured plant");
  });
  return completeControl(control, measurements);
}

async function checkFailurePathTypeErrorControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("failure-path program type error (across all TypeScript matrix legs)");
  const measurements = [];
  const tempProgramDir = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-failure-path-type-"));
  try {
    const { anchor, replacement } = FAILURE_PATHS_TYPE_ERROR;
    const source = await readFile(FAILURE_PATHS_PROGRAM, "utf8");
    assert.equal(source.split(anchor).length - 1, 1, `failure-path type error anchor ${anchor} must occur exactly once`);
    const plantedProgram = resolve(tempProgramDir, "evaluation-kit-failure-paths.ts");
    await applyMeasuredPlant(measurements, async () => {
      await writeFile(plantedProgram, source.replace(anchor, replacement), "utf8");
      return {
        path: "evaluation-kit-failure-paths.ts",
        before: sha256Hex(source),
        after: sha256Hex(await readFile(plantedProgram)),
      };
    });
    await captureGateFailure(control, kitDir, { failurePathsProgram: plantedProgram, _disabledChecks });
    // Verify that every matrix leg fails individually after the tagged kit-gate failure.
    await verifyMatrixLegsFailClosed(kitDir, {
      failurePathsProgram: plantedProgram,
      expectInOutput: "evaluation-kit-failure-paths.ts",
    });
    assert.equal(measurements.length, 1, "failure-path type error control must record one measured plant");
  } finally {
    await rm(tempProgramDir, { recursive: true, force: true });
  }
  return completeControl(control, measurements);
}


function formatThreeChecksumMaterial(identity) {
  const entries = identity.artifacts.map(({ filename, sha256 }) => ({ path: filename, sha256 }));
  entries.push(
    { path: "package.json", sha256: identity.manifest_digest },
    { path: IDENTITY_FILE, sha256: sha256Hex(JSON.stringify(identity, null, 2) + "\n") },
  );
  entries.sort((left, right) => byCodePoint(left.path, right.path));
  return entries.map(({ path, sha256 }) => `${sha256}  ${path}\n`).join("");
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
    artifacts.sort((left, right) => byCodePoint(left.filename, right.filename));
    const identity = {
      identity_format_version: 3,
      commit: "0".repeat(40),
      distributable: false,
      artifacts,
      package_set_digest: computePackageSetDigest(artifacts),
      manifest_digest: sha256Hex("{}\n"),
    };
    return { ...identity, kitDigest: sha256Hex(formatThreeChecksumMaterial(identity)) };
  } finally {
    await rm(packDir, { recursive: true, force: true });
  }
}

async function checkPackedBuildOutputControl({ _disabledChecks = [] } = {}) {
  const control = controlFor("builder packing the build output on disk (with a null control)");
  // Null control: with nothing planted, the on-disk packer reproduces itself, so the planted output is
  // the only difference the check can see.
  const nullControl = await runKitGateCheck({
    identity: control.identity,
    _disabledChecks,
    run: () => verifyStaleBuildOutputExcluded(packOnDiskBuildOutput, { plant: async () => {} }),
  });
  assert.ok(!nullControl.skipped, "the on-disk packer null control must run before measuring its plant");

  const measuredOutputs = [];
  const failure = await captureDirectCheckFailure(
    control,
    async () =>
      verifyStaleBuildOutputExcluded(async (root) => {
        const identity = await packOnDiskBuildOutput(root);
        measuredOutputs.push(identity.kitDigest);
        return identity;
      }),
    _disabledChecks,
  );
  assert.equal(measuredOutputs.length, 2, "the on-disk packer must produce clean and planted outputs");
  assert.notEqual(measuredOutputs[0], measuredOutputs[1], "the on-disk packer plant must change its packed output");
  assert.ok(
    failure.cause.message.includes("untracked files on disk reached the kit"),
    `on-disk packing must fail the stale-output check itself: ${failure.cause.message}`,
  );
  return completeControl(control, [{ path: "packed build output", before: measuredOutputs[0], after: measuredOutputs[1] }]);
}

async function shasumCheckPasses(kitDir, runCheck) {
  return !(await captureFailure(() => runCheck(kitDir)));
}

// No reseal: the document change is the integrity defect. Resealing would hide it from kit-identity.
async function checkChangedDocumentControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("document changed after the build");
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-changed-document-", async (kitCopy) => {
    assert.ok(await shasumCheckPasses(kitCopy, runChecksumListCheck), `shasum -a 256 -c ${CHECKSUM_LIST_FILE} must pass on the kit as built`);
    assert.ok(await shasumCheckPasses(kitCopy, runKitDigestCheck), `shasum -a 256 -c ${KIT_DIGEST_FILE} must pass on the kit as built`);
    await rewriteMeasuredKitFile(
      { kitCopy, measurements },
      "docs/privacy.md",
      (text) => `${text}\nEdited after the build.\n`,
      { reseal: false },
    );
    assert.ok(await shasumCheckPasses(kitCopy, runKitDigestCheck), `shasum -a 256 -c ${KIT_DIGEST_FILE} must remain valid after a listed document changes`);
    assert.ok(!(await shasumCheckPasses(kitCopy, runChecksumListCheck)), `shasum -a 256 -c ${CHECKSUM_LIST_FILE} must fail once a listed document changes`);
    const failure = await captureGateFailure(control, kitCopy, { _disabledChecks });
    assert.ok(
      failure.cause.message.includes("docs/privacy.md changed after the build"),
      `a changed document must fail the gate's identity check: ${failure.cause.message}`,
    );
    assert.equal(measurements.length, 1, "changed document control must record one measured plant");
  });
  return completeControl(control, measurements);
}

async function checkGuideIntegrityCommandControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("evaluation guide integrity commands that are not shasum, name an unshipped file, print an unrecorded digest, or sit outside an sh block");
  const documented = `shasum -a 256 -c ${CHECKSUM_LIST_FILE}`;
  const plants = [
    { plant: (text) => text.replace(documented, `cat ${IDENTITY_FILE}`), expect: "must use only shasum" },
    { plant: (text) => text.replace(documented, "shasum -a 256 kit-identity.json"), expect: "names a file the kit does not ship" },
    { plant: (text) => text.replace(documented, `shasum -a 256 ${KIT_DIGEST_FILE}`), expect: "printed a digest the kit does not record" },
    { plant: (text) => text.replace("```sh", "```bash"), expect: "may hold only sh blocks" },
  ];
  const measurements = [];
  for (const { plant, expect } of plants) {
    await withKitCopy(kitDir, "bloodtrail-ctrl-guide-command-", async (kitCopy) => {
      await rewriteMeasuredKitFile({ kitCopy, measurements }, "docs/evaluation-guide.md", plant);
      const failure = await captureGateFailure(control, kitCopy, { _disabledChecks });
      assert.ok(
        failure.cause.message.includes(expect),
        `the planted guide must fail with its specific condition "${expect}": ${failure.cause.message}`,
      );
    });
  }
  assert.equal(measurements.length, plants.length, "each guide-command plant must be measured");
  return completeControl(control, measurements);
}

async function assertMeasuredKitDefectFails(kitDir, control, {
  tempPrefix,
  path,
  plant,
  expectCondition,
  _disabledChecks = [],
}) {
  const measurements = [];
  await withKitCopy(kitDir, tempPrefix, async (kitCopy) => {
    await rewriteMeasuredKitFile({ kitCopy, measurements }, path, plant);
    const failure = await captureGateFailure(control, kitCopy, { _disabledChecks });
    assert.ok(
      failure.cause.message.includes(expectCondition),
      `${control.label} must report its specific condition "${expectCondition}": ${failure.cause.message}`,
    );
  });
  return measurements;
}

// A sink between the SDK and the receiver that rewrites one field. `service.name` is free text, so the
// rewritten event stays valid and the receiver accepts it: only the byte comparison can tell. Rewriting
// `correlation.retry_attempt` instead makes the receiver reject the event before any comparison runs.
async function checkRewritingSinkControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("sink rewriting service.name between the SDK and the receiver");
  const measurements = await assertMeasuredKitDefectFails(kitDir, control, {
    tempPrefix: "bloodtrail-ctrl-rewriting-sink-",
    path: "examples/evaluation-service.ts",
    plant: (text) =>
      text.replace(
        "      return sink.emit(event);",
        "      return sink.emit({ ...event, service: { ...event.service, name: \"rewritten-in-transit\" } });",
      ),
    expectCondition: "differ from the bytes the SDK handed to the HTTP audit sink",
    _disabledChecks,
  });
  assert.equal(measurements.length, 1, "rewriting sink control must record one measured plant");
  return completeControl(control, measurements);
}

async function rewriteMeasuredKitTarball({ kitCopy, measurements }, packageName, fileInTarball, rewrite) {
  const identityPath = resolve(kitCopy, IDENTITY_FILE);
  const identity = JSON.parse(await readFile(identityPath, "utf8"));
  const artifact = identity.artifacts.find((candidate) => candidate.name === packageName);
  assert.ok(artifact, `artifact ${packageName} must exist in identity`);
  const tarballPath = resolve(kitCopy, artifact.filename);
  const before = sha256Hex(await readFile(tarballPath));
  const extractDir = await mkdtemp(resolve(tmpdir(), `bloodtrail-ctrl-${packageName}-`));
  try {
    runChecked("tar", ["-xzf", tarballPath, "-C", extractDir]);
    const filePath = resolve(extractDir, "package", fileInTarball);
    const text = await readFile(filePath, "utf8");
    const mutated = rewrite(text);
    assert.notEqual(mutated, text, `the planted defect must change ${fileInTarball}`);
    await writeFile(filePath, mutated, "utf8");
    const measurement = await applyMeasuredPlant(measurements, async () => {
      runChecked("tar", ["-czf", tarballPath, "-C", extractDir, "package"]);
      return { path: artifact.filename, before, after: sha256Hex(await readFile(tarballPath)) };
    });
    artifact.sha256 = measurement.after;
    const { commit, distributable, artifacts } = identity;
    await sealKitIdentity(kitCopy, { commit, distributable, artifacts });
  } finally {
    await rm(extractDir, { recursive: true, force: true });
  }
}

async function checkMidBodyStallControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("mid-body stall mapped to malformed acknowledgment");
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-mid-body-stall-", async (kitCopy) => {
    await rewriteMeasuredKitTarball(
      { kitCopy, measurements },
      "node",
      "dist/fetch-exchange.js",
      (text) => text.replace("        if (isTimeout(error))\n            throw error;\n", ""),
    );
    await captureGateFailure(control, kitCopy, { _disabledChecks });
  });
  assert.equal(measurements.length, 1, "mid-body stall control must record one measured tarball plant");
  return completeControl(control, measurements);
}

async function checkAnswerKeyInKitControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("facilitator answer key content copied into the kit");
  const answerKeyText = await readFile(ANSWER_KEY_PATH, "utf8");
  const measurements = await assertMeasuredKitDefectFails(kitDir, control, {
    tempPrefix: "bloodtrail-ctrl-answer-key-in-kit-",
    path: "docs/seeded-invalid-calls.md",
    plant: (text) => `${text}\n\n${answerKeyText}`,
    expectCondition: "evaluation kit must never contain facilitator answer key content in docs/seeded-invalid-calls.md",
    _disabledChecks,
  });
  assert.equal(measurements.length, 1, "answer key control must record one measured plant");
  return completeControl(control, measurements);
}

// Invented calls: one on a receiver the documents name, one on a receiver they do not.
const INVENTED_API_CALLS = Object.freeze(["op.commit()", "handle.commit()"]);

async function checkInventedApiControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("invented API calls named in a kit document (op.commit(), handle.commit())");
  const measurements = [];
  for (const call of INVENTED_API_CALLS) {
    measurements.push(
      ...(await assertMeasuredKitDefectFails(kitDir, control, {
        tempPrefix: "bloodtrail-ctrl-invented-api-",
        path: "docs/quickstart.md",
        plant: (text) => `${text}\nCall \`${call}\` to commit.\n`,
        expectCondition: `docs/quickstart.md: \`${call}\`: `,
        _disabledChecks,
      })),
    );
  }
  assert.equal(measurements.length, INVENTED_API_CALLS.length, "each invented API plant must be measured");
  return completeControl(control, measurements);
}

// The ratified scenario's planted defect: the table lists retries as supported.
const SUPPORTED_RETRY_ROW = Object.freeze({
  anchor: "| **Delivery retry by the HTTP audit sink, in process or durable** | **Planned (Not Implemented)** |",
  replacement: "| **Delivery retry by the HTTP audit sink, in process or durable** | **Supported** |",
});

async function checkSupportedRetryRowControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("retries listed as supported in the supported-versus-planned table");
  const measurements = await assertMeasuredKitDefectFails(kitDir, control, {
    tempPrefix: "bloodtrail-ctrl-supported-retry-",
    path: "docs/supported-and-planned.md",
    plant: (text) => text.replace(SUPPORTED_RETRY_ROW.anchor, SUPPORTED_RETRY_ROW.replacement),
    expectCondition: "docs/supported-and-planned.md line 20: Delivery retry by the HTTP audit sink, in process or durable violates planned row status rule",
    _disabledChecks,
  });
  assert.equal(measurements.length, 1, "supported delivery-retry control must record one measured plant");
  return completeControl(control, measurements);
}

async function checkMisclassifiedStatusControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("429 classified as a permanent failure in the packed Node binding");
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-misclassified-status-", async (kitCopy) => {
    await rewriteMeasuredKitTarball(
      { kitCopy, measurements },
      "node",
      "dist/http-response-classification.js",
      (text) => text.replace("new Set([408, 425, 429])", "new Set([408, 425])"),
    );
    await captureGateFailure(control, kitCopy, { _disabledChecks });
  });
  assert.equal(measurements.length, 1, "429 control must record one measured tarball plant");
  return completeControl(control, measurements);
}

async function checkBrokenFirstEventControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("first-event example whose sink rejects the event");
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-broken-first-event-", async (kitCopy) => {
    // A type-correct defect, so the run, not the type-check, is what fails.
    await rewriteMeasuredKitFile(
      { kitCopy, measurements },
      "examples/first-event.ts",
      (text) => text.replace('return { status: "accepted" };', 'return { status: "rejected", code: "planted_rejection" };'),
    );
    await captureGateFailure(control, kitCopy, { _disabledChecks });
    assert.equal(measurements.length, 1, "first-event control must record one measured plant");
  });
  return completeControl(control, measurements);
}

async function checkSeededCallNoLongerFailsControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("seeded invalid call 1 given the actor it omits");
  const measurements = await assertMeasuredKitDefectFails(kitDir, control, {
    tempPrefix: "bloodtrail-ctrl-seeded-call-fixed-",
    path: "examples/seeded-invalid-calls.ts",
    plant: (text) =>
      text.replace(
        "  const call1 = await (sdk.sensitiveResourceViewed as Function)({\n",
        "  const call1 = await (sdk.sensitiveResourceViewed as Function)({\n    actor: syntheticHumanActor,\n",
      ),
    expectCondition: "seeded invalid call 1 output mismatch",
    _disabledChecks,
  });
  assert.equal(measurements.length, 1, "seeded-call control must record one measured plant");
  return completeControl(control, measurements);
}

async function checkRemovedExportControl(kitDir, { _disabledChecks = [] } = {}) {
  const control = controlFor("createHttpAuditSink removed from the packed entry point's runtime exports");
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-removed-export-", async (kitCopy) => {
    // The declarations still name the export, so only running the packed entry point can catch it.
    await rewriteMeasuredKitTarball(
      { kitCopy, measurements },
      "node",
      "dist/index.js",
      (text) => text.replace('export { createHttpAuditSink } from "./http-audit-sink.js";\n', ""),
    );
    // Document blocks run before the examples, so the first importer is a kit document block, and
    // document-block-execution is the check that meets the omission.
    await captureGateFailure(control, kitCopy, { _disabledChecks });
  });
  assert.equal(measurements.length, 1, "removed export control must record one measured tarball plant");
  return completeControl(control, measurements);
}

const CONTROL_RUNNERS = Object.freeze([
  ["missing core tarball", ({ kitDir, identity, _disabledChecks }) => checkMissingCoreControl(kitDir, identity, { _disabledChecks })],
  ["wrong override", ({ kitDir, _disabledChecks }) => checkBrokenOverrideControl(kitDir, { _disabledChecks })],
  ["tampered identity", ({ kitDir, _disabledChecks }) => checkTamperedIdentityControl(kitDir, { _disabledChecks })],
  ["kit commit changed after the build", ({ kitDir, _disabledChecks }) => checkTreeBoundIdentityControl(kitDir, TREE_BOUND_IDENTITY_CONTROLS[0], { _disabledChecks })],
  ["kit distributable flag flipped after the build", ({ kitDir, _disabledChecks }) => checkTreeBoundIdentityControl(kitDir, TREE_BOUND_IDENTITY_CONTROLS[1], { _disabledChecks })],
  ["identity in format 2 or with no format version", ({ kitDir, _disabledChecks }) => checkOlderIdentityFormatControl(kitDir, { _disabledChecks })],
  ["renamed doc option (across all TypeScript matrix legs)", ({ kitDir, _disabledChecks }) => checkBrokenDocControl(kitDir, { _disabledChecks })],
  ["planted duplicate core", ({ kitDir, _disabledChecks }) => checkDuplicateCoreControl(kitDir, { _disabledChecks })],
  ["missing kit item", ({ kitDir, _disabledChecks }) => checkMissingItemControl(kitDir, { _disabledChecks })],
  ...createClonePlantControlRunners({ controlFor, captureDirectCheckFailure, completeControl }),
  ["failure-path program type error (across all TypeScript matrix legs)", ({ kitDir, _disabledChecks }) => checkFailurePathTypeErrorControl(kitDir, { _disabledChecks })],
  ...createInstallerControlRunners({
    applyMeasuredPlant,
    assertPnpmLegFails,
    captureFailure,
    captureGateFailure,
    completeControl,
    controlFor,
    resealKit,
    rewriteManifest,
    rewriteMeasuredKitFile,
    withKitCopy,
  }),
  ["builder packing the build output on disk (with a null control)", ({ _disabledChecks }) => checkPackedBuildOutputControl({ _disabledChecks })],
  ["document changed after the build", ({ kitDir, _disabledChecks }) => checkChangedDocumentControl(kitDir, { _disabledChecks })],
  ["evaluation guide integrity commands that are not shasum, name an unshipped file, print an unrecorded digest, or sit outside an sh block", ({ kitDir, _disabledChecks }) => checkGuideIntegrityCommandControl(kitDir, { _disabledChecks })],
  ["sink rewriting service.name between the SDK and the receiver", ({ kitDir, _disabledChecks }) => checkRewritingSinkControl(kitDir, { _disabledChecks })],
  ...createReceiverControlRunners({ controlFor, assertMeasuredKitDefectFails, completeControl }),
  ...createDocumentControlRunners({ controlFor, captureGateFailure, completeControl }),
  ["mid-body stall mapped to malformed acknowledgment", ({ kitDir, _disabledChecks }) => checkMidBodyStallControl(kitDir, { _disabledChecks })],
  ["facilitator answer key content copied into the kit", ({ kitDir, _disabledChecks }) => checkAnswerKeyInKitControl(kitDir, { _disabledChecks })],
  ...createAnswerKeyControlRunners({ controlFor, captureGateFailure, completeControl }),
  ["invented API calls named in a kit document (op.commit(), handle.commit())", ({ kitDir, _disabledChecks }) => checkInventedApiControl(kitDir, { _disabledChecks })],
  ["retries listed as supported in the supported-versus-planned table", ({ kitDir, _disabledChecks }) => checkSupportedRetryRowControl(kitDir, { _disabledChecks })],
  ["429 classified as a permanent failure in the packed Node binding", ({ kitDir, _disabledChecks }) => checkMisclassifiedStatusControl(kitDir, { _disabledChecks })],
  ["first-event example whose sink rejects the event", ({ kitDir, _disabledChecks }) => checkBrokenFirstEventControl(kitDir, { _disabledChecks })],
  ["seeded invalid call 1 given the actor it omits", ({ kitDir, _disabledChecks }) => checkSeededCallNoLongerFailsControl(kitDir, { _disabledChecks })],
  ["createHttpAuditSink removed from the packed entry point's runtime exports", ({ kitDir, _disabledChecks }) => checkRemovedExportControl(kitDir, { _disabledChecks })],
]);

const CONTROL_RUNNERS_BY_LABEL = new Map(CONTROL_RUNNERS);
assert.equal(CONTROL_RUNNERS_BY_LABEL.size, CONTROL_DEFINITIONS.length, "every control must have one runner");

function selectControlRunners(labels) {
  assert.ok(Array.isArray(labels), "_controlLabels must be an array of declared control labels");
  const selectedLabels = new Set(labels);
  assert.equal(selectedLabels.size, labels.length, "_controlLabels must not repeat a control label");
  for (const label of selectedLabels) {
    assert.ok(CONTROL_RUNNERS_BY_LABEL.has(label), `control runner must be declared: ${label}`);
  }
  return CONTROL_DEFINITIONS.filter(({ label }) => selectedLabels.has(label)).map((control) => ({
    control,
    run: CONTROL_RUNNERS_BY_LABEL.get(control.label),
  }));
}

async function runControls(runners, kitDir, identity, _disabledChecks = []) {
  const applied = [];
  for (const { run } of runners) {
    applied.push(await run({ kitDir, identity, _disabledChecks }));
  }
  return applied;
}

function describeSweepFailure(control, failure) {
  const failedIdentity = failure.checkIdentity || failure.actual;
  if (KIT_GATE_CHECK_IDENTITIES.includes(failedIdentity) && failedIdentity !== control.identity) {
    return `the gate failed at ${failedIdentity}`;
  }
  return `harness assertion fired: ${failure.message.replace(/\s+/g, " ").trim()}`;
}

async function sweepControls(runners, kitDir, identity) {
  const passingControls = [];
  for (const { control, run } of runners) {
    const failure = await captureFailure(() => run({ kitDir, identity, _disabledChecks: [control.identity] }));
    const outcome = failure ? describeSweepFailure(control, failure) : "the gate passed";
    process.stdout.write(`sweep ${control.label} | disabled ${control.identity} | ${outcome}\n`);
    if (!failure) passingControls.push(control.label);
  }
  assert.deepEqual(passingControls, [], `controls passed when their named check was disabled: ${passingControls.join(", ")}`);
}

// Null control: an unmodified copy of the base kit, checked as given with --kit-dir through an external
// symlink, passes the gate. The printed success line proves that the command-line entry ran, that it says
// the kit was checked as given, and that this existing-kit run claimed none of the build-mode checks.
async function checkKitDirNullControl(kitDir) {
  await withKitCopy(kitDir, "bloodtrail-ctrl-kit-dir-null-", async (kitCopy) => {
    const summary = await withExternalScriptSymlink("check-evaluation-kit.mjs", (gatePath) =>
      runChecked(process.execPath, [gatePath, "--kit-dir", kitCopy], { capture: true }),
    );
    assert.ok(summary.startsWith(VERIFICATION_SUMMARY_PREFIX), `a symlinked --kit-dir gate must print its verification summary: ${summary}`);
    assert.ok(
      summary.startsWith(`${VERIFICATION_SUMMARY_PREFIX}${KIT_DIR_NOTE}; `),
      `a --kit-dir run must first say that it checked the kit as given: ${summary}`,
    );
    for (const claim of REBUILD_CLAIMS) {
      assert.ok(!summary.includes(claim), `a --kit-dir run must not claim "${claim}": ${summary}`);
    }
  });
  return "an unmodified kit copy, checked through an external symlink with --kit-dir, passed, said it was checked as given, and claimed no rebuild";
}

async function assertSourceCopySymlinkRefusal(cloneRoot, path) {
  const sourceCopyRoot = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-source-link-"));
  try {
    const sourceModule = await import(
      pathToFileURL(resolve(cloneRoot, KIT_PACKAGES.node, "scripts/evaluation-kit-source-copy.mjs")).href,
    );
    const failure = await captureFailure(() => sourceModule.copyTrackedSources({ toRoot: sourceCopyRoot }));
    assert.ok(failure, "a source-copy symlink must be refused");
    assert.ok(failure.message.includes(`non-regular file in the build tree: ${path}`), `source-copy refusal must name its symlink: ${failure.message}`);
  } finally {
    await rm(sourceCopyRoot, { recursive: true, force: true });
  }
}

async function checkNonRegularEntryProof(kitDir) {
  const trackedLink = await createKitTreeClone({ plant: (root) => symlink("privacy.md", resolve(root, NON_REGULAR_SOURCE_PATH)) });
  try {
    await assertSourceCopySymlinkRefusal(trackedLink.cloneRoot, NON_REGULAR_SOURCE_PATH);
  } finally {
    await trackedLink.remove();
  }
  const workingTreeLink = await createKitTreeClone();
  const workingTreePath = `${KIT_PACKAGES.node}/docs/privacy.md`;
  try {
    await rm(resolve(workingTreeLink.cloneRoot, workingTreePath));
    await symlink("known-issues.md", resolve(workingTreeLink.cloneRoot, workingTreePath));
    await assertSourceCopySymlinkRefusal(workingTreeLink.cloneRoot, workingTreePath);
  } finally {
    await workingTreeLink.remove();
  }
  await withKitCopy(kitDir, "bloodtrail-ctrl-kit-link-", async (kitCopy) => {
    await symlink("privacy.md", resolve(kitCopy, NON_REGULAR_KIT_PATH));
    const expected = `non-regular file in the kit: ${NON_REGULAR_KIT_PATH}`;
    const sealFailure = await captureFailure(() => writeChecksumList(kitCopy));
    const identityFailure = await captureFailure(() => verifyKitIdentity(kitCopy));
    assert.ok(sealFailure, "checksum sealing must refuse the symlink");
    assert.ok(identityFailure, "kit identity must refuse the symlink");
    assert.ok(sealFailure.message.includes(expected), `checksum sealing must refuse the symlink: ${sealFailure.message}`);
    assert.ok(identityFailure.message.includes(expected), `kit identity must refuse the symlink: ${identityFailure.message}`);
    const gate = spawnSync(process.execPath, [resolve(SCRIPT_DIRECTORY, "check-evaluation-kit.mjs"), "--kit-dir", kitCopy], { encoding: "utf8" });
    assert.notEqual(gate.status, 0, "a --kit-dir gate must refuse a symlink");
    assert.ok(
      `${gate.stdout}${gate.stderr}`.includes(`kit gate check kit-identity failed: ${expected}`),
      `a --kit-dir gate must report the kit symlink: ${gate.stdout}${gate.stderr}`,
    );
  });
  return "tracked and working-tree source symlinks plus a --kit-dir symlink were refused before copying or identity verification";
}

async function checkBuilderSymlinkProof() {
  const destinationParent = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-builder-symlink-"));
  const kitDir = resolve(destinationParent, "evaluation-kit");
  try {
    const output = await withExternalScriptSymlink("build-evaluation-kit.mjs", (builderPath) =>
      runChecked(process.execPath, [builderPath, "--verification", "--dest", kitDir], { capture: true }),
    );
    assert.ok(output.includes(`evaluation kit built successfully at ${kitDir}`), `a symlinked builder must report its kit: ${output}`);
    const { identity } = await verifyKitIdentity(kitDir);
    assert.equal(identity.distributable, false, "a symlinked verification builder must produce a non-distributable kit");
  } finally {
    await rm(destinationParent, { recursive: true, force: true });
  }
  return "a builder invoked through an external symlink produced a verified verification kit";
}

async function checkControlInfrastructureProof(kitDir) {
  assert.equal(CONTROL_DEFINITIONS.length, 67, "the control table must declare every expected control");
  assert.deepEqual(CLONE_PLANT_CONTROLS.map(({ label, identity }) => controlFor(label).identity), CLONE_PLANT_CONTROLS.map(({ identity }) => identity));
  assert.deepEqual(CLONE_PLANT_CONTROLS.map(({ label }) => CONTROL_RUNNERS_BY_LABEL.has(label)), CLONE_PLANT_CONTROLS.map(() => true));
  assert.throws(
    () => validateControlDefinitions([...CONTROL_DEFINITIONS, { label: "unknown identity proof", identity: "not-a-kit-gate-check" }]),
    /unknown kit gate identity: not-a-kit-gate-check/,
  );
  await withKitCopy(kitDir, "bloodtrail-ctrl-no-change-", async (kitCopy) => {
    const failure = await captureFailure(() =>
      rewriteMeasuredKitFile({ kitCopy, measurements: [] }, "docs/privacy.md", (text) => text, { reseal: false }),
    );
    assert.ok(failure, "a plant that changes no bytes must fail the harness");
    assert.match(failure.message, /measured plant must change docs\/privacy\.md/);
  });
  return "control definitions reject unknown identities and a no-change plant fails the harness";
}

async function checkIdentityAndDisableSeamProof(kitDir) {
  await withKitCopy(kitDir, "bloodtrail-ctrl-identity-tag-", async (kitCopy) => {
    const identityPath = resolve(kitCopy, IDENTITY_FILE);
    const identity = JSON.parse(await readFile(identityPath, "utf8"));
    assert.equal(identity.identity_format_version, 3, "the identity-tag proof must plant a format-3 identity");
    identity.manifest_digest = "0".repeat(64);
    await writeFile(identityPath, JSON.stringify(identity, null, 2) + "\n", "utf8");
    await sealKitChecksumMaterial(kitCopy);
    const failure = await captureFailure(() => checkEvaluationKit({ kitDir: kitCopy }));
    assert.ok(failure, "a tampered identity must fail the gate");
    assert.equal(failure.checkIdentity, "kit-identity", "a kit identity failure must carry its stable identity");
    assert.ok(failure.cause, "a tagged kit gate failure must retain its original cause");
    assert.ok(failure.message.includes("kit gate check kit-identity failed"), `a tagged failure must name its check: ${failure.message}`);
    assert.ok(KIT_GATE_CHECK_IDENTITIES.includes(failure.checkIdentity), "a tagged failure must carry a known identity");
  });

  const disabled = await checkEvaluationKit({ kitDir, _disabledChecks: ["answer-key-exclusion"] });
  assert.ok(!disabled.checkIdentities.includes("answer-key-exclusion"), "a disabled check must not be recorded");
  assert.ok(!disabled.summary.includes(clauseForCheck({ identity: "answer-key-exclusion" })), "a disabled check must not claim its clause");
  let duplicateCoreHookRan = false;
  const withoutDuplicateProbe = await checkEvaluationKit({
    kitDir,
    _disabledChecks: ["npm-single-core-copy"],
    _plantDuplicateCore: async () => {
      duplicateCoreHookRan = true;
    },
  });
  assert.ok(!duplicateCoreHookRan, "a disabled duplicate-core check must not run its plant hook");
  assert.ok(
    !withoutDuplicateProbe.checkIdentities.includes("npm-single-core-copy"),
    "a disabled duplicate-core check must not be recorded",
  );
  assert.ok(
    !withoutDuplicateProbe.summary.includes(clauseForCheck({ identity: "npm-single-core-copy" })),
    "a disabled duplicate-core check must not claim its clause",
  );
  const allDisabled = await checkEvaluationKit({ kitDir, _disabledChecks: KIT_GATE_CHECK_IDENTITIES });
  assert.deepEqual(allDisabled.checkIdentities, [], "all disabled checks must not execute or be recorded");
  assert.equal(
    allDisabled.summary,
    `${VERIFICATION_SUMMARY_PREFIX}${KIT_DIR_NOTE}\n`,
    "an all-disabled existing-kit run must report only that the kit was checked as given",
  );
  await assert.rejects(
    () => checkEvaluationKit({ kitDir, _disabledChecks: ["not-a-kit-gate-check"] }),
    /unknown kit gate check identity: not-a-kit-gate-check/,
  );
  const gatePath = resolve(SCRIPT_DIRECTORY, "check-evaluation-kit.mjs");
  const cli = spawnSync(process.execPath, [gatePath, "--disabled-check", "answer-key-exclusion"], { encoding: "utf8" });
  assert.notEqual(cli.status, 0, "the kit gate command line must reject a disabled-check option");
  assert.ok(cli.stderr.includes("unknown or incomplete kit gate option"), `the kit gate CLI must reject unknown options: ${cli.stderr}`);

  return "tagged failures retain their causes, and the JavaScript-only disabled-check seam skips and does not claim checks or their duplicate-core plant hook";
}

function assertRevisedInstallerClauses(result, mode) {
  for (const expected of REVISED_INSTALLER_CLAUSES) {
    const check = result.verificationChecks.find(({ identity }) => identity === expected.identity);
    assert.ok(check, `${mode} run must record ${expected.identity}`);
    assert.equal(clauseForCheck(check), expected.clause, `${mode} run must preserve the ${expected.identity} clause`);
    assert.ok(result.summary.includes(expected.clause), `${mode} summary must include the ${expected.identity} clause`);
  }
}

async function checkSummaryCompositionProof(kitDir) {
  const buildMode = await checkEvaluationKit();
  assert.deepEqual(
    buildMode.checkIdentities,
    EXPECTED_BUILD_CHECK_IDENTITIES,
    "a build-mode run must record every stable kit-gate check identity in order",
  );

  const kitDirMode = await checkEvaluationKit({ kitDir });
  assert.deepEqual(
    kitDirMode.checkIdentities,
    EXPECTED_KIT_DIR_CHECK_IDENTITIES,
    "a --kit-dir run must record every stable kit-gate check identity that does not rebuild",
  );
  assertRevisedInstallerClauses(buildMode, "build-mode");
  assertRevisedInstallerClauses(kitDirMode, "--kit-dir");

  const fullClauses = buildMode.verificationChecks.map(clauseForCheck);
  assert.ok(buildMode.summary.includes(DISTRIBUTABLE_KIT_UMASK_CLAUSE), `the build-mode summary must name the clone's fixed umask: ${buildMode.summary}`);
  assert.ok(buildMode.summary.includes(LOOPBACK_EXAMPLE_EXCHANGE_CLAUSE), `the build-mode summary must include the complete loopback clause: ${buildMode.summary}`);
  assert.ok(kitDirMode.summary.includes(LOOPBACK_EXAMPLE_EXCHANGE_CLAUSE), `the --kit-dir summary must include the complete loopback clause: ${kitDirMode.summary}`);
  assert.equal(
    buildMode.summary,
    `${VERIFICATION_SUMMARY_PREFIX}${fullClauses.join("; ")}\n`,
    "a build-mode summary must compose its recorded checks in order",
  );
  assert.equal(
    kitDirMode.summary,
    composeVerificationSummary(kitDirMode.verificationChecks, { checkedAsGiven: true }),
    "a --kit-dir summary must state that the kit was checked as given, then compose its recorded checks in order",
  );

  for (const [index, check] of buildMode.verificationChecks.entries()) {
    const withoutCheck = buildMode.verificationChecks.filter(({ identity }) => identity !== check.identity);
    const expectedClauses = fullClauses.slice(0, index).concat(fullClauses.slice(index + 1));
    assert.equal(
      composeVerificationSummary(withoutCheck),
      `${VERIFICATION_SUMMARY_PREFIX}${expectedClauses.join("; ")}\n`,
      `removing ${check.identity} must remove only its verification-summary clause`,
    );
  }

  return "complete build-mode and --kit-dir identities were recorded, and each identity's removed composition lost only its clause";
}

export async function checkEvaluationKitControls({ _controlLabels = EXPECTED_CONTROLS, sweep = false } = {}) {
  await assertOutsideRepository(tmpdir());
  const runners = selectControlRunners(_controlLabels);

  // Build a base verification kit to derive controls from.
  const { kitDir, identity, removeKit } = await buildEvaluationKit({ mode: "verification" });

  try {
    if (sweep) {
      await sweepControls(runners, kitDir, identity);
      return;
    }

    const controlInfrastructureProof = await checkControlInfrastructureProof(kitDir);
    const identityAndDisableSeamProof = await checkIdentityAndDisableSeamProof(kitDir);
    const summaryCompositionProof = await checkSummaryCompositionProof(kitDir);
    const nonRegularEntryProof = await checkNonRegularEntryProof(kitDir);
    const cloneUmaskProof = await checkCloneUmaskProof();
    const builderSymlinkProof = await checkBuilderSymlinkProof();
    const gateSymlinkProof = await checkKitDirNullControl(kitDir);
    const applied = await runControls(runners, kitDir, identity);
    assert.deepEqual(
      applied.map(({ label }) => label),
      runners.map(({ control }) => control.label),
      "control harness must apply every selected planted defect exactly once",
    );
    const measuredPlants = applied.reduce((count, control) => count + control.measuredPlants, 0);
    const declaredControls = applied.map(({ label, identity: checkIdentity }) => `${label} [${checkIdentity}]`).join(", ");

    process.stdout.write(
      `evaluation kit summary and symlink proofs passed: ${controlInfrastructureProof}; ${identityAndDisableSeamProof}; ${summaryCompositionProof}; ${nonRegularEntryProof}; ${cloneUmaskProof}; ${builderSymlinkProof}; ${gateSymlinkProof}\n`,
    );
    process.stdout.write(
      `evaluation kit negative controls passed: ${measuredPlants} measured plants across ${applied.length} of ${EXPECTED_CONTROLS.length} controls, and each failed closed at its declared identity: ${declaredControls}\n`,
    );
  } finally {
    await removeKit();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  const args = process.argv.slice(2);
  const sweep = args.includes("--sweep");
  assert.deepEqual(args, sweep ? ["--sweep"] : [], `unknown controls harness option: ${args.join(" ")}`);
  await checkEvaluationKitControls({ sweep });
}
