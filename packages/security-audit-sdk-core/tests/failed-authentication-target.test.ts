// A failed authentication may target only the credential (#862, ADR-SDK-019).
//
// The SDK-only rule refuses an account target on bloodtrail.audit.authentication.failed: a subject
// typed other than credential or identified without a type, a subject display name, a resource or an
// authorization resource context typed other than credential or identified without a type, or any
// resource parent. An empty subject and an untyped resource without an identity name no target. The contract's approved example (a credential subject, credential fields and a
// credential resource) and the resource the SDK derives when none is supplied stay valid. Every
// shared validation path refuses identically, before any sink handoff, and the rule runs last.

import { strict as assert } from "node:assert";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { test } from "node:test";
import {
  anonymousActor, authenticatedPrincipal, authenticationEvidence, authoritativeActor, authorizationEvidence,
  authoritativeResource, authoritativeSubject, authoritativeTenant, claimedActor, claimedTenant,
  createSecurityAuditSdk, credentialReference, observedSource, sessionEvidence, validateSecurityAuditEvent,
  type AuditDeliveryResult, type AuditResult, type SecurityAuditEvent,
} from "../dist/index.js";
import { createCapturingAuditSink } from "../dist/testing.js";
import { createConformanceSdk, type ConformanceHarnessContext } from "./conformance-harness.js";

type Failure = Extract<AuditResult<never>, { ok: false }>;
type Patch = (event: SecurityAuditEvent) => void;
type Pointer = "/subject/type" | "/subject/display_name" | "/resource/type" | "/resource/parent_type" | "/resource/parent_id"
  | "/authorization/resource_context/type";

const FAILED = "bloodtrail.audit.authentication.failed";
const contractRoot = resolve(process.cwd(), "../../contracts/security-audit");
const fixtures: readonly SecurityAuditEvent[] = JSON.parse(await readFile(
  resolve(contractRoot, "examples/positive/all-events.json"), "utf8",
));

function fixture(name: string): SecurityAuditEvent {
  const match = fixtures.find((candidate) => candidate.event.name === name);
  assert.ok(match, name);
  return structuredClone(match);
}

function failedAuthentication(patch: Patch = () => {}): SecurityAuditEvent {
  const event = fixture(FAILED);
  patch(event);
  return event;
}

function targetFailure(path: Pointer): Failure {
  return { ok: false, error: { code: "SDK_SEMANTIC_VALIDATION_FAILED", category: "validation", path } };
}

const writable = (event: SecurityAuditEvent) => event as unknown as Record<string, unknown>;

// Each refused shape, with the path its refusal names. Stage P's P-attr cases in brackets.
const REFUSED: readonly (readonly [string, Patch, Pointer])[] = [
  ["an account subject (AF-C4, AF-C5)", (event) => {
    writable(event).subject = { type: "account", id: "account_ref_1", tenant_id: event.subject?.tenant_id };
  }, "/subject/type"],
  ["a subject identity without a type", (event) => {
    writable(event).subject = { id: "account_ref_1" };
  }, "/subject/type"],
  ["a subject with no type, naming only the target's tenant", (event) => {
    writable(event).subject = { tenant_id: "tenant_of_the_target" };
  }, "/subject/type"],
  ["a subject with no type, holding only a display name (AF-C3s)", (event) => {
    writable(event).subject = { display_name: "display_digest_1" };
  }, "/subject/display_name"],
  ["a credential subject carrying a display name (AF-C3s with a type)", (event) => {
    writable(event).subject = { type: "credential", id: "credential_subject_1", display_name: "display_digest_1" };
  }, "/subject/display_name"],
  ["an account resource (AF-CR)", (event) => {
    writable(event).resource = { ...event.resource, type: "account", id: "account_ref_1" };
  }, "/resource/type"],
  ["a resource identity without a type", (event) => {
    const { type: _type, ...untyped } = event.resource;
    writable(event).resource = { ...untyped, id: "target_ref_1" };
  }, "/resource/type"],
  ["a credential resource naming an account as its parent", (event) => {
    writable(event).resource = { ...event.resource, parent_type: "account", parent_id: "account_ref_1" };
  }, "/resource/parent_type"],
  ["a parent type alone on the derived resource", (event) => {
    writable(event).resource = { operation_type: "execute", parent_type: "account" };
  }, "/resource/parent_type"],
  ["a parent identity without a type", (event) => {
    writable(event).resource = { operation_type: "execute", parent_id: "target_ref_1" };
  }, "/resource/parent_id"],
  ["an account named by the authorization's resource context", (event) => {
    assert.ok(event.authorization);
    writable(event).authorization = { ...event.authorization, resource_context: { type: "account", id: "account_ref_1" } };
  }, "/authorization/resource_context/type"],
  ["an authorization resource identity without a type", (event) => {
    assert.ok(event.authorization);
    writable(event).authorization = { ...event.authorization, resource_context: { id: "account_ref_1" } };
  }, "/authorization/resource_context/type"],
];

// Shapes the rule must leave alone.
const ACCEPTED: readonly (readonly [string, Patch])[] = [
  ["the contract's approved example: a credential subject, credential fields and a credential resource", () => {}],
  ["no subject and the typeless resource the SDK derives when none is supplied", (event) => {
    delete writable(event).subject;
    writable(event).resource = { operation_type: "execute" };
  }],
  ["an empty subject, which names no target", (event) => {
    writable(event).subject = {};
  }],
  ["no subject and an untyped resource without an identity", (event) => {
    delete writable(event).subject;
    const { type: _type, id: _id, ...untyped } = event.resource;
    writable(event).resource = untyped;
  }],
];

const COMPLETE_PATHS = ["emit", "redeliver", "validateSecurityAuditEvent"] as const;

async function completeResult(
  event: SecurityAuditEvent,
  path: (typeof COMPLETE_PATHS)[number],
  context: ConformanceHarnessContext,
): Promise<AuditResult<unknown>> {
  if (path === "validateSecurityAuditEvent") return validateSecurityAuditEvent(event);
  return context.sdk[path](event);
}

function fixtureActor(actor: SecurityAuditEvent["actor"]) {
  if (actor.type === "anonymous") return anonymousActor(actor.provenance?.source);
  if (actor.provenance?.trust_level === "client_claim") return claimedActor(actor);
  return authoritativeActor(actor);
}

function fixtureTenant(tenant: SecurityAuditEvent["tenant"]) {
  const { claimed_tenant_id: _claim, ...authority } = tenant;
  return authoritativeTenant(authority as Parameters<typeof authoritativeTenant>[0]);
}

const CONTEXT_CONSTRUCTORS = {
  actor: fixtureActor, tenant: fixtureTenant, subject: authoritativeSubject,
  authenticated_principal: authenticatedPrincipal, authentication: authenticationEvidence, authorization: authorizationEvidence,
  credential: credentialReference, session: sessionEvidence, source: observedSource,
  resource: authoritativeResource,
};

/** Reuse the exported constructors: raw fixture objects never grant named-call authority. */
function namedInput(event: SecurityAuditEvent): Record<string, unknown> {
  const { commit_state: _commit, id: _id, ...fields } = event.event;
  const input: Record<string, unknown> = { event: fields, request: event.request, correlation: event.correlation };
  for (const [key, constructor] of Object.entries(CONTEXT_CONSTRUCTORS)) {
    const value = event[key as keyof typeof CONTEXT_CONSTRUCTORS];
    if (value !== undefined) input[key] = constructor(value as never);
  }
  if (event.tenant.claimed_tenant_id !== undefined) input.claimedTenant = claimedTenant(event.tenant.claimed_tenant_id);
  return input;
}

async function namedResult(event: SecurityAuditEvent, context: ConformanceHarnessContext): Promise<AuditResult<AuditDeliveryResult>> {
  return context.sdk.authenticationFailed(namedInput(event) as never);
}

for (const [shape, patch, path] of REFUSED) {
  test(`failed authentication: ${shape} is refused at ${path} on every complete-event path, with no sink call`, async () => {
    for (const completePath of COMPLETE_PATHS) {
      const context = createConformanceSdk();
      const result = await completeResult(failedAuthentication(patch), completePath, context);
      assert.deepEqual(result, targetFailure(path), completePath);
      assert.equal(context.sink.events.length, 0, completePath);
    }
  });

  test(`failed authentication: ${shape} is refused at ${path} by the named method`, async () => {
    const context = createConformanceSdk();
    const result = await namedResult(failedAuthentication(patch), context);
    assert.deepEqual(result, targetFailure(path));
    assert.equal(context.sink.events.length, 0);
  });
}

for (const [shape, patch] of ACCEPTED) {
  test(`failed authentication: ${shape} is accepted on every path`, async () => {
    for (const completePath of COMPLETE_PATHS) {
      const context = createConformanceSdk();
      const result = await completeResult(failedAuthentication(patch), completePath, context);
      assert.ok(result.ok, `${completePath}: ${JSON.stringify(result)}`);
    }
    const context = createConformanceSdk();
    const named = await namedResult(failedAuthentication(patch), context);
    assert.ok(named.ok, JSON.stringify(named));
    assert.equal(context.sink.events.length, 1);
  });
}

test("failed authentication: the named method with no resource input stores the derived resource and is accepted", async () => {
  const context = createConformanceSdk();
  const input = namedInput(failedAuthentication((event) => { delete writable(event).subject; }));
  delete input.resource;
  const result = await context.sdk.authenticationFailed(input as never);
  assert.ok(result.ok, JSON.stringify(result));
  assert.deepEqual(context.sink.events[0]?.resource, { operation_type: "execute" });
});

test("failed authentication: an earlier semantic check keeps its own diagnostic, because this rule runs last", () => {
  // Missing required context is judged inside the shared semantic checks, before this rule.
  const event = failedAuthentication((candidate) => {
    writable(candidate).subject = { type: "account", id: "account_ref_1" };
    delete writable(candidate).source;
  });
  assert.deepEqual(validateSecurityAuditEvent(event), {
    ok: false, error: { code: "SDK_MISSING_EVENT_FIELD", category: "validation", path: "/source" },
  });
});

test("failed authentication: a later semantic check still keeps its own diagnostic", () => {
  // Delegation is judged near the end of the shared semantic checks, still before this rule.
  const event = failedAuthentication((candidate) => {
    writable(candidate).subject = { type: "account", id: "account_ref_1" };
    writable(candidate).delegation = { mode: "synthetic" };
  });
  assert.deepEqual(validateSecurityAuditEvent(event), {
    ok: false, error: { code: "INVALID_DELEGATION", category: "validation", path: "/delegation" },
  });
});

test("failed authentication: derived-field provenance keeps its diagnostic, because it is judged before this rule", () => {
  const event = failedAuthentication((candidate) => {
    writable(candidate).subject = { type: "account", id: "account_ref_1" };
    writable(candidate).risk = { score: 10 };
  });
  assert.deepEqual(validateSecurityAuditEvent(event), {
    ok: false, error: { code: "DERIVED_FROM_MISSING", category: "validation", path: "/risk/model/provenance/trust_level" },
  });
});

test("failed authentication: a subject inherited from the active context counts, and a credential subject overrides it", async () => {
  const context = createConformanceSdk();
  const input = namedInput(failedAuthentication((event) => { delete writable(event).subject; }));
  const scope = { subject: authoritativeSubject({ type: "account", id: "account_ref_1" }) };

  const inherited = await context.sdk.runWithContext(scope, () => context.sdk.authenticationFailed(input as never));
  assert.deepEqual(inherited, targetFailure("/subject/type"));
  assert.equal(context.sink.events.length, 0);

  const overridden = await context.sdk.runWithContext(scope, () => context.sdk.authenticationFailed({
    ...input, subject: authoritativeSubject({ type: "credential", id: "credential_subject_1" }),
  } as never));
  assert.ok(overridden.ok, JSON.stringify(overridden));
  assert.equal(context.sink.events.length, 1);
});

test("failed authentication: a subject or resource from the configured base context counts", async () => {
  for (const [slot, value, pointer] of [
    ["subject", authoritativeSubject({ type: "account", id: "account_ref_1" }), "/subject/type"],
    ["resource", authoritativeResource({ type: "account", id: "account_ref_1", operation_type: "execute" }), "/resource/type"],
  ] as const) {
    const sink = createCapturingAuditSink();
    const sdk = createSecurityAuditSdk({
      contractVersion: "2.1.0",
      producer: { name: "synthetic-conformance-producer", version: "1.0.0" },
      service: { name: "synthetic-conformance-service", version: "1.0.0" },
      environment: { name: "test" },
      sink,
      authoritativeContext: { [slot]: value },
    });
    const input = namedInput(failedAuthentication((event) => {
      delete writable(event).subject;
      writable(event).resource = { operation_type: "execute" };
    }));
    delete input.subject;
    delete input.resource;
    assert.deepEqual(await sdk.authenticationFailed(input as never), targetFailure(pointer), slot);
    assert.equal(sink.events.length, 0, slot);
  }
});

test("failed authentication: a resource inherited from the active context counts", async () => {
  const context = createConformanceSdk();
  const input = namedInput(failedAuthentication((event) => { delete writable(event).subject; }));
  delete input.resource;
  const scope = { resource: authoritativeResource({ type: "account", id: "account_ref_1", operation_type: "execute" }) };
  const result = await context.sdk.runWithContext(scope, () => context.sdk.authenticationFailed(input as never));
  assert.deepEqual(result, targetFailure("/resource/type"));
  assert.equal(context.sink.events.length, 0);
});

test("failed authentication: named redelivery of a complete event with an account subject is refused", async () => {
  const context = createConformanceSdk();
  const event = failedAuthentication((candidate) => {
    writable(candidate).subject = { type: "account", id: "account_ref_1" };
  });
  const result = await context.sdk.authenticationFailed({ redelivery: { event } } as never);
  assert.deepEqual(result, targetFailure("/subject/type"));
  assert.equal(context.sink.events.length, 0);
});

test("the catalog resource rule this SDK-only rule copies is unchanged", async () => {
  // The rule is hand-copied from prose the generator does not carry; a contract change to it must
  // fail here and send the change back to ADR-SDK-019.
  const catalog: readonly { name: string; resource_rule: string }[] = JSON.parse(await readFile(
    resolve(contractRoot, "catalog/catalog.json"), "utf8",
  ));
  assert.equal(catalog.find((entry) => entry.name === FAILED)?.resource_rule, "credential type only when safe");
});

test("control: another event carrying an account subject is not refused by this rule", () => {
  const event = fixture("bloodtrail.audit.authentication.succeeded");
  writable(event).subject = { type: "account", id: "account_ref_1", tenant_id: event.subject?.tenant_id };
  const result = validateSecurityAuditEvent(event);
  assert.ok(result.ok, JSON.stringify(result));
});
