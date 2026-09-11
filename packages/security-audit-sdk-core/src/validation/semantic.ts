import { CONTRACT_SCHEMA_NAME, CONTRACT_VERSION, DERIVED_FIELD_PROVENANCE, EVENT_CATALOG, EXTENSION_NAMESPACES, FIELD_POLICY, REGISTRIES } from "../generated/contract.generated.js";
import type { EventDefinition, EventSemantic, SecurityAuditEvent } from "../generated/contract.generated.js";
import type { AuditResult } from "../errors.js";
import { failure, normalizeCanonicalInput } from "../errors.js";
import { duplicateAuthorityCode } from "../duplicate-copy-probe.js";

const byName = new Map(EVENT_CATALOG.map((entry) => [entry.name, entry]));
const extensionsByNamespace = new Map(EXTENSION_NAMESPACES.map((entry) => [entry.namespace, entry]));
const canonicalFieldPaths: ReadonlySet<string> = new Set(FIELD_POLICY.map((field) => field.path));
const derivedFromPath = DERIVED_FIELD_PROVENANCE.field_path;
const derivedFromPointer = `/${derivedFromPath.replaceAll(".", "/")}`;
const derivedProvenanceCodes = DERIVED_FIELD_PROVENANCE.error_codes;
const derivedTrustPointer = `/${DERIVED_FIELD_PROVENANCE.trust_path.replaceAll(".", "/")}`;
// The canonical trust order, most trusted first, and the trust the contract declares for each
// field and extension namespace. An input's trust is read from here, never from the event, so a
// producer cannot supply the value its own floor is compared against.
const trustOrder: readonly string[] = REGISTRIES.trust_levels;
const fieldTrustByPath: ReadonlyMap<string, string> = new Map(FIELD_POLICY.map((field) => [field.path, field.trust]));
const extensionTrustByNamespace: ReadonlyMap<string, string> = new Map(
  EXTENSION_NAMESPACES.map((entry) => [entry.namespace, entry.trust]),
);
const asyncCompletionSemantics = new Set(["account_registration_completed", "password_reset_completed"]);
const resourceIdentityRequiredSemantics = new Set([
  "sensitive_resource_viewed",
  "sensitive_resource_created",
  "sensitive_resource_modified",
  "sensitive_resource_deleted",
]);

/**
 * Which tenant.scope values each catalog event may legitimately report, derived from each
 * entry's `tenant_rule` free text in contracts/security-audit/catalog/catalog.json. Platform and
 * tenantless scope are only accepted where the catalog explicitly allows them; every other
 * scope combination is rejected as a tenant-context conflict rather than silently accepted.
 */
const TENANT_SCOPE_POLICY: Readonly<Partial<Record<EventSemantic, readonly SecurityAuditEvent["tenant"]["scope"][]>>> = {
  account_registration_attempted: ["tenantless", "tenant"],
  account_registration_completed: ["tenant"],
  authentication_succeeded: ["tenant", "tenantless"],
  authentication_failed: ["tenantless", "tenant"],
  mfa_enrolled: ["tenant"],
  mfa_removed: ["tenant"],
  session_created: ["tenant", "tenantless"],
  session_revoked: ["tenant", "cross_tenant"],
  password_reset_requested: ["tenantless", "tenant"],
  password_reset_completed: ["tenant"],
  authorization_allowed: ["tenant", "cross_tenant"],
  authorization_denied: ["tenant", "cross_tenant"],
  role_assigned: ["tenant", "cross_tenant", "platform"],
  role_removed: ["tenant", "cross_tenant", "platform"],
  privilege_elevated: ["platform", "cross_tenant"],
  impersonation_started: ["cross_tenant", "tenant"],
  impersonation_ended: ["cross_tenant", "tenant"],
  sensitive_resource_viewed: ["tenant", "cross_tenant"],
  sensitive_resource_created: ["tenant"],
  sensitive_resource_modified: ["tenant"],
  sensitive_resource_deleted: ["tenant"],
  sensitive_data_exported: ["tenant", "cross_tenant"],
  security_configuration_changed: ["tenant", "platform", "tenantless"],
  tenant_context_violation_detected: ["tenant", "cross_tenant", "platform"],
};

export function validateBaseSemantics(event: SecurityAuditEvent): AuditResult<SecurityAuditEvent> {
  if (event.schema.name !== CONTRACT_SCHEMA_NAME || event.schema.version !== CONTRACT_VERSION) {
    return failure("UNSUPPORTED_SCHEMA_VERSION", "validation", "/schema/version");
  }
  const definition = byName.get(event.event.name);
  if (!definition) return failure("UNKNOWN_CATALOG_VALUE", "validation", "/event/name");
  if (event.event.category !== definition.category) return failure("UNKNOWN_CATALOG_VALUE", "validation", "/event/category");
  if (event.event.action !== definition.action) return failure("UNKNOWN_CATALOG_VALUE", "validation", "/event/action");
  if (event.event.delivery_class !== definition.delivery) return failure("UNKNOWN_CATALOG_VALUE", "validation", "/event/delivery_class");
  if (!(definition.phase as readonly string[]).includes(event.event.lifecycle_phase)) return failure("SDK_SEMANTIC_VALIDATION_FAILED", "validation", "/event/lifecycle_phase");
  if (!(definition.outcomes as readonly string[]).includes(event.event.outcome)) return failure("SDK_SEMANTIC_VALIDATION_FAILED", "validation", "/event/outcome");
  const semanticResult = validateEventSemantics(event, definition);
  if (!semanticResult.ok) return semanticResult;
  const provenanceResult = validateDerivedFieldProvenance(event);
  if (!provenanceResult.ok) return provenanceResult;
  return { ok: true, value: event };
}

function validateEventSemantics(event: SecurityAuditEvent, definition: EventDefinition): AuditResult<void> {
  const validations = [
    () => validateCommit(event, definition),
    () => validateRequiredContext(event, definition),
    () => validateCausality(event, definition),
    () => validateAuthority(event, definition),
    () => validateTenantResourceConsistency(event, definition),
    () => validateAuthorizationOutcome(event),
    () => validateDelegation(event),
    () => validateExtensions(event),
  ];
  for (const validate of validations) {
    const result = validate();
    if (!result.ok) return result;
  }
  return { ok: true, value: undefined };
}

// From contract 2.0.0 every event carrying risk declares its provenance, the declared level stays
// at or below the producer's transformation ceiling, and it stays at or below the least trusted
// material input. This is the single trust-floor implementation every construction path reaches.
function validateDerivedFieldProvenance(event: SecurityAuditEvent): AuditResult<void> {
  if (valueAtPath(event, DERIVED_FIELD_PROVENANCE.required_with) === undefined) return { ok: true, value: undefined };
  const declared = valueAtPath(event, DERIVED_FIELD_PROVENANCE.trust_path);
  if (declared === undefined) return failure(derivedProvenanceCodes.missing, "validation", derivedTrustPointer);
  const inputs = valueAtPath(event, derivedFromPath);
  if (inputs === undefined) return failure(derivedProvenanceCodes.missing, "validation", derivedFromPointer);
  const shape = derivedInputShape(inputs);
  if ("code" in shape) return failure(shape.code, "validation", derivedFromPointer);
  if (isMoreTrusted(declared, DERIVED_FIELD_PROVENANCE.transformation_ceiling)) {
    return failure(derivedProvenanceCodes.non_derived, "validation", derivedFromPointer);
  }
  const referenceCode = derivedInputReferenceCode(event, shape.inputs);
  if (referenceCode) return failure(referenceCode, "validation", derivedFromPointer);
  return trustFloorResult(declared, shape.inputs);
}

// A level outside the order ranks above every level, so an unregistered value fails closed.
function isMoreTrusted(left: unknown, right: string): boolean {
  return trustOrder.indexOf(left as string) < trustOrder.indexOf(right);
}

function inputTrust(input: string): string {
  return fieldTrustByPath.get(input) ?? extensionTrustByNamespace.get(input.slice("extensions.".length)) ?? "unknown";
}

// Points at the first input, in canonical order, carrying the least trusted level — by position,
// so the caller-supplied path is never echoed in the diagnostic.
function trustFloorResult(declared: unknown, inputs: readonly string[]): AuditResult<void> {
  let floorIndex = 0;
  for (let index = 1; index < inputs.length; index += 1) {
    if (isMoreTrusted(inputTrust(inputs[floorIndex]!), inputTrust(inputs[index]!))) floorIndex = index;
  }
  if (!isMoreTrusted(declared, inputTrust(inputs[floorIndex]!))) return { ok: true, value: undefined };
  return failure(derivedProvenanceCodes.trust_floor, "validation", `${derivedFromPointer}/${floorIndex}`);
}

function derivedInputShape(inputs: unknown): { readonly code: string } | { readonly inputs: string[] } {
  if (!Array.isArray(inputs)) return { code: derivedProvenanceCodes.malformed };
  if (inputs.length > DERIVED_FIELD_PROVENANCE.maximum_inputs) return { code: derivedProvenanceCodes.malformed };
  if (inputs.length < DERIVED_FIELD_PROVENANCE.minimum_inputs) return { code: derivedProvenanceCodes.empty };
  if (inputs.some(isMalformedDerivedInput)) return { code: derivedProvenanceCodes.malformed };
  return { inputs };
}

function isMalformedDerivedInput(input: unknown): boolean {
  if (typeof input !== "string") return true;
  if (input.length === 0) return true;
  return input.length > DERIVED_FIELD_PROVENANCE.maximum_input_length;
}

function derivedInputReferenceCode(event: SecurityAuditEvent, inputs: readonly string[]): string | null {
  const duplicateCode = duplicateDerivedInputCode(inputs);
  if (duplicateCode) return duplicateCode;
  const orderCode = derivedInputOrderCode(inputs);
  if (orderCode) return orderCode;
  for (const input of inputs) {
    const resolutionCode = derivedInputResolutionCode(event, input);
    if (resolutionCode) return resolutionCode;
  }
  return null;
}

function duplicateDerivedInputCode(inputs: readonly string[]): string | null {
  const seen = new Set<string>();
  for (const input of inputs) {
    if (seen.has(input)) return derivedProvenanceCodes.duplicate;
    seen.add(input);
  }
  return null;
}

function derivedInputOrderCode(inputs: readonly string[]): string | null {
  return inputs.every((input, index) => index === 0 || compareByCodePoint(inputs[index - 1]!, input) <= 0)
    ? null
    : derivedProvenanceCodes.noncanonical_order;
}

/** Compare bounded provenance paths by the contract's locale-independent code-point order. */
function compareByCodePoint(left: string, right: string): number {
  const leftPoints = Array.from(left, (character) => character.codePointAt(0)!);
  const rightPoints = Array.from(right, (character) => character.codePointAt(0)!);
  const sharedLength = Math.min(leftPoints.length, rightPoints.length);
  for (let index = 0; index < sharedLength; index += 1) {
    if (leftPoints[index] !== rightPoints[index]) return leftPoints[index]! - rightPoints[index]!;
  }
  return leftPoints.length - rightPoints.length;
}

function derivedInputResolutionCode(event: SecurityAuditEvent, input: string): string | null {
  if (input === derivedFromPath || input.startsWith(DERIVED_FIELD_PROVENANCE.cycle_prefix)) return derivedProvenanceCodes.cycle;
  if (canonicalFieldPaths.has(input)) return valueAtPath(event, input) === undefined ? derivedProvenanceCodes.absent : null;
  if (!isRegisteredExtensionPath(input)) return derivedProvenanceCodes.unresolvable;
  const namespace = input.slice("extensions.".length);
  return !event.extensions || !Object.hasOwn(event.extensions, namespace) ? derivedProvenanceCodes.absent : null;
}

function valueAtPath(value: unknown, path: string): unknown {
  return path.split(".").reduce<unknown>((current, segment) => {
    if (current === null || typeof current !== "object") return undefined;
    return (current as Record<string, unknown>)[segment];
  }, value);
}

function isRegisteredExtensionPath(input: string): boolean {
  if (!input.startsWith("extensions.")) return false;
  return extensionsByNamespace.has(input.slice("extensions.".length) as (typeof EXTENSION_NAMESPACES)[number]["namespace"]);
}

function validateCommit(event: SecurityAuditEvent, definition: EventDefinition): AuditResult<void> {
  if (event.event.outcome === "success" && event.event.commit_state === "pending") {
    return failure("PREMATURE_SUCCESS", "validation", "/event/commit_state");
  }
  if (event.event.commit_state === undefined || !(definition.commit as readonly string[]).includes(event.event.commit_state)) {
    if (event.event.outcome === "success" && (definition.commit as readonly string[]).includes("committed")) {
      return failure("PREMATURE_SUCCESS", "validation", "/event/commit_state");
    }
    return failure("SDK_SEMANTIC_VALIDATION_FAILED", "validation", "/event/commit_state");
  }
  return { ok: true, value: undefined };
}

function validateRequiredContext(event: SecurityAuditEvent, definition: EventDefinition): AuditResult<void> {
  for (const context of definition.required_context) {
    switch (context) {
      case "actor":
      case "administrator":
      case "real_actor":
      case "real_admin_actor":
      case "real_actor_or_process":
      case "actor_or_claim":
        if (!hasUsableActor(event.actor)) return failure("MISSING_REQUIRED_ACTOR", "validation", "/actor");
        if ((context === "administrator" || context === "real_admin_actor") && event.actor.type !== "administrator") {
          return failure("MISSING_REQUIRED_ACTOR", "validation", "/actor/type");
        }
        break;
      case "tenant":
      case "tenants":
      case "authoritative_tenants":
      case "tenant_or_platform_scope":
        if (!hasUsableTenant(event.tenant)) return failure("MISSING_TENANT_CONTEXT", "validation", "/tenant");
        break;
      case "resource":
        if (!event.resource?.type) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/resource/type");
        if (resourceIdentityRequiredSemantics.has(definition.semantic) && !event.resource.id) {
          return failure("SDK_MISSING_EVENT_FIELD", "validation", "/resource/id");
        }
        break;
      case "role":
        if (event.resource?.type !== "role" || !event.resource.id) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/resource");
        break;
      case "config_resource":
        if (!event.resource?.type || !event.resource.id) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/resource");
        break;
      case "resource_scope":
        if (!event.resource?.type) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/resource/type");
        break;
      case "resource_owner":
        if (!event.resource?.type || !event.resource.owning_tenant_id) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/resource/owning_tenant_id");
        break;
      case "authorization":
      case "policy":
        if (!event.authorization?.decision) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/authorization");
        break;
      case "authentication":
        if (!event.authentication) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/authentication");
        break;
      case "session":
        if (!event.session) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/session");
        break;
      case "credential":
        if (!event.credential) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/credential");
        break;
      case "source":
      case "request_source":
        if (!event.source) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/source");
        break;
      case "request":
        if (!event.request) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/request");
        break;
      case "correlation":
      case "original_start":
        if (!event.correlation?.correlation_id || !event.correlation.operation_id) return failure("BAD_CAUSALITY", "validation", "/correlation");
        break;
      case "subject":
      case "impersonated_subject":
        if (!event.subject) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/subject");
        break;
      case "principal":
      case "authenticated_principal":
        if (!event.authenticated_principal) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/authenticated_principal");
        break;
      case "delegation":
      case "scope":
      case "expiry":
        if (!event.delegation) return failure("INVALID_DELEGATION", "validation", "/delegation");
        break;
      case "operation":
      case "transaction":
        if (!event.correlation.transaction_id) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/correlation/transaction_id");
        break;
      case "change_categories":
      case "change_category":
        if (!event.resource.change_categories?.length) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/resource/change_categories");
        break;
      case "deletion_mode":
        if (!event.resource.deletion_mode) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/resource/deletion_mode");
        break;
      case "bounded_volume":
        if (event.resource.export?.record_count === undefined) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/resource/export/record_count");
        break;
      case "destination_class":
        if (!event.resource.export?.destination_class) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/resource/export/destination_class");
        break;
      case "claimed_tenant":
        if (!event.tenant.claimed_tenant_id) return failure("MISSING_TENANT_CONTEXT", "validation", "/tenant/claimed_tenant_id");
        break;
      case "reason":
        if (!event.event.outcome_reason?.code) return failure("SDK_MISSING_EVENT_FIELD", "validation", "/event/outcome_reason/code");
        break;
      default:
        break;
    }
  }
  return { ok: true, value: undefined };
}

function validateCausality(event: SecurityAuditEvent, definition: EventDefinition): AuditResult<void> {
  if (event.correlation.causation_id === event.event.id || event.correlation.original_event_id === event.event.id) {
    return failure("BAD_CAUSALITY", "validation", "/correlation/causation_id");
  }
  if (event.correlation.retry_attempt !== undefined && event.correlation.retry_attempt > 0 && !event.correlation.original_event_id) {
    return failure("BAD_CAUSALITY", "validation", "/correlation/original_event_id");
  }
  if (event.correlation.retry_attempt !== undefined && event.correlation.retry_attempt < 0) {
    return failure("BAD_CAUSALITY", "validation", "/correlation/retry_attempt");
  }
  if (asyncCompletionSemantics.has(definition.semantic) && event.event.outcome === "success") {
    if (!event.correlation.causation_id || !event.correlation.original_event_id) {
      return failure("BAD_CAUSALITY", "validation", "/correlation");
    }
  }
  return { ok: true, value: undefined };
}

function validateAuthority(event: SecurityAuditEvent, definition: EventDefinition): AuditResult<void> {
  const actorTrust = event.actor.provenance?.trust_level;
  if (event.actor.type !== "anonymous" && (actorTrust === "client_claim" || actorTrust === "observed_transport" || actorTrust === "unknown")) {
    return failure(duplicateAuthorityCode(event.actor), "authority", "/actor/provenance/trust_level");
  }
  if (event.actor.type === "anonymous" && event.authenticated_principal && definition.semantic !== "tenant_context_violation_detected") {
    return failure(duplicateAuthorityCode(event.authenticated_principal), "authority", "/authenticated_principal");
  }
  if (event.authorization?.decision && event.authorization.decision !== "not_applicable") {
    if (!event.authorization.policy_id || !event.authorization.enforcement_point) {
      return failure("SDK_MISSING_EVENT_FIELD", "validation", "/authorization");
    }
  }
  if (event.source?.client_reported && event.actor.provenance?.trust_level === "client_claim" && event.actor.type !== "anonymous") {
    return failure(duplicateAuthorityCode(event.source), "authority", "/source/client_reported");
  }
  return { ok: true, value: undefined };
}

function validateTenantResourceConsistency(event: SecurityAuditEvent, definition: EventDefinition): AuditResult<void> {
  const tenant = event.tenant;
  if (!hasUsableTenant(tenant)) return failure("MISSING_TENANT_CONTEXT", "validation", "/tenant");
  const allowedScopes = TENANT_SCOPE_POLICY[definition.semantic];
  if (allowedScopes && !allowedScopes.includes(tenant.scope)) {
    return failure("TENANT_RESOURCE_CONFLICT", "validation", "/tenant/scope");
  }
  if (
    tenant.claimed_tenant_id
    && tenant.claimed_tenant_id !== tenant.effective_tenant_id
    && tenant.scope === "tenant"
    && event.event.name !== "bloodtrail.audit.tenant.context_violation.detected"
  ) {
    return failure("TENANT_RESOURCE_CONFLICT", "validation", "/tenant/claimed_tenant_id");
  }
  if (event.actor.tenant_id && tenant.actor_tenant_id && event.actor.tenant_id !== tenant.actor_tenant_id) {
    return failure("TENANT_RESOURCE_CONFLICT", "validation", "/actor/tenant_id");
  }
  const owning = event.resource.owning_tenant_id;
  if (owning && tenant.resource_tenant_id && owning !== tenant.resource_tenant_id) {
    return failure("TENANT_RESOURCE_CONFLICT", "validation", "/resource/owning_tenant_id");
  }
  if (owning && tenant.effective_tenant_id && owning !== tenant.effective_tenant_id && tenant.scope !== "cross_tenant" && tenant.scope !== "platform") {
    return failure("TENANT_RESOURCE_CONFLICT", "validation", "/resource/owning_tenant_id");
  }
  const authorizationTenant = event.authorization?.tenant_context?.effective_tenant_id;
  if (authorizationTenant && tenant.effective_tenant_id && authorizationTenant !== tenant.effective_tenant_id) {
    return failure("TENANT_RESOURCE_CONFLICT", "validation", "/authorization/tenant_context/effective_tenant_id");
  }
  if (tenant.scope === "cross_tenant" && !event.authorization?.decision) {
    return failure("TENANT_RESOURCE_CONFLICT", "validation", "/authorization/decision");
  }
  return { ok: true, value: undefined };
}

function validateAuthorizationOutcome(event: SecurityAuditEvent): AuditResult<void> {
  const decision = event.authorization?.decision;
  if (event.event.outcome === "denied" && decision === "allow") {
    return failure("AUTHORIZATION_OUTCOME_CONFLICT", "validation", "/authorization/decision");
  }
  if (event.event.outcome === "success" && decision === "deny") {
    return failure("AUTHORIZATION_OUTCOME_CONFLICT", "validation", "/authorization/decision");
  }
  return { ok: true, value: undefined };
}

function validateDelegation(event: SecurityAuditEvent): AuditResult<void> {
  if ((event.authentication?.delegated || event.authentication?.impersonated) && !event.delegation) {
    return failure("INVALID_DELEGATION", "validation", "/delegation");
  }
  if (event.delegation && (!event.delegation.mode || !event.delegation.principal_id || !event.delegation.expires_at)) {
    return failure("INVALID_DELEGATION", "validation", "/delegation");
  }
  return { ok: true, value: undefined };
}

function validateExtensions(event: SecurityAuditEvent): AuditResult<void> {
  if (!event.extensions) return { ok: true, value: undefined };
  for (const [namespace, value] of Object.entries(event.extensions)) {
    const registration = extensionsByNamespace.get(namespace as "bloodtrail.audit.enrichment.v1");
    if (!registration) return failure("UNKNOWN_EXTENSION", "validation", `/extensions/${namespace}`);
    const normalized = normalizeCanonicalInput(value, `/extensions/${namespace}`);
    if (!normalized.ok) return normalized;
    if (normalized.value.bytes > registration.max_bytes) {
      return failure("FIELD_LIMIT_EXCEEDED", "validation", `/extensions/${namespace}`);
    }
  }
  return { ok: true, value: undefined };
}

function hasUsableActor(actor: SecurityAuditEvent["actor"] | undefined): boolean {
  return Boolean(actor && actor.type && (actor.type === "anonymous" || actor.id || actor.provenance?.trust_level === "authoritative_server"));
}

function hasUsableTenant(tenant: SecurityAuditEvent["tenant"] | undefined): boolean {
  if (!tenant?.scope) return false;
  if (tenant.scope === "tenantless" || tenant.scope === "platform") return true;
  return Boolean(tenant.effective_tenant_id && tenant.resource_tenant_id);
}
