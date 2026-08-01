import { readdir, readFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import {
  assert,
  packageRoot,
  readJson,
  repositoryRoot,
} from "./verification-helpers.mjs";

const changeRoot = resolve(repositoryRoot, "openspec/changes/implement-security-audit-sdk-core");
const expected = Object.freeze({
  contractVersion: "1.0.0",
  normativeTarget: "8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993",
  proposalBaseline: "94dc6e3bcc74beecd1fca2832948b139167fdd3b",
  packageName: "@bloodtrail/security-audit-sdk-core",
  packageVersion: "0.1.0",
  nodeEngines: ">=24 <25 || >=26 <27",
  nodeMajors: [24, 26],
  nodeCiVersions: ["24.2.0", "26.5.0"],
  typescriptRange: ">=5.9.2 <6",
  typescriptCiVersion: "5.9.2",
  packageExports: [".", "./testing"],
  deliveryClasses: ["best_effort", "security_significant", "transaction_critical", "policy_critical"],
  extensionNamespaces: ["bloodtrail.audit.enrichment.v1"],
  catalogEventCount: 24,
  namedEventApiCount: 24,
  runtimeDependencyCount: 0,
  scenarioCount: 15,
  taskCount: 106,
});

const failures = [];
function rule(id, file, condition, message) {
  if (!condition) failures.push({ id, file, message });
}
function same(left, right) {
  return JSON.stringify(left) === JSON.stringify(right);
}
function includesAll(text, values) {
  return values.every((value) => text.includes(value));
}

const requiredTextFiles = [
  ["proposal", resolve(changeRoot, "proposal.md")],
  ["design", resolve(changeRoot, "design.md")],
  ["spec", resolve(changeRoot, "specs/security-audit-sdk-core/spec.md")],
  ["tasks", resolve(changeRoot, "tasks.md")],
  ["review-packet", resolve(changeRoot, "technical-review-packet.md")],
  ["README", resolve(packageRoot, "README.md")],
  ["API", resolve(packageRoot, "API.md")],
  ["SECURITY", resolve(packageRoot, "SECURITY.md")],
  ["MIGRATION", resolve(packageRoot, "MIGRATION.md")],
  ["example-support", resolve(packageRoot, "examples/support.ts")],
  ["example-scenarios", resolve(packageRoot, "examples/scenarios.ts")],
  ["example-runner", resolve(packageRoot, "examples/run.ts")],
];
const texts = new Map();
for (const [id, path] of requiredTextFiles) {
  try {
    texts.set(id, await readFile(path, "utf8"));
  } catch {
    rule("required-file", relative(repositoryRoot, path), false, "required coherence input is missing or unreadable");
  }
}
const pkg = await readJson(resolve(packageRoot, "package.json"));
const lock = await readJson(resolve(packageRoot, "package-lock.json"));
const compatibility = await readJson(resolve(packageRoot, "compatibility.json"));
const provenance = await readJson(resolve(packageRoot, "contract-provenance.json"));

rule("package-name", "package.json", pkg.name === expected.packageName, "package name differs from the SDK identity");
rule("package-version", "package.json", pkg.version === expected.packageVersion, "package version differs from the compatibility baseline");
rule("package-private", "package.json", pkg.private === true, "package must remain private pending explicit release authorization");
rule("module-policy", "package.json", pkg.type === "module", "public package must remain ESM");
rule("node-engines", "package.json", pkg.engines?.node === expected.nodeEngines, "Node engines policy differs from the verified majors");
rule("runtime-dependencies", "package.json", Object.keys(pkg.dependencies ?? {}).length === expected.runtimeDependencyCount, "runtime dependency count differs from zero-runtime policy");
rule("public-subpaths", "package.json", same(Object.keys(pkg.exports ?? {}), expected.packageExports), "public package subpaths differ from the documented export map");
rule("typescript-pin", "package.json", pkg.devDependencies?.typescript === expected.typescriptCiVersion, "TypeScript compiler pin differs from compatibility policy");
rule("lock-root", "package-lock.json", lock.packages?.[""]?.version === pkg.version && lock.packages?.[""]?.name === pkg.name, "lockfile root package identity differs from package.json");
rule("lock-runtime-dependencies", "package-lock.json", Object.keys(lock.packages?.[""]?.dependencies ?? {}).length === 0, "lockfile declares a runtime dependency");

rule("compat-package", "compatibility.json", compatibility.package?.name === pkg.name && compatibility.package?.version === pkg.version, "compatibility package identity differs from package.json");
rule("compat-contract", "compatibility.json", compatibility.contractVersion === expected.contractVersion && same(compatibility.supportedContractVersions, [expected.contractVersion]), "compatibility contract range is not exactly 1.0.0");
rule("compat-target", "compatibility.json", compatibility.normativeTechnicalTarget === expected.normativeTarget, "compatibility normative target differs from the approved contract commit");
rule("compat-node", "compatibility.json", compatibility.node?.engines === expected.nodeEngines && same(compatibility.node?.supportedMajors, expected.nodeMajors) && same(compatibility.node?.ciVersions, expected.nodeCiVersions), "Node support/evidence metadata differs from policy");
rule("compat-typescript", "compatibility.json", compatibility.typescript?.supported === expected.typescriptRange && compatibility.typescript?.ciVersion === expected.typescriptCiVersion, "TypeScript support metadata differs from policy");
rule("compat-module", "compatibility.json", compatibility.modulePolicy === "esm-public-cjs-standalone-validator", "module policy must describe ESM public output and the internal CJS validator boundary");
for (const key of ["runtimeDependencyCount", "namedEventApiCount", "catalogEventCount"]) {
  rule(`compat-${key}`, "compatibility.json", compatibility[key] === expected[key], `${key} differs from the contract/package baseline`);
}
rule("compat-delivery", "compatibility.json", same(compatibility.deliveryClasses, expected.deliveryClasses), "delivery-class inventory differs from the canonical registry");
rule("compat-extensions", "compatibility.json", same(compatibility.extensionNamespaces, expected.extensionNamespaces), "extension namespace inventory differs from the canonical registry");
rule("compat-exports", "compatibility.json", same(compatibility.packageExports, expected.packageExports), "compatibility public subpaths differ from package.json");

rule("provenance-version", "contract-provenance.json", provenance.contractVersion === expected.contractVersion, "contract provenance version differs from 1.0.0");
rule("provenance-target", "contract-provenance.json", provenance.normativeTechnicalTarget === expected.normativeTarget, "contract provenance target differs from the approved commit");
rule("proposal-baseline", "contract-provenance.json", provenance.proposalBaseline === expected.proposalBaseline, "proposal baseline differs from the real proposal commit");
const authorization = provenance.authorization ?? {};
rule("sdk-implementation-authorization", "contract-provenance.json", authorization.sdkCoreImplementation === true, "isolated SDK implementation authorization is not recorded");
for (const key of ["productionDeployment", "productionCollection", "realUserData", "frameworkInstrumentation", "productionDelivery"]) {
  rule(`production-${key}`, "contract-provenance.json", authorization[key] === false, `${key} must remain explicitly unauthorized`);
}

let runtime;
let testingRuntime;
try {
  runtime = await import("../dist/index.js");
  testingRuntime = await import("../dist/testing.js");
} catch {
  rule("fresh-build-required", "dist", false, "built public package output is missing or cannot be imported");
}
if (runtime) {
  rule("runtime-contract", "dist/index.js", runtime.CONTRACT_VERSION === expected.contractVersion, "built contract version differs from metadata");
  rule("catalog-count", "dist/index.js", runtime.EVENT_CATALOG?.length === expected.catalogEventCount, "built catalog event count differs from 24");
  rule("named-api-count", "dist/index.js", runtime.EVENT_METHODS?.length === expected.namedEventApiCount, "built named event API count differs from 24");
  rule("delivery-classes", "dist/index.js", same(runtime.REGISTRIES?.delivery_classes, expected.deliveryClasses), "built delivery classes differ from compatibility metadata");
  rule("extension-namespaces", "dist/index.js", same(runtime.EXTENSION_NAMESPACES?.map((entry) => entry.namespace), expected.extensionNamespaces), "built extension namespaces differ from compatibility metadata");
  const rootExports = Object.keys(runtime);
  for (const name of ["createSecurityAuditSdk", "authoritativeResource", "EVENT_CATALOG", "EVENT_METHODS", "validateSecurityAuditEvent"]) {
    rule(`root-export-${name}`, "dist/index.js", rootExports.includes(name), `required public root export ${name} is absent`);
  }
  for (const name of ["createCapturingAuditSink", "createInMemoryAuditSink"]) {
    rule(`test-export-boundary-${name}`, "dist/index.js", !rootExports.includes(name), `test sink ${name} leaked into the root export`);
    rule(`testing-export-${name}`, "dist/testing.js", typeof testingRuntime?.[name] === "function", `test sink ${name} is absent from the testing subpath`);
  }
}

const generatedSource = await safeRead(resolve(packageRoot, "src/generated/contract.generated.ts"), "generated-contract");
rule("generated-version", "src/generated/contract.generated.ts", generatedSource.includes(`export const CONTRACT_VERSION = "${expected.contractVersion}"`), "generated contract version constant differs from metadata");
rule("generated-header", "src/generated/contract.generated.ts", generatedSource.startsWith("// GENERATED FILE. DO NOT EDIT."), "generated contract metadata lacks its generated-file boundary");
const publicSource = await safeRead(resolve(packageRoot, "src/index.ts"), "public-source");
rule("generated-public-exports", "src/index.ts", includesAll(publicSource, ["EVENT_CATALOG", "EVENT_METHODS", "EXTENSION_NAMESPACES", "CONTRACT_VERSION"]), "generated public metadata exports are incomplete");

const adrRoot = resolve(packageRoot, "adr");
const adrFiles = (await readdir(adrRoot)).filter((name) => /^\d{3}-.+\.md$/.test(name)).sort();
rule("adr-count", "adr", adrFiles.length === 10, "expected exactly ADR-SDK-001 through ADR-SDK-010");
rule("adr-sequence", "adr", same(adrFiles.map((name) => name.slice(0, 3)), ["001", "002", "003", "004", "005", "006", "007", "008", "009", "010"]), "ADR identifiers are missing or duplicated");
const adrTexts = [];
for (const name of adrFiles) {
  const text = await safeRead(resolve(adrRoot, name), `adr/${name}`);
  adrTexts.push(text);
  rule("adr-status", `adr/${name}`, /(?:Status:\s*Accepted for SDK-core implementation|Implemented for Pass 3 technical closure)/.test(text), "ADR does not state its SDK-core implementation status");
}
const allAdrs = adrTexts.join("\n");
rule("adr-runtime", "adr", includesAll(allAdrs, [expected.packageName, "Node.js majors 24 and 26", expected.typescriptRange, "runtime dependencies remain zero"]), "ADR runtime/package policy is incomplete");
rule("adr-contract", "adr", includesAll(allAdrs, [expected.normativeTarget, "contract `1.0.0`"]), "ADR contract version/target binding is incomplete");
rule("adr-validator-format", "adr/003-runtime-schema-validation.md", allAdrs.includes("standalone CommonJS output") && !allAdrs.includes("standalone ESM output"), "validator module-format decision is stale or contradictory");
rule("adr-baseline", "adr/010-canonical-verification-and-scope.md", allAdrs.includes(expected.proposalBaseline) && !/94dc4fcfb267777817c0f1894b02d542670f5c79/.test(allAdrs), "ADR changed-path baseline is stale or contradictory");

const docs = ["README", "API", "SECURITY", "MIGRATION"].map((id) => texts.get(id) ?? "").join("\n");
rule("docs-package", "consumer-docs", docs.includes(expected.packageName) && docs.includes(expected.packageVersion), "consumer documentation lacks package identity/version");
rule("docs-runtime", "consumer-docs", includesAll(docs, ["Node `24.2.0`", "`26.5.0`", expected.typescriptRange, "ESM"]), "consumer documentation lacks exact Node/TypeScript/ESM policy");
rule("docs-contract", "consumer-docs", includesAll(docs, [expected.contractVersion, expected.normativeTarget]), "consumer documentation lacks exact contract version/target");
rule("docs-events", "consumer-docs", /24 named (?:event )?methods/.test(docs), "consumer documentation does not identify all 24 named event APIs");
rule("docs-delivery", "consumer-docs", expected.deliveryClasses.every((value) => docs.includes(value)), "consumer documentation omits a canonical delivery class");
rule("docs-extension", "consumer-docs", docs.includes(expected.extensionNamespaces[0]), "consumer documentation omits the registered extension namespace");
rule("docs-test-sinks", "consumer-docs", includesAll(docs, ["createCapturingAuditSink", "createInMemoryAuditSink", "tests and local development only"]), "test sinks are not clearly restricted to non-production use");
rule("docs-authority", "consumer-docs", /client claims?/i.test(docs) && /authoritative/i.test(docs) && /producer truth(?:fulness)?/i.test(docs), "authority/producer-truth boundary is incomplete");
rule("docs-production", "consumer-docs", includesAll(docs, ["does not authorize production", "browser telemetry", "transport", "collector"]), "production authorization/follow-on boundaries are incomplete");
rule("docs-no-durability", "consumer-docs", /(?:no|not|does not)[^.\n]{0,80}durab(?:le|ility)|durab(?:le|ility)[^.\n]{0,80}(?:no|not|does not)/i.test(docs), "sink acceptance/durability limitation is incomplete");

const openSpec = ["proposal", "design", "spec", "tasks"].map((id) => texts.get(id) ?? "").join("\n");
rule("openspec-contract", "active-change", openSpec.includes(expected.contractVersion), "active change does not remain bound to contract 1.0.0");
rule("openspec-event-count", "active-change", openSpec.includes("all 24") || openSpec.includes("24 version"), "active change lacks 24-event catalog scope");
rule("openspec-production", "active-change", includesAll(openSpec, ["browser telemetry", "production", "transport"]), "active change lacks explicit production/transport/browser boundaries");

const tasks = texts.get("tasks") ?? "";
const taskLines = [...tasks.matchAll(/^- \[([ x])\] (\d+\.\d+)\s/mg)];
const checkedTasks = taskLines.filter((match) => match[1] === "x").length;
rule("task-count", "tasks.md", taskLines.length === expected.taskCount, `task checklist count differs from ${expected.taskCount}`);
for (const id of ["14.1", "14.2", "14.3", "14.4", "14.5", "14.6", "14.7"]) {
  const match = taskLines.find((entry) => entry[2] === id);
  rule(`governance-task-${id}`, "tasks.md", match?.[1] === " ", `governance task ${id} must remain unchecked before exact-commit owner action`);
}
const packet = texts.get("review-packet") ?? "";
rule("review-proposal", "technical-review-packet.md", packet.includes(expected.proposalBaseline), "review packet proposal commit differs from the real baseline");
rule("review-target", "technical-review-packet.md", packet.includes(expected.normativeTarget), "review packet contract target differs from the approved commit");
rule("review-task-state", "technical-review-packet.md", packet.includes(`${checkedTasks}/${expected.taskCount} complete; ${expected.taskCount - checkedTasks}/${expected.taskCount} remain`), "review packet current task state differs from tasks.md");
rule("review-pending", "technical-review-packet.md", includesAll(packet, ["Final technical commit: `PENDING", "Reviewed commit: `PENDING", "Project-owner SDK decision: `PENDING", "Production deployment approved | `NO — NOT AUTHORIZED`"]), "exact-commit review or owner/production status is not explicitly pending/unauthorized");
rule("review-generated-files", "technical-review-packet.md", includesAll(packet, ["schema-validator.generated.cjs", "schema-validator.generated.d.cts"]), "review packet generated-artifact inventory is stale");

const scenarios = texts.get("example-scenarios") ?? "";
const scenarioExports = [...scenarios.matchAll(/^export async function ([A-Za-z0-9_]+)\(/mg)].map((match) => match[1]);
rule("example-count", "examples/scenarios.ts", scenarioExports.length === expected.scenarioCount, `documentation scenario count differs from ${expected.scenarioCount}`);
const exampleText = [texts.get("example-support"), scenarios, texts.get("example-runner")].join("\n");
rule("example-public-imports", "examples", !/(?:from|import\s*)\s*["'][^"']*(?:\/src\/|\/dist\/|\/internal|\/validation\/)/.test(exampleText), "documentation examples import an internal module");
rule("example-authority-casts", "examples", !/\bas\s+(?:Authoritative|Authenticated|TenantAuthority|ResourceAuthority|AuthorizationEvidence|SecurityAuditEvent)/.test(exampleText), "documentation examples cast objects into authoritative/event types");
rule("example-synthetic", "examples", includesAll(exampleText, ["synthetic-", "example.test", "192.0.2."]), "documentation examples do not consistently use synthetic identifiers");
rule("example-test-boundary", "examples", exampleText.includes("@bloodtrail/security-audit-sdk-core/testing"), "documentation test harness does not use the explicit testing subpath");

const tests = await walk(resolve(packageRoot, "tests"));
rule("tests-present", "tests", tests.length > 0, "SDK test inventory is empty");
const testText = (await Promise.all(tests.filter((path) => path.endsWith(".ts")).map((path) => readFile(path, "utf8")))).join("\n");
rule("tests-event-count", "tests", testText.includes("EVENT_METHODS") && testText.includes("EVENT_CATALOG"), "tests do not cross-check generated event methods/catalog");
rule("tests-authority", "tests", includesAll(testText, ["AUTHORITY_ESCALATION", "claimedTenant", "authorization"]), "tests do not cover authority and authorization boundaries");
rule("tests-production", "tests", includesAll(testText, ["createCapturingAuditSink", "SINK_FAILURE"]), "tests do not cover the non-production sink/error boundary");

const dangerousAffirmations = [
  ["production-ready", /\b(?:SDK|package) is production[- ]ready\b/i],
  ["production-authorized", /\bproduction (?:deployment|collection|use) (?:is|has been) authorized\b/i],
  ["transport-implemented", /\b(?:implements?|includes?) (?:a )?(?:production )?(?:transport|exporter|collector)\b/i],
  ["browser-implemented", /\b(?:implements?|includes?) browser telemetry\b/i],
  ["durable-delivery", /\b(?:guarantees?|provides?) durable delivery\b/i],
];
const statusSurfaces = [docs, packet, openSpec, allAdrs].join("\n");
for (const [id, pattern] of dangerousAffirmations) {
  rule(`forbidden-claim-${id}`, "cross-artifact-prose", !pattern.test(statusSurfaces), `contradictory ${id} claim detected`);
}

if (failures.length > 0) {
  failures.sort((a, b) => `${a.file}:${a.id}`.localeCompare(`${b.file}:${b.id}`));
  process.stderr.write(`cross-artifact coherence failed (${failures.length} rule${failures.length === 1 ? "" : "s"}):\n`);
  for (const failure of failures) process.stderr.write(`[${failure.id}] ${failure.file}: ${failure.message}\n`);
  process.exitCode = 1;
} else {
  process.stdout.write(`cross-artifact coherence passed: contract ${expected.contractVersion}, ${expected.catalogEventCount} catalog events/${expected.namedEventApiCount} named APIs, ${expected.runtimeDependencyCount} runtime dependencies, ${checkedTasks}/${expected.taskCount} tasks complete, governance pending\n`);
}

async function safeRead(path, id) {
  try {
    return await readFile(path, "utf8");
  } catch {
    rule("required-file", relative(repositoryRoot, path), false, `${id} is missing or unreadable`);
    return "";
  }
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) paths.push(...await walk(path));
    else if (entry.isFile()) paths.push(path);
  }
  return paths.sort((a, b) => basename(a).localeCompare(basename(b)) || a.localeCompare(b));
}
