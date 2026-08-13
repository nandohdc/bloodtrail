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
| `node openspec/scripts/check-design-pattern-governance.mjs --phase final` | passed |
| `node openspec/scripts/check-design-pattern-governance.mjs --phase bootstrap` | fails closed: `required-check-evidence-absent` — expected, see below |
| `node openspec/scripts/check-design-pattern-governance.mjs --phase activation` | fails closed: `activation-commit-absent` — expected, no activation record exists |
| `node openspec/scripts/run-governance-dual-check.mjs` | candidate passed; baseline unavailable, see below |
| `node --test openspec/tests/design-pattern-governance/*.test.mjs` | 136 tests, 136 pass, 0 fail |
| `npm run check:generated --prefix packages/security-audit-sdk-core` | generated artifacts current |
| `npm run validate --prefix packages/security-audit-sdk-core` | full chain green, 192 verification tests pass |
| `npm run validate --prefix contracts/security-audit` | 14 tests pass |

The two fail-closed results are the correct answers, not defects. Bootstrap requires verified
required-status enforcement, which is a repository-settings change the owner has not made. Activation
requires an activation record, which does not exist and must not exist before merge.

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

137 diagnostic identifiers are reachable in the checker. 87 are asserted **by exact identifier** in
the test suite — not merely by a non-zero exit, because a test that accepts any failure passes when
the checker breaks for an unrelated reason.

The remaining 50 are shape-level schema diagnostics (`schema-type`, `schema-pattern`,
`schema-length`, …) and secondary variants of covered cases (`assessment-invalid-json`,
`catalog-absent`, `template-absent`). They are reachable and exercised indirectly; they do not each
have a dedicated named-identifier assertion. That is a stated gap, not a claim of completeness.

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
| Technical commit readiness | **yes** — every gate above green |
| Signed governance record | **not started** — withheld; no record exists |
| Merge readiness | **not started** |
| Activation readiness | **blocked** — required-status enforcement unverified, an owner settings change |
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
3. **The governance CI job is not yet a required status check.** Configuring it is the owner's
   action. Until then the job runs but does not block, and activation stays incomplete.
4. **50 of 137 diagnostics lack a dedicated named assertion**, as detailed above.
