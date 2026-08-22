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
  const specifiers = [];
  const failures = [];
  const freeIdentifiers = new Set();

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
      identifiers: [],
      failures: [violation(artifactPath, basename(artifactPath), "parse-failure")],
    };
  }

  if (sourceFile.parseDiagnostics && sourceFile.parseDiagnostics.length > 0) {
    return {
      specifiers,
      identifiers: [],
      failures: [violation(artifactPath, basename(artifactPath), "parse-failure")],
    };
  }

  const scopes = [new Set()];

  function currentScope() {
    return scopes[scopes.length - 1];
  }

  function bindName(name) {
    if (typeof name === "string" && name.length > 0) {
      currentScope().add(name);
    }
  }

  function bindPattern(node) {
    if (!node) return;
    if (ts.isIdentifier(node)) {
      bindName(node.text);
      return;
    }
    if (ts.isBindingElement(node)) {
      bindPattern(node.name);
      return;
    }
    if (ts.isObjectBindingPattern(node) || ts.isArrayBindingPattern(node)) {
      for (const element of node.elements) {
        if (!ts.isOmittedExpression(element)) {
          bindPattern(element);
        }
      }
    }
  }

  function isBound(name) {
    for (let i = scopes.length - 1; i >= 0; i -= 1) {
      if (scopes[i].has(name)) return true;
    }
    return false;
  }

  function hoistDeclarations(statements) {
    if (!statements) return;
    for (const stmt of statements) {
      hoistStatement(stmt);
    }
  }

  function hoistStatement(stmt) {
    if (ts.isFunctionDeclaration(stmt) && stmt.name) {
      bindName(stmt.name.text);
    } else if (ts.isClassDeclaration(stmt) && stmt.name) {
      bindName(stmt.name.text);
    } else if (ts.isImportDeclaration(stmt) && stmt.importClause) {
      hoistImportClause(stmt.importClause);
    } else if (ts.isImportEqualsDeclaration(stmt) && stmt.name) {
      bindName(stmt.name.text);
    } else if (ts.isVariableStatement(stmt)) {
      for (const decl of stmt.declarationList.declarations) {
        bindPattern(decl.name);
      }
    }
  }

  function hoistImportClause(clause) {
    if (clause.name) bindName(clause.name.text);
    if (!clause.namedBindings) return;
    if (ts.isNamespaceImport(clause.namedBindings)) {
      bindName(clause.namedBindings.name.text);
    } else if (ts.isNamedImports(clause.namedBindings)) {
      for (const element of clause.namedBindings.elements) {
        bindName(element.name.text);
      }
    }
  }

  function checkSpecifierNode(node) {
    if (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) {
      if (node.moduleSpecifier) {
        collectLiteralSpecifier(node.moduleSpecifier, "<static-import>");
      }
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      collectLiteralSpecifier(node.moduleReference.expression, "<import-equals>");
    } else if (ts.isCallExpression(node)) {
      checkCallSpecifier(node);
    }
  }

  function collectLiteralSpecifier(node, marker) {
    if (node && ts.isStringLiteral(node)) {
      specifiers.push(node.text);
    } else {
      failures.push(violation(artifactPath, marker, "dynamic-specifier"));
    }
  }

  function checkCallSpecifier(node) {
    if (node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      collectLiteralSpecifier(node.arguments[0], "<dynamic-import>");
    } else if (ts.isIdentifier(node.expression) && node.expression.text === "require") {
      collectLiteralSpecifier(node.arguments[0], "<dynamic-require>");
    }
  }

  function walkFunctionLike(node) {
    scopes.push(new Set());
    if (ts.isFunctionExpression(node) && node.name) {
      bindName(node.name.text);
    }
    for (const param of node.parameters) {
      bindPattern(param.name);
      if (param.initializer) walk(param.initializer);
    }
    if (node.body) {
      if (ts.isBlock(node.body)) {
        hoistDeclarations(node.body.statements);
      }
      walk(node.body);
    }
    scopes.pop();
  }

  function walkCatchClause(node) {
    scopes.push(new Set());
    if (node.variableDeclaration) {
      bindPattern(node.variableDeclaration.name);
    }
    if (node.block) {
      hoistDeclarations(node.block.statements);
      walk(node.block);
    }
    scopes.pop();
  }

  function walkBlock(node) {
    scopes.push(new Set());
    hoistDeclarations(node.statements);
    ts.forEachChild(node, walk);
    scopes.pop();
  }

  function walkLoop(node) {
    scopes.push(new Set());
    if (node.initializer && ts.isVariableDeclarationList(node.initializer)) {
      for (const decl of node.initializer.declarations) {
        bindPattern(decl.name);
      }
    }
    ts.forEachChild(node, walk);
    scopes.pop();
  }

  function walk(node) {
    if (!node || isTypeNode(node)) return;

    checkSpecifierNode(node);

    if (isFunctionLike(node)) {
      walkFunctionLike(node);
      return;
    }

    if (ts.isCatchClause(node)) {
      walkCatchClause(node);
      return;
    }

    if (ts.isBlock(node)) {
      walkBlock(node);
      return;
    }

    if (ts.isForStatement(node) || ts.isForInStatement(node) || ts.isForOfStatement(node)) {
      walkLoop(node);
      return;
    }

    if (ts.isVariableDeclaration(node)) {
      bindPattern(node.name);
      if (node.initializer) walk(node.initializer);
      return;
    }

    if (ts.isIdentifier(node) && isValueIdentifier(node)) {
      const name = node.text;
      if (!isBound(name)) {
        freeIdentifiers.add(name);
      }
    }

    ts.forEachChild(node, walk);
  }

  hoistDeclarations(sourceFile.statements);
  walk(sourceFile);

  return {
    specifiers,
    identifiers: Array.from(freeIdentifiers).sort(byCodePoint),
    failures,
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

  for (const specifier of collected.specifiers) {
    classifySpecifier(specifier, artifactPath, role, result);
  }

  for (const identifier of collected.identifiers) {
    classifyIdentifier(identifier, artifactPath, role, roleInventory, result);
  }
}

function classifySpecifier(specifier, artifactPath, role, result) {
  if (specifier.startsWith(".")) return;
  if (role.specifiers.includes(specifier)) return;
  result.violations.push(violation(artifactPath, specifier, "undeclared-specifier"));
}

function classifyIdentifier(identifier, artifactPath, role, roleInventory, result) {
  if (LANGUAGE_GLOBALS.has(identifier)) return;
  if (Object.hasOwn(role.hostGlobals, identifier)) {
    const current = roleInventory.hostGlobals.get(identifier) ?? 0;
    roleInventory.hostGlobals.set(identifier, current + 1);
    return;
  }
  result.violations.push(violation(artifactPath, identifier, "undeclared-global"));
}

function isTypeNode(node) {
  if (!node) return false;
  if (ts.isExpressionWithTypeArguments(node)) {
    const parent = node.parent;
    if (parent && ts.isHeritageClause(parent) && parent.token === ts.SyntaxKind.ExtendsKeyword) {
      return false;
    }
  }
  if (ts.isTypeNode(node)) return true;
  if (ts.isTypeElement(node)) return true;
  if (ts.isInterfaceDeclaration(node)) return true;
  if (ts.isTypeAliasDeclaration(node)) return true;
  if (ts.isTypeParameterDeclaration(node)) return true;
  if (ts.isExportDeclaration(node) && node.isTypeOnly) return true;
  if (ts.isImportDeclaration(node) && node.importClause?.isTypeOnly) return true;
  if (ts.isImportEqualsDeclaration(node) && node.isTypeOnly) return true;
  if (ts.isExportSpecifier(node) && node.isTypeOnly) return true;
  if (ts.isImportSpecifier(node) && node.isTypeOnly) return true;
  return false;
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

function isValueIdentifier(node) {
  const parent = node.parent;
  if (!parent) return true;

  if (ts.isExportSpecifier(parent)) {
    const exportDecl = parent.parent?.parent;
    if (exportDecl && ts.isExportDeclaration(exportDecl) && exportDecl.moduleSpecifier) {
      return false;
    }
    if (parent.propertyName && parent.name === node) return false;
    return true;
  }

  if (isDeclarationName(parent, node)) return false;
  if (isPropertyPosition(parent, node)) return false;
  if (isLabelReference(parent, node)) return false;

  return true;
}

function isDeclarationName(parent, node) {
  if (ts.isVariableDeclaration(parent) && parent.name === node) return true;
  if (ts.isFunctionDeclaration(parent) && parent.name === node) return true;
  if (ts.isFunctionExpression(parent) && parent.name === node) return true;
  if (ts.isClassDeclaration(parent) && parent.name === node) return true;
  if (ts.isClassExpression(parent) && parent.name === node) return true;
  if (ts.isParameter(parent) && parent.name === node) return true;
  if (ts.isPropertyDeclaration(parent) && parent.name === node) return true;
  if (ts.isPropertySignature(parent) && parent.name === node) return true;
  if (ts.isMethodDeclaration(parent) && parent.name === node) return true;
  if (ts.isMethodSignature(parent) && parent.name === node) return true;
  if (ts.isGetAccessor(parent) && parent.name === node) return true;
  if (ts.isSetAccessor(parent) && parent.name === node) return true;
  if (ts.isEnumDeclaration(parent) && parent.name === node) return true;
  if (ts.isEnumMember(parent) && parent.name === node) return true;
  if (ts.isTypeAliasDeclaration(parent) && parent.name === node) return true;
  if (ts.isInterfaceDeclaration(parent) && parent.name === node) return true;
  if (ts.isTypeParameterDeclaration(parent) && parent.name === node) return true;
  if (ts.isModuleDeclaration(parent) && parent.name === node) return true;
  if (ts.isImportClause(parent) && parent.name === node) return true;
  if (ts.isImportSpecifier(parent) && (parent.name === node || parent.propertyName === node)) return true;
  if (ts.isNamespaceImport(parent) && parent.name === node) return true;
  if (ts.isImportEqualsDeclaration(parent) && parent.name === node) return true;
  if (ts.isBindingElement(parent) && parent.name === node) return true;
  return false;
}

function isPropertyPosition(parent, node) {
  if (ts.isPropertyAccessExpression(parent) && parent.name === node) return true;
  if (ts.isPropertyAssignment(parent) && parent.name === node) return true;
  if (ts.isQualifiedName(parent) && parent.right === node) return true;
  if (ts.isBindingElement(parent) && parent.propertyName === node) return true;
  return false;
}

function isLabelReference(parent, node) {
  if (ts.isBreakStatement(parent) && parent.label === node) return true;
  if (ts.isContinueStatement(parent) && parent.label === node) return true;
  if (ts.isLabeledStatement(parent) && parent.label === node) return true;
  return false;
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
  if (typeof value !== "string") return String(value);
  const truncated = value.length > MAX_DETAIL_LENGTH ? `${value.slice(0, MAX_DETAIL_LENGTH)}...` : value;
  return truncated.replace(/[\u0000-\u001f\u007f-\u009f]/g, (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`);
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
    const path = resolve(directory, entry.name);
    if (entry.isDirectory()) {
      result.push(...await walkSourceTree(path));
    } else if (entry.isFile()) {
      result.push(path);
    }
  }
  return result;
}
