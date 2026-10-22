import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { executingCheckout, harnessInventory } from "../lib/repository.mjs";
import { copyApprovedFiles } from "../lib/launcher.mjs";
import { CHANGE } from "../lib/results.mjs";
import { sha256 } from "../lib/io.mjs";
import { preflightFixture } from "./approval-fixture.mjs";

test("approved inventory covers every tracked harness file including parent modules and rejects changed bytes", () => {
  const directory = mkdtempSync(join(tmpdir(), "pids-inventory-fixture-"));
  try {
    const { options, entrypoint } = preflightFixture({ directory });
    const alias = join(directory, "alias");
    symlinkSync(options.repo, alias);
    executingCheckout({ entrypoint, repo: alias });
    const prefix = `${CHANGE}/harness`;
    const hashes = harnessInventory({ ...options, prefix });
    assert.deepEqual(Object.keys(hashes), [`${prefix}/fixture.mjs`, `${prefix}/lib/parent.mjs`]);
    for (const [path, entry] of Object.entries(hashes)) {
      assert.match(entry.git_blob, /^[0-9a-f]{40}$/);
      assert.equal(entry.sha256, sha256(readFileSync(join(options.repo, path))));
    }
    const service = join(directory, "service"); mkdirSync(service);
    copyApprovedFiles({ ...options, prefix, service, paths: [`${prefix}/fixture.mjs`] });
    assert.equal(Object.keys(hashes).length, 2, "copy subset must not replace full inventory");
    writeFileSync(join(options.repo, prefix, "lib/parent.mjs"), "// changed parent\n");
    assert.throws(() => harnessInventory({ ...options, prefix }), /differs from approved Git blob/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
