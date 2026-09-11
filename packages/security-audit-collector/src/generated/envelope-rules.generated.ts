// GENERATED FILE. DO NOT EDIT.
// Sources: contracts/client-evidence-envelope/source/envelope.source.json (bounds and registries)
// and contracts/security-audit/source/contract.source.json (top-level audit record members).
export const INTERACTION_ID_LENGTH = 36 as const;
export const MAX_CLAIM_NAME_LENGTH = 32 as const;
export const MAX_CLAIM_VALUE_LENGTH = 128 as const;
export const MAX_CLAIMS = 8 as const;
export const MAX_CLIENT_TIMESTAMP = 2500000000000 as const;
export const MAX_ENVELOPE_BYTES = 4096 as const;
export const MAX_INTERACTION_KIND_LENGTH = 32 as const;
export const MAX_NONCE_LENGTH = 64 as const;
export const MAX_TRANSFORM_NAME_LENGTH = 64 as const;
export const MAX_TRANSFORMS = 4 as const;
export const MIN_CLIENT_TIMESTAMP = 1700000000000 as const;
export const MIN_NONCE_LENGTH = 32 as const;

export const ENVELOPE_VERSIONS: readonly number[] = [
  1,
];
export const INTERACTION_KINDS: readonly string[] = [
  "navigation",
  "form_submit",
  "button_click",
  "input",
  "dialog_action",
  "tab_switch",
  "refresh",
  "custom",
];
export const PROVENANCE_SOURCES: readonly string[] = [
  "client_reported",
];
export const TRUST_LEVELS: readonly string[] = [
  "client_claim",
];
export const PLATFORMS: readonly string[] = [
  "web_browser",
  "react_native",
  "unattested_client",
];
export const CAPTURE_SCOPES: readonly string[] = [
  "interaction_ephemeral",
];
export const FORBIDDEN_CLAIM_NAMES: readonly string[] = [
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
  "verdict",
];

export const AUDIT_RECORD_MEMBERS: readonly string[] = [
  "actor",
  "authenticated_principal",
  "authentication",
  "authorization",
  "client_evidence",
  "correlation",
  "credential",
  "data",
  "delegation",
  "deployment",
  "destination",
  "environment",
  "event",
  "extensions",
  "initiator",
  "integrity",
  "producer",
  "request",
  "resource",
  "risk",
  "schema",
  "service",
  "session",
  "source",
  "subject",
  "tenant",
];
