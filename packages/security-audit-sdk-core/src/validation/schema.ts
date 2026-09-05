import validateSchema from "../generated/schema-validator.generated.cjs";
import type { SecurityAuditEvent } from "../generated/contract.generated.js";
import type { AuditResult } from "../errors.js";
import { failure } from "../errors.js";
import type { AuditSchemaRuntime } from "../providers.js";

export const cjsSchemaRuntime: AuditSchemaRuntime = Object.freeze({
  validate(value: unknown): AuditResult<void> {
    if (validateSchema(value)) return { ok: true, value: undefined };
    const first = validateSchema.errors?.[0];
    return failure(
      mapSchemaError(first),
      categoryForSchemaCode(mapSchemaError(first)),
      first?.instancePath || pathFromMissingProperty(first) || "/",
    );
  },
});

let activeSchemaRuntime: AuditSchemaRuntime = cjsSchemaRuntime;

export function setSchemaRuntime(runtime: AuditSchemaRuntime): AuditSchemaRuntime {
  const previous = activeSchemaRuntime;
  activeSchemaRuntime = runtime;
  return previous;
}

export function getSchemaRuntime(): AuditSchemaRuntime {
  return activeSchemaRuntime;
}

export function validateSchemaStructure(value: unknown, schemaRuntime?: AuditSchemaRuntime): AuditResult<SecurityAuditEvent> {
  const runtime = schemaRuntime ?? activeSchemaRuntime;
  const result = runtime.validate(value);
  if (!result.ok) return result;
  return { ok: true, value: value as SecurityAuditEvent };
}

interface StandaloneValidationError {
  readonly instancePath: string;
  readonly keyword: string;
  readonly params: Readonly<Record<string, unknown>>;
}

function mapSchemaError(error: StandaloneValidationError | undefined): string {
  if (!error) return "SDK_SCHEMA_VALIDATION_FAILED";
  const path = error.instancePath || pathFromMissingProperty(error) || "/";
  if (path === "/schema/version" || path === "/schema/name") return "UNSUPPORTED_SCHEMA_VERSION";
  if (path === "/event/name" || path === "/event/category" || path === "/event/action" || path === "/event/delivery_class") return "UNKNOWN_CATALOG_VALUE";
  if (path.startsWith("/extensions")) return "UNKNOWN_EXTENSION";
  if (error.keyword === "maxLength" || error.keyword === "maximum" || error.keyword === "maxItems") return "FIELD_LIMIT_EXCEEDED";
  if (error.keyword === "required") {
    const missing = typeof error.params.missingProperty === "string" ? error.params.missingProperty : "";
    if (missing === "actor" || (error.instancePath === "/actor" && missing === "type")) return "MISSING_REQUIRED_ACTOR";
    if (missing === "tenant") return "MISSING_TENANT_CONTEXT";
    if (isProhibitedProperty(missing)) return "PROHIBITED_DATA";
    return "SDK_MISSING_EVENT_FIELD";
  }
  if (error.keyword === "additionalProperties") {
    const extra = typeof error.params.additionalProperty === "string" ? error.params.additionalProperty : "";
    if (path === "/extensions" || path.startsWith("/extensions/")) return "UNKNOWN_EXTENSION";
    if (isProhibitedProperty(extra)) return "PROHIBITED_DATA";
  }
  return "SDK_SCHEMA_VALIDATION_FAILED";
}

function categoryForSchemaCode(code: string): "validation" | "privacy" {
  return code === "PROHIBITED_DATA" ? "privacy" : "validation";
}

function pathFromMissingProperty(error: StandaloneValidationError | undefined): string | undefined {
  if (!error || error.keyword !== "required" || typeof error.params.missingProperty !== "string") return undefined;
  return `${error.instancePath}/${error.params.missingProperty}`.replace(/\/+/g, "/");
}

function isProhibitedProperty(key: string): boolean {
  const normalized = key.toLowerCase();
  return normalized.includes("token")
    || normalized.includes("secret")
    || normalized.includes("cookie")
    || normalized.includes("private_key")
    || normalized.includes("raw_body")
    || normalized.includes("full_request")
    || normalized.includes("request_body")
    || normalized.includes("response_body");
}
