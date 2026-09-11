// Fail-closed backend ingress for ClientEvidenceEnvelope v1 (#126). It validates version,
// structure, bounds, and vocabulary, refuses any envelope that addresses server-owned audit
// material, and in Mode A spends the envelope's server-issued nonce — all before anything can
// be mapped. Rejections are counted by stable class only: no counter, result, or diagnostic
// carries a payload, identifier, nonce, or binding, and the counters are never audit evidence.
// An absent envelope is simply never submitted here; absence carries no security meaning.
//
// An admitted envelope proves only that a well-formed, bounded claim arrived with a live nonce
// under the context the server issued it to. It does not prove a browser produced it, that the
// interaction happened, or that the claim is true.

import { AUDIT_RECORD_MEMBERS } from "./generated/envelope-rules.generated.js";
import { type EnvelopeCode, type EnvelopeRecord, inspectEnvelope } from "./envelope-validation.js";
import { type InteractionNonceLedger, type NonceDecision, isValidBinding } from "./envelope-nonces.js";

export const ENVELOPE_REJECTION_CLASSES = Object.freeze([
  "fabrication",
  "version",
  "bounds",
  "vocabulary",
  "structure",
  "unbound",
  "replay",
  "substitution",
] as const);

export type EnvelopeRejectionClass = (typeof ENVELOPE_REJECTION_CLASSES)[number];

export interface EnvelopeSubmission {
  // The envelope exactly as the host page sent it.
  readonly body: string;
  // The server-authoritative context the nonce was issued to; never read from the envelope.
  readonly binding: string;
}

export interface AdmittedEnvelope {
  readonly kind: "admitted";
  readonly interactionId: string;
  readonly interactionKind: string;
  readonly envelopeVersion: number;
  readonly platform: string;
}

export interface EnvelopeRejection {
  readonly kind: "rejected";
  readonly rejectionClass: EnvelopeRejectionClass;
}

export type EnvelopeAdmissionResult = AdmittedEnvelope | EnvelopeRejection;

export type EnvelopeIngressMetrics = Readonly<Record<"admitted" | EnvelopeRejectionClass, number>>;

export interface EnvelopeIngressOptions {
  readonly nonces: InteractionNonceLedger;
}

// The class each validation code reports under. When an envelope fails several ways, the
// class earliest in ENVELOPE_REJECTION_CLASSES wins, so an attempt to address server-owned
// material is never reported as a mere structural fault.
const CLASS_BY_CODE: Readonly<Record<EnvelopeCode, EnvelopeRejectionClass>> = Object.freeze({
  FORBIDDEN_CLAIM: "fabrication",
  TRUST_ESCALATION_ATTEMPT: "fabrication",
  UNKNOWN_VERSION: "version",
  ENVELOPE_TOO_LARGE: "bounds",
  OVERSIZED_COLLECTION: "bounds",
  OVERSIZED_STRING: "bounds",
  UNKNOWN_INTERACTION_KIND: "vocabulary",
  MALFORMED_JSON: "structure",
  UNKNOWN_FIELD: "structure",
  INVALID_INTERACTION_ID: "structure",
  INVALID_TIMESTAMP: "structure",
  MALFORMED_PROVENANCE: "structure",
  INVALID_NONCE: "structure",
});

const CLASS_BY_NONCE_DECISION: Readonly<Record<Exclude<NonceDecision, "consumed">, EnvelopeRejectionClass>> = Object.freeze({
  replayed: "replay",
  expired: "replay",
  unknown: "replay",
  substituted: "substitution",
});

const AUDIT_MEMBERS = new Set(AUDIT_RECORD_MEMBERS);
const admittedEnvelopes = new WeakSet<AdmittedEnvelope>();

/** True only for a value this module admitted; a copy or a hand-built object is never admitted. */
export function isAdmittedEnvelope(value: unknown): value is AdmittedEnvelope {
  return typeof value === "object" && value !== null && admittedEnvelopes.has(value as AdmittedEnvelope);
}

function precedence(rejectionClass: EnvelopeRejectionClass): number {
  return ENVELOPE_REJECTION_CLASSES.indexOf(rejectionClass);
}

function classify(codes: readonly EnvelopeCode[], envelope: EnvelopeRecord | null): EnvelopeRejectionClass | null {
  const classes: EnvelopeRejectionClass[] = codes.map((code) => CLASS_BY_CODE[code]);
  if (envelope !== null && Object.keys(envelope).some((key) => AUDIT_MEMBERS.has(key))) classes.push("fabrication");
  const [firstClass] = classes;
  if (!firstClass) return null;
  return classes.reduce(
    (first, next) => (precedence(next) < precedence(first) ? next : first),
    firstClass
  );
}

function admit(envelope: EnvelopeRecord): AdmittedEnvelope {
  const provenance = envelope.provenance as EnvelopeRecord;
  const admitted: AdmittedEnvelope = Object.freeze({
    kind: "admitted",
    interactionId: envelope.interaction_id as string,
    interactionKind: envelope.interaction_kind as string,
    envelopeVersion: envelope.envelope_version as number,
    platform: provenance.platform as string,
  });
  admittedEnvelopes.add(admitted);
  return admitted;
}

export class ClientEvidenceIngress {
  readonly #nonces: InteractionNonceLedger;
  readonly #counts = new Map<"admitted" | EnvelopeRejectionClass, number>();

  constructor(options: EnvelopeIngressOptions) {
    this.#nonces = options.nonces;
  }

  admit(submission: EnvelopeSubmission): EnvelopeAdmissionResult {
    const body: unknown = submission?.body;
    if (typeof body !== "string") return this.#reject("structure");
    const inspection = inspectEnvelope(body);
    const invalid = classify(inspection.codes, inspection.envelope);
    if (invalid !== null) return this.#reject(invalid);
    const envelope = inspection.envelope as EnvelopeRecord;
    const nonce = envelope.nonce;
    const binding: unknown = submission.binding;
    if (typeof nonce !== "string" || !isValidBinding(binding)) return this.#reject("unbound");
    const decision = this.#nonces.consume(nonce, binding);
    if (decision !== "consumed") return this.#reject(CLASS_BY_NONCE_DECISION[decision]);
    this.#increment("admitted");
    return admit(envelope);
  }

  metrics(): EnvelopeIngressMetrics {
    const snapshot: Record<string, number> = { admitted: this.#counts.get("admitted") ?? 0 };
    for (const rejectionClass of ENVELOPE_REJECTION_CLASSES) snapshot[rejectionClass] = this.#counts.get(rejectionClass) ?? 0;
    return Object.freeze(snapshot) as EnvelopeIngressMetrics;
  }

  #reject(rejectionClass: EnvelopeRejectionClass): EnvelopeRejection {
    this.#increment(rejectionClass);
    return Object.freeze({ kind: "rejected", rejectionClass });
  }

  #increment(key: "admitted" | EnvelopeRejectionClass): void {
    this.#counts.set(key, (this.#counts.get(key) ?? 0) + 1);
  }
}
