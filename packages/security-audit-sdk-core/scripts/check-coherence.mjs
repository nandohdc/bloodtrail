import { readdir, readFile } from "node:fs/promises";
import { basename, relative, resolve } from "node:path";
import {
  assert,
  byCodePoint,
  packageRoot,
  readJson,
  repositoryRoot,
} from "./verification-helpers.mjs";
import {
  boundedFailure,
  evaluateActiveTaskProgress,
  lifecycleMetadata,
  parseTaskChecklist,
  resolveVerificationLifecycle,
} from "./lifecycle-policy.mjs";

const lifecycle = await resolveVerificationLifecycle();
const changeRoot = lifecycle.currentChangeRoot;
const originalArchiveRoot = lifecycle.originalArchive;
const original = lifecycleMetadata.originalSdkChange;
const remediation = lifecycleMetadata.remediationChange;
const expected = Object.freeze({
  contractVersion: "1.0.0",
  normativeTarget: "8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993",
  proposalBaseline: "94dc6e3bcc74beecd1fca2832948b139167fdd3b",
  remediationBaseline: "b4206f92fc92c7355efaa80d9f878353cf794452",
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
  if (!condition) failures.push(boundedFailure(id, file, message));
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

  ["README", resolve(packageRoot, "README.md")],
  ["API", resolve(packageRoot, "API.md")],
  ["SECURITY", resolve(packageRoot, "SECURITY.md")],
  ["MIGRATION", resolve(packageRoot, "MIGRATION.md")],
  ["example-support", resolve(packageRoot, "examples/support.ts")],
  ["example-scenarios", resolve(packageRoot, "examples/scenarios.ts")],
  ["example-runner", resolve(packageRoot, "examples/run.ts")],
];
if (lifecycle.change === remediation.name) {
  requiredTextFiles.push(["authorization", resolve(changeRoot, "implementation-authorization.md")]);
}
if (lifecycle.mode === "governed" || lifecycle.mode === "archived" || lifecycle.change === original.name) {
  requiredTextFiles.push(["review-packet", resolve(changeRoot, "technical-review-packet.md")]);
}
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
const originalTasksText = await safeRead(resolve(originalArchiveRoot, "tasks.md"), "archived-original-tasks");
const originalPacket = await safeRead(resolve(originalArchiveRoot, "technical-review-packet.md"), "archived-original-review-packet");
const originalDelta = await safeRead(resolve(originalArchiveRoot, "specs/security-audit-sdk-core/spec.md"), "archived-original-capability-delta");
const canonicalCapability = await safeRead(resolve(repositoryRoot, original.capability), "canonical-sdk-capability");
const originalTasks = parseTaskChecklist(originalTasksText);
const originalRequirements = parseRequirementSet(
  originalDelta,
  `${original.archive}/specs/security-audit-sdk-core/spec.md`,
  "original-archive-capability",
);
const canonicalRequirements = parseRequirementSet(
  canonicalCapability,
  original.capability,
  "canonical-capability",
);
failures.push(...originalRequirements.failures, ...canonicalRequirements.failures);
compareRequirementSubset(originalRequirements, canonicalRequirements, {
  idPrefix: "original-capability",
  sourceLabel: "approved archived original SDK capability",
  targetFile: original.capability,
});

rule("original-active-absent", `openspec/changes/${original.name}`, !await pathExists(resolve(repositoryRoot, "openspec/changes", original.name)), "archived original SDK change is incorrectly present as active");
rule("original-archive-task-count", `${original.archive}/tasks.md`, originalTasks.length === original.taskCount, `archived original SDK task count differs from ${original.taskCount}`);
rule("original-archive-tasks-complete", `${original.archive}/tasks.md`, originalTasks.every((task) => task.done), "archived original SDK tasks are not 106/106 complete");
for (const [id, commit] of [
  ["technical", original.technicalCommit],
  ["governance", original.governanceCommit],
  ["synchronization", original.synchronizationCommit],
  ["merge", original.mergeCommit],
]) {
  rule(`original-${id}-binding`, `${original.archive}/technical-review-packet.md`, originalPacket.includes(commit), `archived original SDK ${id} commit binding is absent`);
}
rule("original-publication-unauthorized", `${original.archive}/technical-review-packet.md`, /Package publication\/release approved \| `NO — NOT AUTHORIZED`/.test(originalPacket), "archived original SDK package-publication restriction is absent");
rule("original-production-unauthorized", `${original.archive}/technical-review-packet.md`, /Production deployment approved \| `NO — NOT AUTHORIZED`/.test(originalPacket), "archived original SDK production restriction is absent");

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
rule("compat-verification-lifecycle", "compatibility.json", same(compatibility.verificationLifecycle?.modes, ["active", "governed", "archived"]) && compatibility.verificationLifecycle?.metadata === "verification-lifecycle.json", "verification lifecycle compatibility metadata is absent or stale");

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
const adrFiles = (await readdir(adrRoot)).filter((name) => /^\d{3}-.+\.md$/.test(name)).sort(byCodePoint);
rule("adr-count", "adr", adrFiles.length === 11, "expected exactly ADR-SDK-001 through ADR-SDK-011");
rule("adr-sequence", "adr", same(adrFiles.map((name) => name.slice(0, 3)), ["001", "002", "003", "004", "005", "006", "007", "008", "009", "010", "011"]), "ADR identifiers are missing or duplicated");
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
rule("adr-baseline", "adr/010-canonical-verification-and-scope.md", allAdrs.includes(expected.remediationBaseline) && !/94dc4fcfb267777817c0f1894b02d542670f5c79/.test(allAdrs), "ADR changed-path baseline is stale or contradictory");

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
rule("openspec-contract", relative(repositoryRoot, changeRoot), openSpec.includes(expected.contractVersion), "governed change does not remain bound to contract 1.0.0");
rule("openspec-production", relative(repositoryRoot, changeRoot), includesAll(openSpec, ["browser telemetry", "production", "transport"]), "governed change lacks explicit production/transport/browser boundaries");

const tasks = texts.get("tasks") ?? "";
const taskEntries = parseTaskChecklist(tasks);
const checkedTasks = taskEntries.filter((task) => task.done).length;
const expectedTaskCount = lifecycle.change === original.name ? original.taskCount : remediation.taskCount;
let activeProgress;
rule("task-count", "tasks.md", taskEntries.length === expectedTaskCount, `task checklist count differs from ${expectedTaskCount}`);

if (lifecycle.change === remediation.name) {
  const traceability = await safeRead(resolve(changeRoot, "adversarial-review-traceability.md"), "remediation-traceability");
  const authorizationText = texts.get("authorization") ?? "";
  const remediationEvidence = `${openSpec}\n${traceability}\n${authorizationText}`;
  rule("remediation-proposal-baseline", "active-remediation", remediationEvidence.includes(remediation.proposalBaseline), "authoritative remediation proposal baseline is absent");
  rule("remediation-traceability-commit", "active-remediation", authorizationText.includes(remediation.traceabilityCommit), "issue-traceability commit is absent from implementation authorization");
  for (let finding = 1; finding <= 12; finding += 1) {
    rule(`remediation-finding-F-${String(finding).padStart(2, "0")}`, "active-remediation", remediationEvidence.includes(`F-${String(finding).padStart(2, "0")}`), `finding F-${String(finding).padStart(2, "0")} is not represented`);
  }
  for (let issue = 20; issue <= 30; issue += 1) {
    rule(`remediation-issue-${issue}`, "active-remediation", remediationEvidence.includes(`#${issue}`) || remediationEvidence.includes(`/issues/${issue}`), `GitHub issue #${issue} is not linked`);
  }
  rule("remediation-implementation-authorization", "implementation-authorization.md", includesAll(authorizationText, [
    "Authorize implementation",
    remediation.proposalBaseline,
    remediation.traceabilityCommit,
    "version `1.0.0`",
    "package publication or production deployment",
    "final owner approval",
  ]), "bounded project-owner implementation authorization is incomplete");

  if (lifecycle.mode === "active") {
    const reviewPacket = await readOptional(resolve(changeRoot, "technical-review-packet.md"));
    activeProgress = evaluateActiveTaskProgress(taskEntries, {
      exactTechnicalCommit: /Final technical commit:\s*`[0-9a-f]{40}`/.test(reviewPacket),
      technicalReviewPacket: reviewPacket.length > 0,
    });
    failures.push(...activeProgress.failures);
  } else if (lifecycle.mode === "governed") {
    const packet = texts.get("review-packet") ?? "";
    const technicalCommit = packet.match(/Final technical commit:\s*`([0-9a-f]{40})`/)?.[1];
    for (const group of remediation.taskGroups.filter((entry) => ["implementation", "regression"].includes(entry.phase))) {
      const groupTasks = tasksInRange(taskEntries, group.taskRange);
      rule(`governed-group-${group.id}-complete`, "tasks.md", groupTasks.length > 0 && groupTasks.every((task) => task.done), `governed mode requires complete ${group.id} tasks`);
    }
    rule("governed-technical-binding", "technical-review-packet.md", Boolean(technicalCommit), "governed mode requires a full final technical commit binding");
    rule("governed-owner-decision", "technical-review-packet.md", /Project-owner.+decision.+APPROVED/is.test(packet), "governed mode requires an explicit project-owner decision");
    rule("governed-production-restriction", "technical-review-packet.md", includesAll(packet, ["Package publication/release approved | `NO — NOT AUTHORIZED`", "Production deployment approved | `NO — NOT AUTHORIZED`"]), "governed production/publication restrictions are absent");
    const mergeArchiveGroup = remediation.taskGroups.find((group) => group.phase === "merge-archive");
    const mergeArchiveStart = taskEntries.findIndex((task) => task.id === mergeArchiveGroup.taskRange.start);
    const mergeArchiveEnd = taskEntries.findIndex((task) => task.id === mergeArchiveGroup.taskRange.end);
    for (const task of taskEntries.slice(mergeArchiveStart, mergeArchiveEnd + 1)) {
      rule(`governed-task-${task.id}-pending`, "tasks.md", task.done === false, `governed mode requires ${task.id} to remain pending`);
    }
  } else {
    const packet = texts.get("review-packet") ?? "";
    rule("archived-remediation-tasks-complete", "tasks.md", taskEntries.every((task) => task.done), "archived remediation tasks are not complete");
    rule("archived-remediation-bindings", "technical-review-packet.md", /[0-9a-f]{40}/.test(packet) && /governance/i.test(packet) && /merge/i.test(packet), "archived remediation technical/governance/merge bindings are absent");
    rule("archived-remediation-restrictions", "technical-review-packet.md", includesAll(packet, ["Package publication/release approved | `NO — NOT AUTHORIZED`", "Production deployment approved | `NO — NOT AUTHORIZED`"]), "archived remediation production/publication restrictions are absent");
    const remediationRequirements = parseRequirementSet(
      texts.get("spec") ?? "",
      `${relative(repositoryRoot, changeRoot)}/specs/security-audit-sdk-core/spec.md`,
      "remediation-archive-capability",
    );
    failures.push(...remediationRequirements.failures);
    compareRequirementSubset(remediationRequirements, canonicalRequirements, {
      idPrefix: "archived-remediation-capability",
      sourceLabel: "approved archived remediation capability",
      targetFile: remediation.capability,
    });
  }
} else {
  rule("archived-original-current-tasks", "tasks.md", taskEntries.every((task) => task.done), "explicit original archived mode requires complete governed tasks");
}

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
const statusSurfaces = [docs, texts.get("review-packet") ?? "", openSpec, allAdrs].join("\n");
for (const [id, pattern] of dangerousAffirmations) {
  rule(`forbidden-claim-${id}`, "cross-artifact-prose", !pattern.test(statusSurfaces), `contradictory ${id} claim detected`);
}

if (failures.length > 0) {
  failures.sort((a, b) => `${a.file}:${a.id}`.localeCompare(`${b.file}:${b.id}`));
  process.stderr.write(`cross-artifact coherence failed (${failures.length} rule${failures.length === 1 ? "" : "s"}):\n`);
  for (const failure of failures) process.stderr.write(`[${failure.id}] ${failure.file}: ${failure.message}\n`);
  process.exitCode = 1;
} else if (lifecycle.mode === "active" && lifecycle.change === remediation.name) {
  process.stdout.write(`active remediation coherence passed: contract ${expected.contractVersion}, ${expected.catalogEventCount} catalog events, ${expected.namedEventApiCount} named APIs, ${expected.runtimeDependencyCount} runtime dependencies, ${checkedTasks}/${expectedTaskCount} tasks complete, completed groups: ${activeProgress.completedGroups.join(", ") || "none"}, next group: ${activeProgress.nextGroup ?? "none"}, governance pending\n`);
} else {
  process.stdout.write(`cross-artifact coherence passed in ${lifecycle.mode} mode for ${lifecycle.change}: contract ${expected.contractVersion}, ${expected.catalogEventCount} catalog events/${expected.namedEventApiCount} named APIs, ${expected.runtimeDependencyCount} runtime dependencies, ${checkedTasks}/${expectedTaskCount} current-change tasks complete\n`);
}

async function safeRead(path, id) {
  try {
    return await readFile(path, "utf8");
  } catch {
    rule("required-file", relative(repositoryRoot, path), false, `${id} is missing or unreadable`);
    return "";
  }
}

async function readOptional(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return "";
  }
}

function tasksInRange(taskEntries, range) {
  const start = taskEntries.findIndex((task) => task.id === range.start);
  const end = taskEntries.findIndex((task) => task.id === range.end);
  return start === -1 || end < start ? [] : taskEntries.slice(start, end + 1);
}

function parseRequirementSet(text, file, idPrefix) {
  const state = {
    file,
    idPrefix,
    records: [],
    parseFailures: [],
    requirement: undefined,
    scenario: undefined,
    fence: undefined,
  };
  const normalizedText = String(text).replaceAll("\r\n", "\n").replaceAll("\r", "\n");
  for (const line of normalizedText.split("\n")) consumeRequirementLine(state, line);
  finishRequirement(state);
  if (state.fence) structureFailure(state, "unclosed fenced block prevents deterministic requirement parsing");
  return summarizeRequirementSet(state);
}

function structureFailure(state, message) {
  state.parseFailures.push(boundedFailure(`${state.idPrefix}-requirement-structure`, state.file, message));
}

function appendRequirementLine(state, line) {
  if (!state.requirement) return;
  (state.scenario ? state.scenario.lines : state.requirement.lines).push(line);
}

function finishScenario(state) {
  const { scenario, requirement } = state;
  if (!scenario || !requirement) return;
  const body = normalizeMarkdownLines(scenario.lines);
  if (scenario.heading === "" || body === "") {
    structureFailure(state, `requirement ${requirement.heading || "<empty>"} has an empty scenario heading or body`);
  } else if (!/(?:^|\n)- \*\*WHEN\*\*/.test(body) || !/(?:^|\n)- \*\*THEN\*\*/.test(body)) {
    structureFailure(state, `scenario ${scenario.heading} under ${requirement.heading || "<empty>"} lacks exact WHEN/THEN structure`);
  }
  requirement.scenarios.push(Object.freeze({ heading: scenario.heading, body }));
  state.scenario = undefined;
}

function finishRequirement(state) {
  const { requirement } = state;
  if (!requirement) return;
  finishScenario(state);
  const body = normalizeMarkdownLines(requirement.lines);
  if (requirement.heading === "" || body === "" || requirement.scenarios.length === 0) {
    structureFailure(state, `requirement ${requirement.heading || "<empty>"} must have a heading, body, and at least one scenario`);
  }
  const scenarioHeadings = new Set();
  for (const entry of requirement.scenarios) {
    if (scenarioHeadings.has(entry.heading)) {
      structureFailure(state, `requirement ${requirement.heading || "<empty>"} duplicates scenario ${entry.heading}`);
    }
    scenarioHeadings.add(entry.heading);
  }
  state.records.push(Object.freeze({
    heading: requirement.heading,
    body,
    scenarios: Object.freeze(requirement.scenarios),
  }));
  state.requirement = undefined;
}

function consumeRequirementLine(state, line) {
  const fenceMarker = /^\s*(`{3,}|~{3,})/.exec(line);
  if (consumeFence(state, line, fenceMarker)) return;
  if (consumeRequirementHeading(state, line)) return;
  if (consumeScenarioHeading(state, line)) return;
  if (/^##\s+/.test(line) && state.requirement) {
    finishRequirement(state);
    return;
  }
  appendRequirementLine(state, line);
}

function consumeFence(state, line, fenceMarker) {
  if (state.fence) {
    appendRequirementLine(state, line);
    if (fenceMarker && fenceMarker[1][0] === state.fence.character && fenceMarker[1].length >= state.fence.length) {
      state.fence = undefined;
    }
    return true;
  }
  if (!fenceMarker) return false;
  appendRequirementLine(state, line);
  state.fence = { character: fenceMarker[1][0], length: fenceMarker[1].length };
  return true;
}

function consumeRequirementHeading(state, line) {
  const requirementMatch = /^### Requirement:(.*)$/.exec(line);
  if (requirementMatch) {
    finishRequirement(state);
    state.requirement = { heading: normalizeHeading(requirementMatch[1]), lines: [], scenarios: [] };
    return true;
  }
  if (/^###\s+Requirement\b/.test(line)) {
    structureFailure(state, `malformed requirement heading: ${line.trim().slice(0, 120)}`);
    return true;
  }
  return false;
}

function consumeScenarioHeading(state, line) {
  const scenarioMatch = /^#### Scenario:(.*)$/.exec(line);
  if (scenarioMatch) {
    if (!state.requirement) {
      structureFailure(state, `scenario appears outside a requirement: ${line.trim().slice(0, 120)}`);
      return true;
    }
    finishScenario(state);
    state.scenario = { heading: normalizeHeading(scenarioMatch[1]), lines: [] };
    return true;
  }
  if (/^####\s+Scenario\b/.test(line)) {
    structureFailure(state, `malformed scenario heading: ${line.trim().slice(0, 120)}`);
    return true;
  }
  return false;
}

function summarizeRequirementSet(state) {
  const { records, parseFailures } = state;
  const occurrenceCounts = new Map();
  for (const record of records) occurrenceCounts.set(record.heading, (occurrenceCounts.get(record.heading) ?? 0) + 1);
  const countedRecords = records.map((record) => Object.freeze({
    ...record,
    occurrenceCount: occurrenceCounts.get(record.heading),
  }));
  const byHeading = new Map();
  for (const record of countedRecords) {
    const occurrences = byHeading.get(record.heading) ?? [];
    occurrences.push(record);
    byHeading.set(record.heading, occurrences);
  }
  if (countedRecords.length === 0) {
    parseFailures.push(boundedFailure(`${state.idPrefix}-requirement-set`, state.file, "requirement set is empty or unparsable"));
  }
  for (const [heading, occurrences] of byHeading) {
    if (occurrences.length !== 1) {
      parseFailures.push(boundedFailure(`${state.idPrefix}-requirement-duplicate`, state.file, `requirement ${heading || "<empty>"} occurs ${occurrences.length} times`));
    }
  }
  return Object.freeze({
    records: Object.freeze(countedRecords),
    byHeading,
    failures: Object.freeze(parseFailures),
  });
}

function compareRequirementSubset(source, target, options) {
  if (source.records.length === 0 || target.records.length === 0) return;
  for (const [heading, sourceOccurrences] of source.byHeading) {
    if (sourceOccurrences.length !== 1) continue;
    const targetOccurrences = target.byHeading.get(heading) ?? [];
    if (targetOccurrences.length === 0) {
      failures.push(boundedFailure(`${options.idPrefix}-requirement-missing`, options.targetFile, `${options.sourceLabel} requirement ${heading} is absent`));
      continue;
    }
    if (targetOccurrences.length !== 1) {
      failures.push(boundedFailure(`${options.idPrefix}-requirement-duplicate`, options.targetFile, `${options.sourceLabel} requirement ${heading} occurs ${targetOccurrences.length} times`));
      continue;
    }
    const sourceRecord = sourceOccurrences[0];
    const targetRecord = targetOccurrences[0];
    if (sourceRecord.body !== targetRecord.body || !same(sourceRecord.scenarios, targetRecord.scenarios)) {
      failures.push(boundedFailure(`${options.idPrefix}-requirement-modified`, options.targetFile, `${options.sourceLabel} requirement ${heading} has modified body or scenarios`));
    }
  }
}

function normalizeHeading(value) {
  return String(value).trim().replace(/[ \t]+/g, " ");
}

function normalizeMarkdownLines(lines) {
  return lines
    .map((line) => line.trim().replace(/[ \t]+/g, " "))
    .filter((line) => line !== "")
    .join("\n");
}

async function pathExists(path) {
  try {
    await readdir(path);
    return true;
  } catch {
    return false;
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
