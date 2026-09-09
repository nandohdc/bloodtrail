import { access, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const manifest = JSON.parse(await readFile(resolve(packageRoot, "contract-provenance.json"), "utf8"));
if (manifest.contractVersion !== "1.1.0" || manifest.normativeTechnicalTarget !== "dce24621303eb9707fc991c1e03e04630906cabb") {
  throw new Error("contract provenance is not bound to approved version 1.1.0");
}
const protectedPaths = [
  manifest.canonicalCapability,
  manifest.archivedChange,
  ...Object.values(manifest.sources),
].filter((value) => typeof value === "string");
for (const path of protectedPaths) await access(resolve(repositoryRoot, path));
const diff = spawnSync("git", ["diff", "--exit-code", manifest.proposalBaseline, "--", ...protectedPaths], {
  cwd: repositoryRoot,
  encoding: "utf8",
});
if (diff.status !== 0) {
  process.stderr.write(diff.stdout);
  process.stderr.write(diff.stderr);
  throw new Error("approved contract or governance history differs from the proposal baseline");
}
console.log("approved contract 1.1.0 and governance history are unchanged");
