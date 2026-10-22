import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { deliverResults } from "../lib/results.mjs";
import { sha256 } from "../lib/io.mjs";
import { marker, RECIPES } from "../p-d/markers.mjs";
import { serializeMarkerResults } from "../p-d/serialize.mjs";
import { evaluateCases } from "../p-d/evaluate.mjs";
import { observationFixture } from "./pd-fixtures.mjs";

function resultFixture() {
  const input = observationFixture();
  const cases = evaluateCases(input);
  assert(cases.every((entry) => entry.matched), "evaluation must use real markers");
  const process = input.observations[0];
  process.all_markers = Object.fromEntries(Object.keys(RECIPES).map((name) => [marker(name), { value: marker(name), note: `path/${marker(name)}/suffix` }]));
  return { cases, process_observations: input.observations, invalidations: [] };
}

function assertSafe(text) {
  const value = JSON.parse(text);
  for (const name of Object.keys(RECIPES)) {
    const built = marker(name);
    assert.equal(text.includes(built), false, name);
    assert(text.includes(`<synthetic-marker:${name}>`), name);
    assert.deepEqual(value.synthetic_markers.find((entry) => entry.name === name), { name, length: built.length, sha256: sha256(built) });
  }
  const retained = value.process_observations[0].all_markers;
  for (const name of ["bearer16", "bearer15", "key16", "key15", "pluralValue", "pluralKey"]) {
    const ref = `<synthetic-marker:${name}>`;
    assert.equal(retained[ref].value, ref, "overlaps must retain the longest complete recipe name");
  }
}

test("post-evaluation serialization replaces every marker in nested keys, values, paths and notes", () => {
  const result = resultFixture();
  const before = structuredClone(result);
  assertSafe(serializeMarkerResults(result));
  assert.deepEqual(result, before, "serialization must not alter real observations or evaluation");
});

test("normal exclusive write and write-failure stderr use the same marker-safe representation", () => {
  const directory = mkdtempSync(join(tmpdir(), "pd-serialization-"));
  try {
    const path = join(directory, "fixture.json");
    const result = resultFixture();
    const options = { path, result, serialize: serializeMarkerResults };
    assert.equal(deliverResults(options), true);
    const written = readFileSync(path, "utf8");
    assertSafe(written);
    let fallback;
    assert.equal(deliverResults({ ...options, write: () => { throw new Error(`fixture ${marker("privateKey")}`); }, stderr: (text) => { fallback = text; } }), false);
    assertSafe(fallback);
    assert.equal(readFileSync(path, "utf8"), written, "no write retry or overwrite");
    assert(result.invalidations[0].includes(marker("privateKey")), "in-memory evidence stays real");
  } finally { rmSync(directory, { recursive: true, force: true }); }
});
