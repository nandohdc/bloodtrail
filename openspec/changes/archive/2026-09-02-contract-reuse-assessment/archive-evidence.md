# Archive Evidence — contract-reuse-assessment

Explicit archive validation record (R24) for the archive relocation of the `contract-reuse-assessment` change into `openspec/changes/archive/2026-09-02-contract-reuse-assessment/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24). This file is the only new file in the archive-relocation commit; `tasks.md` is the only relocated file whose bytes changed, by exactly four checkbox flips (4.3, 4.4, 5.1, 5.2).

## Task completeness

- **Sections 1–3 (schema #99, checker #100, CI #101) and 4.1/4.2** were checked by the project owner in technical commit **T2 = 286aba802186a88aef182997211318a51b514a35**, the reviewed commit of superseded signed record S2 (591fcf9d2b8915613b3cfc9b389a63c1a46b3bb8). All section 1–3 checkboxes are `[x]` in the relocated `tasks.md`.
- **4.3** — checked in this archive commit. An exact-commit technical review packet (`REVIEW-PACKET.md`, fold worktree branch `wt/t_7635b1be`) was prepared and the owner decision was obtained verbatim, bound to exact technical commit **T3 = 60411db6d11db1dab0794f8fb310b8e291841245** (`signatureDecision`: "I approve, bound to exact technical commit 60411db6d11db1dab0794f8fb310b8e291841245"), stored as signed record **S3 = 9cbee47030bb6dd84e002217d6f1f706097521b9**, a direct child of T3. Author-written CRA records are not represented as review, approval, or assurance (S3 `assuranceLimitations` carries this limitation verbatim).
- **4.4** — checked in this archive commit. Lifecycle-status sweep and live PR/CI verification completed for the fold: PR #238 at head S3, CI run 33584184389 concluded success with all nine required checks green at that head; no required check was bypassed or failing at merge readiness.
- **5.1** — checked. The canonical fold landed as dedicated commit T3, merged identity-preserving by **M = 48d7c91c237908f5b826895c96330e7f33a00ad0** (PR #238, parents 1c55a9c408ca4e2bf48c4d5a06a629201b7bf918 and S3, merge tree d0d72f2dbc7af4cea53b0a9e0385c0bb02c9daf9 identical to S3's tree). No-op proof per S3's `policy`: the fold transform is exactly two edits (prepended H1, ADDED-Requirements header rename) and re-running it compares byte-identical with the committed file; a simulated second application is a no-op.
- **5.2** — checked. This archive-relocation commit: byte identity table below, explicit staged scope, strict validation, archive attestations, and historical review bindings verified as recorded in the enforcement-verification section.
- **5.3** — **UNCHECKED**. Issue closure is owner-authorized only after the archive PR merges (superseded S2 `signatureDecision`, verbatim: "Closing #100 and #101 is authorized only after the archive PR merges."). Closure is the downstream integration card's responsibility, not this archive commit's.

## T/S bindings

| Phase | Technical commit | Signed record | Status |
| --- | --- | --- | --- |
| Implementation | T2 = 286aba802186a88aef182997211318a51b514a35 | S2 = 591fcf9d2b8915613b3cfc9b389a63c1a46b3bb8 | Superseded by S3 |
| Canonical fold | T3 = 60411db6d11db1dab0794f8fb310b8e291841245 | S3 = 9cbee47030bb6dd84e002217d6f1f706097521b9 | Current; direct child of T3 |

S3 replaces S2 for this change — one current record per change, a superseding record is a replacement, never an append. S3's `reviewedCommit` is T3; `reviewedContent.candidateRoot` is 95442fa2623094654e7ae1318aace66ffbe0eb18 (T3's root tree); `boundCommits` names T3; `governedCommits` names the thirteen-commit lifecycle through T3; `mergeCommits` declares the three two-parent merges (PR #231 6b04d56fe417fe864d5cd098c39f306b66d517b8, PR #232 67882a1c34bd4348e11b0e6aaa3c507d5a896442, PR #233 739bcc47573009615f1171e57ca6bfd3257adfa8). The fold merge 48d7c91 did not exist at S3 time and is identified by Git history, as S3's `assuranceLimitations` state.

## Signed record authorizations

S3 (current) granted:

- `approve-canonical-fold-technical-content-at-t3`
- `store-superseding-signed-governance-record-s3-as-direct-child-of-t3`

S3 withheld:

- `package-publication`
- `production-deployment`
- `production-collection`
- `real-user-processing`
- `framework-integration`
- `delivery-infrastructure`

S2 (superseded) had granted `store-governance-record-for-exact-technical-commit`, `identity-preserving-recovery-merge`, `corrected-three-pr-fold-and-archive-geometry`, and `close-issues-100-and-101-only-after-archive-merge`; its six withheld items match S3's.

## Canonical capability materialization

`openspec/specs/contract-reuse-assessment/spec.md` exists at this archive head, created by fold commit T3 (one file changed, 172 insertions) and carried unchanged through the fold merge. It is the canonical capability spec for the change.

## Production and publication restrictions

No production deployment, production collection, real-user processing, framework integration, delivery infrastructure, or package publication is authorized (S3 withheld list). The proposal's Impact section forbids changes to the frozen contract, generated SDK projections, implementation code, CI, browser telemetry, production transports, collection, storage, and publication. This archive commit touches none of them: its range is the relocation of `openspec/changes/contract-reuse-assessment/` to the dated archive directory, the four-checkbox task reconciliation, and this evidence file.

## Immutable archive contents

Byte-identical from the fold merge HEAD (48d7c91) into the archive:

- `.openspec.yaml` (change metadata: `schema: spec-driven`, `created: 2026-08-23`)
- `proposal.md`
- `assessment.json`
- `design.md`
- `specs/contract-reuse-assessment/spec.md` (delta spec)

The only relocated file whose bytes changed is `tasks.md` (exactly four checkbox flips). `archive-evidence.md` is new.

## Exact changed paths

Added under `openspec/changes/archive/2026-09-02-contract-reuse-assessment/`:

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/contract-reuse-assessment/spec.md`
- `tasks.md`
- `archive-evidence.md` (new)

Removed from `openspec/changes/contract-reuse-assessment/` (active path):

- `.openspec.yaml`
- `assessment.json`
- `design.md`
- `proposal.md`
- `specs/contract-reuse-assessment/spec.md`
- `tasks.md`

No path outside the active change directory and its dated archive directory is touched. In particular, `openspec/specs/**` and `packages/security-audit-sdk-core/verification-lifecycle.json` are untouched by this commit.

## Byte identity table

Expected blobs are the objects at the fold merge HEAD (48d7c91); actual blobs are `git hash-object` of the relocated files.

| File | Expected (fold merge HEAD) | Actual (relocated) | Identity |
| --- | --- | --- | --- |
| `.openspec.yaml` | 44f55ffeea7bd59fa51a01da1ea59fd62a4e7dbd | 44f55ffeea7bd59fa51a01da1ea59fd62a4e7dbd | identical |
| `assessment.json` | dfe55e144277ade81df98401e82e41b2f72da958 | dfe55e144277ade81df98401e82e41b2f72da958 | identical |
| `design.md` | 34ef49205a940b060bf5787c8b59366c87ce18aa | 34ef49205a940b060bf5787c8b59366c87ce18aa | identical |
| `proposal.md` | 9a6f0a77ffbb8c743562da3bec5240083bc28038 | 9a6f0a77ffbb8c743562da3bec5240083bc28038 | identical |
| `specs/contract-reuse-assessment/spec.md` | 590d7a9b3464aaab705d6d9f99bd1a57765b1de3 | 590d7a9b3464aaab705d6d9f99bd1a57765b1de3 | identical |

Because `proposal.md` and `assessment.json` are the exact objects history carried at the active change path, the dated archive directory is recognized as the genuine relocation of the change (R15 dangling check and association perimeter), which is what preserves the signed governance record across the move.

## Active enforcement verification

Archive occurs only after active enforcement is verified. At this committed archive HEAD — where the change is archived, so the R15 signed-review-stale scan no longer applies, and the dangling check recognizes the byte-identical relocation — the following gate set was executed before push, with an empty index:

- `node openspec/scripts/check-design-pattern-governance.mjs --phase final`
- `node openspec/scripts/run-governance-dual-check.mjs`
- `openspec validate --all --strict`
- `node --test openspec/tests/design-pattern-governance/*.test.mjs`
- `node --test openspec/tests/contract-reuse/*.test.mjs`
- `npm run validate --prefix contracts/security-audit`
- `npm run validate --prefix packages/security-audit-sdk-core` (full 19-gate SDK chain)
- `npm run test:archive-attestations --prefix packages/security-audit-sdk-core`
- Archive completeness: `git show --name-status --no-renames` shows every archive addition and active-path deletion explicitly; the active path is absent at HEAD and the dated archive is present.
- `git diff --check`; staged scope is the relocation allowlist only.

Final-phase results are post-commit evidence: the archive PR's check state is the external record, and CI results are not claimed here before CI has run. A pre-merge requirement is that all required checks are green at the archive PR head before the owner's identity-preserving merge.

## Witness CI evidence (quoted from superseded S2 assuranceLimitations)

> The two CI witnesses were produced on the never-merged witness PR #234: the green run https://github.com/nandohdc/bloodtrail/actions/runs/33545845849 (job 99983009835) printed 'contract reuse assessment approved skip for contract-reuse-assessment' and 'contract reuse assessment CRA-validated pass for cra-ci-witness'; the missing-record run https://github.com/nandohdc/bloodtrail/actions/runs/33547296291 (job 99987861966) failed with '[cra-record-missing] openspec/changes/cra-ci-witness/contract-reuse.json: a CRA-triggered change requires a contract-reuse.json record'. Task 3.4's approved-skip evidence is PR #233's own governance run https://github.com/nandohdc/bloodtrail/actions/runs/33528078164 (job 99923929768). Task 3.5's evidence is the branch-protection configuration: design-pattern-governance is one of the nine required contexts and the CRA loop runs inside that job (.github/workflows/ci.yml). Nothing from the witness PR reached main.

This passage is quoted from S2's `assuranceLimitations`; S2 is superseded by S3 for the fold, but the witness-evidence text is unchanged and remains the signed record of that CI evidence.

## Assurance limitations (verbatim from S3)

- "Project-owner/implementer governance; not independent security, privacy, legal, or technical assurance."
- "AI-produced analysis informed the fold construction and the exact-commit review packet and is not review, approval, or assurance; approval is not inferred from passing tests, checked tasks, issue state, pull-request state, or merged state."
- "Author-written CRA records are not review, approval, or assurance, and approval is not inferred from passing tests, checked tasks, issue state, pull-request state, or merged state."

This archive-evidence record asserts the enumerated R24 items and the relocation facts above. It is not itself approval, assurance, or authorization, and it does not substitute for the owner's merge decision.
