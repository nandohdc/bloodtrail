import { strict as assert } from "node:assert";
import { test } from "node:test";
import {
  administratorActor,
  anonymousActor,
  authenticatedHumanActor,
  authenticatedPrincipal,
  authoritativeResource,
  authoritativeTenant,
  authorizationEvidence,
  claimedTenant,
  observedSource,
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

const syntheticHumanActor = authenticatedHumanActor({
  id: "actor-conformance-1",
  displayName: "User One",
});

const syntheticAdminActor = administratorActor({
  id: "admin-conformance-1",
  displayName: "Admin One",
});

const syntheticAnonActor = anonymousActor();

const syntheticPrincipal = authenticatedPrincipal({
  type: "human_user",
  id: "principal-conformance-1",
  issuer: "https://idp.example.test",
});

const recordResourceView = authoritativeResource({
  type: "sensitive_record",
  id: "rec-view-conformance-1",
  owning_tenant_id: "tenant-conformance-1",
  data_classification: "confidential",
  operation_type: "read",
  change_categories: ["metadata"],
});

const recordResourceCreate = authoritativeResource({
  type: "sensitive_record",
  id: "rec-create-conformance-1",
  owning_tenant_id: "tenant-conformance-1",
  data_classification: "confidential",
  operation_type: "create",
  change_categories: ["metadata"],
});

const recordResourceModify = authoritativeResource({
  type: "sensitive_record",
  id: "rec-modify-conformance-1",
  owning_tenant_id: "tenant-conformance-1",
  data_classification: "confidential",
  operation_type: "update",
  change_categories: ["metadata"],
});

const collectionResourceDelete = authoritativeResource({
  type: "sensitive_collection",
  id: "col-delete-conformance-1",
  owning_tenant_id: "tenant-conformance-1",
  data_classification: "confidential",
  operation_type: "delete",
  bulk: {
    count: 12,
    scope: "bounded_fixture_scope",
    child_event_policy: "aggregate_only",
  },
  change_categories: ["metadata"],
  deletion_mode: "soft_delete",
});

const collectionResourceExport = authoritativeResource({
  type: "sensitive_collection",
  id: "col-export-conformance-1",
  owning_tenant_id: "tenant-conformance-1",
  data_classification: "restricted",
  operation_type: "export",
  bulk: {
    count: 12,
    scope: "bounded_fixture_scope",
    child_event_policy: "aggregate_only",
  },
  change_categories: ["metadata"],
  export: {
    destination_class: "tenant_authorized_download",
    size_class: "small",
    record_count: 12,
  },
});

const configResource = authoritativeResource({
  type: "security_configuration",
  id: "config-conformance-1",
  data_classification: "confidential",
  operation_type: "configure",
  change_categories: ["metadata"],
});

const tenantResource = authoritativeResource({
  type: "tenant",
  id: "tenant-res-conformance-1",
  owning_tenant_id: "tenant-conformance-1",
  data_classification: "confidential",
  operation_type: "execute",
  change_categories: ["metadata"],
});

function createAuthorizationEvidenceFixture(params: {
  readonly capability: string;
  readonly enforcementPoint: string;
  readonly resourceType: string;
  readonly resourceId: string;
  readonly decision?: "allow" | "deny";
  readonly decisionReason?: Parameters<typeof authorizationEvidence>[0]["decision_reason"];
  readonly tenantId?: string;
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
  });
}

const authzView = createAuthorizationEvidenceFixture({
  capability: "read_record",
  enforcementPoint: "data-service",
  resourceType: "sensitive_record",
  resourceId: "rec-view-conformance-1",
  tenantId: "tenant-conformance-1",
});

const authzCreate = createAuthorizationEvidenceFixture({
  capability: "create_record",
  enforcementPoint: "data-service",
  resourceType: "sensitive_record",
  resourceId: "rec-create-conformance-1",
  tenantId: "tenant-conformance-1",
});

const authzModify = createAuthorizationEvidenceFixture({
  capability: "update_record",
  enforcementPoint: "data-service",
  resourceType: "sensitive_record",
  resourceId: "rec-modify-conformance-1",
  tenantId: "tenant-conformance-1",
});

const authzDelete = createAuthorizationEvidenceFixture({
  capability: "delete_collection",
  enforcementPoint: "data-service",
  resourceType: "sensitive_collection",
  resourceId: "col-delete-conformance-1",
  tenantId: "tenant-conformance-1",
});

const authzExport = createAuthorizationEvidenceFixture({
  capability: "export_collection",
  enforcementPoint: "data-service",
  resourceType: "sensitive_collection",
  resourceId: "col-export-conformance-1",
  tenantId: "tenant-conformance-1",
});

const authzConfig = createAuthorizationEvidenceFixture({
  capability: "change_config",
  enforcementPoint: "config-service",
  resourceType: "security_configuration",
  resourceId: "config-conformance-1",
});

const authzDenyTenant = createAuthorizationEvidenceFixture({
  decision: "deny",
  decisionReason: "policy_denied",
  capability: "detect_tenant_violation",
  enforcementPoint: "tenant-enforcement-boundary",
  resourceType: "tenant",
  resourceId: "tenant-res-conformance-1",
  tenantId: "tenant-conformance-1",
});

export const DATA_CONFIGURATION_TENANT_VALID_ROWS: readonly ValidConformanceRow[] = Object.freeze([
  {
    name: "data.sensitive_resource.viewed",
    method: "sensitiveResourceViewed",
    input: {
      actor: syntheticHumanActor,
      authenticated_principal: syntheticPrincipal,
      tenant: syntheticTenant,
      resource: recordResourceView,
      authorization: authzView,
      request: {
        id: "req-view-rec",
        method: "GET",
        route: "/api/v1/records/rec-view-conformance-1",
      },
    },
  },
  {
    name: "data.sensitive_resource.created",
    method: "sensitiveResourceCreated",
    operation: {
      boundEvent: "sensitiveResourceCreated",
      operationId: "22222222-2222-4222-8222-000000000201",
      transactionId: "22222222-2222-4222-8222-000000000202",
    },
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      resource: recordResourceCreate,
      authorization: authzCreate,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000203",
        operation_id: "22222222-2222-4222-8222-000000000201",
      },
    },
  },
  {
    name: "data.sensitive_resource.modified",
    method: "sensitiveResourceModified",
    operation: {
      boundEvent: "sensitiveResourceModified",
      operationId: "22222222-2222-4222-8222-000000000211",
      transactionId: "22222222-2222-4222-8222-000000000212",
    },
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      resource: recordResourceModify,
      authorization: authzModify,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000213",
        operation_id: "22222222-2222-4222-8222-000000000211",
      },
    },
  },
  {
    name: "data.sensitive_resource.deleted",
    method: "sensitiveResourceDeleted",
    operation: {
      boundEvent: "sensitiveResourceDeleted",
      operationId: "22222222-2222-4222-8222-000000000221",
      transactionId: "22222222-2222-4222-8222-000000000222",
    },
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      resource: collectionResourceDelete,
      authorization: authzDelete,
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000223",
        operation_id: "22222222-2222-4222-8222-000000000221",
      },
    },
  },
  {
    name: "data.sensitive_data.exported",
    method: "sensitiveDataExported",
    operation: {
      boundEvent: "sensitiveDataExported",
      operationId: "22222222-2222-4222-8222-000000000231",
      transactionId: "22222222-2222-4222-8222-000000000232",
    },
    input: {
      actor: syntheticHumanActor,
      tenant: syntheticTenant,
      resource: collectionResourceExport,
      authorization: authzExport,
    },
  },
  {
    name: "security.configuration.changed",
    method: "securityConfigurationChanged",
    operation: {
      boundEvent: "securityConfigurationChanged",
      operationId: "22222222-2222-4222-8222-000000000241",
      transactionId: "22222222-2222-4222-8222-000000000242",
    },
    input: {
      actor: syntheticAdminActor,
      tenant: platformTenant,
      resource: configResource,
      authorization: authzConfig,
    },
  },
  {
    name: "tenant.context_violation.detected",
    method: "tenantContextViolationDetected",
    input: {
      actor: syntheticAnonActor,
      tenant: crossTenant,
      claimedTenant: claimedTenant("claimed-tenant-1"),
      resource: tenantResource,
      authorization: authzDenyTenant,
      source: observedSource({
        observed: {
          address: "203.0.113.10",
          port: 443,
        },
      }),
      correlation: {
        correlation_id: "22222222-2222-4222-8222-000000000251",
        operation_id: "22222222-2222-4222-8222-000000000252",
      },
      event: {
        outcome_reason: {
          code: "policy_denied",
        },
      },
    },
  },
]);

for (const row of DATA_CONFIGURATION_TENANT_VALID_ROWS) {
  test(`conformance valid: ${row.name} (${row.method})`, async () => {
    const context = createConformanceSdk();
    const captured = await assertValidConformanceRow(row, { sdkContext: context });
    if (row.method === "sensitiveResourceCreated" ||
        row.method === "sensitiveResourceModified" ||
        row.method === "sensitiveResourceDeleted" ||
        row.method === "sensitiveDataExported" ||
        row.method === "securityConfigurationChanged") {
      assert.equal(captured.event.commit_state, "committed");
    }
  });
}
