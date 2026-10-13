import { strict as assert } from "node:assert";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
  buildIdentifierSamplingScript, findRepeatedIdentifiers, sampleConcurrentChildren,
  type ChildIdentifiers, type ChildProgram, type SamplingPlan,
} from "./cross-process-harness.js";

// Test-only replica from upstream 5d931ad695fb10db3fe51e6b151352447e21d822,
// src/providers.ts. All seven methods consume the same module-level stream.
// Never use this deterministic generator in production.
const oldSeededProviderSource = String.raw`
let uuidSeed = 0x9e3779b9;

function nextRandomNibble() {
  uuidSeed = (uuidSeed + 0x6d2b79f5) >>> 0;
  let t = Math.imul(uuidSeed ^ (uuidSeed >>> 15), 1 | uuidSeed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) & 0xf;
}

function generateUuidV4() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = nextRandomNibble();
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const identifiers = Object.freeze({
  eventId: generateUuidV4,
  operationId: generateUuidV4,
  correlationId: generateUuidV4,
  causationId: generateUuidV4,
  requestId: generateUuidV4,
  messageId: generateUuidV4,
  transactionId: generateUuidV4,
});
`;

function readFrozenEventIdPattern(): RegExp {
  const schemaUrl = new URL("../../../contracts/security-audit/schema/security-audit-event.schema.json", import.meta.url);
  const schema = JSON.parse(readFileSync(schemaUrl, "utf8")) as {
    properties: { event: { properties: { id: { pattern: string } } } };
  };
  const pattern = schema.properties.event.properties.id.pattern;
  assert.equal(typeof pattern, "string", "frozen event.id pattern must exist");
  return new RegExp(pattern);
}

const frozenEventIdPattern = readFrozenEventIdPattern();

function assertReplicaSequence(result: ChildIdentifiers, expected: readonly string[], sampleCount: number): void {
  assert.deepEqual(result.identifiers, expected, "old seed must repeat the complete event/operation sequence");
  for (const identifier of result.identifiers.slice(0, sampleCount)) {
    assert.match(identifier, frozenEventIdPattern, "replica event ID must satisfy the frozen contract event.id pattern");
  }
}

test("old seeded identifier provider repeats event and operation sequences across concurrent fresh processes", async () => {
  const plan: SamplingPlan = { processCount: 4, sampleCount: 128 };
  const program: ChildProgram = { source: buildIdentifierSamplingScript(plan, { source: oldSeededProviderSource }) };
  const results = await sampleConcurrentChildren(program, plan);
  const expected = results[0]!.identifiers;
  results.forEach((result) => assertReplicaSequence(result, expected, plan.sampleCount));
  const repeated = findRepeatedIdentifiers(results);
  assert.ok(repeated.length > 0, "old seeded provider must expose collisions through the shared collision finder");
  assert.deepEqual(new Set(repeated), new Set(expected), "every sampled value repeats across fresh processes");
});
