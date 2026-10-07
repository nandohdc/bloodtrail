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
  { label: "invented API called behind await", identity: "document-references" },
  { label: "invented API called through optional chaining", identity: "document-references" },
  { label: "invented API called with type arguments", identity: "document-references" },
  { label: "invented API named without parentheses", identity: "document-references" },
  { label: "invented class constructed in a chain", identity: "document-references" },
  { label: "event field the contract does not have", identity: "document-references" },
  { label: "reviewed exception that matches no span", identity: "document-references" },
  { label: "planned feature row marked ready", identity: "planned-feature-documentation" },
  { label: "sentence saying the HTTP audit sink retries", identity: "planned-feature-documentation" },
  { label: "sentence saying events are queued", identity: "planned-feature-documentation" },
  { label: "support claim beside an unrelated negative word", identity: "planned-feature-documentation" },
  { label: "sentence saying OpenTelemetry transport works", identity: "planned-feature-documentation" },
  { label: "planned row not named in glossary terms", identity: "planned-feature-documentation" },
  { label: "reviewed section that covers no planned feature", identity: "planned-feature-documentation" },
  { label: "real host in a kit document link", identity: "synthetic-values" },
  { label: "email address in a kit document", identity: "synthetic-values" },
  { label: "production environment name in a kit document", identity: "synthetic-values" },
  { label: "non-documentation IP address in an example", identity: "synthetic-values" },
  { label: "bare real domain in a kit document", identity: "synthetic-values" },
]);

const [
  CASE_FENCE_CONTROL,
  INFO_STRING_FENCE_CONTROL,
  TSX_FENCE_CONTROL,
  BARE_FENCE_CONTROL,
  WRONG_VALUE_CONTROL,
  AWAIT_REFERENCE_CONTROL,
  OPTIONAL_CHAIN_REFERENCE_CONTROL,
  TYPE_ARGUMENT_REFERENCE_CONTROL,
  BARE_NAME_REFERENCE_CONTROL,
  CONSTRUCTED_CHAIN_REFERENCE_CONTROL,
  EVENT_FIELD_REFERENCE_CONTROL,
  STALE_EXCEPTION_CONTROL,
  READY_ROW_CONTROL,
  HTTP_SINK_RETRIES_CONTROL,
  QUEUED_EVENTS_CONTROL,
  UNRELATED_NEGATIVE_WORD_CONTROL,
  OPEN_TELEMETRY_WORKS_CONTROL,
  NON_GLOSSARY_ROW_CONTROL,
  STALE_REVIEWED_SECTION_CONTROL,
  REAL_HOST_LINK_CONTROL,
  EMAIL_ADDRESS_CONTROL,
  PRODUCTION_ENVIRONMENT_CONTROL,
  NON_DOCUMENTATION_IP_CONTROL,
  BARE_REAL_DOMAIN_CONTROL,
] = DOCUMENT_CONTROL_DEFINITIONS;
const DOCUMENT_PATH = "docs/quickstart.md";
const INSERTION_ANCHOR = "## Package Responsibilities\n";
const TYPE_ERROR = 'const documentFenceTypeError: number = "not-a-number";';
const FENCE_CLOSING = "```";
const DELIVERY_RETRY_ROW = "| **Delivery retry by the HTTP audit sink, in process or durable** | **Planned (Not Implemented)** |";
const READY_DELIVERY_RETRY_ROW = "| **Delivery retry by the HTTP audit sink, in process or durable** | **✅ Ready** |";
const RETRIES_DELIVERY_ROW = "| **Retries** | **Planned (Not Implemented)** |";
const STALE_REVIEWED_SECTION_ANCHOR = "above the raw handoff, the retry-wrapped delivery, or the backpressure gate.";
const STALE_REVIEWED_SECTION_REPLACEMENT = "above the raw handoff or the backpressure gate.";

// In the Express framework snippet, the expected status after the synthetic denied request: a wrong value
// still type-checks, and only running the block catches the failed assertion.
const WRONG_VALUE_DOCUMENT_PATH = "docs/integration-and-testing.md";
const WRONG_VALUE_ANCHOR =
  'await deniedHandler({ ip: "127.0.0.1", get: () => "req-express-synthetic-1" }, response);\nassert.equal(statusCode, 403);';
const WRONG_VALUE_REPLACEMENT = WRONG_VALUE_ANCHOR.replace(
  "assert.equal(statusCode, 403);",
  "assert.equal(statusCode, 400);",
);

// The stale plant removes the backticks around the reviewed `token` span, so the exception entry matches
// no span any longer.
const STALE_EXCEPTION_ANCHOR = "`token`";

// Every document plant makes one measured change to a kit copy: it asserts that its anchor occurs exactly
// once in its host document, then inserts relative to that anchor or replaces it. Each plant is resealed
// so the planted defect, not the identity check, is what the gate meets.
const DOCUMENT_PLANTS = Object.freeze([
  {
    definition: CASE_FENCE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-document-fence-",
    documentPath: DOCUMENT_PATH,
    anchor: INSERTION_ANCHOR,
    opening: "```TypeScript",
    body: TYPE_ERROR,
    recordLabel: "case-varied TypeScript fence",
    rewrite: insertFence,
    assertFailure: assertTypecheckFailure,
  },
  {
    definition: INFO_STRING_FENCE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-document-fence-",
    documentPath: DOCUMENT_PATH,
    anchor: INSERTION_ANCHOR,
    opening: '```ts title="example.ts"',
    body: TYPE_ERROR,
    recordLabel: "TypeScript fence with an info string",
    rewrite: insertFence,
    assertFailure: assertTypecheckFailure,
  },
  {
    definition: TSX_FENCE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-document-fence-",
    documentPath: DOCUMENT_PATH,
    anchor: "## Runtime & Prerequisites\n",
    opening: "```tsx",
    body: "",
    shownLanguage: "tsx",
    recordLabel: "tsx-fenced block",
    rewrite: insertFence,
    assertFailure: assertFenceLanguageFailure,
  },
  {
    definition: BARE_FENCE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-document-fence-",
    documentPath: DOCUMENT_PATH,
    anchor: "## Installation\n",
    opening: FENCE_CLOSING,
    body: "",
    shownLanguage: "(none)",
    recordLabel: "fence that names no language",
    rewrite: insertFence,
    assertFailure: assertFenceLanguageFailure,
  },
  {
    definition: WRONG_VALUE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-document-value-",
    documentPath: WRONG_VALUE_DOCUMENT_PATH,
    recordLabel: WRONG_VALUE_CONTROL.label,
    rewrite: rewriteWrongExpectedValue,
    assertFailure: assertWrongValueFailure,
  },
  {
    definition: AWAIT_REFERENCE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-document-reference-",
    documentPath: DOCUMENT_PATH,
    anchor: "## Emitting Authentication Success\n",
    line: "Call `await sdk.commitOperation()` to commit the operation.\n",
    span: "await sdk.commitOperation()",
    recordLabel: "await sdk.commitOperation() reference",
    rewrite: insertReferenceLine,
    assertFailure: assertReferenceFailure,
  },
  {
    definition: OPTIONAL_CHAIN_REFERENCE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-document-reference-",
    documentPath: DOCUMENT_PATH,
    anchor: "## Authentication Failure and Per-Request Context Scope\n",
    line: "Call `sdk?.commitOperation()` to commit the operation.\n",
    span: "sdk?.commitOperation()",
    recordLabel: "sdk?.commitOperation() reference",
    rewrite: insertReferenceLine,
    assertFailure: assertReferenceFailure,
  },
  {
    definition: TYPE_ARGUMENT_REFERENCE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-document-reference-",
    documentPath: DOCUMENT_PATH,
    anchor: "## Sensitive Resource Operations: View and Committed Modification\n",
    line: "Read events with `sdk.readEvents<SecurityAuditEvent>()`.\n",
    span: "sdk.readEvents<SecurityAuditEvent>()",
    recordLabel: "sdk.readEvents<SecurityAuditEvent>() reference",
    rewrite: insertReferenceLine,
    assertFailure: assertReferenceFailure,
  },
  {
    definition: BARE_NAME_REFERENCE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-document-reference-",
    documentPath: DOCUMENT_PATH,
    anchor: "## Package Responsibilities\n",
    line: "Call `markCommit` to mark the operation.\n",
    span: "markCommit",
    recordLabel: "markCommit reference",
    rewrite: insertReferenceLine,
    assertFailure: assertReferenceFailure,
  },
  {
    definition: CONSTRUCTED_CHAIN_REFERENCE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-document-reference-",
    documentPath: DOCUMENT_PATH,
    anchor: "## Running the Example Service and Receiver\n",
    line: "Start the audit runner with `new AuditQueue().start()`.\n",
    span: "new AuditQueue().start()",
    recordLabel: "new AuditQueue().start() reference",
    rewrite: insertReferenceLine,
    assertFailure: assertReferenceFailure,
  },
  {
    definition: EVENT_FIELD_REFERENCE_CONTROL,
    tempPrefix: "bloodtrail-ctrl-document-reference-",
    documentPath: "docs/known-issues.md",
    anchor: "## 3. Contract Clock-Skew Bound is Not Enforced for Complete Events\n",
    line: "The clock-skew bound compares `occurred_at` to processing time.\n",
    span: "occurred_at",
    recordLabel: "occurred_at reference",
    rewrite: insertReferenceLine,
    assertFailure: assertReferenceFailure,
  },
  {
    definition: STALE_EXCEPTION_CONTROL,
    tempPrefix: "bloodtrail-ctrl-stale-exception-",
    documentPath: "docs/privacy.md",
    recordLabel: STALE_EXCEPTION_CONTROL.label,
    rewrite: removeTokenBackticks,
    assertFailure: assertStaleExceptionFailure,
  },
  {
    definition: READY_ROW_CONTROL,
    tempPrefix: "bloodtrail-ctrl-planned-row-ready-",
    documentPath: "docs/supported-and-planned.md",
    anchor: DELIVERY_RETRY_ROW,
    replacement: READY_DELIVERY_RETRY_ROW,
    recordLabel: READY_ROW_CONTROL.label,
    rule: "planned row status rule",
    rewrite: replaceAnchoredText,
    assertFailure: assertDeliveryRetryFailure,
  },
  {
    definition: HTTP_SINK_RETRIES_CONTROL,
    tempPrefix: "bloodtrail-ctrl-http-sink-retries-",
    documentPath: DOCUMENT_PATH,
    anchor: INSERTION_ANCHOR,
    line: "The HTTP sink retries 429 and 503 responses with exponential backoff.\n",
    recordLabel: HTTP_SINK_RETRIES_CONTROL.label,
    rule: "sentence marker rule",
    rewrite: insertReferenceLine,
    assertFailure: assertDeliveryRetryFailure,
  },
  {
    definition: QUEUED_EVENTS_CONTROL,
    tempPrefix: "bloodtrail-ctrl-queued-events-",
    documentPath: DOCUMENT_PATH,
    anchor: INSERTION_ANCHOR,
    line: "Events are queued in memory and flushed in the background.\n",
    recordLabel: QUEUED_EVENTS_CONTROL.label,
    rule: "sentence marker rule",
    rewrite: insertReferenceLine,
    assertFailure: assertQueueFailure,
  },
  {
    definition: UNRELATED_NEGATIVE_WORD_CONTROL,
    tempPrefix: "bloodtrail-ctrl-unrelated-negative-",
    documentPath: DOCUMENT_PATH,
    anchor: INSERTION_ANCHOR,
    line: "Retries are supported without any configuration.\n",
    recordLabel: UNRELATED_NEGATIVE_WORD_CONTROL.label,
    rule: "sentence marker rule",
    rewrite: insertReferenceLine,
    assertFailure: assertDeliveryRetryFailure,
  },
  {
    definition: OPEN_TELEMETRY_WORKS_CONTROL,
    tempPrefix: "bloodtrail-ctrl-opentelemetry-works-",
    documentPath: DOCUMENT_PATH,
    anchor: INSERTION_ANCHOR,
    line: "OpenTelemetry transport works out of the box with the HTTP sink.\n",
    recordLabel: OPEN_TELEMETRY_WORKS_CONTROL.label,
    rule: "sentence marker rule",
    rewrite: insertReferenceLine,
    assertFailure: assertOpenTelemetryFailure,
  },
  {
    definition: NON_GLOSSARY_ROW_CONTROL,
    tempPrefix: "bloodtrail-ctrl-non-glossary-row-",
    documentPath: "docs/supported-and-planned.md",
    anchor: DELIVERY_RETRY_ROW,
    replacement: RETRIES_DELIVERY_ROW,
    recordLabel: NON_GLOSSARY_ROW_CONTROL.label,
    rule: "glossary term rule",
    rewrite: replaceAnchoredText,
    assertFailure: assertDeliveryRetryFailure,
  },
  {
    definition: STALE_REVIEWED_SECTION_CONTROL,
    tempPrefix: "bloodtrail-ctrl-stale-reviewed-section-",
    documentPath: "docs/node-readme.md",
    anchor: STALE_REVIEWED_SECTION_ANCHOR,
    replacement: STALE_REVIEWED_SECTION_REPLACEMENT,
    recordLabel: STALE_REVIEWED_SECTION_CONTROL.label,
    rewrite: replaceAnchoredText,
    assertFailure: assertStaleReviewedSectionFailure,
  },
  {
    definition: REAL_HOST_LINK_CONTROL,
    tempPrefix: "bloodtrail-ctrl-real-host-link-",
    documentPath: DOCUMENT_PATH,
    anchor: INSERTION_ANCHOR,
    // The leading link proves a scheme URL host stops before its query rather than relying on bare-domain matching.
    line: "[query](https://audit.corp?fixture=1)\n[ingest](https://audit.acme-corp.com/v1/security-audit)\n",
    kind: "host",
    value: "audit.acme-corp.com",
    regressionValue: "audit.corp",
    recordLabel: REAL_HOST_LINK_CONTROL.label,
    rewrite: insertReferenceLine,
    assertFailure: assertSyntheticValueFailure,
  },
  {
    definition: EMAIL_ADDRESS_CONTROL,
    tempPrefix: "bloodtrail-ctrl-email-address-",
    documentPath: DOCUMENT_PATH,
    anchor: INSERTION_ANCHOR,
    line: "Contact security@acme-corp.com for the evaluation fixture.\n",
    kind: "email address",
    value: "security@acme-corp.com",
    recordLabel: EMAIL_ADDRESS_CONTROL.label,
    rewrite: insertReferenceLine,
    assertFailure: assertSyntheticValueFailure,
  },
  {
    definition: PRODUCTION_ENVIRONMENT_CONTROL,
    tempPrefix: "bloodtrail-ctrl-production-environment-",
    documentPath: DOCUMENT_PATH,
    anchor: INSERTION_ANCHOR,
    line: "`environment: { name: \"production\" }`\n",
    kind: "environment name",
    value: "production",
    recordLabel: PRODUCTION_ENVIRONMENT_CONTROL.label,
    rewrite: insertReferenceLine,
    assertFailure: assertSyntheticValueFailure,
  },
  {
    definition: NON_DOCUMENTATION_IP_CONTROL,
    tempPrefix: "bloodtrail-ctrl-non-documentation-ip-",
    documentPath: "examples/first-event.ts",
    anchor: "const captured: SecurityAuditEvent[] = [];\n",
    line: "// 10.20.30.40\n",
    kind: "IP address",
    value: "10.20.30.40",
    recordLabel: NON_DOCUMENTATION_IP_CONTROL.label,
    rewrite: insertReferenceLine,
    assertFailure: assertSyntheticValueFailure,
  },
  {
    definition: BARE_REAL_DOMAIN_CONTROL,
    tempPrefix: "bloodtrail-ctrl-bare-real-domain-",
    documentPath: "docs/privacy.md",
    anchor: "## 4. Heuristic Prohibited-Data Value Scan\n",
    line: "The evaluation fixture does not send data to audit.acme-corp.com.\n",
    kind: "host",
    value: "audit.acme-corp.com",
    recordLabel: BARE_REAL_DOMAIN_CONTROL.label,
    rewrite: insertReferenceLine,
    assertFailure: assertSyntheticValueFailure,
  },
]);

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

function insertReferenceLine(text, plant) {
  const matches = text.split(plant.anchor).length - 1;
  assert.equal(matches, 1, `${plant.recordLabel} plant anchor must occur exactly once in ${plant.documentPath}`);
  return text.replace(plant.anchor, `${plant.anchor}${plant.line}`);
}

function removeTokenBackticks(text) {
  const matches = text.split(STALE_EXCEPTION_ANCHOR).length - 1;
  assert.equal(matches, 1, "stale exception anchor must occur exactly once in docs/privacy.md");
  return text.replace(STALE_EXCEPTION_ANCHOR, "token");
}

function replaceAnchoredText(text, plant) {
  const matches = text.split(plant.anchor).length - 1;
  assert.equal(matches, 1, `${plant.recordLabel} plant anchor must occur exactly once in ${plant.documentPath}`);
  return text.replace(plant.anchor, plant.replacement);
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
  const planted = rewrite(original, plant);
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

function assertReferenceFailure(control, failure, plant) {
  assert.ok(
    failure.cause.message.includes(`${plant.documentPath}: \`${plant.span}\`: `),
    `${control.label} must name its span: ${failure.cause.message}`,
  );
}

function assertStaleExceptionFailure(control, failure) {
  assert.ok(
    failure.cause.message.includes("docs/privacy.md: reviewed exception `token` matches no span"),
    `${control.label} must name the stale entry: ${failure.cause.message}`,
  );
}

function assertPlannedFeatureFailure(control, failure, plant, feature) {
  assert.ok(
    failure.cause.message.includes(`${plant.documentPath} line `),
    `${control.label} must name ${plant.documentPath}: ${failure.cause.message}`,
  );
  assert.ok(
    failure.cause.message.includes(feature),
    `${control.label} must name ${feature}: ${failure.cause.message}`,
  );
  if (plant.rule) {
    assert.ok(
      failure.cause.message.includes(plant.rule),
      `${control.label} must name ${plant.rule}: ${failure.cause.message}`,
    );
  }
}

function assertDeliveryRetryFailure(control, failure, plant) {
  assertPlannedFeatureFailure(control, failure, plant, "Delivery retry by the HTTP audit sink, in process or durable");
}

function assertQueueFailure(control, failure, plant) {
  assertPlannedFeatureFailure(control, failure, plant, "Queues");
}

function assertOpenTelemetryFailure(control, failure, plant) {
  assertPlannedFeatureFailure(control, failure, plant, "OpenTelemetry transport");
}

function assertStaleReviewedSectionFailure(control, failure, plant) {
  assertPlannedFeatureFailure(control, failure, plant, "Deadline-bounded delivery shutdown");
  assert.ok(
    failure.cause.message.includes("stale reviewed-pair rule"),
    `${control.label} must name its stale reviewed pair: ${failure.cause.message}`,
  );
}

function assertSyntheticValueFailure(control, failure, plant) {
  assert.ok(
    failure.cause.message.includes(`${plant.documentPath} line `),
    `${control.label} must name ${plant.documentPath}: ${failure.cause.message}`,
  );
  assert.ok(
    failure.cause.message.includes(`${plant.kind} "${plant.value}"`),
    `${control.label} must name its ${plant.kind} value ${plant.value}: ${failure.cause.message}`,
  );
  if (plant.regressionValue) {
    assert.ok(
      failure.cause.message.includes(`${plant.kind} "${plant.regressionValue}"`),
      `${control.label} must reject the URL-query host ${plant.regressionValue}: ${failure.cause.message}`,
    );
  }
}

async function checkDocumentPlantControl(kitDir, _disabledChecks, helpers, plant) {
  const control = controlFrom(helpers, plant.definition);
  const measurements = [];
  await withKitCopy(kitDir, plant.tempPrefix, async (kitCopy) => {
    await plantDocument(kitCopy, measurements, plant, plant.rewrite);
    const failure = await helpers.captureGateFailure(control, kitCopy, { _disabledChecks });
    plant.assertFailure(control, failure, plant);
  });
  assert.equal(measurements.length, 1, `${plant.recordLabel} control must record one measured plant`);
  return helpers.completeControl(control, measurements);
}

export function createDocumentControlRunners(helpers) {
  return Object.freeze(
    DOCUMENT_PLANTS.map((plant) => [
      plant.definition.label,
      ({ kitDir, _disabledChecks }) => checkDocumentPlantControl(kitDir, _disabledChecks, helpers, plant),
    ]),
  );
}
