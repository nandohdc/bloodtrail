#!/usr/bin/env node
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { posix, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { repositoryRoot, sonarPropertyFor } from "./check-package-discovery.mjs";

/**
 * Normalizes the lcov reports handed to the required static-analysis gate so
 * that every record they contain names a component that gate analyses.
 *
 * Two things happen here and only one of them is new. Each report records
 * paths relative to its own package while the scan runs from the repository
 * root, so the paths have always had to be rewritten. What is new is the
 * filtering: the reports also carry records for files `sonar.exclusions`
 * covers — built output executed by the runtime tests, and the generated Ajv
 * validator, which exists only as a `.cjs` file under `dist/` with no source
 * map and so cannot be mapped back to `src/` the way every other record is.
 * The analyser cannot match those to an indexed component and answers with
 * `WARN Could not resolve N file paths`, which it has printed on every run for
 * as long as the repository-wide scan has existed (#442).
 *
 * A warning that is always present cannot distinguish a new defect from the
 * standing one, so this removes the records rather than the warning, and then
 * fails on anything left that cannot be attributed. Coverage figures do not
 * move: a record is dropped only when it names no indexed component, and such
 * a file carries no measure to change.
 *
 * The scope is read from `sonar-project.properties`, never restated. A second
 * copy of the source roots, the exclusion globs or the report list is the
 * stale-list defect this repository has already recorded four times (#412,
 * #441 twice, #452).
 */

const PROPERTIES_FILE = "sonar-project.properties";

/** Every report path is `<package root>/coverage/lcov.info`; the root is derived, never listed. */
const REPORT_SUFFIX = "/coverage/lcov.info";

/**
 * Glob constructs this matcher does not implement. `sonar.exclusions` uses only
 * `**`, `*` and `?`, and a pattern reaching for anything else is rejected rather
 * than matched too narrowly — under-matching would silently keep a record the
 * analyser excludes, which is the state being fixed.
 */
const UNSUPPORTED_GLOB_CHARACTERS = Object.freeze(["[", "]", "{", "}", "(", ")", "+", "@", "!", "|", "^", "$", "\\"]);

function fail(diagnostic) {
  throw new Error(`coverage report normalisation failed:\n  ${diagnostic}`);
}

function requiredProperty(propertiesText, key) {
  const value = sonarPropertyFor(propertiesText, key);
  if (value === null || value.length === 0) {
    fail(`[coverage-scope-absent] ${PROPERTIES_FILE} declares no ${key}`);
  }
  return value;
}

/**
 * Reads the analysis scope the gate itself reads: which reports are supplied,
 * which roots are indexed, and which paths are excluded from indexing.
 */
export function readAnalysisScope(propertiesText) {
  return {
    reports: requiredProperty(propertiesText, "sonar.javascript.lcov.reportPaths"),
    roots: [
      ...requiredProperty(propertiesText, "sonar.sources"),
      ...requiredProperty(propertiesText, "sonar.tests"),
    ],
    exclusions: requiredProperty(propertiesText, "sonar.exclusions"),
  };
}

/** The package a report belongs to, derived from the report path rather than declared beside it. */
export function packageRootFor(reportPath) {
  if (!reportPath.endsWith(REPORT_SUFFIX)) {
    fail(`[coverage-report-shape] report path does not end in ${REPORT_SUFFIX}: ${reportPath}`);
  }
  return reportPath.slice(0, -REPORT_SUFFIX.length);
}

/**
 * Resolves a record path against its package root and normalises away any
 * parent-directory segments, so classification is decided on the real path.
 * The Node binding's report reaches sdk-core through `../security-audit-sdk-core/`,
 * and `packages/security-audit-sdk-node/../security-audit-sdk-core/src/sdk.ts`
 * is only equal to an indexed component after normalisation.
 */
export function normalizeRecordPath(packageRoot, recordPath) {
  const joined = posix.normalize(posix.join(packageRoot, recordPath));
  if (joined === ".." || joined.startsWith("../")) {
    fail(`[coverage-record-escapes-repository] record resolves outside the repository: ${recordPath}`);
  }
  return joined;
}

/** One path segment as expression source: `*` and `?` stay inside the segment. */
function literalSegmentSource(segment) {
  let source = "";
  for (const character of segment) {
    if (character === "*") source += "[^/]*";
    else if (character === "?") source += "[^/]";
    else if (character === ".") source += "\\.";
    else source += character;
  }
  return source;
}

/** Translates a Sonar wildcard pattern into an anchored expression, rejecting constructs it does not implement. */
export function globToRegExp(pattern) {
  const unsupported = UNSUPPORTED_GLOB_CHARACTERS.filter((character) => pattern.includes(character));
  if (unsupported.length > 0) {
    fail(
      `[coverage-glob-unsupported] exclusion pattern uses unimplemented construct(s) ${unsupported.join(" ")}: ${pattern}`,
    );
  }
  const segments = pattern.split("/");
  const parts = segments.map((segment, index) => {
    const isLast = index === segments.length - 1;
    if (segment === "**") return isLast ? ".*" : "(?:[^/]+/)*";
    return isLast ? literalSegmentSource(segment) : `${literalSegmentSource(segment)}/`;
  });
  return new RegExp(`^${parts.join("")}$`);
}

function isUnderRoot(path, roots) {
  return roots.some((root) => path === root || path.startsWith(`${root}/`));
}

function matchingExclusion(path, exclusions) {
  return exclusions.find((pattern) => globToRegExp(pattern).test(path)) ?? null;
}

/**
 * Decides whether the gate would index this path, and says why when it would
 * not. The existence check runs first and is deliberately a failure rather
 * than a drop: an excluded file is still present on disk, so an absent file
 * means the rewrite itself regressed — which is exactly what the standing
 * warning has never been able to distinguish from its own baseline.
 */
export function classifyRecord(path, scope, exists = existsSync(resolve(repositoryRoot, path))) {
  if (!exists) {
    fail(`[coverage-record-missing-file] record names a path that does not exist: ${path}`);
  }
  const exclusion = matchingExclusion(path, scope.exclusions);
  if (exclusion !== null) {
    return { kept: false, reason: `excluded by sonar.exclusions ${exclusion}` };
  }
  if (!isUnderRoot(path, scope.roots)) {
    return { kept: false, reason: "outside every sonar.sources and sonar.tests root" };
  }
  return { kept: true, reason: "analysed component" };
}

function assertRecordsAreTerminated(records, reportPath) {
  const unterminated = records.filter((record) => !record.lines.includes("end_of_record"));
  if (unterminated.length > 0) {
    fail(`[coverage-record-unterminated] ${reportPath} has ${unterminated.length} record(s) with no end_of_record`);
  }
}

/** Splits an lcov report into its leading lines and its `SF:` … `end_of_record` blocks. */
export function parseReport(text, reportPath) {
  const lines = text.split("\n");
  while (lines.length > 0 && lines.at(-1) === "") lines.pop();

  const preamble = [];
  const records = [];
  let current = null;
  for (const line of lines) {
    if (line.startsWith("SF:")) {
      current = { path: line.slice(3), lines: [] };
      records.push(current);
    } else if (current === null) {
      preamble.push(line);
    } else {
      current.lines.push(line);
    }
  }
  assertRecordsAreTerminated(records, reportPath);
  return { preamble, records };
}

function serializeReport(preamble, records) {
  const blocks = records.map((record) => [`SF:${record.path}`, ...record.lines].join("\n"));
  return `${[...preamble, ...blocks].join("\n")}\n`;
}

function partitionRecords(records, packageRoot, scope, classify) {
  const kept = [];
  const dropped = [];
  for (const record of records) {
    const path = normalizeRecordPath(packageRoot, record.path);
    const verdict = classify(path, scope);
    if (verdict.kept) kept.push({ path, lines: record.lines });
    else dropped.push({ path, reason: verdict.reason });
  }
  return { kept, dropped };
}

/** Real filesystem and classification, overridable so every failing arm has a control. */
const defaultIo = Object.freeze({
  exists: (path) => existsSync(path),
  read: (path) => readFileSync(path, "utf8"),
  write: (path, text) => writeFileSync(path, text),
  classify: (path, scope) => classifyRecord(path, scope),
});

/** Normalises and filters one report in place, returning what it kept and dropped. */
export function normalizeReport(reportPath, scope, io = defaultIo) {
  const absolute = resolve(repositoryRoot, reportPath);
  if (!io.exists(absolute)) {
    fail(`[coverage-report-missing] declared report is absent: ${reportPath}`);
  }
  const packageRoot = packageRootFor(reportPath);
  const { preamble, records } = parseReport(io.read(absolute), reportPath);
  const { kept, dropped } = partitionRecords(records, packageRoot, scope, io.classify);

  if (kept.length === 0) {
    fail(`[coverage-report-emptied] ${reportPath} would be left with no records at all`);
  }
  io.write(absolute, serializeReport(preamble, kept));
  return { reportPath, keptCount: kept.length, dropped };
}

function describe(result) {
  const dropped = result.dropped.map((entry) => `    - dropped ${entry.path}: ${entry.reason}`);
  return [`  ${result.reportPath}: kept ${result.keptCount}, dropped ${result.dropped.length}`, ...dropped].join("\n");
}

/** Normalises every report the gate declares, in the order it declares them. */
export function normalizeDeclaredReports(propertiesText = null, io = defaultIo) {
  const text = propertiesText ?? readFileSync(resolve(repositoryRoot, PROPERTIES_FILE), "utf8");
  const scope = readAnalysisScope(text);
  const results = scope.reports.map((reportPath) => normalizeReport(reportPath, scope, io));
  const droppedTotal = results.reduce((total, result) => total + result.dropped.length, 0);
  const summary = `coverage report normalisation passed: ${results.length} report(s), ${droppedTotal} record(s) dropped`;
  return {
    results,
    droppedTotal,
    message: `${summary}\n${results.map(describe).join("\n")}\n`,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    process.stdout.write(normalizeDeclaredReports().message);
  } catch (err) {
    process.stderr.write(`${err.message}\n`);
    process.exit(1);
  }
}
