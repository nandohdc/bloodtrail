export class CapabilityMissingError extends Error {
  public override readonly name = "CapabilityMissingError";

  public constructor(message: string) {
    super(message);
  }
}

export class ForbiddenClaimError extends Error {
  public override readonly name = "ForbiddenClaimError";

  public constructor(claimName: string) {
    super(`Claim '${claimName}' is forbidden by the client evidence privacy inventory`);
  }
}

export class BoundsExceededError extends Error {
  public override readonly name = "BoundsExceededError";

  public constructor(boundary: string, limit: number, actual: number) {
    super(`Bound exceeded for ${boundary}: limit is ${limit}, actual is ${actual}`);
  }
}

export class InvalidInteractionKindError extends Error {
  public override readonly name = "InvalidInteractionKindError";

  public constructor(kind: string) {
    super(`Invalid interaction kind '${kind}'; must be one of the approved vocabulary`);
  }
}

export class InvalidNonceError extends Error {
  public override readonly name = "InvalidNonceError";

  public constructor(reason: string) {
    super(`Invalid Mode A nonce: ${reason}`);
  }
}
