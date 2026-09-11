export {
  BoundsExceededError,
  CapabilityMissingError,
  ForbiddenClaimError,
  InvalidClaimValueError,
  InvalidInteractionKindError,
  InvalidNonceError
} from "./errors.js";

export {
  ClientInteraction,
  buildClientEvidenceEnvelope,
  startInteraction
} from "./interaction.js";

export type {
  ClientClaim,
  ClientEvidenceEnvelope,
  ClientEvidenceProvenance,
  ClientPlatform,
  EnvelopeOptions,
  InteractionKind,
  InteractionOptions,
  TransformRecord
} from "./types.js";
