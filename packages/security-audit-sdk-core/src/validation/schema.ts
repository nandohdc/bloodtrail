import validateSchema from "../generated/schema-validator.generated.cjs";
import type { SecurityAuditEvent } from "../generated/contract.generated.js";
import type { AuditResult } from "../errors.js";
import { failure } from "../errors.js";
import type { AuditSchemaRuntime } from "../providers.js";

export const cjsSchemaRuntime: AuditSchemaRuntime = Object.freeze({
  validate(value: unknown): AuditResult<void> {
    if (validateSchema(value)) return { ok: true, value: undefined };
    const first = validateSchema.errors?.[0];
    const code = mapSchemaError(first);
    return failure(
      code,
      categoryForSchemaCode(code),
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

const SCHEMA_VERSION_PATHS = new Set(["/schema/version", "/schema/name"]);
const CATALOG_PATHS = new Set(["/event/name", "/event/category", "/event/action", "/event/delivery_class"]);
const FIELD_LIMIT_KEYWORDS = new Set(["maxLength", "maximum", "maxItems"]);

function mapRequiredError(instancePath: string, missing: string): string {
  if (missing === "actor" || (instancePath === "/actor" && missing === "type")) return "MISSING_REQUIRED_ACTOR";
  if (missing === "tenant") return "MISSING_TENANT_CONTEXT";
  if (isProhibitedProperty(missing)) return "PROHIBITED_DATA";
  return "SDK_MISSING_EVENT_FIELD";
}

function mapAdditionalPropertiesError(path: string, extra: string): string {
  if (path === "/extensions" || path.startsWith("/extensions/")) return "UNKNOWN_EXTENSION";
  if (isProhibitedProperty(extra)) return "PROHIBITED_DATA";
  return "SDK_SCHEMA_VALIDATION_FAILED";
}

function matchPathCode(path: string): string | undefined {
  if (SCHEMA_VERSION_PATHS.has(path)) return "UNSUPPORTED_SCHEMA_VERSION";
  if (CATALOG_PATHS.has(path)) return "UNKNOWN_CATALOG_VALUE";
  if (path.startsWith("/extensions")) return "UNKNOWN_EXTENSION";
  return undefined;
}

function matchKeywordCode(error: StandaloneValidationError, path: string): string {
  if (FIELD_LIMIT_KEYWORDS.has(error.keyword)) return "FIELD_LIMIT_EXCEEDED";
  if (error.keyword === "required") {
    const missing = typeof error.params.missingProperty === "string" ? error.params.missingProperty : "";
    return mapRequiredError(error.instancePath, missing);
  }
  if (error.keyword === "additionalProperties") {
    const extra = typeof error.params.additionalProperty === "string" ? error.params.additionalProperty : "";
    return mapAdditionalPropertiesError(path, extra);
  }
  return "SDK_SCHEMA_VALIDATION_FAILED";
}

function resolveErrorPath(error: StandaloneValidationError | undefined): string {
  if (!error) return "/";
  if (error.instancePath) return error.instancePath;
  const fromMissing = pathFromMissingProperty(error);
  if (fromMissing) return fromMissing;
  return "/";
}

function mapSchemaError(error: StandaloneValidationError | undefined): string {
  if (!error) return "SDK_SCHEMA_VALIDATION_FAILED";
  const path = resolveErrorPath(error);
  const pathCode = matchPathCode(path);
  if (pathCode !== undefined) return pathCode;
  return matchKeywordCode(error, path);
}

function categoryForSchemaCode(code: string): "validation" | "privacy" {
  return code === "PROHIBITED_DATA" ? "privacy" : "validation";
}

function pathFromMissingProperty(error: StandaloneValidationError | undefined): string | undefined {
  if (!error || error.keyword !== "required" || typeof error.params.missingProperty !== "string") return undefined;
  return `${error.instancePath}/${error.params.missingProperty}`.replace(/\/+/g, "/");
}

const PROHIBITED_PROPERTY_PATTERN = /token|secret|cookie|private_key|raw_body|full_request|request_body|response_body/i;

function isProhibitedProperty(key: string): boolean {
  return PROHIBITED_PROPERTY_PATTERN.test(key);
}
