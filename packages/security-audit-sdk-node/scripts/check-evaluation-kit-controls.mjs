import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import {
  assertOutsideRepository,
  buildEvaluationKit,
  computeKitDigest,
  computeManifestDigest,
} from "./build-evaluation-kit.mjs";
import { checkEvaluationKit } from "./check-evaluation-kit.mjs";
import { extractDocBlocksFromDir } from "./evaluation-kit-doc-blocks.mjs";
import { packageRoot, runChecked } from "./verification-helpers.mjs";

async function checkMissingCoreControl(kitDir, identity) {
  const tempMissingCore = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-missing-core-"));
  try {
    await cp(kitDir, tempMissingCore, { recursive: true });
    const coreArtifact = identity.artifacts.find((a) => a.name === "core");
    await rm(resolve(tempMissingCore, coreArtifact.filename));

    let failed = false;
    try {
      await checkEvaluationKit({ kitDir: tempMissingCore });
    } catch {
      failed = true;
    }
    assert.ok(failed, "gate must fail closed when core tarball is missing");
  } finally {
    await rm(tempMissingCore, { recursive: true, force: true });
  }
}

async function checkBrokenOverrideControl(kitDir) {
  const tempBrokenOverride = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-broken-override-"));
  try {
    await cp(kitDir, tempBrokenOverride, { recursive: true });
    const pkgPath = resolve(tempBrokenOverride, "package.json");
    const pkg = JSON.parse(await readFile(pkgPath, "utf8"));
    pkg.overrides["@bloodtrail/security-audit-sdk-core"] = "./nonexistent-core.tgz";
    const newManifest = JSON.stringify(pkg, null, 2) + "\n";
    await writeFile(pkgPath, newManifest, "utf8");

    // Update identity so identity check passes and npm install failure is isolated
    const idPath = resolve(tempBrokenOverride, "identity.json");
    const id = JSON.parse(await readFile(idPath, "utf8"));
    id.manifest_digest = computeManifestDigest(newManifest);
    id.kit_digest = computeKitDigest(id.package_set_digest, id.manifest_digest);
    await writeFile(idPath, JSON.stringify(id, null, 2) + "\n", "utf8");

    let failed = false;
    try {
      await checkEvaluationKit({ kitDir: tempBrokenOverride });
    } catch {
      failed = true;
    }
    assert.ok(failed, "gate must fail closed when core override is broken");
  } finally {
    await rm(tempBrokenOverride, { recursive: true, force: true });
  }
}

async function checkTamperedIdentityControl(kitDir) {
  const tempTamperedId = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-tampered-id-"));
  try {
    await cp(kitDir, tempTamperedId, { recursive: true });
    const idPath = resolve(tempTamperedId, "identity.json");
    const id = JSON.parse(await readFile(idPath, "utf8"));
    id.artifacts[0].sha256 = "0000000000000000000000000000000000000000000000000000000000000000";
    await writeFile(idPath, JSON.stringify(id, null, 2) + "\n", "utf8");

    let failed = false;
    try {
      await checkEvaluationKit({ kitDir: tempTamperedId });
    } catch {
      failed = true;
    }
    assert.ok(failed, "gate must fail closed when identity is tampered with");
  } finally {
    await rm(tempTamperedId, { recursive: true, force: true });
  }
}

async function verifyMatrixLegsFailClosed(tempBrokenDoc) {
  const brokenInstall = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-broken-install-"));
  try {
    await cp(tempBrokenDoc, brokenInstall, { recursive: true });
    runChecked("npm", ["install", "--omit=dev", "--no-audit", "--no-fund", "--ignore-scripts", "--offline"], {
      cwd: brokenInstall,
      capture: true,
    });
    const docsDir = resolve(brokenInstall, "docs");
    const docBlocksDir = resolve(brokenInstall, "doc-blocks");
    await extractDocBlocksFromDir(docsDir, docBlocksDir);

    const tsconfigPath = resolve(brokenInstall, "tsconfig.json");
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
      include: ["examples/**/*.ts", "doc-blocks/**/*.ts"],
    };
    await writeFile(tsconfigPath, JSON.stringify(tsconfig, null, 2), "utf8");

    const legs = [
      { version: "5.9.2", cmd: process.execPath, args: [resolve(packageRoot, "node_modules/typescript/bin/tsc"), "-p", tsconfigPath] },
      { version: "6.0.3", cmd: "npx", args: ["--yes", "-p", "typescript@6.0.3", "tsc", "-p", tsconfigPath] },
      { version: "7.0.2", cmd: "npx", args: ["--yes", "-p", "typescript@7.0.2", "tsc", "-p", tsconfigPath] },
    ];

    for (const leg of legs) {
      const res = spawnSync(leg.cmd, leg.args, { cwd: brokenInstall, encoding: "utf8" });
      assert.notEqual(res.status, 0, `TypeScript matrix leg ${leg.version} must fail closed on planted type error`);
    }
  } finally {
    await rm(brokenInstall, { recursive: true, force: true });
  }
}

async function checkBrokenDocControl(kitDir) {
  const tempBrokenDoc = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-broken-doc-"));
  try {
    await cp(kitDir, tempBrokenDoc, { recursive: true });
    const quickstartPath = resolve(tempBrokenDoc, "docs/quickstart.md");
    const quickstartText = await readFile(quickstartPath, "utf8");
    const brokenQuickstart = quickstartText.replace("timeoutMs: 5000,", "timeoutOption: 5000,");
    await writeFile(quickstartPath, brokenQuickstart, "utf8");

    let failed = false;
    try {
      await checkEvaluationKit({ kitDir: tempBrokenDoc });
    } catch {
      failed = true;
    }
    assert.ok(failed, "gate must fail closed when doc block uses renamed option");

    // Verify that every matrix leg fails individually on the planted type error
    await verifyMatrixLegsFailClosed(tempBrokenDoc);
  } finally {
    await rm(tempBrokenDoc, { recursive: true, force: true });
  }
}

async function checkDuplicateCoreControl(kitDir) {
  const tempDuplicateCore = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-dup-core-"));
  try {
    await cp(kitDir, tempDuplicateCore, { recursive: true });
    let failed = false;
    let reportedDuplicateAuthority = false;
    try {
      await checkEvaluationKit({ kitDir: tempDuplicateCore, plantDuplicateCore: true });
    } catch (err) {
      failed = true;
      if (err.message?.includes("DUPLICATE_AUTHORITY")) {
        reportedDuplicateAuthority = true;
      }
    }
    assert.ok(failed, "gate must fail closed when duplicate core is planted");
    assert.ok(reportedDuplicateAuthority, "planted duplicate core must report DUPLICATE_AUTHORITY");
  } finally {
    await rm(tempDuplicateCore, { recursive: true, force: true });
  }
}

export async function checkEvaluationKitControls() {
  await assertOutsideRepository(tmpdir());

  // Build a base verification kit to derive controls from
  const { kitDir, identity, removeKit } = await buildEvaluationKit({ mode: "verification" });

  try {
    // Control 1: Missing core tarball fails the gate
    await checkMissingCoreControl(kitDir, identity);

    // Control 2: Broken core override in package.json fails the gate
    await checkBrokenOverrideControl(kitDir);

    // Control 3: Tampered identity fails the gate
    await checkTamperedIdentityControl(kitDir);

    // Control 4: Renamed option in doc block snippet fails every leg of the TypeScript matrix
    await checkBrokenDocControl(kitDir);

    // Control 5: Planted second core copy reports DUPLICATE_AUTHORITY and fails the gate
    await checkDuplicateCoreControl(kitDir);

    // Control 6: Removing any kit item fails the gate
    const tempMissingItem = await mkdtemp(resolve(tmpdir(), "bloodtrail-ctrl-missing-item-"));
    try {
      await cp(kitDir, tempMissingItem, { recursive: true });
      await rm(resolve(tempMissingItem, "docs/evaluation-guide.md"));

      let failed = false;
      try {
        await checkEvaluationKit({ kitDir: tempMissingItem });
      } catch {
        failed = true;
      }
      assert.ok(failed, "gate must fail closed when a required kit item is missing");
    } finally {
      await rm(tempMissingItem, { recursive: true, force: true });
    }

    // Control 7: Distributable build refuses dirty tree
    let dirtyRefused = false;
    try {
      await buildEvaluationKit({ mode: "distributable", _gitStatus: " M dirty-file.ts\n" });
    } catch (err) {
      if (err.message?.includes("cannot build distributable evaluation kit from dirty git tree")) {
        dirtyRefused = true;
      }
    }
    assert.ok(dirtyRefused, "distributable build must refuse dirty git tree");

    process.stdout.write(
      "evaluation kit negative controls passed: missing core tarball, wrong override, tampered identity, renamed doc option (across all TypeScript matrix legs), planted duplicate core, missing kit item, and dirty tree build attempt each failed closed\n",
    );
  } finally {
    await removeKit();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkEvaluationKitControls();
}
