import type { AuditClock } from "@bloodtrail/security-audit-sdk-core";

export const nodeClock: AuditClock = Object.freeze({
  now: (): Date => new Date(),
});
