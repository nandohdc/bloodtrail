import { strict as assert } from "node:assert";
import { spawnSync } from "node:child_process";
import { test } from "node:test";
import { systemAuditIdentifiers, type AuditIdentifierProvider } from "../dist/index.js";
import {
  buildIdentifierSamplingScript, findRepeatedIdentifiers, parseAndValidateChildResult,
  runConcurrentChild, type ChildIdentifiers, type ChildOutput,
} from "./cross-process-harness.js";

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
  { name: "null crypto", setup: "Object.defineProperty(globalThis, 'crypto', { configurable: true, value: null });" },
  { name: "missing randomUUID", setup: "Object.defineProperty(globalThis, 'crypto', { configurable: true, value: {} });" },
  { name: "non-callable randomUUID", setup: "Object.defineProperty(globalThis, 'crypto', { configurable: true, value: { randomUUID: 42 } });" },
];

function validChildRecord(): { pid: number; eventIds: string[]; operationIds: string[] } {
  return {
    pid: process.pid + 1,
    eventIds: ["00000000-0000-4000-8000-000000000001", "00000000-0000-4000-9000-000000000002"],
    operationIds: ["00000000-0000-4000-a000-000000000003", "00000000-0000-4000-b000-000000000004"],
  };
}

function fulfilledChild(stdout: string, overrides: Partial<ChildOutput> = {}): PromiseFulfilledResult<ChildOutput> {
  return { status: "fulfilled", value: { code: 0, signal: null, stdout, stderr: "synthetic stderr", ...overrides } };
}

const validChildStdout = JSON.stringify(validChildRecord());
const invalidChildOutputs: readonly { name: string; child: PromiseSettledResult<ChildOutput>; diagnostic: RegExp }[] = [
  { name: "rejected promise", child: { status: "rejected", reason: new Error("spawn failed") }, diagnostic: /child 7: Error: spawn failed/ },
  { name: "nonzero exit", child: fulfilledChild(validChildStdout, { code: 7 }), diagnostic: /child 7: exit=7; stderr=synthetic stderr/ },
  { name: "null exit", child: fulfilledChild(validChildStdout, { code: null }), diagnostic: /child 7: exit=null/ },
  { name: "signal", child: fulfilledChild(validChildStdout, { signal: "SIGKILL" }), diagnostic: /child 7: signal=SIGKILL; stderr=synthetic stderr/ },
  { name: "invalid JSON", child: fulfilledChild("not JSON"), diagnostic: /child 7: invalid JSON record/ },
  { name: "empty stdout", child: fulfilledChild(""), diagnostic: /child 7: invalid JSON record/ },
  { name: "multiple JSON records", child: fulfilledChild(`${validChildStdout}\n${validChildStdout}`), diagnostic: /child 7: expected exactly one JSON record/ },
  { name: "concatenated JSON records", child: fulfilledChild(validChildStdout + validChildStdout), diagnostic: /child 7: invalid JSON record/ },
];

for (const { name, child, diagnostic } of invalidChildOutputs) {
  test(`child-result validation rejects ${name}`, () => {
    assert.throws(() => parseAndValidateChildResult(child, 7, 2), diagnostic);
  });
}

const invalidChildRecords: readonly { name: string; record: unknown; diagnostic: RegExp }[] = [
  ...[null, 42, "record", true].map((record) => ({ name: `non-object ${JSON.stringify(record)}`, record, diagnostic: /child 7: expected a JSON object/ })),
  ...[[], {}, { ...validChildRecord(), extra: true }, { ...validChildRecord(), pid: undefined }].map((record, index) =>
    ({ name: `wrong keys ${index}`, record, diagnostic: /child 7: unexpected record keys/ })),
  ...["42", null].map((pid) => ({ name: `non-number pid ${JSON.stringify(pid)}`, record: { ...validChildRecord(), pid }, diagnostic: /child 7: pid must be a number/ })),
  ...[0, -1, 1.5].map((pid) => ({ name: `invalid pid ${pid}`, record: { ...validChildRecord(), pid }, diagnostic: /child 7: pid must be a positive integer/ })),
  { name: "parent pid", record: { ...validChildRecord(), pid: process.pid }, diagnostic: /child 7: expected a fresh child pid/ },
];

for (const { name, record, diagnostic } of invalidChildRecords) {
  test(`child-result validation rejects ${name}`, () => {
    assert.throws(() => parseAndValidateChildResult(fulfilledChild(JSON.stringify(record)), 7, 2), diagnostic);
  });
}

const invalidSampleArrays: readonly { name: string; values: unknown; diagnostic: string }[] = [
  ...[null, {}, "not an array"].map((values) => ({ name: `non-array ${JSON.stringify(values)}`, values, diagnostic: "must be an array" })),
  ...[[], [validChildRecord().eventIds[0]], [...validChildRecord().eventIds, validChildRecord().eventIds[0]]].map((values) =>
    ({ name: `sample count ${values.length}`, values, diagnostic: "count" })),
  ...[42, null, {}].map((value) => ({ name: `non-string ${JSON.stringify(value)}`, values: [validChildRecord().eventIds[0], value], diagnostic: "\\[1\\] must be a string" })),
  ...["", "not-a-uuid", "00000000-0000-4000-A000-000000000003", "00000000-0000-1000-8000-000000000001", "00000000-0000-4000-7000-000000000001"].map((value) =>
    ({ name: `malformed UUID ${JSON.stringify(value)}`, values: [value, validChildRecord().eventIds[1]], diagnostic: "\\[0\\] must be lowercase RFC 4122 UUID v4" })),
];

for (const key of ["eventIds", "operationIds"]) {
  for (const { name, values, diagnostic } of invalidSampleArrays) {
    test(`child-result validation rejects ${key} ${name}`, () => {
      const record = { ...validChildRecord(), [key]: values };
      const expectedDiagnostic = new RegExp(`child 7: ${key}.*${diagnostic}`);
      assert.throws(() => parseAndValidateChildResult(fulfilledChild(JSON.stringify(record)), 7, 2), expectedDiagnostic);
    });
  }
}

test("child-result validation returns the child pid and every event/operation sample", () => {
  const record = validChildRecord();
  const result = parseAndValidateChildResult(fulfilledChild(` ${JSON.stringify(record)}\n`), 7, 2);
  assert.deepEqual(result, { pid: record.pid, identifiers: [...record.eventIds, ...record.operationIds] });
});

test("default SDK event and operation identifiers are unique across concurrent fresh processes", async () => {
  const sampleCount = 128;
  const processCount = 4;
  const script = buildIdentifierSamplingScript(sampleCount);
  // Start every child before awaiting any; allSettled also reaps siblings on failure.
  const children = await Promise.allSettled(Array.from({ length: processCount }, () => runConcurrentChild(script)));
  const results = children.map((child, index) => parseAndValidateChildResult(child, index, sampleCount));
  const pids = new Set(results.map(({ pid }) => pid));
  const identifiers = results.flatMap(({ identifiers }) => identifiers);
  assert.equal(pids.size, processCount, "expected distinct fresh child processes");
  assert.equal(identifiers.length, processCount * sampleCount * 2);
  assert.deepEqual(findRepeatedIdentifiers(results), []);
});

const collisionCases: readonly { name: string; samples: readonly (readonly string[])[]; expected: string[] }[] = [
  { name: "empty union", samples: [], expected: [] },
  { name: "empty children", samples: [[], []], expected: [] },
  { name: "disjoint samples", samples: [["a", "b"], ["c", "d"]], expected: [] },
  { name: "within one child", samples: [["a", "b", "a"]], expected: ["a"] },
  { name: "across children", samples: [["a", "b"], ["c", "a"]], expected: ["a"] },
  { name: "more than twice", samples: [["a", "a"], ["a", "a", "b", "b"]], expected: ["a", "b"] },
  { name: "second-encounter ordering", samples: [["a", "b", "c"], ["c", "b", "a", "b"]], expected: ["c", "b", "a"] },
];

for (const { name, samples, expected } of collisionCases) {
  test(`collision finder detects the complete union: ${name}`, () => {
    const results: readonly ChildIdentifiers[] = Object.freeze(samples.map((identifiers, pid) =>
      Object.freeze({ pid, identifiers: Object.freeze([...identifiers]) })));
    assert.deepEqual(findRepeatedIdentifiers(results), expected);
    assert.deepEqual(results.map((result) => result.identifiers), samples, "must not mutate inputs");
  });
}

test("collision finder detects an event/operation collision in validated child records", () => {
  const record = validChildRecord();
  record.operationIds[1] = record.eventIds[0]!;
  const result = parseAndValidateChildResult(fulfilledChild(JSON.stringify(record)), 7, 2);
  assert.deepEqual(findRepeatedIdentifiers([result]), [record.eventIds[0]]);
});

test("sampling script without provider source leaves identifiers absent from SDK config", () => {
  const script = buildIdentifierSamplingScript(128);
  assert.doesNotMatch(script, /^\s*identifiers\s*[:,]/m);
  assert.match(script, /Deliberately omit identifiers/);
  assert.match(script, /index < 128/);
});

test("sampling script with provider source inlines only a custom identifiers provider", () => {
  const source = "const identifiers = Object.freeze({ eventId() { return 'fixture'; } });";
  const script = buildIdentifierSamplingScript(2, source);
  assert.ok(script.includes(source));
  assert.match(script, /createSecurityAuditSdk\(\{\s*identifiers,/);
  assert.doesNotMatch(script, /systemAuditIdentifiers|Deliberately omit identifiers/);
  assert.match(script, /index < 2/);
});

test("concurrent child stdout bound kills and reaps an overflowing execution", async () => {
  await assert.rejects(
    runConcurrentChild('process.stdout.write("x".repeat(128 * 1024)); setInterval(() => {}, 1000);'),
    /child stdout exceeded 64 KiB; stderr=/,
  );
});

test("concurrent child guard kills and reaps overdue executions", async () => {
  await assert.rejects(
    runConcurrentChild("setInterval(() => {}, 1000);", 250),
    /child exceeded 250 ms and was killed; stderr=/,
  );
});

test("concurrent child captures abnormal exits with bounded stderr", async () => {
  const output = await runConcurrentChild('process.stderr.write("x".repeat(8192), () => { process.exitCode = 7; });');
  assert.equal(output.code, 7);
  assert.equal(output.signal, null);
  assert.equal(output.stdout, "");
  assert.equal(output.stderr, "x".repeat(4096));
});

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
