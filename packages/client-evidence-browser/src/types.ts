export type InteractionKind =
  | "navigation"
  | "form_submit"
  | "button_click"
  | "input"
  | "dialog_action"
  | "tab_switch"
  | "refresh"
  | "custom";

export type ClientPlatform =
  | "web_browser"
  | "react_native"
  | "unattested_client";

export interface ClientEvidenceProvenance {
  readonly source: "client_reported";
  readonly trust_level: "client_claim";
  readonly platform: ClientPlatform;
  readonly capture_scope: "interaction_ephemeral";
}

export interface ClientClaim {
  readonly name: string;
  readonly trust_level: "client_claim";
  readonly value: string | number | boolean;
}

export interface TransformRecord {
  readonly transform: string;
  readonly timestamp: number;
}

export interface ClientEvidenceEnvelope {
  readonly envelope_version: 1;
  readonly interaction_id: string;
  readonly interaction_kind: InteractionKind;
  readonly client_timestamp: number;
  readonly provenance: ClientEvidenceProvenance;
  readonly nonce?: string | undefined;
  readonly claims?: readonly ClientClaim[] | undefined;
  readonly transform_history?: readonly TransformRecord[] | undefined;
}

export interface InteractionOptions {
  readonly platform?: ClientPlatform | undefined;
  readonly claims?: Readonly<Record<string, string | number | boolean>> | undefined;
  readonly timestamp?: number | undefined;
}

export interface EnvelopeOptions extends InteractionOptions {
  readonly interactionKind: InteractionKind;
  readonly nonce?: string | undefined;
}
