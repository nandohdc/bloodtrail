// The collector ingress: the fixed stage order
//   authenticate → size → parse → schema → version → accept
// where every stage fails closed. A rejection at any stage terminates before
// any later stage runs, before admission, and before any capacity is
// consumed. Acceptance is admission only: the occurrence enters `admitted`
// with its event identity and the sender identity recorded at the
// authentication boundary; no durability, delivery, retry, storage, or
// downstream claim is made (delivery conformance contract, #102).

import type { Authenticator } from "./auth.js";
import { EVENT_MAX_BYTES } from "./bounds.js";
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

export interface IngressRejection {
  readonly kind: "rejected";
  readonly diagnostic: IngressDiagnostic;
}

export type IngressResult = Admission | IngressRejection;

export type ParseFunction = (text: string) => unknown;
export type ValidateFunction = (value: unknown) => StructuralResult;

export interface IngressOptions {
  readonly authenticator: Authenticator;
  // Test-only deterministic-provider injections (SDK context pattern): the
  // E2 ordering arm instruments the parse stage by wrapping JSON.parse.
  readonly parse?: ParseFunction;
  readonly validate?: ValidateFunction;
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
});

export class CollectorIngress {
  readonly #authenticator: Authenticator;
  readonly #parse: ParseFunction;
  readonly #validate: ValidateFunction;
  readonly #metrics = new MetricsRecorder();

  constructor(options: IngressOptions) {
    this.#authenticator = options.authenticator;
    this.#parse = options.parse ?? defaultParse;
    this.#validate = options.validate ?? validateStructural;
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

    const admission = accept(parsed.value, authentication.identity);
    this.#metrics.increment("accepted");
    return admission;
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

function defaultParse(text: string): unknown {
  return JSON.parse(text) as unknown;
}

function reject(diagnostic: IngressDiagnostic, metrics: MetricsRecorder): IngressRejection {
  metrics.increment(METRIC_BY_CATEGORY[diagnostic.category]);
  return { kind: "rejected", diagnostic };
}
