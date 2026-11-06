// Seeded synthetic workload material for Stage 2. Every identifier is synthetic and opaque (never
// email-like), and every address comes from a documentation range, so a run cannot carry or imply real
// data. The seed is frozen in a probe's expectations file; the same seed yields the same ground truth.
import assert from "node:assert/strict";

export const DOCUMENTATION_PREFIXES = Object.freeze(["192.0.2.", "198.51.100.", "203.0.113."]);
const OPAQUE = /^syn-[a-z]+-[0-9a-f]{8}$/;

export function seededRandom(seed) {
  assert(Number.isSafeInteger(seed) && seed > 0, "workload seed must be a positive integer");
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4_294_967_296;
  };
}

export function opaqueId({ kind, random }) {
  assert.match(kind, /^[a-z]+$/, "opaque id kind must be lowercase letters");
  const value = Math.floor(random() * 4_294_967_296).toString(16).padStart(8, "0");
  return `syn-${kind}-${value}`;
}

export function documentationAddress({ random }) {
  const prefix = DOCUMENTATION_PREFIXES[Math.floor(random() * DOCUMENTATION_PREFIXES.length)];
  return `${prefix}${1 + Math.floor(random() * 254)}`;
}

export function isSyntheticId(value) {
  return OPAQUE.test(value);
}

export function isDocumentationAddress(value) {
  return DOCUMENTATION_PREFIXES.some((prefix) => value.startsWith(prefix)) && /^(\d+\.){3}\d+$/.test(value);
}

// S2 stop condition: non-synthetic data. Every identifier and address a probe generates passes these
// checks before any traffic; a planted email-like identifier must fail them.
export function assertSynthetic({ ids, addresses }) {
  for (const id of ids) assert(isSyntheticId(id), `non-synthetic identifier refused: ${id}`);
  for (const address of addresses) assert(isDocumentationAddress(address), `non-documentation address refused: ${address}`);
  return { ids: ids.length, addresses: addresses.length };
}
