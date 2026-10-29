import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { command, sha256 } from "../lib/io.mjs";
import { validateProbeInventory } from "../lib/import-closure.mjs";
import { ROLE_SCRIPTS } from "../lib/plan.mjs";
import { validateExpectations } from "../chains/expectations.mjs";
import { PROBE_FILES } from "../chains/files.mjs";
import { phaseCallPlan } from "../chains/call-plan.mjs";
import { generateWorkloadDefinition } from "../chains/workload.mjs";

const HARNESS = dirname(dirname(fileURLToPath(import.meta.url)));
const REPO = command({ program: "git", args: ["rev-parse", "--show-toplevel"], cwd: HARNESS }).trim();
const EXPECTATIONS_PATH = join(HARNESS, "expectations/chains.v1.json");
const source = (path) => readFileSync(join(HARNESS, path), "utf8");

const CITATION_SUBSTRINGS = {
  "R-01": [
    'kind: "found",',
    "body: row.body,",
  ],
  "R-02": [
    'const candidate = kind === "platform" || kind === "tenantless" ? { kind } : { kind, tenantId: tenant?.effective_tenant_id };',
    "const [kind, tenant] = scopeKey(scope);",
  ],
  "R-03": [
    'export function observedSource(input: ContextValue<"source">): ObservedSourceContext {',
    "putWithoutThrowing(port, prepared.scope, prepared.record)",
  ],
  "R-04": [
    "const scope = storageScopeOf(record.tenant);",
    "const [kind, tenant] = scopeKey(scope);",
  ],
  "R-05": [
    'type: "anonymous",',
    'authenticationFailed(input: WithOperationHandle<NamedAuditEventInputMap["authenticationFailed"]>): Promise<AuditResult<AuditDeliveryResult>> {',
  ],
  "R-06": [
    "export function validateNoProhibitedData(value: unknown): AuditResult<void> {",
  ],
  "R-07": [
    'export function sessionEvidence(input: ContextValue<"session">): SessionEvidenceContext {',
  ],
  "R-08": [
    "const timestampResult = normalizedInput.event?.timestamp === undefined ? nowIso(config) : { ok: true as const, value: normalizedInput.event.timestamp };",
  ],
  "R-09": [
    "ON CONFLICT (scope_kind, scope_tenant, event_id) DO NOTHING",
  ],
  "R-10": [
    "const response = await fetch(`${origin}${request.path}`, {",
  ],
  "R-11": [
    "export type DeliveryShutdownReport = Readonly<{",
    "ON CONFLICT (scope_kind, scope_tenant, event_id) DO NOTHING",
  ],
};

const BRACE_DELTA = { "{": 1, "}": -1 };

function balancedSpanAfter({ text, marker, startAfter }) {
  const markerIdx = text.indexOf(marker);
  assert(markerIdx !== -1, `could not find ${marker}`);
  let searchStart = markerIdx;
  if (startAfter) {
    searchStart = text.indexOf(startAfter, markerIdx);
    assert(searchStart !== -1, `could not find ${startAfter} after ${marker}`);
  }
  const braceStart = text.indexOf("{", searchStart);
  assert(braceStart !== -1, `could not find opening brace after ${marker}`);
  let depth = 0;
  for (let i = braceStart; i < text.length; i += 1) {
    depth += BRACE_DELTA[text[i]] ?? 0;
    if (depth === 0) {
      return text.slice(braceStart, i + 1);
    }
  }
  assert.fail(`could not find balanced closing brace after ${marker}`);
}

const FROZEN_V1 = JSON.parse(readFileSync(EXPECTATIONS_PATH, "utf8"));

test("the frozen chains.v1.json is byte-identical and retains its hash", () => {
  const bytes = readFileSync(EXPECTATIONS_PATH);
  const hash = sha256(bytes);
  assert.equal(hash, "3483be7f48b3509c2f347bb2523cdbbfb49c46676f74996260f535aeffed5695");
});

test("chains.v1.json validates, and mutating it is refused", () => {
  assert.equal(validateExpectations(structuredClone(FROZEN_V1)).version, 1);
  const mutations = [
    (val) => { val.version = 2; },
    (val) => { val.version = "1"; },
    (val) => { val.contract_version = "2.0.0"; },
    (val) => { val.ticket = 999; },
    (val) => { val.cases.pop(); },
    (val) => { val.cases[0].basis = []; },
    (val) => { val.cases[2].case_id = "R-09"; },
    (val) => { val.workload.seed = 0; },
    (val) => { val.clock.step_ms = 0; },
    (val) => { val.phases[0].composition.max_attempts = 0; },
    (val) => { delete val.phases[0].cycles; },
    (val) => { val.phases[0].cycles = 0; },
    (val) => { val.phases[0].unknown_key = true; },
    (val) => { val.planned_call_budget.total = 791; },
    (val) => { val.planned_call_budget.processes.chains_small = 71; },
    (val) => { val.phases[0].occurrences = 0; },
    (val) => { val.phases[0].distinct_occurrences = 0; },
    (val) => { val.scenarios.unknown_scenario = []; },
    (val) => { val.phases[0].schedule[0] = "unknown_scenario"; },
    (val) => { val.composition.capacity = 100_001; },
    (val) => { val.composition.max_attempts = 1001; },
    (val) => { val.composition.exchange_timeout_ms = 60_001; },
    (val) => { val.composition.max_delay_ms = val.composition.base_delay_ms - 1; },
    (val) => { val.planned_call_budget = { malformed: true }; },
    (val) => { val.unknown_top_level = true; },
    (val) => { delete val.ground_truth.chains_small.chains; },
  ];

  for (const mutate of mutations) {
    const value = structuredClone(FROZEN_V1);
    mutate(value);
    assert.throws(() => validateExpectations(value), undefined, mutate.toString());
  }
});

test("the generator reproduces the frozen ground truth byte-for-byte", () => {
  const seed = FROZEN_V1.workload.seed;
  const small = generateWorkloadDefinition({
    seed: seed + FROZEN_V1.phases[0].seed_offset,
    chainCount: FROZEN_V1.phases[0].chain_count,
    tenantCount: FROZEN_V1.phases[0].tenant_count,
    failedCount: FROZEN_V1.phases[0].failed_count,
    clockStart: FROZEN_V1.clock.start,
    clockStepMs: FROZEN_V1.clock.step_ms,
  });
  const volume = generateWorkloadDefinition({
    seed: seed + FROZEN_V1.phases[1].seed_offset,
    chainCount: FROZEN_V1.phases[1].chain_count,
    tenantCount: FROZEN_V1.phases[1].tenant_count,
    failedCount: FROZEN_V1.phases[1].failed_count,
    clockStart: FROZEN_V1.clock.start,
    clockStepMs: FROZEN_V1.clock.step_ms,
  });

  const generatedGroundTruth = {
    chains_small: small.groundTruth,
    chains_volume: volume.groundTruth,
  };

  assert.deepEqual(generatedGroundTruth, FROZEN_V1.ground_truth);
});

test("the budget is derived from the call plan", () => {
  let calculatedTotal = 0;
  for (const phase of FROZEN_V1.phases) {
    const plan = phaseCallPlan(phase, FROZEN_V1.workload.seed);
    const expectedBudget = FROZEN_V1.planned_call_budget.processes[phase.name];
    assert.equal(plan.length, expectedBudget, `budget mismatch for phase ${phase.name}`);
    calculatedTotal += plan.length;
  }
  assert.equal(calculatedTotal, FROZEN_V1.planned_call_budget.total);
});

test("every basis citation in chains.v1.json names an existing line containing the cited rule substring", () => {
  assert.equal(FROZEN_V1.base, "efdf42a7348d08e475c2aa83277b2fbd6b124a63");
  const fileCache = new Map();
  const getFile = (path) => {
    if (!fileCache.has(path)) {
      fileCache.set(path, command({ program: "git", args: ["show", `${FROZEN_V1.base}:${path}`], cwd: REPO }));
    }
    return fileCache.get(path);
  };

  for (const entry of FROZEN_V1.cases) {
    const requiredSubstrings = CITATION_SUBSTRINGS[entry.case_id];
    assert(requiredSubstrings, `missing citation substrings definition for ${entry.case_id}`);
    assert.equal(entry.basis.length, requiredSubstrings.length, `${entry.case_id} basis length mismatch`);

    for (let i = 0; i < entry.basis.length; i += 1) {
      const citation = entry.basis[i];
      const substring = requiredSubstrings[i];
      const [path, line] = citation.split(":");
      const fileContent = getFile(path);
      const lines = fileContent.split("\n");
      const lineNumber = Number.parseInt(line, 10);
      assert(lineNumber >= 1 && lineNumber <= lines.length, `line number ${line} out of range in ${path}`);
      const actualLine = lines[lineNumber - 1];
      assert(actualLine.includes(substring), `citation ${citation} missing expected substring "${substring}", got: "${actualLine}"`);
    }
  }
});

test("each role's import closure is inside the declared inventory, and a missing module is caught", () => {
  const closure = validateProbeInventory({
    repo: REPO,
    prefix: "openspec/changes/verify-fraud-evidence-delivery/harness",
    probeDirectory: "chains",
    files: PROBE_FILES,
    roleScripts: Object.values(ROLE_SCRIPTS),
  });
  assert(closure.length > 0, "closure must not be empty");
});

test("kit packages are imported only by the role processes, each only its own", () => {
  const kitImports = (path) => [...source(path).matchAll(/from "(@bloodtrail\/[^"]+)"/g)].map((match) => match[1]);
  assert.deepEqual(kitImports("chains/sender-process.mjs"), ["@bloodtrail/security-audit-sdk-core", "@bloodtrail/security-audit-sdk-node"]);
  assert.deepEqual(kitImports("chains/ingress-process.mjs"), ["@bloodtrail/security-audit-collector"]);
  const orchestration = [
    "chains/run-chains.mjs",
    "chains/session.mjs",
    "chains/evaluate.mjs",
    "chains/observers-chain.mjs",
    "chains/observers-source.mjs",
    "chains/observers-identity.mjs",
    "chains/observer-predicates.mjs",
    "chains/expectations.mjs",
    "chains/workload.mjs",
    "chains/controls.mjs",
    "chains/call-plan.mjs",
    "chains/sender-phases.mjs",
    "chains/ingress-role.mjs",
    "chains/observations.mjs",
    "chains/reconstruct.mjs",
  ];
  for (const path of orchestration) assert.deepEqual(kitImports(path), [], `${path} must not import kit code`);
});

test("each role imports the role guard first, so it is installed before any kit module evaluates", () => {
  const senderSrc = readFileSync(join(HARNESS, "chains/sender-process.mjs"), "utf8");
  const ingressSrc = readFileSync(join(HARNESS, "chains/ingress-process.mjs"), "utf8");

  const firstSenderImport = senderSrc.match(/^\s*import\s+[^;]+from\s+["']([^"']+)["']/m)?.[1];
  const firstIngressImport = ingressSrc.match(/^\s*import\s+[^;]+from\s+["']([^"']+)["']/m)?.[1];

  assert.equal(firstSenderImport, "../lib/role-guard.mjs");
  assert.equal(firstIngressImport, "../lib/role-guard.mjs");
});

test("the approval-gated entry only delegates to the shared runner", () => {
  const entrySrc = readFileSync(join(HARNESS, "chains/run-chains.mjs"), "utf8");
  assert(entrySrc.includes("runProbe"), "entry must delegate to runProbe");
  assert(entrySrc.includes("probe: \"S2-chains\""), "entry must specify S2-chains");
  assert(entrySrc.includes("ticket: 840"), "entry must specify ticket 840");
  assert(entrySrc.includes("expectationsVersion: 1"), "entry must specify version 1");
});

test("Q219: testChainsSenderSdk configuration object literal matches lib/sender-role.mjs byte-for-byte", () => {
  const senderRoleText = readFileSync(join(HARNESS, "lib/sender-role.mjs"), "utf8");
  const fakesText = readFileSync(join(HARNESS, "tests/chains-fakes.mjs"), "utf8");

  const senderRoleConfig = balancedSpanAfter({ text: senderRoleText, marker: "sdkNode.createNodeSecurityAuditSdk" });
  const testSenderConfig = balancedSpanAfter({ text: fakesText, marker: "sdkNode.createNodeSecurityAuditSdk" });
  assert.equal(testSenderConfig, senderRoleConfig);
});
