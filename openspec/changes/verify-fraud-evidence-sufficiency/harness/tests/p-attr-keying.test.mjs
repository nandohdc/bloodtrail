import assert from "node:assert/strict";
import crypto from "node:crypto";
import { syncBuiltinESMExports } from "node:module";
import test from "node:test";
import { actorIdHook, memoryKeying } from "../p-attr/keying.mjs";
import { tagged } from "../p-attr/origins.mjs";
import { fixtureState } from "./p-attr-foundation-fixtures.mjs";

function observeEntropy(t) {
  const original = crypto.randomBytes;
  const generated = [];
  t.mock.method(crypto, "randomBytes", (size) => {
    const bytes = original(size);
    generated.push(bytes);
    return bytes;
  });
  syncBuiltinESMExports();
  t.after(() => { t.mock.restoreAll(); syncBuiltinESMExports(); });
  return generated;
}

function assertNoKey({ serialized, key }) {
  assert.equal(serialized.includes(key.toString("hex")), false);
  assert.equal(serialized.includes(key.toString("base64")), false);
  assert.equal(serialized.includes([...key].join(",")), false);
  assert.equal(Buffer.from(serialized).includes(key), false);
}

test("memory-only random HMAC service inherits origins and never serializes keys", (t) => {
  const keys = observeEntropy(t);
  const first = memoryKeying();
  const second = memoryKeying();
  assert.deepEqual(keys.map((key) => key.length), [32, 32]);
  assert.equal(first.metadata.key_id, second.metadata.key_id);
  const content = tagged({ value: "pid-ex-0001", origin: "CP" });
  const input = { content, scope: "authentication_failed|platform-login" };
  const transformed = first.transform(input);
  assert.equal(transformed.origin, "CP");
  assert.match(transformed.value, /^[0-9a-f]{64}$/);
  assert.equal(transformed.value, first.transform(input).value);
  assert.notEqual(transformed.value, second.transform(input).value);
  const resolved = first.transform({ content: tagged({ value: "acct-0001", origin: "SR" }), scope: "fraud-evidence" });
  assert.equal(resolved.origin, "SR");
  const serialized = JSON.stringify({ first, second, transformed, resolved });
  for (const key of keys) assertNoKey({ serialized, key });
  assert.deepEqual(Object.keys(first), ["metadata", "transform", "recompute"]);
});

test("hook uses supplied purpose/effective tenant, independent key id and counted callback", (t) => {
  const keys = observeEntropy(t);
  const state = fixtureState();
  const keying = memoryKeying();
  const { hook, facts } = actorIdHook({ state, keying, contentOrigin: "CP" });
  const input = { path: "actor.id", value: "pid-ex-0001", purpose: "authentication_failed" };
  const tenantless = hook.transform(input);
  const otherPurpose = hook.transform({ ...input, purpose: "authentication_succeeded" });
  const tenant = hook.transform({ ...input, tenantId: "tnt-a01" });
  assert.equal(tenantless.key_id, "k-run-01");
  assert.notEqual(tenantless.value, otherPurpose.value);
  assert.notEqual(tenantless.value, tenant.value);
  assert.deepEqual(facts[0], { path: "actor.id", purpose: "authentication_failed", tenant_id: undefined, key_id: "k-run-01" });
  assert.equal(facts[2].tenant_id, "tnt-a01");
  assert.equal(state.ledger.report().occurrence_count, 3);
  assert.equal(state.calls.length, 3);
  assert.deepEqual(state.calls[0].raw, tenantless);
  const serialized = JSON.stringify({ keying, facts, calls: state.calls, records: state.records, ledger: state.ledger.report() });
  for (const key of keys) assertNoKey({ serialized, key });
});

test("unknown origin is rejected instead of silently promoted", () => {
  assert.throws(() => tagged({ value: "pid-ex-0001", origin: "computed-over-CP" }), /unknown content origin/);
});
