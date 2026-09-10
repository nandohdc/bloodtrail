import assert from "node:assert/strict";
import test from "node:test";
import {
  classifyRecord,
  globToRegExp,
  normalizeDeclaredReports,
  normalizeRecordPath,
  packageRootFor,
  parseReport,
  readAnalysisScope,
} from "./normalize-coverage-reports.mjs";

/**
 * Controls for the coverage report normalizer.
 *
 * Every failing arm is paired with the healthy input that must still pass, so
 * an arm cannot go vacuous unnoticed: a control that only ever sees the input
 * it rejects proves the rejection, not the distinction.
 */

const PROPERTIES = [
  "sonar.sources=packages/alpha/src,packages/beta/src",
  "sonar.tests=packages/alpha/tests",
  "sonar.exclusions=**/dist/**,packages/alpha/src/generated/**",
  "sonar.javascript.lcov.reportPaths=packages/alpha/coverage/lcov.info",
].join("\n");

const SCOPE = readAnalysisScope(PROPERTIES);

function record(path, hits = "DA:1,1") {
  return [`SF:${path}`, "FN:1,thing", hits, "LH:1", "LF:1", "end_of_record"].join("\n");
}

function reportText(...paths) {
  return `TN:\n${paths.map((path) => record(path)).join("\n")}\n`;
}

/** An in-memory filesystem so a control can state exactly which paths exist. */
function fakeIo(files, existingPaths) {
  const written = new Map();
  return {
    written,
    exists: (path) => files.has(path),
    read: (path) => files.get(path),
    write: (path, text) => written.set(path, text),
    classify: (path, scope) => classifyRecord(path, scope, existingPaths.has(path)),
  };
}

function runWith(text, existingPaths, properties = PROPERTIES) {
  const files = new Map([[resolveReport(), text]]);
  const io = fakeIo(files, new Set(existingPaths));
  const result = normalizeDeclaredReports(properties, io);
  return { result, output: io.written.get(resolveReport()) };
}

function resolveReport() {
  return new URL("../../packages/alpha/coverage/lcov.info", import.meta.url).pathname;
}

test("the analysis scope is read from the declaration rather than restated", () => {
  assert.deepEqual(SCOPE.reports, ["packages/alpha/coverage/lcov.info"]);
  assert.deepEqual(SCOPE.roots, ["packages/alpha/src", "packages/beta/src", "packages/alpha/tests"]);
  assert.deepEqual(SCOPE.exclusions, ["**/dist/**", "packages/alpha/src/generated/**"]);
});

test("a missing scope key fails rather than defaulting to an empty scope", () => {
  const withoutExclusions = PROPERTIES.split("\n")
    .filter((line) => !line.startsWith("sonar.exclusions="))
    .join("\n");
  assert.throws(() => readAnalysisScope(withoutExclusions), /coverage-scope-absent/);
  assert.doesNotThrow(() => readAnalysisScope(PROPERTIES));
});

test("a report's package root is derived from its path, and a report of another shape fails", () => {
  assert.equal(packageRootFor("packages/alpha/coverage/lcov.info"), "packages/alpha");
  assert.equal(packageRootFor("research/thing/coverage/lcov.info"), "research/thing");
  assert.throws(() => packageRootFor("packages/alpha/coverage/lcov.dat"), /coverage-report-shape/);
});

test("parent-directory segments are resolved before classification", () => {
  assert.equal(
    normalizeRecordPath("packages/beta", "../alpha/src/thing.ts"),
    "packages/alpha/src/thing.ts",
  );
  assert.equal(normalizeRecordPath("packages/beta", "src/thing.ts"), "packages/beta/src/thing.ts");
});

test("a record resolving outside the repository fails", () => {
  assert.throws(
    () => normalizeRecordPath("packages/beta", "../../../elsewhere/thing.ts"),
    /coverage-record-escapes-repository/,
  );
  assert.doesNotThrow(() => normalizeRecordPath("packages/beta", "../alpha/src/thing.ts"));
});

test("the glob matcher implements ** across segments and * within one", () => {
  assert.ok(globToRegExp("**/dist/**").test("packages/alpha/dist/generated/x.cjs"));
  assert.ok(!globToRegExp("**/dist/**").test("packages/alpha/src/x.ts"));
  assert.ok(globToRegExp("packages/alpha/src/generated/**").test("packages/alpha/src/generated/c.ts"));
  assert.ok(!globToRegExp("packages/alpha/src/generated/**").test("packages/beta/src/generated/c.ts"));
  assert.ok(globToRegExp("packages/*/scripts/**").test("packages/alpha/scripts/check.mjs"));
  assert.ok(!globToRegExp("packages/*/scripts/**").test("packages/alpha/nested/scripts/check.mjs"));
});

test("an unimplemented glob construct is rejected rather than matched too narrowly", () => {
  assert.throws(() => globToRegExp("packages/{alpha,beta}/**"), /coverage-glob-unsupported/);
  assert.throws(() => globToRegExp("packages/[ab]lpha/**"), /coverage-glob-unsupported/);
  assert.doesNotThrow(() => globToRegExp("packages/*/scripts/**"));
});

test("an excluded record is dropped and an analysed one is kept", () => {
  const excluded = classifyRecord("packages/alpha/dist/generated/v.cjs", SCOPE, true);
  assert.equal(excluded.kept, false);
  assert.match(excluded.reason, /excluded by sonar\.exclusions \*\*\/dist\/\*\*/);

  const kept = classifyRecord("packages/alpha/src/thing.ts", SCOPE, true);
  assert.equal(kept.kept, true);
});

test("a record under no declared root is dropped, and a test root counts as a root", () => {
  const outside = classifyRecord("tools/helper.mjs", SCOPE, true);
  assert.equal(outside.kept, false);
  assert.match(outside.reason, /outside every sonar\.sources and sonar\.tests root/);

  assert.equal(classifyRecord("packages/alpha/tests/a.test.ts", SCOPE, true).kept, true);
});

test("a record naming a path that does not exist fails instead of being dropped", () => {
  assert.throws(
    () => classifyRecord("packages/alpha/src/moved.ts", SCOPE, false),
    /coverage-record-missing-file/,
  );
  assert.doesNotThrow(() => classifyRecord("packages/alpha/src/moved.ts", SCOPE, true));
});

test("an unterminated record fails rather than being silently truncated", () => {
  const healthy = reportText("src/thing.ts");
  assert.equal(parseReport(healthy, "r").records.length, 1);
  assert.throws(
    () => parseReport("TN:\nSF:src/thing.ts\nDA:1,1\n", "r"),
    /coverage-record-unterminated/,
  );
});

test("a report of only analysed records passes through unchanged apart from its paths", () => {
  const { result, output } = runWith(reportText("src/a.ts", "tests/b.test.ts"), [
    "packages/alpha/src/a.ts",
    "packages/alpha/tests/b.test.ts",
  ]);
  assert.equal(result.droppedTotal, 0);
  assert.equal(output, reportText("packages/alpha/src/a.ts", "packages/alpha/tests/b.test.ts"));
});

test("an excluded record is removed from the written report and reported with its reason", () => {
  const { result, output } = runWith(reportText("src/a.ts", "dist/generated/v.cjs"), [
    "packages/alpha/src/a.ts",
    "packages/alpha/dist/generated/v.cjs",
  ]);
  assert.equal(result.droppedTotal, 1);
  assert.equal(output, reportText("packages/alpha/src/a.ts"));
  assert.match(result.message, /dropped packages\/alpha\/dist\/generated\/v\.cjs: excluded by/);
});

test("a cross-package record resolving to an analysed component is retained", () => {
  const { result, output } = runWith(reportText("src/a.ts", "../beta/src/shared.ts"), [
    "packages/alpha/src/a.ts",
    "packages/beta/src/shared.ts",
  ]);
  assert.equal(result.droppedTotal, 0);
  assert.equal(output, reportText("packages/alpha/src/a.ts", "packages/beta/src/shared.ts"));
});

test("a report left with no records at all fails", () => {
  assert.throws(
    () => runWith(reportText("dist/generated/v.cjs"), ["packages/alpha/dist/generated/v.cjs"]),
    /coverage-report-emptied/,
  );
  assert.doesNotThrow(() =>
    runWith(reportText("src/a.ts", "dist/generated/v.cjs"), [
      "packages/alpha/src/a.ts",
      "packages/alpha/dist/generated/v.cjs",
    ]),
  );
});

test("a declared report that is absent fails", () => {
  const io = fakeIo(new Map(), new Set());
  assert.throws(() => normalizeDeclaredReports(PROPERTIES, io), /coverage-report-missing/);

  const present = fakeIo(new Map([[resolveReport(), reportText("src/a.ts")]]), new Set(["packages/alpha/src/a.ts"]));
  assert.doesNotThrow(() => normalizeDeclaredReports(PROPERTIES, present));
});

test("the preamble is preserved and the report ends with exactly one newline", () => {
  const { output } = runWith(reportText("src/a.ts"), ["packages/alpha/src/a.ts"]);
  assert.ok(output.startsWith("TN:\n"));
  assert.ok(output.endsWith("end_of_record\n"));
  assert.ok(!output.endsWith("\n\n"));
});

test("the repository's own declaration is readable by this reader", async () => {
  const { readFileSync } = await import("node:fs");
  const text = readFileSync(new URL("../../sonar-project.properties", import.meta.url), "utf8");
  const scope = readAnalysisScope(text);
  assert.ok(scope.reports.length > 0);
  assert.ok(scope.roots.length > 0);
  assert.ok(scope.exclusions.length > 0);
  for (const reportPath of scope.reports) assert.doesNotThrow(() => packageRootFor(reportPath));
  for (const pattern of scope.exclusions) assert.doesNotThrow(() => globToRegExp(pattern));
});
