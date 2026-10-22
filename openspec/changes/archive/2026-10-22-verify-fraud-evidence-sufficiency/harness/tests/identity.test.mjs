import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { readIdentity } from "../lib/identity.mjs";
import { sha256 } from "../lib/io.mjs";

function identityFixture({ kit }) {
  const artifact = { filename: "fixture.tgz", sha256: sha256("opaque fixture\n") };
  const checksum = "opaque checksum-list fixture\n";
  const kitDigest = sha256(checksum);
  writeFileSync(join(kit, artifact.filename), "opaque fixture\n");
  writeFileSync(join(kit, "package.json"), "{}\n");
  writeFileSync(join(kit, "checksums.sha256"), checksum);
  writeFileSync(join(kit, "kit-digest.sha256"), `${kitDigest}\n`);
  return { verified: true, kitDigest, identity: {
    commit: "1".repeat(40), distributable: true, artifacts: [artifact],
    manifest_digest: sha256("{}\n"), package_set_digest: sha256(`${artifact.sha256}  ${artifact.filename}\n`),
  } };
}

const REFUSALS = [
  ["governed refusal", (value) => { value.verified = false; }],
  ["head", (value) => { value.identity.commit = "2".repeat(40); }],
  ["distributable", (value) => { value.identity.distributable = false; }],
  ["artifact digest", (value) => { value.identity.artifacts[0].sha256 = "0".repeat(64); }],
  ["manifest digest", (value) => { value.identity.manifest_digest = "0".repeat(64); }],
  ["package-set digest", (value) => { value.identity.package_set_digest = "0".repeat(64); }],
  ["kit digest", (value) => { value.kitDigest = "0".repeat(64); }],
];

test("identity wiring invokes governed verifier in a child without putting builder at argv[1]", () => {
  const kit = mkdtempSync(join(tmpdir(), "pids-identity-fixture-"));
  try {
    const value = identityFixture({ kit });
    const repo = join(kit, "approved-checkout");
    const run = (request) => {
      assert.equal(request.program, process.execPath);
      assert.equal(request.cwd, repo);
      assert.deepEqual(request.args.slice(0, 2), ["--input-type=module", "-e"]);
      assert.equal(request.args.length, 3, "no positional builder argument triggers auto-build");
      assert(request.args[2].includes("verifyKitIdentity(process.env.STAGE_P_KIT)"));
      assert(request.args[2].includes("import(pathToFileURL(process.env.STAGE_P_BUILDER).href)"));
      assert.equal(request.env.STAGE_P_BUILDER, join(repo, "packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs"));
      assert.equal(request.env.STAGE_P_KIT, kit);
      return JSON.stringify(value);
    };
    const options = { kit, repo, approvedHead: value.identity.commit, run };
    assert.deepEqual(readIdentity(options), { identity: value.identity, kit_digest: value.kitDigest });
    assert.throws(() => readIdentity({ ...options, run: () => { throw new Error("governed verifier rejected entries"); } }), /rejected entries/);
    for (const [label, patch] of REFUSALS) {
      const changed = structuredClone(value); patch(changed);
      assert.throws(() => readIdentity({ ...options, run: () => JSON.stringify(changed) }), label);
    }
  } finally {
    rmSync(kit, { recursive: true, force: true });
  }
});
