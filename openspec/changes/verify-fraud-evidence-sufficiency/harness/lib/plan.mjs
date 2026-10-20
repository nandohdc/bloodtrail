import assert from "node:assert/strict";

export function requireDatabasePlan({ databaseScratch = false }) {
  assert.equal(typeof databaseScratch, "boolean", "databaseScratch must be a boolean opt-in");
}

export function requireProbe({ probe, ticket }) {
  assert.equal(typeof probe, "string", "probe is required");
  assert.match(probe, /^P-[a-zA-Z]+$/, "invalid probe");
  assert(Number.isSafeInteger(ticket) && ticket > 0, "ticket is required");
}

export function requireRoles({ roles }) {
  assert(Array.isArray(roles) && roles.length > 0, "roles are required");
  for (const entry of roles) assert.equal(typeof entry.role, "string", "role is required");
}

export function probeProcessPath({ prefix, probeDirectory }) {
  assert.equal(typeof prefix, "string", "harness prefix is required");
  assert(prefix.length > 0, "harness prefix is required");
  assert.equal(typeof probeDirectory, "string", "probe directory is required");
  assert.match(probeDirectory, /^p-[a-z]+$/, "invalid probe directory");
  return `${prefix}/${probeDirectory}/probe-process.mjs`;
}
