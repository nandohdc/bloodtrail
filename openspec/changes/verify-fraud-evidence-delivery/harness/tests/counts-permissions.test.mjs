import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { ingressFlags, senderFlags } from "../lib/permissions.mjs";

const service = realpathSync(fileURLToPath(new URL("../", import.meta.url)));
const script = fileURLToPath(new URL("./counts-environment-role.mjs", import.meta.url));

function runRole(flags) {
  return spawnSync(process.execPath, [...flags, script], {
    encoding: "utf8", env: { ...process.env, NODE_V8_COVERAGE: "" }, timeout: 60000,
  });
}

function assertLabel(result) {
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr);
  const label = JSON.parse(result.stdout);
  assert.equal(label.node, process.versions.node);
  assert.equal(label.platform, process.platform);
  assert(Number.isInteger(label.cpu_count) && label.cpu_count > 0);
}

test("environmentLabel works under the sender's real permission flags", () => {
  assertLabel(runRole(senderFlags({ service })));
});

test("environmentLabel works under the ingress's real permission flags", () => {
  const storage = realpathSync(mkdtempSync(join(tmpdir(), "counts-permissions-")));
  try {
    assertLabel(runRole(ingressFlags({ service, storage })));
  } finally {
    rmSync(storage, { recursive: true, force: true });
  }
});

test("environment role is refused when its read grant excludes the harness", () => {
  const storage = realpathSync(mkdtempSync(join(tmpdir(), "counts-permissions-")));
  try {
    const result = runRole(["--permission", `--allow-fs-read=${storage}`]);
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /ERR_ACCESS_DENIED/);
  } finally {
    rmSync(storage, { recursive: true, force: true });
  }
});
