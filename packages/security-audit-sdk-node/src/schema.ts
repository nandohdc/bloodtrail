import { cjsSchemaRuntime, type AuditResult, type AuditSchemaRuntime } from "@bloodtrail/security-audit-sdk-core";

export const nodeSchemaRuntime: AuditSchemaRuntime = Object.freeze({
  validate(value: unknown): AuditResult<void> {
    return cjsSchemaRuntime.validate(value);
  },
});
