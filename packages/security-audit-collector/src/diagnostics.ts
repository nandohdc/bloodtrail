// Bounded, stable rejection diagnostics for the collector ingress.
// Every rejection carries exactly { code, category, path }; no caller data,
// payload bytes, secrets, or unbounded strings are ever part of a diagnostic
// (F6 of the #107 plan). Codes are a closed vocabulary.

export const DIAGNOSTIC_CODES = Object.freeze({
  AUTH_MISSING: "COLLECTOR_AUTH_MISSING",
  AUTH_MALFORMED: "COLLECTOR_AUTH_MALFORMED",
  AUTH_REJECTED: "COLLECTOR_AUTH_REJECTED",
  SIZE_EXCEEDED: "COLLECTOR_SIZE_EXCEEDED",
  PARSE_INVALID: "COLLECTOR_PARSE_INVALID",
  SCHEMA_INVALID: "COLLECTOR_SCHEMA_INVALID",
  VERSION_UNSUPPORTED: "COLLECTOR_VERSION_UNSUPPORTED",
  DUPLICATE_CONFLICT: "COLLECTOR_DUPLICATE_CONFLICT",
  DEDUPLICATION_CAPACITY: "COLLECTOR_DEDUPLICATION_CAPACITY",
  RETENTION_CLASS_DECLINED: "COLLECTOR_RETENTION_CLASS_DECLINED",
  STORAGE_SCOPE_UNRESOLVED: "COLLECTOR_STORAGE_SCOPE_UNRESOLVED",
  STORAGE_CONFLICT: "COLLECTOR_STORAGE_CONFLICT",
  STORAGE_WRITE_FAILED: "COLLECTOR_STORAGE_WRITE_FAILED",
  STORAGE_WRITE_INDETERMINATE: "COLLECTOR_STORAGE_WRITE_INDETERMINATE",
});

export type DiagnosticCategory =
  | "authentication"
  | "size"
  | "parse"
  | "validation"
  | "version"
  | "deduplication"
  | "storage";

export interface IngressDiagnostic {
  readonly code: string;
  readonly category: DiagnosticCategory;
  readonly path: string;
}
