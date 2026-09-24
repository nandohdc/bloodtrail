// The HTTP audit sink's mutation checks (#592). Each mutant breaks one rule the
// sink's requirements state, in the sink, the shared classifier or the fetch
// adapter. It is applied to a disposable clone of the built package, never to
// the live tree, and the one sink test pinned to it runs alone against that
// clone. A mutant is killed only when that test fails, and only after every
// pinned test has passed, run the same way, against an unmutated clone.
//
// ADR-NODE-004 lists the edits left out because no sink test can reach them.

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { cpSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { availableParallelism, tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { after, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const __dirname = dirname(fileURLToPath(import.meta.url));
const packageRoot = resolve(__dirname, "..");
const repositoryRoot = resolve(packageRoot, "../..");
const SINK_TESTS = "dist-tests/http-audit-sink.test.js";
// The sink tests read this fixture relative to their own location.
const FIXTURE = "contracts/security-audit/examples/positive/all-events.json";
// Each run is one pinned test. The five that prove the sink does not wait
// carry a 10 s deadline, so a mutant that makes one wait fails it. A run still
// going after this bound has hung.
const RUN_TIMEOUT_MS = 30_000;
// Most runs wait on sockets and timers rather than the CPU, so several run at once.
const CONCURRENCY = Math.min(4, availableParallelism());
// Exactly this many mutants must apply, so none can drop out of the table unnoticed.
const MUTANT_COUNT = 60;
// The mutants #592 names.
const REQUIRED_MUTANTS = [
  "rewrites correlation.retry_attempt in the body",
  "drops the acknowledgment check",
  "classifies 429 as rejected",
  "follows redirects",
  "exposes a header value in an outcome",
  "flush does not wait",
];

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-sdk-node-sink-mutations-"));
after(() => rmSync(suiteRoot, { recursive: true, force: true }));

// The sink tests the mutants are pinned to, by their exact names in http-audit-sink.test.ts.
const PINNED_TESTS = {
  bytes: "sends one POST whose body is byte-identical to the validated event, retry_attempt included",
  onePerEmit: "sends exactly one request per emit, and never a second one for a failed send",
  statuses: "returns SDK_SINK_REJECTED for a permanent 4xx and SDK_SINK_FAILURE for a retryable status, reporting each cause once",
  redirect: "never follows a redirect, and the SDK reports the send as failed",
  exactAcknowledgment: "accepts only the exact acknowledgment for this event",
  deadline: "reports a peer slower than the deadline as a timeout, and a refused connection as a transport failure",
  credential: "keeps a sentinel credential on the wire to the configured origin, out of every outcome, result, error and log",
  callback: "leaves the result unchanged, and leaks no unhandled rejection, when onOutcome throws, rejects or never settles",
  flush: "waits in flush for every send started before the call, and for none started after it",
  shutdown: "closes the sink on shutdown, refusing every later send at once and resolving when the earlier ones settle",
  rejectedSend: "waits in flush and shutdown for a held send beside one that rejects",
  concurrent: "sends N concurrent emits as N requests, each settled and reported exactly once, in any order",
  callerHeaders: "sends caller headers to the configured origin beside its own content type",
  options: "rejects an invalid origin, path, timeout or onOutcome at construction",
  headers: "rejects an invalid header name or value at construction, without echoing it",
} as const;

type SourceFile = "http-audit-sink" | "http-response-classification" | "fetch-exchange";

interface Mutant {
  readonly name: string;
  /** Text that occurs exactly once in the source file, and the text that replaces it. */
  readonly from: string;
  readonly to: string;
  /** The sink test that must fail against this mutant. */
  readonly killedBy: string;
}

const MUTANTS: Readonly<Record<SourceFile, ReadonlyArray<Mutant>>> = {
  "http-audit-sink": [
    // The wire.
    {
      name: "rewrites correlation.retry_attempt in the body",
      from: "const body = JSON.stringify(event);",
      to: "const body = JSON.stringify({ ...event, correlation: { ...event.correlation, retry_attempt: 0 } });",
      killedBy: PINNED_TESTS.bytes,
    },
    {
      name: "serializes the body again, indented",
      from: "const body = JSON.stringify(event);",
      to: "const body = JSON.stringify(event, null, 2);",
      killedBy: PINNED_TESTS.bytes,
    },
    { name: "sends another method", from: 'method: "POST",', to: 'method: "PUT",', killedBy: PINNED_TESTS.bytes },
    { name: "sends to another path", from: "path,\n    headers: Object.freeze({", to: 'path: "/",\n    headers: Object.freeze({', killedBy: PINNED_TESTS.bytes },
    { name: "sends another content type", from: '"content-type": "application/json",', to: '"content-type": "text/plain",', killedBy: PINNED_TESTS.bytes },

    // Results.
    {
      name: "adds its own rule that every 2xx is acknowledged",
      from: "const code = classifyHttpExchangeOutcome(exchanged, eventId);",
      to: 'const code = exchanged.kind === "response" && exchanged.status >= 200 && exchanged.status < 300 ? "acknowledged" : classifyHttpExchangeOutcome(exchanged, eventId);',
      killedBy: PINNED_TESTS.exactAcknowledgment,
    },
    { name: "maps an acknowledgment to unknown", from: 'acknowledged: "accepted",', to: 'acknowledged: "unknown",', killedBy: PINNED_TESTS.bytes },
    { name: "maps a permanent 4xx to unknown", from: 'http_permanent: "rejected",', to: 'http_permanent: "unknown",', killedBy: PINNED_TESTS.statuses },
    { name: "maps a retryable status to rejected", from: 'http_retryable: "unknown",', to: 'http_retryable: "rejected",', killedBy: PINNED_TESTS.statuses },
    { name: "maps a malformed acknowledgment to rejected", from: 'malformed_acknowledgment: "unknown",', to: 'malformed_acknowledgment: "rejected",', killedBy: PINNED_TESTS.exactAcknowledgment },
    { name: "maps an unexpected response to rejected", from: 'unexpected_response: "unknown",', to: 'unexpected_response: "rejected",', killedBy: PINNED_TESTS.redirect },
    { name: "maps a timeout to rejected", from: 'timeout: "unknown",', to: 'timeout: "rejected",', killedBy: PINNED_TESTS.deadline },
    { name: "maps a transport failure to rejected", from: 'transport_failure: "unknown",', to: 'transport_failure: "rejected",', killedBy: PINNED_TESTS.deadline },
    { name: "drops the code from a result", from: "Object.freeze({ status, code })", to: "Object.freeze({ status })", killedBy: PINNED_TESTS.deadline },

    // Outcome reports.
    { name: "reports nothing", from: "report(onOutcome, outcomeFor(eventId, code, exchanged));", to: "", killedBy: PINNED_TESTS.bytes },
    {
      name: "reports twice",
      from: "report(onOutcome, outcomeFor(eventId, code, exchanged));",
      to: "report(onOutcome, outcomeFor(eventId, code, exchanged));\n    report(onOutcome, outcomeFor(eventId, code, exchanged));",
      killedBy: PINNED_TESTS.bytes,
    },
    { name: "reports a status without a response", from: ": { eventId, outcome });", to: ": { eventId, outcome, status: undefined });", killedBy: PINNED_TESTS.deadline },
    { name: "reports no status for a response", from: "{ eventId, outcome, status: exchanged.status } :", to: "{ eventId, outcome } :", killedBy: PINNED_TESTS.bytes },
    { name: "reports another event identifier", from: "outcomeFor(eventId, code, exchanged)", to: "outcomeFor(eventId.slice(1), code, exchanged)", killedBy: PINNED_TESTS.bytes },
    { name: "reports acknowledged for every request", from: "outcomeFor(eventId, code, exchanged)", to: 'outcomeFor(eventId, "acknowledged", exchanged)', killedBy: PINNED_TESTS.statuses },

    // Credentials.
    {
      name: "exposes a header value in an outcome",
      from: "report(onOutcome, outcomeFor(eventId, code, exchanged));",
      to: "report(onOutcome, { ...outcomeFor(eventId, code, exchanged), headers });",
      killedBy: PINNED_TESTS.credential,
    },
    { name: "exposes a header value in a result", from: "return resultFor(code);", to: "return { ...resultFor(code), headers };", killedBy: PINNED_TESTS.credential },
    { name: "logs a header value", from: "return resultFor(code);", to: "console.debug(headers);\n    return resultFor(code);", killedBy: PINNED_TESTS.credential },

    // The callback.
    {
      name: "lets a throwing callback escape",
      from: "try {\n    Promise.resolve(onOutcome(outcome)).catch(() => undefined);\n  } catch {\n    // A synchronous throw is dropped for the same reason.\n  }",
      to: "Promise.resolve(onOutcome(outcome)).catch(() => undefined);",
      killedBy: PINNED_TESTS.callback,
    },
    {
      name: "leaves a rejecting callback unhandled",
      from: "Promise.resolve(onOutcome(outcome)).catch(() => undefined);",
      to: "Promise.resolve(onOutcome(outcome));",
      killedBy: PINNED_TESTS.callback,
    },
    {
      name: "waits for the callback",
      from: "report(onOutcome, outcomeFor(eventId, code, exchanged));",
      to: "await onOutcome?.(outcomeFor(eventId, code, exchanged));",
      killedBy: PINNED_TESTS.callback,
    },

    // Construction.
    { name: "accepts an onOutcome that is not a function", from: 'if (onOutcome !== undefined && typeof onOutcome !== "function") {', to: "if (false) {", killedBy: PINNED_TESTS.options },
    { name: "accepts an unbounded or relative path", from: 'if (typeof path !== "string" || !BOUNDED_ABSOLUTE_PATH.test(path)) {', to: 'if (typeof path !== "string") {', killedBy: PINNED_TESTS.options },
    { name: "accepts a reserved header", from: "  if (RESERVED_HEADER_NAMES.has(name.toLowerCase())) return false;\n", to: "", killedBy: PINNED_TESTS.headers },
    { name: "accepts a line break in a header value", from: "return HEADER_VALUE_PATTERN.test(value);", to: "return true;", killedBy: PINNED_TESTS.headers },
    {
      name: "echoes an invalid header",
      from: "if (!entries.every(isValidHeaderEntry)) throw invalidHeaders();",
      to: "if (!entries.every(isValidHeaderEntry)) throw new TypeError(JSON.stringify(entries));",
      killedBy: PINNED_TESTS.headers,
    },

    // Flush and shutdown.
    { name: "flush does not wait", from: "await Promise.allSettled(inFlight);", to: "await Promise.allSettled([]);", killedBy: PINNED_TESTS.flush },
    { name: "flush also waits for later sends", from: "await Promise.allSettled(inFlight);", to: "while (inFlight.size > 0) await Promise.allSettled(inFlight);", killedBy: PINNED_TESTS.flush },
    { name: "flush waits for the first send only", from: "await Promise.allSettled(inFlight);", to: "await [...inFlight][0];", killedBy: PINNED_TESTS.flush },
    { name: "flush rejects with a rejected send", from: "await Promise.allSettled(inFlight);", to: "await Promise.all(inFlight);", killedBy: PINNED_TESTS.rejectedSend },
    { name: "flush reads the sends a turn late", from: "await Promise.allSettled(inFlight);", to: "await null;\n    await Promise.allSettled(inFlight);", killedBy: PINNED_TESTS.flush },
    { name: "emit does not track its send", from: "open ? track(inFlight, send(event)) :", to: "open ? send(event) :", killedBy: PINNED_TESTS.flush },
    { name: "the tracker never adds a send", from: "  inFlight.add(sending);\n", to: "", killedBy: PINNED_TESTS.flush },
    { name: "flush is missing", from: "    flush,\n", to: "", killedBy: PINNED_TESTS.flush },
    { name: "shutdown does not wait", from: "open = false;\n      await flush();", to: "open = false;", killedBy: PINNED_TESTS.shutdown },
    { name: "shutdown does not close", from: "      open = false;\n", to: "", killedBy: PINNED_TESTS.shutdown },
    { name: "shutdown closes only after draining", from: "open = false;\n      await flush();", to: "await flush();\n      open = false;", killedBy: PINNED_TESTS.shutdown },
    {
      name: "shutdown is missing",
      from: "    async shutdown(): Promise<void> {\n      open = false;\n      await flush();\n    },\n",
      to: "",
      killedBy: PINNED_TESTS.shutdown,
    },
    { name: "a closed sink still sends", from: "open ? track(inFlight, send(event)) : Promise.resolve(SHUT_DOWN)", to: "track(inFlight, send(event))", killedBy: PINNED_TESTS.shutdown },
    { name: "a closed sink answers accepted", from: "Promise.resolve(SHUT_DOWN)", to: "Promise.resolve(ACCEPTED)", killedBy: PINNED_TESTS.shutdown },
    { name: "a closed sink rejects", from: "Promise.resolve(SHUT_DOWN)", to: 'Promise.reject(new Error("shut down"))', killedBy: PINNED_TESTS.shutdown },
    {
      name: "sends one at a time",
      from: "open ? track(inFlight, send(event)) :",
      to: "open ? track(inFlight, Promise.allSettled(inFlight).then(() => send(event))) :",
      killedBy: PINNED_TESTS.concurrent,
    },
    {
      name: "sends two requests per emit",
      from: "open ? track(inFlight, send(event)) :",
      to: "open ? (send(event).catch(() => undefined), track(inFlight, send(event))) :",
      killedBy: PINNED_TESTS.onePerEmit,
    },
  ],
  "http-response-classification": [
    {
      name: "drops the acknowledgment check",
      from: 'return isExactAcknowledgment(response.acknowledgments, eventId) ? "acknowledged" : "malformed_acknowledgment";',
      to: 'return "acknowledged";',
      killedBy: PINNED_TESTS.exactAcknowledgment,
    },
    { name: "accepts an acknowledgment for another event", from: "    && acknowledgment.event_id === eventId\n", to: "", killedBy: PINNED_TESTS.exactAcknowledgment },
    { name: "accepts more than one acknowledgment", from: "acknowledgments.length !== 1", to: "acknowledgments.length < 1", killedBy: PINNED_TESTS.exactAcknowledgment },
    { name: "classifies 429 as rejected", from: "new Set([408, 425, 429])", to: "new Set([408, 425])", killedBy: PINNED_TESTS.statuses },
    { name: "classifies a 5xx as permanent", from: 'if (status >= 500) return "http_retryable";', to: 'if (status >= 500) return "http_permanent";', killedBy: PINNED_TESTS.statuses },
    { name: "reads a 3xx as a 2xx", from: '  if (status >= 300) return "unexpected_response";\n', to: "", killedBy: PINNED_TESTS.redirect },
  ],
  "fetch-exchange": [
    { name: "follows redirects", from: 'redirect: "manual",', to: 'redirect: "follow",', killedBy: PINNED_TESTS.redirect },
    { name: "reads a rejected acknowledgment as accepted", from: 'return value.outcome === "accepted";', to: "return true;", killedBy: PINNED_TESTS.exactAcknowledgment },
    {
      name: "drops the acknowledgments it cannot read",
      from: "if (!rawAcks.every(isAcceptedAcknowledgment)) return UNREADABLE;\n    return Object.freeze(rawAcks.map(",
      to: "return Object.freeze(rawAcks.filter(isAcceptedAcknowledgment).map(",
      killedBy: PINNED_TESTS.exactAcknowledgment,
    },
    { name: "has no deadline", from: "        signal: AbortSignal.timeout(timeoutMs),\n", to: "", killedBy: PINNED_TESTS.deadline },
    { name: "reads a deadline as a transport failure", from: 'return isTimeout(error) ? { kind: "timeout" } : { kind: "transport_failure" };', to: 'return { kind: "transport_failure" };', killedBy: PINNED_TESTS.deadline },
    {
      name: "drops the caller's headers",
      from: 'headers: { ...callerHeaders, "content-type": request.headers["content-type"] },',
      to: 'headers: { "content-type": request.headers["content-type"] },',
      killedBy: PINNED_TESTS.callerHeaders,
    },
  ],
};

type FileMutant = Mutant & { readonly file: SourceFile };

const SOURCE_FILES = Object.keys(MUTANTS) as SourceFile[];
const ALL_MUTANTS: ReadonlyArray<FileMutant> = SOURCE_FILES.flatMap((file) => MUTANTS[file].map((mutant) => ({ ...mutant, file })));

// The build's compiler options, emitting ES modules: transpileModule cannot read
// package.json's "type", so NodeNext would emit CommonJS here.
const TRANSPILE_OPTIONS = transpileOptions();

let controlPassed = false;

function transpileOptions(): ts.CompilerOptions {
  const { config } = ts.readConfigFile(resolve(packageRoot, "tsconfig.build.json"), (path) => ts.sys.readFile(path));
  const { options } = ts.parseJsonConfigFileContent(config, ts.sys, packageRoot);
  return { ...options, module: ts.ModuleKind.ESNext, moduleResolution: ts.ModuleResolutionKind.Bundler };
}

function readSource(file: SourceFile): string {
  return readFileSync(resolve(packageRoot, "src", `${file}.ts`), "utf8");
}

function readBuild(file: SourceFile): string {
  return readFileSync(resolve(packageRoot, "dist", `${file}.js`), "utf8");
}

// The JavaScript the build emits for `source`, or null when it does not parse.
function transpile(file: SourceFile, source: string): string | null {
  const { outputText, diagnostics = [] } = ts.transpileModule(source, {
    compilerOptions: TRANSPILE_OPTIONS,
    fileName: resolve(packageRoot, "src", `${file}.ts`),
    reportDiagnostics: true,
  });
  return diagnostics.length === 0 ? outputText : null;
}

// A disposable copy of the built package, with `mutated` in place of one
// module. Only the sink tests, their fixture and the manifest come along, and
// node_modules is linked rather than copied.
function stageClone(mutated?: { readonly file: SourceFile; readonly code: string }): string {
  const cloneRoot = mkdtempSync(resolve(suiteRoot, "clone-"));
  const clonedPackage = resolve(cloneRoot, "packages/security-audit-sdk-node");
  // cpSync creates each target's missing parent directories.
  for (const path of ["dist", "package.json", SINK_TESTS]) {
    cpSync(resolve(packageRoot, path), resolve(clonedPackage, path), { recursive: true });
  }
  cpSync(resolve(repositoryRoot, FIXTURE), resolve(cloneRoot, FIXTURE));
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(clonedPackage, "node_modules"), "dir");
  if (mutated) writeFileSync(resolve(clonedPackage, "dist", `${mutated.file}.js`), mutated.code, "utf8");
  return clonedPackage;
}

interface Run {
  /** The exit status, or null when the run was killed for outliving RUN_TIMEOUT_MS. */
  readonly status: number | null;
  readonly tap: string;
}

// Runs the one sink test named `testName` in a clone.
function runPinnedTest(clonedPackage: string, testName: string): Promise<Run> {
  const child = spawn(
    process.execPath,
    ["--test", "--test-reporter=tap", "--test-isolation=none", "--test-force-exit", `--test-name-pattern=${escapeRegExp(testName)}`, SINK_TESTS],
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
// TAP, or would write coverage of the clone, whose source maps name sources it
// lacks. Node copies a missing NODE_V8_COVERAGE into every child, so it is set
// empty, which turns coverage off.
function childEnvironment(): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = { ...process.env, NODE_V8_COVERAGE: "" };
  delete environment.NODE_TEST_CONTEXT;
  return environment;
}

function escapeRegExp(text: string): string {
  return text.replaceAll(/[\\^$.*+?()[\]{}|]/g, String.raw`\$&`);
}

interface Tally {
  readonly tests: number;
  readonly passed: ReadonlyArray<string>;
  readonly failed: ReadonlyArray<string>;
}

// The run's test count, and the names of its passing and failing tests and suites.
function tally({ tap }: Run): Tally {
  const passed: string[] = [];
  const failed: string[] = [];
  for (const [, not, name = ""] of tap.matchAll(/^\s*(not )?ok \d+ - (.+)$/gm)) {
    if (not) failed.push(name);
    else passed.push(name);
  }
  return { tests: Number(/^# tests (\d+)$/m.exec(tap)?.[1] ?? Number.NaN), passed, failed };
}

// Whether the run executed `testName` alone, and it passed.
function passedAlone(run: Run, testName: string): boolean {
  const { tests, passed } = tally(run);
  return run.status === 0 && tests === 1 && passed.includes(testName);
}

interface Verdict {
  /** Whether the mutant reached a clone, where its pinned test ran. */
  readonly applied: boolean;
  readonly killed: boolean;
  readonly detail: string;
}

const VERDICTS = {
  missing: { applied: false, killed: false, detail: "not applied: its text must occur exactly once" },
  unparsable: { applied: false, killed: false, detail: "not applied: it does not parse" },
  unchanged: { applied: false, killed: false, detail: "not applied: it changes no emitted code" },
  hung: { applied: true, killed: false, detail: "hung" },
  survived: { applied: true, killed: false, detail: "survived" },
  killed: { applied: true, killed: true, detail: "killed" },
} as const satisfies Record<string, Verdict>;

async function verdictOn(mutant: FileMutant): Promise<Verdict> {
  const source = readSource(mutant.file);
  if (source.split(mutant.from).length !== 2) return VERDICTS.missing;
  // A function replacement, so that no `$` in the mutant is read as a pattern.
  const code = transpile(mutant.file, source.replace(mutant.from, () => mutant.to));
  if (code === null) return VERDICTS.unparsable;
  if (code === readBuild(mutant.file)) return VERDICTS.unchanged;

  const run = await runPinnedTest(stageClone({ file: mutant.file, code }), mutant.killedBy);
  if (run.status === null) return VERDICTS.hung;
  const { tests, failed } = tally(run);
  if (tests !== 1) return { applied: true, killed: false, detail: `ran ${tests} tests, not its pinned test alone` };
  return failed.includes(mutant.killedBy) ? VERDICTS.killed : VERDICTS.survived;
}

// Runs `work` on every item, at most CONCURRENCY at a time, keeping their order.
async function eachInPool<T, R>(items: ReadonlyArray<T>, work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  const queue = items.entries();
  const worker = async (): Promise<void> => {
    for (const [index, item] of queue) results[index] = await work(item);
  };
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  return results;
}

// Every run ends within RUN_TIMEOUT_MS, so a pool of `runs` ends within this.
// The deadline only backs that bound up.
function poolDeadline(runs: number): number {
  return Math.ceil(runs / CONCURRENCY) * RUN_TIMEOUT_MS + 60_000;
}

describe("HTTP audit sink mutations", () => {
  const pinnedTests = [...new Set(ALL_MUTANTS.map((mutant) => mutant.killedBy))];

  it("passes each pinned sink test, run alone as for a mutant, against an unmutated clone of the current build", { timeout: poolDeadline(pinnedTests.length) }, async () => {
    for (const file of SOURCE_FILES) {
      assert.equal(transpile(file, readSource(file)), readBuild(file), `dist/${file}.js must be the build of src/${file}.ts`);
    }
    const clonedPackage = stageClone();
    const passing = await eachInPool(pinnedTests, async (testName) => passedAlone(await runPinnedTest(clonedPackage, testName), testName));

    assert.deepEqual(pinnedTests.filter((_, index) => !passing[index]), [], "every pinned test must exist, and pass when run alone");
    controlPassed = true;
  });

  it(`applies all ${MUTANT_COUNT} mutants to clones, and kills each with its pinned test`, { timeout: poolDeadline(ALL_MUTANTS.length) }, async (t) => {
    assert.ok(controlPassed, "the null control must pass first, or a failing run proves nothing");
    const names = new Set(ALL_MUTANTS.map((mutant) => mutant.name));
    assert.deepEqual(REQUIRED_MUTANTS.filter((name) => !names.has(name)), [], "the mutants #592 names must stay");

    const verdicts = await eachInPool(ALL_MUTANTS, verdictOn);
    const applied = verdicts.filter((verdict) => verdict.applied).length;
    const killed = verdicts.filter((verdict) => verdict.killed).length;
    t.diagnostic(`${applied} of ${ALL_MUTANTS.length} mutants applied, ${killed} killed`);

    // Each mutant that was not killed is named with its reason, before the count.
    const unkilled = ALL_MUTANTS.flatMap(({ file, name }, index) => {
      const verdict = verdicts[index];
      return verdict?.killed ? [] : [`${file}: ${name}: ${verdict?.detail}`];
    });
    assert.deepEqual(unkilled, []);
    assert.equal(applied, MUTANT_COUNT, `exactly ${MUTANT_COUNT} mutants must apply`);
  });
});
