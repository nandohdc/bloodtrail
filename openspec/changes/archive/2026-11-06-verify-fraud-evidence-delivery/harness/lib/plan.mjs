import assert from "node:assert/strict";

export function requireProbe({ probe, ticket }) {
  assert.equal(typeof probe, "string", "probe is required");
  assert.match(probe, /^S2-[a-z]+$/, "invalid probe");
  assert(Number.isSafeInteger(ticket) && ticket > 0, "ticket is required");
}

// Stage 2 runs two permission-restricted processes per probe: the sender and the ingress.
export const ROLE_SCRIPTS = Object.freeze({ sender: "sender-process.mjs", ingress: "ingress-process.mjs" });

export function roleProcessPath({ prefix, probeDirectory, role }) {
  assert.equal(typeof prefix, "string", "harness prefix is required");
  assert(prefix.length > 0, "harness prefix is required");
  assert.match(probeDirectory, /^[a-z]+$/, "invalid probe directory");
  assert(Object.hasOwn(ROLE_SCRIPTS, role), `unknown role: ${role}`);
  return `${prefix}/${probeDirectory}/${ROLE_SCRIPTS[role]}`;
}
