# Remediation Technical Review Packet

Packet revision: **2026-08-08 reconciliation refresh (tasks 12.1–12.3)**

## Current governance status

This packet preserves all historical technical-review and owner-governance evidence. Every
approval recorded before the 2026-08-06 F-08 specification correction remains
**SUPERSEDED BY POST-REVIEW F-08 SPECIFICATION CORRECTION** and is not operative. No approval
recorded anywhere in this document applies to the current candidate.

Technical review status: PENDING
Project-owner decision: PENDING
Merge authorization: NONE RECORDED — merge performed 2026-08-06 without a recorded prior authorization
Archive authorization: PENDING
Production deployment authorization: NOT AUTHORIZED
Package publication authorization: NOT AUTHORIZED

This refresh was prepared by an AI assistant executing tasks 12.1, 12.2, and 12.3, and by
re-running the verification suite. **It is not a technical review, not an independent review, and
not an owner decision.** Task 12.4 (renewed review performed independently of the implementing
pass) and task 12.5 (owner exact-commit decision) remain open and are unaffected by this document.

### What this refresh changed

- Rebound the packet from the superseded branch target `c2b10575…` to the current final SDK
  technical commit, with a mechanical SDK-subtree equivalence proof.
- Recorded operative finding dispositions (task 12.1) and blocker executable evidence
  (task 12.2) in `adversarial-review-traceability.md`.
- Disclosed post-review drift: SDK source and verification gates changed after the last
  technical review (see **Post-review drift disclosure**).
- Recorded a fresh verification run at the candidate, and its runtime limitations.
- Corrected a stale residual-limitations entry that contradicted the operative record on two
  points: it claimed 12.5 was complete, and it claimed the merge had not been performed.
- Added a consolidated candidate technical summary covering API, security behavior, validation,
  verification, compatibility, dependencies, tests, and assurance limitations, as task 12.3
  requires.

## Merge execution record

Pull request [#41](https://github.com/nandohdc/bloodtrail/pull/41) was merged into `main` on
2026-08-06 by Fernando Homem da Costa (`@nandohdc`) as merge commit
`2f5787bb6120aa72d2cbd063fd963c5e23435e88`, bringing correction commit
`66bf3b721e604e715dbaae2a98888ddc1e6ff7fe` (tree
`b3297f6dc5e59582708464225a732829b2902b60`) onto `main`.

Merge method: true merge commit with two parents. No squash, rebase, amendment, force-push,
or governed-history rewrite was performed. All seven required checks passed on the merge
commit (`ci / lint`, `ci / test`, `ci / audit`, `sdk`, `contract`, `coverage`, `sonar`).

This merge was performed **before** renewed technical review (task 12.4) and **before** a
renewed project-owner exact-commit decision (task 12.5) were recorded. It therefore does not
constitute, imply, or substitute for either. No approval is inferred from the merge, from the
passing checks, or from the merged state of `main`. Task 12.8 remains unchecked because it
requires merging an *approved* remediation, and no approval was recorded at merge time.

Renewed technical review and a renewed project-owner decision remain required, and must now
be bound to the merged content rather than to a proposed branch.

Owner semantic decision: `ADOPT_COUNT_BOUNDED_FIFO_RETENTION`, Fernando Homem da Costa
(`@nandohdc`), project owner, 2026-08-06. This semantic decision supersedes the prior
24-hour, required-100,000-entry, fail-closed-capacity, and no-reuse-after-eviction F-08
requirements. It authorizes the specification correction only; it is not renewed
technical review, merge approval, archive approval, production authorization, or package
publication authorization.

## Review identity

- **Change:** `remediate-security-audit-sdk-adversarial-review`
- **Branch:** `main` (remediation content merged 2026-08-06; see **Merge execution record**)
- Final technical commit: `689fc394e36642b814df6672b3b514ba95c27944`
- **Final SDK technical commit subject:** `docs(sdk): document F-08 bounded identity-retention migration`
- **SDK subtree object at that commit:** `428d20296d65b6795b7d116939ec036187792416`
- **Review candidate (repository state):** the commit that introduces this packet revision.
  Resolved out of band and supplied to the 12.4 reviewer, because a commit cannot record its
  own hash. The candidate's SDK subtree is proven identical to the final SDK technical
  commit's below, so the technical target is unambiguous either way.
- **Technical reviewer:** PENDING (task 12.4)
- **Review date:** PENDING
- **Review method:** PENDING

### Two-binding rationale

The final SDK technical commit and the review candidate are recorded separately on purpose.
`689fc394…` is the last commit that changed `packages/security-audit-sdk-core/`; it fixes the
SDK bytes under review. The review candidate is the current repository state, which also carries
the specifications, traceability, this packet, compatibility claims, and governance records that
establish *why* `689fc394…` is still the applicable SDK tree. Reviewing only the SDK commit would
leave that later evidence unreviewed.

### SDK subtree equivalence proof

| Property | Value |
| --- | --- |
| Final SDK technical commit | `689fc394e36642b814df6672b3b514ba95c27944` |
| Repository HEAD at reconciliation | `51f1ad340df8514428a86670b8bfc17f7f9bce96` |
| `packages/security-audit-sdk-core` tree at `689fc394…` | `428d20296d65b6795b7d116939ec036187792416` |
| `packages/security-audit-sdk-core` tree at HEAD | `428d20296d65b6795b7d116939ec036187792416` |
| **Subtree equivalence** | **PASS — identical tree object** |
| Intervening commits | 12 |
| Intervening commits modifying the SDK package | **0** |
| Working tree state at reconciliation | clean; index empty |

Reproduce with:

```
git ls-tree 689fc394e36642b814df6672b3b514ba95c27944 packages/security-audit-sdk-core
git ls-tree HEAD packages/security-audit-sdk-core
git rev-list --count 689fc394e36642b814df6672b3b514ba95c27944..HEAD -- packages/security-audit-sdk-core
```

The 12 intervening commits are release-automation, Codecov, CodeScene, Sonar-badge, and
documentation changes outside the SDK package.

## Superseded review identity (historical)

- **Superseded branch:** `hermes/remediate-security-audit-sdk-adversarial-review-archive-correction-v2`
- **Superseded reviewed technical commit:** `c2b10575085ead832d33c728e58288961509587c`
- **Superseded reviewed parent:** `27996739d79d4af1e145597d51610b5f3eefa138`
- **Superseded reviewed tree:** `7cd5a959e81466b2602b5e433fd49750f6663e95`
- **Live remote verified:** Yes
- **Review date:** 2026-08-05
- **Technical reviewer:** Fernando Homem da Costa (@nandohdc), project owner and technical reviewer
- **Review method:** Historical read-only Git commit-object verification, direct review of the correction implementation and evidence structure, and reliance on the frozen evidence manifest for the reported runtime matrix and governed-mode results. The reviewer did not independently rerun the matrix, runtime, or verification suites. This is owner self-review and is **not** independent assurance. **SUPERSEDED BY POST-REVIEW F-08 SPECIFICATION CORRECTION.**

## Post-review drift disclosure

**This is the most material item in this refresh.** The SDK changed substantially *after* the
last technical review at `c2b10575…`, and those changes have never been technically reviewed.

`git diff --stat c2b10575…689fc394 -- packages/security-audit-sdk-core` reports
**626 insertions, 325 deletions across 14 files**:

| Path | Δ | Relevance |
| --- | --- | --- |
| `src/events.ts` | 258 | Event construction — F-01, F-05, F-11, F-12 surface |
| `src/sdk.ts` | 106 | Emit/operation/terminal/shutdown core — F-01, F-02, F-07, F-08 |
| `src/validation/prohibited.ts` | 50 | Prohibited-data enforcement |
| `src/config.ts` | 6 | F-03, F-10 surface |
| `src/context.ts` | 4 | Brand authority module |
| `src/validation/index.ts` | 2 | Validation entry |
| `scripts/check-coherence.mjs` | 198 | F-04 gate itself |
| `scripts/check-changed-paths.mjs` | 166 | F-04 gate itself |
| `scripts/lifecycle-policy.mjs` | 36 | F-04 lifecycle policy |
| `scripts/generate-contract.mjs` | 15 | Generated-artifact determinism |
| `scripts/verification-helpers.mjs` | 12 | Shared verification helpers |
| `scripts/check-scope.mjs` | 11 | F-06 gate itself |
| `tests/verification/vp-reviewed-paths.test.mjs` | 83 | Verification control |
| `tests/verification/f10-mutations.test.mjs` | 4 | F-10 mutation control |

Contributing commits: `bfa29b4`, `c7f091d`, `5aef88f`, `f8847d9`, `473311a`, `e9b270e`,
`685957d`, `f0fbbd9`, `ddfb9e2`, `689fc394`.

Every one of these was motivated by **static-analysis compliance (Sonar complexity, regex
backtracking), CI/coverage plumbing, or documentation** — not by any remediation requirement.
They nonetheless refactored the precise files that F-01, F-02, F-05, F-11 remediated and the
precise gates that F-04 and F-06 restored.

Mitigating evidence, offered without inference: the complete verification suite, including all
adversarial and differential mutation controls, passes at the candidate. Per this change's own
standard, passing tests are **not** approval and do not substitute for review.

**Consequence for task 12.4:** the reviewer's scope is the candidate as a whole, and must
explicitly include this post-review drift. It is not covered by any prior review.

## Verification evidence at the candidate (2026-08-08)

Prepared for task 12.7; **12.7 remains unchecked**, because its text requires re-running
validation *after* the decision records of 12.4–12.6, which do not exist. This is pre-decision
baseline evidence only.

| Item | Result |
| --- | --- |
| `npm run check:generated` (pre-validate drift rejection) | PASS — generated artifacts current |
| `npm run validate` (all 16 gates) | **PASS — exit 0** |
| Gates executed | `generate`, `check:generated`, `typecheck`, `build`, `test:runtime`, `test:types`, `test:examples`, `test:exports`, `test:compatibility`, `test:contract-immutability`, `test:scope`, `test:dependencies`, `test:package`, `test:changed-paths`, `test:coherence`, `test:verification`, `test:git` |
| Runtime tests | 112 / 112 pass, 0 fail |
| Verification tests | 129 / 129 pass, 2 suites, 0 fail |
| Git whitespace / final-newline / index | PASS — index empty |
| Runtime used | **Node v26.7.0**, macOS arm64 |

### Runtime limitation — this is not exact-matrix evidence

`compatibility.json` declares `ciVersions: ["24.2.0", "26.5.0"]`, and this change requires clean
verification on exact Node.js 24 and 26 runtimes. **Neither exact runtime is installed on the
machine used for this run.** The run above was performed on Node v26.7.0, which is outside both
declared cells. It is therefore *supporting* evidence, not matrix evidence, and does not satisfy
the exact-runtime requirement.

The matrix figures elsewhere in this packet (4/4 cells) remain the frozen historical manifest
values recorded against the superseded commit `c2b10575…`. **No refreshed exact-matrix evidence
exists for the current candidate.** Producing it requires installing Node 24.2.0 and 26.5.0.

### Incidental observation — documented race did not reproduce

The reconciliation note below records a deterministic parallel-execution failure of
`tests/verification/*.test.mjs` on Node 26.6.0. On Node v26.7.0 that failure **did not
reproduce**: the suite passed 129/129 under default parallel execution with no serial wrapper.
This is a single observation on one off-matrix runtime and does not retire the documented
limitation.

## Candidate technical summary (task 12.3 coverage)

Measured at the candidate on 2026-08-08. Facts only; no disposition is implied.

### Public API surface

| Item | Value |
| --- | --- |
| Package export paths | 2 — `.` and `./testing` (no CommonJS export on either) |
| Root runtime exports | 48 |
| `./testing` exports | 3 — `createCapturingAuditSink`, `createInMemoryAuditSink`, `inspectSdkRetentionForTesting` |
| Named catalog event methods | 24, all proven callable at runtime and structurally complete at compile time (F-09) |
| Public error codes | 24 |
| Module system | ESM only; `sideEffects: false` |

Public error codes: `FIELD_LIMIT_EXCEEDED`, `FIELD_SERIALIZATION_FAILED`,
`PROHIBITED_BODY_ATTRIBUTES`, `PROHIBITED_DATA`, `SDK_DUPLICATE_SUCCESS`, `SDK_HOOK_FAILURE`,
`SDK_INVALID_CLOCK`, `SDK_INVALID_CONFIGURATION`, `SDK_INVALID_IDENTIFIER`, `SDK_INVALID_INPUT`,
`SDK_INVALID_OPERATION_TRANSITION`, `SDK_MISSING_AUTHORITATIVE_CONTEXT`,
`SDK_MISSING_EVENT_FIELD`, `SDK_NOT_READY`, `SDK_OPERATION_EVENT_MISMATCH`,
`SDK_SCHEMA_VALIDATION_FAILED`, `SDK_SEMANTIC_VALIDATION_FAILED`, `SDK_SHUTDOWN_TIMEOUT`,
`SDK_SHUTTING_DOWN`, `SDK_SHUT_DOWN`, `SDK_SINK_FAILURE`, `SDK_SINK_REJECTED`,
`SDK_UNSUPPORTED_CONTRACT_VERSION`, `SDK_UNSUPPORTED_HOOK_RESULT`.

### Security behavior

| Property | Mechanism | Finding |
| --- | --- | --- |
| Transactional terminal success requires unforgeable evidence | SDK-instance-private `WeakMap` operation evidence in `src/operations.ts`; foreign, forged, copied, and cloned handles rejected without sink invocation | F-01 |
| At most one accepted terminal completion | Synchronous `idle`/`reserved`/`completed` reservation before asynchronous sink handoff; release on non-accepted outcomes; no automatic retry | F-02 |
| Caller-owned collaborators stay caller-owned | Providers referenced without clone, freeze, decoration, or mutation; SDK-owned configuration frozen separately | F-03 |
| Context authority is unforgeable by casts or plain objects | Module-private brand registry `WeakMap` in `src/context.ts`; only in-file constructors insert entries | pre-existing, retained |
| Hostile input never echoed | Property-access, getter, proxy, cyclic, and non-cloneable failures normalized to bounded codes with no raw name, message, stack, cause, or value | F-05, F-12 |
| Identity and dedup state is bounded | Count-bounded FIFO horizons, default capacity 4096, hard maximum 100 000; weak operation retention; no timers, intervals, signal handlers, or finalizers | F-08 |
| Shutdown does not retain process exit | Unreferenced timer, idempotent clear in a structured `finally` after either race outcome | F-07 |

### Validation and verification

| Item | Value |
| --- | --- |
| Gates in `npm run validate` | 16 |
| Runtime tests | 112 |
| Verification / lifecycle tests | 129 (2 suites) |
| Named differential mutation controls | 25 (`M-F07-A`–`D`, `M-F08-A`–`G`, `M-F10-A`–`G`, `M-F11-A`–`G`) |
| Unnamed differential controls in `mutations.test.mjs` | 32 (10 structured-capability, 12 archive-movement, 10 fixture-restoration) |
| Documentation examples executed | 15 |
| Contract drift detection | `check:generated` — generated artifacts derived from `contracts/security-audit/source/contract.source.json` |

### Compatibility

| Item | Value |
| --- | --- |
| Contract version | 1.0.0, exact — `supportedContractVersions` must equal `CONTRACT_VERSION` |
| Explicitly unsupported contract versions | `0.9.0`, `2.0.0` (rejection asserted) |
| Node engines | `>=24 <25 \|\| >=26 <27` |
| Declared CI runtimes | 24.2.0, 26.5.0 |
| TypeScript supported | `>=5.9.2 <6`; compiler pinned at 5.9.2 in both manifest and lockfile |
| Package version | 0.1.0 |
| `private` | `true` — asserted by `test:package` |
| `license` | `UNLICENSED` — asserted by `test:package` |
| Semver policy | Recorded in `compatibility.json` `semverClassification` and `errorCodePolicy` |

### Dependencies

| Item | Value |
| --- | --- |
| Runtime dependencies | **0** — asserted by `test:dependencies` and `test:package` |
| Development dependencies | 4 — `@types/node` 24.2.0, `ajv` 8.20.0, `ajv-formats` 3.0.1, `typescript` 5.9.2 |
| `npm audit --audit-level=low` at candidate | **PASS — found 0 vulnerabilities** (2026-08-08) |

### Assurance limitations

Consolidated; each is stated in full in its own section.

1. No renewed technical review exists (12.4 open). No owner decision exists (12.5 open).
2. Post-review drift of 626/325 lines across 14 files, including `src/events.ts` and
   `src/sdk.ts`, carries no review of any kind.
3. No refreshed exact-runtime matrix evidence exists; the 2026-08-08 run used off-matrix
   Node v26.7.0.
4. Mutation-control coverage is asymmetric across findings (no named mutants for F-01, F-02,
   F-03).
5. The merge was performed before any renewed review or decision, and confers nothing.
6. Active-mode packet validation binds the *shape* of the technical-commit field, not its value.
7. The governed owner-decision regex is not a reliable positive test for approval.
8. Unused substring helpers remain exported from `lifecycle-policy.mjs` with no callers.
9. A shared-fixture race in parallel verification is documented on Node 26.6.0; it did not
   reproduce on 26.7.0, which does not retire it.
10. This packet revision was prepared by an AI assistant. It is not review, approval, or
    assurance.
11. Transport-neutral scope only. No production sink, durability, exactly-once, or
    at-least-once guarantee exists.

## Previous technical-review history

- **Previous technical-review evidence commit:** `d05ef82d17a167b0aa49732c66820caf1871054f`
- **Previous reviewed technical commit:** `278c6721ea4eb2214062a33e289d54605bf9333b`
- **Previous reviewed tree:** `7d9fd109f9e97f3ee0100c98cf802e9c919740c2`
- **Previous review date:** 2026-08-04
- **Previous result:** PASS (valid for `278c6721` only; does not cover `c2b10575`)

The prior project-owner decision recorded against `278c6721` does **not** carry forward to
`c2b10575`. Tasks 12.1–12.7 were reset by the correction, and owner governance restarts
from `PENDING`.

### Superseded project-owner decision binding

The **Project-owner governance decision (renewed review)** block in
`implementation-authorization.md` records `APPROVED_FOR_MERGE` against reviewed technical
commit `278c6721ea4eb2214062a33e289d54605bf9333b` and reviewed technical-review evidence
commit `d05ef82d17a167b0aa49732c66820caf1871054f`, dated 2026-08-04.

That binding is **SUPERSEDED and NON-OPERATIVE**. `278c6721` is no longer the technical
target of this branch, the tree it approved (`7d9fd109f9e97f3ee0100c98cf802e9c919740c2`)
is not the current branch tree, and tasks 12.1–12.7 were reset after it was written. It
retains value only as historical evidence of a decision taken against a superseded commit.
It confers no approval on `c2b10575085ead832d33c728e58288961509587c` and no merge, archive,
production, or publication authorization of any kind.

No prior project-owner decision is operative for the amended F-08 specification candidate.
The historical decision formerly recorded under **Project-owner decision (exact-commit)**
and in the historical decision block below is superseded here. `implementation-authorization.md`
remains unmodified because it is outside the authorized reconciliation scope; it is
superseded here rather than rewritten.

## Review scope

### Complete remediation range
`b4206f92fc92c7355efaa80d9f878353cf794452..c2b10575085ead832d33c728e58288961509587c`

### First correction range (verifier correction)
`0f2cd27277966a8a2eb15bbe34e6c6884de3abe1..9fc0d3ea63c8c54ba31c1d7e97367ff0052fdb89`

Replaced a state-dependent lifecycle mutation test with explicit pre-owner and post-owner governance fixtures.

### Second correction range (fixture isolation)
`9fc0d3ea63c8c54ba31c1d7e97367ff0052fdb89..278c6721ea4eb2214062a33e289d54605bf9333b`

Corrected the `active mode rejects owner decision without exact-commit review evidence` mutation test to explicitly remove the `Final technical commit:` binding from its controlled fixture rather than relying on the active packet's Markdown bold formatting.

### Third correction range (archive-verifier correction)
`27996739d79d4af1e145597d51610b5f3eefa138..c2b10575085ead832d33c728e58288961509587c`

Replaced substring-based capability comparison with structured requirement parsing, added
exact active-to-archive movement enforcement, and added archived fixture-restoration
controls. Exactly four paths changed, all modifications:

| Path | Classification | Δ |
|---|---|---|
| `openspec/changes/remediate-security-audit-sdk-adversarial-review/tasks.md` | governance-task-checklist | +7 −7 |
| `packages/security-audit-sdk-core/scripts/check-changed-paths.mjs` | verification-script | +275 |
| `packages/security-audit-sdk-core/scripts/check-coherence.mjs` | verification-script | +190 |
| `packages/security-audit-sdk-core/tests/verification/mutations.test.mjs` | verification-test | +609 |

No runtime SDK source, public API, package manifest, dependency, canonical specification,
archive, production, or publication path is in the range.

### Continued exclusions
Owner decision (12.5), production/publication governance (12.6), post-decision validation (12.7), merge (12.8), archive (12.9), archived validation (12.10)

## Technical result

### Historical renewed review: PASS - SUPERSEDED BY POST-REVIEW F-08 SPECIFICATION CORRECTION

The reviewer found no blocking defect in the four-file archive-verifier correction. That
finding is historical evidence only. It does not approve or authorize the amended F-08
specification candidate.

### Verification evidence (exact-target matrix at `c2b10575`)

**Pre-packet matrix (target at 81/91):**

| Cell | Runtime | Mode | Result |
|---|---|---|---|
| 1 | Node 24.2.0 / npm 11.3.0 | active | PASS |
| 2 | Node 24.2.0 / npm 11.3.0 | archived original | PASS |
| 3 | Node 26.5.0 / npm 11.17.0 | active | PASS |
| 4 | Node 26.5.0 / npm 11.17.0 | archived original | PASS |

- **Runtime tests:** 112/112 PASS
- **Verification/lifecycle tests:** 127/127 PASS
- **Structured capability controls:** 10/10 PASS
- **Archive-movement controls:** 12/12 PASS
- **Fixture-restoration controls:** 10/10 PASS
- **Documentation examples:** 15/15 PASS
- **Supported checked tasks:** 81
- **Unsupported checked tasks:** 0
- **Separate read-only gate:** PASS (13/13 checks, exit 0)

These matrix, runtime, and governed-mode values are taken from the frozen evidence
manifest (`freeze-manifest-complete.tsv`, SHA-256
`b25c0ef42fe48b7e6c4cbde5f80b0f3987a2dc7cae6f3aa9020d59d3cea58051`, 2115 bytes). The
reviewer relied on that manifest and did not independently rerun those suites.

### Contract and package state
- **Contract:** 1.0.0 (immutable)
- **Runtime dependencies:** 0
- **Package version:** 0.1.0
- **Package private:** true
- **Production integration:** Absent
- **Package publication:** Unauthorized

## Archive-verifier correction assessment

### Structured capability comparison — PASS

The implementation parses structured requirement headings, bodies, and scenarios via
`parseRequirementSet`, compares with `compareRequirementSubset` under `normalizeHeading`
and `normalizeMarkdownLines`, and rejects missing, modified, duplicate, malformed, and
empty requirement sets. Legitimate cumulative capability growth is permitted. Raw text
inside a fenced block cannot satisfy the check. Historical archive bytes are preserved.
Ten controls exercise these paths.

### Archive-movement enforcement — PASS

`validateArchiveMovement` requires an exact active-to-archive mapping and checks path,
relative path, mode, bytes, and cardinality. Object identity is taken via
`git hash-object --no-filters`. Unmatched additions and deletions, partial movement,
retained active evidence, unrelated change deletion, and unrelated archive addition are
all rejected, across eleven distinct failure identifiers. Only the exact task transitions
for 12.8–12.10 are permitted, via `exactArchivedTaskReconciliation`. There is no blanket
deletion exemption. Twelve controls exercise these paths.

### Archived mutation / fixture-restoration controls — PASS

The implementation derives the exact dated archive, requires exactly one matching archive,
restores only inside disposable controls, unchecks exactly tasks 12.8–12.10, preserves
source archive bytes, handles malformed and incomplete archives, and cleans disposable
state deterministically. All pre-existing lifecycle assertions are preserved. Ten controls
exercise these paths.

### Governance ledger — PASS

Exactly tasks 12.1–12.7 were reset in a single hunk. Tasks 12.8–12.10 remain unchecked.
Tasks 1.1–11.9 are unchanged and task prose is unchanged — the diff pairs differ only in
the checkbox character. State at the reviewed commit is `81/91`.

## Active-mode packet binding risk assessment

**Classification:** NON-BLOCKING RISK

Active-mode packet validation tests only the *shape* of the technical binding:

```js
exactTechnicalCommit: /Final technical commit:\s*`[0-9a-f]{40}`/.test(reviewPacket)
```

Any 40-hex value satisfies this. The gate does not bind the recorded value to the current
technical target, so a packet carrying a superseded binding together with a stale owner
approval can coexist with unchecked governance tasks without active-mode rejection.

**Correction to the previously recorded claim.** The prior packet asserted that "the
active coherence gate requires exact technical-commit review evidence before
owner-decision tasks are accepted, providing defense-in-depth." That claim is overstated
and is not repeated. The active gate enforces presence, not exactness. Governed mode
(`governed-technical-binding`, `governed-owner-decision`,
`governed-task-<id>-pending`) and the task ledger — which remains the operative record of
what is permitted — reduce the immediate impact, but they do not make the active-mode
check value-binding.

Pre-existing; not introduced by this correction.

### Reconciliation note — packet cardinality invariant

Recorded during evidence reconciliation on 2026-08-05, after the reviewer's decision. This
is an operational observation, not a reviewer disposition.

The `active mode rejects owner decision without exact-commit review evidence` negative
control builds its fixture by matching a single line:

```js
const bindingLine = packetText.match(/^.*Final technical commit:.*$/m)?.[0];
replace(root, packetPath, bindingLine, "Final technical commit: binding intentionally removed for negative control");
```

The regex carries `m` but not `g`, so only the **first** line containing
`Final technical commit:` is removed — and the match is on the bare substring, so ordinary
prose and fenced code that merely mention the phrase are matched just as readily as the
binding itself. The packet therefore has an implicit structural invariant: **the first
line containing `Final technical commit:` must be the real gate-satisfying binding.**

Two distinct ways to violate it were reproduced during reconciliation, both as loud test
failures:

1. Carrying the binding in both the review-identity header and the decision block. The
   control removes the header copy; the decision-block copy survives and still satisfies
   the active-mode gate.
2. Carrying the binding only in the decision block, below the prose sections that discuss
   the phrase. The control removes a prose line; the real binding survives untouched.

Both were resolved by restoring the original layout: exactly one gate-satisfying binding,
in the review-identity header, ahead of every prose mention. The decision block records
`Reviewed technical commit:` instead. The failure mode is loud rather than silent — the
control asserts a rejection that does not occur — so it fails safe.

This refines, rather than contradicts, the fixture-isolation correction recorded at
`278c6721`: that correction removed the fixture's dependency on Markdown *formatting*, and
a dependency on binding *cardinality* remains.

## Unused substring helper assessment

**Classification:** NON-BLOCKING RISK

`extractRequirementBody` and `extractRequirementBlocks` remain exported from
`packages/security-audit-sdk-core/scripts/lifecycle-policy.mjs` (lines 182 and 187) with
zero callers anywhere in the repository at `c2b10575`. Both are pure string extraction
with no I/O, no mutation, no gate decision, and no policy effect, and are therefore
unreachable by any verification path. They are residue of the substring comparison that
this correction replaced. They could confuse future maintainers or enable accidental
reintroduction of weaker comparison semantics. No executable bypass exists and no explicit
repository invariant is violated, so no new correction is required. `lifecycle-policy.mjs`
is outside the reviewed range.

## Missing-build diagnostic assessment

**Classification:** DOCUMENTED LIMITATION

The mutation harness runs `git add -f packages/security-audit-sdk-core/dist`
(`tests/verification/mutations.test.mjs:812`) and reports a low-level Git pathspec error
when the build output is absent, rather than a clear build-required diagnostic. This is an
environmental usability characteristic of the harness and is distinct from correction
correctness.

## Shared-file concurrency risk assessment

**Classification:** NON-BLOCKING RISK

The `vp-reviewed-paths.test.mjs` test rewrites shared files in-place. Under Node default parallel test-file execution, other verification files may read these shared files mid-mutation. This is pre-existing, not introduced by any correction. The race cannot cause false passes. All four exact-runtime canonical cells (Node 24.2.0 and Node 26.5.0) passed without any serial wrapper.

### Reconciliation note — deterministic reproduction off-matrix

Recorded during evidence reconciliation on 2026-08-05. Operational observation, not a
reviewer disposition.

On **Node v26.6.0** — outside the two exact-runtime matrix cells — the race is not merely
transient. `node --test tests/verification/*.test.mjs` fails **deterministically**, three
runs out of three, with:

```
Error: reviewedNewSdkSourcePaths entry must not contain glob characters: packages/security-audit-sdk-core/src/*.ts
    at prepareControl (tests/verification/mutations.test.mjs:815)
```

`vp-reviewed-paths.test.mjs` injects that glob into the shared reviewed-paths
configuration for its own negative control while `mutations.test.mjs` reads the same file
during `prepareControl`. The whole file aborts at roughly 900 ms instead of its usual
~20 s, so the loss is the entire mutation suite rather than one assertion.

Two controls establish that this is pre-existing and unrelated to the reconciliation
candidate:

| Tree | Execution | Result |
|---|---|---|
| Pristine `c2b10575`, zero modifications | parallel | 51 pass / 1 fail — identical error |
| Reconciliation candidate (packet + tasks) | parallel | 51 pass / 1 fail — identical error |
| Reconciliation candidate | serial (`--test-concurrency=1`) | **127 / 127 pass, 0 fail** |
| Reconciliation candidate, `mutations.test.mjs` alone | isolated | **76 / 76 pass, 0 fail** |

The serial figure reproduces the frozen manifest's `127/127` exactly. The characterization
"transient" holds for the matrix runtimes but understates the behavior on Node 26.6.0,
where a serial wrapper is required. The failure remains loud and cannot produce a false
pass.

## Owner-decision parser-risk assessment

**Classification:** DOCUMENTED LIMITATION

The governed owner-decision regex (`/Project-owner.+decision.+APPROVED/is`) performs a
case-insensitive dot-all search for `APPROVED` anywhere after "Project-owner" and
"decision". Because the trailing restriction table contains the words "approved" and "NOT
AUTHORIZED", a packet recording `Project-owner decision: PENDING` can still satisfy this
regex through a later occurrence. The rule is therefore not a reliable positive test for
owner approval on its own. It is evaluated only in governed mode; the present packet is
evaluated in active mode, where the rule does not fire. Recorded as a limitation for the
owner-governance phase.

## Finding-by-finding disposition (historical — superseded by task 12.1)

The table below records the dispositions asserted by the **prior, superseded** reviews against
`c2b10575…`. It is retained as historical evidence and is **not** the operative disposition
record.

The operative dispositions are in `adversarial-review-traceability.md`, sections
**Task 12.1 — Finding reconciliation** and **Task 12.2 — Blocker executable evidence**. Every
finding there is recorded as *remediated with passing executable evidence at the candidate, and
PENDING renewed review (12.4) and owner decision (12.5)* — not as approved.

Historical (superseded) assertion:

| Finding | Issue | Status |
|---|---|---|
| F-04 | #24 | PASS |
| F-01 | #21 | PASS |
| F-02 | #22 | PASS |
| F-03 | #23 | PASS |
| F-05/F-12 | #25 | PASS |
| F-06/F-09 | #26 | PASS |
| F-07 | #27 | PASS |
| F-08 | #28 | PASS |
| F-10 | #29 | PASS |
| F-11 | #30 | PASS |

## Residual limitations (preserved)

- Transport-neutral scope only; no production sink; no durability guarantee; no exactly-once or at-least-once guarantee
- No production authorization; no package-publication authorization
- ~~Project-owner decision recorded 2026-08-05 (12.5 complete); merge is authorized but has not been performed (12.8 pending); no archive approval (12.9 pending)~~ — **CORRECTED 2026-08-08.** This line was stale and contradicted the operative record in two ways. Current state: **12.5 is PENDING**, not complete — the 2026-08-05 decision is superseded and non-operative. The merge **was** performed on 2026-08-06 **without** a recorded prior authorization, so 12.8 remains unchecked because it requires merging an *approved* remediation. Archive (12.9) remains PENDING, which was correct as written.
- The project-owner decision is project governance recorded by the project owner; it is not independent assurance and does not convert any documented limitation into assurance
- Any owner self-review does not constitute independent assurance
- The superseded reviewer relied on the frozen evidence manifest for the runtime matrix, runtime tests, verification tests, and governed-mode result rather than rerunning them
- **No refreshed exact-runtime matrix evidence exists for the current candidate** (Node 24.2.0 and 26.5.0 not available on the reconciliation machine); the 2026-08-08 run was on off-matrix Node v26.7.0
- **Post-review drift is unreviewed:** 626 insertions / 325 deletions across 14 files, including `src/events.ts` and `src/sdk.ts`, landed after the last technical review and carry no review of any kind
- Mutation-control coverage is asymmetric: named mutants exist for F-07, F-08, F-10, F-11 but not for F-01, F-02, F-03, which rely on adversarial runtime controls instead
- This packet revision was prepared by an AI assistant; per this change's own standard, AI analysis is not review, not approval, and not assurance

## Reviewer statement (verbatim)

> Decision: PASS
>
> I personally reviewed commit `c2b10575085ead832d33c728e58288961509587c`, its parent `27996739d79d4af1e145597d51610b5f3eefa138`, and tree `7cd5a959e81466b2602b5e433fd49750f6663e95`.
>
> I find no blocking defect in the four-file archive-verifier correction.
>
> Non-blocking risk: active-mode packet validation checks only the shape of the `Final technical commit` field rather than binding its value to the current technical target. This allows a stale packet approval and unchecked governance tasks to coexist without active-mode rejection. Governed mode and the task ledger reduce the immediate impact, but the prior defense-in-depth claim is overstated and must not be repeated unchanged.
>
> Non-blocking risk: the unused exported substring helpers are currently unreachable but could confuse future maintainers or enable accidental reintroduction of weaker comparison semantics.
>
> Documented limitation: the mutation harness reports a low-level Git pathspec error when the build output is absent instead of a clear build-required diagnostic.
>
> Documented limitation: I am both the project owner and technical reviewer, so this review is owner self-review and does not constitute independent assurance.
>
> I reviewed the implementation and evidence structure directly. I relied on the frozen manifest for the reported `4/4` runtime matrix, `112/112` runtime tests, `127/127` verification tests, and governed-mode result; I did not independently rerun those checks.
>
> Production deployment remains NOT AUTHORIZED.
>
> Package publication remains NOT AUTHORIZED.

— Fernando Homem da Costa (@nandohdc), project owner and technical reviewer, 2026-08-05

## Historical project-owner decision (SUPERSEDED BY POST-REVIEW F-08 SPECIFICATION CORRECTION)

### Decision identity

- **Owner name:** Fernando Homem da Costa
- **Owner handle:** `@nandohdc`
- **Owner identity:** Fernando Homem da Costa (@nandohdc)
- **Owner role:** Project owner
- **Decision date:** 2026-08-05
- **Owner-reviewed technical commit:** `c2b10575085ead832d33c728e58288961509587c`
- **Owner-reviewed technical-review evidence commit:** `eefec5d5b239044c6403bcee87161a7c9eba1fdb`
- **Owner-reviewed technical-review evidence tree:** `d6af0b6e31d8d32b582e723da9d8fab228fc0d2a`
- **Owner decision:** APPROVED_FOR_MERGE
- **Merge authorization:** APPROVED
- **Archive authorization:** PENDING
- **Production deployment authorization:** NOT AUTHORIZED
- **Package publication authorization:** NOT AUTHORIZED

This decision was personally adopted by the project owner for the exact commits named
above. It was not inferred from the technical-review PASS result, from task state, from
automated test results, from issue or pull-request state, or from AI analysis. It is now
**SUPERSEDED BY POST-REVIEW F-08 SPECIFICATION CORRECTION** and confers no approval on
the amended F-08 specification candidate.

### Owner statement (verbatim)

> Owner: Fernando Homem da Costa (@nandohdc)
>
> Role: Project owner
>
> Decision date: 2026-08-05
>
> Final technical commit:
> c2b10575085ead832d33c728e58288961509587c
>
> Technical-review evidence commit:
> eefec5d5b239044c6403bcee87161a7c9eba1fdb
>
> Technical-review evidence tree:
> d6af0b6e31d8d32b582e723da9d8fab228fc0d2a
>
> Owner decision:
> APPROVED_FOR_MERGE
>
> Governance findings:
> None.
>
> I acknowledge that the technical review was performed by the project owner and therefore does not constitute independent assurance.
>
> I acknowledge the documented non-blocking risks and limitations, including:
>
> * active-mode packet validation checks commit-field shape rather than exact value;
> * the governed owner-decision regex is not sufficient positive proof;
> * the unused substring helpers remain exported but currently have no callers;
> * Node 26.6.0 parallel verification has a shared-fixture race;
> * the reviewer relied on the frozen exact-runtime matrix rather than independently rerunning it.
>
> Merge authorization:
> APPROVED
>
> Archive authorization:
> PENDING
>
> Production deployment authorization:
> NOT AUTHORIZED
>
> Package publication authorization:
> NOT AUTHORIZED
>
> I personally make this owner decision for the exact commits and tree identified above. No historical owner decision is being reused.

— Fernando Homem da Costa (@nandohdc), Project owner, 2026-08-05

### Assurance limitation

The project owner is also the technical reviewer. This decision is **project-owner
self-review**. It is project governance only and does **not** constitute independent
assurance, third-party review, formal certification, legal advice, or organizational
approval. No claim of independent assurance is made anywhere in this packet.

### Acknowledged risks and limitations

The owner reviewed and accepted each of the following as non-blocking. None is downgraded,
closed, or converted into assurance by this decision; each remains recorded in full in its
own section above.

| Item | Classification | Owner disposition |
|---|---|---|
| Active-mode packet validation checks the *shape* of the commit field, not its exact value | NON-BLOCKING RISK | Acknowledged and accepted. The prior defense-in-depth claim is not repeated. The task ledger remains the operative record. |
| Governed owner-decision regex is not sufficient positive proof of approval | DOCUMENTED LIMITATION | Acknowledged and accepted. It is not relied on as owner proof. Owner evidence is validated by exact-equality field matching, not by that regex. |
| Unused substring helpers remain exported with no callers | NON-BLOCKING RISK | Acknowledged and accepted. Unreachable, no gate effect, outside the reviewed range. |
| Node 26.6.0 parallel verification has a shared-fixture race | NON-BLOCKING RISK / off-matrix | Acknowledged and accepted. Verification runs on the frozen matrix runtime and serially. The failure is loud and cannot produce a false pass. |
| The reviewer relied on the frozen exact-runtime matrix rather than independently rerunning it | DOCUMENTED LIMITATION | Acknowledged and accepted, and repeated here so the decision does not rest on an unstated assumption. |
| Mutation harness reports a low-level Git pathspec error when build output is absent | DOCUMENTED LIMITATION | Acknowledged and accepted. Environmental usability only. |

### Previously authorized by this superseded decision

- Historical progression to the governed merge phase for `c2b10575085ead832d33c728e58288961509587c`.
- This authorization is no longer operative for the amended F-08 specification candidate.

### Explicitly not authorized by this decision

- **Archive:** PENDING. Tasks 12.8–12.10 remain unchecked and no archive is authorized.
- **Production deployment:** NOT AUTHORIZED.
- **Package publication or release:** NOT AUTHORIZED.
- Framework integration, delivery infrastructure, transports, collectors, brokers, queues,
  storage, SIEM, analytics, browser telemetry, and real-user data processing all remain
  NOT AUTHORIZED.

The historical merge authorization above is not an action and is now superseded. The merge
itself (12.8) has not been performed, and the amended F-08 specification candidate has no
merge authorization.

## Current decision

Packet revision: 2026-08-08 reconciliation refresh (tasks 12.1-12.3)
Final SDK technical commit: `689fc394e36642b814df6672b3b514ba95c27944`
Final SDK technical commit subtree: `428d20296d65b6795b7d116939ec036187792416`
Repository HEAD at reconciliation: `51f1ad340df8514428a86670b8bfc17f7f9bce96`
SDK subtree equivalence HEAD vs final SDK technical commit: PASS
Intervening commits modifying the SDK package: 0
Review candidate: the commit introducing this packet revision; resolved out of band for 12.4
Task 12.1 finding reconciliation: COMPLETE - recorded in adversarial-review-traceability.md
Task 12.2 blocker executable evidence: COMPLETE - F-01, F-02, F-03, F-04 evidence recorded
Task 12.3 packet refresh: COMPLETE - this revision
Task 12.7 validation: EVIDENCE PREPARED, TASK UNCHECKED - requires post-decision re-run
Validation at candidate: PASS, exit 0, 16/16 gates, 112/112 runtime, 129/129 verification
Validation runtime: Node v26.7.0 - OFF-MATRIX, not exact-runtime evidence
Refreshed exact-matrix evidence (Node 24.2.0 / 26.5.0): NOT PRODUCED
Post-review drift since last review: 626 insertions, 325 deletions, 14 files - UNREVIEWED
Prepared by: AI assistant executing 12.1-12.3; not review, not approval, not assurance
Technical review status: PENDING
Reviewed technical commit: PENDING
Reviewed technical parent: PENDING
Reviewed technical tree: PENDING
Technical-review evidence commit: PENDING
Technical-review evidence tree: PENDING
Superseded historical technical-review evidence commit: `eefec5d5b239044c6403bcee87161a7c9eba1fdb`
Superseded historical reviewed technical commit: `c2b10575085ead832d33c728e58288961509587c`
Superseded project-owner decision: `c2b10575085ead832d33c728e58288961509587c` in this packet and `278c6721ea4eb2214062a33e289d54605bf9333b` in implementation-authorization.md - NON-OPERATIVE
Owner identity: Fernando Homem da Costa (@nandohdc)
Owner role: Project owner
Project-owner semantic decision date: 2026-08-06
Owner semantic decision: ADOPT_COUNT_BOUNDED_FIFO_RETENTION
Owner-reviewed technical commit: PENDING
Owner-reviewed technical-review evidence commit: PENDING
Owner-reviewed technical-review evidence tree: PENDING
Project-owner decision: PENDING
Owner self-review is independent assurance: NO
Production deployment authorization: NOT AUTHORIZED
Package publication authorization: NOT AUTHORIZED
Merge authorization: NONE RECORDED — merge performed without a recorded prior authorization
Merge performed: YES
Merge commit: `2f5787bb6120aa72d2cbd063fd963c5e23435e88`
Merged correction commit: `66bf3b721e604e715dbaae2a98888ddc1e6ff7fe`
Merged tree: `b3297f6dc5e59582708464225a732829b2902b60`
Merge date: 2026-08-06
Merged by: Fernando Homem da Costa (@nandohdc)
Merge method: merge commit, two parents, no squash/rebase/amend/force-push
Merge preceded renewed technical review and renewed owner decision: YES
Approval inferred from merge: NONE
Archive authorization: PENDING

Production deployment approved | `NO — NOT AUTHORIZED`
Package publication/release approved | `NO — NOT AUTHORIZED`
