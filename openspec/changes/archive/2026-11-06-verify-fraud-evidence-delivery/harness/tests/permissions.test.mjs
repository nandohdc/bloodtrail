import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, realpathSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";
import {
  hostDatabaseDirectory,
  ingressFlags,
  prepareHostDatabase,
  prepareStorage,
  roleFlags,
  senderFlags,
  storageDirectory,
} from "../lib/permissions.mjs";
import { deleteScratch, finalizeScratch, scratchSession } from "../lib/kit-pipeline.mjs";
import { stopRoles } from "../lib/session.mjs";
import { StopCondition } from "../lib/deadline.mjs";
import { gatedSession } from "../lib/gated-session.mjs";

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

test("a session that fails after partial work keeps its observations beside the invalidation, and scratch is deleted", async () => {
  const { root, scratch } = layout();
  try {
    const partial = { passes: { small: { occurrence_count: 10 }, volume: null }, occurrence_count: null };
    const failing = await scratchSession({ result: { invalidations: [] }, scratch, work: async () => {
      const error = new Error("volume pass failed");
      error.observations = partial;
      throw error;
    } });
    assert.deepEqual(failing.invalidations, [{ message: "volume pass failed" }]);
    assert.equal(failing.observations, partial);
    assert.equal(failing.scratch_deletion.recursively_absent, true);
    mkdirSync(scratch);
    const plain = await scratchSession({ result: { invalidations: [] }, scratch, work: async () => { throw new Error("small pass failed"); } });
    assert.equal(Object.hasOwn(plain, "observations"), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("unconfirmed role closure retains scratch and preserves the original S2 and partial observations", async () => {
  for (const killFails of [false, true]) {
    const { root, scratch } = layout();
    try {
      const failure = new StopCondition("deadline", "fixture deadline");
      failure.observations = { phases: { small: { occurrence_count: 1 } } };
      const role = {
        exited: () => null,
        kill() { if (killFails) throw new Error("fixture kill failed"); },
        whenClosed: () => new Promise(() => {}),
      };
      const result = await scratchSession({ result: { invalidations: [] }, scratch, work: () => stopRoles({ sender: role }, { timeoutMs: 10, failure }) });
      assert(existsSync(scratch), "unconfirmed closure must not remove scratch");
      assert.equal(result.scratch_deletion.recursively_absent, false);
      assert.equal(result.invalidations[0].condition, "deadline");
      assert.equal(result.observations, failure.observations);
      assert.match(result.invalidations[0].role_closure_error, /closure.*deadline|kill failed/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

test("null control: confirmed role closure allows scratch deletion", async () => {
  const { root, scratch } = layout();
  try {
    const role = { exited: () => null, kill() {}, whenClosed: async () => ({ code: 0, signal: null }) };
    const result = await scratchSession({ result: { invalidations: [] }, scratch, work: () => stopRoles({ sender: role }, { timeoutMs: 10 }) });
    assert.equal(existsSync(scratch), false);
    assert.equal(result.scratch_deletion.recursively_absent, true);
    assert.deepEqual(result.invalidations, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("an unconfirmed close without an earlier session error also prevents deletion", async () => {
  const { root, scratch } = layout();
  try {
    const role = { exited: () => null, kill() {}, whenClosed: () => new Promise(() => {}) };
    const result = await scratchSession({ result: { invalidations: [] }, scratch, work: () => stopRoles({ sender: role }, { timeoutMs: 10 }) });
    assert(existsSync(scratch));
    assert.equal(result.scratch_deletion.recursively_absent, false);
    assert.equal(result.invalidations[0].role_closure_confirmed, false);
    assert.match(result.invalidations[0].message, /role closure.*deadline/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("a deadline kill failure keeps S2 and partial results; later confirmed closure permits cleanup", async () => {
  const { root, scratch } = layout();
  let kills = 0;
  const role = { exited: () => null, kill() { if (++kills === 1) throw new Error("fixture kill failed"); }, whenClosed: async () => ({ code: null, signal: "SIGKILL" }) };
  const units = [{ name: "done", pass: "small" }, { name: "stuck", pass: "small" }];
  try {
    const result = await scratchSession({ result: { invalidations: [] }, scratch, work: () => gatedSession({
      expectations: { deadline_ms: 10 }, units, key: "phases", evaluate: () => assert.fail("a halted session must not reach evaluation"),
      runUnit: async ({ context, unit }) => {
        if (unit.name === "done") return { occurrence_count: 1 };
        context.byUnit.stuck = { sender: { ...role, stderr: () => "" } };
        return new Promise(() => {});
      },
    }) });
    assert.equal(kills, 2);
    assert.equal(result.invalidations[0].condition, "deadline");
    assert.equal(result.invalidations[0].halt_error, "fixture kill failed");
    assert.equal(result.observations.phases.done.occurrence_count, 1);
    assert.equal(result.observations.phases.stuck, null);
    assert.equal(existsSync(scratch), false, "later actual closure permits cleanup despite the earlier kill error");
    assert.equal(result.scratch_deletion.recursively_absent, true);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Q244: probe-declared host-database grant gives sender read and write, other probes unchanged", () => {
  const flagsWithDb = senderFlags({ service: "/s", hostDatabase: "/h" });
  assert.deepEqual(flagsWithDb, [
    "--permission",
    "--allow-net",
    "--allow-fs-read=/s",
    "--allow-fs-read=/h",
    "--allow-fs-write=/h",
  ]);

  const flagsWithoutDb = senderFlags({ service: "/s" });
  assert.deepEqual(flagsWithoutDb, ["--permission", "--allow-net", "--allow-fs-read=/s"]);

  const roleSenderWithDb = roleFlags({ role: "sender", service: "/s", storage: "/d", hostDatabase: "/h" });
  assert.deepEqual(roleSenderWithDb, flagsWithDb);

  const roleSenderWithoutDb = roleFlags({ role: "sender", service: "/s", storage: "/d" });
  assert.deepEqual(roleSenderWithoutDb, flagsWithoutDb);

  const ingressWithDb = roleFlags({ role: "ingress", service: "/s", storage: "/d", hostDatabase: "/h" });
  const ingressWithoutDb = roleFlags({ role: "ingress", service: "/s", storage: "/d" });
  assert.deepEqual(ingressWithDb, ingressWithoutDb);
  assert.deepEqual(ingressWithDb, [
    "--permission",
    "--allow-net",
    "--allow-fs-read=/s",
    "--allow-fs-read=/d",
    "--allow-fs-write=/d",
  ]);
});


const DIRECTORY_CASES = [
  ["collector-storage", prepareStorage, storageDirectory],
  ["host-database", prepareHostDatabase, hostDatabaseDirectory],
];
test("scratch deletion lists the host database only when prepared", () => {
  for (const withDatabase of [false, true]) {
    const { root, scratch, repo, service } = layout();
    try {
      if (withDatabase) prepareHostDatabase({ scratch, repo, service });
      const includes = ["evaluation-kit", "own-service", "collector-storage"];
      if (withDatabase) includes.push("host-database");
      includes.push("logs");
      assert.equal(JSON.stringify(deleteScratch({ scratch })), JSON.stringify({
        root: scratch, recursively_absent: true, includes,
      }));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }
});

for (const [name, prepare, validate] of DIRECTORY_CASES) {
  test(`${name} is inside scratch and apart from repository and own service`, () => {
    const { root, scratch, repo, service } = layout();
    try {
      const directory = prepare({ scratch, repo, service });
      assert.equal(directory, join(scratch, name));
      const inner = join(service, "inner");
      mkdirSync(inner);
      for (const forbidden of [service, inner]) {
        assert.throws(() => validate({ scratch, repo, service, directory: forbidden }), /overlaps a protected tree/);
      }
      assert.throws(() => validate({ scratch, repo, service, directory: repo }));
      assert.throws(() => validate({ scratch: root, repo, service, directory }), /overlaps a protected tree/);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}

function permissionControl({ harness, root, database, allowed, outbox = false }) {
  const controls = pathToFileURL(join(harness, outbox ? "outbox" : "lib", "controls.mjs")).href;
  const args = ["--permission", `--allow-fs-read=${harness}`];
  const field = database ? "allowedPath" : "allowedReadPath";
  if (database) args.push(`--allow-fs-read=${database}`, `--allow-fs-write=${database}`);
  const invocation = outbox ? `hostDbIsolationControl(${JSON.stringify(database)})`
    : `writeControls({ refusedPath: ${JSON.stringify(join(root, "planted"))}, ${field}: ${JSON.stringify(allowed)} })`;
  args.push("--input-type=module", "-e",
    `import * as controls from ${JSON.stringify(controls)}; console.log(JSON.stringify(controls.${invocation}));`);
  return JSON.parse(execFileSync(process.execPath, args, { encoding: "utf8" }));
}

test("outbox isolation refuses the sibling inside scratch while allowing its database", () => {
  const harness = dirname(dirname(fileURLToPath(import.meta.url)));
  const { root, scratch, repo, service } = layout();
  try {
    const database = prepareHostDatabase({ scratch, repo, service });
    const result = permissionControl({ harness, root: scratch, database, outbox: true });
    assert.deepEqual(result, {
      host_database_grant_isolated: true, planted_write_refused: true,
      null_control_allowed: true, holds: true,
    });
    assert.equal(existsSync(join(scratch, "planted-host-write")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

for (const withDatabase of [false, true]) {
  test(`permission planted/null controls, host-database grant = ${withDatabase}`, () => {
    const harness = dirname(dirname(fileURLToPath(import.meta.url)));
    const { root, scratch } = layout();
    try {
      const database = withDatabase ? join(scratch, "host-database") : undefined;
      if (database) mkdirSync(database);
      const allowed = database ? join(database, "null-control") : join(harness, "README.md");
      const run = (path) => permissionControl({ harness, root, database, allowed: path });
      assert.deepEqual(run(allowed), { planted_refused: true, null_control_allowed: true, holds: true });
      assert.deepEqual(run(join(root, "outside")), { planted_refused: true, null_control_allowed: false, holds: false });
      assert(!existsSync(join(root, "planted")));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
}
