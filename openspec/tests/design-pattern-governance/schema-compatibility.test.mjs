import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

import { validatePolicySchema } from "../../scripts/normative-precedence/policy-validation.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, "../../..");
const schemaPath = resolve(repoRoot, "openspec/governance/schemas/change-authorization.schema.json");
const schema = JSON.parse(readFileSync(schemaPath, "utf8"));

function findJsonFiles(dir) {
  const results = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...findJsonFiles(full));
      } else if (entry.isFile() && entry.name.endsWith(".json")) {
        results.push(full);
      }
    }
  } catch {
    // Directory might not exist
  }
  return results;
}

test("SCHEMA-001 change-authorization schema compiles and validates baseline shape", () => {
  assert.equal(schema.type, "object");
  assert.equal(schema.additionalProperties, false);
  assert.ok(schema.properties.supersession, "schema should define supersession property");
});

test("SCHEMA-002 valid supersession object passes schema validation", () => {
  const validRecord = {
    $schema: "../../../governance/schemas/change-authorization.schema.json",
    schema: "bloodtrail.change-authorization.v1",
    id: "cb-018-post-t3-apply",
    change_id: "define-normative-precedence-lifecycle",
    operation: "IMPLEMENT",
    status: "CURRENT",
    authorization_scope: "Post-T3 test fixture repair",
    principal_id: "nandohdc",
    authority_role: "PROJECT_OWNER",
    grant: "IMPLEMENT",
    withheld: ["RESOLVE_DEBT", "MERGE"],
    authorized_base_commit: "e1cc9f770160bb1f3d6c8e41b40260cab8fea3ad",
    authorized_base_tree: "054c5170c1630d343ca7292b9c7c0eabe652b53e",
    authorized_proposal_commit: "0be610efe856a9ab67db3638dc307ec15ed5f5de",
    authorized_proposal_tree: "628e23a0b3d8349bdbc1b16f0665aa66f2913796",
    authorized_change_subtree: "92808225a8146a633f67aa3c4646b15a4f9f06e0",
    scope_paths: ["openspec/tests/design-pattern-governance/mutation-assurance.test.mjs"],
    boundary_parent: "1021b776331f9268578ea1fd21727521be353182",
    supersession: {
      predecessor_id: "cb-018-r3-apply",
      predecessor_path: "openspec/changes/define-normative-precedence-lifecycle/authorizations/cb-018-r3-apply.json",
      predecessor_object: "a".repeat(40),
      predecessor_introducing_commit: "b".repeat(40),
      change_id: "define-normative-precedence-lifecycle",
      operation: "IMPLEMENT"
    }
  };

  const diagnostics = validatePolicySchema(validRecord, schema, "test-record.json", schema);
  assert.deepEqual(diagnostics, [], "Valid record with supersession should have zero diagnostics");
});

test("SCHEMA-003 supersession object missing required fields fails closed", () => {
  const invalidRecord = {
    $schema: "../../../governance/schemas/change-authorization.schema.json",
    schema: "bloodtrail.change-authorization.v1",
    id: "cb-018-post-t3-apply",
    change_id: "define-normative-precedence-lifecycle",
    operation: "IMPLEMENT",
    status: "CURRENT",
    authorization_scope: "Post-T3 test fixture repair",
    principal_id: "nandohdc",
    authority_role: "PROJECT_OWNER",
    grant: "IMPLEMENT",
    withheld: ["RESOLVE_DEBT", "MERGE"],
    authorized_base_commit: "e1cc9f770160bb1f3d6c8e41b40260cab8fea3ad",
    authorized_base_tree: "054c5170c1630d343ca7292b9c7c0eabe652b53e",
    authorized_proposal_commit: "0be610efe856a9ab67db3638dc307ec15ed5f5de",
    authorized_proposal_tree: "628e23a0b3d8349bdbc1b16f0665aa66f2913796",
    authorized_change_subtree: "92808225a8146a633f67aa3c4646b15a4f9f06e0",
    scope_paths: ["openspec/tests/design-pattern-governance/mutation-assurance.test.mjs"],
    supersession: {
      predecessor_id: "cb-018-r3-apply"
      // Missing required fields
    }
  };

  const diagnostics = validatePolicySchema(invalidRecord, schema, "test-invalid-record.json", schema);
  assert.ok(diagnostics.length > 0, "Invalid supersession missing required fields must fail closed");
});

test("SCHEMA-004 supersession object with additional properties fails closed", () => {
  const invalidRecord = {
    $schema: "../../../governance/schemas/change-authorization.schema.json",
    schema: "bloodtrail.change-authorization.v1",
    id: "cb-018-post-t3-apply",
    change_id: "define-normative-precedence-lifecycle",
    operation: "IMPLEMENT",
    status: "CURRENT",
    authorization_scope: "Post-T3 test fixture repair",
    principal_id: "nandohdc",
    authority_role: "PROJECT_OWNER",
    grant: "IMPLEMENT",
    withheld: ["RESOLVE_DEBT", "MERGE"],
    authorized_base_commit: "e1cc9f770160bb1f3d6c8e41b40260cab8fea3ad",
    authorized_base_tree: "054c5170c1630d343ca7292b9c7c0eabe652b53e",
    authorized_proposal_commit: "0be610efe856a9ab67db3638dc307ec15ed5f5de",
    authorized_proposal_tree: "628e23a0b3d8349bdbc1b16f0665aa66f2913796",
    authorized_change_subtree: "92808225a8146a633f67aa3c4646b15a4f9f06e0",
    scope_paths: ["openspec/tests/design-pattern-governance/mutation-assurance.test.mjs"],
    supersession: {
      predecessor_id: "cb-018-r3-apply",
      predecessor_path: "openspec/changes/define-normative-precedence-lifecycle/authorizations/cb-018-r3-apply.json",
      predecessor_object: "a".repeat(40),
      predecessor_introducing_commit: "b".repeat(40),
      change_id: "define-normative-precedence-lifecycle",
      operation: "IMPLEMENT",
      extra_field_disallowed: true
    }
  };

  const diagnostics = validatePolicySchema(invalidRecord, schema, "test-invalid-record.json", schema);
  assert.ok(diagnostics.length > 0, "Supersession with additional properties must fail closed");
});

test("SCHEMA-005 historical authorization records pass backward-compatibility check", () => {
  const changesDir = resolve(repoRoot, "openspec/changes");
  const allJson = findJsonFiles(changesDir);
  const authFiles = allJson.filter((f) => {
    return f.includes("/authorizations/") || f.endsWith("-apply-authorization.json") || f.includes("authorization.json");
  });

  for (const authFile of authFiles) {
    let data;
    try {
      data = JSON.parse(readFileSync(authFile, "utf8"));
    } catch {
      continue;
    }
    if (data.schema === "bloodtrail.change-authorization.v1") {
      const diagnostics = validatePolicySchema(data, schema, authFile, schema);
      assert.deepEqual(
        diagnostics,
        [],
        `Historical record ${authFile} must remain schema-valid under extended schema`
      );
    }
  }
});
