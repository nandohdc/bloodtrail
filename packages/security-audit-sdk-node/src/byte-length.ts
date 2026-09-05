import { Buffer } from "node:buffer";
import type { AuditByteLengthProvider } from "@bloodtrail/security-audit-sdk-core";

export const nodeByteLength: AuditByteLengthProvider = Object.freeze({
  byteLength: (value: string): number => Buffer.byteLength(value, "utf8"),
});
