import { AsyncLocalStorage } from "node:async_hooks";
import type { GeneratedOperationContext, SecurityAuditEvent } from "./generated/contract.generated.js";
import { clonePlain, deepFreeze, omitUndefined } from "./internal.js";
import type { AuditResult } from "./errors.js";
import { failure } from "./errors.js";
import { SecurityAuditSdkError } from "./errors.js";

type ContextValue<K extends keyof SecurityAuditEvent> = NonNullable<SecurityAuditEvent[K]>;

/**
 * Runtime-verifiable provenance tags. Membership is tracked in `brandRegistry`,
 * a module-private WeakMap keyed by object identity. A TypeScript cast or a
 * hand-written plain object can claim the `Brand<...>` *type*, but it can never
 * appear in `brandRegistry` because only the constructors in this file can
 * insert entries. That is what makes the tag unforgeable by casts or plain JS,
 * unlike the previous non-enumerable-symbol approach which `structuredClone`
 * silently dropped.
 */
export type AuditBrandKind =
  | "authoritative_actor"
  | "claimed_actor"
  | "authenticated_principal"
  | "subject_authority"
  | "credential_reference"
  | "delegation"
  | "tenant_authority"
  | "claimed_tenant"
  | "resource_authority"
  | "authentication_evidence"
  | "authorization_evidence"
  | "session_evidence"
  | "service_workload"
  | "observed_source"
  | "destination_boundary"
  | "data_policy"
  | "risk"
  | "integrity"
  | "registered_extension";

declare const AUDIT_BRAND: unique symbol;
type Brand<T, Kind extends AuditBrandKind> = Readonly<T> & { readonly [AUDIT_BRAND]: Kind };

const brandRegistry = new WeakMap<object, AuditBrandKind>();

export type AuthoritativeActorContext = Brand<ContextValue<"actor">, "authoritative_actor">;
export type ClaimedActorContext = Brand<ContextValue<"actor">, "claimed_actor">;
export type AuthenticatedPrincipalContext = Brand<ContextValue<"authenticated_principal">, "authenticated_principal">;
export type SubjectAuthorityContext = Brand<ContextValue<"subject">, "subject_authority">;
export type CredentialReferenceContext = Brand<ContextValue<"credential">, "credential_reference">;
export type DelegationContext = Brand<ContextValue<"delegation">, "delegation">;
export type TenantAuthorityContext = Brand<Omit<ContextValue<"tenant">, "claimed_tenant_id">, "tenant_authority">;
export type ClaimedTenantContext = Brand<Pick<ContextValue<"tenant">, "claimed_tenant_id">, "claimed_tenant">;
export type ResourceAuthorityContext = Brand<ContextValue<"resource">, "resource_authority">;
export type AuthenticationEvidenceContext = Brand<ContextValue<"authentication">, "authentication_evidence">;
export type AuthorizationEvidenceContext = Brand<ContextValue<"authorization">, "authorization_evidence">;
export type SessionEvidenceContext = Brand<ContextValue<"session">, "session_evidence">;
export type ServiceWorkloadContext = Brand<ContextValue<"initiator">, "service_workload">;
export type ObservedSourceContext = Brand<ContextValue<"source">, "observed_source">;
export type DestinationContext = Brand<ContextValue<"destination">, "destination_boundary">;
export type DataPolicyContext = Brand<Partial<ContextValue<"data">>, "data_policy">;
export type RiskContext = Brand<ContextValue<"risk">, "risk">;
export type IntegrityContext = Brand<ContextValue<"integrity">, "integrity">;
export type RegisteredEnrichmentExtension = Brand<NonNullable<SecurityAuditEvent["extensions"]>, "registered_extension">;

export interface DelegatedActorBundle {
  readonly actor: AuthoritativeActorContext;
  readonly delegation: DelegationContext;
}

export interface AuditContextFrame {
  readonly actor?: AuthoritativeActorContext | ClaimedActorContext;
  readonly subject?: SubjectAuthorityContext;
  readonly authenticated_principal?: AuthenticatedPrincipalContext;
  readonly delegation?: DelegationContext;
  readonly credential?: CredentialReferenceContext;
  readonly tenant?: TenantAuthorityContext;
  readonly claimedTenant?: ClaimedTenantContext;
  readonly resource?: ResourceAuthorityContext;
  readonly authentication?: AuthenticationEvidenceContext;
  readonly authorization?: AuthorizationEvidenceContext;
  readonly request?: ContextValue<"request">;
  readonly source?: ObservedSourceContext;
  readonly destination?: DestinationContext;
  readonly session?: SessionEvidenceContext;
  readonly correlation?: Partial<ContextValue<"correlation">>;
  readonly operation?: GeneratedOperationContext;
  readonly initiator?: ServiceWorkloadContext;
  readonly environment?: ContextValue<"environment">;
  readonly service?: ContextValue<"service">;
  readonly deployment?: ContextValue<"deployment">;
  readonly data?: DataPolicyContext;
  readonly risk?: RiskContext;
  readonly integrity?: IntegrityContext;
  readonly extensions?: RegisteredEnrichmentExtension;
}

export type AuditContextFrameInput = Readonly<Partial<AuditContextFrame>>;

const storage = new AsyncLocalStorage<AuditContextFrame>();

const FRAME_BRAND_FIELDS: ReadonlyArray<readonly [keyof AuditContextFrame, readonly AuditBrandKind[]]> = [
  ["actor", ["authoritative_actor", "claimed_actor"]],
  ["subject", ["subject_authority"]],
  ["authenticated_principal", ["authenticated_principal"]],
  ["delegation", ["delegation"]],
  ["credential", ["credential_reference"]],
  ["tenant", ["tenant_authority"]],
  ["claimedTenant", ["claimed_tenant"]],
  ["resource", ["resource_authority"]],
  ["authentication", ["authentication_evidence"]],
  ["authorization", ["authorization_evidence"]],
  ["session", ["session_evidence"]],
  ["initiator", ["service_workload"]],
  ["source", ["observed_source"]],
  ["destination", ["destination_boundary"]],
  ["data", ["data_policy"]],
  ["risk", ["risk"]],
  ["integrity", ["integrity"]],
  ["extensions", ["registered_extension"]],
];

interface AuthoritativeActorInput {
  readonly id: string;
  readonly tenantId?: string;
  readonly displayName?: string;
  readonly source?: string;
}

export function authoritativeActor(input: Omit<ContextValue<"actor">, "provenance"> & { readonly provenance?: ContextValue<"actor">["provenance"] }): AuthoritativeActorContext {
  requireNonEmptyString(input.type, "/actor/type");
  if (input.type !== "anonymous") requireNonEmptyString(input.id, "/actor/id");
  return brand(
    {
      ...input,
      provenance: {
        trust_level: "authoritative_server",
        source: input.provenance?.source ?? "configured-authority",
      },
    },
    "authoritative_actor",
  );
}

export function anonymousActor(source = "request_boundary"): ClaimedActorContext {
  return brand(
    {
      type: "anonymous",
      provenance: {
        trust_level: "client_claim",
        source,
      },
    },
    "claimed_actor",
  );
}

export function claimedActor(input: Omit<ContextValue<"actor">, "provenance"> & { readonly provenance?: ContextValue<"actor">["provenance"] }): ClaimedActorContext {
  requireNonEmptyString(input.type, "/actor/type");
  return brand(
    {
      ...input,
      provenance: {
        trust_level: "client_claim",
        source: input.provenance?.source ?? "request_boundary",
      },
    },
    "claimed_actor",
  );
}

function authoritativeTypedActor(type: ContextValue<"actor">["type"], input: AuthoritativeActorInput): AuthoritativeActorContext {
  return authoritativeActor(omitUndefined({
    type,
    id: input.id,
    tenant_id: input.tenantId,
    display_name: input.displayName,
    provenance: input.source === undefined ? undefined : { trust_level: "authoritative_server", source: input.source },
  }) as Omit<ContextValue<"actor">, "provenance"> & { readonly provenance?: ContextValue<"actor">["provenance"] });
}

export function authenticatedHumanActor(input: AuthoritativeActorInput): AuthoritativeActorContext {
  return authoritativeTypedActor("authenticated_human", input);
}

export function serviceAccountActor(input: AuthoritativeActorInput): AuthoritativeActorContext {
  return authoritativeTypedActor("service_account", input);
}

export function workloadIdentityActor(input: AuthoritativeActorInput): AuthoritativeActorContext {
  return authoritativeTypedActor("workload_identity", input);
}

export function apiCredentialActor(input: AuthoritativeActorInput): AuthoritativeActorContext {
  return authoritativeTypedActor("api_credential", input);
}

export function administratorActor(input: AuthoritativeActorInput): AuthoritativeActorContext {
  return authoritativeTypedActor("administrator", input);
}

export function backgroundJobActor(input: AuthoritativeActorInput): AuthoritativeActorContext {
  return authoritativeTypedActor("background_job", input);
}

export function scheduledProcessActor(input: AuthoritativeActorInput): AuthoritativeActorContext {
  return authoritativeTypedActor("scheduled_process", input);
}

export function externalIntegrationActor(input: AuthoritativeActorInput): AuthoritativeActorContext {
  return authoritativeTypedActor("external_integration", input);
}

export function delegatedActorContext(
  actor: AuthoritativeActorContext,
  delegation: Omit<ContextValue<"delegation">, "mode">,
): DelegatedActorBundle {
  requireBranded(actor, ["authoritative_actor"], "/delegation/actor");
  return { actor, delegation: delegationContext({ ...delegation, mode: "delegated" }) };
}

export function impersonatingActorContext(
  actor: AuthoritativeActorContext,
  delegation: Omit<ContextValue<"delegation">, "mode">,
): DelegatedActorBundle {
  requireBranded(actor, ["authoritative_actor"], "/delegation/actor");
  return { actor, delegation: delegationContext({ ...delegation, mode: "impersonation" }) };
}

export function authenticatedPrincipal(input: ContextValue<"authenticated_principal">): AuthenticatedPrincipalContext {
  return brand(input, "authenticated_principal");
}

export function authoritativeSubject(input: ContextValue<"subject">): SubjectAuthorityContext {
  return brand(input, "subject_authority");
}

export function credentialReference(input: ContextValue<"credential">): CredentialReferenceContext {
  return brand(input, "credential_reference");
}

export function delegationContext(input: ContextValue<"delegation">): DelegationContext {
  requireNonEmptyString(input.mode, "/delegation/mode");
  requireNonEmptyString(input.principal_id, "/delegation/principal_id");
  requireNonEmptyString(input.expires_at, "/delegation/expires_at");
  return brand(input, "delegation");
}

export function impersonationContext(input: Omit<ContextValue<"delegation">, "mode">): DelegationContext {
  return delegationContext({ ...input, mode: "impersonation" });
}

export function authoritativeTenant(input: Omit<ContextValue<"tenant">, "claimed_tenant_id">): TenantAuthorityContext {
  requireNonEmptyString(input.scope, "/tenant/scope");
  if (input.scope === "tenant" || input.scope === "cross_tenant") {
    requireNonEmptyString(input.effective_tenant_id, "/tenant/effective_tenant_id");
    requireNonEmptyString(input.resource_tenant_id, "/tenant/resource_tenant_id");
  }
  return brand(input, "tenant_authority");
}

export function claimedTenant(claimed_tenant_id: string): ClaimedTenantContext {
  requireNonEmptyString(claimed_tenant_id, "/tenant/claimed_tenant_id");
  return brand({ claimed_tenant_id }, "claimed_tenant");
}

export function authoritativeResource(input: ContextValue<"resource">): ResourceAuthorityContext {
  return brand(input, "resource_authority");
}

export function authenticationEvidence(input: ContextValue<"authentication">): AuthenticationEvidenceContext {
  return brand(input, "authentication_evidence");
}

export function authorizationEvidence(input: ContextValue<"authorization">): AuthorizationEvidenceContext {
  return brand(input, "authorization_evidence");
}

export function sessionEvidence(input: ContextValue<"session">): SessionEvidenceContext {
  return brand(input, "session_evidence");
}

export function serviceWorkload(input: ContextValue<"initiator">): ServiceWorkloadContext {
  return brand(input, "service_workload");
}

export function observedSource(input: ContextValue<"source">): ObservedSourceContext {
  return brand(input, "observed_source");
}

export function destinationContext(input: ContextValue<"destination">): DestinationContext {
  return brand(input, "destination_boundary");
}

export function dataPolicyContext(input: Partial<ContextValue<"data">>): DataPolicyContext {
  return brand(input, "data_policy");
}

export function riskContext(input: ContextValue<"risk">): RiskContext {
  return brand(input, "risk");
}

export function integrityContext(input: ContextValue<"integrity">): IntegrityContext {
  return brand(input, "integrity");
}

export function registeredEnrichmentExtension(input: NonNullable<SecurityAuditEvent["extensions"]>): RegisteredEnrichmentExtension {
  return brand(input, "registered_extension");
}

export function createAuditContextFrame(input: AuditContextFrameInput): AuditContextFrame {
  const result = normalizeFrame(input);
  if (!result.ok) throw new SecurityAuditSdkError(result.error.code, result.error.category, result.error.path);
  return result.value;
}

export function currentAuditContext(): AuditContextFrame | undefined {
  return storage.getStore();
}

export function runWithAuditContext<T>(frame: AuditContextFrameInput, callback: () => T): T {
  const merged = mergeAuditContextFrames(storage.getStore(), frame);
  if (!merged.ok) throw new SecurityAuditSdkError(merged.error.code, merged.error.category, merged.error.path);
  return storage.run(merged.value, callback);
}

export function mergeAuditContextFrames(
  parent: AuditContextFrameInput | undefined,
  child: AuditContextFrameInput | undefined,
): AuditResult<AuditContextFrame> {
  const merged = omitUndefined({
    ...(parent ?? {}),
    ...(child ?? {}),
    request: parent?.request === undefined && child?.request === undefined ? undefined : { ...(parent?.request ?? {}), ...(child?.request ?? {}) },
    correlation: parent?.correlation === undefined && child?.correlation === undefined ? undefined : { ...(parent?.correlation ?? {}), ...(child?.correlation ?? {}) },
  }) as AuditContextFrameInput;
  return normalizeFrame(merged);
}

function normalizeFrame(input: AuditContextFrameInput): AuditResult<AuditContextFrame> {
  for (const [field, kinds] of FRAME_BRAND_FIELDS) {
    const value = input[field];
    if (value === undefined) continue;
    if (!isBranded(value, ...kinds)) return failure("AUTHORITY_ESCALATION", "authority", `/${String(field)}`);
  }
  const frame = omitUndefined({
    actor: input.actor,
    subject: input.subject,
    authenticated_principal: input.authenticated_principal,
    delegation: input.delegation,
    credential: input.credential,
    tenant: input.tenant,
    claimedTenant: input.claimedTenant,
    resource: input.resource,
    authentication: input.authentication,
    authorization: input.authorization,
    request: cloneIfPresent(input.request),
    source: input.source,
    destination: input.destination,
    session: input.session,
    correlation: cloneIfPresent(input.correlation),
    operation: cloneIfPresent(input.operation),
    initiator: input.initiator,
    environment: cloneIfPresent(input.environment),
    service: cloneIfPresent(input.service),
    deployment: cloneIfPresent(input.deployment),
    data: input.data,
    risk: input.risk,
    integrity: input.integrity,
    extensions: input.extensions,
  }) as AuditContextFrame;
  return { ok: true, value: deepFreeze(frame) };
}

function brand<T extends object, Kind extends AuditBrandKind>(input: T, kind: Kind): Brand<T, Kind> {
  const copy = deepFreeze(clonePlain(input)) as T;
  brandRegistry.set(copy, kind);
  return copy as Brand<T, Kind>;
}

function isBranded(value: unknown, ...kinds: readonly AuditBrandKind[]): boolean {
  if (!value || typeof value !== "object") return false;
  const kind = brandRegistry.get(value);
  return kind !== undefined && (kinds as readonly string[]).includes(kind);
}

function requireBranded(value: unknown, kinds: readonly AuditBrandKind[], path: string): void {
  if (!isBranded(value, ...kinds)) throw new SecurityAuditSdkError("AUTHORITY_ESCALATION", "authority", path);
}

function requireNonEmptyString(value: unknown, path: string): asserts value is string {
  if (typeof value !== "string" || value.length === 0) throw new SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", path);
}

function cloneIfPresent<T>(value: T | undefined): T | undefined {
  return value === undefined ? undefined : clonePlain(value);
}
