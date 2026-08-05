# Remediation Technical Review Packet (RENEWED)

## Review identity

- **Change:** `remediate-security-audit-sdk-adversarial-review`
- **Branch:** `hermes/remediate-security-audit-sdk-adversarial-review-archive-correction-v2`
- Final technical commit: `c2b10575085ead832d33c728e58288961509587c`
- **Reviewed parent:** `27996739d79d4af1e145597d51610b5f3eefa138`
- **Reviewed tree:** `7cd5a959e81466b2602b5e433fd49750f6663e95`
- **Live remote verified:** Yes
- **Review date:** 2026-08-05
- **Technical reviewer:** Fernando Homem da Costa (@nandohdc), project owner and technical reviewer
- **Review method:** Read-only Git commit-object verification, direct review of the correction implementation and evidence structure, and reliance on the frozen evidence manifest for the reported runtime matrix and governed-mode results. The reviewer did not independently rerun the matrix, runtime, or verification suites. This is owner self-review and is **not** independent assurance.

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

The single operative project-owner decision for `c2b10575` is the one recorded under
**Project-owner decision (exact-commit)** and in the `## Decision` block below. Where the
two records differ, this packet governs. `implementation-authorization.md` remains
unmodified because it is outside the authorized reconciliation scope; it is superseded
here rather than rewritten.

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

### Renewed review: PASS

The reviewer found no blocking defect in the four-file archive-verifier correction. The
complete remediation range, all three correction ranges, and all 10 prior finding
dispositions remain valid.

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

## Finding-by-finding disposition (carried forward)

All 10 finding dispositions from the prior reviews remain valid:

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
- Project-owner decision recorded 2026-08-05 (12.5 complete); merge is authorized but has not been performed (12.8 pending); no archive approval (12.9 pending)
- The project-owner decision is project governance recorded by the project owner; it is not independent assurance and does not convert any documented limitation into assurance
- This review is project-owner self-review and does not constitute independent assurance
- The reviewer relied on the frozen evidence manifest for the runtime matrix, runtime tests, verification tests, and governed-mode result rather than rerunning them

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

## Project-owner decision (exact-commit)

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
automated test results, from issue or pull-request state, or from AI analysis. No
historical owner decision is reused. Governance findings raised at decision time: the
superseded `278c6721` owner-decision binding described under **Superseded project-owner
decision binding** above, which is recorded as non-operative and blocks nothing.

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

### Authorized by this decision

- Progression to the governed merge phase for `c2b10575085ead832d33c728e58288961509587c`.

### Explicitly not authorized by this decision

- **Archive:** PENDING. Tasks 12.8–12.10 remain unchecked and no archive is authorized.
- **Production deployment:** NOT AUTHORIZED.
- **Package publication or release:** NOT AUTHORIZED.
- Framework integration, delivery infrastructure, transports, collectors, brokers, queues,
  storage, SIEM, analytics, browser telemetry, and real-user data processing all remain
  NOT AUTHORIZED.

Merge authorization is an authorization, not an action: the merge itself (12.8) has not
been performed.

## Decision

Technical review status: PASS
Reviewed technical commit: `c2b10575085ead832d33c728e58288961509587c`
Reviewed technical parent: `27996739d79d4af1e145597d51610b5f3eefa138`
Reviewed technical tree: `7cd5a959e81466b2602b5e433fd49750f6663e95`
Technical-review evidence commit: `eefec5d5b239044c6403bcee87161a7c9eba1fdb`
Technical-review evidence tree: `d6af0b6e31d8d32b582e723da9d8fab228fc0d2a`
Previous technical-review evidence commit: `d05ef82d17a167b0aa49732c66820caf1871054f`
Previous reviewed technical commit: `278c6721ea4eb2214062a33e289d54605bf9333b`
Superseded project-owner decision: `278c6721ea4eb2214062a33e289d54605bf9333b` in implementation-authorization.md — NON-OPERATIVE
Owner identity: Fernando Homem da Costa (@nandohdc)
Owner role: Project owner
Project-owner decision date: 2026-08-05
Owner-reviewed technical commit: `c2b10575085ead832d33c728e58288961509587c`
Owner-reviewed technical-review evidence commit: `eefec5d5b239044c6403bcee87161a7c9eba1fdb`
Owner-reviewed technical-review evidence tree: `d6af0b6e31d8d32b582e723da9d8fab228fc0d2a`
Project-owner decision: APPROVED_FOR_MERGE
Owner self-review is independent assurance: NO
Production deployment authorization: NOT AUTHORIZED
Package publication authorization: NOT AUTHORIZED
Merge authorization: APPROVED
Archive authorization: PENDING

Production deployment approved | `NO — NOT AUTHORIZED`
Package publication/release approved | `NO — NOT AUTHORIZED`
