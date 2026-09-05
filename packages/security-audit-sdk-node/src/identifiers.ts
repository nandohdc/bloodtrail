import { randomUUID } from "node:crypto";
import type { AuditIdentifierProvider } from "@bloodtrail/security-audit-sdk-core";

export const nodeIdentifiers: AuditIdentifierProvider = Object.freeze({
  eventId: (): string => randomUUID(),
  operationId: (): string => randomUUID(),
  correlationId: (): string => randomUUID(),
  causationId: (): string => randomUUID(),
  requestId: (): string => randomUUID(),
  messageId: (): string => randomUUID(),
  transactionId: (): string => randomUUID(),
});
