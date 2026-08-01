import { randomUUID } from "node:crypto";

export interface AuditClock {
  now(): Date;
}

export interface AuditIdentifierProvider {
  eventId(): string;
  operationId(): string;
  correlationId(): string;
  causationId(): string;
  requestId(): string;
  messageId(): string;
  transactionId(): string;
}

export const systemAuditClock: AuditClock = Object.freeze({ now: () => new Date() });

export const systemAuditIdentifiers: AuditIdentifierProvider = Object.freeze({
  eventId: randomUUID,
  operationId: randomUUID,
  correlationId: randomUUID,
  causationId: randomUUID,
  requestId: randomUUID,
  messageId: randomUUID,
  transactionId: randomUUID,
});
