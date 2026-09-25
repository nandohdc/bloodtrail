import assert from "node:assert/strict";
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

export async function checkEvaluationKitControls() {
  await assertOutsideRepository(tmpdir());

  // Build a base verification kit to derive controls from
  const { kitDir, identity, removeKit } = await buildEvaluationKit({ mode: "verification" });

  try {
    // Control 1: Missing core tarball fails the gate
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

    // Control 2: Broken core override in package.json fails the gate
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

    // Control 3: Tampered identity fails the gate
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

    // Control 4: Renamed option in doc block snippet fails the gate
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
    } finally {
      await rm(tempBrokenDoc, { recursive: true, force: true });
    }

    // Control 5: Planted second core copy reports DUPLICATE_AUTHORITY and fails the gate
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

    process.stdout.write(
      "evaluation kit negative controls passed: missing core tarball, wrong override, tampered identity, renamed doc option, and planted duplicate core each failed closed\n",
    );
  } finally {
    await removeKit();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await checkEvaluationKitControls();
}
