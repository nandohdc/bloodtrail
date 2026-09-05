import type {
  AuditByteLengthProvider,
  AuditClock,
  AuditIdentifierProvider,
  AuditSchemaRuntime,
  AuditTimerProvider,
  ContextProvider,
  PlatformProvider,
  SecurityAuditSdk,
  SecurityAuditSdkConfiguration,
} from "@bloodtrail/security-audit-sdk-core";
import { createSecurityAuditSdk } from "@bloodtrail/security-audit-sdk-core";
import { nodeClock } from "./clock.js";
import { nodeIdentifiers } from "./identifiers.js";
import { nodeByteLength } from "./byte-length.js";
import { nodeTimers } from "./timers.js";
import { nodeSchemaRuntime } from "./schema.js";
import { nodeContextProvider } from "./context.js";

export interface NodePlatformProvider extends PlatformProvider {
  readonly clock: AuditClock;
  readonly identifiers: AuditIdentifierProvider;
  readonly byteLength: AuditByteLengthProvider;
  readonly timers: AuditTimerProvider;
  readonly schemaRuntime: AuditSchemaRuntime;
  readonly contextProvider: ContextProvider;
}

export const nodePlatformProvider: NodePlatformProvider = Object.freeze({
  clock: nodeClock,
  identifiers: nodeIdentifiers,
  byteLength: nodeByteLength,
  timers: nodeTimers,
  schemaRuntime: nodeSchemaRuntime,
  contextProvider: nodeContextProvider,
});

export interface NodeSecurityAuditSdkConfiguration
  extends Omit<
    SecurityAuditSdkConfiguration,
    "clock" | "identifiers" | "byteLength" | "timers" | "schemaRuntime" | "contextProvider"
  > {
  readonly clock?: AuditClock;
  readonly identifiers?: AuditIdentifierProvider;
  readonly byteLength?: AuditByteLengthProvider;
  readonly timers?: AuditTimerProvider;
  readonly schemaRuntime?: AuditSchemaRuntime;
  readonly contextProvider?: ContextProvider;
}

export function createNodeSecurityAuditSdk(config: NodeSecurityAuditSdkConfiguration): SecurityAuditSdk {
  return createSecurityAuditSdk({
    ...nodePlatformProvider,
    ...config,
  });
}
