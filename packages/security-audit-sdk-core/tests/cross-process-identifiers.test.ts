import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { systemAuditIdentifiers, type AuditIdentifierProvider } from "../dist/index.js";

const identifierMethods: readonly (keyof AuditIdentifierProvider)[] = [
  "eventId", "operationId", "correlationId", "causationId", "requestId", "messageId", "transactionId",
];
const uuidV4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const sdkUrl = new URL("../dist/index.js", import.meta.url).href;
const configUrl = new URL("../dist/config.js", import.meta.url).href;

function runIsolated(script: string): void {
  const child = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
    encoding: "utf8",
    timeout: 10_000,
    maxBuffer: 64 * 1024,
  });
  assert.equal(child.error, undefined, child.error?.message);
  assert.equal(child.signal, null, `child terminated: ${child.signal}`);
  assert.equal(child.status, 0, child.stderr.slice(0, 4096));
}

const childConfiguration = String.raw`
import { strict as assert } from "node:assert";
let sinkCalls = 0;
const configuration = {
  contractVersion: "2.1.0",
  producer: { name: "identifier-test", version: "1.0.0" },
  service: { name: "identifier-test" },
  environment: { name: "test" },
  sink: { async emit() { sinkCalls += 1; return { status: "accepted" }; } },
};
`;

const unavailableHosts = [
  { name: "absent crypto", setup: "delete globalThis.crypto;" },
  { name: "missing randomUUID", setup: "Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });" },
  { name: "non-callable randomUUID", setup: "Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: 42 } });" },
];

test("all seven system identifier methods produce distinct lowercase UUID v4 values", () => {
  assert.equal(Object.isFrozen(systemAuditIdentifiers), true);
  const identifiers = identifierMethods.flatMap((method) => Array.from({ length: 16 }, () => systemAuditIdentifiers[method]()));
  for (const identifier of identifiers) assert.match(identifier, uuidV4);
  assert.equal(new Set(identifiers).size, identifiers.length);
});

test("all system methods lazily delegate to host randomUUID with the host receiver", () => {
  runIsolated(`
import { strict as assert } from "node:assert";
// Import before installing the host to detect eager capture of its capability.
delete globalThis.crypto;
const { systemAuditIdentifiers, createSecurityAuditSdk } = await import(${JSON.stringify(sdkUrl)});
const methods = ${JSON.stringify(identifierMethods)};
let calls = 0;
let host;
const installHost = () => {
  host = { randomUUID() {
    assert.equal(this, host);
    calls += 1;
    return '00000000-0000-4000-8000-' + String(calls).padStart(12, '0');
  } };
  Object.defineProperty(globalThis, 'crypto', { configurable: true, value: host });
};
installHost();
for (const method of methods) {
  const before = calls;
  const detached = systemAuditIdentifiers[method];
  assert.equal(detached(), '00000000-0000-4000-8000-' + String(before + 1).padStart(12, '0'));
  assert.equal(calls, before + 1);
}
// Replacing the host must affect future calls, not a cached UUID function.
installHost();
assert.equal(systemAuditIdentifiers.eventId(), '00000000-0000-4000-8000-000000000008');
`);
});

for (const host of unavailableHosts) {
  for (const explicit of [false, true]) {
    test(`${host.name} rejects ${explicit ? "explicit" : "implicit"} system defaults before sink use`, () => {
      runIsolated(`${childConfiguration}
${host.setup}
const { createSecurityAuditSdk, systemAuditIdentifiers, SecurityAuditSdkError } = await import(${JSON.stringify(sdkUrl)});
assert.throws(() => createSecurityAuditSdk({
  ...configuration,
  ...(${explicit} ? { identifiers: systemAuditIdentifiers } : {}),
}), (error) => {
  assert.ok(error instanceof SecurityAuditSdkError);
  assert.equal(error.code, 'SDK_INVALID_CONFIGURATION');
  assert.equal(error.category, 'configuration');
  assert.equal(error.path, '/identifiers');
  return true;
});
assert.equal(sinkCalls, 0);
`);
    });
  }
}

for (const setup of [
  "delete globalThis.crypto;",
  "Object.defineProperty(globalThis, 'crypto', { configurable: true, get() { throw new Error('custom provider must not probe crypto'); } });",
]) {
  test(`custom provider preserves identity and receiver without host crypto: ${setup.startsWith("delete") ? "absent" : "unreadable"}`, () => {
    runIsolated(`${childConfiguration}
${setup}
const { createSecurityAuditSdk } = await import(${JSON.stringify(sdkUrl)});
const { normalizeConfiguration } = await import(${JSON.stringify(configUrl)});
const methods = ${JSON.stringify(identifierMethods)};
const calls = [];
const expected = Object.fromEntries(methods.map((method, index) => [method, '00000000-0000-4000-8000-' + String(index + 1).padStart(12, '0')]));
const identifiers = Object.fromEntries(methods.map((method) => [method, function () {
  assert.equal(this, identifiers);
  calls.push(method);
  return expected[method];
}]));
const input = { ...configuration, identifiers };
assert.equal(normalizeConfiguration(input).identifiers, identifiers);
const sdk = createSecurityAuditSdk(input);
assert.equal(sdk.state, 'ready');
assert.deepEqual(calls, []);
assert.equal(sinkCalls, 0);
const operation = sdk.beginOperation();
assert.equal(operation.ok, true);
assert.equal(operation.value.operationId, expected.operationId);
assert.equal(operation.value.correlationId, expected.correlationId);
assert.equal(operation.value.transactionId, expected.transactionId);
for (const method of methods) assert.equal(identifiers[method](), expected[method]);
assert.deepEqual(calls.slice(-methods.length), methods);
await sdk.shutdown();
`);
  });
}

test("default and explicit system construction validate availability without generating identifiers", () => {
  runIsolated(`${childConfiguration}
let uuidCalls = 0;
const host = { randomUUID() { uuidCalls += 1; throw new Error('must stay lazy'); } };
Object.defineProperty(globalThis, 'crypto', { configurable: true, value: host });
const { createSecurityAuditSdk, systemAuditIdentifiers } = await import(${JSON.stringify(sdkUrl)});
for (const explicit of [false, true]) {
  const sdk = createSecurityAuditSdk({ ...configuration, ...(explicit ? { identifiers: systemAuditIdentifiers } : {}) });
  assert.equal(sdk.state, 'ready');
  await sdk.shutdown();
}
assert.equal(uuidCalls, 0);
assert.equal(sinkCalls, 0);
`);
});
