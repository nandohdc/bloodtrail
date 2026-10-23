import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import { ingressFlags, prepareStorage, roleFlags, senderFlags, storageDirectory } from "../lib/permissions.mjs";
import { deleteScratch, finalizeScratch } from "../lib/kit-pipeline.mjs";

function layout() {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "stage-2-permissions-fixture-")));
  const scratch = join(root, "scratch");
  const repo = join(root, "repo");
  const service = join(scratch, "own-service");
  for (const path of [scratch, repo, service]) mkdirSync(path, { recursive: true });
  return { root, scratch, repo, service };
}

test("the sender may read its own service and use the network; the ingress may also write its storage", () => {
  assert.deepEqual(senderFlags({ service: "/s" }), ["--permission", "--allow-net", "--allow-fs-read=/s"]);
  assert.deepEqual(ingressFlags({ service: "/s", storage: "/d" }), ["--permission", "--allow-net", "--allow-fs-read=/s", "--allow-fs-read=/d", "--allow-fs-write=/d"]);
  assert.deepEqual(roleFlags({ role: "sender", service: "/s", storage: "/d" }), senderFlags({ service: "/s" }));
  assert.throws(() => roleFlags({ role: "orchestrator", service: "/s", storage: "/d" }), /unknown role/);
  for (const flags of [senderFlags({ service: "/s" }), ingressFlags({ service: "/s", storage: "/d" })]) {
    assert(!flags.some((flag) => flag.startsWith("--allow-child-process") || flag.startsWith("--allow-worker") || flag.startsWith("--allow-addons")));
  }
});

test("collector storage lives inside scratch, apart from the repository and the own service", () => {
  const { root, scratch, repo, service } = layout();
  try {
    const storage = prepareStorage({ scratch, repo, service });
    assert.equal(storage, join(scratch, "collector-storage"));
    assert.throws(() => storageDirectory({ scratch, repo, service, directory: service }), /overlaps a protected tree/);
    mkdirSync(join(service, "inner"));
    assert.throws(() => storageDirectory({ scratch, repo, service, directory: join(service, "inner") }), /overlaps a protected tree/);
    assert.throws(() => storageDirectory({ scratch, repo, service, directory: repo }));
    assert.throws(() => storageDirectory({ scratch: root, repo, service, directory: storage }), /overlaps a protected tree/, "a scratch that contains the repository is refused");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("scratch deletion is proven, and a failed deletion becomes an invalidation", () => {
  const { root, scratch } = layout();
  try {
    assert.equal(deleteScratch({ scratch }).recursively_absent, true);
    assert(!existsSync(scratch));
    const result = finalizeScratch({ result: { invalidations: [] }, scratch, remove: () => { throw new Error("busy"); } });
    assert.deepEqual(result.scratch_deletion, { root: scratch, recursively_absent: false });
    assert.deepEqual(result.invalidations, [{ message: "scratch deletion failed: busy" }]);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

// The write control runs under a real permission grant in a child process, as in the sender: no write
// grant, a read grant over the harness. Its null control (a read inside the grant) must pass, and a read
// outside the grant must make the control fail rather than hold.
test("planted defect and null control: under --permission the write is refused and a granted read passes", () => {
  const harness = dirname(dirname(fileURLToPath(import.meta.url)));
  const { root } = layout();
  try {
    const controls = pathToFileURL(join(harness, "lib", "controls.mjs")).href;
    const run = (allowedReadPath) => JSON.parse(execFileSync(process.execPath, [
      "--permission", `--allow-fs-read=${harness}`, "--input-type=module", "-e",
      `import { writeControls } from ${JSON.stringify(controls)}; console.log(JSON.stringify(writeControls({ refusedPath: ${JSON.stringify(join(root, "planted"))}, allowedReadPath: ${JSON.stringify(allowedReadPath)} })));`,
    ], { encoding: "utf8" }));
    assert.deepEqual(run(join(harness, "README.md")), { planted_refused: true, null_control_allowed: true, holds: true });
    assert.deepEqual(run(join(root, "outside-the-grant")), { planted_refused: true, null_control_allowed: false, holds: false });
    assert(!existsSync(join(root, "planted")));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
