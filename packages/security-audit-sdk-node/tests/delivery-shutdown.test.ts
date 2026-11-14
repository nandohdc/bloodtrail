import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import type { AuditTimerHandle, AuditTimerProvider } from "@bloodtrail/security-audit-sdk-core";
import { createDeliveryShutdown } from "../dist/index.js";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SHUTDOWN_SOURCE = resolve(packageRoot, "src/delivery-shutdown.ts");

// Globals through which the shutdown module could reach a clock or timer other than the injected provider.
const CLOCK_GLOBALS = new Set([
  "setTimeout",
  "clearTimeout",
  "setInterval",
  "clearInterval",
  "setImmediate",
  "clearImmediate",
  "Date",
  "performance",
  "process",
  "AbortSignal",
  "globalThis",
  "global",
  "require",
]);

function deferred<T>(): { promise: Promise<T>; resolve: (value: T) => void } {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

/** A deadline timer that only fires when the test calls `fire()`; records whether it was cleared. */
function fakeDeadlineTimer(): { timers: AuditTimerProvider; fire: () => void; wasCleared: () => boolean } {
  let scheduled: (() => void) | undefined;
  let cleared = false;
  const timers: AuditTimerProvider = Object.freeze({
    setTimeout(callback: () => void): AuditTimerHandle {
      scheduled = callback;
      return { unref() {} };
    },
    clearTimeout(): void {
      cleared = true;
    },
  });
  return { timers, fire: () => scheduled?.(), wasCleared: () => cleared };
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

  it("does not resolve the report before the deadline timer fires while work is outstanding", async () => {
    const { timers, fire } = fakeDeadlineTimer();
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

    fire();
    assert.deepEqual(await shutdownPromise, { accepted: 2, completed: 1, abandoned: 1 });
  });

  it("reads no clock or timer other than the injected timer provider", () => {
    const source = ts.createSourceFile(SHUTDOWN_SOURCE, readFileSync(SHUTDOWN_SOURCE, "utf8"), ts.ScriptTarget.Latest, true);
    assert.deepEqual(clockReferences(source), []);
    assert.deepEqual(moduleReferences(source), [
      'import type { AuditTimerProvider } from "@bloodtrail/security-audit-sdk-core"',
    ]);
  });
});

/** Every identifier naming a clock or timer global, outside a property-name position, as `name@line`. */
function clockReferences(source: ts.SourceFile): string[] {
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && CLOCK_GLOBALS.has(node.text) && !isPropertyName(node)) {
      found.push(`${node.text}@${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1}`);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function isPropertyName(node: ts.Identifier): boolean {
  const parent = node.parent;
  if (ts.isPropertyAccessExpression(parent)) return parent.name === node;
  if (ts.isQualifiedName(parent)) return parent.right === node;
  if (
    ts.isPropertyAssignment(parent) ||
    ts.isPropertySignature(parent) ||
    ts.isMethodSignature(parent) ||
    ts.isMethodDeclaration(parent) ||
    ts.isPropertyDeclaration(parent)
  ) {
    return parent.name === node;
  }
  return false;
}

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
