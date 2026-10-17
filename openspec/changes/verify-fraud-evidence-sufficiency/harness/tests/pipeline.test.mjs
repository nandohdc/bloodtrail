import assert from "node:assert/strict";
import test from "node:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { assertNoInstallScripts, CORE, NODE, ownServiceManifest, singleCoreEvidence } from "../lib/install.mjs";
import { assertResolution, copyApprovedFiles, launchProbe, verifyFileBytes } from "../lib/launcher.mjs";
import { command } from "../lib/io.mjs";
import { runtimeFacts } from "../lib/runtime-facts.mjs";

const LIFECYCLES = ["preinstall", "install", "postinstall", "prepare"];

test("packed manifest fixture refuses lifecycle hooks and pins both tarballs identically", () => {
  for (const key of LIFECYCLES) assert.throws(() => assertNoInstallScripts({ name: CORE, scripts: { [key]: "fixture" } }), /lifecycle/);
  const artifacts = [CORE, NODE].map((name, index) => ({ filename: `fixture-${index}.tgz`, manifest: { name } }));
  const manifest = ownServiceManifest({ kit: "evaluation-kit", artifacts });
  assert.equal(manifest.dependencies[CORE], manifest.overrides[CORE]);
  assert.equal(Object.keys(manifest.dependencies).length, 2);
  assert.equal(assertNoInstallScripts({ name: CORE }).install_lifecycle_absent, true);
});

test("copy/launcher fixtures verify Git blob bytes, single core and permission rejection", () => {
  const root = mkdtempSync(join(tmpdir(), "pids-pipeline-fixture-"));
  try {
    pipelineFixture({ root });
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

function pipelineFixture({ root }) {
  const repo = join(root, "repo");
  const service = join(root, "service");
  const core = join(service, "node_modules", CORE);
  mkdirSync(join(repo, "harness"), { recursive: true });
  mkdirSync(core, { recursive: true });
  const source = join(repo, "harness/fixture.mjs");
  writeFileSync(source, "// fixture Ω\n");
  const git = (args) => command({ program: "git", args, cwd: repo });
  git(["init", "-q"]);
  git(["add", "harness/fixture.mjs"]);
  git(["-c", "user.name=Fixture", "-c", "user.email=fixture", "-c", "commit.gpgsign=false", "commit", "-qm", "fixture"]);
  const approvedHead = git(["rev-parse", "HEAD"]).trim();
  const args = { repo, approvedHead, service, paths: ["harness/fixture.mjs"], prefix: "harness" };
  const hashes = copyApprovedFiles(args);
  assert.equal(hashes["harness/fixture.mjs"].sha256.length, 64);
  assert.deepEqual(readFileSync(join(service, "harness/fixture.mjs")), readFileSync(source));
  writeFileSync(source, "// changed fixture\n");
  assert.throws(() => copyApprovedFiles(args), /differs/);
  assert.throws(() => verifyFileBytes({ bytes: Buffer.from([255]), committed: Buffer.from([254]) }), /differs/);
  writeFileSync(join(core, "package.json"), "{}\n");
  const candidates = [join(core, "package.json")];
  const listing = { dependencies: { [CORE]: { path: core } } };
  assert.equal(singleCoreEvidence({ service, listing, candidates }).npm_ls_paths.length, 1);
  assert.throws(() => singleCoreEvidence({ service, listing, candidates: [...candidates, ...candidates] }), /exactly one/);
  assertResolution({ service, resolvedCore: pathToFileURL(candidates[0]).href });
  assert.throws(() => assertResolution({ service, resolvedCore: pathToFileURL(source).href }), /outside service/);
  const output = { role: "fixture", resolved_core: pathToFileURL(candidates[0]).href, ledger: { occurrence_count: 1 } };
  const launch = { service, role: "fixture", budget: 1, flags: ["--permission", `--allow-fs-read=${service}`], run: () => JSON.stringify(output) };
  assert.equal(launchProbe(launch).role, "fixture");
  assert.throws(() => launchProbe({ ...launch, flags: [...launch.flags, "--allow-net"] }), /permission grant/);
  assert.throws(() => launchProbe({ ...launch, budget: 0 }), /exceeded/);
  assert.equal(runtimeFacts({ scratch: root }).runtime.isTransaction, true);
}
