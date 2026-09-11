export class CapabilityMissingError extends Error {
  override readonly name = "CapabilityMissingError";

  constructor(message: string) {
    super(message);
    this.name = "CapabilityMissingError";
  }
}

export class ForbiddenClaimError extends Error {
  override readonly name = "ForbiddenClaimError";

  constructor(claimName: string) {
    super(`Claim '${claimName}' is forbidden by the client evidence privacy inventory`);
    this.name = "ForbiddenClaimError";
  }
}

export class BoundsExceededError extends Error {
  override readonly name = "BoundsExceededError";

  constructor(boundary: string, limit: number, actual: number) {
    super(`Bound exceeded for ${boundary}: limit is ${limit}, actual is ${actual}`);
    this.name = "BoundsExceededError";
  }
}

export class InvalidInteractionKindError extends Error {
  override readonly name = "InvalidInteractionKindError";

  constructor(kind: string) {
    super(`Invalid interaction kind '${kind}'; must be one of the approved vocabulary`);
    this.name = "InvalidInteractionKindError";
  }
}

export class InvalidNonceError extends Error {
  override readonly name = "InvalidNonceError";

  constructor(reason: string) {
    super(`Invalid Mode A nonce: ${reason}`);
    this.name = "InvalidNonceError";
  }
}

export class InvalidClaimValueError extends Error {
  override readonly name = "InvalidClaimValueError";

  constructor(message: string) {
    super(message);
    this.name = "InvalidClaimValueError";
  }
}
