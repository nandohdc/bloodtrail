import { readdir, readFile } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import ts from "typescript";

import { byCodePoint } from "./verification-helpers.mjs";

const CODE_ARTIFACT = /\.(?:[cm]?[jt]s)$/;
const MAX_VIOLATIONS = 50;

const LANGUAGE_GLOBALS = new Set([
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
]);

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

const FUNCTION_LIKE_KINDS = new Set([
  ts.SyntaxKind.FunctionDeclaration,
  ts.SyntaxKind.FunctionExpression,
  ts.SyntaxKind.ArrowFunction,
  ts.SyntaxKind.MethodDeclaration,
  ts.SyntaxKind.Constructor,
  ts.SyntaxKind.GetAccessor,
  ts.SyntaxKind.SetAccessor,
]);

const LOOP_KINDS = new Set([
  ts.SyntaxKind.ForStatement,
  ts.SyntaxKind.ForInStatement,
  ts.SyntaxKind.ForOfStatement,
]);

const TYPE_ONLY_KINDS = new Set([
  ts.SyntaxKind.ExportDeclaration,
  ts.SyntaxKind.ExportSpecifier,
  ts.SyntaxKind.ImportSpecifier,
  ts.SyntaxKind.ImportClause,
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

class ReferenceCollector {
  constructor(artifactPath) {
    this.artifactPath = artifactPath;
    this.specifiers = [];
    this.failures = [];
    this.freeIdentifiers = new Set();
    this.scopes = [new Set()];
  }

  currentScope() {
    return this.scopes[this.scopes.length - 1];
  }

  bindName(name) {
    if (typeof name === "string" && name.length > 0) {
      this.currentScope().add(name);
    }
  }

  bindPattern(node) {
    if (!node) return;
    if (ts.isIdentifier(node)) {
      this.bindName(node.text);
      return;
    }
    if (ts.isBindingElement(node)) {
      this.bindPattern(node.name);
      return;
    }
    if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
      for (const element of node.elements) {
        if (!ts.isOmittedExpression(element)) {
          this.bindPattern(element);
        }
      }
    }
  }

  isBound(name) {
    for (let i = this.scopes.length - 1; i >= 0; i -= 1) {
      if (this.scopes[i].has(name)) return true;
    }
    return false;
  }

  hoistDeclarations(statements) {
    if (!statements) return;
    for (const stmt of statements) {
      this.hoistStatement(stmt);
    }
  }

  hoistStatement(stmt) {
    if (HOISTED_NAME_KINDS.has(stmt.kind)) {
      this.bindDeclaredName(stmt.name);
      return;
    }
    if (ts.isImportDeclaration(stmt)) {
      this.hoistImportDeclaration(stmt);
      return;
    }
    if (ts.isVariableStatement(stmt)) {
      this.hoistVariables(stmt.declarationList.declarations);
    }
  }

  bindDeclaredName(nameNode) {
    if (nameNode && ts.isIdentifier(nameNode)) {
      this.bindName(nameNode.text);
    }
  }

  hoistImportDeclaration(stmt) {
    if (stmt.importClause) this.hoistImportClause(stmt.importClause);
  }

  hoistVariables(declarations) {
    for (const decl of declarations) {
      this.bindPattern(decl.name);
    }
  }

  hoistImportClause(clause) {
    if (clause.name) this.bindName(clause.name.text);
    const bindings = clause.namedBindings;
    if (!bindings) return;
    if (ts.isNamespaceImport(bindings)) {
      this.bindName(bindings.name.text);
      return;
    }
    if (ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        this.bindName(element.name.text);
      }
    }
  }

  checkSpecifiers(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) {
        this.collectLiteralSpecifier(node.moduleSpecifier, "<static-import>");
      }
      return;
    }
    if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      this.collectLiteralSpecifier(node.moduleReference.expression, "<import-equals>");
      return;
    }
    if (ts.isCallExpression(node)) {
      this.checkCallSpecifiers(node);
    }
  }

  collectLiteralSpecifier(node, marker) {
    if (node && ts.isStringLiteral(node)) {
      this.specifiers.push(node.text);
    } else {
      this.failures.push(violation(this.artifactPath, marker, "dynamic-specifier"));
    }
  }

  checkCallSpecifiers(node) {
    if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      this.collectLiteralSpecifier(node.arguments[0], "<dynamic-import>");
      return;
    }
    if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
      this.collectLiteralSpecifier(node.arguments[0], "<dynamic-require>");
    }
  }

  walkFunction(node) {
    this.scopes.push(new Set());
    this.bindFunctionSelfName(node);
    this.walkParameters(node.parameters);
    if (node.body) {
      if (ts.isBlock(node.body)) {
        this.hoistDeclarations(node.body.statements);
        for (const stmt of node.body.statements) this.walk(stmt);
      } else {
        this.walk(node.body);
      }
    }
    this.scopes.pop();
  }

  bindFunctionSelfName(node) {
    if (ts.isFunctionExpression(node) && node.name) {
      this.bindName(node.name.text);
    }
  }

  walkParameters(parameters) {
    for (const param of parameters) {
      this.bindPattern(param.name);
      if (param.initializer) this.walk(param.initializer);
    }
  }

  walkCatch(node) {
    this.scopes.push(new Set());
    if (node.variableDeclaration) {
      this.bindPattern(node.variableDeclaration.name);
    }
    if (node.block) {
      this.hoistDeclarations(node.block.statements);
      for (const stmt of node.block.statements) this.walk(stmt);
    }
    this.scopes.pop();
  }

  walkBlock(node) {
    this.scopes.push(new Set());
    this.hoistDeclarations(node.statements);
    for (const stmt of node.statements) this.walk(stmt);
    this.scopes.pop();
  }

  walkLoop(node) {
    this.scopes.push(new Set());
    if (node.initializer && ts.isVariableDeclarationList(node.initializer)) {
      this.hoistVariables(node.initializer.declarations);
    }
    if (node.statement) this.walk(node.statement);
    this.scopes.pop();
  }

  walkVariable(node) {
    this.bindPattern(node.name);
    if (node.initializer) this.walk(node.initializer);
  }

  walkIdentifier(node) {
    if (isValueIdentifier(node)) {
      const name = node.text;
      if (!this.isBound(name)) {
        this.freeIdentifiers.add(name);
      }
    }
  }

  walk(node) {
    if (!node || isTypeNode(node)) return;

    this.checkSpecifiers(node);

    if (isFunctionLike(node)) {
      this.walkFunction(node);
      return;
    }
    if (ts.isCatchClause(node)) {
      this.walkCatch(node);
      return;
    }
    if (ts.isBlock(node)) {
      this.walkBlock(node);
      return;
    }
    if (isLoopNode(node)) {
      this.walkLoop(node);
      return;
    }
    if (ts.isVariableDeclaration(node)) {
      this.walkVariable(node);
      return;
    }
    if (ts.isIdentifier(node)) {
      this.walkIdentifier(node);
    }

    ts.forEachChild(node, (child) => this.walk(child));
  }
}

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

  const collector = new ReferenceCollector(artifactPath);
  collector.hoistDeclarations(sourceFile.statements);
  collector.walk(sourceFile);

  return {
    specifiers: collector.specifiers,
    identifiers: Array.from(collector.freeIdentifiers).sort(byCodePoint),
    failures: collector.failures,
  };
}

function parseFailureResult(artifactPath) {
  return {
    specifiers: [],
    identifiers: [],
    failures: [violation(artifactPath, basename(artifactPath), "parse-failure")],
  };
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
  if (TYPE_ONLY_KINDS.has(node.kind)) {
    return Boolean(node.isTypeOnly);
  }
  if (ts.isImportDeclaration(node)) {
    return Boolean(node.importClause?.isTypeOnly);
  }
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
  return LOOP_KINDS.has(node.kind);
}

function isFunctionLike(node) {
  return FUNCTION_LIKE_KINDS.has(node.kind);
}

function isReExport(specifier) {
  const exportDecl = specifier.parent?.parent;
  return Boolean(exportDecl && ts.isExportDeclaration(exportDecl) && exportDecl.moduleSpecifier);
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
    return "name" in parent && parent.name === node;
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
  if (ts.isPropertyAccessExpression(parent) || ts.isPropertyAssignment(parent)) {
    return parent.name === node;
  }
  if (ts.isQualifiedName(parent)) {
    return parent.right === node;
  }
  if (ts.isBindingElement(parent)) {
    return parent.propertyName === node;
  }
  return false;
}

function isLabelReference(parent, node) {
  if (!LABEL_KINDS.has(parent.kind)) return false;
  return "label" in parent && parent.label === node;
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
  return { artifact, detail, code };
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
