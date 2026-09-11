// The collector ingress: the fixed stage order
//   authenticate → size → parse → schema → version → deduplicate → [persist] → accept
// where every stage fails closed. A rejection at any stage terminates before
// any later stage runs, before admission, and before any capacity is
// consumed. Without storage, acceptance is admission only: the occurrence
// enters `admitted` with its event identity and the sender identity recorded
// at the authentication boundary, and no durability claim is made (delivery
// conformance contract, #102). With storage configured, the persist stage runs
// and the only acknowledgment is `persisted`, issued after the storage port
// confirms the write and never ahead of it (collector-storage-semantics, #114).

import type { Authenticator } from "./auth.js";
import { EVENT_MAX_BYTES } from "./bounds.js";
import { DeduplicationLedger, type Acknowledgment, type Now } from "./deduplication.js";
import {
  DIAGNOSTIC_CODES,
  type DiagnosticCategory,
  type IngressDiagnostic,
} from "./diagnostics.js";
import { MetricsRecorder, type IngressMetrics, type MetricKey } from "./metrics.js";
import { validateStructural, type StructuralResult } from "./schema.js";
import {
  RETENTION_MILLISECONDS,
  assertStorageOwners,
  isStorageScope,
  isStoredRetentionClass,
  type PutResult,
  type StorageConfiguration,
  type StoragePort,
  type StorageScope,
  type StoredRecord,
} from "./storage.js";
import { isSupportedVersion, schemaVersionOf } from "./version.js";

export interface Submission {
  readonly credentials?: unknown;
  readonly body: string;
}

export interface Admission {
  readonly kind: "admitted";
  readonly eventId: string;
  readonly senderIdentity: string;
}

export interface PersistedAdmission {
  readonly kind: "persisted";
  readonly eventId: string;
  readonly senderIdentity: string;
}

interface DeduplicationInput {
  readonly senderIdentity: string;
  readonly eventId: string;
  readonly dedupKey: string;
}

export interface DuplicateAdmission {
  readonly kind: "duplicate";
  readonly eventId: string;
  readonly senderIdentity: string;
  // What the retained first-seen occurrence was acknowledged with; a
  // duplicate never claims more durability than that.
  readonly acknowledgment: Acknowledgment;
}

export interface IngressRejection {
  readonly kind: "rejected";
  readonly diagnostic: IngressDiagnostic;
}

export type IngressResult = Admission | PersistedAdmission | DuplicateAdmission | IngressRejection;

export type ParseFunction = (text: string) => unknown;
export type ValidateFunction = (value: unknown) => StructuralResult;

export interface IngressOptions {
  readonly authenticator: Authenticator;
  // Test-only deterministic-provider injections (SDK context pattern): the
  // E2 ordering arm instruments the parse stage by wrapping JSON.parse.
  readonly parse?: ParseFunction;
  readonly validate?: ValidateFunction;
  // Deterministic synthetic-clock injection for expiry controls. It does not
  // create a scheduler, persistence mechanism, or production configuration.
  readonly now?: Now;
  // Enables the persist stage. Construction fails unless all three owner
  // roles are named: an unnamed role blocks storage.
  readonly storage?: StorageConfiguration;
}

type Authentication =
  | { readonly kind: "verified"; readonly identity: string }
  | { readonly kind: "rejected"; readonly diagnostic: IngressDiagnostic };
type ParsedBody =
  | { readonly kind: "parsed"; readonly value: unknown }
  | { readonly kind: "rejected"; readonly diagnostic: IngressDiagnostic };
type PreparedRecord =
  | { readonly kind: "prepared"; readonly scope: StorageScope; readonly record: StoredRecord }
  | { readonly kind: "rejected"; readonly diagnostic: IngressDiagnostic; readonly metric: MetricKey };

const METRIC_BY_CATEGORY: Readonly<Record<DiagnosticCategory, MetricKey>> = Object.freeze({
  authentication: "rejectedAuthentication",
  size: "rejectedSize",
  parse: "rejectedParse",
  validation: "rejectedSchema",
  version: "rejectedVersion",
  deduplication: "rejectedDuplicateConflict",
  storage: "rejectedStorageWrite",
});

export class CollectorIngress {
  readonly #authenticator: Authenticator;
  readonly #parse: ParseFunction;
  readonly #validate: ValidateFunction;
  readonly #deduplication: DeduplicationLedger;
  readonly #now: Now;
  readonly #storage: StoragePort | null;
  readonly #metrics = new MetricsRecorder();

  constructor(options: IngressOptions) {
    this.#authenticator = options.authenticator;
    this.#parse = options.parse ?? defaultParse;
    this.#validate = options.validate ?? validateStructural;
    this.#now = options.now ?? Date.now;
    this.#deduplication = new DeduplicationLedger(this.#now);
    this.#storage = storagePortOf(options.storage);
  }

  submit(submission: Submission): IngressResult {
    const authentication = authenticate(this.#authenticator, submission.credentials);
    if (authentication.kind === "rejected") {
      return reject(authentication.diagnostic, this.#metrics);
    }

    const oversized = size(submission.body);
    if (oversized !== null) {
      return reject(oversized, this.#metrics);
    }

    const parsed = parseBody(this.#parse, submission.body);
    if (parsed.kind === "rejected") {
      return reject(parsed.diagnostic, this.#metrics);
    }

    const structural = this.#validate(parsed.value);
    if (!structural.valid) {
      return reject(schemaDiagnostic(structural), this.#metrics);
    }

    const unsupported = version(parsed.value);
    if (unsupported !== null) {
      return reject(unsupported, this.#metrics);
    }

    const identity: DeduplicationInput = {
      senderIdentity: authentication.identity,
      eventId: eventIdOf(parsed.value),
      dedupKey: deduplicationKeyOf(parsed.value),
    };
    const deduplicated = this.#deduplicate(identity);
    if (deduplicated !== null) {
      return deduplicated;
    }

    if (this.#storage !== null) {
      return this.#persist(this.#storage, parsed.value, identity, submission.body);
    }

    const admission = accept(parsed.value, authentication.identity);
    this.#metrics.increment("accepted");
    return admission;
  }

  // The persist stage. `persisted` is returned only for a write the port has
  // confirmed; every other outcome withdraws the first-seen reservation and
  // rejects, so a retry is written again rather than answered as a duplicate
  // of evidence that was never stored.
  #persist(port: StoragePort, value: unknown, identity: DeduplicationInput, body: string): IngressResult {
    const prepared = prepareRecord(value, identity, body, this.#now());
    if (prepared.kind === "rejected") {
      this.#deduplication.release(identity.senderIdentity, identity.eventId);
      return reject(prepared.diagnostic, this.#metrics, prepared.metric);
    }
    const written = putWithoutThrowing(port, prepared.scope, prepared.record);
    if (written.kind === "written" || written.kind === "duplicate") {
      this.#deduplication.confirmPersisted(identity.senderIdentity, identity.eventId);
      this.#metrics.increment("persisted");
      return { kind: "persisted", eventId: identity.eventId, senderIdentity: identity.senderIdentity };
    }
    this.#deduplication.release(identity.senderIdentity, identity.eventId);
    const failure = writeFailure(written);
    return reject(failure.diagnostic, this.#metrics, failure.metric);
  }

  // Maps one ledger decision to a bounded public outcome. Returns null on a
  // first-seen reservation so the caller proceeds to admission; every other
  // decision terminates the submission without consuming admission capacity.
  #deduplicate(input: DeduplicationInput): IngressResult | null {
    const decision = this.#deduplication.decide(input.senderIdentity, input.eventId, input.dedupKey);
    if (decision === "first") {
      return null;
    }
    if (decision === "duplicate") {
      this.#metrics.increment("deduplicated");
      return {
        kind: "duplicate",
        eventId: input.eventId,
        senderIdentity: input.senderIdentity,
        acknowledgment: this.#deduplication.acknowledgmentOf(input.senderIdentity, input.eventId),
      };
    }
    if (decision === "conflict") {
      return reject(
        { code: DIAGNOSTIC_CODES.DUPLICATE_CONFLICT, category: "deduplication", path: "/event/id" },
        this.#metrics,
      );
    }
    return reject(
      { code: DIAGNOSTIC_CODES.DEDUPLICATION_CAPACITY, category: "deduplication", path: "/event/id" },
      this.#metrics,
      "rejectedDeduplicationCapacity",
    );
  }

  metrics(): Readonly<IngressMetrics> {
    return this.#metrics.snapshot();
  }
}

function authenticate(authenticator: Authenticator, credentials: unknown): Authentication {
  const result = authenticator.verify(credentials);
  if (result.kind === "verified") {
    return { kind: "verified", identity: result.identity };
  }
  const codes = {
    missing: DIAGNOSTIC_CODES.AUTH_MISSING,
    malformed: DIAGNOSTIC_CODES.AUTH_MALFORMED,
    invalid: DIAGNOSTIC_CODES.AUTH_REJECTED,
  } as const;
  return {
    kind: "rejected",
    diagnostic: {
      code: codes[result.reason],
      category: "authentication",
      path: "/credentials",
    },
  };
}

function size(body: string): IngressDiagnostic | null {
  const bytes = new TextEncoder().encode(body).byteLength;
  if (bytes > EVENT_MAX_BYTES) {
    return { code: DIAGNOSTIC_CODES.SIZE_EXCEEDED, category: "size", path: "/" };
  }
  return null;
}

function parseBody(parse: ParseFunction, body: string): ParsedBody {
  try {
    return { kind: "parsed", value: parse(body) };
  } catch {
    return {
      kind: "rejected",
      diagnostic: { code: DIAGNOSTIC_CODES.PARSE_INVALID, category: "parse", path: "/" },
    };
  }
}

function schemaDiagnostic(structural: Extract<StructuralResult, { valid: false }>): IngressDiagnostic {
  return {
    code: DIAGNOSTIC_CODES.SCHEMA_INVALID,
    category: "validation",
    path: structural.failure.schemaPath,
  };
}

function version(parsed: unknown): IngressDiagnostic | null {
  if (isSupportedVersion(schemaVersionOf(parsed))) return null;
  return { code: DIAGNOSTIC_CODES.VERSION_UNSUPPORTED, category: "version", path: "/schema/version" };
}

function accept(parsed: unknown, senderIdentity: string): Admission {
  return { kind: "admitted", eventId: eventIdOf(parsed), senderIdentity };
}

function storagePortOf(storage: StorageConfiguration | undefined): StoragePort | null {
  if (storage === undefined) return null;
  assertStorageOwners(storage.owners);
  return storage.port;
}

// Builds the stored record from an event the schema and version stages have
// already validated, keeping the submitted bytes exactly as received.
// Retention comes from the record's own retention class, and the scope from
// its own tenancy; neither is supplied by the deployment.
function prepareRecord(
  value: unknown,
  identity: DeduplicationInput,
  body: string,
  admittedAt: number,
): PreparedRecord {
  const record = value as {
    readonly data?: { readonly retention_class?: unknown };
    readonly tenant?: { readonly scope?: unknown; readonly effective_tenant_id?: unknown };
  };
  const retentionClass = record.data?.retention_class;
  if (!isStoredRetentionClass(retentionClass)) {
    return {
      kind: "rejected",
      diagnostic: { code: DIAGNOSTIC_CODES.RETENTION_CLASS_DECLINED, category: "storage", path: "/data/retention_class" },
      metric: "rejectedRetentionDeclined",
    };
  }
  const schemaVersion = schemaVersionOf(value);
  const scope = storageScopeOf(record.tenant);
  if (scope === null || typeof schemaVersion !== "string") {
    return {
      kind: "rejected",
      diagnostic: { code: DIAGNOSTIC_CODES.STORAGE_SCOPE_UNRESOLVED, category: "storage", path: "/tenant" },
      metric: "rejectedStorageScope",
    };
  }
  return {
    kind: "prepared",
    scope,
    record: {
      eventId: identity.eventId,
      schemaVersion,
      retentionClass,
      admittedAt,
      expiresAt: admittedAt + RETENTION_MILLISECONDS[retentionClass],
      occurrenceKey: identity.dedupKey,
      body,
    },
  };
}

// Tenant-less kinds carry no identifier; `tenant` and `cross_tenant` are only
// a scope with their effective tenant identifier, and isStorageScope rejects
// either without one.
function storageScopeOf(
  tenant: { readonly scope?: unknown; readonly effective_tenant_id?: unknown } | undefined,
): StorageScope | null {
  const kind = tenant?.scope;
  const candidate = kind === "platform" || kind === "tenantless" ? { kind } : { kind, tenantId: tenant?.effective_tenant_id };
  return isStorageScope(candidate) ? candidate : null;
}

// The port contract forbids exceptions, but the ingress does not rely on a
// port honouring it: a throw or an unrecognised result leaves the write's
// outcome unknown, and unknown is never persisted.
function putWithoutThrowing(port: StoragePort, scope: StorageScope, record: StoredRecord): PutResult {
  try {
    const result = port.put(scope, record);
    return isPutResult(result) ? result : { kind: "indeterminate" };
  } catch {
    return { kind: "indeterminate" };
  }
}

function isPutResult(value: unknown): value is PutResult {
  if (typeof value !== "object" || value === null) return false;
  const kind = (value as { readonly kind?: unknown }).kind;
  return kind === "written" || kind === "duplicate" || kind === "failed" || kind === "indeterminate";
}

function writeFailure(result: Exclude<PutResult, { kind: "written" | "duplicate" }>): {
  readonly diagnostic: IngressDiagnostic;
  readonly metric: MetricKey;
} {
  if (result.kind === "indeterminate") {
    return {
      diagnostic: { code: DIAGNOSTIC_CODES.STORAGE_WRITE_INDETERMINATE, category: "storage", path: "/" },
      metric: "rejectedStorageIndeterminate",
    };
  }
  if (result.reason === "conflict") {
    return {
      diagnostic: { code: DIAGNOSTIC_CODES.STORAGE_CONFLICT, category: "storage", path: "/event/id" },
      metric: "rejectedStorageConflict",
    };
  }
  return {
    diagnostic: { code: DIAGNOSTIC_CODES.STORAGE_WRITE_FAILED, category: "storage", path: "/" },
    metric: "rejectedStorageWrite",
  };
}

function eventIdOf(value: unknown): string {
  if (typeof value !== "object" || value === null) return "";
  const event = (value as { readonly event?: unknown }).event;
  if (typeof event !== "object" || event === null) return "";
  const id = (event as { readonly id?: unknown }).id;
  return typeof id === "string" ? id : "";
}

// Delivery conformance contract §Attempt identity: correlation.retry_attempt
// is the only field an implementation is required to advance across retries
// of one occurrence, so it is the only field excluded here. Comparing every
// other field exactly (rather than a fingerprint) keeps a genuinely
// different payload under the same identity distinguishable as a conflict.
function deduplicationKeyOf(value: unknown): string {
  return canonicalStringify(withoutRetryAttempt(value));
}

function withoutRetryAttempt(value: unknown): unknown {
  if (typeof value !== "object" || value === null) return value;
  const record = value as Record<string, unknown>;
  const correlation = record.correlation;
  if (typeof correlation !== "object" || correlation === null) return value;
  const { retry_attempt: _retryAttempt, ...correlationRest } = correlation as Record<string, unknown>;
  return { ...record, correlation: correlationRest };
}

// Deterministic, key-sorted serialization so the comparison does not depend
// on incidental property insertion order — a structural equality check, not
// a hash, so it carries no collision risk.
function canonicalStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalStringify).join(",")}]`;
  }
  if (typeof value === "object" && value !== null) {
    const record = value as Record<string, unknown>;
    const entries = Object.keys(record)
      .sort(compareCodePointOrder)
      .map((key) => `${JSON.stringify(key)}:${canonicalStringify(record[key])}`);
    return `{${entries.join(",")}}`;
  }
  return JSON.stringify(value);
}

// Deliberately code-point order, not localeCompare: this key must be
// identical across locales, not merely alphabetically pleasing.
function compareCodePointOrder(a: string, b: string): number {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

function defaultParse(text: string): unknown {
  return JSON.parse(text) as unknown;
}

function reject(
  diagnostic: IngressDiagnostic,
  metrics: MetricsRecorder,
  metricKey: MetricKey = METRIC_BY_CATEGORY[diagnostic.category],
): IngressRejection {
  metrics.increment(metricKey);
  return { kind: "rejected", diagnostic };
}
