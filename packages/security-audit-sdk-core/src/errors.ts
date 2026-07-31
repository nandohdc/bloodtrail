export const SDK_ERROR_CODES = [
  "SDK_INVALID_CONFIGURATION",
  "SDK_NOT_READY",
  "SDK_SHUTTING_DOWN",
  "SDK_SHUT_DOWN",
  "SDK_SCHEMA_VALIDATION_FAILED",
  "SDK_SEMANTIC_VALIDATION_FAILED",
  "SDK_SINK_REJECTED",
  "SDK_SINK_FAILURE",
  "SDK_SHUTDOWN_TIMEOUT",
] as const;

export type SdkErrorCode = (typeof SDK_ERROR_CODES)[number];
export type AuditErrorCategory = "configuration" | "validation" | "authority" | "privacy" | "lifecycle" | "sink";

export interface SafeAuditError {
  readonly code: string;
  readonly category: AuditErrorCategory;
  readonly path?: string;
}

export type AuditResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: SafeAuditError };

export class SecurityAuditSdkError extends Error {
  readonly code: SdkErrorCode;
  readonly category: AuditErrorCategory;
  readonly path: string | undefined;

  constructor(code: SdkErrorCode, category: AuditErrorCategory, path?: string) {
    super(code);
    this.name = "SecurityAuditSdkError";
    this.code = code;
    this.category = category;
    this.path = path;
  }

  toJSON(): SafeAuditError {
    return this.path === undefined
      ? { code: this.code, category: this.category }
      : { code: this.code, category: this.category, path: this.path };
  }
}

export function failure(code: string, category: AuditErrorCategory, path?: string): AuditResult<never> {
  return { ok: false, error: path === undefined ? { code, category } : { code, category, path: boundPath(path) } };
}

function boundPath(path: string): string {
  const normalized = path.replace(/[^A-Za-z0-9_./-]/g, "_");
  return normalized.slice(0, 160);
}
