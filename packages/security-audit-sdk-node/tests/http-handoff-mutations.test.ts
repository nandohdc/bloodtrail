// The delivery handoff's mutation checks (#577). Each mutant makes the handoff
// send something other than the occurrence it was given, and must be killed by
// the retry test pinned to it. A mutant is applied to a disposable clone of the
// built package, never to the live tree, and counts as killed only after every
// pinned test has passed, run the same way, against an unmutated clone.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const RETRY_TESTS = "dist-tests/delivery-retry.test.js";
// The retry tests read this fixture relative to their own location.
const FIXTURE = "contracts/security-audit/examples/positive/all-events.json";
// A run still going after this bound has hung.
const RUN_TIMEOUT_MS = 30_000;
// Exactly this many mutants must apply, so none can drop out of the table unnoticed.
const MUTANT_COUNT = 3;

// The retry tests the mutants are pinned to, by their exact names in delivery-retry.test.ts.
const PINNED_TESTS = {
  identical: "redelivers the identical occurrence on every delivery attempt",
  reExecution: "keeps a re-execution's retry attempt on every delivery attempt",
  valid: "sends every copy of a first execution's delivery retry in a form the SDK still validates",
} as const;

// The handoff's one serialization of the occurrence. It must occur exactly once in the source.
const SERIALIZATION = "body = JSON.stringify(event);";

interface Mutant {
  readonly name: string;
  /** What replaces the serialization. */
  readonly to: string;
  /** The retry test that must fail against this mutant. */
  readonly killedBy: string;
}

const MUTANTS: ReadonlyArray<Mutant> = [
  {
    name: "writes the delivery attempt ordinal into correlation.retry_attempt",
    to: "body = JSON.stringify({ ...event, correlation: { ...event.correlation, retry_attempt: attempt.ordinal } });",
    killedBy: PINNED_TESTS.identical,
  },
  {
    name: "resets correlation.retry_attempt to zero",
    to: "body = JSON.stringify({ ...event, correlation: { ...event.correlation, retry_attempt: 0 } });",
    killedBy: PINNED_TESTS.reExecution,
  },
  {
    name: "points correlation.causation_id at the occurrence itself",
    to: "body = JSON.stringify({ ...event, correlation: { ...event.correlation, causation_id: event.event.id } });",
    killedBy: PINNED_TESTS.valid,
  },
];

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-sdk-node-handoff-mutations-"));
after(() => rmSync(suiteRoot, { recursive: true, force: true }));

// The build's compiler options, emitting ES modules: transpileModule cannot read
// package.json's "type", so NodeNext would emit CommonJS here.
function transpileOptions(): ts.CompilerOptions {
  const { config } = ts.readConfigFile(resolve(packageRoot, "tsconfig.build.json"), (path) => ts.sys.readFile(path));
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, packageRoot);
  return { ...options, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
}

const TRANSPILE_OPTIONS = transpileOptions();
const SOURCE = readFileSync(resolve(packageRoot, "src/http-handoff.ts"), "utf8");
const BUILD = readFileSync(resolve(packageRoot, "dist/http-handoff.js"), "utf8");

// The JavaScript the build emits for `source`, or null when it does not parse.
function transpile(source: string): string | null {
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    compilerOptions: TRANSPILE_OPTIONS,
    fileName: resolve(packageRoot, "src/http-handoff.ts"),
    reportDiagnostics: true,
  });
  return diagnostics.length === 0 ? outputText : null;
}

// A disposable copy of the built package, with `mutatedBuild` in place of the
// handoff module. Only the retry tests, their fixture and the manifest come
// along, and node_modules is linked rather than copied.
function stageClone(mutatedBuild?: string): string {
  const cloneRoot = mkdtempSync(resolve(suiteRoot, "clone-"));
  const clonedPackage = resolve(cloneRoot, "packages/security-audit-sdk-node");
  // cpSync creates each target's missing parent directories.
  for (const path of ["dist", "package.json", RETRY_TESTS]) {
    cpSync(resolve(packageRoot, path), resolve(clonedPackage, path), { recursive: true });
  }
  cpSync(resolve(repositoryRoot, FIXTURE), resolve(cloneRoot, FIXTURE));
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(clonedPackage, "node_modules"), "dir");
  if (mutatedBuild !== undefined) writeFileSync(resolve(clonedPackage, "dist/http-handoff.js"), mutatedBuild, "utf8");
  return clonedPackage;
}

interface Run {
  /** The exit status, or null when the run was killed for outliving RUN_TIMEOUT_MS. */
  readonly status: number | null;
  readonly tap: string;
}

// Runs the one retry test named `testName` in a clone.
function runPinnedTest(clonedPackage: string, testName: string): Promise<Run> {
  const child = spawn(
    process.execPath,
    ["--test", "--test-reporter=tap", "--test-isolation=none", "--test-force-exit", `--test-name-pattern=${escapeRegExp(testName)}`, RETRY_TESTS],
    { cwd: clonedPackage, env: childEnvironment(), stdio: ["ignore", "pipe", "ignore"], timeout: RUN_TIMEOUT_MS, killSignal: "SIGKILL" },
  );
  let tap = "";
  child.stdout.setEncoding("utf8").on("data", (chunk: string) => { tap += chunk; });
  return new Promise((done, fail) => {
    child.once("error", fail);
    child.once("close", (status) => done({ status, tap }));
  });
}

// A child that inherited these would report to this runner rather than print
// TAP, or would write coverage of the clone. Node copies a missing
// NODE_V8_COVERAGE into every child, so it is set empty, which turns coverage off.
function childEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, NODE_V8_COVERAGE: "" };
  delete environment.NODE_TEST_CONTEXT;
  return environment;
}

function escapeRegExp(text: string): string {
  return text.replaceAll(/[\\^$.*+?()[\]{}|]/g, String.raw`\$&`);
}

// How the run's one test ended: "passed", "failed", or why it is neither.
function verdict(run: Run, testName: string): string {
  if (run.status === null) return "hung";
  const countMatch = /^# tests (\d+)$/m.exec(run.tap);
  const count = Number(countMatch?.[1]);
  if (count !== 1) return `ran ${count} tests, not its pinned test alone`;

  const okPattern = new RegExp(String.raw`^\s*ok \d+ - ${escapeRegExp(testName)}$`, "m");
  const notOkPattern = new RegExp(String.raw`^\s*not ok \d+ - ${escapeRegExp(testName)}$`, "m");

  if (run.status === 0) {
    if (!okPattern.test(run.tap)) return "missing ok marker";
    if (notOkPattern.test(run.tap)) return "unexpected failure marker";
    return "passed";
  }

  if (notOkPattern.test(run.tap)) return "failed";
  return `exit ${run.status} without failure marker`;
}

let controlPassed = false;

describe("HTTP delivery handoff mutations", () => {
  const pinnedTests = Object.values(PINNED_TESTS);

  it("passes each pinned retry test, run alone as for a mutant, against an unmutated clone of the current build", { timeout: pinnedTests.length * RUN_TIMEOUT_MS + 5_000 }, async () => {
    assert.equal(transpile(SOURCE), BUILD, "dist/http-handoff.js must be the build of src/http-handoff.ts");
    const clonedPackage = stageClone();
    const verdicts: string[] = [];
    for (const testName of pinnedTests) verdicts.push(verdict(await runPinnedTest(clonedPackage, testName), testName));

    assert.deepEqual(verdicts, pinnedTests.map(() => "passed"), "every pinned test must exist, and pass when run alone");
    controlPassed = true;
  });

  it(`applies all ${MUTANT_COUNT} mutants to clones, and kills each with its pinned test`, { timeout: MUTANT_COUNT * RUN_TIMEOUT_MS + 5_000 }, async () => {
    assert.ok(controlPassed, "the null control must pass first, or a failing run proves nothing");
    // A replacement that no longer matches exactly once would leave every mutant unapplied.
    assert.equal(SOURCE.split(SERIALIZATION).length, 2, "the serialization must occur exactly once in the source");

    let applied = 0;
    const unkilled: string[] = [];
    for (const mutant of MUTANTS) {
      // A function replacement, so that no `$` in the mutant is read as a pattern.
      const mutatedBuild = transpile(SOURCE.replace(SERIALIZATION, () => mutant.to));
      if (mutatedBuild === null || mutatedBuild === BUILD) {
        unkilled.push(`${mutant.name}: not applied`);
        continue;
      }
      applied += 1;
      const outcome = verdict(await runPinnedTest(stageClone(mutatedBuild), mutant.killedBy), mutant.killedBy);
      if (outcome !== "failed") unkilled.push(`${mutant.name}: ${outcome}`);
    }

    assert.deepEqual(unkilled, [], "every mutant must apply and be killed by its pinned test");
    assert.equal(applied, MUTANT_COUNT, `exactly ${MUTANT_COUNT} mutants must apply`);
  });
});
