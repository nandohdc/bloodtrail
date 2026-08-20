# Governance Landing Plan — correct-local-instruction-verification-premise

> **Revision 2 (2026-08-19).** Revision 1 was dry-run end-to-end on a disposable clone and **fails
> the required `design-pattern-governance` check**. The failure is structural, not incidental: this
> is the first grandfathered change the repository has ever archived, and archiving one necessarily
> edits a governance-core artifact. Revision 2 records the proof, the root cause, and a sequence
> proven green at every stage. See "Proven findings" below before executing anything.

> **For Hermes:** This is a governance/archive landing, not code implementation. Use
> `governed-landing-cycle-execution` + `openspec-archive-change` skills; TDD-style red/green does
> not apply, but every task below has exact commands and expected outcomes. The archive skill name
> is ambiguous across two registered skill dirs — load it explicitly from
> `/Users/fernando.costa/Git/bloodtrail/.hermes/skills/openspec-archive-change/SKILL.md`.

**Goal:** Discharge the remaining governance phase of `correct-local-instruction-verification-premise`
(tasks 6.2–6.4), archive it with its spec delta folded, then archive the keeper change
`cover-local-instruction-control-paths` as a pure relocation.

**Architecture:** Implementation is already merged (PR #178): implementation commit T =
`6fab5f9a6f7fc9bd6a63c1727fbc96fbac2890d3`, merge M = `2b9b2297e3665b6f513eb9f85b522f556e61f24b`.
All technical tasks (groups 1–5, 6.1) are complete. What remains is human/record-only work:
independent review (6.2), owner exact-commit decision (6.3), archive commit with spec fold (6.4),
then the keeper's archive — plus the newly discovered governance-core prerequisite (Task 3).

**Tech Stack:** openspec CLI 1.9.0 (local `openspec/` root, no store), git + gh CLI, node 24/26
(pinned `>=24 <25 || >=26 <27`), the repo's governance scripts
(`check-design-pattern-governance.mjs`, `run-governance-dual-check.mjs`), npm `--prefix`
invocations only.

**Known identity pins (verified read-only on 2026-08-19; all resolve):**

| Role | Hash |
| --- | --- |
| Proposal commit P | `9e356f3a81b1290d61b7fc69fd0e1b38d367a285` |
| Technical commit T (review target) | `6fab5f9a6f7fc9bd6a63c1727fbc96fbac2890d3` |
| Merge M (PR #178, identity-preserving, owner-authored) | `2b9b2297e3665b6f513eb9f85b522f556e61f24b` |
| Keeper proposal/assessment commit | `716e35b4f10d07ecc9c33c3e4fdb94fb395f1255` (in M) |
| Fixture decoupling T / archive | `c944fed…` / `3a581fa…` (PRs #179/#180, in main) |
| Landing baseline (HEAD == origin/main) | `e176bce9164addbecac863e1491d46e50f6b58bd` |
| Correction `proposal.md` blob (pinned by policy) | `1c452d4570295f6193309e6d66679dda1b53999b` |
| Spec fold target | `openspec/specs/security-audit-sdk-core/spec.md` |

---

## Proven findings (dry run at `e176bce`, disposable clone)

Reproduction clone retained at
`/private/tmp/claude-501/-Users-fernando-costa-Git-bloodtrail/69342fd0-a74b-4661-9b16-4fa43cefd4bf/scratchpad/dryrun`
(branches `dryrun/v2`, `dryrun/variantA`, `dryrun/variantB`, `dryrun/split*`). The live tree was
never written to.

### F1 — Revision 1's archive commit fails the required check (blocking)

Fold + move + tasks reconciliation, committed, then `--phase final` produces **10 diagnostics**:

```
[grandfathered-scope-expanded]   <dated-archive>/{.openspec.yaml,design.md,proposal.md,specs/…/spec.md,tasks.md}
[openspec-association-unrelated] <dated-archive>/{.openspec.yaml,design.md,proposal.md,specs/…/spec.md,tasks.md}
```

Both classes trace to one fact: **the correction has no `assessment.json`** (it is grandfathered, and
per the archived precedent it cannot be given one — a spec delta forces `canonical_capability_requirement`,
a scope-expansion trigger).

- `checkOpenSpecAssociation` (`perimeter.mjs:187`) builds its covered set from
  `changes.filter((change) => change.capabilities.length > 0)`. A change with no assessment declares
  no capabilities, so it contributes nothing — **not even coverage of its own relocation**, although
  `ownedPathsFor` did add the dated archive dir to its owned paths.
- `checkGrandfatheredScopes` judges the paths the change *owns* against the entry's `bounded_paths`.
  Recognising the relocation puts the dated archive dir into `ownedPaths`, and `bounded_paths` stops
  at the **active** directory — so every archived file reads as out of recorded scope.

Revision 1's Risk #4 anticipated this and said "stop and diagnose". It is now diagnosed. There is no
precedent to lean on: `grandfathering` has held exactly one entry for its whole history, and no
grandfathered change has ever been archived.

### F2 — The fix necessarily edits governance-core, which is a full-assessment trigger

`bounded_paths` cannot be widened and the entry cannot be dropped without editing
`openspec/governance/design-pattern-policy.json`. The policy's own note states the basis for
dropping it: *"…archived on 2026-08-11 and is no longer an active change, so it needs no
grandfathering entry"* (`grandfathering_notes.sdk_remediation`). Retiring it is therefore the
correct, precedented move — but it cascades:

1. `openspec/governance/` is a `governance_core_artifacts` prefix, and `governedPatterns()`
   (`check-design-pattern-governance.mjs:465`) selects **both** `governed_implementation` and
   `governance_core`. So the policy file itself needs association coverage from an active change's
   `owned_paths`. Proven: retiring the entry without that coverage leaves exactly one diagnostic —
   `[openspec-association-unrelated] openspec/governance/design-pattern-policy.json`.
2. `governance_core_path` is in `full_assessment_triggers`. Rule
   `assessment-abbreviated-rejected-when-trigger-matches` (`rules.mjs:241`) rejects an abbreviated
   assessment that declares it, and `checkAssessments` runs in the `final` phase. So whichever change
   owns that path must carry `assessment_level: "full"`.

Revision 1's "Files likely to change … no policy file" is wrong.

> **Green is not proof of honesty here.** The checker never derives triggers from paths; it reads
> `triggers_matched` as declared. Simply adding the policy path to the keeper's `owned_paths` while
> leaving it `abbreviated` with `triggers_matched: []` **passes** the gate — and was tested to pass —
> while making its `full_trigger_absence_proof` ("no governance-core path is touched") false. Do not
> take that path.

### F3 — Revision 1 runs the governance battery where it is vacuously green (blocking)

Revision 1 Step 5 ran the gates *before* the commit. Pre-commit, on a fresh branch with no commits,
`--phase final` prints `passed … enforcement active` and exits 0 — but `--json` shows
`"rangeBase": null, "rangeCommits": null, "rangePaths": null`. `checkPerimeter` returns early at
`if (base === head) return` because the merge base with `main` *is* HEAD. The identical tree yields
10 failures once committed. The perimeter, association, grandfathering and relocation checks all
read `HEAD`, so **the governance battery is meaningful only after the commit.**

`test:git` conversely requires an **empty index**, so the SDK/contract gates must run *before*
`git add`. The battery is therefore two-stage, not one — see Task 5.

### F4 — Corrections of fact in Revision 1

- The correction has **24** tasks, not 42 (2+3+4+4+5+6). Skipping reconciliation makes
  `openspec validate --all --archived --strict` report `5 incomplete tasks (19/24 completed)` — so
  reconciliation is load-bearing, not cosmetic.
- `RELOCATION_ARTIFACTS` is exactly `["assessment.json", "proposal.md"]`. `.openspec.yaml` plays no
  part in relocation recognition. Since the correction has no `assessment.json`, **`proposal.md` is
  the sole recognition artifact**; it must move byte-identical, and the policy separately pins its
  blob at `1c452d45…`. State that precisely in the evidence, not `.openspec.yaml`.
- Do not pipe checker output through `sed`/`grep` when judging outcome — that reports the filter's
  exit status, not the checker's. Read the exit code directly.

### F5 — Confirmed correct in Revision 1 (keep, now proven)

- All identity pins resolve; HEAD == origin/main == `e176bce`; exactly two active changes.
- **6.6 is genuinely discharged.** `mutations.test.mjs` no longer carries the control; the
  self-seeding `archive-movement-unrelated-change.test.mjs` uses `seedSyntheticUnrelatedChange()`,
  and no file outside `openspec/changes/` references the correction's id. Record it; do not re-do it.
- **6.5's mechanism is real and ordering is load-bearing.** A capability declaration grants
  `openspec/specs/<capability>/` (`perimeter.mjs:270`); a *relocated* change loses that grant by
  design. The keeper must be active when the fold lands. Proven green with the keeper untouched.
- **No movement attestation is required.** `check-archive-attestations.mjs` verifies *declared*
  attestations (2 declared, 2 anchored, 0 pending) and passes; the five most recent archives declare
  none. No signed record is required either — review freshness raised nothing.
- In the archived state: `test:changed-paths` (archived mode, anchored to the remediation change),
  `test:governance-history`, `test:archive-attestations`, `test:git` all pass; the 6 tests in
  `local-instruction-classification.test.mjs` + `archive-movement-unrelated-change.test.mjs` pass;
  `test:coherence` failed only on `fresh-build-required` (no build in the clone).
- The keeper's own archive is green as a pure relocation, and the sequence ends with
  `openspec list` → `No active changes found.`

---

## Task 0: Read-only preflight (no commits, no edits)

**Objective:** Pin current state before any landing work.

```bash
git -C /Users/fernando.costa/Git/bloodtrail status --short --branch
git -C /Users/fernando.costa/Git/bloodtrail rev-parse HEAD origin/main
openspec list --json   # expect exactly two active changes
git show 6fab5f9 --stat
git diff 6fab5f9^ 6fab5f9 -- packages/security-audit-sdk-core/scripts/check-changed-paths.mjs
```

Expected: main clean; HEAD == origin/main == `e176bce…` (re-check; may have moved — if it has, redo
the dry run at the new base before executing); keeper active with `assessment.json` capabilities
`["security-audit-sdk-core"]`; T is exactly 4 files (design.md, tasks.md, the new
`local-instruction-classification.test.mjs`, the 8-line deletion in `mutations.test.mjs`); the
checker diff is **empty** (task 3.4's claim). If the checker blob differs from its parent, stop.

---

## Task 1: Independent technical review of exact commit T (task 6.2)

**Objective:** Obtain a recorded review of `6fab5f9` performed independently of the implementing
pass. Test success is not review; the reviewer re-derives the claims.

**Decision needed first (ask the owner):** who performs the review. Precedent (remediation 12.4):
an independent pass run by the owner via a separate session/agent. The implementing agent must not
self-review. Options: (a) owner runs Claude Code against this checklist; (b) owner authorizes a
fresh agent session as the independent reviewer. Record the chosen mechanism in the evidence.

**Review checklist (independent re-derivation, read-only, disposable clones):**

1. Scope confinement: `git show 6fab5f9 --stat` — only the four files above; no SDK source,
   generated artifact, contract artifact, or public API changes.
2. Checker immutability: `git diff 6fab5f9^ 6fab5f9 -- scripts/check-changed-paths.mjs` empty;
   rule at `:476`, bucket name `local-instruction-unrelated`, summary line `:142-144` byte-identical
   to parent.
3. Control correctness: read `local-instruction-classification.test.mjs` — `classificationCount`
   anchors the summary line and fails loudly on parse failure, `?? 0` covers absent keys;
   `assertLocalInstructionDelta` measures before/after delta, not global absence.
4. Two-state proof: on a disposable clone of `6fab5f9` (or `2b9b229`), run
   `npm run test:verification --prefix packages/security-audit-sdk-core` (build first) with no
   tracked `CLAUDE.md` → pass; on a second clone with a root `CLAUDE.md` force-added and committed →
   pass with `"local-instruction-unrelated":1` reported.
5. Mutation re-derivation: unwrap each `assert.throws` in a disposable clone —
   (a) tracked-instead-of-ignored fails with `changed local-instruction-unrelated records by 1, expected 0`;
   (b) classification-rule-removal fails with `…by 0, expected 1` while the checker still exits 0;
   (c) third probe (flip expected 0→1) fails `…by 0, expected 1`. Each message must name the path
   and the observed vs expected delta.
6. No runtime surface: `test:dependencies` 0 runtime deps; `check:generated`,
   `test:contract-immutability`, `test:exports`, `test:compatibility` green.

**Record:** findings + reviewer identity + mechanism in the archive evidence (Task 6); tasks.md 6.2
gets a one-paragraph entry naming the reviewer pass, the exact commit, and that mutations were
**re-derived**, not merely re-run.

---

## Task 2: Owner decisions (task 6.3 + the F2 governance-core decision)

**Objective:** Obtain and record two explicit owner decisions.

**2a — exact-commit decision (task 6.3).** Name in plain chat:

- exact commit: `6fab5f9a6f7fc9bd6a63c1727fbc96fbac2890d3`
- granted: proceed to archive this change with its spec delta folded into
  `openspec/specs/security-audit-sdk-core/spec.md`
- withheld: no production deployment, publication, or scope expansion authorization of any kind

**2b — how to carry the governance-core edit (new; caused by F2).** Archiving cannot avoid retiring
the grandfathering entry. Two options, **both dry-run green**:

| | Option A — dedicated change *(recommended)* | Option B — upgrade the keeper |
| --- | --- | --- |
| Shape | New change `retire-local-instruction-grandfathering`: `skip_specs: true`, **full** assessment, `triggers_matched: ["governance_core_path"]`, `owned_paths` = the policy file + the dated archive dir | Keeper becomes `assessment_level: "full"`, declares `governance_core_path`, gains the same two `owned_paths` |
| Keeper | untouched | its recorded `rejection_reasons` — which rejected touching governance-core precisely to avoid "making the change the author of its own governance basis" — is contradicted, and its absence proof must be deleted |
| PRs | 5 (propose → retire → archive correction → archive keeper → archive retire-change) | 2 |
| Proof | `dryrun/split` + `dryrun/split-archive`, green at every stage | `dryrun/variantA`, green |

Recommend **A**: it keeps "hold capability coverage open" and "retire a provenance entry" as separate,
separately reviewable decisions, matches the repo's twice-used pattern of a dedicated change for a
dedicated governance need, and leaves an already-merged assessment untouched. B is the cheaper path
if the owner prefers fewer moving parts; it is honest **only** with the level upgraded and the
trigger declared — never by quietly extending `owned_paths` (see F2's warning).

Rules (from `governed-landing-cycle-execution`): the owner answers explicitly; a clarify timeout,
green CI, AI review, or PR state is NOT approval. Record both decisions verbatim in tasks.md 6.3 and
in the archive evidence. **Tasks 3–7 below assume Option A**; under Option B, fold Task 3 into
Task 4's commit and drop Task 7.

---

## Task 3: Retire the grandfathering entry (Option A; two PRs)

**Objective:** Land the governance-core prerequisite before the archive, under its own change.

**Step 1 — propose (PR 1).** New change `openspec/changes/retire-local-instruction-grandfathering/`
via `openspec-propose` / `openspec-new-change`:

- `.openspec.yaml`: `schema: spec-driven`, `skip_specs: true` (no delta ⇒ no
  `canonical_capability_requirement` trigger, no recursion).
- `assessment.json`: `assessment_level: "full"`, `decision: "direct_implementation"`,
  `applicability.triggers_matched: ["governance_core_path"]`, **no** `full_trigger_absence_proof`,
  `capabilities: ["software-design-pattern-governance"]` (non-empty or it contributes no coverage —
  `perimeter.mjs:187`), `owned_paths`:
  `["openspec/governance/design-pattern-policy.json", "openspec/changes/archive/2026-08-19-correct-local-instruction-verification-premise/"]`.
  A full assessment needs a `direct_implementation` candidate **and** a materially plausible
  alternative (`rules.mjs:47,54`); `security_sensitive: false` needs all 15 dimension justifications.
- `proposal.md`: cite the reproduced failure (F1's 10 diagnostics) and the retirement basis quoted
  from `grandfathering_notes.sdk_remediation`.
- `tasks.md`: 1.1 record basis/reproduction; 1.2 retire the entry; then landing tasks.

Commit `docs(openspec): propose retiring the local-instruction grandfathering entry`. Gates per
Task 5. Dry run: green (4 paths inspected).

**Step 2 — implement (PR 2).** Set `grandfathering` to `[]` in
`openspec/governance/design-pattern-policy.json`; check 1.2. Commit
`fix(governance): retire the local-instruction grandfathering entry`. Gates per Task 5. Dry run:
green (5 paths). The correction stays active and untouched throughout.

---

## Task 4: Archive the correction (task 6.4)

**Objective:** Archive `correct-local-instruction-verification-premise` in a dedicated commit on a
dedicated branch, with spec fold, reconciliation edits, and full revalidation.

**Step 1 — branch off updated main (never main; never `checkout -b … origin/main`)**

```bash
git -C /Users/fernando.costa/Git/bloodtrail checkout main && git pull
git -C /Users/fernando.costa/Git/bloodtrail switch -c docs/archive-correct-local-instruction-verification-premise
```

**Step 2 — spec sync BEFORE the move** (archive skill step 4; never sync after moving)

```bash
openspec status --change correct-local-instruction-verification-premise --json
```

Run the skill's agent-driven sync of the `## ADDED Requirements` delta into
`openspec/specs/security-audit-sdk-core/spec.md` **inline, not delegated to background**, then verify
the ADDED requirement (*Changed-path verification distinguishes ignored from tracked local
instruction files*) is present with all four scenarios. Confirm the keeper is still active (6.5).

**Step 3 — move the change dir**

```bash
mv openspec/changes/correct-local-instruction-verification-premise \
   openspec/changes/archive/2026-08-19-correct-local-instruction-verification-premise
```

`proposal.md` must move byte-identical — it is the sole relocation-recognition artifact (F4). Verify:
`git rev-parse HEAD:openspec/changes/archive/2026-08-19-…/proposal.md` == `1c452d45…`.

**Step 4 — reconciliation edits INSIDE the moved dir only** (fixture precedent: exactly two files)

1. `tasks.md` — mark 6.2 (Task 1 review evidence), 6.3 (Task 2a owner decision), 6.4 (this archive),
   6.5 (keeper confirmed active at fold; cite its `assessment.json`), 6.6 (discharged by PRs
   #179/#180: `c944fed` decoupled the fixture, `3a581fa` archived that change — record, don't re-do).
   All **24** tasks must end checked, or `--archived --strict` fails.
2. `archive-evidence.md` — NEW, modeled on
   `openspec/changes/archive/2026-08-19-self-sufficient-archive-movement-fixture/archive-evidence.md`:
   Identities (P/T/M/parents/reachability), Task completeness (24 tasks, evidence per group),
   Independent review record (Task 1), Owner decisions (Task 2a **and** 2b), Spec-fold evidence
   (delta folded, keeper active, `--archived` validation passes), **Grandfathering retirement**
   (entry retired in PR 2 under `retire-local-instruction-grandfathering`; basis quoted from
   `grandfathering_notes`; this is the first grandfathered change archived in the repo), Canonical
   capability presence, Production/publication restrictions (unchanged, gate-enforced), Immutable
   archive contents (`proposal.md` byte-identical: `git rev-parse <M>:<active>` vs `<HEAD>:<archived>`;
   note `.openspec.yaml` moves unchanged but is *not* a relocation artifact), Active enforcement
   verified.

**Step 5 — gates (Task 5), then commit**

```bash
git add openspec/     # explicit allowlist: spec.md fold + archive move + reconciliation
git commit -m "docs(openspec): archive correct-local-instruction-verification-premise"
```

Then run the **post-commit** stage of Task 5. Open the PR; required CI (incl.
`design-pattern-governance`) must be green; owner merges identity-preserving (agent reports
readiness, never merges). Proposal/implementation/archive stay separate commits. Dry run: green
(11 paths), `--archived --strict` 14/14.

---

## Task 5: The two-stage gate battery (run for every PR above)

**Stage 1 — before `git add`** (`test:git` requires an empty index):

```bash
npm run check:generated --prefix packages/security-audit-sdk-core   # before validate, which regenerates
npm run validate --prefix packages/security-audit-sdk-core          # 20 gates
npm run validate --prefix contracts/security-audit                  # 14 gates
openspec validate --all --strict
openspec validate --all --archived --strict
git diff --check
```

**Stage 2 — after the commit** (F3: these read `HEAD`; before the commit they are vacuously green):

```bash
node openspec/scripts/check-design-pattern-governance.mjs --phase final ; echo "exit=$?"
node openspec/scripts/check-design-pattern-governance.mjs --phase final --json | head -20   # confirm rangePaths is NOT null
node openspec/scripts/run-governance-dual-check.mjs                       # candidate == baseline
node --test openspec/tests/design-pattern-governance/*.test.mjs
```

Never judge these through a pipe — read the exit code directly. If `rangePaths` is `null`, the check
did not run; you are on `main` or the work is uncommitted. Watch specifically:
`test:governance-history`, `test:archive-attestations`, `test:coherence`, `test:changed-paths`,
`test:git`, and the governance final phase. An `openspec-association-unrelated` on the policy file
means the retire-change is no longer active; on the dated archive dir it means its `owned_paths`
entry is missing or misspelled (a trailing `/` makes it a subtree grant — keep it).

---

## Task 6: Archive the keeper as a pure relocation (keeper tasks 1.2/2.1/2.2)

**Objective:** After the correction archive merges, archive `cover-local-instruction-control-paths`
with no spec fold (`skip_specs: true`, no delta).

Preconditions: correction archive merged; main updated. Keeper 2.1 is already factually satisfied —
merged with PR #178 at `2b9b229` (commit `716e35b`); record, don't re-do.

```bash
git checkout main && git pull
git switch -c docs/archive-cover-local-instruction-control-paths
mv openspec/changes/cover-local-instruction-control-paths \
   openspec/changes/archive/2026-08-19-cover-local-instruction-control-paths
```

Edits inside the moved dir only: `tasks.md` all 4 checked (1.2 discharged by the correction's archive,
2.1 with merge evidence, 2.2 = this archive); `archive-evidence.md` NEW — pure relocation,
`skip_specs: true`, spec blob unchanged, `assessment.json` + `proposal.md` byte-identical (both are
relocation artifacts here, so recognition is doubly satisfied), no signed record (test-only, N/A by
design). Task 5 battery, then `docs(openspec): archive cover-local-instruction-control-paths`, PR,
required CI green, owner merge. Dry run: green (8 paths), `--archived --strict` 15/15.

---

## Task 7: Archive the retire-change (Option A only)

Same shape as Task 6: pure relocation, `skip_specs: true`, `archive-evidence.md` recording that its
capability declaration covered the correction's dated archive dir and the policy file until both had
landed. Its own archive is self-covered — it carries an `assessment.json`, so its relocation is
recognised and its capability is non-empty. Commit
`docs(openspec): archive retire-local-instruction-grandfathering`.

---

## Task 8: Final state verification and report

```bash
openspec list                                   # expect: no active changes
openspec validate --all --strict
openspec validate --all --archived --strict
node openspec/scripts/check-design-pattern-governance.mjs --phase final ; echo "exit=$?"
git -C /Users/fernando.costa/Git/bloodtrail status --short --branch   # clean, synced
```

Report: exact commits (P/T/M/A for each archive), gate results, what was **not** verified (no CI
claim before CI runs; review is not approval), and that production/publication authorization remains
withheld.

---

## Files that change

- `openspec/changes/retire-local-instruction-grandfathering/` — new (Option A), later moved to
  `openspec/changes/archive/2026-08-19-retire-local-instruction-grandfathering/`
- `openspec/governance/design-pattern-policy.json` — `grandfathering` emptied (**governance-core**;
  this is new in Revision 2 and is unavoidable — see F2)
- `openspec/specs/security-audit-sdk-core/spec.md` — gains the ADDED requirement (via sync only,
  never hand-edited)
- `openspec/changes/archive/2026-08-19-correct-local-instruction-verification-premise/` — moved;
  `tasks.md` reconciled; `archive-evidence.md` new
- `openspec/changes/archive/2026-08-19-cover-local-instruction-control-paths/` — moved;
  `tasks.md` reconciled; `archive-evidence.md` new
- Under Option B instead: `openspec/changes/cover-local-instruction-control-paths/assessment.json`
  upgraded to `full`
- Nothing else. No `packages/`, no `contracts/`, no checker, no `verification-lifecycle.json`
  (confirmed: its lifecycle anchor is `remediationChange`, unaffected).

## Risks, tradeoffs, open questions

1. **Who performs the independent review (6.2)?** Owner decision; the implementing agent cannot
   review its own pass. Resolve before Task 1.
2. **Which governance-core option (F2/Task 2b)?** Owner decision. Both proven green; A recommended.
3. **Where the review record lives:** inline in `tasks.md` + `archive-evidence.md` (fixture
   precedent) vs a standalone packet file. Recommend inline; confirm with owner.
4. **`main` may move.** Every proof above is anchored at `e176bce`. If main advances before
   execution, re-run the dry run at the new base — the association and grandfathering results depend
   on which changes are active in the range.
5. **Retiring the entry is a real loss of a record.** The provenance entry documented why the
   correction was allowed to land without an assessment. Its `bounded_scope` prose should be quoted
   into `archive-evidence.md` before removal so the reasoning survives in the archive, even though
   the policy no longer carries it.
6. **Ordering is load-bearing.** The keeper must stay active through the correction's archive commit
   (6.5), and the retire-change through the same commit (it owns the dated archive dir). Archive them
   only afterwards, one PR each.
7. **Do not "fix" a red governance phase by widening `owned_paths` or `bounded_paths` reflexively.**
   Both are coverage grants that outlive the PR that adds them; scope them to exact paths and retire
   them by archiving.
8. **This plan is a draft** subject to the owner's corrections; execution follows the corrected form
   only.
