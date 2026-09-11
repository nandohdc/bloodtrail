import { BOUNDS } from "./constants.js";
import { BoundsExceededError } from "./errors.js";
import type {
  ClientClaim,
  ClientEvidenceEnvelope,
  ClientPlatform,
  EnvelopeOptions,
  InteractionKind,
  InteractionOptions
} from "./types.js";
import { generateInteractionId } from "./uuid.js";
import { validateClaim, validateInteractionKind, validateNonce } from "./validation.js";

function getUtf8ByteLength(text: string): number {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text).length;
  }
  return text.length;
}

export type ClientInteractionOptions = InteractionOptions & {
  readonly nonce?: string | undefined;
};

export class ClientInteraction {
  readonly #interactionId: string;
  readonly #interactionKind: InteractionKind;
  readonly #clientTimestamp: number;
  readonly #platform: ClientPlatform;
  readonly #nonce?: string | undefined;
  readonly #claims: Map<string, ClientClaim> = new Map();

  public constructor(
    kind: InteractionKind,
    options?: ClientInteractionOptions | undefined,
    cryptoObj?: Crypto
  ) {
    validateInteractionKind(kind);
    this.#interactionKind = kind;
    this.#interactionId = generateInteractionId(cryptoObj);
    this.#platform = options?.platform ?? "web_browser";
    this.#clientTimestamp = options?.timestamp ?? Date.now();

    if (options?.nonce !== undefined) {
      validateNonce(options.nonce);
      this.#nonce = options.nonce;
    }

    if (options?.claims) {
      this.#initializeClaims(options.claims);
    }
  }

  #initializeClaims(initialClaims: Readonly<Record<string, string | number | boolean>>): void {
    const entries = Object.entries(initialClaims);
    if (entries.length > BOUNDS.maxClaims) {
      throw new BoundsExceededError("claims collection", BOUNDS.maxClaims, entries.length);
    }
    for (const [name, value] of entries) {
      this.addClaim(name, value);
    }
  }

  public get id(): string {
    return this.#interactionId;
  }

  public get interactionId(): string {
    return this.#interactionId;
  }

  public get interactionKind(): InteractionKind {
    return this.#interactionKind;
  }

  public get clientTimestamp(): number {
    return this.#clientTimestamp;
  }

  public get platform(): ClientPlatform {
    return this.#platform;
  }

  public get nonce(): string | undefined {
    return this.#nonce;
  }

  public get claims(): readonly ClientClaim[] {
    return Array.from(this.#claims.values());
  }

  public addClaim(name: string, value: string | number | boolean): this {
    if (!this.#claims.has(name)) {
      if (this.#claims.size >= BOUNDS.maxClaims) {
        throw new BoundsExceededError("claims collection", BOUNDS.maxClaims, this.#claims.size + 1);
      }
    }
    validateClaim(name, value);
    this.#claims.set(name, {
      name,
      trust_level: "client_claim",
      value
    });
    return this;
  }

  public toEnvelope(): ClientEvidenceEnvelope {
    const envelope: ClientEvidenceEnvelope = {
      envelope_version: 1,
      interaction_id: this.#interactionId,
      interaction_kind: this.#interactionKind,
      client_timestamp: this.#clientTimestamp,
      provenance: {
        source: "client_reported",
        trust_level: "client_claim",
        platform: this.#platform,
        capture_scope: "interaction_ephemeral"
      },
      ...(this.#nonce !== undefined ? { nonce: this.#nonce } : {}),
      ...(this.#claims.size > 0 ? { claims: Array.from(this.#claims.values()) } : {})
    };
    return envelope;
  }

  public serialize(): string {
    const json = JSON.stringify(this.toEnvelope());
    const byteLength = getUtf8ByteLength(json);
    if (byteLength > BOUNDS.maxEnvelopeBytes) {
      throw new BoundsExceededError("envelope bytes", BOUNDS.maxEnvelopeBytes, byteLength);
    }
    return json;
  }
}

export function startInteraction(
  kind: InteractionKind,
  options?: ClientInteractionOptions | undefined,
  cryptoObj?: Crypto
): ClientInteraction {
  return new ClientInteraction(kind, options, cryptoObj);
}

export function buildClientEvidenceEnvelope(
  options: EnvelopeOptions,
  cryptoObj?: Crypto
): ClientEvidenceEnvelope {
  const interaction = new ClientInteraction(
    options.interactionKind,
    {
      platform: options.platform,
      claims: options.claims,
      nonce: options.nonce,
      timestamp: options.timestamp
    },
    cryptoObj
  );
  return interaction.toEnvelope();
}
