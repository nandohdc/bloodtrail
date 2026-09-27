// The collector storage port (#115), implementing the ratified
// collector-storage-semantics capability (#114).
//
// Exactly three operations, each returning a member of a closed union and
// never throwing across the port. `put` is idempotent on (scope, event
// identity). No operation accepts more than one scope, so cross-tenant
// retrieval has no expressible form. No operation accepts, returns, or logs
// key material: encryption at rest is the volume's, under a key owner the
// collector never sees.

export type StorageScope =
  | { readonly kind: "tenant"; readonly tenantId: string }
  | { readonly kind: "cross_tenant"; readonly tenantId: string }
  | { readonly kind: "platform" }
  | { readonly kind: "tenantless" };

export type StoredRetentionClass = keyof typeof RETENTION_MILLISECONDS;

export interface StoredRecord {
  readonly eventId: string;
  readonly schemaVersion: string;
  readonly retentionClass: StoredRetentionClass;
  readonly admittedAt: number;
  readonly expiresAt: number;
  // The canonical deduplication key: the whole submission, key-sorted. An
  // identical redelivery shares it, and any other content under the same
  // identity is a conflict. It is compared exactly and never hashed.
  readonly occurrenceKey: string;
  readonly body: string;
}

export type PutResult =
  | { readonly kind: "written" }
  | { readonly kind: "duplicate" }
  | { readonly kind: "failed"; readonly reason: "backend" | "conflict" }
  | { readonly kind: "indeterminate" };

export type GetResult =
  | { readonly kind: "found"; readonly record: StoredRecord }
  | { readonly kind: "absent" }
  | { readonly kind: "unsupported_version"; readonly schemaVersion: string }
  | { readonly kind: "failed" };

export type DeleteExpiredResult =
  | { readonly kind: "deleted"; readonly count: number }
  | { readonly kind: "failed" };

export interface StoragePort {
  put(scope: StorageScope, record: StoredRecord): PutResult;
  get(scope: StorageScope, eventId: string): GetResult;
  deleteExpired(scope: StorageScope, now: number): DeleteExpiredResult;
}

// The three roles a deployment fills before storage is enabled. Naming them
// is an owner act; the collector only refuses to enable storage without them.
export interface StorageOwners {
  readonly dataOwner: string;
  readonly retentionAuthority: string;
  readonly keyOwner: string;
}

export interface StorageConfiguration {
  readonly port: StoragePort;
  readonly owners: StorageOwners;
}

const DAY_MILLISECONDS = 86_400_000;

// Retention derives from the record's own `data.retention_class` and from
// nothing a deployment supplies. These are non-production candidate durations
// fixed in code, so two deployments handed one record retain it identically;
// changing one is a governed decision, not a configuration. They are not a
// legal retention policy. `policy_governed` is absent on purpose: its
// retention is set by a policy outside the record, which the collector cannot
// evaluate, so the collector declines to store it rather than guess.
export const RETENTION_MILLISECONDS = Object.freeze({
  operational_short: 30 * DAY_MILLISECONDS,
  security_standard: 365 * DAY_MILLISECONDS,
  security_elevated: 7 * 365 * DAY_MILLISECONDS,
});

const OWNER_ROLES = ["dataOwner", "retentionAuthority", "keyOwner"] as const;
const OWNER_NAME_MAX = 128;

export class StorageConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageConfigurationError";
  }
}

// Fails construction when any role is unfilled, blank, or unbounded, so an
// unnamed role blocks storage rather than defaulting to the operator.
export function assertStorageOwners(owners: unknown): asserts owners is StorageOwners {
  if (typeof owners !== "object" || owners === null) {
    throw new StorageConfigurationError("storage requires named data, retention, and key owners");
  }
  const record = owners as Record<string, unknown>;
  for (const role of OWNER_ROLES) {
    const name = record[role];
    if (typeof name !== "string" || name.trim().length === 0 || name.length > OWNER_NAME_MAX) {
      throw new StorageConfigurationError(`storage owner role ${role} must be named`);
    }
  }
}

export function isStorageScope(value: unknown): value is StorageScope {
  if (typeof value !== "object" || value === null) return false;
  const scope = value as { readonly kind?: unknown; readonly tenantId?: unknown };
  if (scope.kind === "platform" || scope.kind === "tenantless") return true;
  if (scope.kind !== "tenant" && scope.kind !== "cross_tenant") return false;
  return typeof scope.tenantId === "string" && scope.tenantId.length > 0;
}

export function isStoredRetentionClass(value: unknown): value is StoredRetentionClass {
  return typeof value === "string" && Object.hasOwn(RETENTION_MILLISECONDS, value);
}
