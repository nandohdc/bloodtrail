// @bloodtrail/security-audit-collector
//
// Bounded, NON-PRODUCTION collector ingress for Bloodtrail security audit
// events. Authorized by the recorded owner decision #343 (2026-09-06) with
// strict scope: synthetic/isolated development and CI environments only,
// synthetic non-sensitive fixtures only, non-production authentication only,
// and no production deployment, collection, or real-user processing.
// Optional persistence (#115) selects SQLite through `node:sqlite` under the
// owner's 2026-09-10 instruction; it is equally non-production.
//
// Authentication identifies a sender; it does not prove evidence truth.

export { CollectorIngress } from "./ingress.js";
export type {
  Admission,
  DuplicateAdmission,
  IngressOptions,
  IngressRejection,
  IngressResult,
  ParseFunction,
  PersistedAdmission,
  Submission,
  ValidateFunction,
} from "./ingress.js";
export type { Acknowledgment } from "./deduplication.js";
export { RETENTION_MILLISECONDS, StorageConfigurationError } from "./storage.js";
export type {
  DeleteExpiredResult,
  GetResult,
  PutResult,
  StorageConfiguration,
  StorageOwners,
  StoragePort,
  StorageScope,
  StoredRecord,
  StoredRetentionClass,
} from "./storage.js";
export { SqliteStorage } from "./sqlite-storage.js";
export type { SqliteStorageOptions } from "./sqlite-storage.js";
export { SyntheticFixtureAuthenticator } from "./auth.js";
export type {
  Authenticator,
  AuthenticationResult,
  SyntheticCredential,
} from "./auth.js";
export { DIAGNOSTIC_CODES } from "./diagnostics.js";
export type { DiagnosticCategory, IngressDiagnostic } from "./diagnostics.js";
export type { IngressMetrics, MetricKey } from "./metrics.js";
export { validateStructural } from "./schema.js";
export type { StructuralFailure, StructuralResult } from "./schema.js";
export { SUPPORTED_CONTRACT_VERSIONS, isSupportedVersion, schemaVersionOf } from "./version.js";
export {
  ARRAY_MAX_ITEMS,
  CLOCK_SKEW_MAX_SECONDS,
  DEFAULT_STRING_MAX,
  DISPLAY_STRING_MAX,
  EVENT_MAX_BYTES,
  EXTENSION_MAX_NAMESPACES,
  MESSAGE_STRING_MAX,
  OBJECT_MAX_DEPTH,
  RETRY_ATTEMPT_MAX,
} from "./bounds.js";
