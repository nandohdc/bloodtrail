import { existsSync } from "node:fs";
import { cp, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertOutsideRepository,
  buildEvaluationKit,
  packTarball,
  verifyKitIdentity,
} from "./build-evaluation-kit.mjs";
import { assert, runChecked } from "./verification-helpers.mjs";

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

    // 3. Install kit with npm outside any workspace root
    await cp(kitDir, tempInstall, { recursive: true });

    runChecked(
      "npm",
      ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline"],
      { cwd: tempInstall, capture: true },
    );

    // 4. Run examples/first-event.ts
    const firstEventScript = resolve(tempInstall, "examples/first-event.ts");
    assert(existsSync(firstEventScript), "examples/first-event.ts missing from installed kit");

    const output = runChecked("node", ["--no-warnings", "examples/first-event.ts"], {
      cwd: tempInstall,
      capture: true,
    });
    assert(output.includes("first-event:pass"), `examples/first-event.ts did not succeed:\n${output}`);

    process.stdout.write(
      "evaluation kit verification passed: kit built, identity verified, installed outside workspace, first-event emitted and verified\n",
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
