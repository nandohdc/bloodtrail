import { test } from "node:test";
import {
  administratorActor,
  apiCredentialActor,
  authoritativeResource,
  authoritativeSubject,
  authoritativeTenant,
  authorizationEvidence,
  claimedTenant,
  delegationContext,
  observedSource,
  scheduledProcessActor,
  sessionEvidence,
  workloadIdentityActor,
} from "../dist/index.js";
import {
  assertValidConformanceRow,
  createConformanceSdk,
  type ValidConformanceRow,
} from "./conformance-harness.js";

const syntheticTenant = authoritativeTenant({
  scope: "tenant",
  actor_tenant_id: "tenant-conformance-1",
  effective_tenant_id: "tenant-conformance-1",
  resource_tenant_id: "tenant-conformance-1",
});

const platformTenant = authoritativeTenant({
  scope: "platform",
  actor_tenant_id: "tenant-platform",
});

const crossTenant = authoritativeTenant({
  scope: "cross_tenant",
  actor_tenant_id: "tenant-platform",
  effective_tenant_id: "tenant-conformance-1",
  resource_tenant_id: "tenant-conformance-1",
});

const syntheticAdminActor = administratorActor({
  id: "admin-conformance-1",
  displayName: "Admin One",
});

const syntheticWorkloadActor = workloadIdentityActor({
  id: "workload-conformance-1",
  displayName: "Workload One",
});

const syntheticApiActor = apiCredentialActor({
  id: "api-conformance-1",
  displayName: "API Credential One",
});

const syntheticProcessActor = scheduledProcessActor({
  id: "process-conformance-1",
  displayName: "Process One",
});

const policyResource = authoritativeResource({
  type: "authorization_policy",
  id: "policy-resource-conformance-1",
  owning_tenant_id: "tenant-conformance-1",
  data_classification: "confidential",
  operation_type: "execute",
  change_categories: ["metadata"],
});

const roleResource = authoritativeResource({
  type: "role",
  id: "role-conformance-1",
  owning_tenant_id: "tenant-conformance-1",
  data_classification: "confidential",
  operation_type: "administer",
  change_categories: ["metadata"],
});

const privilegeGrantResource = authoritativeResource({
  type: "privilege_grant",
  id: "priv-grant-conformance-1",
  data_classification: "restricted",
  operation_type: "administer",
  change_categories: ["metadata"],
});

const impersonationSessionResource = authoritativeResource({
  type: "impersonation_session",
  id: "session-imp-conformance-1",
  owning_tenant_id: "tenant-conformance-1",
  data_classification: "restricted",
  operation_type: "administer",
  change_categories: ["metadata"],
});

const roleSubject = authoritativeSubject({
  type: "role",
  id: "role-subject-conformance-1",
  tenant_id: "tenant-conformance-1",
});

const privilegeSubject = authoritativeSubject({
  type: "privilege_grant",
  id: "priv-subject-conformance-1",
});

const impersonationSubject = authoritativeSubject({
  type: "impersonation_session",
  id: "imp-subject-conformance-1",
  tenant_id: "tenant-conformance-1",
});

function createAuthorizationEvidenceFixture(params: {
  readonly capability: string;
  readonly enforcementPoint: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly decision?: "allow" | "deny";
  readonly decisionReason?: Parameters<typeof authorizationEvidence>[0]["decision_reason"];
  readonly tenantId?: string;
  readonly override?: boolean;
  readonly breakGlass?: boolean;
}) {
  return authorizationEvidence({
    decision: params.decision ?? "allow",
    policy_id: "policy.conformance-1",
    policy_version: "1.0.0",
    capability: params.capability,
    enforcement_point: params.enforcementPoint,
    decision_reason: params.decisionReason ?? "accepted",
    resource_context: {
      type: params.resourceType,
      id: params.resourceId,
    },
    ...(params.tenantId !== undefined
      ? { tenant_context: { effective_tenant_id: params.tenantId } }
      : {}),
    ...(params.override !== undefined ? { override: params.override } : {}),
    ...(params.breakGlass !== undefined ? { break_glass: params.breakGlass } : {}),
  });
}

const authzAllowPolicy = createAuthorizationEvidenceFixture({
  capability: "evaluate_authorization",
  enforcementPoint: "policy-enforcement-point",
  resourceType: "authorization_policy",
  resourceId: "policy-resource-conformance-1",
  tenantId: "tenant-conformance-1",
});

const authzDenyPolicy = createAuthorizationEvidenceFixture({
  decision: "deny",
  decisionReason: "policy_denied",
  capability: "evaluate_authorization",
  enforcementPoint: "policy-enforcement-point",
  resourceType: "authorization_policy",
  resourceId: "policy-resource-conformance-1",
  tenantId: "tenant-conformance-1",
});

const authzRole = createAuthorizationEvidenceFixture({
  capability: "administer_role",
  enforcementPoint: "role-authority",
  resourceType: "role",
  resourceId: "role-conformance-1",
  tenantId: "tenant-conformance-1",
});

const authzPrivilege = createAuthorizationEvidenceFixture({
  capability: "elevate_privilege",
  enforcementPoint: "privilege-authority",
  resourceType: "privilege_grant",
  resourceId: "priv-grant-conformance-1",
  override: true,
  breakGlass: true,
});

const authzImpersonation = createAuthorizationEvidenceFixture({
  capability: "manage_impersonation",
  enforcementPoint: "impersonation-authority",
  resourceType: "impersonation_session",
  resourceId: "session-imp-conformance-1",
  tenantId: "tenant-conformance-1",
});

const delegationPrivilege = delegationContext({
  mode: "privilege_escalation",
  principal_id: "delegated-principal-conformance-1",
  scope: ["elevate_privilege"],
  reason_code: "operator_requested",
  expires_at: "2026-07-31T13:00:00.000Z",
});

const delegationImpersonation = delegationContext({
  mode: "impersonation",
  principal_id: "delegated-principal-conformance-2",
  scope: ["start_impersonation"],
  reason_code: "operator_requested",
  expires_at: "2026-07-31T13:00:00.000Z",
});

const syntheticSession = sessionEvidence({
  id: "session-imp-conformance-1",
  created_at: "2026-07-31T11:55:00.000Z",
  age_seconds: 300,
  assurance_level: "aal2",
});

const syntheticSource = observedSource({
  observed: {
    address: "203.0.113.10",
    port: 443,
  },
});

export const AUTHORIZATION_ADMINISTRATION_VALID_ROWS: readonly ValidConformanceRow[] = Object.freeze([
  {
    name: "authorization.allowed",
    method: "authorizationAllowed",
    input: {
      actor: syntheticWorkloadActor,
      tenant: syntheticTenant,
      resource: policyResource,
      authorization: authzAllowPolicy,
      request: {
        id: "req-authz-allowed",
        method: "GET",
        route: "/api/v1/protected/resource",
      },
    },
  },
  {
    name: "authorization.denied",
    method: "authorizationDenied",
    input: {
      actor: syntheticApiActor,
      tenant: syntheticTenant,
      resource: policyResource,
      authorization: authzDenyPolicy,
      source: syntheticSource,
      event: {
        outcome_reason: {
          code: "policy_denied",
        },
      },
    },
  },
  {
    name: "authorization.privilege.elevated",
    method: "privilegeElevated",
    operation: {
      boundEvent: "privilegeElevated",
      operationId: "22222222-2222-4222-8222-000000000101",
      transactionId: "22222222-2222-4222-8222-000000000102",
    },
    input: {
      actor: syntheticAdminActor,
      tenant: platformTenant,
      subject: privilegeSubject,
      delegation: delegationPrivilege,
      authorization: authzPrivilege,
      resource: privilegeGrantResource,
      event: {
        outcome_reason: {
          code: "completed",
        },
      },
    },
  },
  {
    name: "authorization.role.assigned",
    method: "roleAssigned",
    operation: {
      boundEvent: "roleAssigned",
      operationId: "22222222-2222-4222-8222-000000000111",
      transactionId: "22222222-2222-4222-8222-000000000112",
    },
    input: {
      actor: syntheticAdminActor,
      tenant: syntheticTenant,
      subject: roleSubject,
      resource: roleResource,
      authorization: authzRole,
      event: {
        outcome_reason: {
          code: "completed",
        },
      },
    },
  },
  {
    name: "authorization.role.removed",
    method: "roleRemoved",
    operation: {
      boundEvent: "roleRemoved",
      operationId: "22222222-2222-4222-8222-000000000121",
      transactionId: "22222222-2222-4222-8222-000000000122",
    },
    input: {
      actor: syntheticAdminActor,
      tenant: syntheticTenant,
      subject: roleSubject,
      resource: roleResource,
      authorization: authzRole,
      event: {
        outcome_reason: {
          code: "completed",
        },
      },
    },
  },
  {
    name: "administration.impersonation.started",
    method: "impersonationStarted",
    operation: {
      boundEvent: "impersonationStarted",
      operationId: "22222222-2222-4222-8222-000000000131",
      transactionId: "22222222-2222-4222-8222-000000000132",
    },
    input: {
      actor: syntheticAdminActor,
      tenant: crossTenant,
      claimedTenant: claimedTenant("tenant-platform"),
      subject: impersonationSubject,
      resource: impersonationSessionResource,
      authorization: authzImpersonation,
      delegation: delegationImpersonation,
      session: syntheticSession,
      event: {
        outcome_reason: {
          code: "completed",
        },
      },
    },
  },
  {
    name: "administration.impersonation.ended",
    method: "impersonationEnded",
    operation: {
      boundEvent: "impersonationEnded",
      operationId: "22222222-2222-4222-8222-000000000141",
      transactionId: "22222222-2222-4222-8222-000000000142",
    },
    input: {
      actor: syntheticProcessActor,
      tenant: crossTenant,
      claimedTenant: claimedTenant("tenant-platform"),
      subject: impersonationSubject,
      resource: impersonationSessionResource,
      authorization: authzImpersonation,
      delegation: delegationImpersonation,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000143",
        operation_id: "22222222-2222-4222-8222-000000000141",
        causation_id: "22222222-2222-4222-8222-000000000131",
        original_event_id: "22222222-2222-4222-8222-000000000131",
      },
      event: {
        outcome_reason: {
          code: "completed",
        },
      },
    },
  },
]);

for (const row of AUTHORIZATION_ADMINISTRATION_VALID_ROWS) {
  test(`conformance valid: ${row.name} (${row.method})`, async () => {
    const context = createConformanceSdk();
    await assertValidConformanceRow(row, { sdkContext: context });
  });
}
