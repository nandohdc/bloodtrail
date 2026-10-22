// Hand-written from #804 comment 6137646538 rubric, #795 G10/G36,
// contract.source.json:3126-3161,2902-2934,2956-2992,3014-3050,
// :3182-3275,3814-3855, and event-contract spec.md:149-167 at 8e6cdf7.
// Independent of signal-rules, verdicts, evaluator and eventual frozen JSON.
export const SIGNAL_ORACLE = [
  { id: "S-LOGOUT", verdict: "FITS", best: ["L1"],
    finding: ["actor_matches_subject", true], clause: "Catalog investigation explicitly covers logout" },
  { id: "S-MFA", verdict: "FITS", best: ["M1"],
    finding: ["subject_present", false], clause: "Failed authentication covers MFA failure, targetless under G36" },
  { id: "S-CONTACT", verdict: "STRAINED", best: ["C1", "C5"],
    finding: ["object_item_accepted", true], clause: "Generic modification keeps authority; factor lifecycle covers only factor phone" },
  { id: "S-LOCK", verdict: "STRAINED", best: ["K2a"],
    finding: ["host_linkage_preserved", true], clause: "Genuine policy allow is an implementer default, generic purpose" },
  { id: "S-UNLOCK", verdict: "STRAINED", best: ["U1"],
    finding: ["scheduled_commit", "committed"], clause: "Independent commit, not rollback of original lock" },
  { id: "S-ROTATE", verdict: "STRAINED", best: ["R2", "R4", "C5"],
    finding: ["original_is_request", true], clause: "Credential-lifecycle reading admits real request/completion; API/factors are distinct components" },
];

export const ALTERNATIVE_ORACLE = {
  K2a: { verdict: "MISREPRESENTS", condition: "Automatic threshold policy evaluation is not a genuine authorization decision",
    consequence: "Criterion 2 fails on lockout" },
  R2: { verdict: "MISREPRESENTS", condition: "Reset only: password reset purpose does not cover authenticated password change",
    consequence: "Criterion 2 fails on password-change coverage; R4 API/other credentials and C5 MFA factors do not substitute" },
};

export function equal(path, value) {
  return { path, op: "equal", value };
}
