import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  EVENT_CATALOG,
  EVENT_METHODS,
  anonymousActor,
  authenticatedPrincipal,
  authenticationEvidence,
  authoritativeActor,
  authoritativeResource,
  authoritativeSubject,
  authoritativeTenant,
  authorizationEvidence,
  claimedActor,
  claimedTenant,
  credentialReference,
  dataPolicyContext,
  delegationContext,
  destinationContext,
  integrityContext,
  observedSource,
  registeredEnrichmentExtension,
  riskContext,
  serviceWorkload,
  sessionEvidence,
  type AuditDeliveryResult,
  type AuditOperationHandle,
  type AuditResult,
  type EventMethodName,
  type SecurityAuditEvent,
} from "../dist/index.js";
import {
  assertValidConformanceRow,
  createConformanceSdk,
  type ConformanceHarnessContext,
} from "./conformance-harness.js";

type CatalogEntry = (typeof EVENT_CATALOG)[number];
type Outcome = SecurityAuditEvent["event"]["outcome"];
type NonSuccessOutcome = "failure" | "denied" | "cancelled" | "partial";
interface EventCase {
  readonly definition: CatalogEntry;
  readonly method: EventMethodName;
  readonly fixture: SecurityAuditEvent;
  readonly outcome: Outcome;
}

const fixtures: readonly SecurityAuditEvent[] = JSON.parse(await readFile(
  resolve(process.cwd(), "../../contracts/security-audit/examples/positive/all-events.json"), "utf8",
));
const contextConstructors = {
  actor: fixtureActor,
  tenant: fixtureTenant,
  subject: authoritativeSubject,
  authenticated_principal: authenticatedPrincipal,
  authorization: authorizationEvidence,
  authentication: authenticationEvidence,
  delegation: delegationContext,
  credential: credentialReference,
  initiator: serviceWorkload,
  session: sessionEvidence,
  source: observedSource,
  destination: destinationContext,
  resource: authoritativeResource,
  risk: riskContext,
  data: dataPolicyContext,
  integrity: integrityContext,
  extensions: registeredEnrichmentExtension,
};
const transitions: Record<NonSuccessOutcome, {
  readonly advance: (handle: AuditOperationHandle) => ReturnType<AuditOperationHandle["markNotCommitted"]>;
  readonly commitState: SecurityAuditEvent["event"]["commit_state"];
}> = {
  failure: { advance: (handle) => handle.markNotCommitted(), commitState: "not_committed" },
  denied: { advance: (handle) => handle.markNotCommitted(), commitState: "not_committed" },
  cancelled: { advance: (handle) => handle.markCancelled(), commitState: "not_committed" },
  partial: { advance: (handle) => handle.markPartiallyCommitted(), commitState: "partially_committed" },
};
const transactionBound = EVENT_CATALOG.filter((entry) => entry.commit.some((value) => value === "committed"));
const nonSuccessCases = transactionBound.flatMap((definition) =>
  definition.outcomes.filter((outcome) => outcome !== "success").map((outcome) => eventCase(definition, outcome)),
);

function fixtureActor(actor: NonNullable<SecurityAuditEvent["actor"]>) {
  if (actor.type === "anonymous") return anonymousActor(actor.provenance?.source);
  if (actor.provenance?.trust_level === "client_claim") return claimedActor(actor);
  return authoritativeActor(actor);
}

function fixtureTenant(tenant: SecurityAuditEvent["tenant"]) {
  const { claimed_tenant_id: _claim, ...authority } = tenant;
  return authoritativeTenant(authority as Parameters<typeof authoritativeTenant>[0]);
}

function eventCase(definition: CatalogEntry, outcome: Outcome): EventCase {
  const fixture = fixtures.find((candidate) => candidate.event.name === definition.name);
  const method = EVENT_METHODS.find((candidate) => candidate.name === definition.name);
  assert.ok(fixture, `missing fixture for ${definition.name}`);
  assert.ok(method, `missing method for ${definition.name}`);
  return { definition, fixture, method: method.method, outcome };
}

/** Brand only fixture context, leaving commit state and operation absent. */
function evidenceFreeInput(row: EventCase): Record<string, unknown> {
  const { fixture, outcome } = row;
  const input: Record<string, unknown> = {
    event: { lifecycle_phase: fixture.event.lifecycle_phase, outcome,
      outcome_reason: fixture.event.outcome_reason,
      timestamp: fixture.event.timestamp, observed_at: fixture.event.observed_at },
    request: fixture.request,
    correlation: fixture.correlation,
  };
  for (const [key, constructor] of Object.entries(contextConstructors)) {
    const value = fixture[key as keyof typeof contextConstructors];
    if (value !== undefined) input[key] = constructor(value as never);
  }
  const claim = fixture.tenant.claimed_tenant_id;
  if (claim !== undefined) input.claimedTenant = claimedTenant(claim);
  if (outcome === "denied") {
    assert.ok(fixture.authorization);
    input.authorization = authorizationEvidence({ ...fixture.authorization, decision: "deny" });
  }
  return input;
}

async function assertEvidenceRefused(row: EventCase): Promise<void> {
  const { sdk, sink } = createConformanceSdk();
  const call = sdk[row.method] as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>;
  const result = await call.call(sdk, evidenceFreeInput(row));
  assert.deepEqual(result, {
    ok: false,
    error: { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" },
  }, `${row.method}: ${row.outcome}`);
  assert.equal(sink.events.length, 0);
}

function transitionedHandle(row: EventCase, context: ConformanceHarnessContext): AuditOperationHandle {
  assert.ok(row.outcome in transitions, `unsupported non-success outcome ${row.outcome}`);
  const operation = context.sdk.beginOperation({ boundEvent: row.method });
  assert.ok(operation.ok);
  const transition = transitions[row.outcome as NonSuccessOutcome].advance(operation.value);
  assert.ok(transition.ok);
  return operation.value;
}

async function assertPairedControl(row: EventCase): Promise<void> {
  const context = createConformanceSdk();
  const input = evidenceFreeInput(row);
  const operation = transitionedHandle(row, context);
  const captured = await assertValidConformanceRow({
    name: `${row.method}: ${row.outcome} with operation evidence`,
    method: row.method,
    input: { ...input, operation },
  }, { sdkContext: context });
  assert.equal(context.sink.events.length, 1);
  assert.equal(captured.event.outcome, row.outcome);
  assert.equal(captured.event.commit_state, transitions[row.outcome as NonSuccessOutcome].commitState);
}

test("catalog commit values partition transaction-bound and not-applicable events", () => {
  for (const entry of EVENT_CATALOG) {
    const commits: readonly string[] = entry.commit;
    assert.notEqual(commits.includes("committed"), commits.includes("not_applicable"), entry.name);
  }
});

test("transaction-bound non-success matrix is non-vacuous across delivery classes", () => {
  assert.equal(transactionBound.length, 15);
  assert.equal(nonSuccessCases.length, 35);
  assert.ok(nonSuccessCases.some((row) => row.definition.delivery === "transaction_critical"));
  assert.ok(nonSuccessCases.some((row) => row.definition.delivery === "policy_critical"));
});

for (const row of nonSuccessCases) {
  test(`${row.method}: handle-less ${row.outcome} requires operation evidence`, () => assertEvidenceRefused(row));
  test(`${row.method}: ${row.outcome} accepts sanctioned operation evidence`, () => assertPairedControl(row));
}

test("handle-less transaction-bound success still requires operation evidence", async () => {
  const definition = transactionBound.find((entry) => entry.outcomes.some((outcome) => outcome === "success"));
  assert.ok(definition);
  await assertEvidenceRefused(eventCase(definition, "success"));
});

test("every not-applicable fixture is accepted unchanged without operation evidence", async () => {
  for (const definition of EVENT_CATALOG.filter((entry) => entry.commit.some((value) => value === "not_applicable"))) {
    const fixture = fixtures.find((candidate) => candidate.event.name === definition.name);
    assert.ok(fixture);
    const row = eventCase(definition, fixture.event.outcome);
    const context = createConformanceSdk();
    const captured = await assertValidConformanceRow({
      name: `${row.method}: not-applicable fixture`, method: row.method, input: evidenceFreeInput(row),
    }, { sdkContext: context });
    assert.equal(context.sink.events.length, 1);
    assert.equal(captured.event.commit_state, "not_applicable");
    assert.equal(captured.event.outcome, fixture.event.outcome);
  }
});
