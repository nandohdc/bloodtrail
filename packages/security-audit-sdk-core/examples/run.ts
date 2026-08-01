import { strict as assert } from "node:assert";
import {
  administrativeImpersonation,
  asynchronousCompletion,
  authenticationSuccess,
  authorizationAllowThenFailure,
  authorizationDenial,
  concurrentContexts,
  crossTenantDenial,
  deterministicTesting,
  privacyTransformation,
  registeredExtension,
  retryReexecution,
  roleAssignment,
  sensitiveDataExport,
  sensitiveResourceModification,
  transactionAwareSuccess,
} from "./scenarios.js";

const authentication = await authenticationSuccess();
assert.equal(authentication.event.name, "bloodtrail.audit.authentication.succeeded");
assert.equal(authentication.event.outcome, "success");

const denied = await authorizationDenial();
assert.equal(denied.authorization?.decision, "deny");
assert.equal(denied.event.outcome, "denied");

const crossTenant = await crossTenantDenial();
assert.equal(crossTenant.tenant.scope, "cross_tenant");
assert.equal(crossTenant.tenant.claimed_tenant_id, "tenant-alpha");
assert.equal(crossTenant.authorization?.decision, "deny");

const role = await roleAssignment();
assert.equal(role.event.name, "bloodtrail.audit.authorization.role.assigned");
assert.equal(role.event.commit_state, "committed");

const impersonation = await administrativeImpersonation();
assert.equal(impersonation.delegation?.mode, "impersonation");
assert.equal(impersonation.tenant.scope, "cross_tenant");
assert.equal(impersonation.event.commit_state, "committed");

const modified = await sensitiveResourceModification();
assert.equal(modified.resource.operation_type, "update");
assert.equal(modified.event.commit_state, "committed");

const exported = await sensitiveDataExport();
assert.equal(exported.resource.export?.record_count, 12);
assert.equal(exported.event.delivery_class, "policy_critical");

const asynchronous = await asynchronousCompletion();
assert.ok(asynchronous.correlation.causation_id);
assert.ok(asynchronous.correlation.original_event_id);
assert.equal(asynchronous.event.commit_state, "committed");

const { original, retried } = await retryReexecution();
assert.notEqual(retried.event.id, original.event.id);
assert.equal(retried.correlation.original_event_id, original.event.id);
assert.equal(retried.correlation.retry_attempt, 1);

const transactional = await transactionAwareSuccess();
assert.equal(transactional.event.outcome, "success");
assert.equal(transactional.event.commit_state, "committed");

const failedAfterAllow = await authorizationAllowThenFailure();
assert.equal(failedAfterAllow.authorization?.decision, "allow");
assert.equal(failedAfterAllow.event.outcome, "failure");
assert.equal(failedAfterAllow.event.commit_state, "not_committed");

const transformed = await privacyTransformation();
assert.match(transformed.actor.id ?? "", /^pseudonym-tenant-alpha-authentication_succeeded-/);

const extended = await registeredExtension();
assert.equal(
  extended.extensions?.["bloodtrail.audit.enrichment.v1"]?.provenance.trust_level,
  "downstream_enrichment",
);

const concurrent = await concurrentContexts();
assert.deepEqual(
  new Set(concurrent.map((event) => event.tenant.effective_tenant_id)),
  new Set(["tenant-alpha", "tenant-beta"]),
);

const deterministic = await deterministicTesting();
assert.equal(deterministic.event.id, "33333333-3333-4333-8333-000000001500");
assert.equal(deterministic.event.timestamp, "2026-07-31T12:00:00.000Z");
assert.equal(deterministic.event.observed_at, "2026-07-31T12:00:00.000Z");

process.stdout.write("15 compilable SDK documentation scenarios passed\n");
