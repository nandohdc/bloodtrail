import { createHmac, randomBytes } from "node:crypto";
import { tagged } from "./origins.mjs";

// proposal.md data rules: random per-run key, closure only, independent key id.
// G-log implementer default: use the SDK's semantic purpose and effective tenant.
export const DIGEST_FORMAT = "sha256-hex-64";

function digestOf(key, scope, value) {
  return createHmac("sha256", key).update(`${scope}|${value}`).digest("hex");
}

// The exact scope string the declared key_scope produces. A null tenant on a
// hook scope means "no effective tenant supplied by the SDK", which falls back
// to platform-login (implementer default; G2 is withdrawn). Host-side keying
// scopes (presented-identifier, fraud-evidence) have no tenant component.
export function scopeFor({ purpose, tenant = null }) {
  return tenant === null ? purpose : `${purpose}|${tenant}`;
}

export function memoryKeying({ keyId = "k-run-01" } = {}) {
  const key = randomBytes(32);
  const metadata = Object.freeze({ key_id: keyId, purpose: "synthetic Stage P target-carrier comparison" });
  return Object.freeze({
    metadata,
    transform({ content, scope }) {
      const digest = digestOf(key, scope, content.value);
      return tagged({ value: digest, origin: content.origin });
    },
    // Recomputes the digest for a declared input under a declared scope so the
    // run can report matches_declared_input without serializing digest values.
    recompute({ value, scope }) {
      return digestOf(key, scope, value);
    },
  });
}

// Implementer default: platform-login is only the absent-effective-tenant fallback.
export function actorIdHook({ state, keying, contentOrigin }) {
  const facts = [];
  return {
    facts,
    hook: {
      path: "actor.id",
      transform(input) {
        return state.call("actor.id hook", () => {
          const tenant = input.tenantId ?? "platform-login";
          facts.push({ path: input.path, purpose: input.purpose, tenant_id: input.tenantId, key_id: keying.metadata.key_id });
          const content = tagged({ value: input.value, origin: contentOrigin });
          const transformed = keying.transform({ content, scope: `${input.purpose}|${tenant}` });
          return { value: transformed.value, key_id: keying.metadata.key_id };
        });
      },
    },
  };
}
