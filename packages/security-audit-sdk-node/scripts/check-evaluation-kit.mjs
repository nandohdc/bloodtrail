import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
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
import { verifyUnpackedKitIntegrity } from "./evaluation-kit-checksums.mjs";
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
import { assertSameIdentityDigests, verifyStaleBuildOutputExcluded } from "./evaluation-kit-source-copy.mjs";
import { assert, packageRoot, runChecked } from "./verification-helpers.mjs";

async function buildVerificationIdentity(sourceRoot) {
  const { identity, removeKit } = await buildEvaluationKit({ mode: "verification", sourceRoot });
  await removeKit();
  return identity;
}

// The gate's own kit is built from uncommitted work, so it is never distributable. Rebuilt from a copy of
// the same tracked files, before and after stale output is planted in each package's build directory, it
// reproduces every digest.
async function checkReproducibleIdentity(identity) {
  assert(identity.distributable === false, "a kit the gate builds must be marked non-distributable");
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
  if (plantDuplicateCore) {
    const nestedCore = resolve(
      tempInstall,
      "node_modules/@bloodtrail/security-audit-sdk-node/node_modules/@bloodtrail/security-audit-sdk-core",
    );
    await cp(resolve(tempInstall, "node_modules/@bloodtrail/security-audit-sdk-core"), nestedCore, {
      recursive: true,
    });
  }
  await runCoreCopyProbe(tempInstall, "npm");
}

const TYPESCRIPT_MATRIX = "TypeScript 5.9.2, 6.0.3, and 7.0.2";

// Every entry has one stable identity and one clause. The summary is composed only from entries recorded
// after their checks complete, so a check that did not run cannot claim a result.
export const KIT_GATE_CHECKS = Object.freeze({
  "verification-kit-build": Object.freeze({
    clause: () => "verification kit built from tracked sources",
  }),
  "kit-identity": Object.freeze({
    clause: () => "kit identity verified",
  }),
  "answer-key-exclusion": Object.freeze({
    clause: () => "facilitator answer-key file names and recognized content markers excluded",
  }),
  "unpacked-kit-integrity": Object.freeze({
    clause: ({ commands }) => `unpacked-kit integrity commands verified: ${commands.map((command) => `\`${command}\``).join(", ")}`,
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

// Not a check: it says what a --kit-dir run skipped, so the absent build clauses cannot pass unnoticed.
export const KIT_DIR_NOTE = "kit checked as given with --kit-dir, so it was neither built nor reproduced";

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
  plantDuplicateCore = false,
  failurePathsProgram = FAILURE_PATHS_PROGRAM,
} = {}) {
  await assertOutsideRepository(tmpdir());

  // A kit given with --kit-dir is checked as given: the gate neither builds it nor proves that it reproduces.
  const buildsOwnKit = !existingKitDir;
  const completedChecks = [];
  let kitDir = existingKitDir;
  let removeBuiltKit = null;

  if (buildsOwnKit) {
    const built = await buildEvaluationKit({ mode: "verification" });
    kitDir = built.kitDir;
    removeBuiltKit = built.removeKit;
    recordCompletedCheck(completedChecks, "verification-kit-build");
  }

  const tempInstall = await mkdtemp(resolve(tmpdir(), "bloodtrail-eval-install-"));
  try {
    // 1. Verify identity
    const { identity } = await verifyKitIdentity(kitDir);
    recordCompletedCheck(completedChecks, "kit-identity");

    // 1a. Kit excludes facilitator answer key and its contents
    await assertKitExcludesAnswerKey(kitDir);
    recordCompletedCheck(completedChecks, "answer-key-exclusion");

    // 1b. Unpacked from an archive, the kit passes `shasum -a 256 -c` and every integrity command its guide documents
    const integrityCommands = await verifyUnpackedKitIntegrity(kitDir);
    recordCompletedCheck(completedChecks, "unpacked-kit-integrity", { commands: integrityCommands });

    // 1c. The kit's documents name exactly the pnpm majors this gate installs with
    await assertKitDocsNameInstallers(kitDir);
    recordCompletedCheck(completedChecks, "installer-documentation");

    // 1d. The kit's documents describe OCSF export, OpenTelemetry transport, CloudEvents envelopes, retries, queues and framework adapters only as planned
    await assertKitDocsClaimOnlyWhatShips(kitDir);
    recordCompletedCheck(completedChecks, "planned-feature-documentation");

    // 2. Reproducibility: the same tracked tree rebuilds to the same digests, with or without stale build output on disk
    if (buildsOwnKit) {
      await checkReproducibleIdentity(identity);
      recordCompletedCheck(completedChecks, "reproducible-identity");
    }

    // 3. Install kit with npm outside any workspace root
    await cp(kitDir, tempInstall, { recursive: true });

    runInstaller(
      "npm",
      "npm",
      ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline"],
      tempInstall,
    );
    recordCompletedCheck(completedChecks, "npm-installation");

    // 3a. Every call-shaped reference in the kit's documents names an API the installed packages declare
    await assertKitDocReferences(tempInstall);
    recordCompletedCheck(completedChecks, "document-references");

    // 4. Verify single core copy in npm install (and fail closed if planted duplicate)
    await verifyDuplicateCoreProbe(tempInstall, plantDuplicateCore);
    recordCompletedCheck(completedChecks, "npm-single-core-copy");

    // 5. Type-check examples, doc blocks, and the gate's failure-path program in the installed kit with TypeScript matrix under strict settings
    await installGatePrograms(tempInstall, failurePathsProgram);
    await typecheckKitSources(tempInstall);
    recordCompletedCheck(completedChecks, "kit-source-typecheck");

    // 5a. Type-check facilitator answer-key fixes only when the facilitator answer key is present.
    if (await typecheckAnswerKeyFixes(tempInstall)) {
      recordCompletedCheck(completedChecks, "facilitator-answer-key-fix-typecheck");
    }

    // 6. Run examples/first-event.ts
    const firstEventScript = resolve(tempInstall, "examples/first-event.ts");
    assert(existsSync(firstEventScript), "examples/first-event.ts missing from installed kit");

    const output = runChecked(process.execPath, ["--no-warnings", "examples/first-event.ts"], {
      cwd: tempInstall,
      capture: true,
    });
    assert(output.includes("first-event:pass"), `examples/first-event.ts did not succeed:\n${output}`);
    recordCompletedCheck(completedChecks, "first-event-example");

    // 7. Run example-receiver and example-service end to end over loopback HTTP
    await verifyHttpExchange(tempInstall);
    recordCompletedCheck(completedChecks, "loopback-example-exchange");

    // 7b. Run seeded invalid calls exercise against installed kit and verify codes in the gate
    const seededScript = resolve(tempInstall, "examples/seeded-invalid-calls.ts");
    if (existsSync(seededScript)) {
      const seededRun = runChecked(process.execPath, ["--no-warnings", seededScript], {
        cwd: tempInstall,
        capture: true,
      });
      const catalogPath = resolve(tempInstall, "docs/error-catalog.md");
      const catalogContent = existsSync(catalogPath) ? await readFile(catalogPath, "utf8") : "";
      verifySeededCallsOutput(seededRun, catalogContent);
      recordCompletedCheck(completedChecks, "seeded-invalid-calls");
    }

    // 8. Drive HTTP sink failure paths and lifecycle transitions from installed kit against controllable loopback peer
    await verifyFailurePaths(tempInstall);
    recordCompletedCheck(completedChecks, "http-audit-sink-failure-paths");

    // 9. Install kit with one pinned release of each supported pnpm major outside workspace root, run one-event script and duplicate-copy probe
    await verifyPnpmInstalls(kitDir);
    recordCompletedCheck(completedChecks, "pnpm-installations");

    return {
      success: true,
      summary: composeVerificationSummary(completedChecks, { checkedAsGiven: !buildsOwnKit }),
      checkIdentities: completedChecks.map((check) => check.identity),
      verificationChecks: completedChecks.map(({ identity, details }) => ({ identity, details })),
    };
  } finally {
    await rm(tempInstall, { recursive: true, force: true });
    if (removeBuiltKit) {
      await removeBuiltKit();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(await realpath(process.argv[1])).href) {
  const args = process.argv.slice(2);
  let kitDir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--kit-dir" && args[i + 1]) kitDir = args[++i];
  }
  const { summary } = await checkEvaluationKit({ kitDir });
  process.stdout.write(summary);
}
