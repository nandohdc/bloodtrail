import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { serializeResults, writeResults } from "../lib/results.mjs";
import { fixtureResult } from "./results-fixture.mjs";

const REQUIRED = ["run_id", "started_at", "ended_at", "kit_identity", "install", "runtime", "environment", "authorization", "approval", "expectations", "cases", "invalidations", "occurrence_count", "permission_flags", "executed_file_hashes", "driver", "scratch_deletion"];

test("results retain observation/provenance shape with ordered keys and final newline", () => {
  const result = fixtureResult();
  for (const key of REQUIRED) assert(Object.hasOwn(result, key), key);
  const serialized = serializeResults(result);
  assert(serialized.endsWith("\n"));
  assert(serialized.includes('\n  "approval":'));
  assert.deepEqual(Object.keys(JSON.parse(serialized)), Object.keys(result).sort());
  assert.deepEqual(JSON.parse(serialized), result);
  assert.deepEqual(result.cases[0].raw.processes[0].ids.event_id, ["opaque-a"]);
  assert.equal(result.kit_identity.manifest_digest, "3".repeat(64));
  assert.deepEqual(result.kit_identity.artifacts, [{ filename: "fixture.tgz", sha256: "8".repeat(64) }]);
  assert.equal(result.install.lifecycle[0].install_lifecycle_absent, true);
  assert.deepEqual(result.install.single_core, { npm_ls_paths: ["/fixture/core"], filesystem_manifests: ["/fixture/core/package.json"] });
  assert.equal(result.install.declarations[0].name, "fixture");
  assert.deepEqual(result.install.declarations[0].declarations, [{ path: "fixture.d.ts", sha256: "9".repeat(64) }]);
  assert(!Object.hasOwn(result.cases[0], "expected"));
  const unicode = serializeResults({ "𐀀": 1, "\ue000": 2 });
  assert(unicode.indexOf("\ue000") < unicode.indexOf("𐀀"));
});

test("writer refuses overwrite and preserves structured failure results", () => {
  const directory = mkdtempSync(join(tmpdir(), "pids-results-fixture-"));
  try {
    const path = join(directory, "result.json");
    const result = fixtureResult({ invalidations: ["fixture setup refused"] });
    writeResults({ path, result });
    assert.deepEqual(JSON.parse(readFileSync(path, "utf8")), result);
    assert.throws(() => writeResults({ path, result }), { code: "EEXIST" });
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
