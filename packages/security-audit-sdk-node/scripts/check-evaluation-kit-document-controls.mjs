import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { sealKitIdentity } from "./build-evaluation-kit.mjs";
import { IDENTITY_FILE, sha256Hex } from "./evaluation-kit-checksums.mjs";

export const DOCUMENT_CONTROL_DEFINITIONS = Object.freeze([
  { label: "TypeScript block fenced in another letter case", identity: "kit-source-typecheck" },
  { label: "TypeScript block fenced with an info string", identity: "kit-source-typecheck" },
  { label: "tsx-fenced block", identity: "document-fence-languages" },
  { label: "fence that names no language", identity: "document-fence-languages" },
  { label: "runnable block with a wrong expected value", identity: "document-block-execution" },
]);

const [
  CASE_FENCE_CONTROL,
  INFO_STRING_FENCE_CONTROL,
  TSX_FENCE_CONTROL,
  BARE_FENCE_CONTROL,
  WRONG_VALUE_CONTROL,
] = DOCUMENT_CONTROL_DEFINITIONS;
const DOCUMENT_PATH = "docs/quickstart.md";
const INSERTION_ANCHOR = "## Package Responsibilities\n";
const TYPE_ERROR = 'const documentFenceTypeError: number = "not-a-number";';
const FENCE_CLOSING = "```";

// Every plant inserts a fence whose opening names its defect; each anchor occurs exactly once in the host
// document, and the fence-language plants must trip only their declared check.
const FENCE_PLANTS = Object.freeze([
  {
    definition: CASE_FENCE_CONTROL,
    anchor: INSERTION_ANCHOR,
    opening: "```TypeScript",
    body: TYPE_ERROR,
    documentPath: DOCUMENT_PATH,
    recordLabel: "case-varied TypeScript fence",
    assertFailure: assertTypecheckFailure,
  },
  {
    definition: INFO_STRING_FENCE_CONTROL,
    anchor: INSERTION_ANCHOR,
    opening: '```ts title="example.ts"',
    body: TYPE_ERROR,
    documentPath: DOCUMENT_PATH,
    recordLabel: "TypeScript fence with an info string",
    assertFailure: assertTypecheckFailure,
  },
  {
    definition: TSX_FENCE_CONTROL,
    anchor: "## Runtime & Prerequisites\n",
    opening: "```tsx",
    body: "",
    documentPath: DOCUMENT_PATH,
    shownLanguage: "tsx",
    recordLabel: "tsx-fenced block",
    assertFailure: assertFenceLanguageFailure,
  },
  {
    definition: BARE_FENCE_CONTROL,
    anchor: "## Installation\n",
    opening: FENCE_CLOSING,
    body: "",
    documentPath: DOCUMENT_PATH,
    shownLanguage: "(none)",
    recordLabel: "fence that names no language",
    assertFailure: assertFenceLanguageFailure,
  },
]);

// In the Express framework snippet, the expected status after the synthetic denied request: a wrong value
// still type-checks, and only running the block catches the failed assertion.
const WRONG_VALUE_DOCUMENT_PATH = "docs/integration-and-testing.md";
const WRONG_VALUE_ANCHOR =
  'await deniedHandler({ ip: "127.0.0.1", get: () => "req-express-synthetic-1" }, response);\nassert.equal(statusCode, 403);';
const WRONG_VALUE_REPLACEMENT = WRONG_VALUE_ANCHOR.replace(
  "assert.equal(statusCode, 403);",
  "assert.equal(statusCode, 400);",
);

async function withKitCopy(kitDir, tempPrefix, run) {
  const kitCopy = await mkdtemp(resolve(tmpdir(), tempPrefix));
  try {
    await cp(kitDir, kitCopy, { recursive: true });
    await run(kitCopy);
  } finally {
    await rm(kitCopy, { recursive: true, force: true });
  }
}

function insertFence(text, plant) {
  const matches = text.split(plant.anchor).length - 1;
  assert.equal(matches, 1, `${plant.recordLabel} plant anchor must occur exactly once in ${plant.documentPath}`);
  const payload = `\n${plant.opening}\n${plant.body}\n${FENCE_CLOSING}\n`;
  return text.replace(plant.anchor, `${plant.anchor}${payload}`);
}

function rewriteWrongExpectedValue(text) {
  const matches = text.split(WRONG_VALUE_ANCHOR).length - 1;
  assert.equal(matches, 1, "wrong-value plant anchor must occur exactly once in docs/integration-and-testing.md");
  return text.replace(WRONG_VALUE_ANCHOR, WRONG_VALUE_REPLACEMENT);
}

async function resealKit(kitCopy) {
  const identity = JSON.parse(await readFile(resolve(kitCopy, IDENTITY_FILE), "utf8"));
  await sealKitIdentity(kitCopy, identity);
}

// Measures the rewrite of a kit-copy document, writes it, and reseals the copy so the planted defect, not
// the identity check, is what the gate meets.
async function plantDocument(kitCopy, measurements, plant, rewrite) {
  const documentPath = resolve(kitCopy, plant.documentPath);
  const original = await readFile(documentPath, "utf8");
  const planted = rewrite(original);
  assert.notEqual(planted, original, `${plant.recordLabel} plant must change ${plant.documentPath}`);
  const before = sha256Hex(original);
  await writeFile(documentPath, planted, "utf8");
  const after = sha256Hex(await readFile(documentPath));
  assert.notEqual(after, before, `${plant.recordLabel} plant must change ${plant.documentPath}`);
  measurements.push({ path: plant.documentPath, before, after });
  await resealKit(kitCopy);
}

function controlFrom(helpers, definition) {
  const control = helpers.controlFor(definition.label);
  assert.equal(control.identity, definition.identity, `${control.label} must retain its declared identity`);
  return control;
}

function assertTypecheckFailure(control, failure, plant) {
  assert.ok(
    failure.cause.message.includes("failed with exit status 2"),
    `${control.label} must fail ${plant.documentPath} at the TypeScript typecheck: ${failure.cause.message}`,
  );
}

function assertFenceLanguageFailure(control, failure, plant) {
  assert.ok(
    failure.cause.message.includes(`${plant.documentPath} line `),
    `${control.label} must name the document and its fence line: ${failure.cause.message}`,
  );
  assert.ok(
    failure.cause.message.includes(`fence language ${plant.shownLanguage} is not allowlisted`),
    `${control.label} must show fence language ${plant.shownLanguage}: ${failure.cause.message}`,
  );
}

function assertWrongValueFailure(control, failure) {
  assert.ok(
    failure.cause.message.includes(`${WRONG_VALUE_DOCUMENT_PATH} block `),
    `${control.label} must name the document and its block: ${failure.cause.message}`,
  );
  assert.ok(
    failure.cause.message.includes("exit status 1"),
    `${control.label} must fail at the block's assertion: ${failure.cause.message}`,
  );
}

async function checkFencePlantControl(kitDir, _disabledChecks, helpers, plant) {
  const control = controlFrom(helpers, plant.definition);
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-document-fence-", async (kitCopy) => {
    await plantDocument(kitCopy, measurements, plant, (text) => insertFence(text, plant));
    const failure = await helpers.captureGateFailure(control, kitCopy, { _disabledChecks });
    plant.assertFailure(control, failure, plant);
  });
  assert.equal(measurements.length, 1, `${plant.recordLabel} control must record one measured plant`);
  return helpers.completeControl(control, measurements);
}

async function checkWrongValuePlantControl(kitDir, _disabledChecks, helpers) {
  const plant = {
    definition: WRONG_VALUE_CONTROL,
    documentPath: WRONG_VALUE_DOCUMENT_PATH,
    recordLabel: WRONG_VALUE_CONTROL.label,
  };
  const control = controlFrom(helpers, WRONG_VALUE_CONTROL);
  const measurements = [];
  await withKitCopy(kitDir, "bloodtrail-ctrl-document-value-", async (kitCopy) => {
    await plantDocument(kitCopy, measurements, plant, rewriteWrongExpectedValue);
    const failure = await helpers.captureGateFailure(control, kitCopy, { _disabledChecks });
    assertWrongValueFailure(control, failure);
  });
  assert.equal(measurements.length, 1, "wrong-value control must record one measured plant");
  return helpers.completeControl(control, measurements);
}

export function createDocumentControlRunners(helpers) {
  const runners = FENCE_PLANTS.map((plant) => [
    plant.definition.label,
    ({ kitDir, _disabledChecks }) => checkFencePlantControl(kitDir, _disabledChecks, helpers, plant),
  ]);
  runners.push([
    WRONG_VALUE_CONTROL.label,
    ({ kitDir, _disabledChecks }) => checkWrongValuePlantControl(kitDir, _disabledChecks, helpers),
  ]);
  return Object.freeze(runners);
}
