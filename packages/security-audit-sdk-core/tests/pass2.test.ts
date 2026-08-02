import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { test } from "node:test";
import {
  EVENT_CATALOG,
  EVENT_METHODS,
  administratorActor,
  anonymousActor,
  apiCredentialActor,
  authenticatedHumanActor,
  authenticatedPrincipal,
  authenticationEvidence,
  authoritativeActor,
  authoritativeResource,
  authoritativeSubject,
  authoritativeTenant,
  authorizationEvidence,
  backgroundJobActor,
  claimedActor,
  claimedTenant,
  createSecurityAuditSdk,
  credentialReference,
  dataPolicyContext,
  delegatedActorContext,
  delegationContext,
  destinationContext,
  externalIntegrationActor,
  impersonatingActorContext,
  integrityContext,
  observedSource,
  registeredEnrichmentExtension,
  riskContext,
  runWithAuditContext,
  scheduledProcessActor,
  serviceAccountActor,
  serviceWorkload,
  sessionEvidence,
  validateSecurityAuditEvent,
  workloadIdentityActor,
  type AuditContextFrameInput,
  type AuditDeliveryResult,
  type AuditEventSink,
  type AuditIdentifierProvider,
  type AuditResult,
  type EventMethodName,
  type SecurityAuditSdk,
  type SecurityAuditEvent,
} from "../dist/index.js";
import { createCapturingAuditSink, createInMemoryAuditSink } from "../dist/testing.js";

const contractRoot = resolve(process.cwd(), "../../contracts/security-audit");

interface NegativeFixture {
  readonly name: string;
  readonly expected_errors: readonly string[];
  readonly event: SecurityAuditEvent;
}

async function positives(): Promise<SecurityAuditEvent[]> {
  return JSON.parse(await readFile(resolve(contractRoot, "examples/positive/all-events.json"), "utf8")) as SecurityAuditEvent[];
}

async function negatives(): Promise<NegativeFixture[]> {
  return JSON.parse(await readFile(resolve(contractRoot, "examples/negative/all-negative.json"), "utf8")) as NegativeFixture[];
}

// ---------------------------------------------------------------------------
// Section: named APIs cover all 24 catalog events via safe authoritative construction
// ---------------------------------------------------------------------------

test("all approved negative fixtures fail with exact safe codes and no secret echo", async () => {
  for (const fixture of await negatives()) {
    const result = validateSecurityAuditEvent(fixture.event);
    assert.equal(result.ok, false, fixture.name);
    if (!result.ok) {
      assert.equal(result.error.code, fixture.expected_errors[0], fixture.name);
      const serialized = JSON.stringify(result);
      assert.equal(serialized.includes("SECRET_TOKEN_SHOULD_NOT_APPEAR"), false, fixture.name);
      assert.equal(serialized.includes("SYNTHETIC_PROHIBITED_TOKEN"), false, fixture.name);
      assert.ok(serialized.length < 512, fixture.name);
    }
  }
});

test("named APIs cover all 24 catalog events using authoritative construction", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders());
  for (const fixture of await positives()) {
    const method = methodForEvent(fixture.event.name);
    const call = sdk[method] as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>;
    const result = await call.call(sdk, toTrustedNamedInput(sdk, fixture));
    assert.equal(result.ok, true, `${method}: ${result.ok ? "" : JSON.stringify((result as { error: unknown }).error)}`);
  }
  assert.equal(sink.events.length, 24);
  assert.equal(new Set(sink.events.map((event) => event.event.name)).size, 24);
  assert.equal(new Set(sink.events.map((event) => event.event.id)).size, 24);
  for (const event of sink.events) {
    const fixture = (await positives()).find((candidate) => candidate.event.name === event.event.name);
    assert.ok(fixture);
    assert.equal(event.event.category, fixture.event.category);
    assert.equal(event.event.action, fixture.event.action);
    assert.equal(event.event.delivery_class, fixture.event.delivery_class);
    assert.equal(Object.isFrozen(event), true);
  }
});

test("every cataloged required-context field is enforced when omitted from an otherwise valid call", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_000));
  const fixtures = await positives();
  let checked = 0;
  for (const fixture of fixtures) {
    const definition = EVENT_CATALOG.find((entry) => entry.name === fixture.event.name);
    assert.ok(definition);
    const method = methodForEvent(fixture.event.name);
    for (const context of definition.required_context) {
      if (context === "correlation" || context === "original_start") continue; // SDK always fills correlation_id/operation_id
      const mutated = omitRequiredContext(fixture, context);
      if (!mutated) continue;
      checked += 1;
      const call = sdk[method] as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>;
      const result = await call.call(sdk, toNamedInput(mutated));
      assert.equal(result.ok, false, `${method} should reject omission of required context "${context}"`);
    }
  }
  assert.ok(checked > 20, "expected the sweep to exercise a substantial number of required-context omissions");
});

// ---------------------------------------------------------------------------
// Section: actor categories and authority-upgrade rejection
// ---------------------------------------------------------------------------

test("every actor category has an explicit safe construction path", () => {
  const human = authenticatedHumanActor({ id: "human_1" });
  const service = serviceAccountActor({ id: "service_1" });
  const workload = workloadIdentityActor({ id: "workload_1" });
  const apiCredential = apiCredentialActor({ id: "api_1" });
  const administrator = administratorActor({ id: "admin_1" });
  const backgroundJob = backgroundJobActor({ id: "job_1" });
  const scheduledProcess = scheduledProcessActor({ id: "proc_1" });
  const externalIntegration = externalIntegrationActor({ id: "ext_1" });
  const anonymous = anonymousActor();
  for (const actor of [human, service, workload, apiCredential, administrator, backgroundJob, scheduledProcess, externalIntegration, anonymous]) {
    assert.equal(actor.provenance?.trust_level, actor.type === "anonymous" ? "client_claim" : "authoritative_server");
  }
  assert.equal(human.type, "authenticated_human");
  assert.equal(service.type, "service_account");
  assert.equal(workload.type, "workload_identity");
  assert.equal(apiCredential.type, "api_credential");
  assert.equal(administrator.type, "administrator");
  assert.equal(backgroundJob.type, "background_job");
  assert.equal(scheduledProcess.type, "scheduled_process");
  assert.equal(externalIntegration.type, "external_integration");
});

test("delegated and impersonating actor bundles preserve real actor and delegation distinctly", () => {
  const real = administratorActor({ id: "admin_2" });
  const delegated = delegatedActorContext(real, { principal_id: "principal_2", expires_at: "2026-08-01T00:00:00.000Z", reason_code: "operator_requested" });
  assert.equal(delegated.actor.id, "admin_2");
  assert.equal(delegated.delegation.mode, "delegated");
  const impersonating = impersonatingActorContext(real, { principal_id: "principal_3", expires_at: "2026-08-01T00:00:00.000Z", reason_code: "operator_requested" });
  assert.equal(impersonating.delegation.mode, "impersonation");
  assert.throws(() => delegationContext({ mode: "delegated", principal_id: "", expires_at: "2026-08-01T00:00:00.000Z" } as never));
});

test("plain JS objects and TypeScript casts cannot forge authoritative context", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_200));
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const base = toNamedInput(authFailed) as Record<string, unknown>;

  // A hand-written object claiming authoritative trust, never passed through authoritativeActor().
  const forgedActor = {
    type: "administrator",
    id: "forger",
    provenance: { trust_level: "authoritative_server", source: "hand-written" },
  };
  const viaDirectInput = await (sdk.authenticationFailed as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>)({ ...base, actor: forgedActor });
  assert.equal(viaDirectInput.ok, false);
  if (!viaDirectInput.ok) assert.equal(viaDirectInput.error.code, "AUTHORITY_ESCALATION");

  const viaContext = await runWithAuditContextSafely({ actor: forgedActor as never }, () =>
    (sdk.authenticationFailed as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>)({ ...base, actor: undefined }));
  assert.equal(viaContext.ok, false);
  if (!viaContext.ok) assert.equal(viaContext.error.code, "AUTHORITY_ESCALATION");

  // structuredClone drops the (now-removed) brand marker's WeakMap registration by construction,
  // proving the previous "non-enumerable symbol lost on clone" bug can no longer silently upgrade trust.
  const legitimate = administratorActor({ id: "real_admin" });
  const cloned = structuredClone(legitimate);
  const viaClone = await (sdk.authenticationFailed as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>)({ ...base, actor: cloned });
  assert.equal(viaClone.ok, false);
  if (!viaClone.ok) assert.equal(viaClone.error.code, "AUTHORITY_ESCALATION");

  // TypeScript cast bypass: the cast changes only the compile-time type, never runtime shape.
  const casted = forgedActor as unknown as ReturnType<typeof administratorActor>;
  const viaCast = await (sdk.authenticationFailed as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>)({ ...base, actor: casted });
  assert.equal(viaCast.ok, false);
  if (!viaCast.ok) assert.equal(viaCast.error.code, "AUTHORITY_ESCALATION");
});

test("a legitimately claimed non-anonymous actor still cannot satisfy an authoritative-actor requirement", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_300));
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const base = toNamedInput(authFailed) as Record<string, unknown>;
  const claimed = claimedActor({ type: "authenticated_human", id: "claimed_human" });
  const result = await (sdk.authenticationFailed as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>)({ ...base, actor: claimed });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "AUTHORITY_ESCALATION");
});

test("brand kind mismatches are rejected even though every value is a legitimately constructed context object", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_400));
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const base = toNamedInput(authFailed) as Record<string, unknown>;
  // authoritativeResource() output branded "resource_authority" cannot stand in for "subject".
  const wrongKind = authoritativeResource({ type: "account", id: "res_1", operation_type: "read" });
  const result = await (sdk.authenticationFailed as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>)({ ...base, subject: wrongKind });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "AUTHORITY_ESCALATION");
});

test("anonymous actor cannot carry an authenticated principal", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_500));
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const base = toNamedInput(authFailed) as Record<string, unknown>;
  const result = await (sdk.authenticationFailed as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>)({
    ...base,
    actor: anonymousActor(),
    authenticated_principal: authenticatedPrincipal({ type: "human_user", id: "principal_x" }),
  });
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "AUTHORITY_ESCALATION");
});

test("caller mutation of source objects after construction cannot change emitted output", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_600));
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const base = toNamedInput(authFailed) as Record<string, unknown>;
  const mutableSource = { id: "stable_actor" };
  const actor = authenticatedHumanActor(mutableSource);
  mutableSource.id = "mutated_after_construction";
  assert.throws(() => { (actor as { id: string }).id = "mutated_directly"; });
  const result = await (sdk.authenticationFailed as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>)({ ...base, actor });
  assert.equal(result.ok, true);
  assert.equal(sink.events.at(-1)?.actor.id, "stable_actor");
});

// ---------------------------------------------------------------------------
// Section: seven tenant scenarios
// ---------------------------------------------------------------------------

test("tenant scenario: plain tenant scope is accepted", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_700));
  const [succeeded] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.succeeded");
  assert.ok(succeeded);
  const result = await sdk.authenticationSucceeded(toNamedInput(succeeded) as never);
  assert.equal(result.ok, true);
});

test("tenant scenario: tenantless scope is accepted where cataloged", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_710));
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const input = toNamedInput(authFailed) as Record<string, unknown>;
  input.tenant = authoritativeTenant({ scope: "tenantless" });
  const result = await sdk.authenticationFailed(input as never);
  assert.equal(result.ok, true);
});

test("tenant scenario: platform scope is accepted where cataloged", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_720));
  const [changed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.security.configuration.changed");
  assert.ok(changed);
  const result = await sdk.securityConfigurationChanged(toTrustedNamedInput(sdk, changed) as never);
  assert.equal(result.ok, true);
});

test("tenant scenario: authorized cross-tenant access is accepted", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_730));
  const [revoked] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.session.revoked");
  assert.ok(revoked);
  const result = await sdk.sessionRevoked(toTrustedNamedInput(sdk, revoked) as never);
  assert.equal(result.ok, true);
});

test("tenant scenario: cross-tenant scope without authorization evidence is rejected", async () => {
  // impersonation.ended does not list "authorization" in its required_context, so this exercises
  // the cross-tenant-specific rule rather than the generic required-authorization check.
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_740));
  const [ended] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.administration.impersonation.ended");
  assert.ok(ended);
  assert.equal(ended.tenant.scope, "cross_tenant");
  const input = toTrustedNamedInput(sdk, ended);
  delete input.authorization;
  const result = await sdk.impersonationEnded(input as never);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "TENANT_RESOURCE_CONFLICT");
});

test("tenant scenario: claimed tenant conflicting with authoritative scope is rejected outside the violation event", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_750));
  const [enrolled] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.mfa.enrolled");
  assert.ok(enrolled);
  const input = toTrustedNamedInput(sdk, enrolled);
  input.claimedTenant = claimedTenant("a-completely-different-tenant");
  const result = await sdk.mfaEnrolled(input as never);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "TENANT_RESOURCE_CONFLICT");
});

test("tenant scenario: the dedicated violation event preserves claimed and authoritative tenants distinctly", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_760));
  const [violation] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.tenant.context_violation.detected");
  assert.ok(violation);
  const result = await sdk.tenantContextViolationDetected(toNamedInput(violation) as never);
  assert.equal(result.ok, true);
  assert.equal(sink.events.at(-1)?.tenant.claimed_tenant_id, violation.tenant.claimed_tenant_id);
  assert.equal(sink.events.at(-1)?.tenant.effective_tenant_id, violation.tenant.effective_tenant_id);
});

// ---------------------------------------------------------------------------
// Section: resource claimed-vs-validated ownership
// ---------------------------------------------------------------------------

test("resource ownership must match authoritative tenant context, not a caller claim", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_800));
  const [created] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.data.sensitive_resource.created");
  assert.ok(created);
  const input = toTrustedNamedInput(sdk, created);
  input.resource = authoritativeResource({ ...created.resource, owning_tenant_id: "a-tenant-that-does-not-own-this" });
  const result = await sdk.sensitiveResourceCreated(input as never);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "TENANT_RESOURCE_CONFLICT");
});

test("resource ownership matching authoritative tenant context is accepted", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_810));
  const [created] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.data.sensitive_resource.created");
  assert.ok(created);
  const result = await sdk.sensitiveResourceCreated(toTrustedNamedInput(sdk, created) as never);
  assert.equal(result.ok, true);
});

// ---------------------------------------------------------------------------
// Section: authorization decision vs operation outcome remain independent
// ---------------------------------------------------------------------------

test("authorization allow may coexist with later operation failure", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_900));
  const [created] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.data.sensitive_resource.created");
  assert.ok(created);
  const operation = sdk.beginOperation({ operationId: "op_allow_fail", transactionId: "txn_allow_fail", correlationId: "corr_allow_fail" });
  assert.ok(operation.ok);
  assert.equal(operation.value.markNotCommitted().ok, true);
  const input = toNamedInput(created) as Record<string, unknown>;
  input.operation = operation.value;
  input.authorization = authorizationEvidence({ ...created.authorization, decision: "allow" });
  input.event = {};
  const result = await sdk.sensitiveResourceCreated(input as never);
  assert.equal(result.ok, true);
  const event = sink.events.at(-1);
  assert.equal(event?.authorization?.decision, "allow");
  assert.equal(event?.event.outcome, "failure");
});

test("authorization deny may coexist with later operation failure but never with success", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_910));
  const [created] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.data.sensitive_resource.created");
  assert.ok(created);
  const operation = sdk.beginOperation({ operationId: "op_deny_fail", transactionId: "txn_deny_fail", correlationId: "corr_deny_fail" });
  assert.ok(operation.ok);
  assert.equal(operation.value.markNotCommitted().ok, true);
  const input = toNamedInput(created) as Record<string, unknown>;
  input.operation = operation.value;
  input.authorization = authorizationEvidence({ ...created.authorization, decision: "deny" });
  input.event = {};
  const denyFailure = await sdk.sensitiveResourceCreated(input as never);
  assert.equal(denyFailure.ok, true);
  assert.equal(sink.events.at(-1)?.event.outcome, "failure");

  const secondOperation = sdk.beginOperation({ operationId: "op_deny_success", transactionId: "txn_deny_success", correlationId: "corr_deny_success" });
  assert.ok(secondOperation.ok);
  assert.equal(secondOperation.value.markCommitted().ok, true);
  const successInput = toNamedInput(created) as Record<string, unknown>;
  successInput.operation = secondOperation.value;
  successInput.authorization = authorizationEvidence({ ...created.authorization, decision: "deny" });
  successInput.event = { outcome: "success" };
  const denySuccess = await sdk.sensitiveResourceCreated(successInput as never);
  assert.equal(denySuccess.ok, false);
  if (!denySuccess.ok) assert.equal(denySuccess.error.code, "AUTHORIZATION_OUTCOME_CONFLICT");
});

test("authorization allow can never coexist with a denied outcome", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(2_920));
  const [denied] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authorization.denied");
  assert.ok(denied);
  const input = toNamedInput(denied) as Record<string, unknown>;
  input.authorization = authorizationEvidence({ ...denied.authorization, decision: "allow" });
  const result = await sdk.authorizationDenied(input as never);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "AUTHORIZATION_OUTCOME_CONFLICT");
});

// ---------------------------------------------------------------------------
// Section: AsyncLocalStorage propagation edge cases
// ---------------------------------------------------------------------------

test("AsyncLocalStorage: no context yields a safe missing-context error rather than fabricated identity", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(3_000));
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const input = toNamedInput(authFailed) as Record<string, unknown>;
  delete input.actor;
  const result = await sdk.authenticationFailed(input as never);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "MISSING_REQUIRED_ACTOR");
  assert.equal(sink.events.length, 0);
});

test("AsyncLocalStorage: concurrent requests isolate tenants and nested scopes restore correlation only", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(3_100));
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const input = toNamedInput(authFailed) as Record<string, unknown>;
  delete input.actor;
  delete input.tenant;
  delete input.correlation;
  delete input.resource;
  delete input.authorization;

  await Promise.all([
    sdk.runWithContext({
      actor: authenticatedHumanActor({ id: "actor_a", tenantId: "tenant_a" }),
      tenant: authoritativeTenant({ scope: "tenant", actor_tenant_id: "tenant_a", effective_tenant_id: "tenant_a", resource_tenant_id: "tenant_a" }),
      correlation: { correlation_id: "corr_a", operation_id: "op_a" },
    }, async () => {
      await delay(5);
      const result = await sdk.authenticationFailed(input as never);
      assert.equal(result.ok, true);
    }),
    sdk.runWithContext({
      actor: authenticatedHumanActor({ id: "actor_b", tenantId: "tenant_b" }),
      tenant: authoritativeTenant({ scope: "tenant", actor_tenant_id: "tenant_b", effective_tenant_id: "tenant_b", resource_tenant_id: "tenant_b" }),
      correlation: { correlation_id: "corr_b", operation_id: "op_b" },
    }, async () => {
      const result = await sdk.authenticationFailed(input as never);
      assert.equal(result.ok, true);
    }),
  ]);

  assert.deepEqual(new Set(sink.events.map((event) => event.actor.id)), new Set(["actor_a", "actor_b"]));
  assert.deepEqual(new Set(sink.events.map((event) => event.tenant.effective_tenant_id)), new Set(["tenant_a", "tenant_b"]));

  await sdk.runWithContext({
    actor: authenticatedHumanActor({ id: "outer_actor", tenantId: "tenant_outer" }),
    tenant: authoritativeTenant({ scope: "tenant", actor_tenant_id: "tenant_outer", effective_tenant_id: "tenant_outer", resource_tenant_id: "tenant_outer" }),
    correlation: { correlation_id: "corr_outer", operation_id: "op_outer" },
  }, async () => {
    await sdk.runWithContext({ correlation: { correlation_id: "corr_inner", operation_id: "op_inner" } }, async () => {
      const result = await sdk.authenticationFailed(input as never);
      assert.equal(result.ok, true);
    });
    const result = await sdk.authenticationFailed(input as never);
    assert.equal(result.ok, true);
  });

  const [inner, outer] = sink.events.slice(-2);
  assert.ok(inner);
  assert.ok(outer);
  assert.equal(inner.actor.id, "outer_actor");
  assert.equal(inner.correlation.operation_id, "op_inner");
  assert.equal(outer.correlation.operation_id, "op_outer");
});

test("AsyncLocalStorage: context survives promise chains, timers, and detached background continuations", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(3_200));
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const input = toNamedInput(authFailed) as Record<string, unknown>;
  delete input.actor;
  delete input.tenant;
  delete input.correlation;
  delete input.resource;
  delete input.authorization;

  let backgroundResult: AuditResult<AuditDeliveryResult> | undefined;
  const backgroundStarted = sdk.runWithContext({
    actor: authenticatedHumanActor({ id: "timer_actor", tenantId: "tenant_timer" }),
    tenant: authoritativeTenant({ scope: "tenant", actor_tenant_id: "tenant_timer", effective_tenant_id: "tenant_timer", resource_tenant_id: "tenant_timer" }),
    correlation: { correlation_id: "corr_timer", operation_id: "op_timer" },
  }, () => {
    return Promise.resolve()
      .then(() => delay(1))
      .then(async () => {
        backgroundResult = await sdk.authenticationFailed(input as never);
      });
  });
  await backgroundStarted;
  assert.ok(backgroundResult);
  assert.equal(backgroundResult.ok, true);
  assert.equal(sink.events.at(-1)?.actor.id, "timer_actor");
});

test("AsyncLocalStorage: an exception inside a context scope still restores the parent scope", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(3_300));
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const input = toNamedInput(authFailed) as Record<string, unknown>;
  delete input.actor;
  delete input.tenant;
  delete input.correlation;

  assert.throws(() => {
    sdk.runWithContext({
      actor: authenticatedHumanActor({ id: "thrower", tenantId: "tenant_thrower" }),
      tenant: authoritativeTenant({ scope: "tenant", actor_tenant_id: "tenant_thrower", effective_tenant_id: "tenant_thrower", resource_tenant_id: "tenant_thrower" }),
      correlation: { correlation_id: "corr_thrower", operation_id: "op_thrower" },
    }, () => {
      throw new Error("boom");
    });
  }, /boom/);

  const afterThrow = await sdk.authenticationFailed(input as never);
  assert.equal(afterThrow.ok, false);
  // Structural schema validation reports the first missing top-level required field (tenant
  // precedes actor in schema declaration order); either way, nothing from the thrower's scope leaked.
  if (!afterThrow.ok) assert.equal(afterThrow.error.code, "MISSING_TENANT_CONTEXT");
});

// ---------------------------------------------------------------------------
// Section: transaction-aware operations
// ---------------------------------------------------------------------------

test("operation state machine rejects premature success and preserves authorization versus outcome", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(400));
  const fixtures = await positives();
  const modified = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.data.sensitive_resource.modified"));
  const created = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.data.sensitive_resource.created"));

  const operationResult = sdk.beginOperation({ operationId: "op_txn", transactionId: "txn_txn", correlationId: "corr_txn" });
  assert.equal(operationResult.ok, true);
  assert.ok(operationResult.ok);
  const premature = await sdk.sensitiveResourceModified({ ...modified, operation: operationResult.value, event: { outcome: "success" } } as never);
  assert.deepEqual(premature, { ok: false, error: { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" } });
  assert.equal(sink.events.length, 0);

  const committed = operationResult.value.markCommitted();
  assert.equal(committed.ok, true);
  const success = await sdk.sensitiveResourceModified({ ...modified, operation: operationResult.value, event: { lifecycle_phase: "completed", outcome: "success" } } as never);
  assert.equal(success.ok, true);
  assert.equal(sink.events.at(-1)?.event.commit_state, "committed");

  const compensated = operationResult.value.markCompensated();
  assert.equal(compensated.ok, true);
  const compensation = await sdk.sensitiveResourceModified({
    ...modified,
    operation: operationResult.value,
    event: { lifecycle_phase: "compensating", outcome: "partial", commit_state: "compensated", outcome_reason: { code: "compensated" } },
  } as never);
  assert.equal(compensation.ok, true);
  assert.deepEqual(operationResult.value.markNotCommitted(), {
    ok: false,
    error: { code: "SDK_INVALID_OPERATION_TRANSITION", category: "lifecycle", path: "/operation/state" },
  });

  const failedOperation = sdk.beginOperation({ operationId: "op_fail", transactionId: "txn_fail", correlationId: "corr_fail" });
  assert.ok(failedOperation.ok);
  assert.equal(failedOperation.value.markNotCommitted().ok, true);
  const failure = await sdk.sensitiveResourceCreated({ ...created, operation: failedOperation.value, event: {} } as never);
  assert.equal(failure.ok, true);
  const event = sink.events.at(-1);
  assert.ok(event);
  assert.equal(event.authorization?.decision, "allow");
  assert.equal(event.event.outcome, "failure");
  assert.equal(event.event.commit_state, "not_committed");
});

test("a caller cannot bypass the operation model by directly declaring commit_state committed", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(4_000));
  const [created] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.data.sensitive_resource.created");
  assert.ok(created);
  const input = toNamedInput(created) as Record<string, unknown>;
  delete input.operation;
  (input as { event: Record<string, unknown> }).event = { commit_state: "committed", outcome: "success" };
  const result = await sdk.sensitiveResourceCreated(input as never);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "PREMATURE_SUCCESS");
});

test("named methods reject forged, copied, modified, cloned, and foreign operation evidence without sink invocation or identifier disclosure", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(4_050));
  const foreignSdk = createSdk(createCapturingAuditSink(), deterministicProviders(4_060));
  const created = toNamedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created"));
  delete created.operation;
  const hostileOperationId = "SECRET_ATTACKER_OPERATION";
  const hostileTransactionId = "SECRET_ATTACKER_TRANSACTION";
  const forged = {
    operation_id: hostileOperationId,
    transaction_id: hostileTransactionId,
    correlation_id: "SECRET_ATTACKER_CORRELATION",
    state: "committed",
    commit_state: "committed",
    transactional: true,
  };

  const issued = sdk.beginOperation({
    operationId: "legitimate_operation",
    transactionId: "legitimate_transaction",
    correlationId: "legitimate_correlation",
    boundEvent: "sensitiveResourceCreated",
  });
  assert.ok(issued.ok);
  assert.equal(issued.value.markCommitted().ok, true);
  const snapshot = issued.value.snapshot();
  const withoutBinding = { ...snapshot } as Record<string, unknown>;
  delete withoutBinding.bound_event;
  const foreign = foreignSdk.beginOperation({ boundEvent: "sensitiveResourceCreated" });
  assert.ok(foreign.ok);
  assert.equal(foreign.value.markCommitted().ok, true);

  for (const operation of [
    forged,
    { ...forged },
    { ...forged, snapshot: () => forged },
    snapshot,
    { ...snapshot },
    JSON.parse(JSON.stringify(snapshot)) as unknown,
    structuredClone(snapshot),
    withoutBinding,
    { ...snapshot, bound_event: "sensitiveResourceDeleted" },
    foreign.value,
  ]) {
    const result = await (sdk.sensitiveResourceCreated as (input: unknown) => Promise<AuditResult<AuditDeliveryResult>>)({
      ...created,
      operation,
      event: { outcome: "success", commit_state: "committed" },
    });
    assert.deepEqual(result, {
      ok: false,
      error: { code: "SDK_INVALID_OPERATION_TRANSITION", category: "lifecycle", path: "/operation" },
    });
    const diagnostic = JSON.stringify(result);
    assert.equal(diagnostic.includes(hostileOperationId), false);
    assert.equal(diagnostic.includes(hostileTransactionId), false);
  }
  assert.equal(sink.events.length, 0);
});

test("same-instance private operation evidence controls commit state, event binding, and identifiers", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(4_070));
  const fixtures = await positives();
  const created = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.data.sensitive_resource.created"));
  const deleted = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.data.sensitive_resource.deleted"));
  delete created.operation;
  delete deleted.operation;

  const pending = sdk.beginOperation({
    operationId: "trusted_operation",
    transactionId: "trusted_transaction",
    correlationId: "trusted_correlation",
    boundEvent: "sensitiveResourceCreated",
  });
  assert.ok(pending.ok);
  const premature = await sdk.sensitiveResourceCreated({ ...created, operation: pending.value, event: { outcome: "success" } } as never);
  assert.deepEqual(premature, { ok: false, error: { code: "PREMATURE_SUCCESS", category: "validation", path: "/operation/state" } });
  assert.equal(sink.events.length, 0);

  assert.equal(pending.value.markCommitted().ok, true);
  const mismatch = await sdk.sensitiveResourceDeleted({ ...deleted, operation: pending.value } as never);
  assert.deepEqual(mismatch, { ok: false, error: { code: "SDK_OPERATION_EVENT_MISMATCH", category: "lifecycle", path: "/operation/bound_event" } });
  assert.equal(sink.events.length, 0);

  const accepted = await sdk.sensitiveResourceCreated({ ...created, operation: pending.value } as never);
  assert.equal(accepted.ok, true);
  assert.equal(sink.events.length, 1);
  assert.equal(sink.events[0]?.correlation.operation_id, "trusted_operation");
  assert.equal(sink.events[0]?.correlation.transaction_id, "trusted_transaction");
  assert.equal(sink.events[0]?.correlation.correlation_id, "trusted_correlation");

  const nonTransactional = sdk.beginOperation({ transactional: false });
  assert.ok(nonTransactional.ok);
  const authentication = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.authentication.succeeded"));
  const nonTransactionalResult = await sdk.authenticationSucceeded({ ...authentication, operation: nonTransactional.value } as never);
  assert.equal(nonTransactionalResult.ok, true);
  assert.equal(sink.events.at(-1)?.event.commit_state, "not_applicable");
});

test("trusted generic emit remains a separate complete-canonical-event boundary", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(4_080));
  const canonical = requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created");
  const result = await sdk.emit(canonical);
  assert.equal(result.ok, true);
  assert.equal(sink.events.length, 1);
  assert.equal(sink.events[0]?.event.id, canonical.event.id);
});

test("duplicate success for the same operation and event is rejected while fan-out to different events is allowed", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(4_100));
  const fixtures = await positives();
  const created = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.data.sensitive_resource.created"));
  const deleted = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.data.sensitive_resource.deleted"));

  const operation = sdk.beginOperation({ operationId: "op_dup", transactionId: "txn_dup", correlationId: "corr_dup" });
  assert.ok(operation.ok);
  assert.equal(operation.value.markCommitted().ok, true);

  const first = await sdk.sensitiveResourceCreated({ ...created, operation: operation.value } as never);
  assert.equal(first.ok, true);
  const second = await sdk.sensitiveResourceCreated({ ...created, operation: operation.value } as never);
  assert.equal(second.ok, false);
  if (!second.ok) assert.equal(second.error.code, "SDK_DUPLICATE_SUCCESS");

  const fanOut = await sdk.sensitiveResourceDeleted({ ...deleted, operation: operation.value, event: {} } as never);
  assert.equal(fanOut.ok, true);
});

test("concurrent terminal success reserves once before validation and sink handoff", async () => {
  let releaseSink: (() => void) | undefined;
  let sinkInvocations = 0;
  let transformationCalls = 0;
  const events: SecurityAuditEvent[] = [];
  const sinkEntered = Promise.withResolvers<void>();
  const sinkRelease = new Promise<void>((resolve) => { releaseSink = resolve; });
  const sink: AuditEventSink = {
    async emit(event) {
      sinkInvocations += 1;
      events.push(event);
      sinkEntered.resolve();
      await sinkRelease;
      return { status: "accepted" };
    },
  };
  const sdk = createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: { name: "sdk-test-producer", version: "1.0.0" },
    service: { name: "sdk-test-service", version: "1.0.0" },
    environment: { name: "test" },
    sink,
    clock: fixedClock(),
    identifiers: deterministicProviders(4_150),
    transformations: [{
      path: "request.route",
      transform({ value }) {
        transformationCalls += 1;
        return value;
      },
    }],
    shutdownTimeoutMs: 100,
  });
  const created = toNamedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created"));
  assert.equal(typeof (created.request as { route?: unknown } | undefined)?.route, "string");
  const operation = sdk.beginOperation({
    operationId: "op_f02_reproduction",
    transactionId: "txn_f02_reproduction",
    correlationId: "corr_f02_reproduction",
    boundEvent: "sensitiveResourceCreated",
  });
  assert.ok(operation.ok);
  assert.equal(operation.value.markCommitted().ok, true);
  const input = { ...created, operation: operation.value } as never;

  const calls = [
    sdk.sensitiveResourceCreated(input),
    sdk.sensitiveResourceCreated(input),
  ] as const;
  await sinkEntered.promise;
  assert.equal(sinkInvocations, 1);
  assert.equal(transformationCalls, 1);
  releaseSink?.();
  const results = await Promise.all(calls);

  assert.equal(results.filter((result) => result.ok).length, 1);
  const duplicate = results.find((result) => !result.ok);
  assert.deepEqual(duplicate, {
    ok: false,
    error: { code: "SDK_DUPLICATE_SUCCESS", category: "lifecycle", path: "/operation/state" },
  });
  const diagnostic = JSON.stringify(duplicate);
  assert.equal(diagnostic.includes("op_f02_reproduction"), false);
  assert.equal(diagnostic.includes("txn_f02_reproduction"), false);
  assert.equal(diagnostic.includes(events[0]?.event.id ?? "missing-event"), false);
  assert.equal(sinkInvocations, 1);
  assert.equal(events[0]?.correlation.operation_id, "op_f02_reproduction");
  assert.equal(events[0]?.correlation.transaction_id, "txn_f02_reproduction");
});

test("non-accepted and rejected-promise sink outcomes release a concurrent reservation for explicit retry", async (context) => {
  const cases = [
    { name: "rejected", result: { status: "rejected", code: "synthetic_rejection" } as const, expectedCode: "SDK_SINK_REJECTED" },
    { name: "unknown", result: { status: "unknown", code: "synthetic_unknown" } as const, expectedCode: "SDK_SINK_FAILURE" },
    { name: "rejected promise", result: new Error("SINK_REJECTION_SECRET"), expectedCode: "SDK_SINK_FAILURE" },
  ];

  for (const [index, scenario] of cases.entries()) {
    await context.test(scenario.name, async () => {
      const firstEntered = Promise.withResolvers<void>();
      const firstRelease = Promise.withResolvers<void>();
      let sinkInvocations = 0;
      const sink: AuditEventSink = {
        async emit() {
          sinkInvocations += 1;
          if (sinkInvocations === 1) {
            firstEntered.resolve();
            await firstRelease.promise;
            if (scenario.result instanceof Error) throw scenario.result;
            return scenario.result;
          }
          return { status: "accepted" };
        },
      };
      const sdk = createSdkWithSink(sink, deterministicProviders(4_200 + (index * 20)), 100);
      const created = toNamedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created"));
      const operation = sdk.beginOperation({ boundEvent: "sensitiveResourceCreated" });
      assert.ok(operation.ok);
      assert.equal(operation.value.markCommitted().ok, true);
      const input = { ...created, operation: operation.value } as never;

      const first = sdk.sensitiveResourceCreated(input);
      await firstEntered.promise;
      const concurrent = await sdk.sensitiveResourceCreated(input);
      assert.deepEqual(concurrent, {
        ok: false,
        error: { code: "SDK_DUPLICATE_SUCCESS", category: "lifecycle", path: "/operation/state" },
      });
      assert.equal(sinkInvocations, 1);
      firstRelease.resolve();
      const failed = await first;
      assert.equal(failed.ok, false);
      if (!failed.ok) assert.equal(failed.error.code, scenario.expectedCode);
      assert.equal(JSON.stringify(failed).includes("SINK_REJECTION_SECRET"), false);

      const retry = await sdk.sensitiveResourceCreated(input);
      assert.equal(retry.ok, true);
      assert.equal(sinkInvocations, 2);
    });
  }
});

test("a synchronous sink throw releases the reservation and returns the existing safe sink failure", async () => {
  let sinkInvocations = 0;
  const sink: AuditEventSink = {
    emit() {
      sinkInvocations += 1;
      if (sinkInvocations === 1) throw new Error("SYNCHRONOUS_SINK_SECRET");
      return Promise.resolve({ status: "accepted" });
    },
  };
  const sdk = createSdkWithSink(sink, deterministicProviders(4_280), 100);
  const created = toNamedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created"));
  const operation = sdk.beginOperation({ boundEvent: "sensitiveResourceCreated" });
  assert.ok(operation.ok);
  assert.equal(operation.value.markCommitted().ok, true);
  const input = { ...created, operation: operation.value } as never;

  const failed = await sdk.sensitiveResourceCreated(input);
  assert.equal(failed.ok, false);
  if (!failed.ok) assert.equal(failed.error.code, "SDK_SINK_FAILURE");
  assert.equal(JSON.stringify(failed).includes("SYNCHRONOUS_SINK_SECRET"), false);
  assert.equal((await sdk.sensitiveResourceCreated(input)).ok, true);
  assert.equal(sinkInvocations, 2);
});

test("different operations and different SDK instances reserve independently", async () => {
  const bothEntered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let sinkInvocations = 0;
  const sink: AuditEventSink = {
    async emit() {
      sinkInvocations += 1;
      if (sinkInvocations === 2) bothEntered.resolve();
      await release.promise;
      return { status: "accepted" };
    },
  };
  const sdk = createSdkWithSink(sink, deterministicProviders(4_300), 100);
  const created = toNamedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created"));
  const operations = [
    sdk.beginOperation({ operationId: "independent_a", boundEvent: "sensitiveResourceCreated" }),
    sdk.beginOperation({ operationId: "independent_b", boundEvent: "sensitiveResourceCreated" }),
  ];
  assert.ok(operations[0]?.ok && operations[1]?.ok);
  assert.equal(operations[0].value.markCommitted().ok, true);
  assert.equal(operations[1].value.markCommitted().ok, true);
  const calls = [
    sdk.sensitiveResourceCreated({ ...created, operation: operations[0].value } as never),
    sdk.sensitiveResourceCreated({ ...created, operation: operations[1].value } as never),
  ];
  await bothEntered.promise;
  assert.equal(sinkInvocations, 2);
  release.resolve();
  assert.deepEqual((await Promise.all(calls)).map((result) => result.ok), [true, true]);

  const firstSdk = createSdk(createCapturingAuditSink(), deterministicProviders(4_340));
  const secondSdk = createSdk(createCapturingAuditSink(), deterministicProviders(4_360));
  const firstOperation = firstSdk.beginOperation({ operationId: "same_instance_local_id", boundEvent: "sensitiveResourceCreated" });
  const secondOperation = secondSdk.beginOperation({ operationId: "same_instance_local_id", boundEvent: "sensitiveResourceCreated" });
  assert.ok(firstOperation.ok && secondOperation.ok);
  assert.equal(firstOperation.value.markCommitted().ok, true);
  assert.equal(secondOperation.value.markCommitted().ok, true);
  assert.equal((await firstSdk.sensitiveResourceCreated({ ...created, operation: firstOperation.value } as never)).ok, true);
  assert.equal((await secondSdk.sensitiveResourceCreated({ ...created, operation: secondOperation.value } as never)).ok, true);
});

test("same-operation sink reentrancy is rejected without a second sink call or deadlock", async () => {
  let sdk: SecurityAuditSdk;
  let input: Record<string, unknown>;
  let sinkInvocations = 0;
  let reentrantResult: AuditResult<AuditDeliveryResult> | undefined;
  const sink: AuditEventSink = {
    async emit() {
      sinkInvocations += 1;
      reentrantResult = await sdk.sensitiveResourceCreated(input as never);
      return { status: "accepted" };
    },
  };
  sdk = createSdkWithSink(sink, deterministicProviders(4_380), 100);
  const created = toNamedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created"));
  const operation = sdk.beginOperation({ boundEvent: "sensitiveResourceCreated" });
  assert.ok(operation.ok);
  assert.equal(operation.value.markCommitted().ok, true);
  input = { ...created, operation: operation.value };

  assert.equal((await sdk.sensitiveResourceCreated(input as never)).ok, true);
  assert.deepEqual(reentrantResult, {
    ok: false,
    error: { code: "SDK_DUPLICATE_SUCCESS", category: "lifecycle", path: "/operation/state" },
  });
  assert.equal(sinkInvocations, 1);
});

test("flush and shutdown overlap preserve the terminal reservation until the accepting sink settles", async () => {
  const entered = Promise.withResolvers<void>();
  const release = Promise.withResolvers<void>();
  let sinkInvocations = 0;
  const sink: AuditEventSink = {
    async emit() {
      sinkInvocations += 1;
      entered.resolve();
      await release.promise;
      return { status: "accepted" };
    },
    async flush() {},
    async shutdown() {},
  };
  const sdk = createSdkWithSink(sink, deterministicProviders(4_400), 100);
  const created = toNamedInput(requiredFixture(await positives(), "bloodtrail.audit.data.sensitive_resource.created"));
  const operation = sdk.beginOperation({ boundEvent: "sensitiveResourceCreated" });
  assert.ok(operation.ok);
  assert.equal(operation.value.markCommitted().ok, true);
  const input = { ...created, operation: operation.value } as never;

  const first = sdk.sensitiveResourceCreated(input);
  await entered.promise;
  assert.equal((await sdk.flush()).ok, true);
  const duplicate = await sdk.sensitiveResourceCreated(input);
  assert.equal(duplicate.ok, false);
  if (!duplicate.ok) assert.equal(duplicate.error.code, "SDK_DUPLICATE_SUCCESS");
  const shutdown = sdk.shutdown();
  release.resolve();
  assert.equal((await first).ok, true);
  assert.equal((await shutdown).ok, true);
  assert.equal(sinkInvocations, 1);
  const afterShutdown = await sdk.sensitiveResourceCreated(input);
  assert.equal(afterShutdown.ok, false);
  if (!afterShutdown.ok) assert.equal(afterShutdown.error.code, "SDK_SHUT_DOWN");
});

test("an operation bound to one named event cannot be completed through another", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(4_200));
  const fixtures = await positives();
  const created = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.data.sensitive_resource.created"));
  const modified = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.data.sensitive_resource.modified"));

  const operation = sdk.beginOperation({ operationId: "op_bound", transactionId: "txn_bound", correlationId: "corr_bound", boundEvent: "sensitiveResourceCreated" });
  assert.ok(operation.ok);
  assert.equal(operation.value.markCommitted().ok, true);

  const mismatch = await sdk.sensitiveResourceModified({ ...modified, operation: operation.value } as never);
  assert.equal(mismatch.ok, false);
  if (!mismatch.ok) assert.equal(mismatch.error.code, "SDK_OPERATION_EVENT_MISMATCH");

  const matching = await sdk.sensitiveResourceCreated({ ...created, operation: operation.value } as never);
  assert.equal(matching.ok, true);
});

test("cancellation is a distinct terminal state from failure", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(4_300));
  const [exported] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.data.sensitive_data.exported");
  assert.ok(exported);
  const operation = sdk.beginOperation({ operationId: "op_cancel", transactionId: "txn_cancel", correlationId: "corr_cancel" });
  assert.ok(operation.ok);
  assert.equal(operation.value.markCancelled().ok, true);
  assert.deepEqual(operation.value.markCommitted(), {
    ok: false,
    error: { code: "SDK_INVALID_OPERATION_TRANSITION", category: "lifecycle", path: "/operation/state" },
  });
  const input = toNamedInput(exported) as Record<string, unknown>;
  input.operation = operation.value;
  (input as { event: Record<string, unknown> }).event = {};
  const result = await sdk.sensitiveDataExported(input as never);
  assert.equal(result.ok, true);
  assert.equal(sink.events.at(-1)?.event.outcome, "cancelled");
  assert.equal(sink.events.at(-1)?.event.commit_state, "not_committed");
});

test("marking the same transition twice is an idempotent no-op, not an error", () => {
  const sdk = createSdk(createCapturingAuditSink(), deterministicProviders(4_400));
  const operation = sdk.beginOperation({ operationId: "op_idempotent", transactionId: "txn_idempotent", correlationId: "corr_idempotent" });
  assert.ok(operation.ok);
  const first = operation.value.markCommitted();
  const second = operation.value.markCommitted();
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  assert.deepEqual(first, second);
});

test("a deliberately declared non-transactional operation bypasses the commit gate for not_applicable events", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(4_500));
  const [succeeded] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.succeeded");
  assert.ok(succeeded);
  const operation = sdk.beginOperation({ operationId: "op_nontx", transactionId: "txn_nontx", correlationId: "corr_nontx", transactional: false });
  assert.ok(operation.ok);
  const input = toNamedInput(succeeded) as Record<string, unknown>;
  input.operation = operation.value;
  const result = await sdk.authenticationSucceeded(input as never);
  assert.equal(result.ok, true);
  assert.equal(sink.events.at(-1)?.event.commit_state, "not_applicable");
});

test("operation identifiers must be well-formed and cannot be reused", () => {
  const sdk = createSdk(createCapturingAuditSink(), deterministicProviders(4_600));
  const malformed = sdk.beginOperation({ operationId: "bad\nid", transactionId: "txn", correlationId: "corr" });
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.error.code, "SDK_INVALID_IDENTIFIER");

  const first = sdk.beginOperation({ operationId: "reused_operation_id", transactionId: "txn_a", correlationId: "corr_a" });
  assert.equal(first.ok, true);
  const reused = sdk.beginOperation({ operationId: "reused_operation_id", transactionId: "txn_b", correlationId: "corr_b" });
  assert.equal(reused.ok, false);
  if (!reused.ok) assert.equal(reused.error.code, "SDK_INVALID_IDENTIFIER");

  const unknownBinding = sdk.beginOperation({ boundEvent: "notARealMethod" as never });
  assert.equal(unknownBinding.ok, false);
  if (!unknownBinding.ok) assert.equal(unknownBinding.error.code, "UNKNOWN_CATALOG_VALUE");
});

// ---------------------------------------------------------------------------
// Section: retry, redelivery, re-execution, fan-out, and causality
// ---------------------------------------------------------------------------

test("retry, redelivery, fan-out, compensation, and causality relationships stay distinct", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(600));
  const fixtures = await positives();
  const succeeded = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.authentication.succeeded"));
  const first = await sdk.authenticationSucceeded(succeeded as never);
  assert.equal(first.ok, true);
  const original = sink.events.at(-1);
  assert.ok(original);

  const redelivery = await sdk.redeliver(original);
  assert.equal(redelivery.ok, true);
  assert.equal(sink.events.at(-1)?.event.id, original.event.id);

  const retry = await sdk.authenticationSucceeded({
    ...succeeded,
    retry: { retry_attempt: 1, original_event_id: original.event.id, causation_id: original.event.id },
  } as never);
  assert.equal(retry.ok, true);
  const retryEvent = sink.events.at(-1);
  assert.ok(retryEvent);
  assert.notEqual(retryEvent.event.id, original.event.id);
  assert.equal(retryEvent.correlation.original_event_id, original.event.id);

  const missingOriginal = await sdk.authenticationSucceeded({ ...succeeded, retry: { retry_attempt: 1, original_event_id: "" } } as never);
  assert.equal(missingOriginal.ok, false);
  if (!missingOriginal.ok) assert.equal(missingOriginal.error.code, "BAD_CAUSALITY");

  const selfCaused = await sdk.authenticationSucceeded({
    ...succeeded,
    retry: { retry_attempt: 1, original_event_id: "11111111-1111-4111-8111-000000000099", causation_id: "11111111-1111-4111-8111-000000000099" },
    correlation: { causation_id: "11111111-1111-4111-8111-000000000099" },
  } as never);
  assert.equal(selfCaused.ok, true, "causation from a distinct prior event id is legitimate, not circular");

  const operation = sdk.beginOperation({ operationId: "op_fanout", transactionId: "txn_fanout", correlationId: "corr_fanout" });
  assert.ok(operation.ok);
  assert.equal(operation.value.markCommitted().ok, true);
  const created = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.data.sensitive_resource.created"));
  const deleted = toNamedInput(requiredFixture(fixtures, "bloodtrail.audit.data.sensitive_resource.deleted"));
  assert.equal((await sdk.sensitiveResourceCreated({ ...created, operation: operation.value, event: {} } as never)).ok, true);
  assert.equal((await sdk.sensitiveResourceDeleted({ ...deleted, operation: operation.value, event: {} } as never)).ok, true);
  const [fanoutA, fanoutB] = sink.events.slice(-2);
  assert.ok(fanoutA);
  assert.ok(fanoutB);
  assert.equal(fanoutA.correlation.operation_id, "op_fanout");
  assert.equal(fanoutB.correlation.operation_id, "op_fanout");
  assert.notEqual(fanoutA.event.id, fanoutB.event.id);
});

test("a completion event cannot claim itself as its own cause or original event", async () => {
  const [completed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.account.registration.completed");
  assert.ok(completed);
  const selfCausation = validateSecurityAuditEvent({
    ...completed,
    correlation: { ...completed.correlation, causation_id: completed.event.id },
  });
  assert.equal(selfCausation.ok, false);
  if (!selfCausation.ok) assert.equal(selfCausation.error.code, "BAD_CAUSALITY");

  const selfOriginal = validateSecurityAuditEvent({
    ...completed,
    correlation: { ...completed.correlation, original_event_id: completed.event.id },
  });
  assert.equal(selfOriginal.ok, false);
  if (!selfOriginal.ok) assert.equal(selfOriginal.error.code, "BAD_CAUSALITY");
});

test("required asynchronous completion events reject success without causation and original-event identity", async () => {
  const [completed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.account.registration.completed");
  assert.ok(completed);
  const { causation_id: _causationId, original_event_id: _originalEventId, ...correlationWithoutCausation } = completed.correlation;
  void _causationId;
  void _originalEventId;
  const withoutCausation: SecurityAuditEvent = {
    ...completed,
    correlation: correlationWithoutCausation as SecurityAuditEvent["correlation"],
  };
  const result = validateSecurityAuditEvent(withoutCausation);
  assert.equal(result.ok, false);
  if (!result.ok) assert.equal(result.error.code, "BAD_CAUSALITY");
});

// ---------------------------------------------------------------------------
// Section: privacy transformations, extensions, providers, and sink failures
// ---------------------------------------------------------------------------

test("privacy transformations, registered extensions, provider checks, and sink failures are bounded", async () => {
  const transformedSink = createCapturingAuditSink();
  const sdk = createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: { name: "sdk-test-producer", version: "1.0.0" },
    service: { name: "sdk-test-service", version: "1.0.0" },
    environment: { name: "test" },
    sink: transformedSink,
    clock: fixedClock(),
    identifiers: deterministicProviders(900),
    transformations: [{ path: "actor.id", transform: ({ value }) => ({ value: `pseudonym_${value}`, key_id: "key-v1" }) }],
  });
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const input = toNamedInput(authFailed) as Record<string, unknown>;
  input.actor = authenticatedHumanActor({ id: "raw_actor", tenantId: "tenant_alpha" });
  input.tenant = authoritativeTenant({ scope: "tenant", actor_tenant_id: "tenant_alpha", effective_tenant_id: "tenant_alpha", resource_tenant_id: "tenant_alpha" });
  delete input.resource;
  delete input.authorization;
  assert.equal((await sdk.authenticationFailed(input as never)).ok, true);
  assert.equal(transformedSink.events.at(-1)?.actor.id, "pseudonym_raw_actor");

  const unsafeHookSdk = createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: { name: "sdk-test-producer", version: "1.0.0" },
    service: { name: "sdk-test-service", version: "1.0.0" },
    environment: { name: "test" },
    sink: createCapturingAuditSink(),
    clock: fixedClock(),
    identifiers: deterministicProviders(950),
    transformations: [{ path: "event.name", transform: () => "bloodtrail.audit.authentication.failed" }],
  });
  const unsafe = await unsafeHookSdk.authenticationFailed(toNamedInput(authFailed) as never);
  assert.equal(unsafe.ok, false);
  if (!unsafe.ok) assert.equal(unsafe.error.code, "SDK_HOOK_FAILURE");

  const nonEligibleHookSdk = createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: { name: "sdk-test-producer", version: "1.0.0" },
    service: { name: "sdk-test-service", version: "1.0.0" },
    environment: { name: "test" },
    sink: createCapturingAuditSink(),
    clock: fixedClock(),
    identifiers: deterministicProviders(960),
    transformations: [{ path: "actor.type", transform: () => "administrator" }],
  });
  const nonEligible = await nonEligibleHookSdk.authenticationFailed(toNamedInput(authFailed) as never);
  assert.equal(nonEligible.ok, false);
  if (!nonEligible.ok) assert.equal(nonEligible.error.code, "SDK_HOOK_FAILURE");

  const promiseHookSdk = createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: { name: "sdk-test-producer", version: "1.0.0" },
    service: { name: "sdk-test-service", version: "1.0.0" },
    environment: { name: "test" },
    sink: createCapturingAuditSink(),
    clock: fixedClock(),
    identifiers: deterministicProviders(970),
    transformations: [{ path: "actor.id", transform: (async ({ value }: { value: string }) => ({ value: `late_${value}` })) as never }],
  });
  const promiseHookInput = toNamedInput(authFailed) as Record<string, unknown>;
  promiseHookInput.actor = authenticatedHumanActor({ id: "raw_actor_2", tenantId: "tenant_alpha" });
  promiseHookInput.tenant = authoritativeTenant({ scope: "tenant", actor_tenant_id: "tenant_alpha", effective_tenant_id: "tenant_alpha", resource_tenant_id: "tenant_alpha" });
  delete promiseHookInput.resource;
  delete promiseHookInput.authorization;
  const promiseHookResult = await promiseHookSdk.authenticationFailed(promiseHookInput as never);
  assert.equal(promiseHookResult.ok, false);
  if (!promiseHookResult.ok) assert.equal(promiseHookResult.error.code, "SDK_UNSUPPORTED_HOOK_RESULT");

  const extensionEvent = structuredClone((await positives())[0]) as SecurityAuditEvent & { extensions?: SecurityAuditEvent["extensions"] };
  extensionEvent.extensions = {
    "bloodtrail.audit.enrichment.v1": {
      provenance: { trust_level: "downstream_enrichment", source: "fixture-enricher", version: "1.0.0" },
      risk: { level: "low", reason_codes: ["policy_baseline"] },
    },
  };
  assert.equal(validateSecurityAuditEvent(extensionEvent).ok, true);


  const unregisteredExtensionEvent = structuredClone((await positives())[0]) as SecurityAuditEvent & { extensions?: Record<string, unknown> };
  unregisteredExtensionEvent.extensions = { "bloodtrail.audit.unregistered.v1": { anything: true } };
  const unregistered = validateSecurityAuditEvent(unregisteredExtensionEvent);
  assert.equal(unregistered.ok, false);
  if (!unregistered.ok) assert.equal(unregistered.error.code, "UNKNOWN_EXTENSION");

  const registeredExtension = registeredEnrichmentExtension({
    "bloodtrail.audit.enrichment.v1": { provenance: { trust_level: "downstream_enrichment", source: "s", version: "1.0.0" } },
  } as never);
  assert.throws(() => { (registeredExtension as unknown as Record<string, unknown>)["bloodtrail.audit.enrichment.v1"] = {}; });

  const badProviderSdk = createSdk(createCapturingAuditSink(), { ...deterministicProviders(1), eventId: () => "not-a-uuid" });
  const bad = await badProviderSdk.authenticationFailed(toNamedInput(authFailed) as never);
  assert.equal(bad.ok, false);
  if (!bad.ok) assert.equal(bad.error.code, "SDK_INVALID_IDENTIFIER");

  const marker = "SECRET_MARKER_FROM_SINK_SHOULD_NOT_ECHO";
  const sinkFailureSdk = createSdk(createCapturingAuditSink({ failWith: new Error(marker) }), deterministicProviders(1000));
  const sinkFailure = await sinkFailureSdk.authenticationFailed(toNamedInput(authFailed) as never);
  assert.equal(sinkFailure.ok, false);
  const serialized = JSON.stringify(sinkFailure);
  assert.equal(serialized.includes(marker), false);
  assert.ok(serialized.length < 512);

  const bounded = createInMemoryAuditSink({ capacity: 1 });
  const boundedSdk = createSdk(bounded, deterministicProviders(1100));
  assert.equal((await boundedSdk.authenticationFailed(toNamedInput(authFailed) as never)).ok, true);
  assert.equal((await boundedSdk.authenticationFailed(toNamedInput(authFailed) as never)).ok, true);
  assert.equal(bounded.events.length, 1);
  assert.equal((await boundedSdk.shutdown()).ok, true);
  const afterShutdown = await boundedSdk.authenticationFailed(toNamedInput(authFailed) as never);
  assert.deepEqual(afterShutdown, { ok: false, error: { code: "SDK_SHUT_DOWN", category: "lifecycle" } });
});

test("prohibited data nested several levels deep is rejected before schema or hooks observe it", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(4_800));
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  assert.ok(authFailed);
  const input = toNamedInput(authFailed) as Record<string, unknown>;
  const authenticationRaw = authFailed.authentication as unknown as Record<string, unknown>;
  input.authentication = authenticationEvidence({
    ...authenticationRaw,
    account_recovery: { flow: "email", state: "pending", extra_nested: { deeper: { password: "SYNTHETIC_PROHIBITED_TOKEN" } } },
  } as never);
  const result = await sdk.authenticationFailed(input as never);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.code, "PROHIBITED_DATA");
    assert.equal(JSON.stringify(result).includes("SYNTHETIC_PROHIBITED_TOKEN"), false);
  }
});

test("session, source, destination, risk, integrity, and data policy each require their own safe construction path", async () => {
  const sink = createCapturingAuditSink();
  const sdk = createSdk(sink, deterministicProviders(4_900));
  const [succeeded] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.succeeded");
  assert.ok(succeeded);
  const validInput = toNamedInput(succeeded) as Record<string, unknown>;
  const result = await sdk.authenticationSucceeded(validInput as never);
  assert.equal(result.ok, true);

  const forgedSession = { ...succeeded.session };
  const withForgedSession = { ...validInput, session: forgedSession };
  const rejected = await sdk.authenticationSucceeded(withForgedSession as never);
  assert.equal(rejected.ok, false);
  if (!rejected.ok) assert.equal(rejected.error.code, "AUTHORITY_ESCALATION");

  assert.equal(sessionEvidence(succeeded.session ?? {}).id, succeeded.session?.id);
  assert.equal(observedSource(succeeded.source ?? {}).observed?.address, succeeded.source?.observed?.address);
  assert.equal(destinationContext({ service: "svc" }).service, "svc");
  assert.equal(riskContext({ level: "low" }).level, "low");
  assert.equal(integrityContext({}).attestations, undefined);
  assert.equal(dataPolicyContext({ classification: "internal" }).classification, "internal");
  assert.equal(credentialReference({ type: "session", reference: "ref" }).reference, "ref");
  assert.equal(authoritativeSubject({ type: "account", id: "acc" }).id, "acc");
  assert.equal(serviceWorkload({ type: "service", id: "svc-id" }).id, "svc-id");
});

test("sink rejection, unknown handoff, post-commit failure, shutdown race, and timeout stay bounded", async () => {
  const [authFailed] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.authentication.failed");
  const [created] = (await positives()).filter((event) => event.event.name === "bloodtrail.audit.data.sensitive_resource.created");
  assert.ok(authFailed);
  assert.ok(created);

  for (const [delivery, expected] of [
    [{ status: "rejected", code: "fixture-rejected" } as const, "SDK_SINK_REJECTED"],
    [{ status: "unknown", code: "fixture-unknown" } as const, "SDK_SINK_FAILURE"],
  ] as const) {
    const sdk = createSdk(createCapturingAuditSink({ failWith: delivery }), deterministicProviders(5_000));
    const result = await sdk.authenticationFailed(toNamedInput(authFailed) as never);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.error.code, expected);
      assert.equal(JSON.stringify(result).includes(delivery.code), false);
    }
  }

  const postCommitSdk = createSdk(
    createCapturingAuditSink({ failWith: new Error("POST_COMMIT_SECRET_MUST_NOT_ESCAPE") }),
    deterministicProviders(5_100),
  );
  const operation = postCommitSdk.beginOperation({ boundEvent: "sensitiveResourceCreated" });
  assert.ok(operation.ok);
  assert.equal(operation.value.markCommitted().ok, true);
  const postCommit = await postCommitSdk.sensitiveResourceCreated({
    ...toNamedInput(created),
    operation: operation.value,
  } as never);
  assert.equal(postCommit.ok, false);
  assert.equal(operation.value.state, "committed");
  assert.equal(JSON.stringify(postCommit).includes("POST_COMMIT_SECRET_MUST_NOT_ESCAPE"), false);

  let release: (() => void) | undefined;
  const slowSink: AuditEventSink = {
    async emit() {
      await new Promise<void>((resolve) => { release = resolve; });
      return { status: "accepted" };
    },
  };
  const slowSdk = createSdkWithSink(slowSink, deterministicProviders(5_200), 5);
  const pending = slowSdk.authenticationFailed(toNamedInput(authFailed) as never);
  await delay(0);
  const firstShutdown = slowSdk.shutdown();
  const concurrentShutdown = slowSdk.shutdown();
  assert.equal(firstShutdown, concurrentShutdown);
  const timeout = await firstShutdown;
  assert.deepEqual(timeout, { ok: false, error: { code: "SDK_SHUTDOWN_TIMEOUT", category: "lifecycle" } });
  release?.();
  assert.equal((await pending).ok, true);
  assert.deepEqual(await slowSdk.authenticationFailed(toNamedInput(authFailed) as never), {
    ok: false,
    error: { code: "SDK_SHUT_DOWN", category: "lifecycle" },
  });
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createSdk(sink: ReturnType<typeof createCapturingAuditSink>, identifiers: AuditIdentifierProvider) {
  return createSdkWithSink(sink, identifiers, 100);
}

function createSdkWithSink(sink: AuditEventSink, identifiers: AuditIdentifierProvider, shutdownTimeoutMs: number) {
  return createSecurityAuditSdk({
    contractVersion: "1.0.0",
    producer: { name: "sdk-test-producer", version: "1.0.0" },
    service: { name: "sdk-test-service", version: "1.0.0" },
    environment: { name: "test" },
    sink,
    clock: fixedClock(),
    identifiers,
    shutdownTimeoutMs,
  });
}

function fixedClock() {
  return Object.freeze({ now: () => new Date("2026-07-31T12:00:00.000Z") });
}

function deterministicProviders(start = 1): AuditIdentifierProvider {
  let counter = start;
  const next = () => uuid(counter++);
  return Object.freeze({
    eventId: next,
    operationId: next,
    correlationId: next,
    causationId: next,
    requestId: next,
    messageId: next,
    transactionId: next,
  });
}

function uuid(value: number): string {
  return `22222222-2222-4222-8222-${String(value).padStart(12, "0")}`;
}

function methodForEvent(name: SecurityAuditEvent["event"]["name"]): EventMethodName {
  const method = EVENT_METHODS.find((entry) => entry.name === name)?.method;
  assert.ok(method);
  return method;
}

function requiredFixture(fixtures: readonly SecurityAuditEvent[], name: SecurityAuditEvent["event"]["name"]): SecurityAuditEvent {
  const event = fixtures.find((candidate) => candidate.event.name === name);
  assert.ok(event);
  return event;
}

async function runWithAuditContextSafely(frame: AuditContextFrameInput, callback: () => Promise<AuditResult<AuditDeliveryResult>>): Promise<AuditResult<AuditDeliveryResult>> {
  try {
    return await runWithAuditContext(frame, callback);
  } catch (error) {
    const safe = error as { code?: string; category?: string };
    return { ok: false, error: { code: safe.code ?? "AUTHORITY_ESCALATION", category: (safe.category as never) ?? "authority" } };
  }
}

function withoutClaimedTenantId(tenant: SecurityAuditEvent["tenant"]): Omit<SecurityAuditEvent["tenant"], "claimed_tenant_id"> {
  const { claimed_tenant_id: _claimedTenantId, ...rest } = tenant;
  void _claimedTenantId;
  return rest;
}

function brandActorFromRaw(actor: SecurityAuditEvent["actor"] | undefined) {
  if (!actor) return undefined;
  if (actor.type === "anonymous") return anonymousActor(actor.provenance?.source);
  if (actor.provenance?.trust_level === "client_claim") return claimedActor(actor);
  return authoritativeActor(actor);
}

/** Converts a validated fixture event into a named-method call input using only safe authoritative constructors. */
function toNamedInput(event: SecurityAuditEvent): Record<string, unknown> {
  const input: Record<string, unknown> = {
    event: {
      lifecycle_phase: event.event.lifecycle_phase,
      outcome: event.event.outcome,
      outcome_reason: event.event.outcome_reason,
      commit_state: event.event.commit_state,
      timestamp: event.event.timestamp,
      observed_at: event.event.observed_at,
    },
    actor: brandActorFromRaw(event.actor),
    tenant: event.tenant ? authoritativeTenant(withoutClaimedTenantId(event.tenant)) : undefined,
    claimedTenant: event.tenant?.claimed_tenant_id ? claimedTenant(event.tenant.claimed_tenant_id) : undefined,
    subject: event.subject ? authoritativeSubject(event.subject) : undefined,
    authenticated_principal: event.authenticated_principal ? authenticatedPrincipal(event.authenticated_principal) : undefined,
    delegation: event.delegation ? delegationContext(event.delegation) : undefined,
    credential: event.credential ? credentialReference(event.credential) : undefined,
    initiator: event.initiator ? serviceWorkload(event.initiator) : undefined,
    session: event.session ? sessionEvidence(event.session) : undefined,
    authentication: event.authentication ? authenticationEvidence(event.authentication) : undefined,
    authorization: event.authorization ? authorizationEvidence(event.authorization) : undefined,
    source: event.source ? observedSource(event.source) : undefined,
    destination: event.destination ? destinationContext(event.destination) : undefined,
    resource: event.resource ? authoritativeResource(event.resource) : undefined,
    request: event.request,
    correlation: event.correlation,
    risk: event.risk ? riskContext(event.risk) : undefined,
    data: event.data ? dataPolicyContext(event.data) : undefined,
    integrity: event.integrity ? integrityContext(event.integrity) : undefined,
    extensions: event.extensions ? registeredEnrichmentExtension(event.extensions) : undefined,
  };
  if (event.correlation.transaction_id) {
    input.operation = {
      operation_id: event.correlation.operation_id,
      transaction_id: event.correlation.transaction_id,
      correlation_id: event.correlation.correlation_id,
      state: operationStateForCommit(event.event.commit_state),
      commit_state: event.event.commit_state,
    };
  }
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) delete input[key];
  }
  return input;
}

function toTrustedNamedInput(sdk: SecurityAuditSdk, event: SecurityAuditEvent): Record<string, unknown> {
  const input = toNamedInput(event);
  delete input.operation;
  if (!event.correlation.transaction_id) return input;
  const operation = sdk.beginOperation({
    operationId: event.correlation.operation_id,
    transactionId: event.correlation.transaction_id,
    correlationId: event.correlation.correlation_id,
    boundEvent: methodForEvent(event.event.name),
    transactional: event.event.commit_state !== "not_applicable",
  });
  assert.ok(operation.ok);
  switch (event.event.commit_state) {
    case "committed": assert.equal(operation.value.markCommitted().ok, true); break;
    case "not_committed": assert.equal(operation.value.markNotCommitted().ok, true); break;
    case "partially_committed": assert.equal(operation.value.markPartiallyCommitted().ok, true); break;
    case "compensated":
      assert.equal(operation.value.markCommitted().ok, true);
      assert.equal(operation.value.markCompensated().ok, true);
      break;
  }
  input.operation = operation.value;
  return input;
}

function operationStateForCommit(commit: SecurityAuditEvent["event"]["commit_state"]): string {
  switch (commit) {
    case "committed": return "committed";
    case "not_committed": return "not_committed";
    case "partially_committed": return "partially_committed";
    case "compensated": return "compensated";
    default: return "started";
  }
}

const REQUIRED_CONTEXT_FIELD: Readonly<Record<string, string>> = {
  administrator: "actor",
  real_actor: "actor",
  real_admin_actor: "actor",
  real_actor_or_process: "actor",
  actor_or_claim: "actor",
  tenants: "tenant",
  authoritative_tenants: "tenant",
  tenant_or_platform_scope: "tenant",
  role: "resource",
  resource_scope: "resource",
  config_resource: "resource",
  resource_owner: "resource",
  policy: "authorization",
  impersonated_subject: "subject",
  principal: "authenticated_principal",
  scope: "delegation",
  expiry: "delegation",
  request_source: "source",
};

/** Clones a positive fixture and strips exactly the field(s) needed to violate one required-context token. */
function omitRequiredContext(fixture: SecurityAuditEvent, context: string): SecurityAuditEvent | undefined {
  const raw = structuredClone(fixture) as SecurityAuditEvent & Record<string, unknown>;
  switch (context) {
    case "change_categories":
    case "change_category":
      if (raw.resource) delete (raw.resource as Record<string, unknown>).change_categories;
      return raw;
    case "deletion_mode":
      if (raw.resource) delete (raw.resource as Record<string, unknown>).deletion_mode;
      return raw;
    case "bounded_volume":
      if (raw.resource?.export) delete (raw.resource.export as Record<string, unknown>).record_count;
      return raw;
    case "destination_class":
      if (raw.resource?.export) delete (raw.resource.export as Record<string, unknown>).destination_class;
      return raw;
    case "claimed_tenant":
      if (raw.tenant) delete (raw.tenant as Record<string, unknown>).claimed_tenant_id;
      return raw;
    case "reason":
      (raw.event as Record<string, unknown>).outcome_reason = undefined;
      delete (raw.event as Record<string, unknown>).outcome_reason;
      return raw;
    case "operation":
    case "transaction":
      delete (raw.correlation as Record<string, unknown>).transaction_id;
      return raw;
    default: {
      const field = REQUIRED_CONTEXT_FIELD[context] ?? context;
      if (!(field in raw)) return undefined;
      delete raw[field];
      return raw;
    }
  }
}
