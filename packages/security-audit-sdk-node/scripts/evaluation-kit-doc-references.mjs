import { readdir, readFile } from "node:fs/promises";
import { extname, resolve } from "node:path";
import ts from "typescript";
import { declaredDocBlockNames } from "./evaluation-kit-doc-blocks.mjs";
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
const IDENTIFIER = String.raw`[A-Za-z_$][\w$]*`;
const CONSTRUCTION = new RegExp(String.raw`^new\s+(${IDENTIFIER})\s*\(.*\)$`);
const MEMBER_REFERENCE = new RegExp(String.raw`^((?:${IDENTIFIER}\.)*)(${IDENTIFIER})\.(${IDENTIFIER})(\(.*\))?$`);
const BARE_CALL = new RegExp(String.raw`^(${IDENTIFIER})\s*\(.*\)$`);
const FACTORY_OR_VALIDATOR = /^(?:create|validate)[A-Z][\w$]*$/;
const FENCE_MARKER = /^[ \t]*(`*)/;
const INLINE_CODE = /`([^`\r\n]+)`/g;

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

function recordMembers(checker, type, members, api) {
  for (const property of checker.getPropertiesOfType(type)) {
    const callable = checker.getNonNullableType(checker.getTypeOfSymbol(property)).getCallSignatures().length > 0;
    members.set(property.name, callable);
    if (callable) api.methods.add(property.name);
  }
}

function recordExport(checker, exported, api) {
  const symbol = exported.flags & ts.SymbolFlags.Alias ? checker.getAliasedSymbol(exported) : exported;
  if (symbol.flags & TYPE_SYMBOLS) {
    const members = new Map();
    recordMembers(checker, checker.getDeclaredTypeOfSymbol(symbol), members, api);
    api.membersByType.set(exported.name, members);
  }
  if (symbol.flags & ts.SymbolFlags.Class) {
    // A class's static members, beside its instance members.
    recordMembers(checker, checker.getTypeOfSymbol(symbol), api.membersByType.get(exported.name), api);
    api.classes.add(exported.name);
  } else if (symbol.flags & ts.SymbolFlags.Value && checker.getTypeOfSymbol(symbol).getCallSignatures().length > 0) {
    api.functions.add(exported.name);
  }
}

/**
 * Reads the installed packages' type declarations: every function they export, every class, and the
 * members of every type, each marked as callable or not.
 */
function readInstalledApi(installDir) {
  const files = KIT_ENTRY_POINTS.map((specifier) => resolveEntryPoint(specifier, installDir));
  const program = ts.createProgram(files, COMPILER_OPTIONS);
  const checker = program.getTypeChecker();
  const api = { functions: new Set(), classes: new Set(), methods: new Set(), membersByType: new Map() };
  for (const file of files) {
    const moduleSymbol = checker.getSymbolAtLocation(program.getSourceFile(file));
    assert(moduleSymbol, `${file} declares no module`);
    for (const exported of checker.getExportsOfModule(moduleSymbol)) {
      recordExport(checker, exported, api);
    }
  }
  for (const typeName of DOCUMENTED_RECEIVERS.values()) {
    assert(api.membersByType.has(typeName), `the installed kit exports no type ${typeName}, which documents name`);
  }
  return api;
}

function isPlatformGlobal(name) {
  return Object.hasOwn(globalThis, name);
}

function isDeclaredCallable(name, api, localNames) {
  return api.functions.has(name) || api.methods.has(name) || localNames.has(name) || PLATFORM_METHODS.has(name);
}

function checkTypeMember(typeName, member, called, api) {
  const members = api.membersByType.get(typeName);
  if (!members.has(member)) return `${typeName} has no member ${member}`;
  return called && !members.get(member) ? `${typeName}.${member} is not a method` : null;
}

function receiverType(path, receiver, api) {
  if (path) return null;
  return DOCUMENTED_RECEIVERS.get(receiver) ?? (api.membersByType.has(receiver) ? receiver : null);
}

// `sdk.x`, `op.x()` and `SomeType.x` must name a member of that type. Any other `a.b.x()` must name a method
// some installed type declares. A path with no call, such as `event.actor.id`, names a field, not an API.
function checkMemberReference([, path, receiver, member, call], api, localNames) {
  const typeName = receiverType(path, receiver, api);
  if (typeName) return checkTypeMember(typeName, member, Boolean(call), api);
  if (!call || isPlatformGlobal(receiver)) return null;
  return isDeclaredCallable(member, api, localNames) ? null : `no installed package declares a method ${member}`;
}

function checkBareCall(name, api, localNames) {
  if (isDeclaredCallable(name, api, localNames) || isPlatformGlobal(name)) return null;
  return `no installed package exports a function or declares a method ${name}`;
}

function checkConstruction(name, api, localNames) {
  const constructible = api.classes.has(name) || localNames.has(name) || isPlatformGlobal(name);
  return constructible ? null : `no installed package exports a class ${name}`;
}

function checkFunctionName(name, api, localNames) {
  return api.functions.has(name) || localNames.has(name) ? null : `no installed package exports a function ${name}`;
}

/**
 * Returns why a span of inline code names an API that does not exist, or null when it names one that does,
 * or is not a call-shaped reference at all.
 */
function unresolvedReference(span, api, localNames) {
  if (NOT_A_CODE_REFERENCE.test(span)) return null;
  const construction = CONSTRUCTION.exec(span);
  if (construction) return checkConstruction(construction[1], api, localNames);
  const member = MEMBER_REFERENCE.exec(span);
  if (member) return checkMemberReference(member, api, localNames);
  const call = BARE_CALL.exec(span);
  if (call) return checkBareCall(call[1], api, localNames);
  return FACTORY_OR_VALIDATOR.test(span) ? checkFunctionName(span, api, localNames) : null;
}

function closesFence(line, marker, fence) {
  return marker.length >= fence.length && line.trim() === marker;
}

// A document without its fenced code blocks, which the gate type-checks instead. A fence closes on a line of
// at least as many backticks as opened it.
function proseOf(markdownText) {
  const prose = [];
  let fence = "";
  for (const line of markdownText.split("\n")) {
    const marker = FENCE_MARKER.exec(line)[1];
    if (fence) fence = closesFence(line, marker, fence) ? "" : fence;
    else if (marker.length >= 3) fence = marker;
    else prose.push(line);
  }
  return prose.join("\n");
}

function inlineCodeSpans(markdownText) {
  const prose = proseOf(markdownText);
  return [...prose.matchAll(INLINE_CODE)].map(([, code]) => code.trim()).filter(Boolean);
}

async function documentFailures(docsDir, name, api) {
  const text = await readFile(resolve(docsDir, name), "utf8");
  const localNames = declaredDocBlockNames(text);
  return inlineCodeSpans(text)
    .map((span) => [span, unresolvedReference(span, api, localNames)])
    .filter(([, reason]) => reason)
    .map(([span, reason]) => `docs/${name}: \`${span}\`: ${reason}`);
}

/**
 * Every call-shaped reference in inline code across the installed kit's documents must name a function an
 * installed package exports, a member of a type one exports, or a helper its document declares in a checked
 * code block.
 */
export async function assertKitDocReferences(installDir) {
  const api = readInstalledApi(installDir);
  const docsDir = resolve(installDir, "docs");
  const documents = (await readdir(docsDir, { withFileTypes: true }))
    .filter((entry) => entry.isFile() && extname(entry.name) === ".md")
    .map((entry) => entry.name);
  const failures = [];
  for (const name of documents) {
    failures.push(...(await documentFailures(docsDir, name, api)));
  }
  assert(failures.length === 0, `kit documents name APIs the installed packages do not declare:\n  ${failures.join("\n  ")}`);
}
