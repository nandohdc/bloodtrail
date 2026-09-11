import { APPROVED_INTERACTION_KINDS, BOUNDS, FORBIDDEN_CLAIM_NAMES } from "./constants.js";
import {
  BoundsExceededError,
  ForbiddenClaimError,
  InvalidInteractionKindError,
  InvalidNonceError
} from "./errors.js";
import type { InteractionKind } from "./types.js";

const HEX_REGEX = /^[0-9a-f]+$/;

export function isApprovedInteractionKind(kind: string): kind is InteractionKind {
  return (APPROVED_INTERACTION_KINDS as readonly string[]).includes(kind);
}

export function validateInteractionKind(kind: unknown): asserts kind is InteractionKind {
  if (typeof kind !== "string") {
    throw new InvalidInteractionKindError(String(kind));
  }
  if (!isApprovedInteractionKind(kind)) {
    throw new InvalidInteractionKindError(kind);
  }
}

export function validateNonce(nonce: unknown): asserts nonce is string {
  if (typeof nonce !== "string") {
    throw new InvalidNonceError("nonce must be a string");
  }
  if (nonce.length < BOUNDS.minNonceLength) {
    throw new InvalidNonceError(`nonce length below minimum ${BOUNDS.minNonceLength}`);
  }
  if (nonce.length > BOUNDS.maxNonceLength) {
    throw new InvalidNonceError(`nonce length exceeds maximum ${BOUNDS.maxNonceLength}`);
  }
  if (!HEX_REGEX.test(nonce)) {
    throw new InvalidNonceError("nonce must contain only lowercase hexadecimal characters");
  }
}

export function validateClaimName(name: string): void {
  if (name.length === 0) {
    throw new BoundsExceededError("claim name length", BOUNDS.maxClaimNameLength, 0);
  }
  if (name.length > BOUNDS.maxClaimNameLength) {
    throw new BoundsExceededError("claim name length", BOUNDS.maxClaimNameLength, name.length);
  }
  if (FORBIDDEN_CLAIM_NAMES.has(name)) {
    throw new ForbiddenClaimError(name);
  }
}

export function validateClaimValue(value: unknown): asserts value is string | number | boolean {
  if (typeof value === "string") {
    if (value.length > BOUNDS.maxClaimValueLength) {
      throw new BoundsExceededError("claim value length", BOUNDS.maxClaimValueLength, value.length);
    }
    return;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new BoundsExceededError("claim value is non-finite number", 0, 0);
    }
    return;
  }
  if (typeof value === "boolean") {
    return;
  }
  throw new Error("Claim value must be a string, number, or boolean");
}

export function validateClaim(name: string, value: unknown): asserts value is string | number | boolean {
  validateClaimName(name);
  validateClaimValue(value);
}
