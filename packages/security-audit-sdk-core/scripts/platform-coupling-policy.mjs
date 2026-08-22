import { readdir, readFile } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import ts from "typescript";

import { byCodePoint } from "./verification-helpers.mjs";

const CODE_ARTIFACT = /\.(?:[cm]?[jt]s)$/;
const MAX_VIOLATIONS = 50;
const MAX_DETAIL_LENGTH = 120;

const LANGUAGE_GLOBALS = Object.freeze(new Set([
  "Array", "ArrayBuffer", "AsyncFunction", "AsyncGenerator", "AsyncGeneratorFunction",
  "AsyncIterator", "Atomics", "BigInt", "BigInt64Array", "BigUint64Array", "Boolean",
  "DataView", "Date", "Error", "EvalError", "Float16Array", "Float32Array", "Float64Array",
  "Function", "Generator", "GeneratorFunction", "Int8Array", "Int16Array", "Int32Array",
  "Intl", "Iterator", "JSON", "Map", "Math", "Number", "Object", "Promise", "Proxy",
  "RangeError", "ReferenceError", "Reflect", "RegExp", "Set", "SharedArrayBuffer",
  "String", "Symbol", "SyntaxError", "TypeError", "URIError", "Uint8Array",
  "Uint8ClampedArray", "Uint16Array", "Uint32Array", "WeakMap", "WeakRef", "WeakSet",
  "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "escape", "eval",
  "isFinite", "isNaN", "parseFloat", "parseInt", "structuredClone", "unescape", "undefined",
  "setTimeout", "clearTimeout",
]));

const NAME_DECLARATION_KINDS = new Set([
  ts.SyntaxKind.VariableDeclaration,
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.ClassExpression,
  ts.SyntaxKind.Parameter,
  ts.SyntaxKind.PropertyDeclaration,
  ts.SyntaxKind.PropertySignature,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.MethodSignature,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
  ts.SyntaxKind.EnumDeclaration,
  ts.SyntaxKind.EnumMember,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeParameter,
  ts.SyntaxKind.ModuleDeclaration,
  ts.SyntaxKind.NamespaceImport,
  ts.SyntaxKind.ImportEqualsDeclaration,
  ts.SyntaxKind.BindingElement,
]);

const HOISTED_NAME_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.ClassDeclaration,
  ts.SyntaxKind.ImportEqualsDeclaration,
]);

const TYPE_CONTAINER_KINDS = new Set([
  ts.SyntaxKind.TypeElement,
  ts.SyntaxKind.InterfaceDeclaration,
  ts.SyntaxKind.TypeAliasDeclaration,
  ts.SyntaxKind.TypeParameter,
]);

const LABEL_KINDS = new Set([
  ts.SyntaxKind.BreakStatement,
  ts.SyntaxKind.ContinueStatement,
  ts.SyntaxKind.LabeledStatement,
]);

export const PLATFORM_COUPLING_POLICY = Object.freeze({
  languageGlobals: LANGUAGE_GLOBALS,
  roles: Object.freeze({
    authored: Object.freeze({
      name: "authored",
      prefix: "src/",
      hostGlobals: Object.freeze({
        Buffer: Object.freeze({
          name: "Buffer",
          reason: "Calculates byte lengths for payload and property byte bounds in errors and validation",
          boundary: "internal byte length helper",
        }),
      }),
      specifiers: Object.freeze(["node:async_hooks", "node:crypto"]),
      uninspectedCouplings: Object.freeze([
        Object.freeze({
          name: "Timeout.unref()",
          reason: "Unreferences timer handles where supported per spec.md:523; host member access is not mechanically detected",
          boundary: "timer management",
        }),
      ]),
    }),
    generated: Object.freeze({
      name: "generated",
      prefix: "src/generated/",
      hostGlobals: Object.freeze({
        module: Object.freeze({
          name: "module",
          reason: "CommonJS wrapper export for schema-validator.generated.cjs",
          boundary: "schema validator export",
        }),
      }),
      specifiers: Object.freeze([]),
      uninspectedCouplings: Object.freeze([]),
    }),
  }),
});

export function collectCouplingReferences(artifactPath, sourceText) {
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
    return parseFailureResult(artifactPath);
  }

  if (sourceFile.parseDiagnostics && sourceFile.parseDiagnostics.length > 0) {
    return parseFailureResult(artifactPath);
  }

  const specifiers = [];
  const freeIdentifiers = new Set();
  const failures = [];
  const scopes = [new Set()];

  const context = { artifactPath, specifiers, freeIdentifiers, failures, scopes };
  hoistDeclarations(sourceFile.statements, context);
  walkNode(sourceFile, context);

  return {
    specifiers,
    identifiers: Array.from(freeIdentifiers).sort(byCodePoint),
    failures,
  };
}

function parseFailureResult(artifactPath) {
  return {
    specifiers: [],
    identifiers: [],
    failures: [violation(artifactPath, basename(artifactPath), "parse-failure")],
  };
}

function currentScope(context) {
  return context.scopes[context.scopes.length - 1];
}

function bindName(name, context) {
  if (typeof name === "string" && name.length > 0) {
    currentScope(context).add(name);
  }
}

function bindPattern(node, context) {
  if (!node) return;
  if (ts.isIdentifier(node)) {
    bindName(node.text, context);
    return;
  }
  if (ts.isBindingElement(node)) {
    bindPattern(node.name, context);
    return;
  }
  if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
    for (const element of node.elements) {
      if (!ts.isOmittedExpression(element)) {
        bindPattern(element, context);
      }
    }
  }
}

function isBound(name, context) {
  for (let i = context.scopes.length - 1; i >= 0; i -= 1) {
    if (context.scopes[i].has(name)) return true;
  }
  return false;
}

function hoistDeclarations(statements, context) {
  if (!statements) return;
  for (const stmt of statements) {
    hoistStatement(stmt, context);
  }
}

function hoistStatement(stmt, context) {
  if (HOISTED_NAME_KINDS.has(stmt.kind)) {
    if (stmt.name && ts.isIdentifier(stmt.name)) bindName(stmt.name.text, context);
    return;
  }
  if (ts.isImportDeclaration(stmt)) {
    if (stmt.importClause) hoistImportClause(stmt.importClause, context);
    return;
  }
  if (ts.isVariableStatement(stmt)) {
    for (const decl of stmt.declarationList.declarations) {
      bindPattern(decl.name, context);
    }
  }
}

function hoistImportClause(clause, context) {
  if (clause.name) bindName(clause.name.text, context);
  const bindings = clause.namedBindings;
  if (!bindings) return;
  if (ts.isNamespaceImport(bindings)) {
    bindName(bindings.name.text, context);
    return;
  }
  if (ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) {
      bindName(element.name.text, context);
    }
  }
}

function checkSpecifiers(node, context) {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    if (node.moduleSpecifier) collectLiteralSpecifier(node.moduleSpecifier, "<static-import>", context);
    return;
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    collectLiteralSpecifier(node.moduleReference.expression, "<import-equals>", context);
    return;
  }
  if (ts.isCallExpression(node)) {
    checkCallSpecifiers(node, context);
  }
}

function collectLiteralSpecifier(node, marker, context) {
  if (node && ts.isStringLiteral(node)) {
    context.specifiers.push(node.text);
  } else {
    context.failures.push(violation(context.artifactPath, marker, "dynamic-specifier"));
  }
}

function checkCallSpecifiers(node, context) {
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    collectLiteralSpecifier(node.arguments[0], "<dynamic-import>", context);
    return;
  }
  if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
    collectLiteralSpecifier(node.arguments[0], "<dynamic-require>", context);
  }
}

function walkFunction(node, context) {
  context.scopes.push(new Set());
  if (ts.isFunctionExpression(node) && node.name) {
    bindName(node.name.text, context);
  }
  for (const param of node.parameters) {
    bindPattern(param.name, context);
    if (param.initializer) walkNode(param.initializer, context);
  }
  if (node.body) {
    if (ts.isBlock(node.body)) {
      hoistDeclarations(node.body.statements, context);
    }
    walkNode(node.body, context);
  }
  context.scopes.pop();
}

function walkCatch(node, context) {
  context.scopes.push(new Set());
  if (node.variableDeclaration) {
    bindPattern(node.variableDeclaration.name, context);
  }
  if (node.block) {
    hoistDeclarations(node.block.statements, context);
    walkNode(node.block, context);
  }
  context.scopes.pop();
}

function walkBlock(node, context) {
  context.scopes.push(new Set());
  hoistDeclarations(node.statements, context);
  ts.forEachChild(node, (child) => walkNode(child, context));
  context.scopes.pop();
}

function walkLoop(node, context) {
  context.scopes.push(new Set());
  if (node.initializer && ts.isVariableDeclarationList(node.initializer)) {
    for (const decl of node.initializer.declarations) {
      bindPattern(decl.name, context);
    }
  }
  ts.forEachChild(node, (child) => walkNode(child, context));
  context.scopes.pop();
}

function walkNode(node, context) {
  if (!node || isTypeNode(node)) return;

  checkSpecifiers(node, context);

  if (isFunctionLike(node)) {
    walkFunction(node, context);
    return;
  }
  if (ts.isCatchClause(node)) {
    walkCatch(node, context);
    return;
  }
  if (ts.isBlock(node)) {
    walkBlock(node, context);
    return;
  }
  if (isLoopNode(node)) {
    walkLoop(node, context);
    return;
  }
  if (ts.isVariableDeclaration(node)) {
    bindPattern(node.name, context);
    if (node.initializer) walkNode(node.initializer, context);
    return;
  }
  if (ts.isIdentifier(node) && isValueIdentifier(node)) {
    const name = node.text;
    if (!isBound(name, context)) {
      context.freeIdentifiers.add(name);
    }
  }

  ts.forEachChild(node, (child) => walkNode(child, context));
}

export async function inspectPlatformCoupling({ packageRoot, sourceRoot }) {
  const allFiles = await walkSourceTree(sourceRoot);
  const artifacts = allFiles
    .map((file) => relative(packageRoot, file).split(sep).join("/"))
    .filter((path) => CODE_ARTIFACT.test(path))
    .sort(byCodePoint);

  const result = {
    inspected: artifacts.length,
    references: 0,
    inventory: {
      authored: { artifacts: 0, references: 0, hostGlobals: new Map() },
      generated: { artifacts: 0, references: 0, hostGlobals: new Map() },
    },
    violations: [],
  };

  if (artifacts.length === 0) {
    result.violations.push(violation("<inventory>", "<none>", "empty-inventory"));
    return result;
  }

  for (const artifactPath of artifacts) {
    await inspectArtifact({ packageRoot, artifactPath, result });
  }

  result.violations.sort(compareViolations);
  if (result.violations.length > MAX_VIOLATIONS) {
    result.violations = result.violations.slice(0, MAX_VIOLATIONS);
  }
  return result;
}

async function inspectArtifact({ packageRoot, artifactPath, result }) {
  const role = roleForArtifact(artifactPath);
  const roleInventory = result.inventory[role.name];
  roleInventory.artifacts += 1;

  let sourceText;
  try {
    sourceText = await readFile(resolve(packageRoot, artifactPath), "utf8");
  } catch {
    result.violations.push(violation(artifactPath, basename(artifactPath), "read-failure"));
    return;
  }

  const collected = collectCouplingReferences(artifactPath, sourceText);
  result.references += collected.specifiers.length + collected.identifiers.length;
  roleInventory.references += collected.specifiers.length + collected.identifiers.length;

  for (const fail of collected.failures) {
    result.violations.push(fail);
  }

  const context = { artifactPath, role, roleInventory, result };
  for (const specifier of collected.specifiers) {
    classifySpecifier(specifier, context);
  }
  for (const identifier of collected.identifiers) {
    classifyIdentifier(identifier, context);
  }
}

function classifySpecifier(specifier, { artifactPath, role, result }) {
  if (specifier.startsWith(".")) return;
  if (role.specifiers.includes(specifier)) return;
  result.violations.push(violation(artifactPath, specifier, "undeclared-specifier"));
}

function classifyIdentifier(identifier, { artifactPath, role, roleInventory, result }) {
  if (LANGUAGE_GLOBALS.has(identifier)) return;
  if (Object.hasOwn(role.hostGlobals, identifier)) {
    const current = roleInventory.hostGlobals.get(identifier) ?? 0;
    roleInventory.hostGlobals.set(identifier, current + 1);
    return;
  }
  result.violations.push(violation(artifactPath, identifier, "undeclared-global"));
}

function isHeritageExtends(node) {
  const parent = node.parent;
  return Boolean(parent && ts.isHeritageClause(parent) && parent.token === ts.SyntaxKind.ExtendsKeyword);
}

function isTypeOnlyDeclaration(node) {
  if (node.isTypeOnly) return true;
  if (ts.isImportDeclaration(node)) return Boolean(node.importClause?.isTypeOnly);
  return false;
}

function isTypeNode(node) {
  if (!node) return false;
  if (ts.isExpressionWithTypeArguments(node)) {
    return !isHeritageExtends(node);
  }
  if (ts.isTypeNode(node) || TYPE_CONTAINER_KINDS.has(node.kind)) return true;
  return isTypeOnlyDeclaration(node);
}

function isLoopNode(node) {
  return ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node);
}

function isFunctionLike(node) {
  return (
    ts.isFunctionDeclaration(node) ||
    ts.isFunctionExpression(node) ||
    ts.isArrowFunction(node) ||
    ts.isMethodDeclaration(node) ||
    ts.isConstructorDeclaration(node) ||
    ts.isGetAccessor(node) ||
    ts.isSetAccessor(node)
  );
}

function isReExport(specifier) {
  const exportDecl = specifier.parent?.parent;
  return Boolean(exportDecl?.moduleSpecifier);
}

function isExportAlias(specifier, node) {
  return Boolean(specifier.propertyName && specifier.name === node);
}

function isExportSpecifierValue(specifier, node) {
  if (isReExport(specifier)) return false;
  if (isExportAlias(specifier, node)) return false;
  return true;
}

function isValueIdentifier(node) {
  const parent = node.parent;
  if (!parent) return true;
  if (ts.isExportSpecifier(parent)) return isExportSpecifierValue(parent, node);
  if (isDeclarationName(parent, node)) return false;
  if (isPropertyPosition(parent, node)) return false;
  if (isLabelReference(parent, node)) return false;
  return true;
}

function isDeclarationName(parent, node) {
  if (NAME_DECLARATION_KINDS.has(parent.kind)) {
    return parent.name === node;
  }
  if (ts.isImportClause(parent)) {
    return parent.name === node;
  }
  if (ts.isImportSpecifier(parent)) {
    return parent.name === node || parent.propertyName === node;
  }
  return false;
}

function isPropertyPosition(parent, node) {
  if (ts.isPropertyAccessExpression(parent)) return parent.name === node;
  if (ts.isPropertyAssignment(parent)) return parent.name === node;
  if (ts.isQualifiedName(parent)) return parent.right === node;
  if (ts.isBindingElement(parent)) return parent.propertyName === node;
  return false;
}

function isLabelReference(parent, node) {
  if (!LABEL_KINDS.has(parent.kind)) return false;
  return parent.label === node;
}

function roleForArtifact(artifactPath) {
  if (artifactPath.startsWith(PLATFORM_COUPLING_POLICY.roles.generated.prefix)) {
    return PLATFORM_COUPLING_POLICY.roles.generated;
  }
  return PLATFORM_COUPLING_POLICY.roles.authored;
}

function scriptKindFor(artifactPath) {
  return /\.(?:ts|mts|cts)$/.test(artifactPath) ? ts.ScriptKind.TS : ts.ScriptKind.JS;
}

function violation(artifact, detail, code) {
  return {
    artifact: escapeDiagnostic(artifact),
    detail: escapeDiagnostic(detail),
    code: escapeDiagnostic(code),
  };
}

function escapeDiagnostic(value) {
  const escaped = String(value)
    .replaceAll(/[^\x20-\x7e]/g, (char) => String.raw`\u${char.codePointAt(0).toString(16).padStart(4, "0")}`)
    .slice(0, MAX_DETAIL_LENGTH);
  return escaped.length === 0 ? "<empty>" : escaped;
}

function compareViolations(left, right) {
  return byCodePoint(
    `${left.artifact}\u0000${left.detail}\u0000${left.code}`,
    `${right.artifact}\u0000${right.detail}\u0000${right.code}`,
  );
}

async function walkSourceTree(directory) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return [];
  }
  const result = [];
  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      const nested = await walkSourceTree(entryPath);
      for (const file of nested) result.push(file);
    } else if (entry.isFile()) {
      result.push(entryPath);
    }
  }
  return result;
}
