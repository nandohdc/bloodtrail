# Issue #70 — Verify Packed Artifact Completeness in the Package Gate — Triage and Implementation Plan

> **For Hermes:** Triage first, implement second. #70's body was written against
> `main@71dbd95` and its "Current state" is obsolete — #68 made the validator self-contained, so the
> `MODULE_NOT_FOUND` defect it describes no longer exists. **Do not implement the issue text
> verbatim.** Task 0 re-verifies the residual gap with a controlled mutation and Task 1 marks the
> body superseded, posts a durable updated agent brief, and promotes the issue; only then does the
> change get proposed. The normative term is **completeness**, never *closure* — that word is
> already bound to lifecycle closure in the same spec file (F18). Execute with the
> `openspec-propose` / `openspec-apply-change` / `openspec-verify-change` / `openspec-sync-specs` /
> `openspec-archive-change` skills. TDD is load-bearing here in a stronger sense than usual: the
> whole point of this issue is that a control with no failing twin is a control nobody has proved.
> Verify read-only with an empty index before every commit. Do NOT merge — the owner merges.

**Goal:** Make `npm run test:package` prove the packed tarball actually installs and runs in a
production-only consumer, and give that proof a deterministic failing twin for each failure class it
claims to catch — inventory completeness, artifact completeness, and resolution provenance.

**Architecture:** One new pure module,
`packages/security-audit-sdk-core/scripts/packed-completeness.mjs`, performs the completeness
procedure: pack once with `npm pack --json` to a destination outside the package root, install that
exact tarball into a disposable consumer with `--omit=dev --offline`, import every declared
export-map entry point by package specifier, assert each resolves from the consumer's own
`node_modules`, validate one canonical event, and discard both temporary directories. It returns the
same `files` inventory the current dry run returns, so `check-package-contents.mjs` keeps its
allowlist and gains the completeness proof **without a second pack**. A new verification file carries
the mutation arms plus a null control. One ADDED requirement lands in the `security-audit-sdk-core`
capability, one term lands in a new package `CONTEXT.md`, and one system-wide ADR records why a gate
now executes an install.

**Tech Stack:** ESM `.mjs` under `packages/security-audit-sdk-core/scripts/` and
`tests/verification/`, `npm pack --json`, `npm install --omit=dev --offline`, `node --test`, openspec
CLI 1.9.0 (verified on PATH), git + gh, Node pinned `>=24 <25 || >=26 <27`, npm via `--prefix` only
(there is no root `package.json`).

**Known pins (re-verified read-only on 2026-08-20; every anchor below was read or measured, not assumed):**

| Role | Value |
| --- | --- |
| Landing baseline (`HEAD` == `main` == `origin/main`, clean) | `cc41eff686d52c645e5d88203bdc75b4badd288f` |
| Issue | #70, OPEN, labels `enhancement` `security-audit-sdk` `verification` `area:core` `needs-triage` |
| Dependencies | #68 CLOSED 2026-08-18, #69 CLOSED 2026-08-20; `issue_dependencies_summary.blocked_by` is `0` |
| Active OpenSpec changes | none — `openspec/changes/` contains only `archive/` |
| Open PRs | only #182 (`chore: release v0.4.0`, release-please) |
| Package gate today | `packages/security-audit-sdk-core/scripts/check-package-contents.mjs`, 3060 bytes, `npm pack --dry-run` only |
| Positive completeness control today | `packages/security-audit-sdk-core/tests/verification/packed-consumer-closure.test.mjs:32` |
| Canonical requirement today | `openspec/specs/security-audit-sdk-core/spec.md:838`, three scenarios, all positive |
| Canonical spec size | 48 `### Requirement:` headers, 0 delta operation headers |
| Live packed inventory | 80 intentional files, 846566 bytes |
| Live dependency gate | 38 shipped artifacts, 106 module specifiers, 9 locked dev packages |
| Lifecycle mode | `archived` (`test:changed-paths` reports it today, 300 visible records) |
| Required PR checks | `ci / lint`, `ci / test`, `ci / audit`, `sonar`, `sdk`, `contract`, `conventional-commits`, `codescene delta`, `design-pattern-governance` |
| Landing-shape precedent | PRs #190 / #192 / #193 (`c98132c8`, `3284aba5`, `36284616`), then docs PR #194 (`cc41eff6`) |
| Node / npm / openspec on this workstation | v26.7.0 / 11.19.0 / 1.9.0 |

---

## Proven findings

F1–F4 are measured: three probes were run in package **copies** under the scratchpad, never in the
live tree. F5 onward are read from source at `cc41eff`.

### F1 — #70's "Current state" is obsolete, and the AJV defect is gone

#70 says packed `dist/generated/schema-validator.generated.cjs` requires AJV modules and that a
production-only install fails with `MODULE_NOT_FOUND: Cannot find module 'ajv/dist/runtime/ucs2length'`.
That was true at `main@71dbd95`. It is not true now. #68 (`openspec/changes/archive/2026-08-18-bundle-validator-runtime-helpers/`)
bundled the AJV `ucs2length` helper and the two ajv-formats validators into the generated artifact
under ADR-SDK-011, and `packed-consumer-closure.test.mjs` already asserts the installed artifact
contains no `require(`.

**Consequence:** the first acceptance criterion — "The approved tarball passes the production-only
smoke test" — is **already satisfied** by today's tree. Say that plainly in the proposal, the PR
body, the brief, and the closing comment. This change is a **negative-evidence and gate-placement**
change, not a repair.

### F2 — Measured: `test:package` passes a tarball that cannot be imported

Probe M-70-A. In a package copy, `package.json`'s `files` was narrowed so that `dist/validation/`
was excluded while every one of the 16 paths `check-package-contents.mjs` requires stayed present.

| Observation | Result |
| --- | --- |
| `node scripts/check-package-contents.mjs` on the mutated copy | **exit 0** — "allowlist passed: 40 intentional files, 709537 bytes" |
| `npm pack` on the mutated copy | succeeds, `entryCount` 40 |
| `npm install <tgz> --omit=dev --offline` | succeeds, "added 1 package" |
| installed `dist/validation` present | **false** |
| `import "@bloodtrail/security-audit-sdk-core"` | **exit 1**, `ERR_MODULE_NOT_FOUND` on `.../dist/validation/index.js` |

The gate is blind because its required-file list is a fixed 16-entry allowlist and its permit rule is
a prefix test (`path.startsWith("dist/")`). Neither is a completeness check. `dist/sdk.js`,
`dist/validation/index.js`, `dist/events.js` and 60-odd other packed modules are loaded by the
entry points but named by nothing.

### F3 — Measured: the #69 dependency gate is blind to both mutations, and one probe reading was a harness artifact

Probe M-70-B applied the "missing-helper" mutation #70 literally asks for: in a package copy, the
bundled helper binding in the shipped validator was pointed at an undefined identifier. Inventory
unchanged, no module specifier added.

| Observation | Result |
| --- | --- |
| `check-package-contents.mjs` | **exit 0** — 80 files, 846576 bytes |
| #69 shipped-import stage, called directly | `inspected=38 specifiers=106 violations=0` — **blind** |
| production-only import | **exit 1**, `ReferenceError: missingBundledHelper is not defined` |

**Read this carefully.** In the M-70-A probe, `node scripts/check-dependencies.mjs` exited 1 in the
copy. That was **not** detection. A null control — the same copy harness with no mutation at all —
exits 1 as well, because `check-dependencies.mjs:60` runs `npm ls --omit=dev --all --json` and the
symlinked `node_modules` reports `missing: pre-commit@^1.2.2, required by json-schema-traverse@1.0.0`.
On the live tree the same script exits 0. So:

- the #69 gate is genuinely blind to both mutation classes, and
- **in this harness, exit status alone is worthless for `check-dependencies.mjs`.** Assert on the
  diagnostic text. `shipped-import-policy.test.mjs:235` already does; anything new must too.

### F4 — Measured: the existing completeness control does fail on both mutations, and it is cheap

Three arms of `node --test tests/verification/packed-consumer-closure.test.mjs`, each run from its own
package copy with `contracts/` copied alongside:

| Arm | Exit | First failure signal |
| --- | --- | --- |
| null control, unmutated | **0** | none |
| M-70-A, `dist/validation` excluded from `files` | **1** | `ERR_MODULE_NOT_FOUND` |
| M-70-B, bundled helper removed | **1** | `ReferenceError: missingBundledHelper is not defined` |

Two things follow, and they pull in opposite directions:

1. The control **works**. Do not describe this change as fixing a broken control. It is effective and
   unproven — PLAN-074's failing twin is what is missing, not the positive fixture.
2. The cost objection is dead. Measured wall clock on this workstation: `test:package` 0.62s,
   `packed-consumer-closure.test.mjs` 1.06s, all three copy-and-mutate arms together 3.52s. The
   "roughly 10–30 seconds" figure in #68's proposal does not match what the tree does today.

### F5 — Measured: a real `npm pack --json` returns the same inventory as the dry run

The non-dry `npm pack --json --pack-destination <dir>` output carries the identical `files` array of
`{path, size, mode}` plus `entryCount`, verified against the dry-run output on the same tree. One
real pack can therefore serve both the allowlist and the install, so this change **adds no second
pack** to `validate`.

### F6 — The gap is three specific things, and no more

Stated precisely, so the change does not drift wider:

1. **No failing twin.** `packed-consumer-closure.test.mjs` has no mutation counterpart anywhere in
   `tests/verification/`. PLAN-074 is unmet for this control.
2. **Wrong gate.** #70 says "Run `npm run test:package` with positive and negative tarball fixtures".
   The positive completeness proof runs under `test:verification`; `test:package` is an inventory
   allowlist that never installs anything.
3. **No resolution provenance.** `packed-consumer-closure.test.mjs` imports by package specifier from
   a `mkdtemp` consumer, which makes workspace hoisting improbable — but nothing *asserts* where the
   module came from. PLAN-091 asks for exactly that assertion.

Everything else #70 asks for is already true: the approved tarball passes, the consumer is
disposable, both temp directories are removed in a `finally`.

### F7 — `.out-of-scope/` does not exist; no prior rejection applies

Checked directly: there is no `.out-of-scope/` directory in the repository, so no recorded rejection
covers this request. Say so in the brief rather than leaving it unstated.

### F8 — The canonical requirement exists and is entirely positive

`openspec/specs/security-audit-sdk-core/spec.md:838`, "Packed package installs and validates with
production-only dependencies", has three scenarios: production-only install imports both public
exports, schema validation works from the consumer install, generated validator is self-contained.
All three describe the **package**. None describes the **verification control**, and none is
negative. That is the seam: this change adds a requirement about the control, and leaves the
requirement about the package alone.

**Use `## ADDED Requirements`, not `## MODIFIED`.** All 10 delta blocks in the archive are ADDED;
MODIFIED has zero precedent here, and a MODIFIED block must restate the whole requirement including
every surviving scenario or `openspec archive` rejects it.

### F9 — Governance shape: full assessment, no signed record, three PRs

- `packages/` and `openspec/specs/` are `governed_implementation` and normative respectively, so every
  file this change touches under them needs an **exact path** entry in `owned_paths` — not a
  directory prefix, and covering all three PRs, because an active change's `owned_paths` governs
  future PRs too.
- Adding a capability requirement matches `canonical_capability_requirement`; a supply-chain
  admission control matches `security_sensitive_behavior`. Both are in `full_assessment_triggers`, so
  the assessment is **full**, `material_capability_modification: true`, `security_sensitive: true`.
  `true` means **no** `security_justification` map is required — the 15-dimension justification
  requirement fires on `false`.
- **No signed governance record**, following `reject-undeclared-shipped-imports` and
  `enforce-archive-relocation-completeness`, which both landed a capability requirement under a full
  assessment with no `governanceRecords` entry. `verification-lifecycle.json` is therefore not
  edited, keeping a `governance_record_only` path out of every commit.
- The change **has** a spec delta, so `skip_specs` stays absent.
- Landing is the #190/#192/#193 shape: PR 1 propose + implement, PR 2 fold the delta into the
  canonical spec **while the change is still active**, PR 3 archive as a complete relocation. An
  active change owns `openspec/specs/<capability>/` through `applicability.capabilities`; a relocated
  one does not, so the fold cannot ride in the archive PR and cannot follow it.

### F10 — Nothing in governance-core is touched, provided no npm script is added

`test:package` is already wired into `validate` and is **absent** from CLAUDE.md's "Targeted gates"
table, so extending it needs no CLAUDE.md edit. `CONTRIBUTING.md:113` names `test:package` only as
one of the gates that mechanically establish the unpublished/undeployed state — extending it to also
prove completeness does not contradict that sentence, so CONTRIBUTING.md stays shut. Adding a *new* npm
script would drag the gate table, and therefore `governance_core`, into the change. Do not add one.

`CONTRIBUTING.md`'s own rule is the strongest argument for this change: "If a change depends on a
repository-state claim that no gate checks, **add the gate**."

### F11 — Do not add `test:package` to `test:matrix`

CLAUDE.md describes `test:matrix` as the "Matrix-safe subset (no git/package/coherence gates)".
Adding `test:package` to it would contradict that sentence and require a `governance_core` edit for
no gain — CI's `sdk` job runs full `validate` on Node 26, and the matrix run exists to prove the
runtime surface across majors, not the packaging surface.

### F12 — No SDK ADR is possible, but a root ADR is free

`check-coherence.mjs:189` resolves `adrRoot` as `resolve(packageRoot, "adr")` and `:190` pins
`adrFiles.length === 11`, `:191` the exact 001..011 sequence. A twelfth **SDK** ADR would fail
`test:coherence`, and the packaging decision it would restate already exists as ADR-SDK-011.

The **root** `docs/adr/` directory is a different thing entirely: coherence never reads it, and
`docs/` is `documentation_only`, so a system-wide ADR needs no OpenSpec association and moves no
pinned constant. `docs/adr/0001-fold-canonical-spec-while-change-is-active.md` and
`0002-verify-governance-post-commit.md` live there, and this plan depends on both. That is where
D13's inspect-versus-execute decision belongs (D15).

### F13 — Coherence pins nothing this change moves

`tests-present` asserts only that the test inventory is non-empty; there is no file-list pin, no
verification-test count, and no script-count rule. Adding one script and one test file moves no
coherence constant.

### F14 — The lifecycle gate permits everything this change writes

`test:changed-paths` reports `archived` mode today, which is what makes the PR 2 fold legal. The
untracked-new-file rule is bounded to `ownership.sdkSourcePrefixes` — exactly
`packages/security-audit-sdk-core/src/` and `.../lib/` — so new files under `scripts/` and
`tests/verification/` classify as `sdk-package` and need no `reviewedNewSdkSourcePaths` entry.

### F15 — Analyser exposure

`sonar-project.properties:14` puts `packages/security-audit-sdk-core/scripts` in `sonar.sources`;
`:18` puts `packages/security-audit-sdk-core/tests` in `sonar.tests`. `sonar.coverage.exclusions`
covers `**/scripts/**`, so the new module carries no coverage duty — but the test file is excluded
from coverage duty only, not from analysis. The quality gate fails on any new violation. Keep
functions small, avoid nested ternaries and long parameter lists, prefer early returns.

The new control goes in **its own file**. `mutations.test.mjs` is 59 KB and a known analyser hotspot;
file-level rules would fail `codescene delta` regardless of the quality of the new code. The
`readonly`-parameter blind spot in CodeScene CLI 1.0.37 does not apply to `.mjs`, so both analysers
should see this code — treat them as complementary.

### F16 — Writing about this change can trip the governance perimeter

`checkHiddenImplementation` runs on `documentation_only` paths, which includes `.hermes/plans/`,
`docs/`, and `README.md`. Its signals are `/^\+\s*export\s+(async\s+)?function\s+/m`,
`export class`, `export const NAME = (`, `module.exports =`, and `exports.NAME =`. Note the `\s*`:
**indenting the snippet does not help** — an earlier plan file recorded that workaround and it is
wrong. The only safe options are to reference the symbol by `file:line` or to write the signature
without the `export` keyword. This plan file does the latter.

### F17 — A root `CONTEXT-MAP.md` would fail the perimeter closed; a package `CONTEXT.md` would not

The `path_classes` patterns are exhaustive and unmatched paths **fail closed**:
`checkUnclassifiedPaths` (`openspec/scripts/design-pattern-governance/perimeter.mjs:274-281`) raises
`path-unclassified` with "an unclassified path fails closed rather than passing".

- `CONTEXT-MAP.md` at the repository root matches no pattern. Creating it in this change would break
  `design-pattern-governance` — the identical failure mode PR #182 is sitting in right now with
  `version.txt` and `.release-please-manifest.json` (F19).
- `packages/security-audit-sdk-core/CONTEXT.md` matches `packages/`, so it is
  `governed_implementation`: legal, but it needs an exact `owned_paths` entry like any other
  governed file.

`docs/agents/domain.md` says these files are created lazily by domain-modeling work and that their
absence must not be flagged. This change resolves one term (F18), so it writes the package
`CONTEXT.md` and **not** the root map.

### F18 — "Closure" is already taken, and the repository has better words

`openspec/specs/security-audit-sdk-core/spec.md:754` uses "closure" normatively for **lifecycle**
closure — "AI review, issue closure, checked tasks, or passing tests SHALL NOT constitute owner
approval" — and issue #132 is "Track the adversarial architecture roadmap to lifecycle closure".
Putting "runtime closure" into the same spec file would introduce a second, unrelated sense of a term
that file already binds.

The repository already has precise words for both halves of what this gate proves:

- **self-contained** — needs nothing external. ADR-SDK-011 and the existing scenario "Generated
  validator is self-contained" own this sense. Already proved; not this change's subject.
- **complete** — no part is missing. `enforce-archive-relocation-completeness` established the term
  for exactly this shape of claim.

The property this change adds is the second one: no module the entry points load is absent from the
tarball. So the normative vocabulary is **packed-artifact completeness**, and its failure classes are
an **incomplete inventory** and an **incomplete artifact**. `packed-consumer-closure.test.mjs` keeps
its filename — renaming a file to chase vocabulary is churn — but it is legacy naming, and nothing
new adopts it.

### F19 — PR #182 cannot merge, and its failure is instructive

`gh pr view 182` reports `conventional-commits` **FAILURE** and `design-pattern-governance`
**FAILURE**, both required. Its three files are `version.txt`, `CHANGELOG.md`, and
`.release-please-manifest.json`; only `CHANGELOG.md` matches a `path_classes` pattern, so the other
two are almost certainly raising `path-unclassified` (F17). This is not a baseline-protection
question — the PR is simply blocked, its fix is a `governance_core` policy edit, and #70 must not be
coupled to it.

---

## Decisions taken (settle these; do not re-litigate during execution)

| # | Decision | Why |
| --- | --- | --- |
| D1 | Triage and post a corrected brief **before** proposing | #70's stated current state is false (F1); an agent implementing it verbatim would go looking for a `MODULE_NOT_FOUND` that no longer exists |
| D2 | Extend `test:package`; add no new npm script | #70 names that command; a new script drags CLAUDE.md's gate table into `governance_core` (F10) |
| D3 | One real `npm pack --json`, not a dry run plus a pack | The real pack returns the identical inventory (F5), so the allowlist and the install share one artifact and `validate` gains no second pack |
| D4 | Extract the completeness procedure into `scripts/packed-completeness.mjs`; both callers use it | One implementation, two callers: the gate proves completeness, the verification test keeps its deeper behavioural assertions via an `onInstalled` hook. Duplicating the procedure would let the two drift |
| D5 | Assert resolution provenance explicitly | PLAN-091. `mkdtemp` isolation makes hoisting improbable but proves nothing; the assertion is one line and the mutation arm makes it real. Carve-out authorised by D11 |
| D6 | Three mutation arms plus a null control, in a new file | Inventory completeness (M-70-A), artifact completeness (M-70-B), provenance (M-70-C). Measured cost 3.52s for three arms (F4); the null control is what distinguishes detection from harness noise (F3) |
| D7 | One ADDED requirement about the **control**, leaving the existing requirement about the **package** untouched | F8; MODIFIED has no precedent here and must restate every surviving scenario |
| D8 | Do not add `test:package` to `test:matrix` | F11 |
| D9 | Three PRs, no signed record, no owner exact-commit approval | F9; mirrors #190/#192/#193 |
| D10 | Do not resolve relative specifiers in the dependency gate | That was #69's recorded assurance limitation and this change discharges it by execution instead — which is the correct place for it |
| D11 | **Provenance is pre-authorised to be carved out.** If M-70-C cannot be made deterministic in Task 5, drop the provenance assertion and the arm from this change and refile them as a new issue | Splitting the three-part gap into three issues costs three full assessments and nine PRs for one control — disproportionate. But part 3 is the least proven, and the one failure this issue exists to prevent is a control softened until it always passes. Carving it out is allowed; weakening it is not |
| D12 | Normative vocabulary is **completeness**, never **closure** | F18. `closure` is already bound to lifecycle closure in the same spec file. The issue *title* says "runtime closure" and the spec term will not match it — acceptable, titles are not normative |
| D13 | A gate script may execute an install | `validate` has no other step that installs, so this does change `check-package-contents.mjs` from inspection to execution. But the inspect/execute line is not one this repo actually holds: `test:dependencies` already shells out to `npm ls --omit=dev --all`, and `test:verification` already packs and installs. The issue names `test:package` deliberately, and the measured cost is ~1s |
| D14 | Write `packages/security-audit-sdk-core/CONTEXT.md`; do **not** create a root `CONTEXT-MAP.md` | F17. The map is unclassified and would fail the perimeter closed, exactly as PR #182 is failing now. The package context file is `governed_implementation` and legal with an `owned_paths` entry |
| D15 | Record D13 as root `docs/adr/0003`, not as an SDK ADR | F12. The SDK ADR sequence is pinned at 11 by coherence; `docs/adr/` is unpinned, `documentation_only`, and already holds the two decisions this plan depends on. "Why does the package gate install things?" is precisely the question a future reader will ask |

---

## Files to change

**PR 1 (propose commit P, then implementation commit T)**

- Create `openspec/changes/verify-packed-artifact-completeness/{.openspec.yaml, proposal.md, design.md, tasks.md, assessment.json, specs/security-audit-sdk-core/spec.md}`
- Create `packages/security-audit-sdk-core/scripts/packed-completeness.mjs`
- Modify `packages/security-audit-sdk-core/scripts/check-package-contents.mjs`
- Create `packages/security-audit-sdk-core/tests/verification/packed-completeness-mutations.test.mjs`
- Modify `packages/security-audit-sdk-core/tests/verification/packed-consumer-closure.test.mjs` (call the shared module, add the provenance assertion, keep every existing assertion)
- Create `packages/security-audit-sdk-core/CONTEXT.md` (the completeness/self-contained terms, D12/D14)
- Create `docs/adr/0003-package-gate-executes-a-production-install.md` (D13/D15)
- Modify `README.md:145` — `verify` no longer only "inspects `npm pack --dry-run`"
- Add this plan file

**PR 2 (spec fold)**

- Modify `openspec/specs/security-audit-sdk-core/spec.md` (append the ADDED requirement)
- Modify `openspec/changes/verify-packed-artifact-completeness/tasks.md` (tick the fold task)

**PR 3 (archive, pure relocation)**

- `git mv openspec/changes/verify-packed-artifact-completeness/` to `openspec/changes/archive/<YYYY-MM-DD>-verify-packed-artifact-completeness/`
- Add `archive-evidence.md` in the archive directory

**Explicitly untouched:** `package.json` (no new script, `files` unchanged, dependencies stay `{}`),
`package-lock.json`, `compatibility.json`, `verification-lifecycle.json` (F9),
`packages/security-audit-sdk-core/adr/` (F12), `check-dependencies.mjs` and
`shipped-import-policy.mjs` (#69's territory), `check-scope.mjs` (#71's territory), CLAUDE.md /
`.hermes.md` / `CONTRIBUTING.md` / `.github/workflows/` / `openspec/scripts/` (all
`governance_core`, F10), and every path matching no `path_classes` pattern, which fails closed
(F17): `sonar-project.properties`, `version.txt`, and a root `CONTEXT-MAP.md`.

---

## Task 0: Preflight and re-verify the residual gap

**Files:** none. Nothing is written inside the repository in this task.

```sh
cd /Users/fernando.costa/Git/bloodtrail
git fetch --prune origin
git status --porcelain=v1 --untracked-files=all
git rev-parse HEAD main origin/main
gh issue view 70 --repo nandohdc/bloodtrail --json state,labels,url
gh api repos/nandohdc/bloodtrail/issues/70 --jq '.issue_dependencies_summary'
openspec list
```

Expected: clean tree, the three revisions equal at `cc41eff6…` (re-check — `main` moves), #70 OPEN
with `needs-triage`, `blocked_by: 0`, and "No active changes found."

Then reproduce F2/F3/F4 in a package **copy**. This is not ceremony: the whole change rests on the
claim that a broken tarball passes today, and that claim must be re-established against whatever
`main` is when the work actually starts. The probes used to write this plan live in the session
scratchpad and are disposable; re-derive them from this recipe rather than hunting for the files.

Recipe, per arm:

1. `mkdtemp` a suite root; copy `packages/security-audit-sdk-core` into `<suite>/packages/security-audit-sdk-core`,
   filtering out `node_modules`, `dist-tests`, `dist-examples`, `coverage`, `.verification-output`;
   copy `contracts/` into `<suite>/contracts` so `repositoryRoot` resolves.
2. Apply the mutation to the copy — never to the working tree.
3. Run the control from the copy and record exit status **and** the first failure signal.
4. Remove the suite root.

Arms, and what each must show before implementation starts:

| Arm | Mutation | `check-package-contents.mjs` | completeness control |
| --- | --- | --- | --- |
| null | none | exit 0 | exit 0 |
| M-70-A | narrow `files` so `dist/validation/` is not packed, keeping all 16 required paths | **exit 0** | exit 1, `ERR_MODULE_NOT_FOUND` |
| M-70-B | point the bundled helper binding in the packed validator at an undefined identifier | **exit 0** | exit 1, `ReferenceError` |

If `check-package-contents.mjs` fails on either mutated arm, the gap has already been closed by
someone else — stop and re-triage rather than proposing a change with no subject.

Do not skip the null control. In the M-70-A probe `check-dependencies.mjs` exited 1 in the copy and
it was the symlinked `node_modules`, not detection (F3). A differential without a null arm cannot
tell those apart.

## Task 1: Correct the issue body, post the brief, promote the issue

**Files:** none in the repository.

Three writes to #70, in this order. The brief is the durable artifact — it is what a later agent
reads — but a comment alone is not enough here, because the body's "Current state" section is
**factually false** and the body is what GitHub renders first and what any summarising tool ingests.
#69's precedent left its false claim standing as the primary text; do not repeat that.

**1. Prepend a superseded marker to the body.** Do not rewrite or delete the original text: the body
is also the traceability record of what was requested against `main@71dbd95`, and PLAN-037/038/074/091
are cited from it. Fetch the body, prepend the block below, write it back.

```sh
gh issue view 70 --repo nandohdc/bloodtrail --json body -q .body > /tmp/70-body.md
# prepend the marker, then:
gh issue edit 70 --repo nandohdc/bloodtrail --body-file /tmp/70-body.md
```

The marker, verbatim:

```markdown
> **SUPERSEDED IN PART — 2026-08-20.** The "Current state" section below was written against
> `main@71dbd95` and is no longer accurate: #68 made the generated validator self-contained, so the
> `MODULE_NOT_FOUND` failure it describes no longer occurs, and the positive production-only consumer
> test it asks for already exists. The original text is preserved unchanged for traceability. Read
> the triage brief in the comments for the current state, the residual gap, and the acceptance
> criteria this issue is actually being worked against.

---
```

**2. Post the brief** below as a comment, matching the structure of #69's brief
(`https://github.com/nandohdc/bloodtrail/issues/69#issuecomment-5356452683`), including the leading
AI-generation disclosure.

```sh
gh issue comment 70 --repo nandohdc/bloodtrail --body-file <brief.md>
```

**3. Flip the state label.** The five canonical roles are mutually exclusive, so remove the old one
in the same call.

```sh
gh issue edit 70 --repo nandohdc/bloodtrail --remove-label needs-triage --add-label ready-for-agent
gh issue view 70 --repo nandohdc/bloodtrail --json labels -q '[.labels[].name] | join(", ")'
```

### Brief to post

```markdown
> *This was generated by AI during triage.*

## Agent Brief

**Category:** enhancement
**Summary:** Make the package gate prove that the packed tarball installs and runs in a production-only consumer, and give that proof a deterministic failing mutation for each failure class it claims to catch.

**Current behavior:**
This issue's "Current state" section is obsolete. It was written against `main@71dbd95` and says a production-only install fails with `MODULE_NOT_FOUND: Cannot find module 'ajv/dist/runtime/ucs2length'`. #68 bundled the AJV runtime helper and the ajv-formats validators into the generated validator under ADR-SDK-011, and the installed artifact is asserted to contain no `require(`. The defect described no longer exists.

The positive smoke test this issue asks for also already exists, at `packages/security-audit-sdk-core/tests/verification/packed-consumer-closure.test.mjs:32`. It packs to a destination outside the package root, installs into a fresh temporary consumer with `--omit=dev --offline`, imports both public entry points by package specifier, runs positive, structural-negative, and semantic-negative validation including a `uri`-format field, checks the installed artifact is self-contained, and removes both temporary directories in a `finally`.

The residual gap is narrower than the issue body, and it is three specific things:

1. **No failing twin.** Nothing in `tests/verification/` mutates the tarball, so nothing proves the completeness control can still fail. PLAN-074 is unmet for this control.
2. **Wrong gate.** The issue says to run `npm run test:package` with positive and negative tarball fixtures. The completeness proof runs under `test:verification`; `test:package` (`scripts/check-package-contents.mjs`) is an `npm pack --dry-run` inventory allowlist that never installs anything.
3. **No resolution provenance.** The consumer is a `mkdtemp` directory, which makes hoisting improbable, but nothing asserts where the imported module actually resolved from. PLAN-091 asks for that assertion.

Measured in package copies, never in the working tree: a tarball with `dist/validation/` excluded from `files` — every path `check-package-contents.mjs` requires still present — passes `test:package` at exit 0, installs cleanly, and then fails at import with `ERR_MODULE_NOT_FOUND`. A tarball whose bundled `ucs2length` helper binding is undefined also passes `test:package` at exit 0, passes the #69 shipped-import stage with `violations=0`, and fails at import with a `ReferenceError`. The existing completeness control catches both; a null control on an unmutated copy passes. The gate is blind because its required-file list is a fixed 16-entry allowlist and its permit rule is a `dist/` prefix test — neither is a completeness check.

No `.out-of-scope/` directory exists in this repository, so no recorded rejection covers this request.

**Desired behavior:**
`npm run test:package` should pack once, keep its existing inventory allowlist over that same pack output, then install that exact tarball into a disposable consumer with production-only dependency installation, import every entry point declared in the package export map by package specifier, establish that each resolved from the disposable consumer's own installed dependency tree, validate one canonical event, and remove the tarball and the consumer whether it passed or failed.

The procedure should live in one module that both `check-package-contents.mjs` and the existing verification test call, so a single implementation serves the gate and the deeper behavioural assertions.

Each failure class must have a deterministic failing mutation applied to a package copy: a packed inventory that omits a module the entry points load, a packed artifact referencing an identifier it does not define, and an entry point that resolves from outside the disposable consumer. A null control on an unmutated copy must pass in the same harness. Diagnostics must name the entry point and the unresolved module or identifier, stay bounded in count and length, and carry no artifact source content.

**Key interfaces:**

- `test:package` / `scripts/check-package-contents.mjs`: extend the existing command; do not add a new npm script.
- `npm pack --json` with a destination outside the package root: it returns the same `files` inventory as `--dry-run`, so one pack serves both the allowlist and the install.
- The package export map: it is the authority for which entry points must be imported.
- `tests/verification/packed-consumer-closure.test.mjs`: keep its behavioural assertions; route them through the shared module rather than a second pack.
- The package-copy mutation harness used by `f10-mutations.test.mjs` and `shipped-import-policy.test.mjs`, not the disposable git clone — this control reads a packed artifact, not git history.

**Vocabulary:**
Use **complete** / **completeness** for "no module the declared entry points load is absent from the tarball", and **self-contained** for "references no module outside itself" (ADR-SDK-011, already proved). Do **not** use *closure* in specification text: `openspec/specs/security-audit-sdk-core/spec.md:754` already binds that word to lifecycle closure, and #132 uses it the same way. This issue's title says "runtime closure" and the existing test file is named `packed-consumer-closure.test.mjs`; both are retained as-is, and neither is normative. The terms are recorded in `packages/security-audit-sdk-core/CONTEXT.md`.

**Acceptance criteria:**

- [ ] `npm run test:package` packs once, applies the existing inventory allowlist, installs production-only, imports every declared entry point by specifier, and validates a canonical event.
- [ ] A packed inventory missing a loaded module fails deterministically and names the unresolved module.
- [ ] A packed artifact missing a bundled runtime helper fails deterministically and names the failing entry point.
- [ ] Each imported entry point is asserted to resolve from the disposable consumer's own dependency tree, and an entry point resolving outside it fails deterministically. *Conditional:* if this cannot be made deterministic across npm versions and platforms, it is dropped from this issue and refiled against PLAN-091 rather than relaxed into an assertion that always passes.
- [ ] A null control on an unmutated package copy passes in the same harness.
- [ ] The tarball and the consumer are created outside the package root and removed on both the passing and the failing path.
- [ ] Diagnostics are bounded in count and length and expose no artifact source content.
- [ ] `validate` gains no second `npm pack`.
- [ ] The full SDK and contract validation chains, strict active and archived OpenSpec validation, and governance checks pass on the exact candidate.

**Assurance limitation:**
This gate proves that the packed artifact loads and validates through its declared entry points. It does not prove the absence of unexercised broken paths inside the package, and it makes no claim about dependency safety, publication readiness, or production suitability.

**Out of scope:**

- Publication, registry upload, package-manager migration, multi-package topology, or any network service.
- Reopening the validator packaging decision or the already self-contained validator (#67, #68).
- The shipped-import dependency policy (#69, closed) and the scope-gate work tracked by #71.
- Adding a new npm command, adding `test:package` to `test:matrix`, adding a runtime dependency, changing the public API, adding an ADR, or any production transport, exporter, collector, storage, SIEM integration, analytics, detection, browser telemetry, publication path, or production authorization.
```

## Task 2: Branch

```sh
git switch -c feat/verify-packed-artifact-completeness
git rev-parse origin/main   # BASELINE_SHA for assessment ordering
```

Never `git checkout -b <name> origin/main` — that sets the upstream to `main`, so a later bare
`git push` bypasses the PR entirely. `git switch -c` is correct.

## Task 3: Propose the change (commit P)

**Files:** `openspec/changes/verify-packed-artifact-completeness/*`

Drive this with the `openspec-propose` skill; it runs `openspec new change "verify-packed-artifact-completeness"`.
Do not hand-create the directory. This change has a specs delta, so `skip_specs` stays absent.

`proposal.md` — Why: F1 (the defect is repaired and the positive control already exists), F6 (the
three-part residual gap), F2/F3 (measured: a broken tarball passes `test:package` and the #69 gate).
What Changes: one real pack serving both the allowlist and a production-only install, entry-point
import and resolution-provenance assertions inside `test:package`, a shared completeness module, three
mutation arms plus a null control, one new capability requirement. Non-Goals: no publication, no
package-manager migration, no multi-package topology, no repair of the validator, nothing from #69 or
#71, no new npm script, no `test:matrix` change. Capabilities: Modified — `security-audit-sdk-core`.
Traceability: PLAN-037, PLAN-038, PLAN-074, PLAN-091.

`specs/security-audit-sdk-core/spec.md` — the delta. Match the canonical format exactly:
`### Requirement:` then a non-empty body, then `#### Scenario:` blocks each containing a line starting
`- **WHEN**` and a line starting `- **THEN**`. `check-coherence.mjs` parses the canonical spec and
rejects anything else, so a malformed fold fails PR 2, not PR 1.

```markdown
## ADDED Requirements

### Requirement: Package verification proves the packed artifact is complete and fails on an incomplete one

Package verification SHALL pack the package, apply its file allowlist to that same pack output,
install that exact tarball into a disposable consumer with production-only dependency installation,
and import every entry point declared in the package export map by package specifier before
reporting a pass.

Verification SHALL establish that each imported entry point resolves from the disposable consumer's
own installed dependency tree, and SHALL fail when an entry point resolves from anywhere else.

Verification SHALL fail when the packed inventory omits a module the entry points load, and SHALL
fail when a packed artifact references an identifier the packed artifact does not define.
Diagnostics SHALL name the entry point and the unresolved module or identifier, SHALL be bounded in
count and length, and SHALL NOT include artifact source content.

The packed tarball and the disposable consumer SHALL be created outside the package root and SHALL
be removed when verification ends, on both the passing and the failing path.

Verification controls for this behaviour SHALL include a deterministic failing mutation for each
failure class named above, applied to a package copy rather than to the working tree, and SHALL
include an unmutated control that passes in the same harness.

#### Scenario: Approved tarball installs, resolves, and validates
- **WHEN** package verification runs against the built package
- **THEN** the allowlist passes, every declared entry point imports from the disposable consumer's
  own dependency tree, a canonical event validates, and the reported inventory is the same pack
  output the allowlist inspected

#### Scenario: Packed inventory omitting a loaded module is rejected
- **WHEN** the packed inventory excludes a module that a declared entry point loads, while every
  individually required path remains present
- **THEN** verification fails and the diagnostic names the entry point and the unresolved module

#### Scenario: Packed artifact missing a bundled runtime helper is rejected
- **WHEN** a packed artifact references an identifier that the packed artifact does not define
- **THEN** verification fails and the diagnostic names the failing entry point

#### Scenario: Entry point resolved outside the disposable consumer is rejected
- **WHEN** a declared entry point resolves from a dependency tree other than the disposable
  consumer's own
- **THEN** verification fails rather than reporting a pass

#### Scenario: Temporary artifacts are discarded on both paths
- **WHEN** package verification ends, whether it passed or failed
- **THEN** the packed tarball and the disposable consumer are removed, and neither was created
  inside the package root
```

**If D11 fires**, the provenance paragraph and the "Entry point resolved outside the disposable
consumer" scenario come out of this delta with the arm. Write the delta with them in, and remove
both if Task 5 abandons provenance — do not leave a SHALL in the canonical spec that no control
enforces.

## Task 4: Write the assessment (still commit P)

**File:** `openspec/changes/verify-packed-artifact-completeness/assessment.json`

Closed schema 1.1, `full` level, `direct_implementation`, `security_sensitive: true` (so no
`security_justification` map). A full assessment requires at least one `direct_implementation`
candidate **and** at least one `alternative`; every rejected id must appear in `rejection_reasons`;
each reason must be force-based — never "best practice" or "industry standard".

- `applicability.triggers_matched`: `["canonical_capability_requirement", "security_sensitive_behavior"]`
- `applicability.material_capability_modification`: `true`
- `applicability.capabilities`: `["security-audit-sdk-core"]`
- `ordering.proposal_baseline_commit`: `<BASELINE_SHA>`
- `owned_paths` — exact paths, covering all three PRs:
  - `packages/security-audit-sdk-core/scripts/packed-completeness.mjs`
  - `packages/security-audit-sdk-core/scripts/check-package-contents.mjs`
  - `packages/security-audit-sdk-core/tests/verification/packed-completeness-mutations.test.mjs`
  - `packages/security-audit-sdk-core/tests/verification/packed-consumer-closure.test.mjs`
  - `packages/security-audit-sdk-core/CONTEXT.md`

`README.md` and `docs/adr/0003-…` are `documentation_only` and need no `owned_paths` entry; the
canonical capability spec is covered by `applicability.capabilities` while the change is active.
`packages/security-audit-sdk-core/CONTEXT.md` is **not** documentation for this purpose — it matches
`packages/`, so it is `governed_implementation` and must be listed (F17).

Forces to state (each drawn from a measured or read finding, not from principle):

- A tarball that omits a module its entry points load passes the current allowlist at exit 0 and
  fails only at import.
- A packed artifact referencing an identifier it does not define passes both the allowlist and the
  shipped-import policy, and fails only at import.
- The existing completeness control is effective but has no failing twin, so a regression in it would be
  silent.
- Nothing establishes that an imported entry point came from the installed consumer rather than an
  ancestor dependency tree.
- The command the issue names as the verification entry point does not run the completeness proof.

Candidate approaches — one `direct_implementation` (extract the completeness procedure into a shared
module, call it from `check-package-contents.mjs` and the verification test, and add mutation arms
with a null control), and at least one `alternative` to reject on force. The obvious alternative is
"extend the required-file allowlist to enumerate every packed module" — reject it because an
enumeration is a list that drifts from what the entry points actually load, and because it cannot
detect M-70-B at all: the missing-helper mutation changes no path in the inventory.

Commit P as `docs(openspec): propose packed artifact completeness verification` with an explicit staged
allowlist of the six change-directory files. Stage nothing else.

## Task 5: RED — prove each arm fails before the control exists

**File:** `packages/security-audit-sdk-core/tests/verification/packed-completeness-mutations.test.mjs` (new)

A new file, not an addition to `mutations.test.mjs` (F15). Write the arms first and watch each fail
for its intended reason, then implement.

Harness, per arm — the recipe proven in Task 0:

1. `mkdtemp` a suite root; copy the package into `<suite>/packages/security-audit-sdk-core`, filtering
   `node_modules`, `dist-tests`, `dist-examples`, `coverage`, `.verification-output`; copy
   `contracts/` into `<suite>/contracts`.
2. Apply the mutation to the copy.
3. Run `node scripts/check-package-contents.mjs` from the copy.
4. Assert on exit status **and** the diagnostic text.
5. Clean up in `test.after`.

No `node_modules` symlink is needed: `npm pack` and an offline install of a local tarball require
none, and the completeness test imports nothing external. Omitting the symlink also avoids the
`npm ls --omit=dev` harness artifact that made `check-dependencies.mjs` exit 1 on an unmutated copy
(F3).

The arms:

| Arm | Mutation | Must fail with |
| --- | --- | --- |
| **null control** | none | exit 0 — this is what makes the other three mean something |
| **M-70-A** inventory completeness | narrow `files` so `dist/validation/` is not packed, keeping all 16 required paths present | exit non-zero, diagnostic naming the entry point and `dist/validation/index.js` |
| **M-70-B** artifact completeness | point the bundled helper binding in the packed validator at an undefined identifier | exit non-zero, diagnostic naming the failing entry point |
| **M-70-C** provenance | place a decoy `node_modules/@bloodtrail/security-audit-sdk-core` in an ancestor of the consumer and skip the install, so resolution walks upward | exit non-zero — the provenance assertion, not a `MODULE_NOT_FOUND` |

Assertions common to every failing arm, mirroring `shipped-import-policy.test.mjs:220-245`:

- exit status is non-zero;
- the diagnostic names the entry point and the unresolved module or identifier;
- a source marker planted next to the mutation does **not** appear in the output;
- control characters in any interpolated value are escaped, not echoed;
- total output stays length-bounded.

Also assert the cleanup contract directly: capture the tarball and consumer paths the run reports and
assert both are gone afterwards, on the failing path as well as the passing one.

**The M-70-C decision point (D11).** This arm is the only one not proved during triage. Build it
first, before the module exists, and give it a fixed budget. If it cannot be made to fail
deterministically — if resolution order turns out to depend on npm version, platform, or the shape of
the ancestor tree — then **remove the provenance assertion and this arm from the change entirely** and
refile them as a new issue citing PLAN-091. Record which way it went in `design.md`.

What is forbidden is the third option: keeping the assertion while relaxing it until the arm passes.
An assertion that cannot fail is the exact defect this issue was opened to fix, and shipping one here
would be the change refuting itself.

## Task 6: GREEN — extract the completeness module and wire the gate

**Files:** `packages/security-audit-sdk-core/scripts/packed-completeness.mjs` (new),
`packages/security-audit-sdk-core/scripts/check-package-contents.mjs` (modified),
`packages/security-audit-sdk-core/tests/verification/packed-consumer-closure.test.mjs` (modified)

`packed-completeness.mjs` exports one async function, `verifyPackedCompleteness({ packageRoot, onInstalled })`,
which:

1. `mkdtemp`s a pack destination and a consumer root, both outside the package root — `npm pack`
   writes a `.tgz`, and `check-package-contents.mjs`'s own `forbiddenPath` regex rejects any packed
   `.tgz` inside the package;
2. runs `npm pack --json --pack-destination <packDir> --ignore-scripts --loglevel error` once and
   keeps the `files` inventory it returns (F5);
3. writes a minimal `package.json` in the consumer — without it npm walks up to the nearest ancestor
   manifest and installs there instead;
4. runs `npm install <tarball> --omit=dev --no-audit --no-fund --ignore-scripts --offline --loglevel error`;
5. reads the package's `exports` map and, for every declared subpath, imports it by package specifier
   from a probe module written inside the consumer;
6. asserts each entry point resolved from under `<consumerRoot>/node_modules/` — this is the PLAN-091
   assertion, and it must fail closed if resolution cannot be determined;
7. validates one canonical event through the consumer install;
8. removes both temporary directories in a `finally`, then returns
   `{ files, entryPoints, consumerRoot, tarball }`.

The optional `onInstalled` hook is invoked after step 6 and before cleanup, receiving the consumer
root and the imported namespace. That is how `packed-consumer-closure.test.mjs` keeps its
structural-negative, semantic-negative, `uri`-format, and installed-artifact assertions without a
second pack (D4).

`check-package-contents.mjs` keeps its manifest assertions and its allowlist verbatim; the only
change is that the inventory now comes from `verifyPackedCompleteness`'s real pack instead of a separate
`npm pack --dry-run`, and the summary line reports the entry points imported alongside the file and
byte counts.

Keep functions small and single-purpose (F15). Diagnostics carry the entry point, the unresolved
module or identifier, and the violation class — never artifact source.

Now re-run Task 5 and require the null control to pass and all three mutation arms to fail, with the
same failure signals recorded in Task 0.

## Task 7: Record the inspection

- `README.md:145`: `verify` no longer only "inspects `npm pack --dry-run`" — it packs, installs
  production-only, and imports. One clause, no restructuring. Mind F16: no line in the added text may
  begin with `export function`, `export class`, `export const NAME = (`, `module.exports =`, or
  `exports.NAME =` at any indentation.
- `packages/security-audit-sdk-core/CONTEXT.md` (new, D12/D14): a glossary and nothing else — no
  implementation detail, no spec text. Two entries at minimum. **self-contained**: a packed artifact
  that references no module outside itself; owned by ADR-SDK-011 and already proved. **complete**: a
  packed artifact from which no module its declared entry points load is absent; the property this
  change adds. Note explicitly that *closure* is not this project's word for either — it is bound to
  lifecycle closure in `openspec/specs/security-audit-sdk-core/spec.md:754` — and that
  `packed-consumer-closure.test.mjs` is legacy naming retained for continuity.
- `docs/adr/0003-package-gate-executes-a-production-install.md` (new, D13/D15): status Accepted, and
  the three sections the sibling ADRs use. Context: `validate` had no step that installed anything;
  the issue names `test:package` as the verification entry point; a control with no failing twin is
  unproved. Decision: the package gate performs one real pack and one production-only install.
  Consequences: `validate` executes rather than only inspecting, it needs a writable temp directory,
  and `--offline` must keep it network-free. Alternatives rejected: leaving the proof under
  `test:verification` (does not honour the named command, and leaves the gate's name a lie), and
  enumerating every packed module in the allowlist (a list that drifts, and blind to M-70-B).
- `openspec/changes/verify-packed-artifact-completeness/design.md`: record D3 (one pack, not two),
  D4 (one module, two callers), D5 with D11 (provenance, and its carve-out), D6 (three arms plus a
  null control), D12 (vocabulary), D13 (execute, not just inspect), and D10 (this discharges #69's
  recorded relative-specifier assurance limitation by execution).
- `tasks.md`: tick the implementation group.

## Task 8: Full read-only verification (empty index, BEFORE staging T)

Run the Stage 1 battery from Task 10. `test:git` requires an **empty** Git index, so verification runs
before `git add`, never after. It also rejects a missing final newline, any CR byte, and any trailing
whitespace in every file changed since the baseline — untracked Markdown included, which covers this
plan file and the brief.

Then prove both directions once more on the exact tree that will be committed:

```sh
cd packages/security-audit-sdk-core
npm run build
npm run test:package                 # expect PASS, with entry points on the summary line
node --test tests/verification/packed-completeness-mutations.test.mjs
node --test tests/verification/packed-consumer-closure.test.mjs
```

## Task 9: Commit T, push, PR 1

Stage an explicit allowlist: the new module, the modified gate, both test files, `README.md`, the
change's `design.md`/`tasks.md` updates, and this plan file. Nothing else. Leave unrelated untracked
paths alone.

Commit as `feat(sdk): verify packed artifact completeness in the package gate`. Conventional Commits are
validated on the PR title **and every commit subject**. Open the PR against `main` from
`feat/verify-packed-artifact-completeness`. The body states the F1 correction (the AJV defect is gone and
the positive control already existed; this change adds the negative evidence and moves the proof into
the gate the issue names), the measured F2/F3/F4 results, the acceptance criteria mapped to their
evidence, the assurance limitation, and that #71 stays out of scope.

Rebase onto `main` if it moves; never `git merge main` into the branch — a `Merge branch 'main' into …`
subject has no exemption from the conventional-commits check and blocks the PR.

Do not couple this work to PR #182 (release-please). It is **red on two required checks** and cannot
merge today (F19), so there is nothing to hold and nothing to wait for. If it goes green and merges
mid-lifecycle, re-freeze `origin/main` and rebase — that is a normal rebase, not a crisis. Its own
fix is a `governance_core` policy edit to classify `version.txt` and `.release-please-manifest.json`;
file that as its own issue if one does not exist.

## Task 10: The gate battery (run for every PR)

**Stage 1 — before `git add`** (`test:git` requires an empty index):

```sh
npm run check:generated --prefix packages/security-audit-sdk-core   # before validate, which regenerates
npm run validate --prefix packages/security-audit-sdk-core
npm run validate --prefix contracts/security-audit
openspec validate --specs
openspec validate verify-packed-artifact-completeness --strict
openspec validate --all --strict
openspec validate --all --archived --strict
node --test openspec/tests/design-pattern-governance/*.test.mjs
git diff --check
git status --porcelain=v1 --untracked-files=all
```

**Stage 2 — after the commit.** These read `HEAD`. Before the commit they are vacuously green:
`check-design-pattern-governance.mjs:322` short-circuits with `if (base === head) return;` and exits
0 reporting "passed in final phase" without inspecting anything. **Never record a pre-commit
final-phase result as evidence.**

```sh
node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main ; echo "exit=$?"
node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main --json   # rangePaths must NOT be null
node openspec/scripts/run-governance-dual-check.mjs ; echo "exit=$?"
```

Never judge a checker through a `sed` or `grep` pipe — that reports the filter's exit status. Read the
exit code directly. When reading `run-governance-dual-check.mjs` itself, use
`command grep --binary-files=text`: it contains literal NUL bytes, so plain `grep` treats it as binary
and returns silence rather than no-match.

The perimeter unions paths across every commit in the range, so deleting an offending file in a later
commit does **not** clear a `path-unclassified` finding — rewrite the introducing commit or classify
the path.

**Stage 3 — the commit tree** (PR 3 especially):

```sh
git show --name-status --no-renames HEAD     # a move shows A and D lines, not A alone
git ls-tree --name-only HEAD openspec/changes/
git status --porcelain
```

Green in Stage 2 authorises the push. Red means `git reset --soft HEAD~1`, fix, repeat — the
candidate is not frozen until it is pushed. After the push, preserve it byte-for-byte: no
regeneration, no reformatting, no rerunning tests on an already-verified candidate.

If `sonar` is red, read its "Explain quality gate failure" step before assuming the code is at fault —
the self-hosted server is the more common cause and the job already retries once after 30s. The
server is reachable from this workstation, so a real finding can be read and the fix proved locally
rather than by pushing again.

## Task 11: PR 2 (spec fold), then PR 3 (archive)

**PR 2 — fold the delta into the canonical spec.** Branch `docs/sync-packed-completeness-requirement`.
Use `openspec-sync-specs`. Two files only, exactly as `3284aba5` did: the canonical
`openspec/specs/security-audit-sdk-core/spec.md` gains the requirement, and the change's `tasks.md`
ticks the fold task. Commit as
`docs(openspec): fold packed artifact completeness into the canonical SDK spec`.

**PR 3 — archive as a complete relocation.** Branch `docs/archive-verify-packed-artifact-completeness`.
Use `openspec-archive-change`. Perform the move with `git mv` so the commit carries both the
additions and the deletions — the relocation checker rejects an archive whose active directory still
exists at `HEAD`, and `git add <destination>` alone commits additions only, which passes locally and
in CI while leaving the move half-done. Add `archive-evidence.md` in the archive directory, following
`openspec/changes/archive/2026-08-20-reject-undeclared-shipped-imports/archive-evidence.md`. Commit as
`docs(openspec): archive verify-packed-artifact-completeness`.

Order is not negotiable: the fold must land **before** the relocation (F9).

## Task 12: Close #70 and report

Close **after PR 2 and before building the archive candidate**, so the archive lands at full task
count in one commit — the precedent is
`openspec/changes/archive/2026-08-17-record-validator-packaging-policy/tasks.md:1.7`. Post the archive
permalink as a follow-up comment after PR 3 merges.

```sh
gh issue close 70 --repo nandohdc/bloodtrail --comment "<evidence>"
```

The evidence comment states: the merge commits of all three PRs, the acceptance criteria mapped to
the controls that prove them, the measured mutation results, the F1 correction, the assurance
limitation, and what was not verified.

Then:

```sh
openspec list                                   # expect: No active changes found.
openspec validate --all --strict
openspec validate --all --archived --strict
git status --short --branch
```

---

## Validation matrix

| Acceptance criterion (#70, as restated in the brief) | Evidence |
| --- | --- |
| The approved tarball passes the production-only smoke test | `npm run test:package` green on the built live tree, now including install and import; `packed-consumer-closure.test.mjs` retains its behavioural assertions |
| A missing-helper mutation fails with a stable diagnostic | M-70-B arm: bundled helper binding undefined, `check-package-contents.mjs` exits non-zero naming the failing entry point |
| A missing-module mutation fails with a stable diagnostic | M-70-A arm: `dist/validation/` excluded from `files`, diagnostic names the unresolved module |
| The installed consumer path, not the source workspace, supplies modules | Provenance assertion in `packed-completeness.mjs` plus the M-70-C decoy-ancestor arm |
| Temporary consumers are isolated and discarded | Both directories created outside the package root via `mkdtemp`, removed in a `finally`, asserted gone on the failing path too |
| Negative fixtures run under `npm run test:package` | The gate itself performs the completeness run; the mutation arms invoke `check-package-contents.mjs`, not a test-only helper |
| A gate proved able to fail (PLAN-074) | Three failing arms plus a null control that passes in the same harness |
| Hoisting cannot satisfy the gate (PLAN-091) | M-70-C |
| No second pack added to `validate` | One `npm pack --json` serves the allowlist and the install (F5); measured `test:package` cost today is 0.62s and the completeness run 1.06s |

---

## Risks, tradeoffs, and open questions

- **This gate proves loadability through declared entry points, not correctness of the package.** An
  unexercised broken path inside the tarball still passes. State that as an assurance limitation in
  the proposal, the requirement, and the closing comment.
- **The measured cost is small but it is not zero**, and it lands in `validate`, which every
  contributor runs. Measured: 0.62s for the allowlist today, 1.06s for a full pack-install-import,
  3.52s for three copy-and-mutate arms. Re-measure on the CI runner before claiming a number in the
  PR body — this workstation has a warm npm cache and a fast disk.
- **`--offline` is doing real work.** The install resolves a local tarball path and must never reach
  a registry. If a future change makes the consumer install anything else, the gate silently becomes
  network-dependent and will fail on a runner without egress.
- **The provenance assertion is the subtlest part, and it may not survive.** Resolution is observable,
  but the assertion must fail closed when it cannot be determined; one that silently skips is worse
  than none, because it reads as coverage. M-70-C exists to prove it fires, and D11 pre-authorises
  dropping provenance from this change if it cannot. Dropping it is fine. Softening it is not.
- **The vocabulary change is a real cost.** The issue title, the existing test filename, and #68's
  design prose all say "closure"; the spec will say "completeness" (D12/F18). Anyone reading across
  the two will hit the seam. The alternative was overloading a term the same spec file already binds
  to lifecycle closure, which is worse — but the seam should be named in `CONTEXT.md`, not left for a
  reader to discover.
- **Exit status alone is not detection in a package copy** (F3). Every arm asserts the diagnostic.
- **Sonar `new_violations = 0` is the likeliest CI surprise**, and the second likeliest is a trailing
  space in Markdown failing `test:git`.
- **Open question for the owner:** should `check-package-contents.mjs`'s required-file list be
  retired now that completeness is proved by execution? It would stop being a second, drifting source of
  truth — but it is also the only control that would notice a *deliberate* narrowing of the public
  surface. Left in place by this change; worth a decision later, not here.

## What this does not authorize

Nothing here authorizes publication, registry upload, package-manager migration, multi-package
topology, production deployment, real-user data, framework instrumentation, transports, exporters,
collectors, queues, outboxes, storage, SIEM integration, analytics, detection, browser telemetry, or
cryptographic audit-log chaining. It adds no runtime dependency, adds no npm script, changes no public
API, leaves `files` and the export map untouched, and leaves contract `1.0.0` alone. The package stays
`private: true` and `UNLICENSED`; installing a tarball into a disposable temporary consumer is not a
publication path and `test:publication-path` continues to prove that.

## What this plan did not verify

- Behaviour on Node 24. Only Node v26.7.0 was available on this workstation; CI's `sdk` job runs
  Node 26 and `test:matrix` covers the majors, and `test:package` is deliberately not in `test:matrix`
  (F11), so the completeness proof runs on Node 26 only.
- Whether `sonar` and `codescene delta` accept the new module and test file — only knowable from a
  real pushed commit.
- The CI runner's cost for the install step; every timing above is from this workstation with a warm
  npm cache.
- The exact shape of the M-70-C provenance arm. The decoy-ancestor construction is sound in principle
  and was not built during triage. Task 5 is where it is proved or abandoned under D11.
- Whether `packages/security-audit-sdk-core/CONTEXT.md` passes the perimeter in practice. It matches
  `packages/` and so classifies as `governed_implementation` (F17, read from the policy), and the
  `owned_paths` entry is in Task 4 — but no CONTEXT.md has ever existed in this repository, so the
  first one to be committed is also the first test of that reading.
- Whether PR #182's `design-pattern-governance` failure is in fact `path-unclassified`. The
  classification gap in its file list is read from the policy; the failing job log was not opened.
