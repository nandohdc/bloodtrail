import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";
import ts from "typescript";
import type { AuditTimerHandle, AuditTimerProvider } from "@bloodtrail/security-audit-sdk-core";
import { createDeliveryShutdown } from "../dist/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHUTDOWN_SOURCE = resolve(packageRoot, "src/delivery-shutdown.ts");

const COUPLING_POLICY = resolve(packageRoot, "scripts/platform-coupling-policy.mjs");

// Every global the shutdown module may name. Any other free identifier fails the source check, so a clock or timer
// reached through a global (`setTimeout`, `Date`, `performance`, `Temporal`, `Intl`, `MessageChannel`, `globalThis`,
// `eval`, ...) cannot arrive without this list changing.
const PERMITTED_GLOBALS = ["Number", "Object", "Promise", "Set", "TypeError"];

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
