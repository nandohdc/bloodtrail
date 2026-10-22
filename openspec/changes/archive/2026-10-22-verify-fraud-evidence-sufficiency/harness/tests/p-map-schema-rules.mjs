import assert from "node:assert/strict";
import { isDeepStrictEqual } from "node:util";

// Constructor inputs are canonical field inputs, not whole canonical events.
export const CONSTRUCTOR_PROPERTIES = Object.freeze({
  authorizationEvidence: "authorization", authenticationEvidence: "authentication",
  sessionEvidence: "session", credentialReference: "credential", authoritativeResource: "resource",
  authoritativeSubject: "subject", authoritativeTenant: "tenant", observedSource: "source",
  anonymousActor: "actor", authenticatedHumanActor: "actor", administratorActor: "actor",
  serviceAccountActor: "actor", workloadIdentityActor: "actor", scheduledProcessActor: "actor",
  apiCredentialActor: "actor", backgroundJobActor: "actor", externalIntegrationActor: "actor",
  authenticatedPrincipal: "authenticated_principal", request: "request", event: "event",
});

const RULES = [
  ["pattern", (rule, value) => typeof value !== "string" || new RegExp(rule, "u").test(value)],
  ["enum", (rule, value) => rule.some((item) => isDeepStrictEqual(item, value))],
  ["const", (rule, value) => isDeepStrictEqual(rule, value)],
  ["minLength", (rule, value) => typeof value !== "string" || [...value].length >= rule],
  ["maxLength", (rule, value) => typeof value !== "string" || [...value].length <= rule],
];

export function resolveSchema(root, node) {
  if (node.$ref === undefined) return node;
  assert(node.$ref.startsWith("#/"), "only local schema references are permitted");
  const target = node.$ref.slice(2).split("/").map((key) => key.replaceAll("~1", "/").replaceAll("~0", "~"))
    .reduce((value, key) => value[key], root);
  return resolveSchema(root, { ...target, ...Object.fromEntries(Object.entries(node).filter(([key]) => key !== "$ref")) });
}

function propertySchema(node, key) {
  if (Object.hasOwn(node.properties ?? {}, key)) return node.properties[key];
  assert.equal(node.additionalProperties, true, `undeclared schema property ${key}`);
  return {};
}

function scalarIssues(node, value) {
  return RULES.filter(([key, check]) => Object.hasOwn(node, key) && !check(node[key], value)).map(([key]) => key);
}

function recordIssues(context, path, issues) {
  if (context.exemptions.includes(path)) { context.skipped.add(path); return; }
  context.violations.push(...issues.map((rule) => ({ path, rule })));
}

// Scalar constraints only, plus the explicit array bound used by C2b. This is
// not a replacement SDK validator: no requiredness, semantics or SDK imports.
export function inspectValue(context, sample) {
  const { value, path } = sample;
  if (value === undefined) return;
  const node = resolveSchema(context.schema, sample.node);
  if (Array.isArray(value)) return inspectArray(context, { value, path, node });
  if (value !== null && typeof value === "object") return inspectObject(context, { value, path, node });
  context.paths.add(path);
  context.leaves += 1;
  recordIssues(context, path, scalarIssues(node, value));
}

function inspectArray(context, { value, path, node }) {
  if (value.length > node.maxItems) recordIssues(context, path, ["maxItems"]);
  value.forEach((item, index) => inspectValue(context, { value: item, path: `${path}/${index}`, node: node.items }));
}

function inspectObject(context, { value, path, node }) {
  for (const [key, item] of Object.entries(value)) inspectValue(context,
    { value: item, path: `${path}/${key}`, node: propertySchema(node, key) });
}
