import { readdir, rm } from "node:fs/promises";
import { resolve } from "node:path";
import { assert, packageRoot, readJson, repositoryRoot, runChecked } from "./verification-helpers.mjs";
import { lifecycleMetadata, resolveVerificationLifecycle } from "./lifecycle-policy.mjs";

const lifecycle = await resolveVerificationLifecycle();
process.env.SDK_VERIFICATION_MODE = lifecycle.mode;
process.env.SDK_VERIFICATION_CHANGE = lifecycle.change;
const pkg = await readJson(resolve(packageRoot, "package.json"));
const compatibility = await readJson(resolve(packageRoot, "compatibility.json"));
const currentMajor = Number(process.versions.node.split(".")[0]);
assert(compatibility.node.supportedMajors.includes(currentMajor), `Node ${process.versions.node} is outside the declared Node 24/26 policy`);
assert(pkg.engines?.node === compatibility.node.engines, "package engines and compatibility manifest differ");

// Fail preflight before deleting disposable state when repository tools are unavailable.
for (const [command, args] of [
  ["git", ["--version"]],
  ["npm", ["--version"]],
  ["openspec", ["--version"]],
]) {
  runChecked(command, args, { cwd: repositoryRoot, capture: true });
}
runChecked("git", ["rev-parse", "--show-toplevel"], { cwd: repositoryRoot, capture: true });

process.stdout.write(`SDK-core canonical verification on Node ${process.versions.node} in ${lifecycle.mode} mode for ${lifecycle.change}\n`);
process.stdout.write("Install policy: remove node_modules, then npm ci --ignore-scripts --no-audit --no-fund from package-lock.json\n");

await step("clean disposable output", async () => {
  for (const path of ["node_modules", "dist", "dist-tests", "dist-examples", ".test-dist", ".verification-output"]) {
    await rm(resolve(packageRoot, path), { recursive: true, force: true });
  }
  for (const entry of await readdir(packageRoot)) {
    if (entry.endsWith(".tgz")) await rm(resolve(packageRoot, entry), { force: true });
  }
});

await step("install exact locked dependencies", () => command("npm", ["ci", "--ignore-scripts", "--no-audit", "--no-fund"]));
await step("reject pre-existing generated drift", () => npm("check:generated"));
await step("contract-derived generation", () => npm("generate"));
await step("confirm deterministic generated drift is absent", () => npm("check:generated"));
await step("strict source type-check", () => npm("typecheck"));
await step("fresh build", () => npm("build"));
await step("runtime compilation and runtime/fixture/semantic tests", () => npm("test:runtime"));
await step("compile-time positive and negative API tests", () => npm("test:types"));
await step("compile and execute synthetic documentation examples", () => npm("test:examples"));
await step("package exports", () => npm("test:exports"));
await step("Node/TypeScript/contract compatibility policy", () => npm("test:compatibility"));
await step("approved contract immutability", () => npm("test:contract-immutability"));
await step("production-scope and forbidden integration checks", () => npm("test:scope"));
await step("repository publication-path exclusion", () => npm("test:publication-path"));
await step("zero-runtime and exact development dependency checks", () => npm("test:dependencies"));
await step("npm audit at low threshold", () => command("npm", ["audit", "--audit-level=low"]));
await step("npm package dry-run and file allowlist", () => npm("test:package"));
await step("exact changed-path enforcement", () => npm("test:changed-paths"));
await step("governance merge and history integrity", () => npm("test:governance-history"));
await step("cross-artifact coherence sweep", () => npm("test:coherence"));
await step("verification lifecycle unit and differential mutation tests", () => npm("test:verification"));
if (lifecycle.mode === "active" || lifecycle.mode === "governed") {
  await step("strict active-change OpenSpec validation", () => command(
    "openspec",
    ["validate", lifecycle.change, "--strict"],
    repositoryRoot,
  ));
} else {
  await step("strict archived canonical-capability OpenSpec validation", () => command(
    "openspec",
    ["validate", lifecycleMetadata.originalSdkChange.capability.split("/").at(-2), "--strict"],
    repositoryRoot,
  ));
}
await step("strict repository OpenSpec validation", () => command("openspec", ["validate", "--all", "--strict"], repositoryRoot));
await step("Git whitespace, final-newline, and empty-index checks", () => npm("test:git"));

process.stdout.write("\nSDK-core canonical verification passed\n");

function npm(script) {
  command("npm", ["run", script]);
}

function command(executable, args, cwd = packageRoot) {
  runChecked(executable, args, { cwd });
}

async function step(label, action) {
  process.stdout.write(`\n=== ${label} ===\n`);
  await action();
}
