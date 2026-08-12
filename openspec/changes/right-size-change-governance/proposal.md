## Why

The `remediate-security-audit-sdk-adversarial-review` change closed at 91 tasks, and its ten-task
governance tail cost several working days for a private, unpublished, undeployed package. The
2026-08-11 review pass showed sharply where that effort did and did not pay:

- **Executing checks found real defects.** Re-running the extension trust-level matrix refuted
  finding S-1 and prevented an unnecessary breaking change to public API. Reading
  `git log --format=%P` revealed that the packet's recorded review candidate was squash-merged and
  is not an ancestor of `main` — five days after the fact.
- **Narrating checks found nothing.** Task 12.6 restated exclusions that `test:scope`,
  `test:package`, and `test:dependencies` already enforce on every CI run. Task 12.7 re-ran what CI
  runs anyway. Task 12.8 was worded as an action that had already happened, so most of its effort
  went into explaining why it was not being repeated.

The governance is not too rigorous; it is rigorous in the wrong medium. No spec requires this
shape — the canonical requirement *"Adversarial remediation verification and approval are
exact-commit governed"* is scoped to that specific remediation. The ten-task tail is precedent and
habit, so nothing currently prevents the next change from inheriting it. This change writes down a
proportionate rule before that happens.

## What Changes

- Introduce a `change-governance` capability defining how changes are governed, sized to the
  authorization state of what they touch.
- **Governance scales with authorization.** While a workspace is unpublished and undeployed —
  a condition already mechanically enforced — changes carry lightweight governance. Full
  attestation reactivates when publication or deployment is sought.
- **Assertions become gates.** Any claim about repository state that a script can check is
  enforced by a gate and cited, not restated in prose.
- **The publication-path exclusion covers tracked content, not workflow files alone.** A publication
  command in a tracked manifest script, a workflow that reaches it through `npm run`, a tracked
  manifest that is not private, and local automation a workflow invokes are all rejected. The gate
  forbids the capability across the scanned surface rather than claiming to trace shell reachability.
- **A content binding is mechanically resolved.** A signed record declares a candidate root tree and
  one entry per reviewed path; Git resolves the path within that tree and the gate compares the
  result to the declared object. Claiming one path while supplying another path's tree is rejected,
  and a reviewed path may not contain the record that binds it.
- **Every declared archive movement is anchored in history.** Enforcement covers all declared
  attestations, not one hard-coded change, and the comparison anchor is the commit history shows
  introduced the archive — so rewriting an archived file together with its recorded object fails.
- **Merge and history properties are gate-enforced.** A new check asserts merge-commit parentage
  and that governed commits remain ancestors of `HEAD`. This replaces prose merge verification and
  would have caught the 2026-08-10 squash on the day it happened.
- **Review and owner decision collapse into one signed record**, bound to a **content object**
  (tree or subtree) rather than a commit hash. Commit-hash binding failed twice in the remediation
  because a commit cannot record its own hash.
- **Superseded governance records are superseded in version control, not in-document.** The
  remediation packet reached roughly 1,500 lines by preserving every prior revision inside itself,
  which is how it came to contain revisions describing revisions.
- **BREAKING** for governance process only: future changes do not inherit the ten-task tail. No
  runtime, API, contract, or package behavior changes.

## Capabilities

### New Capabilities
- `change-governance`: how OpenSpec changes in this repository are verified, attested, and
  archived, and how that weight scales with the authorization state of the affected workspace.

### Modified Capabilities

None. The existing requirement *"Adversarial remediation verification and approval are
exact-commit governed"* in `security-audit-sdk-core` is scoped to the completed adversarial
remediation and is deliberately left intact as archived history.

## Impact

- **New:** `openspec/specs/change-governance/spec.md`; a merge and history property check and an
  archive-attestation anchor check under `packages/security-audit-sdk-core/scripts/`, both wired into
  `validate` and `verify`, each with its own differential control suite.
- **Modified:** `CONTRIBUTING.md` governance and task-granularity guidance; `README.md` and
  `.hermes.md` validation gate tables; the publication-path and governance-history gates and their
  controls; `verification-lifecycle.json` gains an anchoring commit per movement attestation.
- **Unchanged and explicitly out of scope:** every executable gate that exists today; the rule that
  AI analysis is never review, approval, or assurance, which caught both the incorrect S-1 finding
  and the incorrect merge description; the frozen contract; the authorization boundary; and the SDK
  package, whose bytes this change does not touch.
- **Not addressed here:** the disposition of `establish-design-pattern-governance`, which is
  handled separately.
