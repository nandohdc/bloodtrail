// Authority-scope regression matrix (issue #78 — option C formalization).
//
// Every arm's expected result was recorded BEFORE any implementation change
// (the RED record), asserted against the unmodified package, and re-verified
// after the comments-only formalization (the GREEN record): under option C no
// arm may change result. The nine arms of the design plus the duplicate arm:
//
//   same      — one SDK instance, one module copy ..................... accepted
//   foreign   — two SDK instances, one module copy .................... accepted (settled, F7)
//   forged    — plain object/cast claiming a brand .................... rejected
//   cloned    — structuredClone of a branded value .................... rejected
//   copy      — two genuine installed copies .......................... rejected with DUPLICATE_AUTHORITY before the sink
//   duplicate — genuine nested duplicate copy ......................... rejected with DUPLICATE_AUTHORITY (dedicated #79 diagnostic)
//   nested    — nested AsyncLocalStorage scopes ....................... isolation preserved
//   concurrent— concurrent AsyncLocalStorage scopes ................... no leakage
//   cleanup   — scope exit ............................................ no retention
//   null      — unmutated package satisfies every recorded arm ......... full matrix passes
//
// Every arm carries a null control: the three mutation tests at the bottom of
// this file prove the foreign/forged/cloned arms fail when their guarded
// invariant is violated by a fixture mutation, in a disposable clone — a green
// arm that could never be red proves nothing.
//
// The copy/duplicate arms build a GENUINE second installed copy in a
// disposable clone (npm pack + two independent npm installs), never one module
// imported twice, so sibling verification tests that snapshot the live
// package in parallel are never written to.
import assert from "node:assert/strict";
import { AsyncLocalStorage } from "node:async_hooks";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { packageRoot, repositoryRoot } from "../../scripts/verification-helpers.mjs";
import * as sdk from "../../dist/index.js";
import { createCapturingAuditSink } from "../../dist/testing.js";

const verificationAls = new AsyncLocalStorage();
sdk.setContextProvider({
  run: (ctx, fn) => verificationAls.run(ctx, fn),
  get: () => verificationAls.getStore(),
});

const PACKAGE_INSTALL_PREFIX = "@bloodtrail/security-audit-sdk-core";

const suiteRoot = mkdtempSync(resolve(tmpdir(), "bloodtrail-authority-scope-"));

test.after(() => {
  rmSync(suiteRoot, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------
// Enumeration control — the insertion surface is pinned by BOTH counts,
// derived from src/context.ts itself, and the two counts are never conflated.
// ---------------------------------------------------------------------------

function enumerationCounts() {
  const source = readFileSync(resolve(packageRoot, "src/context.ts"), "utf8");
  const constructors = [...source.matchAll(/^export function ([A-Za-z0-9_]+)/gm)].map((match) => match[1]);
  const unionStart = source.indexOf("export type AuditBrandKind");
  const unionEnd = source.indexOf(";", unionStart);
  const unionBlock = source.slice(unionStart, unionEnd);
  const kinds = [...unionBlock.matchAll(/"([a-z_]+)"/g)].map((match) => match[1]);
  return { constructors, kinds };
}

test("authority-scope enumeration: exactly 35 exported constructors and 19 AuditBrandKind members", () => {
  const { constructors, kinds } = enumerationCounts();
  assert.equal(
    constructors.length,
    35,
    `exported brand-constructor count drifted: expected exactly 35 export function declarations in src/context.ts, found ${constructors.length}`,
  );
  assert.equal(
    kinds.length,
    19,
    `AuditBrandKind member count drifted: expected exactly 19 union members in src/context.ts, found ${kinds.length}`,
  );
  assert.equal(new Set(constructors).size, constructors.length, "exported brand constructors must be uniquely named");
  assert.equal(new Set(kinds).size, kinds.length, "AuditBrandKind members must be unique");
});

// ---------------------------------------------------------------------------
// Arm fixtures — each returns its recorded result string so the null arm can
// re-run the whole matrix against the unmutated package.
// ---------------------------------------------------------------------------

function createInstance(sink) {
  return sdk.createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: { name: "authority-scope-verification", version: "1.0.0" },
    service: { name: "authority-scope" },
    environment: { name: "verification" },
    sink,
  });
}

// The foreign arm's branding source: both SDK instances resolve THIS single
// module copy. The cross-copy mutation replaces this line with an import of a
// second copy, which must flip the arm from accepted to rejected.
const FOREIGN_BRANDING_SOURCE = sdk;

// Every arm below is declared `async` and returns its recorded result string.
// The null arm drives all nine through one `await run()` over a matrix, so they
// share a single contract; three of them are genuinely asynchronous. Dropping
// `async` from the synchronous ones would make that shared `await` operate on a
// bare string for some arms and a promise for others.

async function runSameArm() {
  const instance = createInstance(createCapturingAuditSink());
  const actor = sdk.authoritativeActor({ type: "administrator", id: "arm-same" });
  let observed;
  instance.runWithContext({ actor }, () => {
    observed = sdk.currentAuditContext();
  });
  assert.equal(observed?.actor?.id, "arm-same");
  return "accepted";
}

async function runForeignArm() {
  const instanceA = createInstance(createCapturingAuditSink());
  const instanceB = createInstance(createCapturingAuditSink());
  const actor = FOREIGN_BRANDING_SOURCE.authoritativeActor({ type: "administrator", id: "arm-foreign" });
  let observedA;
  let observedB;
  instanceA.runWithContext({ actor }, () => {
    observedA = sdk.currentAuditContext();
  });
  instanceB.runWithContext({ actor }, () => {
    observedB = sdk.currentAuditContext();
  });
  assert.equal(observedA?.actor?.id, "arm-foreign");
  assert.equal(observedB?.actor?.id, "arm-foreign");
  return "accepted";
}

async function runForgedArm() {
  const forgedValue = { type: "administrator", id: "arm-forged" };
  assert.throws(
    () => sdk.runWithAuditContext({ actor: forgedValue }, () => {}),
    (error) =>
      error instanceof sdk.SecurityAuditSdkError
      && error.code === "AUTHORITY_ESCALATION"
      && error.category === "authority"
      && error.path === "/actor"
      && !JSON.stringify(error.toJSON()).includes("arm-forged")
      && JSON.stringify(error.toJSON()).length < 512,
  );
  return "rejected";
}

async function runClonedArm() {
  const brandedValue = sdk.authoritativeActor({ type: "administrator", id: "arm-cloned" });
  const clonedValue = structuredClone(brandedValue);
  assert.notEqual(clonedValue, brandedValue);
  assert.throws(
    () => sdk.runWithAuditContext({ actor: clonedValue }, () => {}),
    (error) =>
      error instanceof sdk.SecurityAuditSdkError
      && error.code === "AUTHORITY_ESCALATION"
      && error.category === "authority",
  );
  return "rejected";
}

// The copy and duplicate arms share one parameterized runner. #79 made both
// fixtures produce the SAME diagnostic, which converged two distinct arm
// tests into one test over two fixtures — a semantic convergence that reads
// as structural duplication. The arms differ only in which copy validates
// (validator), which copy supplies the foreign value (foreign), and which
// recorded result string they return. Each arm keeps its own test
// registration, its own null-arm matrix entry, and its own per-fixture
// assertions inside the shared runner.
const PROBE_ARMS = {
  copy: {
    label: "copy",
    result: "rejected (DUPLICATE_AUTHORITY before the sink)",
    validatorIndex: (fixture) => installedCopyPath(fixture.consumerB),
    foreignIndex: (fixture) => installedCopyPath(fixture.consumerA),
    idPrefix: "copy",
  },
  duplicate: {
    label: "duplicate",
    result: "rejected (DUPLICATE_AUTHORITY)",
    validatorIndex: (fixture) => nestedCopyIndex(fixture.consumerA),
    foreignIndex: (fixture) => installedCopyPath(fixture.consumerA),
    idPrefix: "duplicate",
  },
};

async function runProbeArm(arm) {
  const fixture = disposableFixture();
  const record = runProbeRecord(fixture.caseRoot, writeProbe(fixture, {
    validatorIndex: arm.validatorIndex(fixture),
    foreignIndex: arm.foreignIndex(fixture),
    idPrefix: arm.idPrefix,
  }));
  assert.equal(record.copiesDistinct, true, `the ${arm.label} fixture resolved a single module copy`);
  assert.equal(record.sameCopyAccepted, true, "same-copy control was rejected: the fixture's machinery is broken");
  assert.equal(record.rejectedCode, "DUPLICATE_AUTHORITY", `${arm.label} value was not rejected with DUPLICATE_AUTHORITY`);
  assert.equal(record.boundedShape, true, `${arm.label} rejection was not bounded to code, category, and path`);
  assert.equal(record.canonicalMessage, true, `${arm.label} rejection message must name the invariant and the deduplication remediation`);
  return arm.result;
}

async function runNestedArm() {
  const outer = sdk.authoritativeActor({ type: "administrator", id: "arm-nested-outer" });
  const inner = sdk.authoritativeActor({ type: "service_account", id: "arm-nested-inner" });
  const tenant = sdk.authoritativeTenant({
    scope: "tenant",
    actor_tenant_id: "arm-nested-tenant",
    effective_tenant_id: "arm-nested-tenant",
    resource_tenant_id: "arm-nested-tenant",
  });
  let inside;
  let after;
  sdk.runWithAuditContext({ actor: outer }, () => {
    sdk.runWithAuditContext({ actor: inner, tenant }, () => {
      inside = sdk.currentAuditContext();
    });
    after = sdk.currentAuditContext();
  });
  assert.equal(inside?.actor?.id, "arm-nested-inner");
  assert.equal(inside?.tenant?.effective_tenant_id, "arm-nested-tenant");
  assert.equal(after?.actor?.id, "arm-nested-outer");
  assert.equal(after?.tenant, undefined);
  return "isolation preserved";
}

async function runConcurrentArm() {
  const first = sdk.authoritativeActor({ type: "administrator", id: "arm-concurrent-1" });
  const second = sdk.authoritativeActor({ type: "service_account", id: "arm-concurrent-2" });
  const firstSeen = [];
  const secondSeen = [];
  await Promise.all([
    sdk.runWithAuditContext({ actor: first }, async () => {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
      firstSeen.push(sdk.currentAuditContext()?.actor?.id);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 10));
      firstSeen.push(sdk.currentAuditContext()?.actor?.id);
    }),
    sdk.runWithAuditContext({ actor: second }, async () => {
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 5));
      secondSeen.push(sdk.currentAuditContext()?.actor?.id);
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 15));
      secondSeen.push(sdk.currentAuditContext()?.actor?.id);
    }),
  ]);
  assert.deepEqual(firstSeen, ["arm-concurrent-1", "arm-concurrent-1"]);
  assert.deepEqual(secondSeen, ["arm-concurrent-2", "arm-concurrent-2"]);
  assert.equal(sdk.currentAuditContext(), undefined);
  return "no leakage";
}

async function runCleanupArm() {
  const actor = sdk.authoritativeActor({ type: "administrator", id: "arm-cleanup" });
  let inside;
  sdk.runWithAuditContext({ actor }, () => {
    inside = sdk.currentAuditContext();
  });
  assert.equal(inside?.actor?.id, "arm-cleanup");
  assert.equal(sdk.currentAuditContext(), undefined);
  return "no retention";
}

// ---------------------------------------------------------------------------
// The nine recorded arm tests.
// ---------------------------------------------------------------------------

test("authority-scope arm same: one instance, one module copy accepts a branded value", async () => {
  assert.equal(await runSameArm(), "accepted");
});

test("authority-scope arm foreign: two instances, one module copy accept each other's brands", async () => {
  assert.equal(await runForeignArm(), "accepted");
});

test("authority-scope arm forged: a plain object or TypeScript cast claiming a brand is rejected", async () => {
  assert.equal(await runForgedArm(), "rejected");
});

test("authority-scope arm cloned: a structuredClone of a branded value is rejected", async () => {
  assert.equal(await runClonedArm(), "rejected");
});

test("authority-scope arm copy: two genuinely installed copies reject a cross-copy value with DUPLICATE_AUTHORITY before the sink", async () => {
  assert.equal(await runProbeArm(PROBE_ARMS.copy), PROBE_ARMS.copy.result);
});

test("authority-scope arm duplicate: a genuine nested duplicate copy is rejected with DUPLICATE_AUTHORITY", async () => {
  assert.equal(await runProbeArm(PROBE_ARMS.duplicate), PROBE_ARMS.duplicate.result);
});

test("authority-scope arm nested: nested AsyncLocalStorage scopes preserve isolation", async () => {
  assert.equal(await runNestedArm(), "isolation preserved");
});

test("authority-scope arm concurrent: concurrent AsyncLocalStorage scopes do not leak", async () => {
  assert.equal(await runConcurrentArm(), "no leakage");
});

test("authority-scope arm cleanup: scope exit retains nothing", async () => {
  assert.equal(await runCleanupArm(), "no retention");
});

test("authority-scope arm null: the unmutated package satisfies every recorded arm expectation", async () => {
  const matrix = [
    ["same", "accepted", runSameArm],
    ["foreign", "accepted", runForeignArm],
    ["forged", "rejected", runForgedArm],
    ["cloned", "rejected", runClonedArm],
    ["copy", PROBE_ARMS.copy.result, () => runProbeArm(PROBE_ARMS.copy)],
    ["duplicate", PROBE_ARMS.duplicate.result, () => runProbeArm(PROBE_ARMS.duplicate)],
    ["nested", "isolation preserved", runNestedArm],
    ["concurrent", "no leakage", runConcurrentArm],
    ["cleanup", "no retention", runCleanupArm],
  ];
  for (const [arm, expected, run] of matrix) {
    assert.equal(await run(), expected, `null arm: the ${arm} arm drifted from its recorded RED/GREEN result`);
  }
  const { constructors, kinds } = enumerationCounts();
  assert.equal(constructors.length, 35, "null arm: exported brand-constructor count drifted from the unmutated baseline");
  assert.equal(kinds.length, 19, "null arm: AuditBrandKind member count drifted from the unmutated baseline");
});

// ---------------------------------------------------------------------------
// Genuine two-copy fixture — disposable clone, npm pack, two independent
// installs, and a nested duplicate inside the first consumer. Built once per
// suite run and shared by the copy, duplicate, and null arms.
// ---------------------------------------------------------------------------

let builtFixture;

function disposableFixture() {
  if (!builtFixture) builtFixture = buildDisposableFixture();
  return builtFixture;
}

function buildDisposableFixture() {
  const caseRoot = mkdtempSync(resolve(suiteRoot, "two-copy-"));
  // The clone mirrors the repository layout: the package clone sits at
  // packages/security-audit-sdk-core and contracts/ beside it, so the
  // generate step inside npm run build resolves its input the same way the
  // live repository does.
  const pkgClone = resolve(caseRoot, "packages/security-audit-sdk-core");
  copyPackageStable(packageRoot, pkgClone, { includeDist: false });
  cpSync(resolve(repositoryRoot, "contracts"), resolve(caseRoot, "contracts"), { recursive: true, force: true });
  symlinkSync(resolve(packageRoot, "node_modules"), resolve(pkgClone, "node_modules"), "dir");

  const build = spawnSync("npm", ["run", "build"], { cwd: pkgClone, encoding: "utf8", timeout: 180_000 });
  assert.equal(build.status, 0, `authority-scope fixture build failed:\n${build.stdout}\n${build.stderr}`);

  const packRoot = resolve(caseRoot, "pack");
  mkdirSync(packRoot, { recursive: true });
  const pack = spawnSync(
    "npm",
    ["pack", "--json", "--pack-destination", packRoot, "--ignore-scripts", "--loglevel", "error"],
    { cwd: pkgClone, encoding: "utf8", timeout: 60_000 },
  );
  assert.equal(pack.status, 0, `authority-scope fixture pack failed:\n${pack.stdout}\n${pack.stderr}`);
  const packReports = Array.isArray(JSON.parse(pack.stdout)) ? JSON.parse(pack.stdout) : [JSON.parse(pack.stdout)];
  const tarball = resolve(packRoot, packReports.filter((entry) => entry?.filename?.endsWith(".tgz"))[0].filename);

  const consumerA = installConsumer(caseRoot, "consumer-a", tarball);
  const consumerB = installConsumer(caseRoot, "consumer-b", tarball);
  // The nested duplicate copy is installed into its own directory first, so
  // npm cannot dedupe it against the consumer-a top-level install, then laid
  // down under consumer-a's node_modules tree as a genuine nested copy.
  const wrapperInstall = installConsumer(caseRoot, "wrapper-install", tarball);
  const nestedCopyRoot = resolve(consumerA, "node_modules/duplicate-wrapper/node_modules");
  cpSync(resolve(wrapperInstall, "node_modules"), nestedCopyRoot, { recursive: true, force: true });

  return Object.freeze({ caseRoot, consumerA, consumerB, tarball });
}

function installConsumer(caseRoot, name, tarball) {
  const consumerRoot = resolve(caseRoot, name);
  mkdirSync(consumerRoot, { recursive: true });
  writeFileSync(
    resolve(consumerRoot, "package.json"),
    `${JSON.stringify({ name: "authority-scope-consumer", version: "1.0.0", private: true, type: "module" })}\n`,
  );
  const install = spawnSync(
    "npm",
    ["install", tarball, "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline", "--loglevel", "error"],
    { cwd: consumerRoot, encoding: "utf8", timeout: 120_000 },
  );
  assert.equal(install.status, 0, `authority-scope fixture install failed (${name}):\n${install.stdout}\n${install.stderr}`);
  return consumerRoot;
}

function installedCopyPath(consumerRoot) {
  return resolve(consumerRoot, "node_modules", PACKAGE_INSTALL_PREFIX, "dist/index.js");
}

// One probe writer and one probe source shared by the copy and duplicate
// arms. The generated probe imports both installed copies BY ABSOLUTE FILE
// URL in one process and asserts the resolved context modules are distinct
// before any rejection evidence is recorded; the validator copy then rejects
// a value branded by the foreign copy. The copy arm validates with consumer
// B and takes the foreign value from consumer A; the duplicate arm validates
// with the nested copy and takes the foreign value from the top install.
function writeProbe(fixture, { validatorIndex, foreignIndex, idPrefix }) {
  const probePath = resolve(fixture.caseRoot, `probe-${idPrefix}.mjs`);
  writeFileSync(probePath, probeSource({ validatorIndex, foreignIndex, idPrefix }), "utf8");
  return probePath;
}

function nestedCopyIndex(consumerA) {
  return resolve(consumerA, "node_modules/duplicate-wrapper/node_modules", PACKAGE_INSTALL_PREFIX, "dist/index.js");
}

function probeSource({ validatorIndex, foreignIndex, idPrefix }) {
  return [
    `import assert from "node:assert/strict";`,
    `import { realpathSync } from "node:fs";`,
    `import { pathToFileURL } from "node:url";`,
    `const validator = await import(pathToFileURL(${JSON.stringify(validatorIndex)}).href);`,
    `const foreign = await import(pathToFileURL(${JSON.stringify(foreignIndex)}).href);`,
    `const testingValidator = await import(pathToFileURL(${JSON.stringify(resolve(validatorIndex, "../testing.js"))}).href);`,
    `const contextValidator = realpathSync(${JSON.stringify(resolve(validatorIndex, "../context.js"))});`,
    `const contextForeign = realpathSync(${JSON.stringify(resolve(foreignIndex, "../context.js"))});`,
    `assert.notEqual(contextValidator, contextForeign, "${idPrefix} fixture resolved a single module copy");`,
    `const sinkValidator = testingValidator.createCapturingAuditSink();`,
    `const instanceValidator = validator.createSecurityAuditSdk({`,
    `  contractVersion: "1.0.0",`,
    `  producer: { name: "authority-scope-${idPrefix}", version: "1.0.0" },`,
    `  service: { name: "${idPrefix}" },`,
    `  environment: { name: "verification" },`,
    `  sink: sinkValidator,`,
    `});`,
    `let sameCopyAccepted = false;`,
    `const ownBrand = validator.authoritativeActor({ type: "administrator", id: "${idPrefix}-own" });`,
    `instanceValidator.runWithContext({ actor: ownBrand }, () => { sameCopyAccepted = true; });`,
    `assert.equal(sameCopyAccepted, true, "same-copy control failed: fixture machinery is broken");`,
    `const foreignBrand = foreign.authoritativeActor({ type: "administrator", id: "${idPrefix}-cross" });`,
    `let reached = false;`,
    `let rejection;`,
    `try {`,
    `  instanceValidator.runWithContext({ actor: foreignBrand }, () => { reached = true; });`,
    `} catch (error) { rejection = error; }`,
    `assert.equal(reached, false, "${idPrefix} value reached the callback");`,
    `assert.equal(sinkValidator.events.length, 0, "${idPrefix} value reached the sink");`,
    `assert.ok(rejection && rejection.name === "SecurityAuditSdkError", "${idPrefix} rejection is not a SecurityAuditSdkError");`,
    `assert.equal(rejection.code, "DUPLICATE_AUTHORITY");`,
    `assert.equal(rejection.category, "authority");`,
    `assert.equal(rejection.path, "/actor");`,
    `const serialized = JSON.stringify(rejection.toJSON());`,
    `assert.ok(!serialized.includes("${idPrefix}-cross"), "bounded diagnostic must never carry caller data");`,
    `assert.ok(serialized.length < 512, "bounded diagnostic must stay bounded");`,
    `assert.ok(rejection.message.includes("Core resolves to exactly one module instance in any supported consumer graph"), "duplicate diagnostic must name the single-copy invariant");`,
    `assert.match(rejection.message, /deduplicate/i, "duplicate diagnostic must name the deduplication remediation");`,
    `const canonicalMessage = rejection.message.includes("Core resolves to exactly one module instance in any supported consumer graph") && /deduplicate/i.test(rejection.message);`,
    `console.log("AUTHORITY_SCOPE_RESULT " + JSON.stringify({ copiesDistinct: true, sameCopyAccepted, rejectedCode: rejection.code, boundedShape: true, canonicalMessage }));`,
    ``,
  ].join("\n");
}

function runProbeRecord(caseRoot, probePath) {
  const result = spawnSync(process.execPath, [probePath], { cwd: caseRoot, encoding: "utf8", timeout: 60_000 });
  assert.equal(result.status, 0, `authority-scope probe failed:\n${result.stdout}\n${result.stderr}`);
  const line = `${result.stdout}\n${result.stderr}`.split("\n").find((entry) => entry.startsWith("AUTHORITY_SCOPE_RESULT "));
  assert.ok(line, "authority-scope probe printed no result record");
  return JSON.parse(line.slice("AUTHORITY_SCOPE_RESULT ".length));
}

// ---------------------------------------------------------------------------
// Null controls — each arm's guarded invariant is shown mutation-sensitive by
// making the fixture mutation that violates it and proving the arm FAILS in a
// disposable clone. The old/new texts are assembled from fragments so the raw
// fixture text occurs exactly once in this file (the fixture itself).
// ---------------------------------------------------------------------------

const MUTATION_CASES = [
  {
    name: "authority-scope null control: forged arm fails when the fixture brands its forged value",
    oldText: "const forgedValue = { type: " + '"administrator"' + ", id: " + '"arm-forged"' + " };",
    newText: "const forgedValue = sdk.authoritativeActor({ type: " + '"administrator"' + ", id: " + '"arm-forged"' + " });",
    pattern: "^authority-scope arm forged",
    expectedFailure: /authority-scope arm forged/i,
    prepare: null,
  },
  {
    name: "authority-scope null control: cloned arm fails when the fixture reuses the branded original",
    oldText: "const clonedValue = " + "structuredClone(brandedValue);",
    newText: "const clonedValue = " + "brandedValue;",
    pattern: "^authority-scope arm cloned",
    expectedFailure: /authority-scope arm cloned/i,
    prepare: null,
  },
  {
    name: "authority-scope null control: foreign arm fails under a cross-copy fixture mutation",
    oldText: "const FOREIGN_BRANDING_SOURCE = " + "sdk;",
    // Self-contained: the injected line imports `node:url` itself rather than
    // relying on a top-level binding in this file. A binding used only by the
    // mutated variant reads as an unused import in the file as committed, and
    // deleting it would break this null control with a ReferenceError instead
    // of the DUPLICATE_AUTHORITY rejection this control expects.
    newText: "const FOREIGN_BRANDING_SOURCE = "
      + 'await import((await import("node:url")).pathToFileURL('
      + 'resolve(packageRoot, "dist/foreign-context.js")).href);',
    pattern: "^authority-scope arm foreign",
    expectedFailure: /DUPLICATE_AUTHORITY/i,
    prepare: (cloneRoot) => {
      cpSync(resolve(cloneRoot, "dist/context.js"), resolve(cloneRoot, "dist/foreign-context.js"));
    },
  },
];

for (const mutation of MUTATION_CASES) {
  test(mutation.name, () => {
    const caseRoot = resolve(suiteRoot, mutation.name.replaceAll(/[^A-Za-z0-9]+/g, "-"));
    const cloneRoot = resolve(caseRoot, "package");
    copyPackageStable(packageRoot, cloneRoot, { includeDist: true });
    if (mutation.prepare) mutation.prepare(cloneRoot);
    replace(resolve(cloneRoot, "tests/verification/authority-scope.test.mjs"), mutation.oldText, mutation.newText);

    const environment = { ...process.env };
    delete environment.NODE_TEST_CONTEXT;
    const result = spawnSync(process.execPath, [
      "--test",
      `--test-name-pattern=${mutation.pattern}`,
      "tests/verification/authority-scope.test.mjs",
    ], { cwd: cloneRoot, encoding: "utf8", timeout: 60_000, env: environment });
    const output = `${result.stdout}\n${result.stderr}`;
    assert.notEqual(result.status, 0, `${mutation.name} unexpectedly survived its null control:\n${output}`);
    assert.match(output, /tests [1-9][0-9]*/i, `${mutation.name} had zero test discovery:\n${output}`);
    assert.match(output, /\bfail\s+1\b/i, `${mutation.name} did not fail exactly its guarded arm:\n${output}`);
    assert.match(output, mutation.expectedFailure, `${mutation.name} failed without its arm's diagnostic:\n${output}`);
  });
}

// ---------------------------------------------------------------------------
// Helpers.
// ---------------------------------------------------------------------------

// The verification-policy suite materializes a transient src/_vp_dummy.ts
// while node --test runs verification files concurrently; a package copy must
// never fail on that artifact.
function copyPackageStable(source, destination, { includeDist }) {
  const excluded = new Set([
    "node_modules",
    "dist-tests",
    "dist-examples",
    ".verification-output",
    "coverage",
    "_vp_dummy.ts",
  ]);
  if (!includeDist) excluded.add("dist");
  let lastError;
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      cpSync(source, destination, {
        recursive: true,
        force: true,
        filter: (entry) => !excluded.has(basename(entry)),
      });
      return;
    } catch (error) {
      if (isTransientDummyRace(error)) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }
  throw lastError ?? new Error("package copy remained unstable");
}

function isTransientDummyRace(error) {
  if (error?.code !== "ENOENT") return false;
  return String(error?.path ?? "").endsWith("_vp_dummy.ts");
}

function replace(path, oldText, newText) {
  const text = readFileSync(path, "utf8");
  assert.equal(text.split(oldText).length - 1, 1, `mutation input must occur exactly once in ${path}`);
  writeFileSync(path, text.replace(oldText, newText));
}
