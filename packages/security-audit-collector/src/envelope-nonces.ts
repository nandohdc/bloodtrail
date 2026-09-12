// Mode A single-use nonces for the envelope stage (#126). The server issues a nonce for an
// interaction it started, bound to a server-authoritative context reference, and the client
// echoes it in its envelope. A nonce is admitted at most once, only within its lifetime, and
// only under the context it was issued to. Records are instance-local and bounded; this is a
// synthetic, non-production control, not durable storage.
//
// Randomness is injected rather than imported, so the collector keeps its single approved
// platform coupling; a source that returns anything but a fresh lowercase hex string of the
// envelope's nonce bounds fails issuance closed.

import type { Now } from "./deduplication.js";
import { isWellFormedNonce } from "./envelope-validation.js";

// #122 ends an interaction that has not completed within 60 seconds.
export const NONCE_LIFETIME_MILLISECONDS = 60_000;
export const NONCE_MAX_RECORDS = 1_024;
export const NONCE_BINDING_MAX_LENGTH = 256;

export type NonceSource = () => string;
export type NonceIssue =
  | { readonly kind: "issued"; readonly nonce: string }
  | { readonly kind: "refused"; readonly reason: "capacity" | "binding" | "source" };
export type NonceDecision = "consumed" | "replayed" | "expired" | "unknown" | "substituted";

export interface NonceLedgerOptions {
  readonly source: NonceSource;
  readonly now?: Now;
}

interface NonceRecord {
  readonly binding: string;
  readonly expiresAt: number;
  used: boolean;
}

export function isValidBinding(binding: unknown): binding is string {
  return typeof binding === "string" && binding.length > 0 && binding.length <= NONCE_BINDING_MAX_LENGTH;
}

export class InteractionNonceLedger {
  readonly #records = new Map<string, NonceRecord>();
  readonly #source: NonceSource;
  readonly #now: Now;

  constructor(options: NonceLedgerOptions) {
    this.#source = options.source;
    this.#now = options.now ?? Date.now;
  }

  /** Issues one nonce bound to a server-authoritative context reference. */
  issue(binding: string): NonceIssue {
    if (!isValidBinding(binding)) return { kind: "refused", reason: "binding" };
    const currentTime = this.#now();
    this.#purgeExpired(currentTime);
    if (this.#records.size >= NONCE_MAX_RECORDS) return { kind: "refused", reason: "capacity" };
    const nonce = this.#draw();
    if (nonce === null) return { kind: "refused", reason: "source" };
    this.#records.set(nonce, { binding, expiresAt: currentTime + NONCE_LIFETIME_MILLISECONDS, used: false });
    return { kind: "issued", nonce };
  }

  /**
   * Spends a nonce presented under a context. A nonce presented under a context other than
   * its own is burned, because it has been disclosed outside the interaction it bound.
   */
  consume(nonce: string, binding: string): NonceDecision {
    const record = this.#records.get(nonce);
    if (record === undefined) return "unknown";
    if (record.expiresAt <= this.#now()) {
      this.#records.delete(nonce);
      return "expired";
    }
    if (record.used) return "replayed";
    record.used = true;
    return record.binding === binding ? "consumed" : "substituted";
  }

  #draw(): string | null {
    let candidate: unknown;
    try {
      candidate = this.#source();
    } catch {
      return null;
    }
    if (!isWellFormedNonce(candidate)) return null;
    return this.#records.has(candidate) ? null : candidate;
  }

  #purgeExpired(currentTime: number): void {
    for (const [nonce, record] of this.#records) {
      if (record.expiresAt <= currentTime) this.#records.delete(nonce);
    }
  }
}
