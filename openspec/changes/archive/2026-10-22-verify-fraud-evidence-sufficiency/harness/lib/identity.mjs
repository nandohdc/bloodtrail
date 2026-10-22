import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { command, sha256 } from "./io.mjs";

const VERIFY_SCRIPT = `import { pathToFileURL } from "node:url";
const { verifyKitIdentity } = await import(pathToFileURL(process.env.STAGE_P_BUILDER).href);
console.log(JSON.stringify(await verifyKitIdentity(process.env.STAGE_P_KIT)));
`;

export function readIdentity({ kit, approvedHead, repo, run = command }) {
  const verified = JSON.parse(run({
    program: process.execPath, args: ["--input-type=module", "-e", VERIFY_SCRIPT], cwd: repo,
    env: { ...process.env, STAGE_P_BUILDER: join(repo, "packages/security-audit-sdk-node/scripts/build-evaluation-kit.mjs"), STAGE_P_KIT: kit },
  }));
  assert.equal(verified.verified, true, "governed kit verification refused");
  const { identity, kitDigest } = verified;
  assert.equal(identity.commit, approvedHead);
  assert.equal(identity.distributable, true);
  for (const artifact of identity.artifacts) assert.equal(sha256(readFileSync(join(kit, artifact.filename))), artifact.sha256);
  assert.equal(sha256(readFileSync(join(kit, "package.json"))), identity.manifest_digest);
  const material = identity.artifacts.map((entry) => `${entry.sha256}  ${entry.filename}\n`).join("");
  assert.equal(sha256(material), identity.package_set_digest);
  assert.equal(readFileSync(join(kit, "kit-digest.sha256"), "utf8").trim().split(/\s+/)[0], kitDigest);
  assert.equal(sha256(readFileSync(join(kit, "checksums.sha256"))), kitDigest);
  return { identity, kit_digest: kitDigest };
}
