// Parity gate for the bundled validator runtime code.
//
// The generator inlines the source text of vendor/bundled-validator-runtime.mjs
// and vendor/bundled-validator-formats.mjs into the generated standalone
// validator (per ADR-SDK-011). This test proves those bundled implementations
// are behavior-identical to the pinned dependency implementations they replace
// (ajv 8.20.0 runtime helper, ajv-formats 3.0.1 full formats), and that the
// pinned format entries keep the shapes the generated artifact depends on:
// fullFormats["date-time"] is a fmtDef object carrying .validate, while
// fullFormats.uri is a bare function.
import assert from "node:assert/strict";
import test from "node:test";

import { bundledUcs2length } from "../../vendor/bundled-validator-runtime.mjs";
import { bundledDateTimeValidate, bundledUriValidate } from "../../vendor/bundled-validator-formats.mjs";
import { createRequire } from "node:module";
import { fullFormats } from "ajv-formats/dist/formats.js";

const require = createRequire(import.meta.url);
const referenceUcs2length = require("ajv/dist/runtime/ucs2length").default;

const DATE_TIME_INPUTS = [
  "2026-08-16T10:30:00Z",
  "2026-08-16t10:30:00z",
  "2026-02-30T10:30:00Z",
  "2026-08-16T23:59:60Z",
  "2026-08-16T10:30:00+02:00",
  "2026-08-16T10:30:00.123456789Z",
  "2026-08-16 10:30:00Z",
  "2026-08-16T10:30:00",
  "not-a-date",
  "",
];

const URI_INPUTS = [
  "https://example.com/a?b=c#d",
  "urn:isbn:0451450523",
  "ftp://x",
  "//host/path",
  "http://",
  "%zz",
  "a b",
  "",
];

test("pinned ajv-formats entries keep the shapes the artifact depends on", () => {
  assert.equal(typeof fullFormats["date-time"], "object");
  assert.equal(typeof fullFormats["date-time"].validate, "function");
  assert.equal(typeof fullFormats.uri, "function");
  assert.equal(typeof bundledDateTimeValidate, "function");
  assert.equal(typeof bundledUriValidate, "function");
});

test("bundled date-time validator matches ajv-formats fullFormats date-time", () => {
  for (const input of DATE_TIME_INPUTS) {
    assert.equal(
      bundledDateTimeValidate(input),
      fullFormats["date-time"].validate(input),
      `date-time divergence on ${JSON.stringify(input)}`,
    );
  }
});

test("bundled uri validator matches ajv-formats fullFormats uri", () => {
  for (const input of URI_INPUTS) {
    assert.equal(
      bundledUriValidate(input),
      fullFormats.uri(input),
      `uri divergence on ${JSON.stringify(input)}`,
    );
  }
});

test("bundled ucs2length matches the ajv runtime helper", () => {
  const inputs = ["abc", "a", "", "\u00e9\u00e9", "\u{1F600}", "\u{1F600}a", "\uD83D", "\uD83Da"];
  for (const input of inputs) {
    assert.equal(
      bundledUcs2length(input),
      referenceUcs2length(input),
      `ucs2length divergence on ${JSON.stringify(input)}`,
    );
  }
  assert.equal(bundledUcs2length("\u{1F600}"), 1, "surrogate pair counts as one code point");
  assert.equal(bundledUcs2length("\uD83D"), 1, "lone high surrogate counts as one code unit");
});
