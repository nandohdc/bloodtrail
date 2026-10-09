import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";
import ts from "typescript";
import { declaredDocBlockNames, markdownDocumentNames, proseOutsideFencedBlocks } from "./evaluation-kit-doc-blocks.mjs";
import { assert, packageRoot } from "./verification-helpers.mjs";

// The installed kit's entry points. A kit document may name a function one of them exports, or a member of
// a type one of them exports.
const KIT_ENTRY_POINTS = Object.freeze([
  "@bloodtrail/security-audit-sdk-core",
  "@bloodtrail/security-audit-sdk-core/testing",
  "@bloodtrail/security-audit-sdk-node",
  "@bloodtrail/security-audit-collector",
]);

// The receiver names the documents give the SDK's objects, and the exported type each one stands for.
const DOCUMENTED_RECEIVERS = new Map([
  ["sdk", "SecurityAuditSdk"],
  ["audit", "SecurityAuditSdk"],
  ["op", "AuditOperationHandle"],
  ["sink", "AuditEventSink"],
  ["clock", "AuditClock"],
]);

const COMPILER_OPTIONS = {
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  target: ts.ScriptTarget.ES2024,
  strict: true,
  noEmit: true,
  skipLibCheck: true,
  typeRoots: [resolve(packageRoot, "node_modules/@types")],
  types: ["node"],
};

const TYPE_SYMBOLS = ts.SymbolFlags.Interface | ts.SymbolFlags.TypeAlias | ts.SymbolFlags.Class;

// Methods of the platform's own objects, such as an event timestamp's `toISOString()`.
const PLATFORM_METHODS = new Set(
  [Object, Array, String, Number, Date, Promise, Map, Set, RegExp, Error, URL, Headers, Response]
    .flatMap((type) => Object.entries(Object.getOwnPropertyDescriptors(type.prototype)))
    .filter(([, descriptor]) => typeof descriptor.value === "function")
    .map(([name]) => name),
);

// Inline code that is not a code reference: a literal, a path, a shell command or a module specifier.
const NOT_A_CODE_REFERENCE = /^(?:[{["'</]|(?:npm|npx|pnpm|node|git|shasum|tar|cd)\s|node:)/;
// A file name names a shipped file rather than an API.
const FILE_NAME_REFERENCE = /^[\w.-]+\.(?:md|json|sha256|ts|mts|cts|js|mjs|cjs|yaml|yml|tgz)$/;
// A `...` placeholder right before a closing bracket or a comma stands for elided content.
const ELLIPSIS_PLACEHOLDER = /\.\.\.(?=\s*[)\]},])/g;
const INLINE_CODE = /`([^`\r\n]+)`/g;

// Reviewed [document, span] pairs the check accepts without resolving. Each entry must match at least one
// span in its document; an entry that matches no span fails the check, named as stale.
export const REVIEWED_EXCEPTIONS = Object.freeze([
  // Names the Node.js platform declares, not the kit's packages.
  ["core-readme.md", "AsyncLocalStorage"],
  ["supported-and-planned.md", "AsyncLocalStorage"],
  // HTTP terms.
  ["wire-protocol.md", "Authorization"],
  ["error-catalog.md", "Bearer"],
  ["known-issues.md", "Bearer"],
  ["evaluation-guide.md", "OK"],
  // CloudEvents attribute names.
  ["error-catalog.md", "specversion"],
  ["error-catalog.md", "dataschema"],
  ["error-catalog.md", "time"],
  // Contract vocabulary the SDK does not declare as types: the mapping statuses,
  ["error-catalog.md", "exact"],
  ["error-catalog.md", "extended"],
  ["error-catalog.md", "lossy"],
  ["error-catalog.md", "transformed"],
  // the prohibited data keys,
  ["error-catalog.md", "user_password"],
  ["privacy.md", "token"],
  // and the extension namespaces and paths.
  ["error-catalog.md", "com.example.enrichment.v1"],
  ["error-catalog.md", "extensions.bloodtrail.audit.enrichment.v1"],
  ["error-catalog.md", "extensions.bloodtrail.audit.enrichment.v1.risk.level"],
  // Kit identity fields, which the SDK does not declare.
  ["evaluation-guide.md", "identity_format_version"],
  ["evaluation-guide.md", "distributable"],
  ["evaluation-guide.md", "artifacts"],
  ["evaluation-guide.md", "package_set_digest"],
  ["evaluation-guide.md", "manifest_digest"],
  // Package-manager and tool terms.
  ["known-issues.md", "npm"],
  ["known-issues.md", "pnpm"],
  ["quickstart.md", "pnpm"],
  ["error-catalog.md", "overrides"],
  ["known-issues.md", "overrides"],
  ["quickstart.md", "overrides"],
  ["evaluation-guide.md", "shasum"],
  ["integration-and-testing.md", "overrides"],
  ["integration-and-testing.md", "pnpm"],
  ["integration-and-testing.md", "testing"],
]);

// The reviewed exception spans per document, for the per-span acceptance lookup; the stale check reads
// REVIEWED_EXCEPTIONS itself, so a document missing from the kit cannot hide its entries.
const REVIEWED_SPANS_BY_DOCUMENT = new Map(
  [...new Set(REVIEWED_EXCEPTIONS.map(([document]) => document))].map((document) => [
    document,
    Object.freeze(REVIEWED_EXCEPTIONS.filter(([name]) => name === document).map(([, span]) => span)),
  ]),
);

function resolveEntryPoint(specifier, installDir) {
  const { resolvedModule } = ts.resolveModuleName(
    specifier,
    resolve(installDir, "doc-references.mts"),
    COMPILER_OPTIONS,
    ts.sys,
    undefined,
    undefined,
    ts.ModuleKind.ESNext,
  );
  assert(resolvedModule?.extension === ts.Extension.Dts, `the installed kit has no type declarations for ${specifier}`);
  return resolvedModule.resolvedFileName;
}

// The declaration scope: the `node_modules/@bloodtrail` prefix the entry points resolved through. Derived
// from a resolved entry point so it matches the realpaths the TypeScript compiler reports for every file.
function declarationScopeRoot(entryFile) {
  const marker = `node_modules${sep}@bloodtrail${sep}`;
  const index = entryFile.indexOf(marker);
  assert(index !== -1, `the installed entry point is not @bloodtrail-scoped: ${entryFile}`);
  return entryFile.slice(0, index + marker.length);
}

function isOwnedFile(fileName, scopeRoot) {
  return fileName.startsWith(scopeRoot);
}

function isOwnedType(type, scopeRoot) {
  const symbol = type.symbol ?? type.aliasSymbol;
  const declarations = symbol ? symbol.declarations ?? [] : [];
  if (declarations.length === 0) return false;
  return declarations.every((declaration) => isOwnedFile(declaration.getSourceFile().fileName, scopeRoot));
}

// A property is owned when the packages' files declare it, or when it is synthetic (a mapped type's key,
// say) and its parent type is owned. Inherited platform members always carry library declarations.
function isOwnedProperty(property, parentType, scopeRoot) {
  const declarations = property.declarations ?? [];
  if (declarations.length > 0) {
    return declarations.every((declaration) => isOwnedFile(declaration.getSourceFile().fileName, scopeRoot));
  }
  return isOwnedType(parentType, scopeRoot);
}

function hasCallSignatures(checker, type) {
  return checker.getNonNullableType(type).getCallSignatures().length > 0;
}

function isStringLiteralType(type) {
  return (type.flags & ts.TypeFlags.StringLiteral) !== 0;
}

function unionOrIntersectionMembers(type) {
  return (type.flags & ts.TypeFlags.UnionOrIntersection) !== 0 ? type.types : [];
}

// The type arguments of a type reference; every other type has none.
function typeArguments(checker, type) {
  if ((type.flags & ts.TypeFlags.Object) === 0) return [];
  if ((type.objectFlags & ts.ObjectFlags.Reference) === 0) return [];
  return checker.getTypeArguments(type);
}

function recordDeclaredMember(checker, api, name, type) {
  const existing = api.declaredMembers.get(name);
  if (existing) {
    existing.types.push(type);
    if (!existing.callable && hasCallSignatures(checker, type)) existing.callable = true;
  } else {
    api.declaredMembers.set(name, { types: [type], callable: hasCallSignatures(checker, type) });
  }
}

function walkSignature(checker, api, scopeRoot, signature) {
  for (const parameter of signature.getParameters()) {
    walkDeclaredType(checker, api, scopeRoot, checker.getTypeOfSymbol(parameter));
  }
  walkDeclaredType(checker, api, scopeRoot, signature.getReturnType());
}

// Walks every type reachable from an exported value or type through properties, union and intersection
// members, type arguments, and call and construct signature parameters and returns. Only properties and
// signatures the installed packages declare contribute members, so platform libraries never do.
function walkDeclaredType(checker, api, scopeRoot, type) {
  if (!type || api.seenTypes.has(type)) return;
  api.seenTypes.add(type);
  if (isStringLiteralType(type)) {
    api.stringLiterals.add(type.value);
    return;
  }
  walkTypeConstituents(checker, api, scopeRoot, type);
  walkTypeSignatures(checker, api, scopeRoot, type);
  walkTypeProperties(checker, api, scopeRoot, type);
}

function walkTypeConstituents(checker, api, scopeRoot, type) {
  for (const memberType of unionOrIntersectionMembers(type)) {
    walkDeclaredType(checker, api, scopeRoot, memberType);
  }
  for (const argumentType of typeArguments(checker, type)) {
    walkDeclaredType(checker, api, scopeRoot, argumentType);
  }
}

function walkTypeSignatures(checker, api, scopeRoot, type) {
  for (const signature of checker.getSignaturesOfType(type, ts.SignatureKind.Call)) {
    walkSignature(checker, api, scopeRoot, signature);
  }
  for (const signature of checker.getSignaturesOfType(type, ts.SignatureKind.Construct)) {
    walkSignature(checker, api, scopeRoot, signature);
  }
}

function walkTypeProperties(checker, api, scopeRoot, type) {
  for (const property of checker.getPropertiesOfType(type)) {
    if (!isOwnedProperty(property, type, scopeRoot)) continue;
    const propertyType = checker.getTypeOfSymbol(property);
    recordDeclaredMember(checker, api, property.name, propertyType);
    walkDeclaredType(checker, api, scopeRoot, propertyType);
  }
}

function recordExport(checker, exported, api, scopeRoot) {
  const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
  const info = { isClass: Boolean(symbol.flags & ts.SymbolFlags.Class) };
  if (symbol.flags & TYPE_SYMBOLS) {
    info.declaredType = checker.getDeclaredTypeOfSymbol(symbol);
  }
  if (symbol.flags & ts.SymbolFlags.Value) {
    info.valueType = checker.getTypeOfSymbol(symbol);
  }
  api.exportsByName.set(exported.name, info);
  walkDeclaredType(checker, api, scopeRoot, info.declaredType);
  walkDeclaredType(checker, api, scopeRoot, info.valueType);
}

/**
 * Reads the installed packages' type declarations: every exported name with its value and declared types,
 * the reachable declared types' members with their types, and the reachable string literal types. Built
 * once per gate run from the four entry points.
 */
function readInstalledApi(installDir) {
  const files = KIT_ENTRY_POINTS.map((specifier) => resolveEntryPoint(specifier, installDir));
  const program = ts.createProgram(files, COMPILER_OPTIONS);
  const checker = program.getTypeChecker();
  const scopeRoot = declarationScopeRoot(files[0]);
  const api = {
    checker,
    exportsByName: new Map(),
    receiverTypes: new Map(),
    declaredMembers: new Map(),
    stringLiterals: new Set(),
    seenTypes: new Set(),
  };
  for (const file of files) {
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(file));
    assert(moduleSymbol, `${file} declares no module`);
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      recordExport(checker, exported, api, scopeRoot);
    }
  }
  for (const [receiver, typeName] of DOCUMENTED_RECEIVERS) {
    const declaredType = api.exportsByName.get(typeName)?.declaredType;
    assert(declaredType, `the installed kit exports no type ${typeName}, which documents name`);
    api.receiverTypes.set(receiver, declaredType);
  }
  return api;
}

function isPlatformGlobal(name) {
  return Object.hasOwn(globalThis, name);
}

function isTypeScriptKeyword(name) {
  const token = ts.stringToToken(name);
  return token >= ts.SyntaxKind.FirstKeyword && token <= ts.SyntaxKind.LastKeyword;
}

function isAnyOrUnknown(type) {
  return (type.flags & ts.TypeFlags.Any) !== 0 || (type.flags & ts.TypeFlags.Unknown) !== 0;
}

function markCalleeCalled(chain) {
  const last = chain.members[chain.members.length - 1];
  if (last) last.called = true;
  else chain.called = true;
}

// The chain behind an expression: a root identifier, member names, and the call and construction marks.
// Optional chaining and type arguments do not change the chain.
function chainFromExpression(expression) {
  if (ts.isIdentifier(expression)) {
    return { root: expression.text, called: false, constructed: false, members: [] };
  }
  return extendedChain(expression);
}

// The mark a call or a construction puts on its inner chain, or null for neither.
function expressionMark(expression) {
  if (ts.isCallExpression(expression)) return markCalleeCalled;
  if (ts.isNewExpression(expression)) return markConstructed;
  return null;
}

function markConstructed(chain) {
  chain.constructed = true;
}

// A member access appends a member; a call or construction marks its inner chain; the transparent kinds
// pass through to their inner expression.
function extendedChain(expression) {
  if (ts.isPropertyAccessExpression(expression)) {
    const base = chainFromExpression(expression.expression);
    if (!base) return null;
    base.members.push({ name: expression.name.text, called: false });
    return base;
  }
  const mark = expressionMark(expression);
  if (!mark) return transparentChain(expression);
  const base = chainFromExpression(expression.expression);
  if (!base) return null;
  mark(base);
  return base;
}

function transparentChain(expression) {
  if (ts.isParenthesizedExpression(expression)) return chainFromExpression(expression.expression);
  if (ts.isAwaitExpression(expression)) return chainFromExpression(expression.expression);
  if (ts.isNonNullExpression(expression)) return chainFromExpression(expression.expression);
  return null;
}

// The callee chain of every call expression and every new expression anywhere in the span, arguments
// included.
function collectCalleeReferences(sourceFile) {
  const references = [];
  const visit = (node) => {
    if (ts.isCallExpression(node) || ts.isNewExpression(node)) {
      const chain = chainFromExpression(node.expression);
      if (chain) {
        if (ts.isCallExpression(node)) markCalleeCalled(chain);
        else chain.constructed = true;
        references.push(chain);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return references;
}

// A span that names an API on its own: one expression statement that is, behind any await and parentheses,
// an identifier or a chain of property accesses.
function identifierShapedChain(sourceFile) {
  const statement = sourceFile.statements[0];
  if (!statement || sourceFile.statements.length !== 1) return null;
  if (!ts.isExpressionStatement(statement)) return null;
  let expression = statement.expression;
  while (ts.isParenthesizedExpression(expression) || ts.isAwaitExpression(expression)) {
    expression = expression.expression;
  }
  if (!ts.isIdentifier(expression) && !ts.isPropertyAccessExpression(expression)) return null;
  return chainFromExpression(expression);
}

// A `...` placeholder that elides content is not part of the code, so it is removed before parsing.
function parseableSpan(span) {
  const cleaned = span.replace(ELLIPSIS_PLACEHOLDER, "");
  const sourceFile = ts.createSourceFile("doc-span.ts", cleaned, ts.ScriptTarget.Latest, true);
  return sourceFile.parseDiagnostics.length === 0 ? sourceFile : null;
}

// True when a span is not code at all: prose, a file name, or a declared string literal such as an event name.
function spanIsNotCode(span, api) {
  if (NOT_A_CODE_REFERENCE.test(span)) return true;
  if (FILE_NAME_REFERENCE.test(span)) return true;
  return api.stringLiterals.has(span);
}

function typeLabel(checker, types) {
  return checker.typeToString(types[0]);
}

// The return types of the call signatures. The non-nullable type is read, so an optional method's
// `T | undefined` still yields its returns.
function callReturnTypes(checker, types) {
  const returns = [];
  for (const type of types) {
    for (const signature of checker.getNonNullableType(type).getCallSignatures()) {
      returns.push(signature.getReturnType());
    }
  }
  return returns;
}

// One member step from typed starts: the member must exist and, when called, be callable. The walk
// continues with the member's types, or the call signatures' return types.
function typedMemberStep(checker, currentTypes, member) {
  if (currentTypes.some(isAnyOrUnknown)) return { types: currentTypes, failure: null };
  if (currentTypes.length === 0) {
    return { types: [], failure: `no type remains to resolve member ${member.name}` };
  }
  const found = [];
  for (const type of currentTypes) {
    const property = checker.getPropertyOfType(checker.getNonNullableType(type), member.name);
    if (property) found.push(checker.getTypeOfSymbol(property));
  }
  if (found.length === 0) {
    return { types: [], failure: `${typeLabel(checker, currentTypes)} has no member ${member.name}` };
  }
  const callable = found.filter((type) => hasCallSignatures(checker, type));
  if (member.called && callable.length === 0) {
    return { types: [], failure: `${typeLabel(checker, currentTypes)}.${member.name} is not a method` };
  }
  const types = member.called ? callReturnTypes(checker, callable) : found;
  return { types, failure: null };
}

function appendExportTypes(types, exported) {
  if (!exported) return;
  if (exported.valueType) types.push(exported.valueType);
  if (exported.declaredType) types.push(exported.declaredType);
}

function typedStartTypes(chain, api) {
  const receiver = api.receiverTypes.get(chain.root);
  const exported = api.exportsByName.get(chain.root);
  if (!receiver && !exported) return null;
  const types = receiver ? [receiver] : [];
  appendExportTypes(types, exported);
  return types;
}

function calledStartTypes(chain, api, startTypes) {
  if (!chain.called) return { types: startTypes, failure: null };
  const callable = startTypes.filter((type) => hasCallSignatures(api.checker, type));
  if (callable.length === 0) return { types: [], failure: `${chain.root} is not callable` };
  return { types: callReturnTypes(api.checker, callable), failure: null };
}

// The typed start a receiver or exported root begins its walk at, or null for any other root. A called
// root must be callable, and its walk starts at the call signatures' return types.
function typedStart(chain, api) {
  const startTypes = typedStartTypes(chain, api);
  if (!startTypes) return null;
  return calledStartTypes(chain, api, startTypes);
}

function walkTypedMembers(checker, startTypes, members) {
  let current = startTypes;
  for (const member of members) {
    const step = typedMemberStep(checker, current, member);
    if (step.failure) return step.failure;
    current = step.types;
  }
  return null;
}

// A memberless root that no typed start covers: a document-local name, a declared member (callable when
// called), a declared string literal, or a platform method.
function resolveBareRoot(chain, api, localNames) {
  if (localNames.has(chain.root)) return null;
  const declared = api.declaredMembers.get(chain.root);
  if (declared) {
    return chain.called && !declared.callable ? `no installed package declares a method ${chain.root}` : null;
  }
  if (api.stringLiterals.has(chain.root)) return null;
  if (PLATFORM_METHODS.has(chain.root)) return null;
  return `no installed package exports or declares ${chain.root}`;
}

// A prose variable's chain, such as `result` in `result.error.code`: the first member must be a declared
// member, callable when called, and the walk continues from its types. A single platform method resolves.
function resolveProseChain(chain, api) {
  const [first, ...rest] = chain.members;
  if (rest.length === 0 && PLATFORM_METHODS.has(first.name)) return null;
  const declared = api.declaredMembers.get(first.name);
  if (!declared) return `no installed package declares a member ${first.name}`;
  if (first.called && !declared.callable) return `no installed package declares a method ${first.name}`;
  const callable = declared.types.filter((type) => hasCallSignatures(api.checker, type));
  const current = first.called ? callReturnTypes(api.checker, callable) : declared.types;
  return walkTypedMembers(api.checker, current, rest);
}

function rootAlwaysResolves(root) {
  return isTypeScriptKeyword(root) || root === "this" || isPlatformGlobal(root);
}

function constructedChainFailure(chain, api, localNames) {
  return chain.constructed ? constructedRootFailure(chain.root, api, localNames) : null;
}

function typedChainResolution(chain, api) {
  const start = typedStart(chain, api);
  if (!start) return { known: false, failure: null };
  if (start.failure) return { known: true, failure: start.failure };
  return { known: true, failure: walkTypedMembers(api.checker, start.types, chain.members) };
}

function untypedChainResolution(chain, api, localNames) {
  if (chain.members.length === 0) return resolveBareRoot(chain, api, localNames);
  return resolveProseChain(chain, api);
}

/**
 * Returns why a chain names an API that does not exist, or null when it names one that does.
 */
function resolveChain(chain, api, localNames) {
  if (rootAlwaysResolves(chain.root)) return null;
  const constructionFailure = constructedChainFailure(chain, api, localNames);
  if (constructionFailure) return constructionFailure;
  const typed = typedChainResolution(chain, api);
  if (typed.known) return typed.failure;
  return untypedChainResolution(chain, api, localNames);
}

// A constructed root must be an exported class or a document-local name; platform globals resolve earlier.
function constructedRootFailure(root, api, localNames) {
  const exported = api.exportsByName.get(root);
  const constructible = exported?.isClass || localNames.has(root);
  return constructible ? null : `no installed package exports a class ${root}`;
}

/**
 * Returns why a span of inline code names an API that does not exist, or null when it names one that does,
 * or is not code at all.
 */
function unresolvedReference(span, api, localNames) {
  if (spanIsNotCode(span, api)) return null;
  const sourceFile = parseableSpan(span);
  if (!sourceFile) return null;
  const references = collectCalleeReferences(sourceFile);
  const shaped = identifierShapedChain(sourceFile);
  if (shaped) references.push(shaped);
  for (const chain of references) {
    const reason = resolveChain(chain, api, localNames);
    if (reason) return reason;
  }
  return null;
}

function inlineCodeSpans(markdownText) {
  const prose = proseOutsideFencedBlocks(markdownText);
  return [...prose.matchAll(INLINE_CODE)].map(([, code]) => code.trim()).filter(Boolean);
}

// True when the span is a reviewed exception for the document; the matched pair is recorded so the stale
// check at the end of the run sees it.
function isReviewedSpan(name, span, matchedPairs) {
  const spans = REVIEWED_SPANS_BY_DOCUMENT.get(name);
  if (!spans?.includes(span)) return false;
  matchedPairs.add(`${name}\u0000${span}`);
  return true;
}

async function documentFailures(docsDir, name, api, matchedPairs) {
  const text = await readFile(resolve(docsDir, name), "utf8");
  const localNames = declaredDocBlockNames(text);
  const failures = [];
  for (const span of inlineCodeSpans(text)) {
    if (isReviewedSpan(name, span, matchedPairs)) continue;
    const reason = unresolvedReference(span, api, localNames);
    if (reason) failures.push(`docs/${name}: \`${span}\`: ${reason}`);
  }
  return failures;
}

// Every reviewed exception entry that matched no span across the whole run, named as stale whether or
// not its document exists in the kit.
function staleExceptionFailures(matchedPairs) {
  const failures = [];
  for (const [name, span] of REVIEWED_EXCEPTIONS) {
    if (!matchedPairs.has(`${name}\u0000${span}`)) {
      failures.push(`docs/${name}: reviewed exception \`${span}\` matches no span`);
    }
  }
  return failures;
}

/**
 * Every callee and identifier-shaped reference in inline code across the installed kit's documents must
 * name an API the installed packages declare, unless the (document, span) pair is a reviewed exception.
 * An exception entry that matches no span in its document fails as stale.
 */
export async function assertKitDocReferences(installDir) {
  const api = readInstalledApi(installDir);
  const docsDir = resolve(installDir, "docs");
  const documents = await markdownDocumentNames(docsDir);
  const matchedPairs = new Set();
  const failures = [];
  for (const name of documents) {
    failures.push(...(await documentFailures(docsDir, name, api, matchedPairs)));
  }
  failures.push(...staleExceptionFailures(matchedPairs));
  assert(failures.length === 0, `kit documents name APIs the installed packages do not declare:\n  ${failures.join("\n  ")}`);
}
