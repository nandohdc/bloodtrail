# Governance Plan — enforce-archive-relocation-completeness

> **Revision 2 (2026-08-19).** Revision 1's findings were re-read against the sources at `232376b`
> rather than carried forward. Most held; four did not, and five new findings changed the plan.
> **What moved:** F1's second anchor was wrong (the disk read is in the checker, not `perimeter.mjs`);
> the map this control consumes lives in `perimeter.mjs`, not beside the recogniser; the
> reconstruct-`057d457` proof rests on a commit that is **unreachable from any ref** (F7); the
> documentation target uses no R-numbers (F8); and the assessment's "materially plausible
> alternative" was a strawman that F12 replaces with a real one. Read "Proven findings" before
> executing anything. **The two blocking design forks are now settled** — the invariant is
> range-scoped and R25 is ADDED; see "Decisions taken".

> **For Hermes:** This is a governance-core code change, not a landing. Use `openspec-propose` /
> `openspec-apply-change` / `openspec-verify-change` / `openspec-archive-change`. TDD applies here
> and is load-bearing: the control must be shown to fail on the reconstructed defect before it is
> trusted, per the repository's own precedent that a gate nobody proved can fail is a gate that
> never fired.

**Goal:** Make an incomplete OpenSpec archive relocation fail closed. When a range introduces a
recognised relocation of change `<id>` into `openspec/changes/archive/<dated>-<id>/`, the active
directory `openspec/changes/<id>/` MUST NOT still exist at `HEAD`.

**Architecture:** One new module under `openspec/scripts/design-pattern-governance/`, one call site
in the checker, one new spec requirement, one new test file. The recognition machinery already
exists — `collectRelocatedChangeIds` computes exactly the map this check needs. Nothing in the
perimeter, association, provenance, or review-freshness paths changes.

**Tech Stack:** plain ESM `.mjs` under `openspec/scripts/design-pattern-governance/`, `node --test`
fixtures under `openspec/tests/design-pattern-governance/`, openspec CLI 1.9.0 (verified on PATH),
git + gh, Node pinned `>=24 <25 || >=26 <27`, npm via `--prefix` only (there is no root
`package.json`).

**Known pins (re-verified read-only on 2026-08-19 at `232376b`; every line anchor below was read,
not carried over from Revision 1):**

| Role | Value |
| --- | --- |
| Landing baseline (HEAD == origin/main) | `232376b6ebc76ead6797ddc21470998d4f56a6a6` |
| The defect this closes | `057d4571635189cfae129adc991871845bc514fc` (**unreachable — see F7**) |
| Its repair | `71aa458df1b5b18af5d6689517a42a697f5fced7` |
| Checker blob (candidate == baseline today) | `13cd54e26afafb56355ef1bf422d36f5d0cd03da` |
| Relocation recogniser | `openspec/scripts/design-pattern-governance/archive-relocation.mjs` (55 lines) |
| Map producer | `perimeter.mjs:210` `collectRelocatedChangeIds` — **not** in the recogniser |
| Call site | `check-design-pattern-governance.mjs:331` |
| Perimeter short-circuit | `check-design-pattern-governance.mjs:321` (`if (base === head) return;`) |
| Governance capability spec | `openspec/specs/software-design-pattern-governance/spec.md` (595 lines, exactly 24 requirements) |
| Governance records | `verification-lifecycle.json` → `governanceRecords`: 4, all signed, 0 acceptances |

---

## Proven findings (read from source at `232376b`)

### F1 — The gap is real and neither gate can see it

`057d457` was `5 files changed, 246 insertions(+)`, additions only: the dated archive directory was
added, the active directory was never staged. `git ls-tree HEAD openspec/changes/` listed both. It
passed:

- the full local battery — because `collectRangePaths` folds `changedPaths(base, null)`
  (**working tree**, `perimeter.mjs:113`) and `untrackedPaths()` (`perimeter.mjs:114`) into the
  inspected range, and **`activeChangeIds()` at `check-design-pattern-governance.mjs:425` seeds
  active ids with `readdirSync` over `openspec/changes` — the filesystem.** The unstaged deletions
  were inside the range and the active directory was gone from disk, so the checker validated the
  move that was *performed*, not the one that was *committed*. `openspec list` and
  `openspec validate` read the filesystem too.

  > **Corrected from Revision 1**, which attributed the disk read to `collectOpenSpecChanges`
  > (`perimeter.mjs:242`). That function *receives* `activeChangeIds` as a parameter and reads no
  > filesystem; the anchor matters because the fix must not be attempted there.

- all 18 CI checks — because CI sees only the pushed commit, and its 5 added paths are legitimately
  covered: the archived directory carries an `assessment.json` with a non-empty
  `applicability.capabilities`, so `carriesRelocatedArtifact` recognises the relocation and
  `ownedPathsFor` (`perimeter.mjs:261-272`) grants it. In CI the active directory *is* present on
  disk, so `activeChangeIds()` returns it — but nothing cross-references "an archive was introduced"
  against "the active directory is still here", which is the entire gap.

Both gates are individually correct. Neither asks the question this check asks.

### F2 — No signed record and no baseline acceptance are required

Confirmed by reading, with exact anchors. `run-governance-dual-check.mjs` fails only on the
self-approval signature: `exitCode()` at `:145` returns 1 when `candidate.exit_code !== 0`, returns
**0 whenever `baseline.exit_code === 0`**, and only then consults the acceptance.
`baselineRejectsCandidatePass()` at `:438` is literally *baseline failed AND candidate passed*. A
strictly stricter candidate produces the opposite shape, which needs no
`baselineDisagreementAcceptance` and therefore no signed record.

Review freshness is likewise not triggered: `verifySignedReviewFreshness` binds records that
*exist*; a change never signed is "a legitimate pre-signing technical state"
(`review-freshness.mjs:13-16`). The keeper and retire changes just landed with no record at all.

**The one hard requirement this creates:** the candidate checker must pass on this change's own
commits. Since this change performs no archive relocation until its own archive PR, the new control
does not fire on itself before then — and at its archive PR it must fire *correctly*, i.e. pass,
which Stage 3 verifies.

### F3 — `governance_core_path` is the trigger, and it is a full-assessment trigger

Verified against `openspec/governance/design-pattern-policy.json`:
`openspec/scripts/design-pattern-governance/` and `docs/design-pattern-governance.md` are both in
`governance_core_artifacts`; `openspec/scripts/`, `openspec/tests/`, `openspec/specs/` are all in
`normative_paths`; `governance_core_path` **and** `canonical_capability_requirement` are both in
`full_assessment_triggers`. The change also carries a spec delta, so both must be declared.

`rules.mjs:241` (`assessment-abbreviated-rejected-when-trigger-matches`) rejects an abbreviated
assessment that declares any trigger, and an assessment declaring a false
`full_trigger_absence_proof` is the dishonest path the previous cycle explicitly refused. Declaring
both triggers on a **full** assessment is the honest and unproblematic shape: unlike the
grandfathered correction, this change has no provenance entry to void.

`context.governanceCore` is **reported only** (`check-design-pattern-governance.mjs:343` sets it,
`:488` reports it); it gates nothing on its own.

### F4 — Firing on "touched" rather than "introduced" would be a false positive

`collectRelocatedChangeIds` (`perimeter.mjs:210`) iterates every path in the range and recognises a
relocation whenever the archived artifact matches an object history carried at the active path. It
does not distinguish *the relocation happening in this range* from *someone editing an old archive
directory later*.

So the control fires only when the relocation is **introduced in this range**: no
`RELOCATION_ARTIFACTS` entry resolves at `base` for the archived directory, and the directory
resolves at `HEAD`. `objectAtPath(base, path)` in `git.mjs:102` provides this.

**Implementation note added in Revision 2:** `objectAtPath` is `git rev-parse <rev>:<path>`, which
resolves a **directory to its tree object**, not only files. Revision 1's "`objectAtPath` on any
tracked child" is unnecessary — `objectAtPath("HEAD", "openspec/changes/<id>")` answers the question
directly and is the simpler call.

**How hypothetical is the false positive?** Measured, not assumed: 16 archived changes, **zero id
reuse** — stripping the date prefix yields 16 distinct ids, and `git log --diff-filter=A` shows each
`openspec/changes/<id>/proposal.md` was created exactly once in repository history. The scenario has
never occurred. It is guarded anyway (test case 3), because the cost of the guard is one test and
the cost of being wrong is rejecting legitimate work. See "Open decisions" for the state-scoped
variant this trades away.

### F5 — The fixture reproduces the defect without partial staging

`DisposableRepository.commit()` (`disposable-repo.mjs:96`) runs `git add -A`, so it cannot reproduce
a half-staged index directly. It does not need to: **copying** the change directory to the dated
archive path and leaving the original in place produces the identical committed end state — both
directories present at `HEAD` — which is exactly what `057d457` produced. `remove()` is at `:83` for
the complete-move case. Tests that genuinely need a partial index can call `repository.git(["add", …])`
then `repository.git(["commit", …])` and bypass `commit()`.

**Added in Revision 2:** `createRepository()` builds a **fresh `mkdtemp` repository** and copies
`SEEDED_PATHS` into it — it does **not** clone live history. `SEEDED_PATHS` includes
`openspec/scripts`, so the new module is picked up by fixtures automatically with no harness change.
It does not include `openspec/specs` or `openspec/changes`; fixtures build those themselves.

### F6 — Nothing pins a requirement count

`controlled_value_counts` covers `families` (10), `memberships` (30), `unique_values` (29) — not
requirements. `self-governance.test.mjs:41` pins the **24-entry pattern catalog**, which this change
does not touch. The capability spec has exactly 24 requirements today; adding R25 is safe.
`test:coherence` in the SDK pins SDK counts only and is unaffected.

### F7 — **NEW.** The `057d457` proof rests on a commit that no longer exists anywhere durable

`git merge-base --is-ancestor 057d457 main` → **false**. `git branch -a --contains 057d457` → **no
branch, local or remote**. The commit survives only in this workstation's reflog, where unreachable
entries expire by default at 30 days (`gc.reflogExpireUnreachable`). It is **absent from any fresh
clone and from CI**.

Two consequences for Revision 1's Task 2 Step 4:

1. "In a disposable clone, reconstruct `057d457`" cannot work as written. `createRepository()` does
   not clone history at all (F5), and a real `git clone` of this repository would not carry an
   object reachable from no ref.
2. The step Revision 1 called "the only step that distinguishes this change from a plausible no-op"
   was resting on the least durable artifact in the repository.

**Mitigation, and it is the first thing Task 0 does:** capture the commit as a patch file *now*,
before anything else, because the capture is free and the loss is irreversible. Then make the
synthetic fixture (F5) the load-bearing proof, since a proof CI can re-run forever beats a proof
that lived in one laptop's reflog.

### F8 — **NEW.** The documentation target uses no requirement numbers

`docs/design-pattern-governance.md` contains **zero** occurrences of `R15`, `R23`, `R24`, or any
other requirement number. `checkActorNeutralDocuments` (`documentation.mjs:32`) enforces only five
**claim regexes** for that file (`documentation.mjs:13-20`) — "applies identically to", the
non-authoritative-sources claim, "first-class", the catalog-exhaustiveness claim, and the required-CI
claim. None of them counts or names requirements.

So Revision 1's "add R25 to the rules narrative" is (a) **not enforced by anything**, and (b)
actively misleading if executed literally — writing a numbered `R25` entry would break the
document's established voice. Task 3 is rewritten accordingly.

### F9 — **NEW.** `run-governance-dual-check.mjs` greps as a binary file

The file contains **two literal NUL bytes**, at line 206 col 65 and line 217 col 69, used as a
separator between `entry.id` and `entry.path` in `diagnosticsMismatch`/`describeKeys`. Every
`grep`/`ugrep` invocation over it therefore returns *nothing at all* rather than no-match — which is
how Revision 1's F2 function names first appeared not to exist.

Not a defect in the code's behaviour: JavaScript handles the bytes fine and the separator choice is
deliberate. But in a repository whose thesis is *prove the gate can fail*, a governance-core file
that silently greps as empty is a verification hazard. Use `command grep --binary-files=text` (or
`sed`/`node`) when reading that file. **Out of scope for this change** — recorded so the next person
does not lose the same twenty minutes.

### F10 — **NEW.** There is no diagnostic-id registry

`diagnostics.mjs` takes free-form string ids; nothing validates them against a list, and no policy
key, schema, or document enumerates them. The contract is social and test-enforced: the module
header states "every control in this checker is reachable by a named id that a mutation test can
demand", and fixtures assert exact ids.

So adding `archive-relocation-incomplete` requires **no registration anywhere** — but it also gets
**no protection from a typo**, which is precisely why the mutation probe (Task 2, case 4) is
mandatory rather than nice-to-have.

### F11 — **NEW.** The four existing R15 tests do not regress

`association.test.mjs:226-284` already exercises relocation. Traced against the proposed control:

| Test | What it does | Why the new control stays silent |
| --- | --- | --- |
| accepts a byte-identical relocation | `git mv` active → archive, commit | relocation introduced, but active directory **absent** at HEAD → pass |
| rejects a planted archive directory | `remove()` active, write decoy assessment | decoy fails `carriesRelocatedArtifact` → never enters the map |
| rejects archived evidence that drifts | `git mv`, commit, then tamper with `assessment.json` | still recognised via unmutated `proposal.md`, but active directory was `git mv`'d away → silent; its own diagnostic still fires |
| relocation stops covering the capability spec | relocate, commit, **then** set `base` | at `base` the relocation already exists → not "introduced in this range" → skipped (F4) |

This is a desk trace, not a run. Task 2 Step 6 runs the suite for real; if any of these four turns
red, the control is wrong, not the test.

### F12 — **NEW.** The SDK already has archive-movement gates, and they are structurally out of reach

`npm run validate --prefix packages/security-audit-sdk-core` includes `test:changed-paths`
(`check-changed-paths.mjs`, 530 lines) and `test:archive-attestations`
(`check-archive-attestations.mjs`, 278 lines). Both ran green over `057d457`. Why they could not
catch it:

- `check-changed-paths.mjs` is bound to exactly two named changes via `verification-lifecycle.json`
  (`originalSdkChange: implement-security-audit-sdk-core`, `remediationChange:
  remediate-security-audit-sdk-adversarial-review`). `cover-local-instruction-control-paths` is
  neither, so the gate never looked.
- `check-archive-attestations.mjs` declares its own scope in its header: "attestations that are
  declared. Archives that never declared one predate the mechanism." There are **2**
  `movementAttestations`, both from August 11; the 2026-08-19 archives declared none.

This matters twice. First, it kills Revision 1's assessment alternative — "enforce completeness in
CI with a `git ls-tree` shell step" is a strawman no reviewer would credit. Second, it supplies the
**materially plausible alternative** the full assessment actually requires: *extend the SDK's
attestation mechanism to cover every archive rather than adding a governance-checker control*. That
is a real design someone would propose. Task 1 records it and rejects it on stated grounds.

### F13 — **NEW.** R24 already requires what `057d457` violated

R24 (`spec.md:578`) requires the governed archive step to verify, among other things, "**exact
changed paths**". `057d457` violated R24 as written. The gap is not a missing rule — it is that
R24's obligations are prose discharged by a human writing `archive-evidence.md`, and PR #185's
evidence file asserted exactly the property the commit contradicted.

This sharpens the case for ADDED-R25 rather than weakening it: R24 governs the *archive step's*
obligations and is satisfied by assertions; R25 governs *the commit tree* and is checkable without
reference to any evidence document. The proposal must say this, because a reviewer who reads R24
will otherwise ask why a new requirement is needed at all.

---

## Decisions taken (owner, 2026-08-19)

These two were the blocking forks. They are **settled** — recorded here so they are not
re-litigated mid-implementation, and so the assessment can cite them.

**D1 — The invariant is range-scoped.** The control fires only on a relocation *introduced in this
range*: no `RELOCATION_ARTIFACTS` entry resolves at `base`, and the archived directory resolves at
`HEAD`. The state-scoped variant (no change id may be simultaneously active and
recognised-archived at `HEAD`) was considered and rejected: it is strictly stronger and would also
catch an incomplete move that already landed on `main`, but it fires on the archive-then-reopen
shape, and rejecting legitimate work is the more expensive failure for a gate that runs on every
PR. The `sink.warn` middle option is not taken. **Consequences:** `base` stays in the module
signature; test case 3 stays in the suite; and the already-landed case is a known, accepted residual
— see Residual risks.

**D2 — R25 is ADDED, R24 is untouched.** R24 governs what the archive step's *evidence* must assert;
R25 governs what the *commit tree* must contain. Folding them would put two enforcement models
inside one requirement — one discharged by a human writing `archive-evidence.md`, one checkable
without reference to any document. **Consequence:** the delta is `## ADDED Requirements` carrying
R25 verbatim as written in Task 1; do not restate or amend R24.

Still open, and settleable while writing: the agent instruction files and the vocabulary — see
"Open decisions".

---

## Task 0: Read-only preflight (no commits, no edits)

**Step 0 — capture the perishable evidence first (F7).** Before anything else, because every other
step risks an auto-gc:

```bash
mkdir -p /tmp/bloodtrail-evidence
git -C /Users/fernando.costa/Git/bloodtrail format-patch -1 --stdout 057d4571635189cfae129adc991871845bc514fc \
  > /tmp/bloodtrail-evidence/057d457-incomplete-archive.patch
git -C /Users/fernando.costa/Git/bloodtrail show --stat --no-renames 057d4571635189cfae129adc991871845bc514fc \
  > /tmp/bloodtrail-evidence/057d457-stat.txt
```

Expect the stat to read `5 files changed, 246 insertions(+)` with **no deletions**. Keep both files
until the change lands; decide at Task 1 whether the stat excerpt belongs in `proposal.md` as
evidence (recommended — it is small, and it is the whole motivation).

**Step 1 — the rest of preflight:**

```bash
git -C /Users/fernando.costa/Git/bloodtrail status --short --branch
git -C /Users/fernando.costa/Git/bloodtrail rev-parse HEAD origin/main
openspec list                                   # expect: No active changes found.
node openspec/scripts/run-governance-dual-check.mjs   # expect candidate == baseline, blob 13cd54e26afa
git ls-tree --name-only HEAD openspec/changes/  # expect only openspec/changes/archive
```

If `main` has moved past `232376b`, re-read `archive-relocation.mjs`, `perimeter.mjs`, and
`check-design-pattern-governance.mjs` before trusting F1/F4 — those findings are line-anchored.

---

## Task 1: Propose the change

New change `openspec/changes/enforce-archive-relocation-completeness/` via `openspec-propose`.

- `.openspec.yaml`: `schema: spec-driven`. **No** `skip_specs` — this change carries a delta.
- `assessment.json`: `assessment_level: "full"`, `decision: "direct_implementation"`,
  `applicability.triggers_matched: ["governance_core_path", "canonical_capability_requirement"]`,
  **no** `full_trigger_absence_proof`,
  `applicability.capabilities: ["software-design-pattern-governance"]` (non-empty, or the change
  contributes no association coverage — `perimeter.mjs:187`), and `owned_paths` naming **exact file
  paths, not directory prefixes** (an active change's `owned_paths` covers future PRs too):

  ```
  openspec/scripts/design-pattern-governance/archive-completeness.mjs
  openspec/scripts/check-design-pattern-governance.mjs
  openspec/tests/design-pattern-governance/archive-completeness.test.mjs
  docs/design-pattern-governance.md
  ```

  A full assessment needs a `direct_implementation` candidate (`rules.mjs:47`) **and** a materially
  plausible alternative (`rules.mjs:54`); `security_sensitive: false` needs all 15 dimension
  justifications.

  **The alternative to record and reject (rewritten in Revision 2, see F12):** *extend the SDK's
  archive-movement attestation mechanism (`check-archive-attestations.mjs` +
  `movementAttestations` in `verification-lifecycle.json`) to cover every archived change, instead
  of adding a control to the governance checker.* This is the real alternative — the mechanism
  exists, it already reasons about archive directories against history, and it is already in the
  local battery. Reject it on stated grounds: it is scoped by declaration, so it protects only
  archives whose authors remembered to declare them and is silent by construction on the case that
  motivated this change; it lives in the SDK workspace, whose gates are bound to two named SDK
  changes and have no jurisdiction over `openspec/changes/` generally; and it is not reachable by
  the dual check, so a weakening of it could not be caught by the baseline checker. *(Do not use
  Revision 1's "CI shell step" alternative — it is a strawman and invites a reviewer to reject the
  assessment as unserious.)*

  **Record the state-scoped variant as a second rejected alternative.** Per D1 the owner weighed it
  explicitly, so the assessment should show the fork rather than imply range-scoping was the only
  design considered: *judge the invariant from repository state at `HEAD` — no change id may be
  simultaneously active and recognised-archived — instead of from what the range introduces.*
  Rejected because it fires on the archive-then-reopen-same-id shape, and for a gate on every PR,
  rejecting legitimate work costs more than missing an already-landed defect. Note in the same
  entry that the shape has never occurred here (16 archives, 16 distinct ids, each created once),
  so the rejection is a deliberate margin, not a response to an observed failure.

- `specs/software-design-pattern-governance/spec.md`: an `## ADDED Requirements` delta carrying
  **R25** (below). R24 stays untouched — per F13 it governs what archive *evidence* must assert;
  R25 governs what the *commit* must contain.
- `proposal.md`: cite `057d457` by hash **with the captured stat** (Task 0 Step 0), the two-sided
  blind spot from F1, F13's point that R24 already required "exact changed paths" and was satisfied
  by prose, and the fact that PR #185's `archive-evidence.md` asserted "changed paths are exactly the
  active-directory removal and the dated-archive addition" while the commit contradicted it —
  evidence prose is not enforcement. State the residual from F7: the motivating commit is
  unreachable from any ref and the durable proof is the fixture.
- `tasks.md`: group 1 the control + tests, group 2 documentation, group 3 landing (human-owned).
  Groups must complete in order; `check-coherence` rejects starting a later group early and
  merge/archive tasks must stay unchecked while the change is active.

Commit `docs(openspec): propose enforcing archive relocation completeness`. Gates per Task 5.

### The requirement to add

```
### Requirement: R25 — Archive relocation is complete in the commit
A range that introduces a recognised archive relocation of a change SHALL NOT leave that change's
active directory present at HEAD. Completeness SHALL be judged from the commit tree, not from the
working tree, and SHALL be verified for every relocation the range introduces.

#### Scenario: Relocation adds the archive without removing the active directory
- **WHEN** a range introduces `openspec/changes/archive/<dated>-<id>/` and `openspec/changes/<id>/`
  still exists at HEAD
- **THEN** governance verification SHALL fail closed

#### Scenario: Relocation is complete
- **WHEN** a range introduces the dated archive directory and the active directory is absent at HEAD
- **THEN** governance verification SHALL accept the relocation

#### Scenario: An existing archive directory is edited later
- **WHEN** a range touches a dated archive directory whose relocation it did not introduce
- **THEN** the completeness check SHALL NOT fire on that directory
```

## Task 2: Implement the control (TDD — red before green)

**Step 1 — the failing test first.** New file
`openspec/tests/design-pattern-governance/archive-completeness.test.mjs`. A new control gets its own
file, never an append to a hotspot: `codescene delta` scores file-level rules and would fail on the
host file regardless of the new code. Follow the `association.test.mjs` idiom — `createRepository()`
from `support/disposable-repo.mjs`, `runChecker` / `assertDiagnostic` / `assertPasses` /
`assertNoDiagnostic` from `support/harness.mjs` (all four verified to exist at `harness.mjs:15,39,57,65`),
a module-level `repositories[]` with `after(() => …dispose())`.

Four cases, matching R25's scenarios plus the mutation probe:

1. **red** — seed an active change with an `assessment.json` carrying a non-empty capability, record
   `base`, then *copy* (F5) the directory to `openspec/changes/archive/2026-08-19-<id>/`, commit, and
   assert `archive-relocation-incomplete` at the archived path.
2. **green** — same fixture but `repository.remove()` the active directory before committing; assert
   `assertPasses` and `assertNoDiagnostic`.
3. **no false positive** — archive the change completely and commit; then in a *later* commit
   re-create an active change with the same id and touch a file in the old archive directory; assert
   the control does not fire (F4).
4. **mutation** — with the completeness call site removed, case 1 must pass. Mandatory, not optional:
   per F10 there is no diagnostic-id registry, so an exported function reachable from nowhere — or
   reachable under a mistyped id — is indistinguishable from one that always passes.

Run it and watch case 1 **fail** before writing the implementation.

**Step 2 — the control.** New module
`openspec/scripts/design-pattern-governance/archive-completeness.mjs`. It consumes the map produced
by `collectRelocatedChangeIds` (`perimeter.mjs:210`) and the artifact list exported by
`archive-relocation.mjs`; a separate module keeps `perimeter.mjs` (281 lines) from growing another
responsibility. Shape:

```js
// exported from the new module:
checkRelocationCompleteness({ relocated, base, cwd, sink })
```

> **Do not write that signature with a leading `export function` in this file.** `.hermes/plans/` is
> classified `documentation_only`, `checkHiddenImplementation` scans added lines in that class for
> `export function` / `export class` / `export const x = (` / `module.exports =` / `exports.x =`,
> and `collectRangePaths` folds **untracked** files into the range. Revision 2 of this plan tripped
> `hidden-implementation` for exactly that reason once the first commit existed — before any commit,
> `base === head` short-circuits the perimeter and hides it. Three earlier plan files record the same
> constraint; this is the fourth.

For each `[id, archiveDirs]` in the `relocated` map: skip unless the relocation is **introduced in
this range** (F4) — for at least one dir, no `RELOCATION_ARTIFACTS` entry resolves at `base` via
`objectAtPath`. Then, if `openspec/changes/<id>` resolves at `HEAD` via `objectAtPath` — which
returns the directory's **tree object** (F4), so no per-child probing is needed, and never
`existsSync`, because the working tree is the thing this check must not trust — call
`sink.fail("archive-relocation-incomplete", <archiveDir>, "…")`.

Write the doc comment in the register the surrounding modules use: state what the check exists to
catch and *why the obvious cheaper version is wrong* — here, that reading the filesystem would
reproduce the exact blind spot the control is closing (F1).

**Step 3 — wire it.** One call in `check-design-pattern-governance.mjs`, immediately after
`collectRelocatedChangeIds` at `:331`, passing the already-computed `relocated` map, `base`, `cwd`
and the diagnostics sink. Add the import beside the other `design-pattern-governance/` imports.

**Step 4 — prove the gate fails on the real defect, using the captured patch (rewritten, F7).**
The commit cannot be reached by cloning. Instead, in a scratch clone of the repository:

```bash
git clone /Users/fernando.costa/Git/bloodtrail /tmp/bloodtrail-proof && cd /tmp/bloodtrail-proof
git switch -c proof bfd7422^          # the parent of the repair's merge
git am /tmp/bloodtrail-evidence/057d457-incomplete-archive.patch
node openspec/scripts/check-design-pattern-governance.mjs --phase final ; echo "exit=$?"
```

It MUST fail with `archive-relocation-incomplete` and a non-zero exit. Then apply the repair shape
(stage the active-directory deletion, commit) and confirm it passes. Record both outputs verbatim.

If `git am` does not apply cleanly, **do not improvise a reconstruction** — fall back to the
fixture-based proof (test case 1), and say plainly in the report that the historical commit could
not be replayed and why. A fabricated "reconstruction" is worse than an honest gap.

**Step 5 — no `--error-on-warnings` trap.** Confirm the diagnostic is a `sink.fail`, not a
`sink.warn`: `--json` must list it under `failures`, and the process must exit non-zero. Read the
exit code directly, never through a pipe.

**Step 6 — regression run (new).** Run the whole governance suite, not just the new file, and
confirm the four existing R15 tests in `association.test.mjs:226-284` stay green (F11 traces why
they should; this is where that trace gets checked):

```bash
node --test openspec/tests/design-pattern-governance/*.test.mjs
```

**Step 7 — historical archives (new, was risk 1).** In the scratch clone, run the candidate checker
over each of the four `2026-08-19-*` archive commits and confirm none newly fails. F4 predicts they
will not; predicting is not proving.

## Task 3: Documentation

- `docs/design-pattern-governance.md` (**governance-core**, and in `actor_neutral_documents`): add
  the completeness rule to the narrative **as prose, in the document's existing voice, with no
  requirement number** — per F8 the document contains no R-numbers anywhere and nothing enforces
  their presence. Keep it actor-neutral; `checkActorNeutralDocuments` verifies the five claim
  regexes at `documentation.mjs:13-20` still match, so do not disturb the sentences carrying
  "applies identically to", "first-class", the catalog-exhaustiveness claim, or the required-CI
  claim.
- **Agent instruction files — recommend deferring to a separate change.** Revision 1 named
  `CLAUDE.md` + `.hermes.md` and **omitted `AGENTS.md`, which has identical status**: all three are
  in `governance_core_artifacts` *and* `normative_paths`. If they are edited they must appear in
  `owned_paths`, which parks three heavily-touched files under this change's coverage for its entire
  active life. The rule is worth documenting there — an archive move must stage both directions, and
  completeness is judged from the commit tree — but the gate is what enforces it, and a follow-up
  docs change costs one PR and keeps this change's blast radius at four files. Owner decision;
  see "Open decisions".

## Task 4: Landing (human-owned)

One commit per PR, proposal / implementation / archive never mixed. Rebase, never merge `main` in.
The owner merges every PR identity-preserving; the agent reports readiness and never merges. AI
review, green CI, and PR state are not approval.

1. PR 1 — proposal (Task 1).
2. PR 2 — implementation (Tasks 2–3), commit `feat(governance): reject incomplete archive relocations`.
3. PR 3 — archive, commit `docs(openspec): archive enforce-archive-relocation-completeness`, with a
   reconciled `tasks.md` and a new `archive-evidence.md` modelled on
   `openspec/changes/archive/2026-08-19-retire-local-instruction-grandfathering/archive-evidence.md`.

**PR 3 is the control's first live exercise.** It performs exactly the relocation R25 governs, so it
must pass the new check — and Stage 3 must be run on it before it is called ready.

## Task 5: The two-stage gate battery (run for every PR above)

**Stage 1 — before `git add`** (`test:git` requires an empty index):

```bash
npm run check:generated --prefix packages/security-audit-sdk-core   # before validate, which regenerates
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate --all --strict
openspec validate --all --archived --strict
git diff --check
```

**Stage 2 — after the commit.** These read `HEAD`, and before the commit they are **vacuously
green for a specific reason**: `defaultBase()` returns the merge-base, which on an unchanged branch
equals `HEAD`, and `check-design-pattern-governance.mjs:321` short-circuits with
`if (base === head) return;` before the perimeter runs. `rangeBase: null` in the JSON is the
*symptom* of that short-circuit, not its cause — Revision 1 had this backwards.

```bash
node openspec/scripts/check-design-pattern-governance.mjs --phase final ; echo "exit=$?"
node openspec/scripts/check-design-pattern-governance.mjs --phase final --json   # rangePaths must NOT be null
node openspec/scripts/run-governance-dual-check.mjs
node --test openspec/tests/design-pattern-governance/*.test.mjs
```

Never judge a checker through a `sed`/`grep` pipe — that reports the filter's exit status. Read the
exit code directly. And when reading `run-governance-dual-check.mjs` itself, use
`command grep --binary-files=text`: per F9 it contains NUL bytes and plain `grep` returns nothing.

**Stage 3 — the commit tree** (this is the check whose absence this whole change exists to fix, and
it applies to this change's own archive PR):

```bash
git show --name-status --no-renames HEAD     # a move shows A and D lines, not A alone
git ls-tree --name-only HEAD openspec/changes/
git status --porcelain                       # only intended untracked files
```

**Expected dual-check shape while this change is in flight:** candidate and baseline blobs will
**differ** from PR 2 onward — that is normal and is not a disagreement. What matters is that neither
run reports the self-approval signature (baseline rejects, candidate passes). Per F2 no acceptance
record is needed; if the dual check ever *does* report a disagreement, stop and diagnose rather than
authoring an acceptance.

## Task 6: Final state verification and report

```bash
openspec list                                   # expect: No active changes found.
openspec validate --all --strict
openspec validate --all --archived --strict
node openspec/scripts/check-design-pattern-governance.mjs --phase final ; echo "exit=$?"
node --test openspec/tests/design-pattern-governance/*.test.mjs
git status --short --branch
```

Report exact commits (P/T/M/A), gate results, the Task 2 Step 4 red/green proof (or an honest
statement that the historical commit could not be replayed), the Step 7 historical-archive sweep,
and what was **not** verified. The `--phase final` run on `main` inspects nothing (`base === head`,
`rangeBase: null`) and must not be reported as a result.

---

## Files that change

- `openspec/changes/enforce-archive-relocation-completeness/` — new, later moved to
  `openspec/changes/archive/<date>-enforce-archive-relocation-completeness/`
- `openspec/scripts/design-pattern-governance/archive-completeness.mjs` — **new** (governance-core)
- `openspec/scripts/check-design-pattern-governance.mjs` — one import, one call (governance-core)
- `openspec/tests/design-pattern-governance/archive-completeness.test.mjs` — **new**
- `openspec/specs/software-design-pattern-governance/spec.md` — gains R25 **via the sync flow only**,
  never hand-edited
- `docs/design-pattern-governance.md` — completeness narrative, no R-number (governance-core)
- **Not** `CLAUDE.md` / `.hermes.md` / `AGENTS.md` under the recommendation — see Task 3
- Nothing else. No `packages/`, no `contracts/`, no policy file, no `verification-lifecycle.json`,
  no `ci.yml` (the governance job already runs all three commands unchanged).

## Open decisions (owner)

D1 and D2 are settled — see "Decisions taken". These two remain, and neither blocks starting:

1. **Whether the agent instruction files join this change** (Task 3). `CLAUDE.md`, `.hermes.md`, and
   `AGENTS.md` are all governance-core *and* normative, so editing any of them puts it in
   `owned_paths` for the change's whole active life. Recommend no: a follow-up docs change costs one
   PR and keeps three hot files out of this change's coverage. If yes, all three go in together.
2. **Vocabulary.** The plan mixes **relocation** (the codebase's term, per `archive-relocation.mjs`
   and `collectRelocatedChangeIds`), **completeness** (proposed module name), and **archive move**
   (Stage 3 prose). "Archive" is itself overloaded — the directory, the act, and the
   `openspec-archive-change` skill. Recommend standardising on *relocation* for the act and
   *completeness* for the property being checked, which is what the diagnostic id
   `archive-relocation-incomplete` already implies; `archive-completeness.mjs` then reads as "the
   completeness of archive relocations". This repository has no `CONTEXT.md`, so nothing is being
   contradicted — but nothing is anchoring the vocabulary either, and this is the third change in a
   row to touch it.

## Residual risks

1. **This closes one hole, not the class.** Nothing here verifies that an archive move is
   *byte-identical*, that `tasks.md` reconciliation is honest, or that `archive-evidence.md` claims
   match the commit. Those remain human obligations under R24. Do not let a green R25 be read as
   proof of a well-formed archive.
2. **An already-landed incomplete relocation stays invisible — accepted under D1.** Range-scoping
   means the control asks what *this range* introduced, so a broken move that reached `main` before
   the control existed, or that somehow slips past it, is never re-examined by any later PR. Nothing
   in the repository is in that state today: `git ls-tree HEAD openspec/changes/` lists only
   `archive`, and all 16 archived ids are distinct with no active counterpart. If that ever changes,
   the fix is a one-off sweep, not a redesign — or the state-scoped `sink.warn` recorded in the
   rejected alternatives.
3. **The working-tree fold stays.** `collectRangePaths` folds working-tree and untracked paths in
   *every* phase including `final`, so a local run and a CI run can disagree in both directions —
   the mechanism that made `057d457` invisible locally. Deliberately **out of scope**, and the
   proposal should say so, with the reason it is not the root cause: removing the fold would **not**
   have caught `057d457`, because CI ran with no working tree at all and passed anyway. Narrowing
   `final` to judge `HEAD` only is a separate governance-core change with its own blast radius, and
   bundling it would make this change's TDD proof ambiguous.
4. **`existsSync` is the tempting wrong answer.** Reading the working tree to decide whether the
   active directory is gone reproduces the exact blind spot being closed. The check must resolve
   paths at `HEAD` through git.
5. **The motivating commit is perishable** (F7). Once the Task 0 patch capture exists this is
   contained, but until then a single auto-gc can remove the only evidence of the defect from every
   machine on earth. Do Task 0 Step 0 first.
6. **`main` may move.** Every line anchor here was read at `232376b`. Re-verify F1, F4, and the
   `:321`/`:331` anchors against the sources if execution starts from a later base.
7. **This plan is a draft** subject to the owner's corrections; execution follows the corrected form
   only. No production or publication authorization is granted or implied by any of it.
