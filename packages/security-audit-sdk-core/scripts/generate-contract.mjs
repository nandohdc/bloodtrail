import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import standaloneCode from "ajv/dist/standalone/index.js";

// Explicit code-unit ordering, identical to the default sort for strings.
// Deliberately not localeCompare: this ordering is baked into the generated
// artifacts that check:generated compares byte-for-byte, so it must not depend
// on the runner's locale. Defined locally to keep this generator free of
// local module dependencies.
const byCodePoint = (a, b) => {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
};

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repositoryRoot = resolve(packageRoot, "../..");
const contractRoot = resolve(repositoryRoot, "contracts/security-audit");
const sourcePath = resolve(contractRoot, "source/contract.source.json");
const schemaPath = resolve(contractRoot, "schema/security-audit-event.schema.json");
const catalogPath = resolve(contractRoot, "catalog/catalog.json");
const policyPath = resolve(contractRoot, "policies/field-policy.json");
const registriesPath = resolve(contractRoot, "registries/registries.json");
const provenancePath = resolve(packageRoot, "contract-provenance.json");
const generatedRoot = resolve(packageRoot, "src/generated");
const check = process.argv.includes("--check");

// Bundling machinery for the self-contained validator (ADR-SDK-011). Declared
// above the first top-level generate call below: a const is not initialised
// until its own line runs, so these sat in the temporal dead zone at line 61.
const vendorRoot = resolve(packageRoot, "vendor");
const EXPORT_STATEMENT = /^export \{[^}]*\};$/m;
const TOP_LEVEL_DECLARATION = /^(?:const|function)\s+([A-Za-z_$][\w$]*)/gm;
const STRICT_DIRECTIVE = '"use strict";';

const REPLACEMENTS = Object.freeze([
  ['require("ajv/dist/runtime/ucs2length").default', "bundledUcs2length"],
  ['require("ajv-formats/dist/formats").fullFormats["date-time"]', "{ validate: bundledDateTimeValidate }"],
  ['require("ajv-formats/dist/formats").fullFormats.uri', "bundledUriValidate"],
]);

const ATTRIBUTION_HEADER = [
  "/* Bundled runtime code, MIT licensed, inlined by scripts/generate-contract.mjs per ADR-SDK-011:",
  " * - ajv 8.20.0 runtime helper ucs2length (https://github.com/ajv-validator/ajv)",
  " * - ajv-formats 3.0.1 date-time and uri validators (https://github.com/ajv-validator/ajv-formats)",
  " * Sources: vendor/bundled-validator-runtime.mjs, vendor/bundled-validator-formats.mjs. See DEPENDENCIES.md. */",
].join("\n");

const [source, schema, catalogArtifact, fieldPolicy, registriesArtifact, provenance] = await Promise.all([
  readJson(sourcePath),
  readJson(schemaPath),
  readJson(catalogPath),
  readJson(policyPath),
  readJson(registriesPath),
  readJson(provenancePath),
]);

assert(source.metadata?.schema_version === "1.0.0", "canonical source must be contract 1.0.0");
assert(schema.$id === source.metadata?.schema_id && schema.$id.includes("/1.0.0/"), "schema ID must bind to contract 1.0.0");
assert(Array.isArray(source.catalog) && source.catalog.length === 24, "canonical catalog must contain 24 events");
const generatedCatalog = Array.isArray(catalogArtifact) ? catalogArtifact : catalogArtifact.events ?? catalogArtifact.catalog;
assert(Array.isArray(generatedCatalog) && generatedCatalog.length === 24, "generated catalog must contain 24 events");
assert(provenance.normativeTechnicalTarget === "8c5992bb6edc5c6dfdbfd0f48988b32f88ad2993", "normative contract target drift");
assert(JSON.stringify(stable(source.registries)) === JSON.stringify(stable(registriesArtifact)), "source and generated registries differ");
assert(fieldPolicyMatches(source.fields, fieldPolicy), "source and generated field policy projection differ");
assert(
  JSON.stringify(source.catalog.map(({ name }) => name)) === JSON.stringify(generatedCatalog.map(({ name }) => name)),
  "source and generated catalog event names differ",
);

const header = [
  "// GENERATED FILE. DO NOT EDIT.",
  "// Contract: Bloodtrail Security Audit Event Contract 1.0.0",
  "// Sources: contracts/security-audit/source/contract.source.json and generated contract artifacts.",
  "",
].join("\n");

const contractTypes = `${header}${emitSchemaType("SecurityAuditEvent", schema)}\n\n${emitConstants(source, fieldPolicy)}\n`;
const validator = await emitStandaloneValidator(schema);
const validatorTypes = `${header}interface StandaloneValidationError {\n  readonly instancePath: string;\n  readonly schemaPath: string;\n  readonly keyword: string;\n  readonly params: Readonly<Record<string, unknown>>;\n  readonly message?: string;\n}\n\ninterface StandaloneValidate {\n  (value: unknown): boolean;\n  errors: readonly StandaloneValidationError[] | null;\n}\n\ndeclare const validate: StandaloneValidate;\nexport = validate;\n`;

if (!check) await mkdir(generatedRoot, { recursive: true });
await output(resolve(generatedRoot, "contract.generated.ts"), contractTypes);
await output(resolve(generatedRoot, "schema-validator.generated.cjs"), `${validator.trimEnd()}\n`);
await output(resolve(generatedRoot, "schema-validator.generated.d.cts"), validatorTypes);

if (check) console.log("generated SDK contract artifacts are current");
else console.log("generated SDK contract artifacts written");

async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function emitSchemaType(name, node) {
  return `export type ${name} = ${toType(node, 0)};`;
}

function toType(node, depth) {
  if (!node || typeof node !== "object") return "unknown";
  if (Object.hasOwn(node, "const")) return JSON.stringify(node.const);
  if (Array.isArray(node.enum)) return node.enum.map((v) => JSON.stringify(v)).join(" | ") || "never";
  if (Array.isArray(node.oneOf)) return node.oneOf.map((x) => `(${toType(x, depth)})`).join(" | ");
  if (Array.isArray(node.anyOf)) return node.anyOf.map((x) => `(${toType(x, depth)})`).join(" | ");
  if (Array.isArray(node.allOf)) return node.allOf.map((x) => `(${toType(x, depth)})`).join(" & ");
  if (Array.isArray(node.type)) return node.type.map((type) => toType({ ...node, type }, depth)).join(" | ");
  switch (node.type) {
    case "null": return "null";
    case "boolean": return "boolean";
    case "integer":
    case "number": return "number";
    case "string": return "string";
    case "array": return `ReadonlyArray<${toType(node.items ?? {}, depth + 1)}>`;
    case "object": {
      const required = new Set(node.required ?? []);
      const properties = Object.entries(node.properties ?? {});
      const indent = "  ".repeat(depth + 1);
      const close = "  ".repeat(depth);
      const members = properties.map(([key, value]) => `${indent}readonly ${JSON.stringify(key)}${required.has(key) ? "" : "?"}: ${toType(value, depth + 1)};`);
      if (node.additionalProperties && typeof node.additionalProperties === "object") {
        members.push(`${indent}readonly [key: string]: ${toType(node.additionalProperties, depth + 1)};`);
      }
      return members.length ? `{\n${members.join("\n")}\n${close}}` : "Readonly<Record<string, never>>";
    }
    default:
      return "unknown";
  }
}

function emitConstants(source, fieldPolicy) {
  const registries = stable(source.registries);
  const catalog = source.catalog.map((entry) => ({
    semantic: entry.semantic,
    name: entry.name,
    category: entry.category,
    action: entry.action,
    phase: entry.phase,
    outcomes: entry.outcomes,
    commit: entry.commit,
    producer: entry.producer,
    required_context: entry.required_context,
    delivery: entry.delivery,
    retention: entry.retention,
  }));
  const methods = source.catalog.map((entry) => ({
    method: toCamelCase(entry.semantic),
    inputType: `${toPascalCase(entry.semantic)}EventInput`,
    semantic: entry.semantic,
    name: entry.name,
  }));
  const extensions = source.extension_namespaces.map((entry) => ({
    namespace: entry.namespace,
    version: entry.version,
    trust: entry.trust,
    policy: entry.policy,
    privacy: entry.privacy,
    max_bytes: entry.max_bytes,
    allowed_fields: entry.allowed_fields,
  }));
  const sdkErrorCodes = [
    "SDK_INVALID_CONFIGURATION",
    "SDK_INVALID_INPUT",
    "FIELD_SERIALIZATION_FAILED",
    "SDK_UNSUPPORTED_CONTRACT_VERSION",
    "SDK_MISSING_AUTHORITATIVE_CONTEXT",
    "SDK_MISSING_EVENT_FIELD",
    "SDK_NOT_READY",
    "SDK_SHUTTING_DOWN",
    "SDK_SHUT_DOWN",
    "SDK_SCHEMA_VALIDATION_FAILED",
    "SDK_SEMANTIC_VALIDATION_FAILED",
    "SDK_SINK_REJECTED",
    "SDK_SINK_FAILURE",
    "SDK_SHUTDOWN_TIMEOUT",
    "SDK_INVALID_OPERATION_TRANSITION",
    "SDK_INVALID_IDENTIFIER",
    "SDK_INVALID_CLOCK",
    "SDK_HOOK_FAILURE",
    "SDK_DUPLICATE_SUCCESS",
    "SDK_OPERATION_EVENT_MISMATCH",
    "SDK_UNSUPPORTED_HOOK_RESULT",
  ];
  const eventInputAliases = methods.map((method) => {
    return `export type ${method.inputType} = EventBuilderInputForName<${JSON.stringify(method.name)}>;`;
  }).join("\n\n");
  return [
    `export const CONTRACT_VERSION = "1.0.0" as const;`,
    `export const CONTRACT_SCHEMA_NAME = ${JSON.stringify(source.metadata.schema_name)} as const;`,
    `export const CONTRACT_SCHEMA_ID = ${JSON.stringify(source.metadata.schema_id)} as const;`,
    `export const REGISTRIES = ${JSON.stringify(registries, null, 2)} as const;`,
    `export const EVENT_CATALOG = ${JSON.stringify(catalog, null, 2)} as const;`,
    `export const EVENT_METHODS = ${JSON.stringify(methods, null, 2)} as const;`,
    `export const EXTENSION_NAMESPACES = ${JSON.stringify(extensions, null, 2)} as const;`,
    `export const FIELD_POLICY = ${JSON.stringify(fieldPolicy, null, 2)} as const;`,
    `export const PROHIBITED_DATA_KEYS = ${JSON.stringify([...source.prohibited_data].sort(byCodePoint), null, 2)} as const;`,
    `export const CONTRACT_ERROR_CODES = REGISTRIES.validation_error_codes;`,
    `export const SDK_ERROR_CODES = ${JSON.stringify(sdkErrorCodes, null, 2)} as const;`,
    `export type EventDefinition = (typeof EVENT_CATALOG)[number];`,
    `export type EventName = EventDefinition["name"];`,
    `export type EventSemantic = EventDefinition["semantic"];`,
    `export type EventMethodDefinition = (typeof EVENT_METHODS)[number];`,
    `export type EventMethodName = EventMethodDefinition["method"];`,
    `export type EventNameFor<S extends EventSemantic> = Extract<EventDefinition, { readonly semantic: S }>["name"];`,
    `export type EventForName<N extends EventName> = SecurityAuditEvent & { readonly event: SecurityAuditEvent["event"] & { readonly name: N } };`,
    `export type EventDefinitionForName<N extends EventName> = Extract<EventDefinition, { readonly name: N }>;`,
    `export type EventPhaseForName<N extends EventName> = EventDefinitionForName<N>["phase"][number];`,
    `export type EventOutcomeForName<N extends EventName> = EventDefinitionForName<N>["outcomes"][number];`,
    `export type EventCommitForName<N extends EventName> = EventDefinitionForName<N>["commit"][number];`,
    `export type RequiredContextForName<N extends EventName> = EventDefinitionForName<N>["required_context"][number];`,
    `export type RegistryName = keyof typeof REGISTRIES;`,
    `export type RegistryValue<N extends RegistryName> = (typeof REGISTRIES)[N][number];`,
    `export type ContractErrorCode = (typeof CONTRACT_ERROR_CODES)[number];`,
    `export type SdkGeneratedErrorCode = (typeof SDK_ERROR_CODES)[number];`,
    `export type AuditErrorCode = ContractErrorCode | SdkGeneratedErrorCode;`,
    emitEventInputTypes(),
    eventInputAliases,
    `export type NamedAuditEventInputMap = {\n${methods.map((method) => `  readonly ${JSON.stringify(method.method)}: ${method.inputType};`).join("\n")}\n};`,
  ].join("\n\n");
}

function emitEventInputTypes() {
  return `type UnionToIntersection<T> = (T extends unknown ? (value: T) => void : never) extends (value: infer I) => void ? I : never;

export interface GeneratedOperationContext {
  readonly operation_id?: string;
  readonly transaction_id?: string;
  readonly state?: "started" | "committed" | "not_committed" | "partially_committed" | "compensated" | "cancelled";
  readonly commit_state?: SecurityAuditEvent["event"]["commit_state"];
  readonly bound_event?: string;
  readonly transactional?: boolean;
}

export interface RetryRelationshipInput {
  readonly retry_attempt: number;
  readonly original_event_id: string;
  readonly causation_id?: string;
}

export interface RedeliveryInput<N extends EventName = EventName> {
  readonly event: EventForName<N>;
}

export type EventBuilderBaseInput<N extends EventName> = {
  readonly event?: {
    readonly lifecycle_phase?: EventPhaseForName<N>;
    readonly outcome?: EventOutcomeForName<N>;
    readonly outcome_reason?: SecurityAuditEvent["event"]["outcome_reason"];
    readonly commit_state?: EventCommitForName<N>;
    readonly timestamp?: string;
    readonly observed_at?: string;
  };
  readonly tenant?: SecurityAuditEvent["tenant"];
  readonly claimedTenant?: Pick<SecurityAuditEvent["tenant"], "claimed_tenant_id">;
  readonly actor?: SecurityAuditEvent["actor"];
  readonly subject?: SecurityAuditEvent["subject"];
  readonly authenticated_principal?: SecurityAuditEvent["authenticated_principal"];
  readonly delegation?: SecurityAuditEvent["delegation"];
  readonly credential?: SecurityAuditEvent["credential"];
  readonly initiator?: SecurityAuditEvent["initiator"];
  readonly session?: SecurityAuditEvent["session"];
  readonly authentication?: SecurityAuditEvent["authentication"];
  readonly authorization?: SecurityAuditEvent["authorization"];
  readonly source?: SecurityAuditEvent["source"];
  readonly destination?: SecurityAuditEvent["destination"];
  readonly resource?: SecurityAuditEvent["resource"];
  readonly request?: SecurityAuditEvent["request"];
  readonly correlation?: Partial<SecurityAuditEvent["correlation"]>;
  readonly risk?: SecurityAuditEvent["risk"];
  readonly data?: Partial<SecurityAuditEvent["data"]>;
  readonly integrity?: SecurityAuditEvent["integrity"];
  readonly extensions?: SecurityAuditEvent["extensions"];
  readonly operation?: GeneratedOperationContext;
  readonly retry?: RetryRelationshipInput;
  readonly redelivery?: RedeliveryInput<N>;
};

type RequiredContextProperty<C extends string> =
  C extends "actor" | "administrator" | "real_actor" | "real_admin_actor" | "real_actor_or_process" | "actor_or_claim" ? { readonly actor: SecurityAuditEvent["actor"] } :
  C extends "tenant" | "tenants" | "authoritative_tenants" | "tenant_or_platform_scope" ? { readonly tenant: SecurityAuditEvent["tenant"] } :
  C extends "resource" | "role" | "resource_scope" | "config_resource" | "resource_owner" ? { readonly resource: SecurityAuditEvent["resource"] } :
  C extends "authorization" | "policy" ? { readonly authorization: SecurityAuditEvent["authorization"] } :
  C extends "authentication" ? { readonly authentication: SecurityAuditEvent["authentication"] } :
  C extends "session" ? { readonly session: SecurityAuditEvent["session"] } :
  C extends "credential" ? { readonly credential: SecurityAuditEvent["credential"] } :
  C extends "source" | "request_source" ? { readonly source: SecurityAuditEvent["source"] } :
  C extends "request" ? { readonly request: SecurityAuditEvent["request"] } :
  C extends "correlation" | "original_start" ? { readonly correlation: Partial<SecurityAuditEvent["correlation"]> } :
  C extends "subject" | "impersonated_subject" ? { readonly subject: SecurityAuditEvent["subject"] } :
  C extends "principal" | "authenticated_principal" ? { readonly authenticated_principal: SecurityAuditEvent["authenticated_principal"] } :
  C extends "delegation" | "scope" | "expiry" ? { readonly delegation: SecurityAuditEvent["delegation"] } :
  C extends "operation" | "transaction" ? { readonly operation: GeneratedOperationContext } :
  C extends "change_categories" | "change_category" ? { readonly resource: SecurityAuditEvent["resource"] & { readonly change_categories: NonNullable<SecurityAuditEvent["resource"]["change_categories"]> } } :
  C extends "deletion_mode" ? { readonly resource: SecurityAuditEvent["resource"] & { readonly deletion_mode: NonNullable<SecurityAuditEvent["resource"]["deletion_mode"]> } } :
  C extends "bounded_volume" | "destination_class" ? { readonly resource: SecurityAuditEvent["resource"] & { readonly export: NonNullable<SecurityAuditEvent["resource"]["export"]> } } :
  C extends "claimed_tenant" ? { readonly claimedTenant: Pick<SecurityAuditEvent["tenant"], "claimed_tenant_id"> } :
  {};

export type EventBuilderInputForName<N extends EventName> =
  EventBuilderBaseInput<N> & UnionToIntersection<RequiredContextProperty<RequiredContextForName<N>>>;`;
}

function toCamelCase(value) {
  const pascal = toPascalCase(value);
  return pascal.charAt(0).toLowerCase() + pascal.slice(1);
}

function toPascalCase(value) {
  return value.split(/[_\-.]+/g).filter(Boolean).map((part) => {
    if (part.toLowerCase() === "mfa") return "Mfa";
    return part.charAt(0).toUpperCase() + part.slice(1);
  }).join("");
}

async function readVendoredSource(name) {
  const text = await readFile(resolve(vendorRoot, name), "utf8");
  assert(EXPORT_STATEMENT.test(text), `${name} must carry exactly one export statement`);
  const body = text.replace(EXPORT_STATEMENT, "").trimEnd();
  assert(!/\b(?:import|require)\s*[({]/.test(body), `${name} must not reference external modules`);
  return body;
}

function declaredNames(source) {
  return [...source.matchAll(TOP_LEVEL_DECLARATION)].map((match) => match[1]);
}

function bundleValidatorRuntime(code, vendored) {
  assert(code.startsWith(STRICT_DIRECTIVE), "generated validator does not open with the strict-mode directive");
  for (const name of declaredNames(vendored)) {
    assert(!new RegExp(String.raw`(?:const|let|var|function)\s+${name}\b`).test(code), `bundled name ${name} collides with generated code`);
  }
  let bundled = code.slice(STRICT_DIRECTIVE.length);
  for (const [pattern, replacement] of REPLACEMENTS) {
    assert(bundled.includes(pattern), `expected generated validator to reference ${pattern}`);
    bundled = bundled.replaceAll(pattern, replacement);
  }
  assert(!/require\s*\(/.test(bundled), "generated validator is not self-contained");
  return [STRICT_DIRECTIVE, ATTRIBUTION_HEADER, vendored, bundled.trimStart()].join("\n");
}

async function emitStandaloneValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true, code: { source: true }, validateFormats: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  const runtimeBody = await readVendoredSource("bundled-validator-runtime.mjs");
  const formatsBody = await readVendoredSource("bundled-validator-formats.mjs");
  const vendored = `${runtimeBody}\n${formatsBody}`;
  return bundleValidatorRuntime(standaloneCode(ajv, validate), vendored);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort(byCodePoint).map((key) => [key, stable(value[key])]));
  }
  return value;
}

function fieldPolicyMatches(sourceFields, generatedPolicy) {
  if (!Array.isArray(sourceFields) || !Array.isArray(generatedPolicy) || sourceFields.length !== generatedPolicy.length) return false;
  const byPath = new Map(generatedPolicy.map((entry) => [entry.path, entry]));
  return sourceFields.every((field) => {
    const policy = byPath.get(field.p);
    return policy
      && policy.authority === field.a
      && policy.trust === field.trust
      && policy.privacy === field.privacy
      && policy.policy === field.policy
      && policy.retention === field.retention
      && policy.compatibility === field.compat;
  });
}

async function output(path, content) {
  if (check) {
    let current;
    try { current = await readFile(path, "utf8"); }
    catch { throw new Error(`generated artifact missing: ${relative(repositoryRoot, path)}`); }
    if (current !== content) throw new Error(`generated artifact drift: ${relative(repositoryRoot, path)}`);
    return;
  }
  await writeFile(path, content, "utf8");
}
