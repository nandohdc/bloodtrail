import { existsSync } from "node:fs";
import { copyFile, cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

export async function writeConsumerTsconfig(installDir) {
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
    include: ["examples/**/*.ts", "doc-blocks/**/*.ts", "gate/**/*.ts"],
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

async function typecheckExamples(tempInstall) {
  const docsDir = resolve(tempInstall, "docs");
  const docBlocksDir = resolve(tempInstall, "doc-blocks");
  if (existsSync(docsDir)) {
    await extractDocBlocksFromDir(docsDir, docBlocksDir);
  }
  if (existsSync(ANSWER_KEY_PATH)) {
    await extractAnswerKeyFixBlocks(docBlocksDir);
  }

  const tsconfigPath = await writeConsumerTsconfig(tempInstall);
  for (const leg of typescriptLegs(tsconfigPath)) {
    runChecked(leg.command, leg.args, { cwd: tempInstall, capture: true });
  }
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

export async function checkEvaluationKit({
  kitDir: existingKitDir,
  plantDuplicateCore = false,
  failurePathsProgram = FAILURE_PATHS_PROGRAM,
} = {}) {
  await assertOutsideRepository(tmpdir());

  let kitDir = existingKitDir;
  let removeBuiltKit = null;

  if (!kitDir) {
    const built = await buildEvaluationKit({ mode: "verification" });
    kitDir = built.kitDir;
    removeBuiltKit = built.removeKit;
  }

  const tempInstall = await mkdtemp(resolve(tmpdir(), "bloodtrail-eval-install-"));
  try {
    // 1. Verify identity
    const { identity } = await verifyKitIdentity(kitDir);

    // 1a. Kit excludes facilitator answer key and its contents
    await assertKitExcludesAnswerKey(kitDir);

    // 1b. Unpacked from an archive, the kit passes `shasum -a 256 -c` and every integrity command its guide documents
    await verifyUnpackedKitIntegrity(kitDir);

    // 1c. The kit's documents name exactly the pnpm majors this gate installs with
    await assertKitDocsNameInstallers(kitDir);

    // 1d. Kit documents name only functions and methods that exist in installed packages
    const kitDocsDir = resolve(kitDir, "docs");
    if (existsSync(kitDocsDir)) {
      await assertKitDocReferences(kitDocsDir);
    }

    // 2. Reproducibility: the same tracked tree rebuilds to the same digests, with or without stale build output on disk
    if (!existingKitDir) {
      await checkReproducibleIdentity(identity);
    }

    // 3. Install kit with npm outside any workspace root
    await cp(kitDir, tempInstall, { recursive: true });

    runInstaller(
      "npm",
      "npm",
      ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline"],
      tempInstall,
    );

    // 4. Verify single core copy in npm install (and fail closed if planted duplicate)
    await verifyDuplicateCoreProbe(tempInstall, plantDuplicateCore);

    // 5. Type-check examples, doc blocks, answer key fixes and the gate's failure-path program in the installed kit with TypeScript matrix (5.9.2, 6.0.x, 7.0.x) under strict settings
    await installGatePrograms(tempInstall, failurePathsProgram);
    await typecheckExamples(tempInstall);

    // 6. Run examples/first-event.ts
    const firstEventScript = resolve(tempInstall, "examples/first-event.ts");
    assert(existsSync(firstEventScript), "examples/first-event.ts missing from installed kit");

    const output = runChecked(process.execPath, ["--no-warnings", "examples/first-event.ts"], {
      cwd: tempInstall,
      capture: true,
    });
    assert(output.includes("first-event:pass"), `examples/first-event.ts did not succeed:\n${output}`);

    // 7. Run example-receiver and example-service end to end over loopback HTTP
    await verifyHttpExchange(tempInstall);

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
    }

    // 8. Drive HTTP sink failure paths and lifecycle transitions from installed kit against controllable loopback peer
    await verifyFailurePaths(tempInstall);

    // 9. Install kit with one pinned release of each supported pnpm major outside workspace root, run one-event script and duplicate-copy probe
    await verifyPnpmInstalls(kitDir);

    process.stdout.write(
      `evaluation kit verification passed: kit built from tracked sources, identity verified and reproduced with stale build output and untracked sources planted, checksum list and the evaluation guide's integrity commands verified with shasum in an unpacked kit, doc references verified to name only existing APIs, installed outside workspace with npm and pnpm ${PNPM_RELEASES.join(", ")} with no ignored setting, doc blocks, facilitator answer-key fixes, examples and failure-path program type-checked across TypeScript matrix (5.9.2, 6.0.3, 7.0.2), single core copy verified, every demonstrated event received as exactly the bytes the SDK validated, the receiver answering 401, 413, 400, 422 and 409, acknowledging duplicates and still serving, seeded invalid calls verified, failure paths verified\n`,
    );
    return { success: true };
  } finally {
    await rm(tempInstall, { recursive: true, force: true });
    if (removeBuiltKit) {
      await removeBuiltKit();
    }
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const args = process.argv.slice(2);
  let kitDir = null;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--kit-dir" && args[i + 1]) kitDir = args[++i];
  }
  await checkEvaluationKit({ kitDir });
}
