import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import type { AuditTimerHandle, AuditTimerProvider } from "@bloodtrail/security-audit-sdk-core";
import {
  createDeliveryShutdown,
  type DeliveryShutdown,
  type DeliveryShutdownReport,
  type DeliveryShutdownSubmission,
  type DeliveryShutdownSubmitResult,
} from "../dist/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHUTDOWN_SOURCE = resolve(packageRoot, "src/delivery-shutdown.ts");

const COUPLING_POLICY = resolve(packageRoot, "scripts/platform-coupling-policy.mjs");

// Every global the shutdown module may name. Any other free identifier fails the source check, so a clock or timer
// reached through a global (`setTimeout`, `Date`, `performance`, `Temporal`, `Intl`, `MessageChannel`, `globalThis`,
// `eval`, ...) cannot arrive without this list changing.
const PERMITTED_GLOBALS = ["Number", "Object", "Promise", "TypeError"];

interface CouplingReferences {
  readonly identifiers: readonly string[];
  readonly failures: readonly unknown[];
}

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/**
 * A deadline timer that only fires when the test calls `fire()`; records the delay of every timer scheduled and
 * whether one was cleared.
 */
function fakeDeadlineTimer(): {
  timers: AuditTimerProvider;
  fire: () => void;
  wasCleared: () => boolean;
  delays: () => number[];
} {
  let scheduled: (() => void) | undefined;
  let cleared = false;
  const delays: number[] = [];
  const timers: AuditTimerProvider = Object.freeze({
    setTimeout(callback: () => void, delayMs: number): AuditTimerHandle {
      scheduled = callback;
      delays.push(delayMs);
      return { unref() {} };
    },
    clearTimeout(): void {
      cleared = true;
    },
  });
  return { timers, fire: () => scheduled?.(), wasCleared: () => cleared, delays: () => [...delays] };
}

/** A promise that never settles. */
function pending<T>(): Promise<T> {
  return new Promise<T>(() => {});
}

function macrotask(): Promise<void> {
  return new Promise<void>((done) => setImmediate(done));
}

/** Calls `settle` after `turns` microtask turns; with 0, in the current synchronous run. */
function afterMicrotasks(turns: number, settle: () => void): void {
  if (turns === 0) settle();
  else queueMicrotask(() => afterMicrotasks(turns - 1, settle));
}

/** Asserts that `report` is still unresolved once a macrotask turn has passed, so only the deadline timer can end it. */
async function assertWaitsForTimer(report: Promise<DeliveryShutdownReport>): Promise<void> {
  let resolved = false;
  void report.then(() => {
    resolved = true;
  });
  await macrotask();
  assert.equal(resolved, false, "the report resolved before the deadline timer fired");
}

interface AccountingScene {
  readonly gate: DeliveryShutdown;
  readonly fire: () => void;
}

interface DrivenAdmissions {
  readonly report: Promise<DeliveryShutdownReport>;
  /** The `submit()` call whose outcome the row names, if it names one. */
  readonly submitted?: Promise<DeliveryShutdownSubmitResult<unknown>>;
}

type SubmitOutcome =
  | { readonly resolves: DeliveryShutdownSubmitResult<unknown> }
  | { readonly rejects: (error: unknown) => boolean };

type SettledOutcome = { readonly value: unknown } | { readonly error: unknown };

/** One row of the accounting table (design Decision 7 of fix-delivery-shutdown-accounting-invariant). */
interface AccountingRow {
  readonly row: string;
  readonly scenario: string;
  readonly report: DeliveryShutdownReport;
  readonly outcome?: SubmitOutcome;
  drive(scene: AccountingScene): DrivenAdmissions | Promise<DrivenAdmissions>;
}

const DONE: DeliveryShutdownSubmitResult<string> = { status: "admitted", result: "done" };
const ONE_COMPLETED: DeliveryShutdownReport = { accepted: 1, completed: 1, abandoned: 0 };
const ONE_ABANDONED: DeliveryShutdownReport = { accepted: 1, completed: 0, abandoned: 1 };
const ASYNC_FAILURE = new Error("the operation rejected");
const SYNC_FAILURE = new Error("the operation threw synchronously");

/** Submits one operation, then initiates shutdown; the timer never fires. */
function submitThenShutdown(operation: DeliveryShutdownSubmission<unknown>): AccountingRow["drive"] {
  return ({ gate }) => {
    const submitted = gate.submit(operation);
    return { report: gate.shutdown(), submitted };
  };
}

/** One admission whose operation settles just before the deadline callback, or `turns` microtask turns after it. */
function settlesAroundCallback(turns: number | "before"): AccountingRow["drive"] {
  return async ({ gate, fire }) => {
    const operation = deferred<string>();
    const submitted = gate.submit(() => operation.promise);
    const report = gate.shutdown();
    await assertWaitsForTimer(report);
    const settle = () => operation.resolve("done");
    if (turns === "before") {
      settle();
      fire();
    } else {
      fire();
      afterMicrotasks(turns, settle);
    }
    return { report, submitted };
  };
}

const ACCOUNTING_ROWS: readonly AccountingRow[] = [
  {
    row: "R1",
    scenario: "settles before shutdown()",
    report: ONE_COMPLETED,
    outcome: { resolves: DONE },
    async drive({ gate }) {
      const submitted = gate.submit(async () => "done");
      await submitted;
      return { report: gate.shutdown(), submitted };
    },
  },
  {
    row: "R2",
    scenario: "settles after shutdown(), before the timer fires, and the report resolves without the timer",
    report: ONE_COMPLETED,
    outcome: { resolves: DONE },
    drive({ gate }) {
      const operation = deferred<string>();
      const submitted = gate.submit(() => operation.promise);
      const report = gate.shutdown();
      operation.resolve("done");
      return { report, submitted };
    },
  },
  {
    row: "R3",
    scenario: "never settles",
    report: ONE_ABANDONED,
    async drive({ gate, fire }) {
      void gate.submit(() => pending<string>());
      const report = gate.shutdown();
      await assertWaitsForTimer(report);
      fire();
      return { report };
    },
  },
  {
    row: "R4",
    scenario: "settles in the same synchronous run as the deadline callback, before it",
    report: ONE_ABANDONED,
    outcome: { resolves: DONE },
    drive: settlesAroundCallback("before"),
  },
  {
    row: "R5",
    scenario: "settles in the same synchronous run as the deadline callback, after it",
    report: ONE_ABANDONED,
    outcome: { resolves: DONE },
    drive: settlesAroundCallback(0),
  },
  ...[1, 2, 3, 4, 5, 6].map(
    (turns): AccountingRow => ({
      row: `R6 (k = ${turns})`,
      scenario: `settles ${turns} microtask turn(s) after the deadline callback`,
      report: ONE_ABANDONED,
      outcome: { resolves: DONE },
      drive: settlesAroundCallback(turns),
    }),
  ),
  {
    row: "R7",
    scenario: "rejects asynchronously",
    report: ONE_COMPLETED,
    outcome: { rejects: (error) => error === ASYNC_FAILURE },
    drive: submitThenShutdown(() => Promise.reject(ASYNC_FAILURE)),
  },
  {
    row: "R8",
    scenario: "throws synchronously",
    report: ONE_COMPLETED,
    outcome: { rejects: (error) => error === SYNC_FAILURE },
    drive: submitThenShutdown(() => {
      throw SYNC_FAILURE;
    }),
  },
  {
    row: "R9",
    scenario: "the submission is not a function",
    report: ONE_COMPLETED,
    outcome: { rejects: (error) => error instanceof TypeError },
    drive: submitThenShutdown("not a function" as unknown as DeliveryShutdownSubmission<unknown>),
  },
  {
    row: "R10",
    scenario: "two admissions share a pending promise",
    report: { accepted: 2, completed: 0, abandoned: 2 },
    async drive({ gate, fire }) {
      const shared = pending<string>();
      void gate.submit(() => shared);
      void gate.submit(() => shared);
      const report = gate.shutdown();
      await assertWaitsForTimer(report);
      fire();
      return { report };
    },
  },
  {
    row: "R11",
    scenario: "two admissions share a promise that settles before the timer fires",
    report: { accepted: 2, completed: 2, abandoned: 0 },
    outcome: { resolves: DONE },
    drive({ gate }) {
      const shared = deferred<string>();
      void gate.submit(() => shared.promise);
      const submitted = gate.submit(() => shared.promise);
      const report = gate.shutdown();
      shared.resolve("done");
      return { report, submitted };
    },
  },
  {
    row: "R12",
    scenario: "shutdown() is called inside the operation, which never settles",
    report: ONE_ABANDONED,
    async drive({ gate, fire }) {
      let report: Promise<DeliveryShutdownReport> = pending();
      let calledShutdown = false;
      void gate.submit(() => {
        report = gate.shutdown();
        calledShutdown = true;
        return pending<string>();
      });
      // Otherwise the wait below would be checked against the placeholder, which never resolves.
      assert.equal(calledShutdown, true, "the operation must call shutdown() before submit() returns");
      await assertWaitsForTimer(report);
      fire();
      return { report };
    },
  },
  {
    row: "R13",
    scenario: "the operation returns a plain value, not a promise",
    report: ONE_COMPLETED,
    outcome: { resolves: { status: "admitted", result: "a plain value" } },
    drive: submitThenShutdown((() => "a plain value") as unknown as DeliveryShutdownSubmission<unknown>),
  },
  {
    row: "R14",
    scenario: "throws synchronously, and the deadline callback runs in the same synchronous run as shutdown()",
    report: ONE_ABANDONED,
    outcome: { rejects: (error) => error === SYNC_FAILURE },
    drive({ gate, fire }) {
      const submitted = gate.submit(() => {
        throw SYNC_FAILURE;
      });
      const report = gate.shutdown();
      fire();
      return { report, submitted };
    },
  },
];

/**
 * Admits one operation, initiates shutdown, then settles the operation. Returns the order in which a caller awaiting
 * that `submit()` call through `layers` awaiting async functions, and a caller awaiting the report, saw their results.
 */
async function firstToSee(layers: number): Promise<string[]> {
  const { timers } = fakeDeadlineTimer();
  const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });
  const operation = deferred<string>();
  const seen: string[] = [];
  let call = (): Promise<unknown> => gate.submit(() => operation.promise);
  for (let layer = 0; layer < layers; layer += 1) {
    const inner = call;
    call = async () => {
      const outcome = await inner();
      return outcome;
    };
  }

  const caller = (async () => {
    await call();
    seen.push("submit() outcome");
  })();
  const host = (async () => {
    await gate.shutdown();
    seen.push("shutdown report");
  })();
  operation.resolve("done");
  await Promise.all([caller, host]);
  return seen;
}

/** Drives one row through the public module and asserts its report, the identity, and the named `submit()` outcome. */
async function runAccountingRow(row: AccountingRow): Promise<void> {
  const { timers, fire } = fakeDeadlineTimer();
  const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });
  const driven = await row.drive({ gate, fire });
  const outcome = driven.submitted?.then(
    (value): SettledOutcome => ({ value }),
    (error: unknown): SettledOutcome => ({ error }),
  );
  const report = await driven.report;
  assert.equal(report.completed + report.abandoned, report.accepted, "completed + abandoned must equal accepted");
  assert.deepEqual(report, row.report);
  if (row.outcome !== undefined) assertSubmitOutcome(await outcome, row.outcome);
}

function assertSubmitOutcome(actual: SettledOutcome | undefined, expected: SubmitOutcome): void {
  if ("resolves" in expected) {
    assert.deepEqual(actual, { value: expected.resolves });
    return;
  }
  assert.ok(actual !== undefined && "error" in actual, "the admission attempt must reject");
  assert.ok(expected.rejects(actual.error), "the admission attempt rejected with another error");
}

describe("Deadline-bounded delivery shutdown", () => {
  it("an empty set of operations completes before the deadline with zero abandoned", async () => {
    const { timers, wasCleared } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });

    const report = await gate.shutdown();

    assert.deepEqual(report, { accepted: 0, completed: 0, abandoned: 0 });
    assert.equal(wasCleared(), true);
  });

  it("drains admitted operations that settle before the deadline", async () => {
    const { timers, wasCleared } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });
    const first = deferred<string>();
    const second = deferred<string>();

    const firstSubmit = gate.submit(() => first.promise);
    const secondSubmit = gate.submit(() => second.promise);

    const shutdownPromise = gate.shutdown();
    first.resolve("first-done");
    second.resolve("second-done");

    const report = await shutdownPromise;
    assert.deepEqual(report, { accepted: 2, completed: 2, abandoned: 0 });
    assert.equal(wasCleared(), true);
    assert.deepEqual(await firstSubmit, { status: "admitted", result: "first-done" });
    assert.deepEqual(await secondSubmit, { status: "admitted", result: "second-done" });
  });

  it("marks outstanding work abandoned with exact accounting when the deadline expires", async () => {
    const { timers, fire } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });
    const first = deferred<string>();
    const second = deferred<string>();

    gate.submit(() => first.promise);
    gate.submit(() => second.promise);

    const shutdownPromise = gate.shutdown();
    fire();

    const report = await shutdownPromise;
    assert.deepEqual(report, { accepted: 2, completed: 0, abandoned: 2 });
  });

  it("never silently drops an abandoned operation — its own submit call still resolves once settled", async () => {
    const { timers, fire } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });
    const first = deferred<string>();

    const firstSubmit = gate.submit(() => first.promise);
    const shutdownPromise = gate.shutdown();
    fire();
    await shutdownPromise;

    first.resolve("late-but-not-lost");
    assert.deepEqual(await firstSubmit, { status: "admitted", result: "late-but-not-lost" });
  });

  it("rejects new admission after shutdown, even a submission attempted synchronously right after", async () => {
    const { timers } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });

    gate.shutdown();
    const result = await gate.submit(async () => "should not run");

    assert.deepEqual(result, { status: "rejected_shutting_down" });
  });

  it("is idempotent across repeated and concurrent shutdown calls", async () => {
    const { timers } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });

    const first = gate.shutdown();
    const second = gate.shutdown();
    const [firstReport, secondReport] = await Promise.all([first, second]);

    assert.equal(firstReport, secondReport);
    assert.deepEqual(await gate.shutdown(), firstReport);
  });

  it("rejects invalid construction options before any submission", () => {
    const { timers } = fakeDeadlineTimer();
    for (const deadlineMs of [-1, 1.5, Number.NaN]) {
      assert.throws(() => createDeliveryShutdown({ deadlineMs, timers }), TypeError);
    }
  });

  // A bounded test timeout, so a module that never schedules through the provider fails here instead of hanging.
  it("does not resolve the report before the deadline timer fires while work is outstanding", { timeout: 2_000 }, async () => {
    const { timers, fire, delays } = fakeDeadlineTimer();
    const gate = createDeliveryShutdown({ deadlineMs: 5000, timers });
    const settles = deferred<string>();
    const neverSettles = deferred<string>();

    const settledSubmit = gate.submit(() => settles.promise);
    gate.submit(() => neverSettles.promise);
    settles.resolve("done");
    await settledSubmit;

    let resolved = false;
    const shutdownPromise = gate.shutdown().then((report) => {
      resolved = true;
      return report;
    });
    await new Promise<void>((done) => setImmediate(done));
    assert.equal(resolved, false, "the report resolved before the deadline timer fired");
    assert.deepEqual(delays(), [5000], "shutdown must schedule one deadline timer for deadlineMs");

    fire();
    assert.deepEqual(await shutdownPromise, { accepted: 2, completed: 1, abandoned: 1 });
  });

  // The order the module had before it counted admissions, measured: a caller awaiting the last counted submit() call
  // directly, or through up to three awaiting async functions, saw its outcome before a caller awaiting the report.
  it("resolves the report only after the submit() call whose settlement it counted last", { timeout: 2_000 }, async () => {
    for (const layers of [0, 1, 2, 3]) {
      assert.deepEqual(await firstToSee(layers), ["submit() outcome", "shutdown report"], `${layers} awaiting layer(s)`);
    }
  });

  it("reads no clock or timer other than the injected timer provider", async () => {
    const text = readFileSync(SHUTDOWN_SOURCE, "utf8");
    const { collectCouplingReferences } = (await import(pathToFileURL(COUPLING_POLICY).href)) as {
      collectCouplingReferences(artifactPath: string, sourceText: string): CouplingReferences;
    };
    const references = collectCouplingReferences("src/delivery-shutdown.ts", text);
    assert.deepEqual(references.failures, []);
    assert.deepEqual(references.identifiers, PERMITTED_GLOBALS);

    const source = ts.createSourceFile(SHUTDOWN_SOURCE, text, ts.ScriptTarget.Latest, true);
    assert.deepEqual(moduleReferences(source), [
      'import type { AuditTimerProvider } from "@bloodtrail/security-audit-sdk-core"',
    ]);
  });

  describe("counts every admission exactly once", () => {
    for (const row of ACCOUNTING_ROWS) {
      // A bounded timeout, so a report that never resolves fails its row instead of hanging the run.
      it(`${row.row}: ${row.scenario}`, { timeout: 2_000 }, () => runAccountingRow(row));
    }
  });
});

/** Every way the module reaches another module: imports, re-exports and dynamic `import()`. */
function moduleReferences(source: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) || ts.isImportEqualsDeclaration(node)) {
      found.push(node.getText(source).replace(/;$/, ""));
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier !== undefined) {
      found.push(node.getText(source));
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      found.push(node.getText(source));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
