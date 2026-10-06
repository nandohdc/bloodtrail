import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { sealKitIdentity } from "./build-evaluation-kit.mjs";
import {
  ANSWER_KEY_MARKERS,
  ANSWER_KEY_PATH,
  createAnswerKeyContentRecognizers,
  EXPECTED_SEEDED_CALLS,
  MAPPING_PAIR_THRESHOLD,
} from "./evaluation-kit-answer-key.mjs";
import {
  ANSWER_KEY_MISSING_MESSAGE,
  checkAnswerKeyFixTypecheck,
  runKitGateCheck,
} from "./check-evaluation-kit.mjs";
import { IDENTITY_FILE, sha256Hex } from "./evaluation-kit-checksums.mjs";
import { extractTypeScriptDocBlocks } from "./evaluation-kit-doc-blocks.mjs";
import { runChecked } from "./verification-helpers.mjs";

export const ANSWER_KEY_CONTROL_DEFINITIONS = Object.freeze([
  { label: "answer key with a type error in a fix", identity: "facilitator-answer-key-fix-typecheck" },
  { label: "answer key missing", identity: "facilitator-answer-key-fix-typecheck" },
  { label: "answer key body without its markers in another kit document", identity: "answer-key-exclusion" },
  { label: "code-to-path mapping in another kit document", identity: "answer-key-exclusion" },
  { label: "whole answer key under another extension", identity: "answer-key-exclusion" },
  { label: "answer key fix inside a packed artifact", identity: "answer-key-exclusion" },
  { label: "seeded-call document listing an expected code", identity: "answer-key-exclusion" },
]);

const [TYPE_ERROR_CONTROL, MISSING_KEY_CONTROL, MARKER_FREE_BODY_CONTROL, MAPPING_CONTROL, RENAMED_KEY_CONTROL, PACKED_FIX_CONTROL, SEEDED_CODE_CONTROL] = ANSWER_KEY_CONTROL_DEFINITIONS;
const KNOWN_ISSUES_PATH = "docs/known-issues.md";
const KNOWN_ISSUES_INSERTION_ANCHOR = "\n## 6. The Named-Method Input Types Require Context the Runtime Can Supply\n";
const RENAMED_KEY_PATH = "docs/notes.txt";
const SEEDED_DOCUMENT_PATH = "docs/seeded-invalid-calls.md";
const SEEDED_DOCUMENT_INSERTION_ANCHOR = "\n## Exercise 5: Prohibited Cleartext Credential in Payload\n";
const TYPE_ERROR_PROPERTY = "authenticated_principle";
const TYPE_ERROR_ANCHOR = "  authenticated_principal: principal,\n";
const TYPE_ERROR_FAILURE_MESSAGE = "failed with exit status 2";

async function withKitCopy(kitDir, tempPrefix, run) {
  const kitCopy = await mkdtemp(resolve(tmpdir(), tempPrefix));
  try {
    await cp(kitDir, kitCopy, { recursive: true });
    await run(kitCopy);
  } finally {
    await rm(kitCopy, { recursive: true, force: true });
  }
}

async function resealKit(kitCopy) {
  const identity = JSON.parse(await readFile(resolve(kitCopy, IDENTITY_FILE), "utf8"));
  await sealKitIdentity(kitCopy, identity);
}

async function withInstalledKit(kitDir, tempPrefix, run) {
  const tempInstall = await mkdtemp(resolve(tmpdir(), tempPrefix));
  try {
    await cp(kitDir, tempInstall, { recursive: true });
    runChecked("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline"], {
      cwd: tempInstall,
      capture: true,
    });
    await run(tempInstall);
  } finally {
    await rm(tempInstall, { recursive: true, force: true });
  }
}

async function rewriteMeasuredKitFile(kitCopy, measurements, path, rewrite) {
  const filePath = resolve(kitCopy, path);
  const original = await readFile(filePath, "utf8");
  const planted = rewrite(original);
  assert.notEqual(planted, original, `the measured plant must change ${path}`);
  const before = sha256Hex(original);
  await writeFile(filePath, planted, "utf8");
  const after = sha256Hex(await readFile(filePath));
  assert.notEqual(after, before, `the measured plant must change ${path}`);
  measurements.push({ path, before, after });
}

function removeAnswerKeyMarkers(answerKeyText) {
  let markerFree = answerKeyText;
  for (const marker of ANSWER_KEY_MARKERS) {
    const matches = markerFree.split(marker).length - 1;
    assert.equal(matches, 1, `answer-key marker must occur exactly once: ${marker}`);
    markerFree = markerFree.replace(marker, "");
  }
  return markerFree;
}

function insertPayloadAtAnchor(text, anchor, payload, label) {
  const matches = text.split(anchor).length - 1;
  assert.equal(matches, 1, `${label} plant anchor must occur exactly once`);
  return text.replace(anchor, `${anchor}\n${payload}`);
}

function replaceTypecheckedProperty(answerKeyText) {
  const matches = answerKeyText.split(TYPE_ERROR_ANCHOR).length - 1;
  assert.equal(matches, 1, "type-error answer-key anchor must occur exactly once");
  return answerKeyText.replace(TYPE_ERROR_ANCHOR, `  ${TYPE_ERROR_PROPERTY}: principal,\n`);
}

async function writeTemporaryAnswerKey(tempInstall, content) {
  const answerKeyPath = resolve(tempInstall, "temporary-answer-key.md");
  await writeFile(answerKeyPath, content, "utf8");
  return answerKeyPath;
}

async function assertUnmodifiedAnswerKeyTypechecks(control, tempInstall) {
  const original = await readFile(ANSWER_KEY_PATH, "utf8");
  const answerKeyPath = await writeTemporaryAnswerKey(tempInstall, original);
  const result = await runKitGateCheck({
    identity: control.identity,
    run: () => checkAnswerKeyFixTypecheck({ tempInstall, answerKeyPath }),
  });
  assert.equal(result.skipped, false, `${control.label} null control must run its direct check`);
}

async function plantTypeErrorAnswerKey(tempInstall, measurements) {
  const original = await readFile(ANSWER_KEY_PATH, "utf8");
  const planted = replaceTypecheckedProperty(original);
  const answerKeyPath = await writeTemporaryAnswerKey(tempInstall, planted);
  measurements.push({
    path: "temporary-answer-key.md",
    before: sha256Hex(original),
    after: sha256Hex(await readFile(answerKeyPath)),
  });
  return answerKeyPath;
}

async function plantMissingAnswerKey(tempInstall, measurements) {
  const original = await readFile(ANSWER_KEY_PATH, "utf8");
  const answerKeyPath = await writeTemporaryAnswerKey(tempInstall, original);
  await rm(answerKeyPath);
  measurements.push({ path: "temporary-answer-key.md", before: sha256Hex(original), after: null });
  return answerKeyPath;
}

async function plantMarkerFreeAnswerKey(kitCopy, measurements) {
  const answerKeyText = await readFile(ANSWER_KEY_PATH, "utf8");
  const markerFree = removeAnswerKeyMarkers(answerKeyText);
  await rewriteMeasuredKitFile(kitCopy, measurements, KNOWN_ISSUES_PATH, (text) =>
    insertPayloadAtAnchor(text, KNOWN_ISSUES_INSERTION_ANCHOR, markerFree, "marker-free answer key"),
  );
  await resealKit(kitCopy);
}

async function mappingPayload() {
  const recognizers = await createAnswerKeyContentRecognizers();
  const pairs = recognizers.mapping.pairs.slice(0, MAPPING_PAIR_THRESHOLD);
  assert.equal(pairs.length, MAPPING_PAIR_THRESHOLD, "the live answer key must supply every mapping control pair");
  return pairs.map(({ code, path }) => `Expected code: ${code}\nExpected path: ${path}`).join("\n\n");
}

async function plantCodeToPathMapping(kitCopy, measurements) {
  const payload = await mappingPayload();
  await rewriteMeasuredKitFile(kitCopy, measurements, KNOWN_ISSUES_PATH, (text) =>
    insertPayloadAtAnchor(text, KNOWN_ISSUES_INSERTION_ANCHOR, payload, "code-to-path mapping"),
  );
  await resealKit(kitCopy);
}

async function plantRenamedAnswerKey(kitCopy, measurements) {
  const path = resolve(kitCopy, RENAMED_KEY_PATH);
  assert.ok(!existsSync(path), `${RENAMED_KEY_PATH} must be absent before its plant`);
  await writeFile(path, await readFile(ANSWER_KEY_PATH, "utf8"), "utf8");
  const after = sha256Hex(await readFile(path));
  measurements.push({ path: RENAMED_KEY_PATH, before: "absent", after });
  await resealKit(kitCopy);
}

function coreArtifact(identity) {
  const artifact = identity.artifacts.find((candidate) => candidate.name === "core");
  assert.ok(artifact, "the base kit must contain the core artifact");
  return artifact;
}

async function plantFixInsideCoreArtifact(kitCopy, measurements) {
  const identity = JSON.parse(await readFile(resolve(kitCopy, IDENTITY_FILE), "utf8"));
  const artifact = coreArtifact(identity);
  const tarballPath = resolve(kitCopy, artifact.filename);
  const before = sha256Hex(await readFile(tarballPath));
  const extractionDir = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-answer-key-artifact-"));
  try {
    runChecked("tar", ["-xzf", tarballPath, "-C", extractionDir]);
    const answerKeyText = await readFile(ANSWER_KEY_PATH, "utf8");
    const blocks = extractTypeScriptDocBlocks(answerKeyText);
    assert.equal(blocks.length, EXPECTED_SEEDED_CALLS.length, "the answer key must retain one fix per seeded call");
    assert.ok(blocks[0], "the answer key must retain its first fix block");
    await writeFile(resolve(extractionDir, "package/dist/notes.ts"), `${blocks[0]}\n`, "utf8");
    runChecked("tar", ["-czf", tarballPath, "-C", extractionDir, "package"]);
    const after = sha256Hex(await readFile(tarballPath));
    assert.notEqual(after, before, "the answer-key artifact plant must change the core tarball");
    measurements.push({ path: artifact.filename, before, after });
    artifact.sha256 = after;
    await sealKitIdentity(kitCopy, identity);
  } finally {
    await rm(extractionDir, { recursive: true, force: true });
  }
}

async function plantSeededDocumentExpectedCode(kitCopy, measurements) {
  const expectedCode = EXPECTED_SEEDED_CALLS[0].code;
  await rewriteMeasuredKitFile(kitCopy, measurements, SEEDED_DOCUMENT_PATH, (text) => {
    assert.ok(!text.includes(expectedCode), `seeded document must not already name ${expectedCode}`);
    return insertPayloadAtAnchor(
      text,
      SEEDED_DOCUMENT_INSERTION_ANCHOR,
      `Expected code: ${expectedCode}\n`,
      "seeded-document expected-code",
    );
  });
  await resealKit(kitCopy);
}

const DIRECT_TYPECHECK_CONTROLS = Object.freeze([
  {
    definition: TYPE_ERROR_CONTROL,
    plant: plantTypeErrorAnswerKey,
    expected: TYPE_ERROR_FAILURE_MESSAGE,
  },
  {
    definition: MISSING_KEY_CONTROL,
    plant: plantMissingAnswerKey,
    expected: ANSWER_KEY_MISSING_MESSAGE,
  },
]);

const ANSWER_KEY_PLANTS = Object.freeze([
  {
    definition: MARKER_FREE_BODY_CONTROL,
    tempPrefix: "bloodtrail-ctrl-answer-key-marker-free-",
    apply: plantMarkerFreeAnswerKey,
    expected: "docs/known-issues.md (fix-code recognizer:",
  },
  {
    definition: MAPPING_CONTROL,
    tempPrefix: "bloodtrail-ctrl-answer-key-mapping-",
    apply: plantCodeToPathMapping,
    expected: "docs/known-issues.md (code-to-path mapping recognizer:",
  },
  {
    definition: RENAMED_KEY_CONTROL,
    tempPrefix: "bloodtrail-ctrl-answer-key-renamed-",
    apply: plantRenamedAnswerKey,
    expected: "docs/notes.txt (marker recognizer:",
  },
  {
    definition: PACKED_FIX_CONTROL,
    tempPrefix: "bloodtrail-ctrl-answer-key-artifact-",
    apply: plantFixInsideCoreArtifact,
    expected: "entry package/dist/notes.ts (fix-code recognizer:",
  },
  {
    definition: SEEDED_CODE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-seeded-code-",
    apply: plantSeededDocumentExpectedCode,
    expected: `kit docs/seeded-invalid-calls.md must not contain expected code ${EXPECTED_SEEDED_CALLS[0].code}`,
  },
]);

async function captureDirectTypecheckFailure({ control, tempInstall, answerKeyPath, disabledChecks }) {
  try {
    await runKitGateCheck({
      identity: control.identity,
      _disabledChecks: disabledChecks,
      run: () => checkAnswerKeyFixTypecheck({ tempInstall, answerKeyPath }),
    });
  } catch (error) {
    return error;
  }
  assert.fail(`${control.label} must fail closed`);
}

async function assertDirectTypecheckFailure({ control, tempInstall, answerKeyPath, disabledChecks, expected }) {
  const failure = await captureDirectTypecheckFailure({ control, tempInstall, answerKeyPath, disabledChecks });
  assert.equal(failure.checkIdentity, control.identity, `${control.label} must fail at its declared identity`);
  assert.ok(failure.cause.message.includes(expected), `${control.label} must report ${expected}: ${failure.cause.message}`);
}

async function checkDirectAnswerKeyTypecheck({ kitDir, disabledChecks, helpers, directControl }) {
  const control = controlFrom(helpers, directControl.definition);
  const measurements = [];
  await withInstalledKit(kitDir, "bloodtrail-ctrl-answer-key-typecheck-", async (tempInstall) => {
    if (directControl.definition === TYPE_ERROR_CONTROL) await assertUnmodifiedAnswerKeyTypechecks(control, tempInstall);
    const answerKeyPath = await directControl.plant(tempInstall, measurements);
    await assertDirectTypecheckFailure({ control, tempInstall, answerKeyPath, disabledChecks, expected: directControl.expected });
  });
  assert.equal(measurements.length, 1, `${control.label} must record one measured plant`);
  return helpers.completeControl(control, measurements);
}

function controlFrom(helpers, definition) {
  const control = helpers.controlFor(definition.label);
  assert.equal(control.identity, definition.identity, `${control.label} must retain its declared identity`);
  return control;
}

function assertPlantFailure(control, failure, expected) {
  assert.ok(failure.cause.message.includes(expected), `${control.label} must report ${expected}: ${failure.cause.message}`);
}

async function checkAnswerKeyPlant(kitDir, _disabledChecks, helpers, plant) {
  const control = controlFrom(helpers, plant.definition);
  const measurements = [];
  await withKitCopy(kitDir, plant.tempPrefix, async (kitCopy) => {
    await plant.apply(kitCopy, measurements);
    const failure = await helpers.captureGateFailure(control, kitCopy, { _disabledChecks });
    assertPlantFailure(control, failure, plant.expected);
  });
  assert.equal(measurements.length, 1, `${control.label} must record one measured plant`);
  return helpers.completeControl(control, measurements);
}

export function createAnswerKeyControlRunners(helpers) {
  return Object.freeze([
    ...DIRECT_TYPECHECK_CONTROLS.map((directControl) => [
      directControl.definition.label,
      ({ kitDir, _disabledChecks }) =>
        checkDirectAnswerKeyTypecheck({ kitDir, disabledChecks: _disabledChecks, helpers, directControl }),
    ]),
    ...ANSWER_KEY_PLANTS.map((plant) => [
      plant.definition.label,
      ({ kitDir, _disabledChecks }) => checkAnswerKeyPlant(kitDir, _disabledChecks, helpers, plant),
    ]),
  ]);
}
