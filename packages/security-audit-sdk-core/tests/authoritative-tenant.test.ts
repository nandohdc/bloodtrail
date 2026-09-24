import { strict as assert } from "node:assert";
import { test } from "node:test";
import { SecurityAuditSdkError, authoritativeTenant } from "../dist/index.js";

// authoritativeTenant's input type restates its runtime rule (#582). The compile-only assertions in
// tests/types/index.ts pin the type's side of that rule, and this file pins the runtime's side.
const FORCED_INPUTS = [
  [{}, "/tenant/scope"],
  [{ scope: "tenant", resource_tenant_id: "tenant_alpha" }, "/tenant/effective_tenant_id"],
  [{ scope: "tenant", effective_tenant_id: "tenant_alpha" }, "/tenant/resource_tenant_id"],
  [{ scope: "tenant", effective_tenant_id: "", resource_tenant_id: "tenant_alpha" }, "/tenant/effective_tenant_id"],
  [{ scope: "cross_tenant", resource_tenant_id: "tenant_alpha" }, "/tenant/effective_tenant_id"],
  [{ scope: "cross_tenant", effective_tenant_id: "tenant_alpha" }, "/tenant/resource_tenant_id"],
] as const;

test("authoritativeTenant forced past its input type still throws a configuration error at the missing path", () => {
  for (const [input, path] of FORCED_INPUTS) {
    assert.throws(() => authoritativeTenant(input as never), (error: unknown) => {
      assert.ok(error instanceof SecurityAuditSdkError);
      assert.deepEqual(error.toJSON(), { code: "SDK_INVALID_CONFIGURATION", category: "configuration", path });
      return true;
    });
  }
});

test("authoritativeTenant accepts each scope with only the identifiers its scope requires", () => {
  const identifiers = { effective_tenant_id: "tenant_alpha", resource_tenant_id: "tenant_alpha" };
  assert.equal(authoritativeTenant({ scope: "tenant", ...identifiers }).scope, "tenant");
  assert.equal(authoritativeTenant({ scope: "cross_tenant", ...identifiers }).scope, "cross_tenant");
  assert.equal(authoritativeTenant({ scope: "platform" }).scope, "platform");
  assert.equal(authoritativeTenant({ scope: "tenantless" }).scope, "tenantless");
});
