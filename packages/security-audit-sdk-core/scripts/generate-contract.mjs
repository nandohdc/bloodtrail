import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Ajv2020 from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import standaloneCode from "ajv/dist/standalone/index.js";

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
  const extensions = source.extension_namespaces.map((entry) => ({
    namespace: entry.namespace,
    version: entry.version,
    trust: entry.trust,
    policy: entry.policy,
    privacy: entry.privacy,
    max_bytes: entry.max_bytes,
    allowed_fields: entry.allowed_fields,
  }));
  return [
    `export const CONTRACT_VERSION = "1.0.0" as const;`,
    `export const CONTRACT_SCHEMA_NAME = ${JSON.stringify(source.metadata.schema_name)} as const;`,
    `export const CONTRACT_SCHEMA_ID = ${JSON.stringify(source.metadata.schema_id)} as const;`,
    `export const REGISTRIES = ${JSON.stringify(registries, null, 2)} as const;`,
    `export const EVENT_CATALOG = ${JSON.stringify(catalog, null, 2)} as const;`,
    `export const EXTENSION_NAMESPACES = ${JSON.stringify(extensions, null, 2)} as const;`,
    `export const FIELD_POLICY = ${JSON.stringify(fieldPolicy, null, 2)} as const;`,
    `export const PROHIBITED_DATA_KEYS = ${JSON.stringify([...source.prohibited_data].sort(), null, 2)} as const;`,
    `export type EventDefinition = (typeof EVENT_CATALOG)[number];`,
    `export type EventName = EventDefinition["name"];`,
    `export type EventSemantic = EventDefinition["semantic"];`,
    `export type EventNameFor<S extends EventSemantic> = Extract<EventDefinition, { readonly semantic: S }>["name"];`,
    `export type EventForName<N extends EventName> = SecurityAuditEvent & { readonly event: SecurityAuditEvent["event"] & { readonly name: N } };`,
    `export type RegistryName = keyof typeof REGISTRIES;`,
    `export type RegistryValue<N extends RegistryName> = (typeof REGISTRIES)[N][number];`,
  ].join("\n\n");
}

async function emitStandaloneValidator(schema) {
  const ajv = new Ajv2020({ allErrors: true, strict: true, allowUnionTypes: true, code: { source: true }, validateFormats: true });
  addFormats(ajv);
  const validate = ajv.compile(schema);
  return standaloneCode(ajv, validate);
}

function stable(value) {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stable(value[key])]));
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
