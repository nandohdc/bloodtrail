import assert from "node:assert/strict";
import test from "node:test";
import { evaluateProbe } from "../p-map/evaluate.mjs";
import { evaluationFixture } from "./p-map-evaluation-fixtures.mjs";

const result = evaluateProbe(await evaluationFixture());
const byId = new Map(result.verdicts.map((row) => [row.case_id, row]));
const FINDINGS = [
  { id: "S-LOGOUT", observed: { actor_matches_subject: true, authorization: "not_applicable", admin_actor: "administrator",
    admin_authorization: "deny", tenantless_login_accepted: true, tenantless_logout_accepted: false },
    analysis: [/hook keying/, /fail_closed/, /capturing sink measures no durability guarantee/] },
  { id: "S-MFA", observed: { subject_present: false, actor_id_present: false, credential_reference_present: false },
    analysis: [/G36 owner decision/, /design input/] },
  { id: "S-CONTACT", observed: { object_item_accepted: true, object_kind_accepted: true, unregistered_accepted: true,
    item_4000_accepted: true, tenantless_accepted: false }, analysis: [/no registry, enum or item maxLength/, /define no vocabulary/] },
  { id: "S-LOCK", observed: { target_absent: true, host_linkage_preserved: true, tenantless_accepted: false },
    analysis: [/G36/, /#806/, /implementer default requiring owner review/] },
  { id: "S-UNLOCK", observed: { scheduled_commit: "committed", tenantless_accepted: false }, analysis: [/Lazy expiry is analysis only/, /synthesize/] },
  { id: "S-ROTATE", observed: { original_is_request: true, tenantless_password_accepted: false, tenantless_api_accepted: false,
    factor_replacement_complete: true }, analysis: [/reset-only/, /cannot substitute/, /Tenantless login is accepted/] },
];
for (const oracle of FINDINGS) test(`P-map ${oracle.id} derives cited findings without promoting profile policy or real-run claims`, () => {
  const findings = byId.get(oracle.id).findings;
  assert.deepEqual(findings.observed, oracle.observed);
  for (const pattern of oracle.analysis) assert.match(findings.analysis.join("; "), pattern);
  assert(findings.basis.length > 0);
});
