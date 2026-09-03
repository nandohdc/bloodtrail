import { readdir, readFile } from "node:fs/promises";
import { basename, relative, resolve, sep } from "node:path";
import ts from "typescript";

import { byCodePoint } from "./verification-helpers.mjs";

const CODE_ARTIFACT = /\.(?:[cm]?[jt]s)$/;
const MAX_VIOLATIONS = 50;

// `globalThis`, `eval`, and `Function` are omitted deliberately. Each one
// resolves a capability from a string at run time, which defeats the static
// classification this gate performs: `Function("return pro" + "cess")()` reaches
// the same host object as a bare `process` reference. Admitting them here would
// leave the ban on `globalThis` cosmetic, so all three are reported as
// undeclared globals wherever they appear.
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

// ImportClause is absent deliberately: TypeScript 5.9 deprecated its
// `isTypeOnly` in favour of `phaseModifier`, so it is resolved separately by
// importClauseIsTypeOnly(). The kinds below still carry a supported
// `isTypeOnly`.
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
    duplicateCopyProbe: Object.freeze({
      name: "duplicateCopyProbe",
      prefix: "src/duplicate-copy-probe.ts",
      hostGlobals: Object.freeze({
        globalThis: Object.freeze({
          name: "globalThis",
          reason: "Anchors the diagnostic-only duplicate-copy sibling probe channel under a Symbol.for key (issue #79). The channel carries boolean answers only — never registry membership, brands, values, or authority. The total globalThis ban stays in force for every other artifact.",
          boundary: "duplicate-copy sibling probe channel",
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

function checkCallSpecifiers(node, collector) {
  if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
    collectLiteralSpecifier(node.arguments[0], "<dynamic-import>", collector);
    return;
  }
  if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
    collectLiteralSpecifier(node.arguments[0], "<dynamic-require>", collector);
  }
}

function walkFunction(node, collector) {
  // A computed method name and a decorator expression are evaluated in the
  // enclosing scope, so they are walked before the function scope is pushed.
  // walkFunction never reaches ts.forEachChild, so without this they were
  // dropped: `class C { [process.pid]() {} }` reported nothing.
  walkComputedName(node.name, collector);
  walkDecorators(node.modifiers, collector);
  collector.scopes.push(new Set());
  bindFunctionSelfName(node, collector);
  walkParameters(node.parameters, collector);
  if (node.body) {
    if (ts.isBlock(node.body)) {
      hoistDeclarations(node.body.statements, collector);
      for (const stmt of node.body.statements) walkNode(stmt, collector);
    } else {
      walkNode(node.body, collector);
    }
  }
  collector.scopes.pop();
}

function walkDecorators(modifiers, collector) {
  if (!modifiers) return;
  for (const modifier of modifiers) {
    if (ts.isDecorator(modifier)) walkNode(modifier.expression, collector);
  }
}

function bindFunctionSelfName(node, collector) {
  if (ts.isFunctionExpression(node) && node.name) {
    collector.bindName(node.name.text);
  }
}

function walkParameters(parameters, collector) {
  for (const param of parameters) {
    collector.bindPattern(param.name);
    walkPatternDefaults(param.name, collector);
    if (param.initializer) walkNode(param.initializer, collector);
  }
}

function walkCatch(node, collector) {
  collector.scopes.push(new Set());
  if (node.variableDeclaration) {
    collector.bindPattern(node.variableDeclaration.name);
    walkPatternDefaults(node.variableDeclaration.name, collector);
  }
  if (node.block) {
    hoistDeclarations(node.block.statements, collector);
    for (const stmt of node.block.statements) walkNode(stmt, collector);
  }
  collector.scopes.pop();
}

function walkBlock(node, collector) {
  collector.scopes.push(new Set());
  hoistDeclarations(node.statements, collector);
  for (const stmt of node.statements) walkNode(stmt, collector);
  collector.scopes.pop();
}

function walkLoop(node, collector) {
  collector.scopes.push(new Set());
  walkLoopInitializer(node.initializer, collector);
  // for-of/for-in carry `expression`; the C-style form carries `condition` and
  // `incrementor`. Walking only `statement` left every header a blind spot, so
  // `for (const m of [await import("x")])` reached neither the specifier check
  // nor the global check.
  if (node.expression) walkNode(node.expression, collector);
  if (node.condition) walkNode(node.condition, collector);
  if (node.incrementor) walkNode(node.incrementor, collector);
  if (node.statement) walkNode(node.statement, collector);
  collector.scopes.pop();
}

function walkLoopInitializer(initializer, collector) {
  if (!initializer) return;
  if (!ts.isVariableDeclarationList(initializer)) {
    // `for (i = 0; ...)` / `for (existing of xs)` — an assignment target, which
    // is a value reference rather than a binding.
    walkNode(initializer, collector);
    return;
  }
  hoistVariables(initializer.declarations, collector);
  for (const declaration of initializer.declarations) {
    walkPatternDefaults(declaration.name, collector);
    if (declaration.initializer) walkNode(declaration.initializer, collector);
  }
}

function walkVariable(node, collector) {
  collector.bindPattern(node.name);
  walkPatternDefaults(node.name, collector);
  if (node.initializer) walkNode(node.initializer, collector);
}

// bindPattern binds the names a pattern introduces; the expressions *inside* the
// pattern — `= process.env.HOME` defaults and computed `[process.pid]:` keys —
// are ordinary value references and have to be walked separately.
function walkPatternDefaults(node, collector) {
  if (!node) return;
  if (ts.isBindingElement(node)) {
    walkBindingElementDefaults(node, collector);
    return;
  }
  if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
    walkBindingPatternElements(node.elements, collector);
  }
}

function walkBindingElementDefaults(node, collector) {
  walkComputedName(node.propertyName, collector);
  walkPatternDefaults(node.name, collector);
  if (node.initializer) walkNode(node.initializer, collector);
}

function walkBindingPatternElements(elements, collector) {
  for (const element of elements) {
    if (!ts.isOmittedExpression(element)) walkPatternDefaults(element, collector);
  }
}

function walkComputedName(nameNode, collector) {
  if (nameNode && ts.isComputedPropertyName(nameNode)) {
    walkNode(nameNode.expression, collector);
  }
}

function walkIdentifier(node, collector) {
  if (isValueIdentifier(node)) {
    const name = node.text;
    if (!collector.isBound(name)) {
      collector.freeIdentifiers.add(name);
    }
  }
}

function walkNode(node, collector) {
  if (!node || isTypeNode(node)) return;

  checkSpecifiers(node, collector);

  if (isFunctionLike(node)) {
    walkFunction(node, collector);
    return;
  }
  if (ts.isCatchClause(node)) {
    walkCatch(node, collector);
    return;
  }
  if (ts.isBlock(node)) {
    walkBlock(node, collector);
    return;
  }
  if (isLoopNode(node)) {
    walkLoop(node, collector);
    return;
  }
  if (ts.isVariableDeclaration(node)) {
    walkVariable(node, collector);
    return;
  }
  if (ts.isIdentifier(node)) {
    walkIdentifier(node, collector);
  }

  ts.forEachChild(node, (child) => walkNode(child, collector));
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
  hoistDeclarations(sourceFile.statements, collector);
  walkNode(sourceFile, collector);

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

// `tree` is the already-walked source tree. The caller walks src/ once and
// passes it through, so the gate reads the same tree both stages saw and does
// not re-traverse and re-read every artifact.
export async function inspectPlatformCoupling({ packageRoot, sourceRoot, tree }) {
  const sourceTree = tree ?? (await walkSourceTree(sourceRoot));
  const artifacts = sourceTree.files
    .map((file) => toPackagePath(packageRoot, file))
    .filter((path) => CODE_ARTIFACT.test(path))
    .sort(byCodePoint);

  const result = {
    inspected: artifacts.length,
    references: 0,
    inventory: {
      authored: { artifacts: 0, references: 0, hostGlobals: new Map() },
      duplicateCopyProbe: { artifacts: 0, references: 0, hostGlobals: new Map() },
      generated: { artifacts: 0, references: 0, hostGlobals: new Map() },
    },
    violations: [],
  };

  for (const failure of sourceTree.failures) {
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

function roleForArtifact(artifactPath) {
  if (artifactPath.startsWith(PLATFORM_COUPLING_POLICY.roles.generated.prefix)) {
    return PLATFORM_COUPLING_POLICY.roles.generated;
  }
  if (artifactPath.startsWith(PLATFORM_COUPLING_POLICY.roles.duplicateCopyProbe.prefix)) {
    return PLATFORM_COUPLING_POLICY.roles.duplicateCopyProbe;
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

// Returns { files, failures }. Anything the walk cannot classify becomes a
// failure rather than an omission: swallowing a readdir error dropped the whole
// subtree from inspection while the gate still reported success, and skipping
// symlinks left a linked source file uncounted, unread, and unreported even
// though tsc follows it into dist/. src/ holds only real files and directories,
// so a link is rejected instead of followed — no cycle detection needed.
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
