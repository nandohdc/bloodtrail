import { readdir, readFile } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import ts from "typescript";

import { byCodePoint } from "./verification-helpers.mjs";

const CODE_ARTIFACT = /\.(?:[cm]?[jt]s)$/;
const MAX_VIOLATIONS = 50;

// `globalThis`, `eval`, and `Function` are omitted deliberately. Each one
// resolves a capability from a string at run time, which defeats static
// classification. All three are reported as undeclared globals wherever they appear.
const LANGUAGE_GLOBALS = new Set([
  "Array", "ArrayBuffer", "AsyncFunction", "AsyncGenerator", "AsyncGeneratorFunction",
  "AsyncIterator", "Atomics", "BigInt", "BigInt64Array", "BigUint64Array", "Boolean",
  "DataView", "Date", "Error", "EvalError", "Float16Array", "Float32Array", "Float64Array",
  "Generator", "GeneratorFunction", "Int8Array", "Int16Array", "Int32Array",
  "Intl", "Iterator", "JSON", "Map", "Math", "Number", "Object", "Promise", "Proxy",
  "RangeError", "ReferenceError", "Reflect", "RegExp", "Set", "SharedArrayBuffer",
  "String", "Symbol", "SyntaxError", "TypeError", "URIError", "Uint8Array",
  "Uint8ClampedArray", "Uint16Array", "Uint32Array", "WeakMap", "WeakRef", "WeakSet",
  "decodeURI", "decodeURIComponent", "encodeURI", "encodeURIComponent", "escape",
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
]);

export const PLATFORM_COUPLING_POLICY = Object.freeze({
  languageGlobals: LANGUAGE_GLOBALS,
  roles: Object.freeze({
    authored: Object.freeze({
      name: "authored",
      prefix: "src/",
      hostGlobals: Object.freeze({}),
      specifiers: Object.freeze([
        "node:async_hooks",
        "node:buffer",
        "node:crypto",
        "node:timers",
        "@bloodtrail/security-audit-sdk-core",
      ]),
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
    return this.scopes.at(-1);
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

  noteReference(name) {
    if (!this.isBound(name)) {
      this.freeIdentifiers.add(name);
    }
  }

  isBound(name) {
    for (let i = this.scopes.length - 1; i >= 0; i -= 1) {
      if (this.scopes[i].has(name)) return true;
    }
    return false;
  }
}

function hoistDeclarations(statements, collector) {
  if (!statements) return;
  for (const stmt of statements) {
    hoistStatement(stmt, collector);
  }
}

function hoistStatement(stmt, collector) {
  if (HOISTED_NAME_KINDS.has(stmt.kind)) {
    bindDeclaredName(stmt.name, collector);
    return;
  }
  if (ts.isImportDeclaration(stmt)) {
    hoistImportDeclaration(stmt, collector);
    return;
  }
  if (ts.isVariableStatement(stmt)) {
    hoistVariables(stmt.declarationList.declarations, collector);
  }
}

function bindDeclaredName(nameNode, collector) {
  if (nameNode && ts.isIdentifier(nameNode)) {
    collector.bindName(nameNode.text);
  }
}

function hoistImportDeclaration(stmt, collector) {
  if (stmt.importClause) hoistImportClause(stmt.importClause, collector);
}

function hoistVariables(declarations, collector) {
  for (const decl of declarations) {
    collector.bindPattern(decl.name);
  }
}

function hoistImportClause(clause, collector) {
  if (clause.name) collector.bindName(clause.name.text);
  const bindings = clause.namedBindings;
  if (!bindings) return;
  if (ts.isNamespaceImport(bindings)) {
    collector.bindName(bindings.name.text);
    return;
  }
  if (ts.isNamedImports(bindings)) {
    for (const element of bindings.elements) {
      collector.bindName(element.name.text);
    }
  }
}

function checkSpecifiers(node, collector) {
  if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
    if (node.moduleSpecifier) {
      collectLiteralSpecifier(node.moduleSpecifier, "<static-import>", collector);
    }
    return;
  }
  if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
    collectLiteralSpecifier(node.moduleReference.expression, "<import-equals>", collector);
    return;
  }
  if (ts.isCallExpression(node)) {
    checkCallSpecifiers(node, collector);
  }
}

function collectLiteralSpecifier(node, marker, collector) {
  if (node && ts.isStringLiteral(node)) {
    collector.specifiers.push(node.text);
  } else {
    collector.failures.push(violation(collector.artifactPath, marker, "dynamic-specifier"));
  }
}

function callSpecifierMarker(node) {
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) return "<dynamic-import>";
  if (ts.isIdentifier(node.expression) && node.expression.text === "require") return "<require-reference>";
  return null;
}

function checkCallSpecifiers(node, collector) {
  const marker = callSpecifierMarker(node);
  if (marker === null) return;
  const [specifier] = node.arguments;
  collectLiteralSpecifier(specifier, marker, collector);
}

function enterBlock(node, collector, visitChildren) {
  collector.scopes.push(new Set());
  if ("statements" in node && Array.isArray(node.statements)) {
    hoistDeclarations(node.statements, collector);
  }
  visitChildren(node);
  collector.scopes.pop();
}

function enterFunction(node, collector, visitChildren) {
  collector.scopes.push(new Set());
  for (const param of node.parameters) {
    collector.bindPattern(param.name);
  }
  if (node.body) {
    if (ts.isBlock(node.body)) {
      hoistDeclarations(node.body.statements, collector);
    }
    visitChildren(node.body);
  }
  collector.scopes.pop();
}

function enterCatchClause(node, collector, visitChildren) {
  collector.scopes.push(new Set());
  if (node.variableDeclaration) {
    collector.bindPattern(node.variableDeclaration.name);
  }
  hoistDeclarations(node.block.statements, collector);
  visitChildren(node.block);
  collector.scopes.pop();
}

// Every kind in `LOOP_KINDS` carries an `initializer`; only `for` makes it optional.
// A `for (const x of ...)` head declares into the loop scope, an expression head does not.
function enterForStatements(node, collector, visitChildren) {
  collector.scopes.push(new Set());
  const { initializer } = node;
  if (initializer && ts.isVariableDeclarationList(initializer)) {
    hoistVariables(initializer.declarations, collector);
  }
  visitChildren(node);
  collector.scopes.pop();
}

// Each entrant pushes a lexical scope, binds whatever its node head declares, walks
// its children, then pops. Returning the function rather than calling it keeps the
// traversal in `collectCouplingReferences` flat.
function scopeEntrantFor(node) {
  if (ts.isBlock(node) || ts.isModuleBlock(node)) return enterBlock;
  if (isFunctionLike(node)) return enterFunction;
  if (ts.isCatchClause(node)) return enterCatchClause;
  if (isLoopNode(node)) return enterForStatements;
  return null;
}

export function collectCouplingReferences(artifactPath, sourceText) {
  const collector = new ReferenceCollector(artifactPath);
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
      specifiers: [],
      identifiers: [],
      failures: [violation(artifactPath, basename(artifactPath), "parse-failure")],
    };
  }

  function visit(node) {
    checkSpecifiers(node, collector);

    if (isTypeNode(node)) {
      return;
    }

    if (ts.isIdentifier(node) && isValueIdentifier(node)) {
      collector.noteReference(node.text);
      return;
    }

    if (ts.isSourceFile(node)) {
      hoistDeclarations(node.statements, collector);
      ts.forEachChild(node, visit);
      return;
    }

    const enterScope = scopeEntrantFor(node);
    if (enterScope) {
      enterScope(node, collector, (child) => ts.forEachChild(child, visit));
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);

  return {
    specifiers: collector.specifiers,
    identifiers: Array.from(collector.freeIdentifiers).sort(byCodePoint),
    failures: collector.failures,
  };
}

export async function inspectPlatformCoupling({ packageRoot, sourceRoot, tree }) {
  const artifacts = tree.files
    .map((filePath) => toPackagePath(packageRoot, filePath))
    .filter((path) => CODE_ARTIFACT.test(path))
    .sort(byCodePoint);

  const inventory = {
    authored: { artifacts: 0, references: 0, hostGlobals: new Map() },
  };
  let result = { inspected: artifacts.length, references: 0, violations: [], inventory };

  for (const failure of tree.failures) {
    const artifact = toPackagePath(packageRoot, failure.path);
    result.violations.push(violation(artifact, basename(failure.path), failure.code));
  }

  if (artifacts.length === 0) {
    result.violations.push(violation("<inventory>", "<none>", "empty-inventory"));
  } else {
    for (const artifactPath of artifacts) {
      await inspectArtifact({ packageRoot, artifactPath, result });
    }
  }

  result.violations.sort(compareViolations);
  if (result.violations.length > MAX_VIOLATIONS) {
    result.violations = result.violations.slice(0, MAX_VIOLATIONS);
  }
  return result;
}

function toPackagePath(packageRoot, absolutePath) {
  return relative(packageRoot, absolutePath).split(sep).join("/");
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
  if (role.specifiers.includes(specifier) || specifier.startsWith("@bloodtrail/security-audit-sdk-core/")) return;
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

function importClauseIsTypeOnly(clause) {
  return clause?.phaseModifier === ts.SyntaxKind.TypeKeyword;
}

function isTypeOnlyDeclaration(node) {
  if (ts.isImportClause(node)) {
    return importClauseIsTypeOnly(node);
  }
  if (ts.isImportDeclaration(node)) {
    return importClauseIsTypeOnly(node.importClause);
  }
  if (TYPE_ONLY_KINDS.has(node.kind)) {
    return "isTypeOnly" in node && Boolean(node.isTypeOnly);
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
  if (!parent) return false;
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

function roleForArtifact(_artifactPath) {
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

export function escapeControlCharacter(character) {
  return String.raw`\u${character.codePointAt(0).toString(16).padStart(4, "0")}`;
}

export function bounded(value, maximum) {
  const text = String(value).replaceAll(
    /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g,
    escapeControlCharacter,
  );
  if (text.length <= maximum) return text;
  return `${text.slice(0, maximum - 3)}...`;
}

export function formatCouplingViolation({ artifact, detail, code }) {
  return `[platform-coupling:${bounded(code, 40)}] ${bounded(artifact, 90)}: ${bounded(detail, 120)}`;
}

export async function walkSourceTree(directory) {
  const tree = { files: [], failures: [] };
  await collectTreeEntries(directory, tree);
  return tree;
}

async function collectTreeEntries(directory, tree) {
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    tree.failures.push({ path: directory, code: "directory-read-failure" });
    return;
  }
  for (const entry of entries) {
    const entryPath = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      await collectTreeEntries(entryPath, tree);
    } else if (entry.isFile()) {
      tree.files.push(entryPath);
    } else {
      tree.failures.push({ path: entryPath, code: "unsupported-entry" });
    }
  }
}
