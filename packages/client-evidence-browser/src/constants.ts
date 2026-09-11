import type { InteractionKind } from "./types.js";

export const APPROVED_INTERACTION_KINDS: readonly InteractionKind[] = [
  "navigation",
  "form_submit",
  "button_click",
  "input",
  "dialog_action",
  "tab_switch",
  "refresh",
  "custom"
];

export const FORBIDDEN_CLAIM_NAMES: ReadonlySet<string> = new Set([
  "account_id",
  "auth_token",
  "cookie",
  "credential",
  "decision",
  "device_id",
  "dom_content",
  "fingerprint",
  "form_value",
  "geolocation",
  "hardware",
  "ip",
  "locale",
  "location",
  "path",
  "query",
  "risk_score",
  "screen",
  "session_id",
  "timezone",
  "url",
  "user_agent",
  "user_id",
  "verdict"
]);

export const BOUNDS = {
  maxEnvelopeBytes: 4096,
  interactionIdLength: 36,
  maxInteractionKindLength: 32,
  minNonceLength: 32,
  maxNonceLength: 64,
  maxClaims: 8,
  maxClaimNameLength: 32,
  maxClaimValueLength: 128,
  maxTransforms: 4,
  maxTransformNameLength: 64,
  minClientTimestamp: 1700000000000,
  maxClientTimestamp: 2500000000000
} as const;
