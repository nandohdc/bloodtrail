import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  EVENT_CATALOG, EVENT_METHODS,
  anonymousActor, authenticatedPrincipal, authenticationEvidence, authoritativeActor,
  authoritativeResource, authoritativeSubject, authoritativeTenant, authorizationEvidence,
  claimedActor, claimedTenant, credentialReference, dataPolicyContext, delegationContext,
  destinationContext, integrityContext, observedSource, registeredEnrichmentExtension,
  riskContext, serviceWorkload, sessionEvidence, validateSecurityAuditEvent,
  type AuditDeliveryResult, type AuditOperationHandle, type AuditResult,
  type EventMethodName, type SecurityAuditEvent,
} from "../dist/index.js";
import { createConformanceSdk, type ConformanceHarnessContext } from "./conformance-harness.js";

type CatalogEntry = (typeof EVENT_CATALOG)[number];
type EventFields = SecurityAuditEvent["event"];
type Outcome = EventFields["outcome"];
type CommitState = NonNullable<EventFields["commit_state"]>;
type Phase = EventFields["lifecycle_phase"];
type Failure = Extract<AuditResult<never>, { ok: false }>;
interface Transition {
  readonly commit: CommitState;
  readonly advance: (handle: AuditOperationHandle) => void;
  readonly preferredDefaults: readonly Outcome[];
}
interface MatrixRow {
  readonly definition: CatalogEntry;
  readonly phase: Phase;
  readonly outcome: Outcome;
  readonly transition: Transition;
}
interface NegativeFixture {
  readonly name: string;
  readonly expected_errors: readonly string[];
  readonly event: SecurityAuditEvent;
}

const contractRoot = resolve(process.cwd(), "../../contracts/security-audit");
const fixtures: readonly SecurityAuditEvent[] = JSON.parse(await readFile(
  resolve(contractRoot, "examples/positive/all-events.json"), "utf8",
));
const negatives: readonly NegativeFixture[] = JSON.parse(await readFile(
  resolve(contractRoot, "examples/negative/all-negative.json"), "utf8",
));
const successFailure: Failure = {
  ok: false, error: { code: "PREMATURE_SUCCESS", category: "validation", path: "/event/commit_state" },
};
const denialFailure: Failure = {
  ok: false, error: { code: "SDK_SEMANTIC_VALIDATION_FAILED", category: "validation", path: "/event/outcome" },
};
const operationFailure: Failure = {
  ok: false, error: { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" },
};
const transitions: readonly Transition[] = [
  { commit: "committed", advance: (handle) => { assert.ok(handle.markCommitted().ok); }, preferredDefaults: ["success"] },
  { commit: "not_committed", advance: (handle) => { assert.ok(handle.markNotCommitted().ok); }, preferredDefaults: ["failure"] },
  { commit: "partially_committed", advance: (handle) => { assert.ok(handle.markPartiallyCommitted().ok); }, preferredDefaults: ["partial"] },
  { commit: "compensated", advance: (handle) => {
    assert.ok(handle.markCommitted().ok);
    assert.ok(handle.markCompensated().ok);
  }, preferredDefaults: ["partial"] },
];
const cancelledTransition: Transition = {
  commit: "not_committed", advance: (handle) => { assert.ok(handle.markCancelled().ok); }, preferredDefaults: ["cancelled", "failure"],
};
const terminalTransitions = [...transitions, cancelledTransition];
const transactionBound = EVENT_CATALOG.filter((entry) => entry.commit.some((state) => state === "committed"));
const matrix: readonly MatrixRow[] = transactionBound.flatMap((definition) =>
  definition.phase.flatMap((phase) => definition.outcomes.flatMap((outcome) =>
    transitions.filter((transition) => (definition.commit as readonly string[]).includes(transition.commit))
      .map((transition) => ({ definition, phase, outcome, transition })),
  )),
);
const contextConstructors = {
  actor: fixtureActor, tenant: fixtureTenant, subject: authoritativeSubject,
  authenticated_principal: authenticatedPrincipal, authorization: authorizationEvidence,
  authentication: authenticationEvidence, delegation: delegationContext, credential: credentialReference,
  initiator: serviceWorkload, session: sessionEvidence, source: observedSource, destination: destinationContext,
  resource: authoritativeResource, risk: riskContext, data: dataPolicyContext, integrity: integrityContext,
  extensions: registeredEnrichmentExtension,
};
const completePaths = ["emit", "redeliver", "validateSecurityAuditEvent"] as const;
type CompletePath = (typeof completePaths)[number];

function fixtureActor(actor: SecurityAuditEvent["actor"]) {
  if (actor.type === "anonymous") return anonymousActor(actor.provenance?.source);
  if (actor.provenance?.trust_level === "client_claim") return claimedActor(actor);
  return authoritativeActor(actor);
}

function fixtureTenant(tenant: SecurityAuditEvent["tenant"]) {
  const { claimed_tenant_id: _claim, ...authority } = tenant;
  return authoritativeTenant(authority as Parameters<typeof authoritativeTenant>[0]);
}

function fixtureFor(definition: CatalogEntry): SecurityAuditEvent {
  const fixture = fixtures.find((candidate) => candidate.event.name === definition.name);
  assert.ok(fixture, definition.name);
  return fixture;
}

function methodFor(definition: CatalogEntry): EventMethodName {
  const method = EVENT_METHODS.find((candidate) => candidate.name === definition.name);
  assert.ok(method, definition.name);
  return method.method;
}

function rowName(row: MatrixRow): string {
  return `${methodFor(row.definition)}/${row.phase}/${row.outcome}/${row.transition.commit}`;
}

/** Independent oracle: classify only the two decided relations, not operation state. */
function expectedFailure(row: MatrixRow): Failure | undefined {
  if (row.outcome === "denied" && row.transition.commit !== "not_committed") return denialFailure;
  if (row.outcome !== "success") return undefined;
  if (row.phase === "completed" && row.transition.commit !== "committed") return successFailure;
  if (row.phase === "compensating" && row.transition.commit !== "compensated") return successFailure;
  return undefined;
}

function alignedFixture(fixture: SecurityAuditEvent, fields: Partial<EventFields>): SecurityAuditEvent {
  const event = structuredClone(fixture);
  assert.ok(event.authorization);
  const classification = { ...event.event, ...fields };
  return { ...event, event: classification, authorization: {
    ...event.authorization, decision: classification.outcome === "denied" ? "deny" : "allow",
  } };
}

/** Reuse the exported constructors: raw fixture objects never grant named-call authority. */
function namedInput(row: MatrixRow): Record<string, unknown> {
  const fixture = alignedFixture(fixtureFor(row.definition), { lifecycle_phase: row.phase, outcome: row.outcome });
  const { commit_state: _commit, id: _id, ...fields } = fixture.event;
  const input: Record<string, unknown> = { event: fields, request: fixture.request, correlation: fixture.correlation };
  for (const [key, constructor] of Object.entries(contextConstructors)) {
    const value = fixture[key as keyof typeof contextConstructors];
    if (value !== undefined) input[key] = constructor(value as never);
  }
  if (fixture.tenant.claimed_tenant_id !== undefined) input.claimedTenant = claimedTenant(fixture.tenant.claimed_tenant_id);
  return input;
}

function operationFor(row: MatrixRow, context: ConformanceHarnessContext): AuditOperationHandle {
  const operation = context.sdk.beginOperation({ boundEvent: methodFor(row.definition) });
  assert.ok(operation.ok);
  row.transition.advance(operation.value);
  return operation.value;
}

async function assertNamedRow(row: MatrixRow, omitOutcome = false): Promise<void> {
  const context = createConformanceSdk();
  const input = namedInput(row);
  if (omitOutcome) delete (input.event as Record<string, unknown>).outcome;
  const operation = operationFor(row, context);
  const call = context.sdk[methodFor(row.definition)] as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>;
  const result = await call.call(context.sdk, { ...input, operation });
  const expected = expectedFailure(row);
  if (expected) {
    assert.deepEqual(result, expected);
    assert.equal(context.sink.events.length, 0);
    return;
  }
  assert.ok(result.ok, JSON.stringify(result));
  assert.equal(context.sink.events.length, 1);
  const captured = context.sink.events[0]!;
  assert.equal(captured.event.outcome, row.outcome);
  assert.equal(captured.event.commit_state, row.transition.commit);
  assert.ok(validateSecurityAuditEvent(captured).ok);
}

async function completeResult(event: SecurityAuditEvent, path: CompletePath, context: ConformanceHarnessContext) {
  if (path === "validateSecurityAuditEvent") return validateSecurityAuditEvent(event);
  return context.sdk[path](event);
}

async function assertCompleteRefusal(event: SecurityAuditEvent, expected: Failure): Promise<void> {
  for (const path of completePaths) {
    const context = createConformanceSdk();
    assert.deepEqual(await completeResult(event, path, context), expected, path);
    assert.equal(context.sink.events.length, 0, path);
  }
}

async function assertCompleteAcceptance(event: SecurityAuditEvent): Promise<void> {
  for (const path of completePaths) {
    const context = createConformanceSdk();
    const result = await completeResult(event, path, context);
    assert.ok(result.ok, `${path}: ${JSON.stringify(result)}`);
    assert.equal(context.sink.events.length, path === "validateSecurityAuditEvent" ? 0 : 1);
    for (const captured of context.sink.events) assert.deepEqual(captured, event);
  }
}

function definitionFor(method: EventMethodName): CatalogEntry {
  const binding = EVENT_METHODS.find((candidate) => candidate.method === method);
  assert.ok(binding);
  const definition = EVENT_CATALOG.find((candidate) => candidate.name === binding.name);
  assert.ok(definition);
  return definition;
}

function controlRow(method: EventMethodName, outcome: Outcome, commit: CommitState): MatrixRow {
  const definition = definitionFor(method);
  const row = matrix.find((candidate) => candidate.definition === definition
    && candidate.phase === "completed" && candidate.outcome === outcome && candidate.transition.commit === commit);
  assert.ok(row, `${method}/${outcome}/${commit}`);
  return row;
}

test("catalog-derived matrix: 15 events, 141 unique rows = 24 success refusals + 21 denial refusals + 96 accepted", () => {
  assert.equal(transactionBound.length, 15);
  assert.equal(matrix.length, 141);
  assert.equal(new Set(matrix.map(rowName)).size, 141);
  assert.equal(matrix.filter((row) => expectedFailure(row) === successFailure).length, 24);
  assert.equal(matrix.filter((row) => expectedFailure(row) === denialFailure).length, 21);
  assert.equal(matrix.filter((row) => expectedFailure(row) === undefined).length, 96);
});

for (const row of matrix) test(`outcome/commit matrix ${rowName(row)}`, () => assertNamedRow(row));

for (const definition of transactionBound) {
  for (const [outcome, commit_state, expected] of [
    ["success", "not_committed", successFailure], ["denied", "committed", denialFailure],
  ] as const) {
    test(`${methodFor(definition)}: complete ${outcome}/${commit_state} refused on all three paths, including old redelivery`, async () => {
      await assertCompleteRefusal(alignedFixture(fixtureFor(definition), { outcome, commit_state }), expected);
    });
  }
}

const issueControls = [
  ["denied", "committed"], ["success", "not_committed"], ["failure", "committed"],
  ["denied", "not_committed"], ["failure", "not_committed"],
] as const;
for (const [outcome, commit] of issueControls) {
  test(`mfaRemoved issue control ${outcome}/${commit}`, () => assertNamedRow(controlRow("mfaRemoved", outcome, commit)));
}
const unjudgedControls = [
  ["mfaRemoved", "failure", "committed"], ["sensitiveResourceModified", "partial", "not_committed"],
  ["sensitiveDataExported", "cancelled", "partially_committed"],
] as const;
for (const [method, outcome, commit] of unjudgedControls) {
  test(`unjudged ${method}/${outcome}/${commit}`, () => assertNamedRow(controlRow(method, outcome, commit)));
}

const defaultRows: readonly MatrixRow[] = transactionBound.flatMap((definition) => terminalTransitions
  .filter((transition) => (definition.commit as readonly string[]).includes(transition.commit))
  .map((transition) => ({ definition, phase: definition.phase[0], transition,
    outcome: transition.preferredDefaults.find((outcome) => (definition.outcomes as readonly Outcome[]).includes(outcome))
      ?? definition.outcomes[0] })),
);
test("terminal default controls span every sanctioned transition including cancellation", () => {
  assert.equal(defaultRows.length, 51);
  for (const row of defaultRows) assert.equal(expectedFailure(row), undefined, rowName(row));
  for (const transition of terminalTransitions) assert.ok(defaultRows.some((row) => row.transition === transition));
});
for (const row of defaultRows) {
  test(`derived default ${rowName(row)}/${row.transition === cancelledTransition ? "markCancelled" : "terminal"}`, () => assertNamedRow(row, true));
}

for (const pending of [false, true]) {
  test(`${pending ? "pending" : "absent"} handle success retains /operation/state`, async () => {
    const row = controlRow("mfaRemoved", "success", "committed");
    const context = createConformanceSdk();
    const input = namedInput(row);
    if (pending) {
      const operation = context.sdk.beginOperation({ boundEvent: "mfaRemoved" });
      assert.ok(operation.ok);
      input.operation = operation.value;
    }
    assert.deepEqual(await context.sdk.mfaRemoved(input as never), operationFailure);
    assert.equal(context.sink.events.length, 0);
  });
}

test("completed not_applicable and unrestricted attempted success stay accepted", async () => {
  const completed = fixtureFor(definitionFor("authenticationSucceeded"));
  assert.equal(completed.event.commit_state, "not_applicable");
  assert.equal(completed.event.lifecycle_phase, "completed");
  await assertCompleteAcceptance(completed);
  const attempted = fixtureFor(definitionFor("accountRegistrationAttempted"));
  assert.equal(attempted.event.lifecycle_phase, "attempted");
  assert.equal(attempted.event.commit_state, "not_started");
  await assertCompleteAcceptance(attempted);
});

test("compensating compensated success remains accepted", async () => {
  const fixture = fixtureFor(definitionFor("sensitiveResourceModified"));
  assert.equal(fixture.event.lifecycle_phase, "compensating");
  assert.equal(fixture.event.commit_state, "compensated");
  await assertCompleteAcceptance(fixture);
});

const nonCommittingDenied = EVENT_CATALOG.filter((definition) => definition.outcomes.some((outcome) => outcome === "denied"))
  .flatMap((definition) => definition.phase.flatMap((phase) => definition.commit
    .filter((commit) => ["not_committed", "not_started", "not_applicable", "unknown"].includes(commit))
    .map((commit_state) => alignedFixture(fixtureFor(definition), { outcome: "denied", lifecycle_phase: phase, commit_state })),
  ));
test("untouched denial controls cover every catalog-permitted non-committing state", () => {
  assert.deepEqual([...new Set(nonCommittingDenied.map((event) => event.event.commit_state))].sort(),
    ["not_applicable", "not_committed", "not_started", "unknown"]);
});
for (const event of nonCommittingDenied) {
  test(`untouched denied ${event.event.name}/${event.event.lifecycle_phase}/${event.event.commit_state}`, () => assertCompleteAcceptance(event));
}

test("approved authorization-outcome-conflation keeps its exact contract diagnostic before denial", async () => {
  const fixture = negatives.find((candidate) => candidate.name === "authorization-outcome-conflation");
  assert.ok(fixture);
  await assertCompleteRefusal(fixture.event, {
    ok: false, error: { code: "AUTHORIZATION_OUTCOME_CONFLICT", category: "validation", path: "/authorization/decision" },
  });
});

test("deny + success + not_committed returns PREMATURE_SUCCESS before authorization on all paths", async () => {
  const row = controlRow("mfaRemoved", "success", "not_committed");
  const fixture = alignedFixture(fixtureFor(row.definition), { outcome: "success", commit_state: "not_committed" });
  const event: SecurityAuditEvent = { ...fixture, authorization: { ...fixture.authorization!, decision: "deny" } };
  await assertCompleteRefusal(event, successFailure);
  const context = createConformanceSdk();
  const input = namedInput(row);
  input.authorization = authorizationEvidence(event.authorization!);
  assert.deepEqual(await context.sdk.mfaRemoved({ ...input, operation: operationFor(row, context) } as never), successFailure);
  assert.equal(context.sink.events.length, 0);
});

test("derived-field provenance beats SDK-only denial after otherwise valid authorization", async () => {
  const fixture = negatives.find((candidate) => candidate.name === "derived-from-missing");
  assert.ok(fixture);
  const event = alignedFixture(fixture.event, { outcome: "denied", commit_state: "committed" });
  await assertCompleteRefusal(event, {
    ok: false, error: { code: "DERIVED_FROM_MISSING", category: "validation", path: "/risk/model/provenance/derived_from" },
  });
});

test("every approved positive validates and every approved negative retains its original first code", () => {
  assert.equal(fixtures.length, EVENT_CATALOG.length);
  assert.ok(negatives.length > 0);
  for (const fixture of fixtures) assert.ok(validateSecurityAuditEvent(fixture).ok, fixture.event.name);
  for (const fixture of negatives) {
    const result = validateSecurityAuditEvent(fixture.event);
    assert.equal(result.ok, false, fixture.name);
    if (!result.ok) assert.equal(result.error.code, fixture.expected_errors[0], fixture.name);
  }
});
