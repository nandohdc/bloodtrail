// The selected collector storage backend (#115): SQLite, embedded in the
// pinned Node runtime and reached through `node:sqlite`. This is the only
// module in the package permitted to import a Node built-in, and the scope
// gate pins it to exactly that one specifier.
//
// NON-PRODUCTION. Encryption at rest is supplied by the volume holding the
// database file, under a key owner the collector never sees; nothing here
// can verify that the volume is encrypted, and nothing here holds a key.

import { DatabaseSync, type StatementSync } from "node:sqlite";

import { SUPPORTED_CONTRACT_VERSIONS } from "./version.js";
import {
  isStorageScope,
  isStoredRetentionClass,
  type DeleteExpiredResult,
  type GetResult,
  type PutResult,
  type StoragePort,
  type StorageScope,
  type StoredRecord,
} from "./storage.js";

export interface SqliteStorageOptions {
  // A file path on an encrypted volume, or ":memory:" for synthetic tests.
  readonly location: string;
  readonly supportedVersions?: readonly string[];
}

// Primary SQLite result codes for which the engine guarantees the failing
// statement had no effect. Every other failure leaves the outcome unknown and
// is reported as indeterminate rather than guessed at.
const NO_EFFECT_PRIMARY_CODES: ReadonlySet<number> = new Set([
  5, // SQLITE_BUSY: the write lock was never acquired
  6, // SQLITE_LOCKED
  8, // SQLITE_READONLY
  13, // SQLITE_FULL: the statement was rolled back
  19, // SQLITE_CONSTRAINT
]);

// WITHOUT ROWID makes the primary key the table itself, so no secondary
// structure holds a copy of any column: deleting a row leaves no index entry
// behind. Scope is part of the key, so every statement below is bound to one.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS audit_records (
  scope_kind TEXT NOT NULL,
  scope_tenant TEXT NOT NULL,
  event_id TEXT NOT NULL,
  schema_version TEXT NOT NULL,
  retention_class TEXT NOT NULL,
  admitted_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  occurrence_key TEXT NOT NULL,
  body TEXT NOT NULL,
  PRIMARY KEY (scope_kind, scope_tenant, event_id)
) STRICT, WITHOUT ROWID;
`;

interface StoredRow {
  readonly schema_version: string;
  readonly retention_class: string;
  readonly admitted_at: number;
  readonly expires_at: number;
  readonly occurrence_key: string;
  readonly body: string;
}

export class SqliteStorage implements StoragePort {
  readonly #database: DatabaseSync;
  readonly #supportedVersions: ReadonlySet<string>;
  readonly #insert: StatementSync;
  readonly #selectOccurrenceKey: StatementSync;
  readonly #select: StatementSync;
  readonly #deleteExpired: StatementSync;

  constructor(options: SqliteStorageOptions) {
    this.#database = new DatabaseSync(options.location);
    // secure_delete overwrites deleted content in place; the rollback journal
    // and FULL synchronous mode make a returned write a committed one.
    this.#database.exec(
      "PRAGMA secure_delete = ON; PRAGMA journal_mode = DELETE; PRAGMA synchronous = FULL;",
    );
    this.#database.exec(SCHEMA);
    this.#supportedVersions = new Set(options.supportedVersions ?? SUPPORTED_CONTRACT_VERSIONS);
    this.#insert = this.#database.prepare(
      "INSERT INTO audit_records (scope_kind, scope_tenant, event_id, schema_version, retention_class, admitted_at, expires_at, occurrence_key, body) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?) ON CONFLICT (scope_kind, scope_tenant, event_id) DO NOTHING",
    );
    this.#selectOccurrenceKey = this.#database.prepare(
      "SELECT occurrence_key FROM audit_records WHERE scope_kind = ? AND scope_tenant = ? AND event_id = ?",
    );
    this.#select = this.#database.prepare(
      "SELECT schema_version, retention_class, admitted_at, expires_at, occurrence_key, body FROM audit_records WHERE scope_kind = ? AND scope_tenant = ? AND event_id = ?",
    );
    this.#deleteExpired = this.#database.prepare(
      "DELETE FROM audit_records WHERE scope_kind = ? AND scope_tenant = ? AND expires_at <= ?",
    );
  }

  put(scope: StorageScope, record: StoredRecord): PutResult {
    if (!isStorageScope(scope)) return { kind: "failed", reason: "backend" };
    const [kind, tenant] = scopeKey(scope);
    let changes: number | bigint;
    try {
      changes = this.#insert.run(
        kind,
        tenant,
        record.eventId,
        record.schemaVersion,
        record.retentionClass,
        record.admittedAt,
        record.expiresAt,
        record.occurrenceKey,
        record.body,
      ).changes;
    } catch (error) {
      return hadNoEffect(error) ? { kind: "failed", reason: "backend" } : { kind: "indeterminate" };
    }
    if (Number(changes) === 1) return { kind: "written" };
    return this.#resolveExisting(kind, tenant, record);
  }

  get(scope: StorageScope, eventId: string): GetResult {
    if (!isStorageScope(scope) || typeof eventId !== "string") return { kind: "absent" };
    const [kind, tenant] = scopeKey(scope);
    let row: StoredRow | undefined;
    try {
      row = this.#select.get(kind, tenant, eventId) as StoredRow | undefined;
    } catch {
      return { kind: "failed" };
    }
    if (row === undefined) return { kind: "absent" };
    if (!this.#supportedVersions.has(row.schema_version)) {
      return { kind: "unsupported_version", schemaVersion: row.schema_version };
    }
    if (!isStoredRetentionClass(row.retention_class)) return { kind: "failed" };
    return {
      kind: "found",
      record: {
        eventId,
        schemaVersion: row.schema_version,
        retentionClass: row.retention_class,
        admittedAt: row.admitted_at,
        expiresAt: row.expires_at,
        occurrenceKey: row.occurrence_key,
        body: row.body,
      },
    };
  }

  deleteExpired(scope: StorageScope, now: number): DeleteExpiredResult {
    if (!isStorageScope(scope) || !Number.isFinite(now)) return { kind: "deleted", count: 0 };
    const [kind, tenant] = scopeKey(scope);
    try {
      return { kind: "deleted", count: Number(this.#deleteExpired.run(kind, tenant, now).changes) };
    } catch {
      return { kind: "failed" };
    }
  }

  // Lifecycle only; not a port operation.
  close(): void {
    this.#database.close();
  }

  // A row already holds this identity. The same occurrence is a duplicate;
  // different content under the same identity is a conflict, and the stored
  // record is left untouched in both cases.
  #resolveExisting(kind: string, tenant: string, record: StoredRecord): PutResult {
    let existing: { readonly occurrence_key: string } | undefined;
    try {
      existing = this.#selectOccurrenceKey.get(kind, tenant, record.eventId) as
        | { readonly occurrence_key: string }
        | undefined;
    } catch {
      return { kind: "failed", reason: "backend" };
    }
    if (existing === undefined) return { kind: "indeterminate" };
    if (existing.occurrence_key === record.occurrenceKey) return { kind: "duplicate" };
    return { kind: "failed", reason: "conflict" };
  }
}

function scopeKey(scope: StorageScope): readonly [string, string] {
  if (scope.kind === "tenant" || scope.kind === "cross_tenant") return [scope.kind, scope.tenantId];
  return [scope.kind, ""];
}

// A statement on a closed database is rejected before it runs, so it too is
// known to have had no effect.
function hadNoEffect(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const failure = error as { readonly errcode?: unknown; readonly code?: unknown };
  if (failure.code === "ERR_INVALID_STATE") return true;
  return typeof failure.errcode === "number" && NO_EFFECT_PRIMARY_CODES.has(failure.errcode & 0xff);
}
