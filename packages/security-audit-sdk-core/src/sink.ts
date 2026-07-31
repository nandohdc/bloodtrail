import type { SecurityAuditEvent } from "./generated/contract.generated.js";

export type AuditDeliveryResult =
  | { readonly status: "accepted" }
  | { readonly status: "rejected"; readonly code: string }
  | { readonly status: "unknown"; readonly code: string };

export interface AuditEventSink {
  emit(event: Readonly<SecurityAuditEvent>): Promise<AuditDeliveryResult>;
  flush?(): Promise<void>;
  shutdown?(): Promise<void>;
}
