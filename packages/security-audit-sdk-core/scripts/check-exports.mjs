import { readFile } from "node:fs/promises";

// Frozen public surface (#110): every name below is the complete, approved
// set of value and type-only exports from src/index.ts, recorded after the
// vertical-slice evidence in
// openspec/changes/archive/2026-09-08-verify-delivery-vertical-slice/harness/evidence.md
// (main @ 2833852489e162954bdd495a4c466cbdc75fee84). Adding, removing, or
// renaming any export — hand-authored or generated — is a public API change
// and requires updating this list in the same governed change; see
// packages/security-audit-sdk-core/adr/012-frozen-public-api-surface.md.
const FROZEN_VALUE_EXPORTS = [
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
];

const FROZEN_TYPE_EXPORTS = [
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
];

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
      `${label}: unapproved export(s) not in the frozen surface — add them to check-exports.mjs and adr/012-frozen-public-api-surface.md in the same governed change: ${unapproved.join(", ")}`,
    );
  }
}

function extractTypeExportNames(sourceText) {
  const names = [];
  for (const block of sourceText.matchAll(/export type \{([^}]+)\}/gs)) {
    for (const rawName of block[1].split(",")) {
      const name = rawName.trim();
      if (name) names.push(name);
    }
  }
  return names;
}

const NODE_DENYLIST_PATTERN = /^node/i;

const pkg = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));
const allowedSubpaths = new Set([".", "./testing"]);
for (const key of Object.keys(pkg.exports ?? {})) {
  if (!allowedSubpaths.has(key)) throw new Error(`unsupported public subpath: ${key}`);
}
for (const key of allowedSubpaths) {
  if (!pkg.exports[key]) throw new Error(`missing public subpath: ${key}`);
}

const sdk = await import(new URL("../dist/index.js", import.meta.url));
const actualValueExports = Object.keys(sdk);
diffExportSets(FROZEN_VALUE_EXPORTS, actualValueExports, "value exports");

const sourceText = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
const actualTypeExports = extractTypeExportNames(sourceText);
diffExportSets(FROZEN_TYPE_EXPORTS, actualTypeExports, "type-only exports");

for (const name of [...FROZEN_VALUE_EXPORTS, ...FROZEN_TYPE_EXPORTS]) {
  if (NODE_DENYLIST_PATTERN.test(name)) {
    throw new Error(`frozen core surface must stay platform-neutral; found Node-prefixed export: ${name}`);
  }
}

console.log(
  `package exports verified: ${FROZEN_VALUE_EXPORTS.length} value exports, ${FROZEN_TYPE_EXPORTS.length} type-only exports, frozen surface matches exactly`,
);
