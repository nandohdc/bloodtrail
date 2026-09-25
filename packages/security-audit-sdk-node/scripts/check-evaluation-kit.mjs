import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { cp, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import {
  assertOutsideRepository,
  buildEvaluationKit,
  packTarball,
  verifyKitIdentity,
} from "./build-evaluation-kit.mjs";
import { extractDocBlocksFromDir } from "./evaluation-kit-doc-blocks.mjs";
import { assert, packageRoot, runChecked } from "./verification-helpers.mjs";

async function checkDeterminism(identity) {
  const dCheck = await mkdtemp(resolve(tmpdir(), "bloodtrail-determinism-check-"));
  try {
    const coreRepack = await packTarball("core", dCheck);
    const nodeRepack = await packTarball("node", dCheck);
    const expectedCore = identity.artifacts.find((a) => a.name === "core");
    const expectedNode = identity.artifacts.find((a) => a.name === "node");
    assert(coreRepack.sha256 === expectedCore.sha256, "core tarball digest must be deterministic");
    assert(nodeRepack.sha256 === expectedNode.sha256, "node tarball digest must be deterministic");
  } finally {
    await rm(dCheck, { recursive: true, force: true });
  }
}

async function typecheckExamples(tempInstall) {
  const docsDir = resolve(tempInstall, "docs");
  const docBlocksDir = resolve(tempInstall, "doc-blocks");
  if (existsSync(docsDir)) {
    await extractDocBlocksFromDir(docsDir, docBlocksDir);
  }

  const tsconfigPath = resolve(tempInstall, "tsconfig.json");
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
      typeRoots: [resolve(packageRoot, "node_modules/@types")],
    },
    include: ["examples/**/*.ts", "doc-blocks/**/*.ts"],
  };
  await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf8");
  const tscBin = resolve(packageRoot, "node_modules/typescript/bin/tsc");
  runChecked(process.execPath, [tscBin, "-p", tsconfigPath], { cwd: tempInstall, capture: true });
}

function findRequiredAcceptedEvent(events, eventName) {
  const match = events.find((entry) => entry.event?.name === eventName);
  assert(match, `${eventName} must be accepted at receiver`);
  return match;
}

async function assertReceiverHealth(origin) {
  const healthRes = await fetch(`${origin}/health`);
  const healthJson = await healthRes.json();
  assert(healthJson.status === "healthy", `receiver unhealthy: ${JSON.stringify(healthJson)}`);
  assert(healthJson.acceptedCount === 5, `Expected receiver to accept 5 events, got ${healthJson.acceptedCount}`);
  assert(Array.isArray(healthJson.events), "receiver /health must include events array");

  const events = healthJson.events;
  const authz = findRequiredAcceptedEvent(events, "bloodtrail.audit.authorization.denied");
  assert(authz.actor?.id === "actor-eval-scoped-user", "authorization.denied must carry scoped actor");
  assert(authz.tenant?.effective_tenant_id === "tenant-eval-scoped", "authorization.denied must carry scoped tenant");

  findRequiredAcceptedEvent(events, "bloodtrail.audit.authentication.failed");
  findRequiredAcceptedEvent(events, "bloodtrail.audit.authentication.succeeded");
  findRequiredAcceptedEvent(events, "bloodtrail.audit.data.sensitive_resource.viewed");

  const modified = findRequiredAcceptedEvent(events, "bloodtrail.audit.data.sensitive_resource.modified");
  assert(modified.event?.commit_state === "committed", "modification commit state must be committed from operation handle");
  assert(modified.correlation?.operation_id === "22222222-2222-4222-8222-000000000301", "modification must carry operation ID");
}

async function verifyHttpExchange(tempInstall) {
  const receiverScript = resolve(tempInstall, "examples/evaluation-receiver.ts");
  const serviceScript = resolve(tempInstall, "examples/evaluation-service.ts");
  if (!existsSync(receiverScript) || !existsSync(serviceScript)) {
    return;
  }

  const receiverProc = spawn(process.execPath, ["--no-warnings", receiverScript, "0"], {
    cwd: tempInstall,
    stdio: ["ignore", "pipe", "pipe"],
  });

  let receiverOrigin = null;
  const receiverOutput = [];
  const readyPromise = new Promise((resolveReady, rejectReady) => {
    receiverProc.stdout.on("data", (chunk) => {
      const text = chunk.toString("utf8");
      receiverOutput.push(text);
      const match = /receiver:ready\s+(http:\/\/127\.0\.0\.1:\d+)/.exec(text);
      if (match) {
        receiverOrigin = match[1];
        resolveReady(receiverOrigin);
      }
    });
    receiverProc.stderr.on("data", (chunk) => {
      receiverOutput.push(chunk.toString("utf8"));
    });
    receiverProc.on("error", rejectReady);
    receiverProc.on("exit", (code) => {
      if (!receiverOrigin) {
        rejectReady(
          new Error(`receiver exited early with code ${code}:\n${receiverOutput.join("")}`),
        );
      }
    });
  });

  try {
    const origin = await Promise.race([
      readyPromise,
      new Promise((_, rejectTimeout) =>
        setTimeout(
          () => rejectTimeout(new Error("timed out waiting for evaluation-receiver to be ready")),
          10000,
        ),
      ),
    ]);

    const serviceRun = runChecked(process.execPath, ["--no-warnings", serviceScript, origin], {
      cwd: tempInstall,
      capture: true,
    });
    assert(
      serviceRun.includes("service:emitted:authentication.succeeded"),
      `evaluation-service did not emit authentication.succeeded:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:emitted:authentication.failed"),
      `evaluation-service did not emit authentication.failed:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:emitted:authorization.denied"),
      `evaluation-service did not emit authorization.denied:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:context-survives-await:pass"),
      `context did not survive await in evaluation-service:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:emitted:data.sensitive_resource.viewed"),
      `evaluation-service did not emit data.sensitive_resource.viewed:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:direct-commit-prevented:pass"),
      `evaluation-service did not verify direct commit prevention:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:operation-commit:pass"),
      `evaluation-service did not verify operation commit:\n${serviceRun}`,
    );
    assert(
      serviceRun.includes("service:emitted:data.sensitive_resource.modified"),
      `evaluation-service did not emit data.sensitive_resource.modified:\n${serviceRun}`,
    );

    await assertReceiverHealth(origin);
  } finally {
    receiverProc.kill("SIGTERM");
  }
}

export async function checkEvaluationKit({ kitDir: existingKitDir } = {}) {
  await assertOutsideRepository(tmpdir());

  let kitDir = existingKitDir;
  let cleanupKit = false;

  if (!kitDir) {
    const built = await buildEvaluationKit({ mode: "verification" });
    kitDir = built.kitDir;
    cleanupKit = true;
  }

  const tempInstall = await mkdtemp(resolve(tmpdir(), "bloodtrail-eval-install-"));
  try {
    // 1. Verify identity
    const { identity } = await verifyKitIdentity(kitDir);

    // 2. Determinism check: packing same packages produces identical digests
    if (!existingKitDir) {
      await checkDeterminism(identity);
    }

    // 3. Install kit with npm outside any workspace root
    await cp(kitDir, tempInstall, { recursive: true });

    runChecked(
      "npm",
      ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline"],
      { cwd: tempInstall, capture: true },
    );

    // 4. Type-check examples and doc blocks in the installed kit with TypeScript 5.9.2 under strict settings
    await typecheckExamples(tempInstall);

    // 5. Run examples/first-event.ts
    const firstEventScript = resolve(tempInstall, "examples/first-event.ts");
    assert(existsSync(firstEventScript), "examples/first-event.ts missing from installed kit");

    const output = runChecked(process.execPath, ["--no-warnings", "examples/first-event.ts"], {
      cwd: tempInstall,
      capture: true,
    });
    assert(output.includes("first-event:pass"), `examples/first-event.ts did not succeed:\n${output}`);

    // 6. Run example-receiver and example-service end to end over loopback HTTP
    await verifyHttpExchange(tempInstall);

    process.stdout.write(
      "evaluation kit verification passed: kit built, identity verified, installed outside workspace, doc blocks and examples type-checked, events emitted and verified over HTTP\n",
    );
    return { success: true };
  } finally {
    await rm(tempInstall, { recursive: true, force: true });
    if (cleanupKit && kitDir) {
      await rm(kitDir, { recursive: true, force: true });
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
