import { measuredField } from "./evidence.mjs";
import { hostLinkagePreserved } from "./lock-facts.mjs";

const CONTRACT = "contracts/security-audit/source/contract.source.json";
const SEMANTIC = "packages/security-audit-sdk-core/src/validation/semantic.ts:49-56,66,391-399";
// Analysis is explicitly distinguished from observed structural facts. This
// module decides no consumer policy, delivery guarantee or category vocabulary.
function logout(context) {
  return { observed: {
    actor_matches_subject: measuredField(context, "L1/not-applicable", "signal.actor_matches_subject"),
    authorization: measuredField(context, "L1/not-applicable", "signal.authorization_decision"),
    admin_actor: measuredField(context, "L5c/denied-not-committed", "signal.actor_type"),
    admin_authorization: measuredField(context, "L5c/denied-not-committed", "signal.authorization_decision"),
    tenantless_login_accepted: measuredField(context, "L3/tenantless-login", "accepted"),
    tenantless_logout_accepted: measuredField(context, "L3/tenantless", "accepted") },
  analysis: ["Logout vs administrator revocation uses actor/subject equality and authorization; no logout reason code",
    "Per-path hook keying can destroy actor/subject equality; findings only, profile decision belongs to #806",
    "Containment revocations are transaction_critical: fail_closed before business commit can keep a compromised session alive; capturing sink measures no durability guarantee"],
  basis: [`${CONTRACT}:518-536,596-604,3126-3161`, SEMANTIC, "packages/security-audit-sdk-core/src/events.ts:311-339"] };
}

function mfa(context) {
  return { observed: { subject_present: measuredField(context, "M1/tenantless", "signal.subject_present"),
    actor_id_present: measuredField(context, "M1/tenantless", "signal.actor_id_present"),
    credential_reference_present: measuredField(context, "M1/tenantless", "signal.credential_reference_present") },
  analysis: ["G36 owner decision allows second-factor reasons but no target; account attribution limitation remains a contract-field design input"],
  basis: ["#795 decision log G36", `${CONTRACT}:2902-2934`] };
}

function contact(context) {
  return { observed: { object_item_accepted: measuredField(context, "C2a/object", "accepted"),
    object_kind_accepted: measuredField(context, "C2a/object-kind", "accepted"),
    unregistered_accepted: measuredField(context, "C2a/unregistered", "accepted"),
    item_4000_accepted: measuredField(context, "C2a/ascii-4000", "accepted"),
    tenantless_accepted: measuredField(context, "C6/tenantless", "accepted") },
  analysis: ["Free-form change_categories: no registry, enum or item maxLength; objects allowed; define no vocabulary",
    "8192-byte input scan and maxItems 16 are separate bounds; generic contact carrier does not name contact changes"],
  basis: [`${CONTRACT}:305-573,2286-2296,3814-3855`, "contracts/security-audit/schema/security-audit-event.schema.json:1197-1207"] };
}

function lock(context) {
  return { observed: { target_absent: measuredField(context, "K1/attempt", "signal.target_absent"),
    host_linkage_preserved: hostLinkagePreserved(context),
    tenantless_accepted: measuredField(context, "K2a/tenantless", "accepted") },
  analysis: ["G36 permits rate_limited but still no target; preserved host-supplied request and correlation IDs allow a host-side join to the account-resolved lock, not SDK attribution",
    "Whether such joins are forbidden belongs to consumer profile #806, not P-map",
    "Genuine automatic threshold authorization is an implementer default requiring owner review"],
  basis: ["#795 decision log G36", `${CONTRACT}:3849`, "packages/security-audit-sdk-core/src/events.ts:238-272", SEMANTIC] };
}

function unlock(context) {
  return { observed: { scheduled_commit: measuredField(context, "U1/scheduled", "occurrence.commit_state"),
    tenantless_accepted: measuredField(context, "U1/tenantless", "accepted") },
  analysis: ["Lazy expiry is analysis only: no commit point; host would have to synthesize one, unlike the explicitly committed scheduled variant",
    "Independent later release is not compensation/rollback of the original lock"],
  basis: [`${CONTRACT}:3814-3855`, "openspec/specs/security-audit-event-contract/spec.md:149-167", SEMANTIC] };
}

function precursorIsRequest(context) {
  const name = measuredField(context, "R2/pair-request", "occurrence.event_name");
  return name === null ? null : name === "bloodtrail.audit.account.password_reset.requested";
}

function rotation(context) {
  return { observed: { original_is_request: precursorIsRequest(context),
    tenantless_password_accepted: measuredField(context, "R2/tenantless-completed", "accepted"),
    tenantless_api_accepted: measuredField(context, "R4/tenantless", "accepted"),
    factor_replacement_complete: measuredField(context, "C5/enrolled", "replacement.complete") },
  analysis: ["Password change coverage uses credential-lifecycle reading (implementer default); reset-only makes it a misfit",
    "API/other rotation and MFA-factor replacement cannot substitute for password-change coverage",
    "Tenantless login is accepted; logout, contact change, lockout and rotation require tenant scope"],
  basis: [`${CONTRACT}:3238-3275,3814-3855`, SEMANTIC] };
}

const FINDINGS = { "S-LOGOUT": logout, "S-MFA": mfa, "S-CONTACT": contact,
  "S-LOCK": lock, "S-UNLOCK": unlock, "S-ROTATE": rotation };
export function signalFindings(id, context) {
  return FINDINGS[id](context);
}
