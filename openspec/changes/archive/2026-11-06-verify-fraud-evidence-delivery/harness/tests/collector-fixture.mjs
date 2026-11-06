// Test support: fixture collector for copies tests (#839, Q167).
import { createRequire } from "node:module";
import { storageScopeOf } from "../lib/ingress.mjs";

const require = createRequire(import.meta.url);
const validateGeneratedSchema = require("../../../../../packages/security-audit-sdk-core/src/generated/schema-validator.generated.cjs");

export const CODES = Object.freeze(Object.fromEntries([
  "AUTH_MISSING", "AUTH_MALFORMED", "AUTH_REJECTED", "SIZE_EXCEEDED", "PARSE_INVALID", "SCHEMA_INVALID", "VERSION_UNSUPPORTED",
  "DUPLICATE_CONFLICT", "DEDUPLICATION_CAPACITY", "RETENTION_CLASS_DECLINED", "STORAGE_SCOPE_UNRESOLVED", "STORAGE_CONFLICT",
  "STORAGE_WRITE_FAILED", "STORAGE_WRITE_INDETERMINATE",
].map((code) => [code, `COLLECTOR_${code}`])));

export const rejected = (code, category = "validation", path = "/") => ({
  kind: "rejected",
  diagnostic: { code, category, path },
});

function findCrossScopeConflict(store, eventId) {
  for (const existing of store.values()) {
    if (existing.eventId === eventId) return true;
  }
  return false;
}

export class FakeSqliteStorage {
  constructor({ location, store = new Map() }) {
    this.location = location;
    this.closed = false;
    this.store = store;
  }
  put(scope, record) {
    if (this.closed) throw new Error("storage closed");
    const tenantPart = scope.tenantId ?? "";
    const key = `${scope.kind}:${tenantPart}:${record.eventId}`;
    if (this.store.has(key)) {
      const existing = this.store.get(key);
      return existing.body === record.body ? { kind: "duplicate" } : { kind: "conflict" };
    }
    if (findCrossScopeConflict(this.store, record.eventId)) {
      return { kind: "conflict" };
    }
    this.store.set(key, record);
    return { kind: "written" };
  }
  get(scope, id) {
    const key = `${scope.kind}:${scope.tenantId ?? ""}:${id}`;
    return this.store.has(key) ? { kind: "found", record: { body: this.store.get(key).body } } : { kind: "not_found" };
  }
  close() {
    this.closed = true;
  }
}

function authenticateIngress(authenticator, credentials) {
  const auth = authenticator.verify(credentials);
  if (auth.kind !== "verified") {
    return { ok: false, error: rejected(CODES.AUTH_REJECTED) };
  }
  return { ok: true, auth };
}

function parseIngressBody(body) {
  try {
    return { ok: true, parsed: JSON.parse(body) };
  } catch {
    return { ok: false, error: rejected(CODES.PARSE_INVALID, "parse", "/") };
  }
}

function validateIngressSchema(parsed) {
  if (validateGeneratedSchema(parsed)) {
    return { ok: true };
  }
  const first = validateGeneratedSchema.errors?.[0];
  const schemaPath = first ? first.schemaPath : null;
  const path = typeof schemaPath === "string" ? schemaPath.slice(0, 128) : "/";
  return { ok: false, error: rejected(CODES.SCHEMA_INVALID, "validation", path) };
}

function persistStorageLess(ingress, eventId, identity) {
  if (!ingress.ledger) ingress.ledger = new Set();
  if (ingress.ledger.has(eventId)) {
    return { kind: "duplicate", eventId, senderIdentity: identity, acknowledgment: "admitted" };
  }
  if (ingress.ledger.size >= 32) {
    return rejected(CODES.DEDUPLICATION_CAPACITY);
  }
  ingress.ledger.add(eventId);
  return { kind: "admitted", eventId, senderIdentity: identity };
}

function persistWithStorage(storage, parsed, body, identity) {
  const eventId = parsed.event.id;
  const scope = storageScopeOf(parsed.tenant);
  const written = storage.port.put(scope, { eventId, body });
  if (written.kind === "written") {
    return { kind: "persisted", eventId, senderIdentity: identity };
  }
  if (written.kind === "duplicate") {
    return { kind: "duplicate", eventId, senderIdentity: identity, acknowledgment: "persisted" };
  }
  if (written.kind === "conflict") {
    return rejected(CODES.STORAGE_CONFLICT);
  }
  return rejected(CODES.STORAGE_WRITE_FAILED);
}

export class FakeCollectorIngress {
  constructor({ authenticator, storage }) {
    this.authenticator = authenticator;
    this.storage = storage;
  }
  submit({ credentials, body }) {
    const authResult = authenticateIngress(this.authenticator, credentials);
    if (!authResult.ok) return authResult.error;

    const parseResult = parseIngressBody(body);
    if (!parseResult.ok) return parseResult.error;

    const schemaResult = validateIngressSchema(parseResult.parsed);
    if (!schemaResult.ok) return schemaResult.error;

    const parsed = parseResult.parsed;
    const identity = authResult.auth.identity;
    if (!this.storage) {
      return persistStorageLess(this, parsed.event.id, identity);
    }
    return persistWithStorage(this.storage, parsed, body, identity);
  }
}

export class FakeAuthenticator {
  constructor(tokens) {
    this.tokens = new Set(tokens);
  }
  verify(credentials) {
    return this.tokens.has(credentials?.credential)
      ? { kind: "verified", identity: "syn-fixture" }
      : { kind: "rejected", reason: "invalid" };
  }
}

export function makeRestartCollector(shared = new Map()) {
  return {
    DIAGNOSTIC_CODES: CODES,
    SqliteStorage: class extends FakeSqliteStorage {
      constructor(opts) {
        const loc = opts.location ?? ":memory:";
        if (!shared.has(loc)) shared.set(loc, new Map());
        super({ ...opts, store: shared.get(loc) });
      }
    },
    CollectorIngress: FakeCollectorIngress,
    SyntheticFixtureAuthenticator: FakeAuthenticator,
  };
}
