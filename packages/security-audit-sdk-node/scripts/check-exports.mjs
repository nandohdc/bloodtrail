import { readFile } from "node:fs/promises";

// Frozen public surface (#111): every name below is the complete, approved
// set of value and type-only exports from src/index.ts, recorded after the
// vertical-slice evidence in
// openspec/changes/archive/2026-09-08-verify-delivery-vertical-slice/harness/evidence.md
// (main @ 2833852489e162954bdd495a4c466cbdc75fee84). Adding, removing, or
// renaming any export is a public API change and requires updating this list
// in the same governed change; see
// packages/security-audit-sdk-node/adr/001-frozen-public-api-surface.md.
const FROZEN_VALUE_EXPORTS = [
  "NodeContextProvider", "createBoundedDeliveryBackpressure", "createBoundedDeliveryRetry",
  "createDeliveryShutdown", "createHttpDeliveryHandoff", "createNodeSecurityAuditSdk",
  "nodeByteLength", "nodeClock", "nodeContextProvider", "nodeIdentifiers", "nodePlatformProvider",
  "nodeSchemaRuntime", "nodeTimers",
];

const FROZEN_TYPE_EXPORTS = [
  "DeliveryAdmissionResult", "DeliveryBackpressure", "DeliveryBackpressureObservability",
  "DeliveryBackpressureOptions", "DeliveryRetry", "DeliveryRetryJitterSource",
  "DeliveryRetryObservability", "DeliveryRetryOptions", "DeliveryRetryResult", "DeliveryShutdown",
  "DeliveryShutdownOptions", "DeliveryShutdownReport", "DeliveryShutdownSubmission",
  "DeliveryShutdownSubmitResult", "HttpAcknowledgment", "HttpDeliveryHandoff",
  "HttpDeliveryHandoffOptions", "HttpDeliveryHandoffResult", "HttpExchange", "HttpExchangeOutcome",
  "HttpExchangeRequest", "NodePlatformProvider", "NodeSecurityAuditSdkConfiguration",
  "NodeTimerHandle",
];

// #111's acceptance criteria: the Node surface reuses core semantic types
// rather than duplicating them. Verified as an absence of name collision
// with sdk-core's own frozen surface, not merely assumed.
const CORE_VALUE_EXPORTS = new Set([
  "CONTRACT_ERROR_CODES", "CONTRACT_SCHEMA_ID", "CONTRACT_SCHEMA_NAME", "CONTRACT_VERSION",
  "EVENT_CATALOG", "EVENT_METHODS", "EXTENSION_NAMESPACES", "FIELD_POLICY", "PROHIBITED_DATA_KEYS",
  "REGISTRIES", "SDK_ERROR_CODES", "SecurityAuditSdkError", "StackContextProvider",
  "administratorActor", "anonymousActor", "apiCredentialActor", "authenticatedHumanActor",
  "authenticatedPrincipal", "authenticationEvidence", "authoritativeActor", "authoritativeResource",
  "authoritativeSubject", "authoritativeTenant", "authorizationEvidence", "backgroundJobActor",
  "cjsSchemaRuntime", "claimedActor", "claimedTenant", "createAuditContextFrame",
  "createSecurityAuditSdk", "credentialReference", "currentAuditContext", "dataPolicyContext",
  "defaultByteLengthProvider", "defaultContextProvider", "defaultTimerProvider",
  "delegatedActorContext", "delegationContext", "destinationContext", "externalIntegrationActor",
  "getContextProvider", "getSchemaRuntime", "impersonatingActorContext", "impersonationContext",
  "integrityContext", "observedSource", "registeredEnrichmentExtension", "riskContext",
  "runWithAuditContext", "scheduledProcessActor", "serviceAccountActor", "serviceWorkload",
  "sessionEvidence", "setContextProvider", "setSchemaRuntime", "systemAuditClock",
  "systemAuditIdentifiers", "utf8ByteLength", "validateNoProhibitedData", "validateSecurityAuditEvent",
  "workloadIdentityActor",
]);

const CORE_TYPE_EXPORTS = new Set([
  "AccountRegistrationAttemptedEventInput", "AccountRegistrationCompletedEventInput", "AuditBrandKind",
  "AuditByteLengthProvider", "AuditClock", "AuditContextFrame", "AuditContextFrameInput",
  "AuditDeliveryResult", "AuditErrorCategory", "AuditErrorCode", "AuditEventSink",
  "AuditFieldPolicyPath", "AuditFieldTransformationHook", "AuditIdentifierProvider",
  "AuditOperationHandle", "AuditOperationInput", "AuditOperationSnapshot", "AuditOperationState",
  "AuditResult", "AuditRetentionConfiguration", "AuditSchemaRuntime", "AuditTimerHandle",
  "AuditTimerProvider", "AuditTransformationInput", "AuditTransformationOutput",
  "AuthenticatedPrincipalContext", "AuthenticationEvidenceContext", "AuthenticationFailedEventInput",
  "AuthenticationSucceededEventInput", "AuthoritativeActorContext", "AuthorizationAllowedEventInput",
  "AuthorizationDeniedEventInput", "AuthorizationEvidenceContext", "ClaimedActorContext",
  "ClaimedTenantContext", "ContextProvider", "CredentialReferenceContext", "DataPolicyContext",
  "DelegatedActorBundle", "DelegationContext", "DestinationContext", "EventBuilderInputForName",
  "EventCommitForName", "EventDefinition", "EventDefinitionForName", "EventForName",
  "EventMethodDefinition", "EventMethodName", "EventName", "EventNameFor", "EventOutcomeForName",
  "EventPhaseForName", "EventSemantic", "GeneratedOperationContext", "ImpersonationEndedEventInput",
  "ImpersonationStartedEventInput", "IntegrityContext", "MfaEnrolledEventInput", "MfaRemovedEventInput",
  "NamedAuditEventInputMap", "NamedSecurityAuditApi", "ObservedSourceContext",
  "PasswordResetCompletedEventInput", "PasswordResetRequestedEventInput", "PlatformProvider",
  "PrivilegeElevatedEventInput", "RegisteredEnrichmentExtension", "RegistryName", "RegistryValue",
  "ResourceAuthorityContext", "RiskContext", "RoleAssignedEventInput", "RoleRemovedEventInput",
  "SafeAuditError", "SdkErrorCode", "SecurityAuditEvent", "SecurityAuditSdk",
  "SecurityAuditSdkConfiguration", "SecurityAuditSdkState", "SecurityConfigurationChangedEventInput",
  "SensitiveDataExportedEventInput", "SensitiveResourceCreatedEventInput",
  "SensitiveResourceDeletedEventInput", "SensitiveResourceModifiedEventInput",
  "SensitiveResourceViewedEventInput", "ServiceWorkloadContext", "SessionCreatedEventInput",
  "SessionEvidenceContext", "SessionRevokedEventInput", "SubjectAuthorityContext",
  "TenantAuthorityContext", "TenantContextViolationDetectedEventInput",
]);

function diffExportSets(expected, actual, label) {
  const expectedSet = new Set(expected);
  const actualSet = new Set(actual);
  const missing = expected.filter((n) => !actualSet.has(n));
  const unapproved = actual.filter((n) => !expectedSet.has(n));
  if (missing.length > 0) {
    throw new Error(`${label}: frozen export(s) missing from the built package: ${missing.join(", ")}`);
  }
  if (unapproved.length > 0) {
    throw new Error(
      `${label}: unapproved export(s) not in the frozen surface — add them to check-exports.mjs and adr/001-frozen-public-api-surface.md in the same governed change: ${unapproved.join(", ")}`,
    );
  }
}

function extractExportNames(sourceText) {
  const values = [];
  const types = [];
  for (const block of sourceText.matchAll(/export \{([^}]+)\}/gs)) {
    for (const rawItem of block[1].split(",")) {
      const item = rawItem.trim();
      if (!item) continue;
      if (item.startsWith("type ")) {
        types.push(item.slice("type ".length).trim());
      } else {
        values.push(item);
      }
    }
  }
  return { values, types };
}

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const allowedSubpaths = new Set(["."]);
for (const key of Object.keys(pkg.exports ?? {})) {
  if (!allowedSubpaths.has(key)) throw new Error(`unsupported public subpath: ${key}`);
}
for (const key of allowedSubpaths) {
  if (!pkg.exports[key]) throw new Error(`missing public subpath: ${key}`);
}

const sdkNode = await import(new URL("../dist/index.js", import.meta.url));
diffExportSets(FROZEN_VALUE_EXPORTS, Object.keys(sdkNode), "value exports");

const sourceText = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const { values: actualValues, types: actualTypes } = extractExportNames(sourceText);
diffExportSets(FROZEN_VALUE_EXPORTS, actualValues, "source value exports");
diffExportSets(FROZEN_TYPE_EXPORTS, actualTypes, "type-only exports");

for (const name of [...FROZEN_VALUE_EXPORTS, ...FROZEN_TYPE_EXPORTS]) {
  if (CORE_VALUE_EXPORTS.has(name) || CORE_TYPE_EXPORTS.has(name)) {
    throw new Error(
      `frozen Node surface must reuse core semantic types, not duplicate their names: ${name} collides with a security-audit-sdk-core export`,
    );
  }
}

console.log(
  `package exports verified: ${FROZEN_VALUE_EXPORTS.length} value exports, ${FROZEN_TYPE_EXPORTS.length} type-only exports, frozen surface matches exactly, no collision with core's frozen surface`,
);
