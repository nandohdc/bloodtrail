// Mapping an admitted client-evidence envelope to the audit record's bounded reference (#127).
//
// The mapping writes exactly one field of the record: `client_evidence`. It never writes, derives,
// or influences a server-owned field, and it never invents a value the contract does not admit —
// the platform set and the fixed provenance are generated from the audit contract itself.
//
// Correlation is server-authoritative. A mapping is attempted for one request, under the binding
// the server issued that interaction's nonce to, over the envelopes that request admitted. Zero
// envelopes is absence and means nothing. More than one is ambiguous. An interaction that returns
// claiming a different kind conflicts. Each of those maps nothing, deterministically.
//
// A mapped reference proves only that a client claimed this interaction. It is never evidence that
// the interaction happened, that a browser produced it, or that the producer did not fabricate it.
//
// The collector's own ingress validates structurally by ratified design, so a derived result that
// over-claims trust over this reference is refused where the floor is enforced — the contract
// validator and the producer SDK's semantic kernel — not here.

import {
  AUDIT_CLIENT_EVIDENCE_PLATFORMS,
  AUDIT_CLIENT_EVIDENCE_PROVENANCE,
} from "./generated/envelope-rules.generated.js";
import { type AdmittedEnvelope, isAdmittedEnvelope } from "./envelope-ingress.js";
import { NONCE_LIFETIME_MILLISECONDS, isValidBinding } from "./envelope-nonces.js";
import type { Now } from "./deduplication.js";

export const CLAIM_MAX_RECORDS = 1_024;

export interface ClientEvidenceReference {
  readonly interaction_id: string;
  readonly interaction_kind: string;
  readonly envelope_version: number;
  readonly provenance: {
    readonly source: string;
    readonly trust_level: string;
    readonly platform: string;
    readonly capture_scope: string;
  };
}

export type UnmappedReason =
  | "absent"
  | "ambiguous"
  | "unadmitted"
  | "unsupported_platform"
  | "conflict"
  | "capacity";

export type ClaimMapping =
  | { readonly kind: "mapped"; readonly reference: ClientEvidenceReference }
  | { readonly kind: "unmapped"; readonly reason: UnmappedReason };

export interface ClaimMapperOptions {
  readonly now?: Now;
}

const PLATFORMS = new Set(AUDIT_CLIENT_EVIDENCE_PLATFORMS);

// One interaction as the mapping knows it: what an admitted envelope carried, or what this
// context admitted earlier for the same identifier.
interface InteractionFacts {
  readonly interactionId: string;
  readonly interactionKind: string;
  readonly envelopeVersion: number;
  readonly platform: string;
}

// Length-prefixed so no binding and identifier pair can collide with another.
function claimKey(claim: { readonly binding: string; readonly interactionId: string }): string {
  return `${claim.binding.length}:${claim.binding}:${claim.interactionId}`;
}

function reference(facts: InteractionFacts): ClientEvidenceReference {
  return Object.freeze({
    interaction_id: facts.interactionId,
    interaction_kind: facts.interactionKind,
    envelope_version: facts.envelopeVersion,
    provenance: Object.freeze({
      source: AUDIT_CLIENT_EVIDENCE_PROVENANCE.source,
      trust_level: AUDIT_CLIENT_EVIDENCE_PROVENANCE.trust_level,
      platform: facts.platform,
      capture_scope: AUDIT_CLIENT_EVIDENCE_PROVENANCE.capture_scope,
    }),
  });
}

function unmapped(reason: UnmappedReason): ClaimMapping {
  return Object.freeze({ kind: "unmapped", reason });
}

/** Selects the one admitted envelope a request may map, or the reason it maps nothing. */
function selectAdmitted(admitted: readonly unknown[]): AdmittedEnvelope | UnmappedReason {
  if (admitted.length === 0) return "absent";
  if (admitted.length > 1) return "ambiguous";
  const [candidate] = admitted;
  if (!isAdmittedEnvelope(candidate)) return "unadmitted";
  if (!PLATFORMS.has(candidate.platform)) return "unsupported_platform";
  return candidate;
}

interface AdmittedClaim {
  readonly kind: string;
  readonly platform: string;
  readonly envelopeVersion: number;
  readonly expiresAt: number;
}

export class InteractionClaimMapper {
  readonly #claims = new Map<string, AdmittedClaim>();
  readonly #now: Now;

  constructor(options: ClaimMapperOptions = {}) {
    this.#now = options.now ?? Date.now;
  }

  map(binding: string, admitted: readonly unknown[]): ClaimMapping {
    if (!isValidBinding(binding) || !Array.isArray(admitted)) return unmapped("unadmitted");
    const selected = selectAdmitted(admitted);
    if (typeof selected === "string") return unmapped(selected);
    const agreed = this.#agree(binding, selected);
    if (agreed !== null) return unmapped(agreed);
    return Object.freeze({ kind: "mapped", reference: reference(selected) });
  }

  /**
   * Maps a later request of an interaction this context already admitted. A Mode A nonce is
   * single-use, so only the first request of an interaction carries an envelope; the rest carry
   * the identifier alone (#122). Only a pair this mapper admitted, and has not expired, recalls —
   * an identifier the server never admitted under this context maps nothing.
   */
  recall(binding: string, interactionId: string): ClaimMapping {
    if (!isValidBinding(binding) || typeof interactionId !== "string") return unmapped("unadmitted");
    const currentTime = this.#now();
    this.#purgeExpired(currentTime);
    const claim = this.#claims.get(claimKey({ binding, interactionId }));
    if (claim === undefined) return unmapped("unadmitted");
    const facts = { interactionId, interactionKind: claim.kind, envelopeVersion: claim.envelopeVersion, platform: claim.platform };
    return Object.freeze({ kind: "mapped", reference: reference(facts) });
  }

  /** null when this interaction may map; otherwise the reason it may not. */
  #agree(binding: string, admitted: AdmittedEnvelope): UnmappedReason | null {
    const currentTime = this.#now();
    this.#purgeExpired(currentTime);
    const key = claimKey({ binding, interactionId: admitted.interactionId });
    const seen = this.#claims.get(key);
    if (seen !== undefined) return seen.kind === admitted.interactionKind ? null : "conflict";
    if (this.#claims.size >= CLAIM_MAX_RECORDS) return "capacity";
    this.#claims.set(key, {
      kind: admitted.interactionKind,
      platform: admitted.platform,
      envelopeVersion: admitted.envelopeVersion,
      expiresAt: currentTime + NONCE_LIFETIME_MILLISECONDS,
    });
    return null;
  }

  #purgeExpired(currentTime: number): void {
    for (const [key, record] of this.#claims) {
      if (record.expiresAt <= currentTime) this.#claims.delete(key);
    }
  }
}
