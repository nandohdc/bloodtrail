// The collector ingress: the fixed stage order
//   authenticate → size → parse → schema → version → deduplicate → accept
// where every stage fails closed. A rejection at any stage terminates before
// any later stage runs, before admission, and before any capacity is
// consumed. Acceptance is admission only: the occurrence enters `admitted`
// with its event identity and the sender identity recorded at the
// authentication boundary; no durability, delivery, retry, storage, or
// downstream claim is made (delivery conformance contract, #102).

import type { Authenticator } from "./auth.js";
import { EVENT_MAX_BYTES } from "./bounds.js";
import { DeduplicationLedger, type Now } from "./deduplication.js";
import {
  DIAGNOSTIC_CODES,
  type DiagnosticCategory,
  type IngressDiagnostic,
} from "./diagnostics.js";
import { MetricsRecorder, type IngressMetrics, type MetricKey } from "./metrics.js";
import { validateStructural, type StructuralResult } from "./schema.js";
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

interface DeduplicationInput {
  readonly senderIdentity: string;
  readonly eventId: string;
  readonly dedupKey: string;
}

export interface DuplicateAdmission {
  readonly kind: "duplicate";
  readonly eventId: string;
  readonly senderIdentity: string;
}

export interface IngressRejection {
  readonly kind: "rejected";
  readonly diagnostic: IngressDiagnostic;
}

export type IngressResult = Admission | DuplicateAdmission | IngressRejection;

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
}

type Authentication =
  | { readonly kind: "verified"; readonly identity: string }
  | { readonly kind: "rejected"; readonly diagnostic: IngressDiagnostic };
type ParsedBody =
  | { readonly kind: "parsed"; readonly value: unknown }
  | { readonly kind: "rejected"; readonly diagnostic: IngressDiagnostic };

const METRIC_BY_CATEGORY: Readonly<Record<DiagnosticCategory, MetricKey>> = Object.freeze({
  authentication: "rejectedAuthentication",
  size: "rejectedSize",
  parse: "rejectedParse",
  validation: "rejectedSchema",
  version: "rejectedVersion",
  deduplication: "rejectedDuplicateConflict",
});

export class CollectorIngress {
  readonly #authenticator: Authenticator;
  readonly #parse: ParseFunction;
  readonly #validate: ValidateFunction;
  readonly #deduplication: DeduplicationLedger;
  readonly #metrics = new MetricsRecorder();

  constructor(options: IngressOptions) {
    this.#authenticator = options.authenticator;
    this.#parse = options.parse ?? defaultParse;
    this.#validate = options.validate ?? validateStructural;
    this.#deduplication = new DeduplicationLedger(options.now);
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

    const deduplicated = this.#deduplicate({
      senderIdentity: authentication.identity,
      eventId: eventIdOf(parsed.value),
      dedupKey: deduplicationKeyOf(parsed.value),
    });
    if (deduplicated !== null) {
      return deduplicated;
    }

    const admission = accept(parsed.value, authentication.identity);
    this.#metrics.increment("accepted");
    return admission;
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
      return { kind: "duplicate", eventId: input.eventId, senderIdentity: input.senderIdentity };
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
