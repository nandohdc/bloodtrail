import { builtinModules } from "node:module";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import ts from "typescript";

import { byCodePoint } from "./verification-helpers.mjs";

const NODE_BUILTINS = new Set(builtinModules.map((name) => name.replace(/^node:/, "")));
const CODE_ARTIFACT = /\.(?:[cm]?[jt]s)$/;

export const SHIPPED_IMPORT_POLICY = Object.freeze({
  selfReferencePackage: "@bloodtrail/security-audit-sdk-core",
  roles: Object.freeze({
    runtime: Object.freeze({
      prefix: "dist/",
      builtins: Object.freeze(["node:async_hooks", "node:crypto"]),
      allowSelfReference: false,
    }),
    examples: Object.freeze({
      prefix: "examples/",
      builtins: Object.freeze(["node:assert", "node:timers/promises"]),
      allowSelfReference: true,
    }),
  }),
});

export function collectSpecifiers(artifactPath, sourceText) {
  const specifiers = [];
  const failures = [];
  let sourceFile;
  try {
    sourceFile = ts.createSourceFile(
      artifactPath,
      sourceText,
      ts.ScriptTarget.ESNext,
      true,
      scriptKindFor(artifactPath),
    );
  } catch {
    return {
      specifiers,
      failures: [violation(artifactPath, "<parse>", "artifact-parse-failure")],
    };
  }

  const collection = { artifactPath, specifiers, failures };

  function visit(node) {
    collectStaticSpecifier(node, collection);
    if (ts.isCallExpression(node)) collectCallSpecifier(node, collection);
    if (isUnclassifiableRequire(node)) {
      failures.push(violation(artifactPath, "<require-reference>", "unclassifiable-require"));
    }
    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return { specifiers, failures };
}

export function classifySpecifier(specifier, artifactPath, context) {
  const role = context.role ?? roleForArtifact(artifactPath);
  if (!role) return { violation: violation(artifactPath, "<artifact-role>", "unknown-artifact-role") };
  if (specifier.startsWith(".")) return { classification: "internal" };
  if (specifier.startsWith("node:")) return classifyNodeBuiltin(specifier, artifactPath, role);
  if (NODE_BUILTINS.has(specifier)) {
    return { violation: violation(artifactPath, specifier, "unprefixed-builtin") };
  }

  const manifest = context.manifest;
  if (isSelfReference(specifier, manifest.name)) {
    return classifySelfReference(specifier, artifactPath, role, manifest);
  }
  if (Object.hasOwn(manifest.dependencies ?? {}, packageNameFor(specifier))) {
    return { classification: "declared-dependency" };
  }
  return { violation: violation(artifactPath, specifier, "undeclared-external") };
}

export async function inspectShippedImports({ packageRoot, files, manifest }) {
  const artifacts = files
    .map((entry) => entry.path)
    .filter((path) => typeof path === "string" && CODE_ARTIFACT.test(path))
    .sort(byCodePoint);
  const result = { inspected: artifacts.length, specifiers: 0, violations: [] };
  if (artifacts.length === 0) {
    result.violations.push(violation("<inventory>", "<none>", "empty-inventory"));
    return result;
  }

  for (const artifactPath of artifacts) {
    await inspectArtifact({ packageRoot, artifactPath, manifest, result });
  }
  result.violations.sort(compareViolations);
  return result;
}

async function inspectArtifact({ packageRoot, artifactPath, manifest, result }) {
  const role = roleForArtifact(artifactPath);
  if (!role) {
    result.violations.push(violation(artifactPath, "<artifact-role>", "unknown-artifact-role"));
    return;
  }

  let sourceText;
  try {
    sourceText = await readFile(resolve(packageRoot, artifactPath), "utf8");
  } catch {
    result.violations.push(violation(artifactPath, "<read>", "artifact-read-failure"));
    return;
  }

  const collected = collectSpecifiers(artifactPath, sourceText);
  result.specifiers += collected.specifiers.length + collected.failures.length;
  result.violations.push(...collected.failures);
  for (const specifier of collected.specifiers) {
    const classified = classifySpecifier(specifier, artifactPath, { manifest, role });
    if (classified.violation) result.violations.push(classified.violation);
  }
}

function collectStaticSpecifier(node, context) {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    if (node.moduleSpecifier) collectLiteral(node.moduleSpecifier, "<static-import>", context);
    return;
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    collectLiteral(node.moduleReference.expression, "<import-equals>", context);
    return;
  }
  if (ts.isImportTypeNode(node)) {
    const literal = ts.isLiteralTypeNode(node.argument) ? node.argument.literal : node.argument;
    collectLiteral(literal, "<import-type>", context);
  }
}

function collectCallSpecifier(node, context) {
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    collectLiteral(node.arguments[0], "<dynamic-import>", context);
    return;
  }
  if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
    collectLiteral(node.arguments[0], "<dynamic-require>", context);
  }
}

function collectLiteral(node, marker, { artifactPath, specifiers, failures }) {
  if (node && ts.isStringLiteral(node)) {
    specifiers.push(node.text);
    return;
  }
  failures.push(violation(artifactPath, marker, "dynamic-specifier"));
}

function isUnclassifiableRequire(node) {
  if (ts.isIdentifier(node) && node.text === "require") {
    const parent = node.parent;
    return !(ts.isCallExpression(parent) && parent.expression === node);
  }
  return ts.isElementAccessExpression(node)
    && ts.isStringLiteral(node.argumentExpression)
    && node.argumentExpression.text === "require";
}

function classifyNodeBuiltin(specifier, artifactPath, role) {
  if (role.builtins.includes(specifier)) return { classification: "node-builtin" };
  return { violation: violation(artifactPath, specifier, "unapproved-builtin") };
}

function classifySelfReference(specifier, artifactPath, role, manifest) {
  if (!role.allowSelfReference) {
    return { violation: violation(artifactPath, specifier, "unapproved-self-reference") };
  }
  const subpath = specifier === manifest.name ? "." : `./${specifier.slice(manifest.name.length + 1)}`;
  if (manifest.exports && typeof manifest.exports === "object" && Object.hasOwn(manifest.exports, subpath)) {
    return { classification: "self-reference" };
  }
  return { violation: violation(artifactPath, specifier, "undeclared-self-reference") };
}

function isSelfReference(specifier, packageName) {
  return typeof packageName === "string"
    && (specifier === packageName || specifier.startsWith(`${packageName}/`));
}

function packageNameFor(specifier) {
  const parts = specifier.split("/");
  return specifier.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

function roleForArtifact(artifactPath) {
  return Object.values(SHIPPED_IMPORT_POLICY.roles).find(({ prefix }) => artifactPath.startsWith(prefix));
}

function scriptKindFor(artifactPath) {
  return /\.(?:ts|mts|cts)$/.test(artifactPath) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
}

function violation(artifact, specifier, code) {
  return { artifact, specifier, code };
}

function compareViolations(left, right) {
  return byCodePoint(
    `${left.artifact}\u0000${left.specifier}\u0000${left.code}`,
    `${right.artifact}\u0000${right.specifier}\u0000${right.code}`,
  );
}
