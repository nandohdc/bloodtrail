import assert from "node:assert/strict";
import { test } from "node:test";
import { assertSynthetic, documentationAddress, isDocumentationAddress, isSyntheticId, opaqueId, seededRandom } from "../lib/workload.mjs";
import { sessionFingerprint, tracerIdentities, tracerInput } from "../tracer/workload.mjs";

test("the same seed yields the same identities; a different seed differs", () => {
  assert.deepEqual(tracerIdentities({ seed: 836001 }), tracerIdentities({ seed: 836001 }));
  assert.notDeepEqual(tracerIdentities({ seed: 836001 }), tracerIdentities({ seed: 836002 }));
});

test("generated identifiers are opaque and synthetic, addresses are documentation-range", () => {
  const random = seededRandom(7);
  for (let index = 0; index < 200; index += 1) {
    assert(isSyntheticId(opaqueId({ kind: "account", random })));
    assert(isDocumentationAddress(documentationAddress({ random })));
  }
});

test("planted defects are refused: an email-like identifier and a non-documentation address", () => {
  assert.throws(() => assertSynthetic({ ids: ["alice@example.com"], addresses: [] }), /non-synthetic identifier/);
  assert.throws(() => assertSynthetic({ ids: [], addresses: ["10.0.0.1"] }), /non-documentation address/);
  assert.deepEqual(assertSynthetic({ ids: ["syn-account-0000000a"], addresses: ["198.51.100.7"] }), { ids: 1, addresses: 1 });
});

test("G29: the tracer's session id is a keyed fingerprint of the session handle, never the handle itself", () => {
  const identities = tracerIdentities({ seed: 836001 });
  const core = new Proxy({}, { get: () => (value) => value });
  const key = Buffer.alloc(32, 7);
  const input = tracerInput({ core, identities, at: "2026-10-23T00:00:00.000Z", sessionKey: key });
  assert.equal(input.session.id, sessionFingerprint({ key, handle: identities.ids.session_handle }));
  assert.match(input.session.id, /^[0-9a-f]{64}$/);
  assert.notEqual(input.session.id, identities.ids.session_handle);
  assert.notEqual(tracerInput({ core, identities, at: "2026-10-23T00:00:00.000Z", sessionKey: Buffer.alloc(32, 8) }).session.id, input.session.id, "another run's key gives another fingerprint");
  assert.deepEqual([input.session.created_at, input.session.age_seconds], ["2026-10-23T00:00:00.000Z", 0]);
});
