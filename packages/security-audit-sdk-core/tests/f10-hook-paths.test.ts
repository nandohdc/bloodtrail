import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  SecurityAuditSdkError,
  authenticatedHumanActor,
  authenticatedPrincipal,
  authenticationEvidence,
  authoritativeTenant,
  createSecurityAuditSdk,
  credentialReference,
  observedSource,
  sessionEvidence,
  type AuditFieldTransformationHook,
  type SecurityAuditSdkConfiguration,
} from "../dist/index.js";
import { normalizeConfiguration, type NormalizedSdkConfiguration } from "../dist/config.js";
import { buildNamedAuditEvent } from "../dist/events.js";
import { fieldPolicyForPath, isTransformableFieldPath } from "../dist/internal.js";
import { FIELD_POLICY } from "../dist/generated/contract.generated.js";
import { createCapturingAuditSink } from "../dist/testing.js";

const TRANSFORMABLE_PATHS = FIELD_POLICY.map((entry) => entry.path).filter((path) => isTransformableFieldPath(path));
const BLOCKED_POLICY_PATHS = FIELD_POLICY.map((entry) => entry.path).filter((path) => !isTransformableFieldPath(path));
const HOSTILE_PATH_SAMPLES = [
  "",
  ".",
  "actor",
  "event",
  "no.such.path",
  ".actor.id",
  "actor.id.",
  "actor..id",
  "actor.*",
  "*",
  "actor[0]",
  "actor[0].id",
  "__proto__",
  "prototype",
  "constructor",
  "actor.__proto__.id",
  "actor.constructor",
  "actor.prototype",
  "actor.id ",
  " actor.id",
  "actor.\u0007id",
  "EVENT.ID",
  "Actor.Id",
  `${"padding.".repeat(80)}actor.id`,
];

function validInput(): Record<string, unknown> {
  return {
    actor: authenticatedHumanActor({ id: "synthetic-actor", tenantId: "tenant-alpha", source: "synthetic-server-authentication-authority" }),
    tenant: authoritativeTenant({
      scope: "tenant",
      actor_tenant_id: "tenant-alpha",
      effective_tenant_id: "tenant-alpha",
      resource_tenant_id: "tenant-alpha",
    }),
    authenticated_principal: authenticatedPrincipal({ type: "human_user", id: "synthetic-principal", issuer: "https://idp.example.test" }),
    authentication: authenticationEvidence({
      method: "password_mfa",
      assurance_level: "aal2",
      mfa_state: "satisfied",
      credential_type: "session",
      authenticated_at: "2026-07-31T12:00:00.000Z",
      identity_provider: "https://idp.example.test",
      delegated: false,
      impersonated: false,
    }),
    credential: credentialReference({ type: "session", reference: "synthetic-credential", key_id: "synthetic-key-version-1" }),
    session: sessionEvidence({ id: "synthetic-session", created_at: "2026-07-31T12:00:00.000Z", age_seconds: 60, assurance_level: "aal2" }),
    source: observedSource({ observed: { address: "192.0.2.10", port: 443 }, client_reported: { user_agent_family: "SyntheticClient", user_agent_version: "1" } }),
  };
}

function hookReturning(value: string): AuditFieldTransformationHook {
  return { path: "actor.id", transform: () => value };
}

function configurationWith(transformations: readonly AuditFieldTransformationHook[]): {
  configuration: SecurityAuditSdkConfiguration;
  sink: ReturnType<typeof createCapturingAuditSink>;
} {
  const sink = createCapturingAuditSink();
  let sequence = 7_000;
  const uuid = () => {
    sequence += 1;
    return `00000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
  };
  return {
    sink,
    configuration: {
      contractVersion: "1.0.0",
      producer: { name: "f10-test", version: "1.0.0" },
      service: { name: "f10-test", version: "1.0.0" },
      environment: { name: "test" },
      sink,
      clock: { now: () => new Date("2026-08-03T00:00:00.000Z") },
      identifiers: {
        eventId: uuid,
        operationId: () => `op-${sequence}`,
        correlationId: () => `cor-${sequence}`,
        causationId: () => `cau-${sequence}`,
        requestId: () => `req-${sequence}`,
        messageId: () => `msg-${sequence}`,
        transactionId: () => `txn-${sequence}`,
      },
      shutdownTimeoutMs: 100,
      transformations,
    },
  };
}

function assertConstructionRejects(
  path: unknown,
  expectedDiagnosticPath: string,
): SecurityAuditSdkError {
  const counter = { calls: 0 };
  const hook = { path: path as never, transform: () => { counter.calls += 1; return "masked"; } };
  const { configuration, sink } = configurationWith([hook]);
  let thrown: unknown;
  try {
    createSecurityAuditSdk(configuration);
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof SecurityAuditSdkError, `path ${String(path)} must throw SecurityAuditSdkError`);
  const error = thrown as SecurityAuditSdkError;
  assert.equal(error.constructor, SecurityAuditSdkError);
  assert.equal(error.code, "SDK_INVALID_CONFIGURATION");
  assert.equal(error.category, "configuration");
  assert.equal(error.path, expectedDiagnosticPath);
  assert.equal(error.message, "SDK_INVALID_CONFIGURATION");
  assert.equal(counter.calls, 0, "hook function must not be invoked during construction");
  assert.equal(sink.events.length, 0, "sink must not be invoked when construction fails");
  return error;
}

test("F-10 construction: event.outcome_reason.code fails during SDK construction instead of failing late per event", () => {
  const error = assertConstructionRejects("event.outcome_reason.code", "/transformations/0/path");
  assert.equal(JSON.stringify(error.toJSON()).includes("outcome_reason"), false);
});

test("F-10 construction: event.outcome_reason.message fails during SDK construction instead of failing late per event", () => {
  const error = assertConstructionRejects("event.outcome_reason.message", "/transformations/0/path");
  assert.equal(JSON.stringify(error.toJSON()).includes("outcome_reason"), false);
});

test("F-10 construction: protected authority, identity, schema, tenant, decision, and delivery paths are rejected", () => {
  const protectedPaths = [
    "actor.provenance.trust_level",
    "risk.model.provenance.trust_level",
    "authorization.decision",
    "tenant.scope",
    "event.id",
    "event.name",
    "event.outcome",
    "event.commit_state",
    "event.timestamp",
    "event.delivery_class",
    "schema.name",
    "schema.version",
    "correlation.correlation_id",
    "correlation.operation_id",
    "correlation.trace_id",
    "producer.name",
    "actor.type",
  ];
  for (const path of protectedPaths) assertConstructionRejects(path, "/transformations/0/path");
});

test("F-10 construction: malformed, wildcard, bracket, and prototype-pollution path syntax is rejected", () => {
  for (const path of HOSTILE_PATH_SAMPLES) assertConstructionRejects(path, "/transformations/0/path");
});

test("F-10 construction: non-string, boxed, and accessor-backed hostile path values fail safely", () => {
  const nonString = [42, null, true, 10n, Symbol("path"), new String("actor.id"), {}, []];
  for (const value of nonString) assertConstructionRejects(value, "/transformations/0");

  const hostileAccessor = {
    get path(): string {
      throw new Error("hostile getter must never surface raw");
    },
    transform: () => "masked",
  };
  const { configuration } = configurationWith([hostileAccessor]);
  let thrown: unknown;
  try {
    createSecurityAuditSdk(configuration);
  } catch (error) {
    thrown = error;
  }
  assert.ok(thrown instanceof SecurityAuditSdkError, "accessor failure must be normalized to SecurityAuditSdkError");
  const error = thrown as SecurityAuditSdkError;
  assert.equal(error.code, "SDK_INVALID_CONFIGURATION");
  assert.equal(error.category, "configuration");
  assert.equal(error.message, "SDK_INVALID_CONFIGURATION");
  assert.equal(JSON.stringify(error.toJSON()).includes("hostile getter"), false);
});

test("F-10 construction: one invalid hook fails the whole configuration atomically and no SDK instance is returned", () => {
  const { configuration, sink } = configurationWith([
    hookReturning("first"),
    { path: "event.name", transform: () => "bloodtrail.audit.authentication.failed" },
  ]);
  assert.throws(
    () => createSecurityAuditSdk(configuration),
    (error: unknown) => {
      assert.ok(error instanceof SecurityAuditSdkError);
      const sdkError = error as SecurityAuditSdkError;
      assert.equal(sdkError.code, "SDK_INVALID_CONFIGURATION");
      assert.equal(sdkError.category, "configuration");
      assert.equal(sdkError.path, "/transformations/1/path");
      return true;
    },
  );
  assert.equal(sink.events.length, 0);

  const reversed = configurationWith([
    { path: "event.outcome_reason.code", transform: () => "masked" },
    hookReturning("second"),
  ]);
  assert.throws(() => createSecurityAuditSdk(reversed.configuration), SecurityAuditSdkError);
});

test("F-10 valid paths: a known valid transformable path remains accepted and its transform reaches the sink", async () => {
  const counter = { calls: 0 };
  const hook = {
    path: "actor.id",
    transform: ({ value }: { value: string }) => {
      counter.calls += 1;
      return { value: `pseudonym_${value}`, key_id: "synthetic-key-version-1" };
    },
  };
  const { configuration, sink } = configurationWith([hook as AuditFieldTransformationHook]);
  const sdk = createSecurityAuditSdk(configuration);
  assert.equal(counter.calls, 0, "valid hooks are not invoked during construction");
  const result = await sdk.authenticationSucceeded(validInput() as never);
  assert.equal(result.ok, true);
  assert.equal(counter.calls, 1);
  assert.equal(sink.events.length, 1);
  assert.equal(sink.events.at(-1)?.actor?.id, "pseudonym_synthetic-actor");
});

test("F-10 valid paths: every runtime-transformable policy path is accepted at construction", () => {
  assert.equal(TRANSFORMABLE_PATHS.length, 59, "contract 1.0.0 transformable path inventory changed");
  for (const path of TRANSFORMABLE_PATHS) {
    const { configuration } = configurationWith([{ path, transform: () => "masked" }]);
    const normalized = normalizeConfiguration(configuration);
    assert.equal(normalized.transformations[0]?.path, path);
  }
});

test("F-10 valid paths: no-hook and multiple-hook configurations remain valid and hook order is preserved", async () => {
  const empty = configurationWith([]);
  const emptySdk = createSecurityAuditSdk(empty.configuration);
  assert.equal((await emptySdk.authenticationSucceeded(validInput() as never)).ok, true);
  assert.equal(empty.sink.events.length, 1);

  const orderedPaths = ["actor.id", "subject.id", "session.id", "request.user_agent"];
  const hooks = orderedPaths.map((path) => ({ path, transform: () => "masked" }));
  const { configuration } = configurationWith(hooks);
  const normalized = normalizeConfiguration(configuration);
  assert.deepEqual(normalized.transformations.map((entry) => entry.path), orderedPaths);
});

test("F-10 parity: configuration acceptance equals runtime transformability across the finite policy surface", () => {
  const samples = [...FIELD_POLICY.map((entry) => entry.path), ...HOSTILE_PATH_SAMPLES];
  for (const path of samples) {
    let accepted = false;
    try {
      normalizeConfiguration(configurationWith([{ path, transform: () => "masked" }]).configuration);
      accepted = true;
    } catch (error) {
      assert.ok(error instanceof SecurityAuditSdkError, `unexpected throw type for ${path}`);
    }
    assert.equal(
      accepted,
      isTransformableFieldPath(path),
      `construction/runtime policy mismatch for ${JSON.stringify(path)}`,
    );
  }
  assert.equal(BLOCKED_POLICY_PATHS.length, 75, "contract 1.0.0 blocked policy-path inventory changed");
  assert.equal(fieldPolicyForPath("event.outcome_reason.code")?.policy, "conditionally_allowed");
});

test("F-10 runtime defense: an internally injected invalid path is still rejected with bounded SDK_HOOK_FAILURE", () => {
  const counter = { calls: 0 };
  const { configuration } = configurationWith([hookReturning("masked")]);
  const normalized = normalizeConfiguration(configuration);
  const injectedHook = {
    path: "event.outcome_reason.code",
    transform: () => {
      counter.calls += 1;
      return "masked";
    },
  };
  const tampered = {
    ...normalized,
    transformations: Object.freeze([Object.freeze({ path: "event.outcome_reason.code", hook: injectedHook })]),
  } as unknown as NormalizedSdkConfiguration;
  const input = validInput();
  input.event = { outcome_reason: { code: "original_code", message: "original message" } };
  const result = buildNamedAuditEvent(tampered, "authenticationSucceeded", input as never, undefined);
  assert.equal(result.ok, false, "runtime defense must reject the injected intrinsically unsupported path");
  if (!result.ok) {
    assert.equal(result.error.code, "SDK_HOOK_FAILURE");
    assert.equal(result.error.category, "privacy");
    assert.equal(result.error.path, "/event/outcome_reason/code");
  }
  assert.equal(counter.calls, 0, "runtime path enforcement precedes hook invocation");
});

test("F-10 runtime defense: dynamic hook failures retain bounded runtime codes after construction validation", async () => {
  const throwing = configurationWith([{
    path: "actor.id",
    transform: () => {
      throw new Error("dynamic hook failure cause stays bounded");
    },
  }]);
  const throwingSdk = createSecurityAuditSdk(throwing.configuration);
  const thrown = await throwingSdk.authenticationSucceeded(validInput() as never);
  assert.equal(thrown.ok, false);
  if (!thrown.ok) assert.equal(thrown.error.code, "SDK_HOOK_FAILURE");
  assert.equal(JSON.stringify(thrown).includes("dynamic hook failure cause"), false);

  const asyncHook = configurationWith([{
    path: "actor.id",
    transform: (async () => "late") as never,
  }]);
  const asyncSdk = createSecurityAuditSdk(asyncHook.configuration);
  const late = await asyncSdk.authenticationSucceeded(validInput() as never);
  assert.equal(late.ok, false);
  if (!late.ok) assert.equal(late.error.code, "SDK_UNSUPPORTED_HOOK_RESULT");
});

test("F-10 ownership: caller-owned hook functions and arrays remain unfrozen and uninvoked by construction", () => {
  const counter = { calls: 0 };
  const hook = {
    path: "actor.id",
    transform: ({ value }: { value: string }) => {
      counter.calls += 1;
      return `pseudonym_${value}`;
    },
  };
  const transformations = [hook];
  const { configuration } = configurationWith(transformations);
  const normalized = normalizeConfiguration(configuration);
  assert.equal(counter.calls, 0, "construction must not invoke hook functions");
  assert.equal(Object.isFrozen(hook), false, "caller-owned hook object remains unfrozen");
  assert.equal(Object.isFrozen(hook.transform), false, "caller-owned hook function remains unfrozen");
  assert.equal(Object.isFrozen(transformations), false, "caller-owned hook array remains unfrozen");
  assert.equal(Object.isFrozen(configuration), false, "caller-owned configuration envelope remains unfrozen");
  assert.equal(Object.isFrozen(normalized.transformations), true, "normalized registrations are SDK-owned and frozen");
  assert.equal(normalized.transformations[0]?.hook, hook, "normalized registration references the exact caller-owned hook");
});

test("F-10 diagnostics: construction rejection never echoes configured path content", () => {
  const marker = "z9uniquemarker7z";
  const hostilePath = `event.outcome_reason.code.${marker}.padding`;
  const error = assertConstructionRejects(hostilePath, "/transformations/0/path");
  const serialized = JSON.stringify(error.toJSON());
  assert.equal(serialized.includes(marker), false, "configured path content must not leak into diagnostics");
  assert.equal(serialized.includes(hostilePath), false);
  assert.ok(serialized.length < 256, "diagnostics remain bounded");
});
