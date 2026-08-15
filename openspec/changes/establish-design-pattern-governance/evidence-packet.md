# Evidence Packet — establish-design-pattern-governance

Discharges task 8.6. Read-only record of what was run and what it showed, for task groups 1 through
8. Groups 9 and 10 are **not** covered: they are withheld by the apply authorization, and their
states are reported separately below.

Technical candidate branch: `feat/design-pattern-governance`
Authorized proposal baseline: `e536c9b74ec009a1bfad1c1561d478cb48600ba4`

## Commands and outcomes

| Command | Outcome |
| --- | --- |
| `openspec validate establish-design-pattern-governance --strict` | valid |
| `openspec validate --all --strict` | 5 passed, 0 failed |
| `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment` | passed |
| `node openspec/scripts/check-design-pattern-governance.mjs --phase implementation` | passed |
| `node openspec/scripts/check-design-pattern-governance.mjs --phase final` | fails closed with `signed-review-stale` — the expected R15 state against the historical signed record; see "R15 recovery controls" below. Full final success is required on the replacement signed record S_NEW |
| `node openspec/scripts/check-design-pattern-governance.mjs --phase bootstrap` | passed; enforcement remains pending until the dedicated activation record exists |
| `node openspec/scripts/check-design-pattern-governance.mjs --phase activation` | fails closed: `activation-commit-absent` — expected, no activation record exists |
| `node openspec/scripts/run-governance-dual-check.mjs` | candidate passed; baseline unavailable, see below |
| `node --test openspec/tests/design-pattern-governance/*.test.mjs` | 192 tests, 192 pass, 0 fail |
| `npm run check:generated --prefix packages/security-audit-sdk-core` | generated artifacts current |
| `npm run validate --prefix packages/security-audit-sdk-core` | full chain green, 194 verification tests pass |
| `npm run validate --prefix contracts/security-audit` | 14 tests pass |
| `gh api repos/nandohdc/bloodtrail/branches/main/protection/required_status_checks` | strict enforcement verified for all nine contexts; exact response digest `sha256:f74b4db9e0858bc20f288f3f5596b6b233b77ecd65791dee81816c707893ba10` |
| Required `codescene delta` on `6c2269c459a3fc16ae54d92fda69100fe5f9204f` | passed |
| CodeScene Cloud review on `6c2269c459a3fc16ae54d92fda69100fe5f9204f` | passed |
| DeepScan on `6c2269c459a3fc16ae54d92fda69100fe5f9204f` | advisory result currently green: `0 new and 0 fixed issues`; recorded as an observed external status, not as approval or assurance |

The activation fail-closed result is the correct answer, not a defect: activation requires an
activation record, which does not exist and must not exist before merge. After the owner added
`design-pattern-governance` to the existing strict required-context set without removing or weakening
any prior context, bootstrap passed against the final uncommitted candidate. The exact API response is
preserved by the digest above; activation must capture fresh API evidence because repository settings
are mutable.

The dual-check baseline is unavailable because **no governance checker exists at the merge base** —
this change introduces it. The driver reports that explicitly rather than passing silently. Once this
lands, every later governance-core change gets both runs. The asymmetry is nonetheless proven under
test, below.

## Structural assertions (task 8.1)

| Assertion | Expected | Found |
| --- | --- | --- |
| Normative requirements | 24 | 24 |
| Scenarios | 129 | 129 |
| One `WHEN` and one `THEN` per scenario | all | all |
| Controlled values / memberships / families | 29 / 30 / 10 | 29 / 30 / 10 |
| Catalog entries | 24 | 24 |
| Registry patterns | 24 | 24 |
| Registry invariants | — | 88 (82 required, 6 conditional) |
| Ambient Context invariants, all required | 8 | 8 |
| Tasks | 98 | 98 |

## Proposal-baseline inspection (task 8.2)

Read from `git show e536c9b:…/tasks.md`, the immutable authorized baseline, not from current task
state:

- 98 tasks present at the baseline;
- 0 checked at the baseline;
- task IDs unique;
- IDs sequential within each of the 10 groups.

## Gate-enforced scope exclusions (task 8.4)

Per the canonical `change-governance` capability, exclusions are discharged by citing the enforcing
gate. All ran green in the SDK chain above:

`test:scope` · `test:contract-immutability` · `test:changed-paths` · `test:publication-path` ·
`test:governance-history` · `test:archive-attestations` · `test:coherence` · `test:git`

## Determinism, whitespace, and index (task 8.5)

- Repeated checker runs over an unchanged tree produce byte-identical stdout — asserted in
  `self-governance.test.mjs`.
- Diagnostics are emitted in code-point-sorted order, asserted independently of the order failures
  arise in.
- No trailing whitespace, no CR byte, and a final newline in every changed file.
- Git index empty at verification time; `test:git` confirms.

## Control coverage

145 diagnostic identifiers are reachable in the checker. 95 are asserted **by exact identifier** in
the test suite — not merely by a non-zero exit, because a test that accepts any failure passes when
the checker breaks for an unrelated reason.

The remaining 50 are shape-level schema diagnostics (`schema-type`, `schema-pattern`,
`schema-length`, …) and secondary variants of covered cases (`assessment-invalid-json`,
`catalog-absent`, `template-absent`). They are reachable and exercised indirectly; they do not each
have a dedicated named-identifier assertion. That is a stated gap, not a claim of completeness.

## R15 recovery controls

Three post-signing defects were found by independent review and are repaired by the original
technical change; a fourth surfaced during activation preflight, a fifth on the first pull request
after activation, a sixth when repairing the fifth, and a seventh on the first generated-agent
workflow refresh after activation, each repaired by its own re-signing delta:

1. **Review freshness was specified but not enforced.** R15 requires any post-signing normative
   change to invalidate the signed record, yet the checker passed while six normative paths had
   changed after the historical signed record `f53a07115e91da1fc4f0ae7469d5899b1bd5afa4`.
   `review-freshness.mjs` now derives everything from history: it locates the current signed record
   for each active change, finds the commit that introduced those exact record bytes after the bound
   technical commit, requires that commit to be governance-record-only, and rejects every commit in
   `T..HEAD` that touches a normative path. Merge commits count only content new relative to every
   parent, so an identity-preserving merge does not invalidate the record it carries. The seven new
   diagnostics (`signed-record-source-absent`, `signed-record-source-invalid`,
   `signed-record-ambiguous`, `signed-record-removed`, `signed-record-uncommitted`,
   `signed-review-history-unavailable`, `signed-review-stale`) are each asserted by exact identifier
   in `review-freshness.test.mjs`. Against the current head, final verification now names exactly the
   six discovered post-sign normative changes and permits the record-only and plan-documentation
   commits — the fail-closed answer. A dangling-binding control completes it: any signed record whose
   change id matches no active change, no archived change directory, and no grandfathering entry is
   rejected as ambiguous. Both exemption sets are content-gated, not name-gated: an active change
   only counts when its assessment exists, and an archive only counts when its assessment or proposal
   is the byte-identical object history carried at the active change path. Renaming or deleting a
   change directory, stripping its assessment, or planting a contentless or foreign archive directory
 therefore cannot silently de-activate the record that binds it. A stated residual: a byte-for-byte
 copy of a real historical archive artifact is indistinguishable from a genuine relocation at this
 checker's level, and the archive-movement attestations gate remains the higher authority for it.
2. **The Hermes documentation exception was too broad.** `.hermes/` classified every Hermes path as
   documentation, including configuration, scripts, skills, and hooks. The class now names only
   `.hermes/plans/`; sibling Hermes content fails closed as unclassified, proven by five perimeter
   tests.
3. **The governance-history mutation suite normalized its own expectations.** Aggregate totals were
   derived from the mutable manifest, so removing the whole
   `establish-design-pattern-governance` record or narrowing its reviewed-content binding kept the
   suite green. `governance-history-mutations.test.mjs` now carries an independent expected record
   inventory (record IDs, one record per change, minimum reviewed paths, no duplicate bindings) and
   two controls that reproduce the bypasses and show the inventory rejecting them.
4. **Disposable fixtures inherited the live activation record.** The fixture seeder copies the
   governance directory verbatim, so once a real activation record exists it lands in every fixture
   and fails them all: its merge/technical/signed bindings resolve only in the real repository. The
   seeder now excludes the record, and an activation-suite regression asserts fixtures never inherit
   it.
5. **A pull-request preview was misread as a second activation introduction.** The activation
   commit is derived from history rather than named by the record, and the derivation counted any
   two-parent commit as introducing the record because it only ever compared against a single
   parent. A pull-request checkout is a synthetic two-parent merge whose first parent is the base
   branch, which after activation already carries the record — so every ordinary preview produced a
   second candidate beside the real activation commit, the derivation demanded exactly one, and the
   required check failed closed on each of them with `activation-commit-absent`. A commit now
   introduces a path only when the path is present at it and absent from *every* parent, the same
   rule `pathsChangedByCommitIncludingMerges` already applies to merge-specific paths. The rule is
   actor-neutral and knows nothing about pull requests: single-parent behaviour is unchanged, and a
   two-parent commit that genuinely introduces the record is still rejected for its parent count.
   Three activation-suite regressions cover the preview shape, a record arriving only by merging a
   side branch, and that parent-count guard.
6. **The dual check could not distinguish a repair from self-approval.** `run-governance-dual-check`
   failed whenever the baseline failed, so a candidate that *passes* where the baseline *fails* was
   always read as self-approval. That is also exactly what repairing a false positive in the baseline
   looks like, and the verdicts alone cannot separate the two — so no correction to a checker false
   positive could ever land, including defect 5. Repairing defect 5 hit this immediately: the
   baseline raised `activation-commit-absent` on the pull-request preview while the candidate
   passed. The disagreement is now tolerated only when one canonical current signed record binds it
   in advance, under `openspec/governance/schemas/baseline-disagreement.schema.json`, which the dual
   check loads and enforces rather than duplicating in code. Every dimension is exact rather than
   sufficient: one singular acceptance on one record and never combined across records; the declared
   diagnostics equal to the raised ones as `{id, path}` pairs, so no superset can pre-approve
   rejections nobody reviewed; the named technical commit equal to the record's own `reviewedCommit`,
   with the record commit derived from history and required to be that commit's direct child; and
   the named baseline and phase equal to those actually compared. Naming the baseline makes the
   acceptance expire by itself — once the repair lands the baseline moves and it matches nothing, so
   the gate returns to full strength with nothing to remember to remove. Unreadable policy, record,
   or schema all leave the disagreement rejected. Self-governance regressions cover the accepting
   case and every rejection dimension named above, and the original self-approving-candidate control
   still fails the gate.

   The narrowing is real and is recorded as such: the dual check no longer fails on every
   disagreement. What it does not narrow is the baseline's own verdict, which remains the thing a
   candidate cannot reach. This does not close the pre-existing fact that the dual-check script is
   itself candidate-editable; its integrity has always rested on the baseline checker plus human
   review, not on the script.
7. **Repository-managed generated agent instructions matched no path class.** OpenSpec 1.9 regenerated
   48 instruction files under `.agents/skills/`, `.claude/commands/opsx/`, `.claude/skills/`, and
   `.hermes/skills/`. The perimeter correctly failed closed with `path-unclassified`. Before this
   correction R14 named Hermes integration as governance-core and R22 governed Hermes regeneration,
   but the actor-neutral mirrored roots were not stated explicitly in the contract or policy. This
   correction generalizes those controls across all repository-managed generated agent integrations.
   The four roots are now governance-core, normative, owned by this full assessment, and still
   explicitly non-authoritative;
   they do not inherit the documentation-only exception. A perimeter regression checks a
   representative path from every root against classification, governance-core applicability,
   review freshness, and non-authoritative-source status. The focused test was observed failing with
   `unclassified` before the policy change and passes afterward. The complete 192-test governance
   suite passes. Before the replacement
   signed record exists, candidate and trusted-baseline final checks both reject the generated files
   with `signed-review-stale`, which is the intended exact-commit review boundary rather than another
   checker defect.

The signed-record source is now closed policy: `review_freshness.record_path` is a required policy
section validated as a well-formed repository path inside the governance-record-only allowlist, so
the checker has exactly one fail-closed source for active signed records.

**Four dead controls were found and fixed during verification.** `checkOpenSpecAssociation`,
`checkGrandfatheredScope`, `checkEmergencyTermination`, and `compareSchemaCompatibility` were
exported, fully written, and called from nowhere — including R11's headline "code changes without
OpenSpec" check. Two further exports (`verifyCommitReachable`, `isRepositoryRelative`) were genuinely
unused and were deleted rather than left looking like controls. Coverage measurement is what surfaced
this; without it the suite would have been green and four requirements unenforced.

Three further defects surfaced the same way and were fixed:

- **Loaders reported failure on any prior diagnostic.** `loadSchema`, `loadPolicy`, `loadRegistry`,
  and `loadCatalog` returned `null` whenever `sink.ok` was false — meaning one unrelated earlier
  failure silently disabled every check downstream of them.
- **The hidden-implementation check skipped untracked files.** It read only committed blobs, so it
  could not fire on the state a contributor is actually in when running it locally.
- **The grandfathered-scope filter excluded exactly the paths it was meant to catch**, so the control
  could never fire.

## Lifecycle states (task 8.10)

Reported independently. Evidence for one is not evidence for another.

| State | Status |
| --- | --- |
| Apply authorization | **granted** — groups 1–8 only, recorded in `apply-authorization.md` |
| Technical commit readiness | **yes** — after the R15 recovery controls above, subject to the disposable-copy validation and independent reviews of the exact replacement commit |
| Signed governance record | **superseded and stale** — historical `S = f53a07115e91da1fc4f0ae7469d5899b1bd5afa4` bound `T = 4f1ee3b544add8d991b3b6a0822dbe9e2028086d`; six normative paths changed after it, so it cannot bind current content. A replacement record for the replacement technical commit requires fresh explicit owner approval |
| Merge readiness | **blocked** — requires the replacement signed record and exact-head checks |
| Activation readiness | **blocked** — required-status enforcement is verified, but T, S, M, and activation-time evidence do not yet exist |
| Canonical materialization | **not started** — `openspec/specs/software-design-pattern-governance/` deliberately absent |
| Archive readiness | **not started** |
| Production / publication authorization | **withheld** — unchanged by anything in this change |

## Known gaps

1. **Task 7.8 is not discharged by an expansion.** See `hermes-allowed-tools-finding.md`: the
   `allowed-tools` field pre-approves rather than restricts, its value is a hardcoded constant in the
   OpenSpec CLI with no configuration key, and the generated directories must not be hand-edited. The
   premise the task was written against turned out to be false, and that is recorded rather than
   worked around.
2. **The dual-check baseline cannot run for this change**, because this change introduces the
   checker. The requirement anticipates this — it is why bootstrap demands exact approved objects and
   human review. The asymmetry itself is proven under test: a candidate checker edited to return
   success unconditionally passes its own run while the trusted baseline still rejects the evidence.
3. **Required-check evidence is time-bound external state.** The governance CI job is now a strict
   required status check, but the branch-protection response must be captured again immediately before
   merge and activation rather than treating this digest as permanent evidence.
4. **50 of 145 diagnostics lack a dedicated named assertion**, as detailed above.
5. **Required `codescene delta` and the advisory Cloud review have passed on the current head**, but
   they must pass again on the published replacement technical commit `T_NEW` and on the signed
   record commit `S_NEW`. No CodeScene signal is suppressed and the two signals remain distinct.
6. **DeepScan is currently green on the observed head.** It is an advisory external status only; it is
   neither approval nor assurance, and it must be re-read on the published replacement commits rather
   than assumed stable.
7. **The replacement technical commit must remain red on final verification until the replacement
   signed record exists.** The discovered stale state (six post-sign normative paths) makes
   `signed-review-stale` the correct fail-closed answer against the historical record; any other
   failure on exact `T_NEW`, or any failure at all on exact `S_NEW`, blocks the lifecycle.
8. **The generated-agent refresh requires a new exact-commit review.** Its replacement technical
   commit must remain red only with `signed-review-stale` until a governance-record-only direct child
   binds all repository-managed generated instruction roots and the cumulative governance evidence.
   AI review, authorship, the pull-request assignment, and this evidence packet are not approval.
