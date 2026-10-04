import { existsSync } from "node:fs";
import { appendFile, copyFile, cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { assertOutsideRepository, buildEvaluationKit, verifyKitIdentity } from "./build-evaluation-kit.mjs";
import {
  ANSWER_KEY_PATH,
  assertKitExcludesAnswerKey,
  extractAnswerKeyFixBlocks,
  verifySeededCallsOutput,
} from "./evaluation-kit-answer-key.mjs";
import { CHECKSUM_LIST_FILE, IDENTITY_FILE, parseChecksumList, sha256Hex, verifyUnpackedKitIntegrity } from "./evaluation-kit-checksums.mjs";
import { startLoopbackServer, verifyHttpExchange } from "./evaluation-kit-delivery-checks.mjs";
import { extractDocBlocksFromDir } from "./evaluation-kit-doc-blocks.mjs";
import { assertKitDocsClaimOnlyWhatShips } from "./evaluation-kit-doc-claims.mjs";
import { assertKitDocReferences } from "./evaluation-kit-doc-references.mjs";
import {
  PNPM_RELEASES,
  assertKitDocsNameInstallers,
  runCoreCopyProbe,
  runInstaller,
  verifyPnpmInstalls,
} from "./evaluation-kit-installers.mjs";
import {
  KIT_PACKAGES,
  assertSameIdentityDigests,
  createKitTreeClone,
  runCloneBuilder,
  verifyStaleBuildOutputExcluded,
} from "./evaluation-kit-source-copy.mjs";
import { assert, packageRoot, repositoryRoot, runChecked } from "./verification-helpers.mjs";

async function buildVerificationIdentity(sourceRoot) {
  const { identity, kitDigest, removeKit } = await buildEvaluationKit({ mode: "verification", sourceRoot });
  await removeKit();
  return { ...identity, kitDigest };
}

// Rebuilt from a copy of the same tracked files, before and after stale output is planted in each package's
// build directory, a verification kit reproduces every format-3 identity value.
async function checkReproducibleIdentity(identity) {
  const rebuilt = await verifyStaleBuildOutputExcluded(buildVerificationIdentity);
  assertSameIdentityDigests(identity, rebuilt, "a rebuild of the same tracked tree");
}

export const FAILURE_PATHS_PROGRAM = resolve(packageRoot, "scripts/evaluation-kit-failure-paths.ts");
const INSTALLED_FAILURE_PATHS_PROGRAM = "gate/evaluation-kit-failure-paths.ts";

// Gate-only programs go into the install directory, never into the kit itself.
export async function installGatePrograms(installDir, failurePathsProgram = FAILURE_PATHS_PROGRAM) {
  await mkdir(resolve(installDir, "gate"), { recursive: true });
  await copyFile(failurePathsProgram, resolve(installDir, INSTALLED_FAILURE_PATHS_PROGRAM));
}

export async function writeConsumerTsconfig(
  installDir,
  include = ["examples/**/*.ts", "doc-blocks/**/*.ts", "gate/**/*.ts"],
) {
  const tsconfigPath = resolve(installDir, "tsconfig.json");
  const tsconfig = {
    compilerOptions: {
      target: "ES2024",
      module: "NodeNext",
      moduleResolution: "NodeNext",
      strict: true,
      noUncheckedIndexedAccess: true,
      exactOptionalPropertyTypes: true,
      useUnknownInCatchVariables: true,
      noImplicitOverride: true,
      noFallthroughCasesInSwitch: true,
      noImplicitReturns: true,
      verbatimModuleSyntax: true,
      isolatedModules: true,
      noEmit: true,
      rootDir: ".",
      skipLibCheck: true,
      typeRoots: [resolve(packageRoot, "node_modules/@types")],
      types: ["node"],
    },
    include,
  };
  await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf8");
  return tsconfigPath;
}

export function typescriptLegs(tsconfigPath) {
  return [
    {
      version: "5.9.2",
      command: process.execPath,
      args: [resolve(packageRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfigPath],
    },
    {
      version: "6.0.3",
      command: "npx",
      args: ["--yes", "-p", "typescript@6.0.3", "tsc", "-p", tsconfigPath],
    },
    {
      version: "7.0.2",
      command: "npx",
      args: ["--yes", "-p", "typescript@7.0.2", "tsc", "-p", tsconfigPath],
    },
  ];
}

async function typecheckSources(tempInstall, include) {
  const tsconfigPath = await writeConsumerTsconfig(tempInstall, include);
  for (const leg of typescriptLegs(tsconfigPath)) {
    runChecked(leg.command, leg.args, { cwd: tempInstall, capture: true });
  }
}

async function typecheckKitSources(tempInstall) {
  const docsDir = resolve(tempInstall, "docs");
  const docBlocksDir = resolve(tempInstall, "doc-blocks");
  if (existsSync(docsDir)) {
    await extractDocBlocksFromDir(docsDir, docBlocksDir);
  }
  await typecheckSources(tempInstall, ["examples/**/*.ts", "doc-blocks/**/*.ts", "gate/**/*.ts"]);
}

async function typecheckAnswerKeyFixes(tempInstall) {
  if (!existsSync(ANSWER_KEY_PATH)) return false;
  const answerKeyBlocksDir = resolve(tempInstall, "answer-key-blocks");
  await extractAnswerKeyFixBlocks(answerKeyBlocksDir);
  await typecheckSources(tempInstall, ["answer-key-blocks/**/*.ts"]);
  return true;
}

async function verifyFailurePaths(tempInstall) {
  const peer = startLoopbackServer({
    script: resolve(packageRoot, "scripts/evaluation-kit-peer.mjs"),
    cwd: packageRoot,
    label: "peer",
  });
  try {
    const origin = await peer.origin;
    const failureRun = runChecked(process.execPath, ["--no-warnings", INSTALLED_FAILURE_PATHS_PROGRAM, origin], {
      cwd: tempInstall,
      capture: true,
    });
    assert(
      failureRun.includes("failure-paths:all:pass"),
      `installed kit failure path check did not pass:\n${failureRun}`,
    );
  } finally {
    peer.child.kill("SIGTERM");
  }
}

async function verifyDuplicateCoreProbe(tempInstall, plantDuplicateCore) {
  if (plantDuplicateCore) await plantDuplicateCore(tempInstall);
  await runCoreCopyProbe(tempInstall, "npm");
}

// Only the gate that built a verification kit knows the tree it came from. Existing kits retain a valid
// format-3 identity without making a claim about a local tree that did not build them.
export async function verifyBuiltKitIdentity(kitDir) {
  const verified = await verifyKitIdentity(kitDir);
  const treeCommit = runChecked("git", ["rev-parse", "HEAD"], { cwd: repositoryRoot, capture: true }).trim();
  assert(
    verified.identity.commit === treeCommit,
    `identity.json commit must match the tree the gate built from: expected ${treeCommit}, got ${verified.identity.commit}`,
  );
  assert(verified.identity.distributable === false, "a kit the gate builds must be marked non-distributable");
  return verified;
}

// The live repository's porcelain status, captured before and after the clone checks so the gate can
// prove it never wrote into the live tree.
function liveGitStatus() {
  return runChecked("git", ["status", "--porcelain"], { cwd: repositoryRoot, capture: true });
}

// Builds a distributable kit in the clone, with the clone's own builder, into a fresh temporary
// destination. Returns the builder's parsed output plus a remover for the destination tree.
async function buildDistributableKitInClone(cloneRoot) {
  const parentDir = await mkdtemp(resolve(tmpdir(), "bloodtrail-kit-distributable-"));
  const destDir = resolve(parentDir, "evaluation-kit");
  try {
    const built = runCloneBuilder(cloneRoot, destDir);
    return { ...built, remove: () => rm(parentDir, { recursive: true, force: true }) };
  } catch (error) {
    await rm(parentDir, { recursive: true, force: true });
    throw error;
  }
}

// Reads a kit's checksum list through the checksum module's own strict one-line parser.
async function checksumEntries(kitDir) {
  const content = await readFile(resolve(kitDir, CHECKSUM_LIST_FILE), "utf8");
  return parseChecksumList(content);
}

// The two checksum lists must agree on every line except the identity line, whose values the clone's
// different commit and distributable flag legitimately change. A missing, extra, or changed path names
// that path.
async function assertSameChecksumListExceptIdentity(distributableKitDir, verificationKitDir) {
  const verification = await checksumEntries(verificationKitDir);
  const distributable = await checksumEntries(distributableKitDir);
  verification.delete(IDENTITY_FILE);
  distributable.delete(IDENTITY_FILE);
  for (const [path, digest] of verification) {
    assert(distributable.has(path), `distributable kit checksum list is missing ${path}`);
    assert(
      distributable.get(path) === digest,
      `distributable kit checksum entry changed for ${path}: expected ${digest}, got ${distributable.get(path)}`,
    );
  }
  for (const path of distributable.keys()) {
    assert(verification.has(path), `distributable kit checksum list has an extra entry for ${path}`);
  }
}

// Builds a distributable kit in the clone and proves it carries the same artifacts, digests, and checksum
// list (apart from its identity file) as the verification kit, plus the archive the builder printed.
export async function checkDistributableKitMatch({ cloneRoot, verificationKitDir, verificationIdentity }) {
  const built = await buildDistributableKitInClone(cloneRoot);
  try {
    const verified = await verifyKitIdentity(built.kitDir);
    assert(verified.identity.distributable === true, "the distributable kit must be marked distributable");
    const headCommit = runChecked("git", ["rev-parse", "HEAD"], { cwd: cloneRoot, capture: true }).trim();
    assert(
      verified.identity.commit === headCommit,
      `distributable kit identity commit must be the clone's HEAD: expected ${headCommit}, got ${verified.identity.commit}`,
    );
    const expectedArtifacts = verificationIdentity.artifacts.map(({ filename, sha256 }) => ({ filename, sha256 }));
    const builtArtifacts = verified.identity.artifacts.map(({ filename, sha256 }) => ({ filename, sha256 }));
    assert(
      JSON.stringify(builtArtifacts) === JSON.stringify(expectedArtifacts),
      `distributable kit artifacts differ from the verification kit's: expected ${JSON.stringify(expectedArtifacts)}, got ${JSON.stringify(builtArtifacts)}`,
    );
    assert(
      verified.identity.package_set_digest === verificationIdentity.package_set_digest,
      `distributable kit package_set_digest differs from the verification kit's: expected ${verificationIdentity.package_set_digest}, got ${verified.identity.package_set_digest}`,
    );
    assert(
      verified.identity.manifest_digest === verificationIdentity.manifest_digest,
      `distributable kit manifest_digest differs from the verification kit's: expected ${verificationIdentity.manifest_digest}, got ${verified.identity.manifest_digest}`,
    );
    await assertSameChecksumListExceptIdentity(built.kitDir, verificationKitDir);
    assert(existsSync(built.archivePath), `distributable kit archive missing: ${built.archivePath}`);
    const archiveSha256 = sha256Hex(await readFile(built.archivePath));
    assert(
      archiveSha256 === built.archiveDigest,
      `distributable kit archive digest differs from the builder's: expected ${built.archiveDigest}, got ${archiveSha256}`,
    );
  } finally {
    await built.remove();
  }
}

const DIRTY_TREE_PROBE_PATH = `${KIT_PACKAGES.node}/docs/privacy.md`;

// After the distributable build, appends one line to a tracked kit file in the clone, without committing,
// and requires the clone's builder to refuse a second distributable build: a nonzero exit whose output
// names the changed path, and no kit directory at the destination.
export async function checkDirtyTreeRefusal({ cloneRoot }) {
  const probePath = resolve(cloneRoot, DIRTY_TREE_PROBE_PATH);
  await appendFile(probePath, "kit gate: dirty-tree probe\n", "utf8");
  const parentDir = await mkdtemp(resolve(tmpdir(), "bloodtrail-kit-dirty-refusal-"));
  const destDir = resolve(parentDir, "evaluation-kit");
  try {
    let built = null;
    let builderFailure = null;
    try {
      built = runCloneBuilder(cloneRoot, destDir);
    } catch (error) {
      builderFailure = error;
    }
    assert(built === null, "a dirty clone produced a distributable kit");
    assert(builderFailure !== null, "a dirty clone's distributable build must be refused");
    const output = builderFailure.output;
    assert(typeof output === "string", `dirty-tree refusal must carry its builder output: ${builderFailure.message}`);
    assert(
      output.includes("cannot build distributable evaluation kit from dirty git tree"),
      `dirty-tree refusal must come from the builder: ${output}`,
    );
    assert(
      output.includes(DIRTY_TREE_PROBE_PATH),
      `dirty-tree refusal must name the changed path ${DIRTY_TREE_PROBE_PATH}:\n${output}`,
    );
    assert(!existsSync(destDir), `dirty-tree refusal must produce no kit directory at ${destDir}`);
  } finally {
    await rm(parentDir, { recursive: true, force: true });
  }
}

// Runs the two clone checks against one disposable clone. The clone is removed in a finally, and the live
// repository's porcelain status is compared before and after only once the try block has completed, so a
// check failure always propagates unchanged.
async function runCloneChecks(completedChecks, disabledChecks, kitDir, identityMaterial) {
  const statusBefore = liveGitStatus();
  const { cloneRoot, remove } = await createKitTreeClone();
  try {
    await runCheck(completedChecks, disabledChecks, "distributable-kit-match", () =>
      checkDistributableKitMatch({ cloneRoot, verificationKitDir: kitDir, verificationIdentity: identityMaterial }),
    );
    await runCheck(completedChecks, disabledChecks, "dirty-tree-refusal", () => checkDirtyTreeRefusal({ cloneRoot }));
  } finally {
    await remove();
  }
  const statusAfter = liveGitStatus();
  assert(
    statusAfter === statusBefore,
    `the live repository changed while the kit gate ran its clone checks: before ${JSON.stringify(statusBefore)}, after ${JSON.stringify(statusAfter)}`,
  );
}

const TYPESCRIPT_MATRIX = "TypeScript 5.9.2, 6.0.3, and 7.0.2";

function codeSpans(commands) {
  return commands.map((command) => `\`${command}\``).join(", ");
}

// Every entry has one stable identity and one clause. The summary is composed only from entries recorded
// after their checks complete, so a check that did not run cannot claim a result.
export const KIT_GATE_CHECKS = Object.freeze({
  "verification-kit-build": Object.freeze({
    clause: () => "verification kit built from tracked sources",
  }),
  "kit-identity": Object.freeze({
    clause: ({ buildMode }) =>
      buildMode
        ? "kit identity verified in format 3, with its commit and distributable flag checked against the tree the gate built from"
        : "kit identity verified in format 3",
  }),
  "answer-key-exclusion": Object.freeze({
    clause: () => "facilitator answer-key file names and recognized content markers excluded",
  }),
  "unpacked-kit-integrity": Object.freeze({
    clause: ({ commands }) => `unpacked-kit integrity commands verified: ${codeSpans(commands)}`,
  }),
  "installer-documentation": Object.freeze({
    clause: () => "the quickstart and known-issues pages name the supported pnpm majors",
  }),
  "planned-feature-documentation": Object.freeze({
    clause: () => "kit documents describe planned features only as planned",
  }),
  "reproducible-identity": Object.freeze({
    clause: () => "verification-kit identity reproduced after stale build output and untracked sources were planted",
  }),
  "distributable-kit-match": Object.freeze({
    clause: () => "distributable kit built from a disposable clean clone of the tree under test, with the same artifacts and checksum list as the verification kit apart from its identity file",
  }),
  "dirty-tree-refusal": Object.freeze({
    clause: () => "distributable build refused in that clone once it held an uncommitted change",
  }),
  "npm-installation": Object.freeze({
    clause: () => "kit installed outside any workspace with npm and no ignored setting",
  }),
  "document-references": Object.freeze({
    clause: () => "call-shaped document references resolved against installed package type declarations",
  }),
  "npm-single-core-copy": Object.freeze({
    clause: () => "single core copy verified after the npm installation",
  }),
  "kit-source-typecheck": Object.freeze({
    clause: () => `examples, document blocks, and failure-path program type-checked under strict consumer settings with ${TYPESCRIPT_MATRIX}`,
  }),
  "facilitator-answer-key-fix-typecheck": Object.freeze({
    clause: () => `facilitator answer-key fixes type-checked under strict consumer settings with ${TYPESCRIPT_MATRIX}`,
  }),
  "first-event-example": Object.freeze({
    clause: () => "first-event example ran successfully after the npm installation",
  }),
  "loopback-example-exchange": Object.freeze({
    clause: () => "loopback examples verified: the bytes the receiver received equal the bytes the SDK handed to the HTTP audit sink, and the receiver answered 401, 413, 400, 422 and 409, acknowledged a byte-identical duplicate and a redelivered event, and kept serving after each",
  }),
  "seeded-invalid-calls": Object.freeze({
    clause: () => "seeded invalid calls returned their documented code, category, and path",
  }),
  "http-audit-sink-failure-paths": Object.freeze({
    clause: () => "HTTP audit sink failure paths and lifecycle transitions verified",
  }),
  "pnpm-installations": Object.freeze({
    clause: () => `kit installed outside any workspace with pnpm ${PNPM_RELEASES.join(", ")}, with no ignored setting, a passing first-event example, and one core copy per installation`,
  }),
});

export const KIT_GATE_CHECK_IDENTITIES = Object.freeze(Object.keys(KIT_GATE_CHECKS));

function recordCompletedCheck(completedChecks, identity, details = {}) {
  assert(KIT_GATE_CHECKS[identity], `unknown kit gate check identity: ${identity}`);
  assert(!completedChecks.some((check) => check.identity === identity), `kit gate check recorded twice: ${identity}`);
  completedChecks.push({ identity, details });
}

function normalizeDisabledChecks(disabledChecks) {
  assert(Array.isArray(disabledChecks), "_disabledChecks must be an array of kit gate check identities");
  for (const identity of disabledChecks) {
    assert(KIT_GATE_CHECKS[identity], `unknown kit gate check identity: ${identity}`);
  }
  return new Set(disabledChecks);
}

function checkFailure(identity, cause) {
  const error = new Error(`kit gate check ${identity} failed: ${cause.message}`, { cause });
  error.checkIdentity = identity;
  return error;
}

async function runCheck(completedChecks, disabledChecks, identity, run) {
  assert(KIT_GATE_CHECKS[identity], `unknown kit gate check identity: ${identity}`);
  if (disabledChecks.has(identity)) return undefined;
  try {
    const details = await run();
    recordCompletedCheck(completedChecks, identity, details);
    return details;
  } catch (cause) {
    throw checkFailure(identity, cause);
  }
}

// The controls use this same runner when they exercise a check helper directly. It is JavaScript-only,
// like _disabledChecks on checkEvaluationKit, and never becomes a command-line gate option.
export async function runKitGateCheck({ identity, _disabledChecks = [], run }) {
  const disabledChecks = normalizeDisabledChecks(_disabledChecks);
  const completedChecks = [];
  const details = await runCheck(completedChecks, disabledChecks, identity, run);
  return { details, skipped: disabledChecks.has(identity) };
}

// Not a check: it says what a --kit-dir run skipped, so the absent build clauses cannot pass unnoticed.
export const KIT_DIR_NOTE = "kit checked as given with --kit-dir, so it was neither built nor reproduced, and its commit and distributable flag were not checked against any tree";

export function composeVerificationSummary(completedChecks, { checkedAsGiven = false } = {}) {
  const clauses = completedChecks.map(({ identity, details }) => {
    const check = KIT_GATE_CHECKS[identity];
    assert(check, `unknown kit gate check identity: ${identity}`);
    return check.clause(details);
  });
  const parts = checkedAsGiven ? [KIT_DIR_NOTE, ...clauses] : clauses;
  return `evaluation kit verification passed: ${parts.join("; ")}\n`;
}

// Returns the success line, which the command line prints, so a control can read it from a passing run.
export async function checkEvaluationKit({
  kitDir: existingKitDir,
  failurePathsProgram = FAILURE_PATHS_PROGRAM,
  _disabledChecks = [],
  _plantDuplicateCore = null,
} = {}) {
  const disabledChecks = normalizeDisabledChecks(_disabledChecks);
  assert(_plantDuplicateCore === null || typeof _plantDuplicateCore === "function", "_plantDuplicateCore must be a function");
  // Not a check: every check below writes under the temporary directory, so it must lie outside the repository.
  await assertOutsideRepository(tmpdir());

  // A kit given with --kit-dir is checked as given: the gate neither builds it nor proves that it reproduces.
  const buildsOwnKit = !existingKitDir;
  const completedChecks = [];
  let identityMaterial;
  let kitDir = existingKitDir;
  let removeBuiltKit = null;
  let tempInstall = null;

  try {
    if (buildsOwnKit) {
      await runCheck(completedChecks, disabledChecks, "verification-kit-build", async () => {
        const built = await buildEvaluationKit({ mode: "verification" });
        kitDir = built.kitDir;
        removeBuiltKit = built.removeKit;
        return undefined;
      });
    }

    await runCheck(completedChecks, disabledChecks, "kit-identity", async () => {
      const verified = buildsOwnKit ? await verifyBuiltKitIdentity(kitDir) : await verifyKitIdentity(kitDir);
      identityMaterial = { ...verified.identity, kitDigest: verified.kitDigest };
      return { buildMode: buildsOwnKit };
    });

    // 1a. Kit excludes facilitator answer key and its contents
    await runCheck(completedChecks, disabledChecks, "answer-key-exclusion", () => assertKitExcludesAnswerKey(kitDir));

    // 1b. Unpacked from an archive, the kit passes `shasum -a 256 -c` and every integrity command its guide documents
    await runCheck(completedChecks, disabledChecks, "unpacked-kit-integrity", async () => {
      const commands = await verifyUnpackedKitIntegrity(kitDir);
      return { commands };
    });

    // 1c. The kit's documents name exactly the pnpm majors this gate installs with
    await runCheck(completedChecks, disabledChecks, "installer-documentation", () => assertKitDocsNameInstallers(kitDir));

    // 1d. The kit's documents describe OCSF export, OpenTelemetry transport, CloudEvents envelopes, retries, queues and framework adapters only as planned
    await runCheck(completedChecks, disabledChecks, "planned-feature-documentation", () => assertKitDocsClaimOnlyWhatShips(kitDir));

    // 2. Reproducibility: the same tracked tree rebuilds to the same digests, with or without stale build output on disk
    if (buildsOwnKit) {
      await runCheck(completedChecks, disabledChecks, "reproducible-identity", async () => {
        await checkReproducibleIdentity(identityMaterial);
        return undefined;
      });
    }

    // 2a. Build a distributable kit from a disposable clean clone of the tree under test and prove it
    // matches the verification kit; the same clone then proves a real dirty tree is refused. The live
    // repository must read the same before and after.
    if (buildsOwnKit) {
      await runCloneChecks(completedChecks, disabledChecks, kitDir, identityMaterial);
    }

    // 3. Copy and install the kit with npm outside any workspace root.
    await runCheck(completedChecks, disabledChecks, "npm-installation", async () => {
      tempInstall = await mkdtemp(resolve(tmpdir(), "bloodtrail-eval-install-"));
      await cp(kitDir, tempInstall, { recursive: true });
      runInstaller(
        "npm",
        "npm",
        ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline"],
        tempInstall,
      );
      return undefined;
    });

    // 3a. Every call-shaped reference in the kit's documents names an API the installed packages declare
    await runCheck(completedChecks, disabledChecks, "document-references", () => assertKitDocReferences(tempInstall));

    // 4. Verify single core copy in npm install (and fail closed if planted duplicate)
    await runCheck(completedChecks, disabledChecks, "npm-single-core-copy", () => verifyDuplicateCoreProbe(tempInstall, _plantDuplicateCore));

    // 5. Install the gate program, then type-check the installed sources under the TypeScript matrix.
    await runCheck(completedChecks, disabledChecks, "kit-source-typecheck", async () => {
      await installGatePrograms(tempInstall, failurePathsProgram);
      await typecheckKitSources(tempInstall);
      return undefined;
    });

    // 5a. Type-check facilitator answer-key fixes only when the facilitator answer key is present.
    if (existsSync(ANSWER_KEY_PATH)) {
      await runCheck(completedChecks, disabledChecks, "facilitator-answer-key-fix-typecheck", async () => {
        await typecheckAnswerKeyFixes(tempInstall);
        return undefined;
      });
    }

    // 6. Run examples/first-event.ts
    await runCheck(completedChecks, disabledChecks, "first-event-example", () => {
      const firstEventScript = resolve(tempInstall, "examples/first-event.ts");
      assert(existsSync(firstEventScript), "examples/first-event.ts missing from installed kit");
      const output = runChecked(process.execPath, ["--no-warnings", "examples/first-event.ts"], {
        cwd: tempInstall,
        capture: true,
      });
      assert(output.includes("first-event:pass"), `examples/first-event.ts did not succeed:\n${output}`);
    });

    // 7. Run example-receiver and example-service end to end over loopback HTTP
    await runCheck(completedChecks, disabledChecks, "loopback-example-exchange", () => verifyHttpExchange(tempInstall));

    // 7b. Run seeded invalid calls exercise against installed kit and verify codes in the gate.
    // The install directory is absent only when its serving check is disabled through the JavaScript-only seam.
    if (tempInstall) {
      const seededScript = resolve(tempInstall, "examples/seeded-invalid-calls.ts");
      if (existsSync(seededScript)) {
        await runCheck(completedChecks, disabledChecks, "seeded-invalid-calls", async () => {
          const seededRun = runChecked(process.execPath, ["--no-warnings", seededScript], { cwd: tempInstall, capture: true });
          const catalogPath = resolve(tempInstall, "docs/error-catalog.md");
          const catalogContent = existsSync(catalogPath) ? await readFile(catalogPath, "utf8") : "";
          verifySeededCallsOutput(seededRun, catalogContent);
          return undefined;
        });
      }
    }

    // 8. Drive HTTP sink failure paths and lifecycle transitions from installed kit against controllable loopback peer
    await runCheck(completedChecks, disabledChecks, "http-audit-sink-failure-paths", () => verifyFailurePaths(tempInstall));

    // 9. Install kit with each pinned pnpm release outside workspace root, run one-event script and duplicate-copy probe
    await runCheck(completedChecks, disabledChecks, "pnpm-installations", () => verifyPnpmInstalls(kitDir));

    return {
      success: true,
      summary: composeVerificationSummary(completedChecks, { checkedAsGiven: !buildsOwnKit }),
      checkIdentities: completedChecks.map((check) => check.identity),
      verificationChecks: completedChecks.map(({ identity, details }) => ({ identity, details })),
    };
  } finally {
    if (tempInstall) await rm(tempInstall, { recursive: true, force: true });
    if (removeBuiltKit) await removeBuiltKit();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let kitDir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] !== "--kit-dir" || !args[i + 1]) throw new Error(`unknown or incomplete kit gate option: ${args[i]}`);
    kitDir = args[++i];
  }
  const { summary } = await checkEvaluationKit({ kitDir });
  process.stdout.write(summary);
}
