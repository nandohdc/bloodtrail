## Context

See `proposal.md` — Why, for the defect and the two-sided blind spot that let it through.

The machinery this control needs already exists and is not changed by this design:

- `collectRelocatedChangeIds` (`perimeter.mjs:210`) returns a `Map<changeId, Set<archiveDir>>` for
  every dated archive directory in the range that `carriesRelocatedArtifact` recognises as a genuine
  relocation — the archived `assessment.json` or `proposal.md` is the exact object repository
  history carried at the active change path.
- `objectAtPath(revision, path, cwd)` (`git.mjs:102`) is `git rev-parse <rev>:<path>`, which
  resolves a **directory to its tree object** as readily as a file to its blob, and returns `null`
  when the path is absent at that revision.
- `DiagnosticSink.fail(id, path, message)` (`diagnostics.mjs:33`) is the failure channel. Diagnostic
  ids are free-form strings — there is no registry, and nothing validates an id against a list.

The perimeter runs in the `implementation` and `final` phases only, and short-circuits at
`check-design-pattern-governance.mjs:321` when `base === head`, so a pre-commit run inspects nothing.

## Goals / Non-Goals

**Goals:**

- Reject a commit that introduces a recognised archive relocation while the relocated change's
  active directory still resolves at `HEAD`.
- Judge completeness from the commit tree alone, so the control cannot be satisfied by a working
  tree that merely looks correct.
- Leave the four existing R15 relocation fixtures green without editing them.

**Non-Goals:**

- Detecting an incomplete relocation that landed before this control existed. See Decisions — D1.
- Narrowing the working-tree fold in `collectRangePaths`. See Risks.
- Any check on archive *content*: byte identity, task reconciliation, and evidence honesty remain
  R24's human obligations.

## Decisions

### D1 — The invariant is range-scoped, not state-scoped

The control fires only when the relocation is **introduced in this range**: for at least one
recognised archive directory, no `RELOCATION_ARTIFACTS` entry resolves at `base`, and the directory
resolves at `HEAD`.

*Alternative considered and rejected: a state invariant at `HEAD`* — no change id may be
simultaneously present at `openspec/changes/<id>/` and at a recognised
`openspec/changes/archive/<dated>-<id>/`. It is strictly stronger: it needs no `base` parameter and
would also catch an incomplete move that already reached `main`, which the range-scoped form
structurally cannot. It was rejected because it fires on the archive-then-reopen-same-id shape, and
for a control that runs on every pull request, rejecting legitimate work costs more than missing an
already-landed defect. The shape has never occurred in this repository — 16 archived changes, 16
distinct ids, and `git log --diff-filter=A` shows each `openspec/changes/<id>/proposal.md` created
exactly once — so the rejection buys a deliberate margin rather than answering an observed failure.

A middle option, keeping the range-scoped `sink.fail` as the gate and adding a state-scoped
`sink.warn`, was also considered and not taken: a warning nobody is required to act on adds a second
signal without a second guarantee.

### D2 — R25 is ADDED; R24 is untouched

R24 already requires the governed archive step to verify "exact changed paths", so the defect
violated a requirement that was already on the books. The fix is not a new obligation but a new
*enforcement surface*, and the two do not belong in one requirement: R24 is discharged by a human
writing assertions into `archive-evidence.md`, R25 is checkable from the commit tree with no
evidence document involved. Folding R25 into a MODIFIED R24 would put two enforcement models inside
one requirement and make the machine-checked half indistinguishable from the prose half.

### D3 — A new module, not an extension of `perimeter.mjs`

The control lives in `openspec/scripts/design-pattern-governance/archive-completeness.mjs` and is
called once from `check-design-pattern-governance.mjs` immediately after `collectRelocatedChangeIds`,
receiving the already-computed map. `perimeter.mjs` is 281 lines and already carries path
classification, hidden-implementation detection, association, and relocation recognition; the
checker's own file is the largest in the directory. A separate module also keeps the new control's
test file separate, which matters concretely: `codescene delta` scores file-level rules, so
appending a new control's tests to an existing hotspot fails the gate regardless of the new code's
quality.

### D4 — `objectAtPath`, never `existsSync`

Resolution of both `base` and `HEAD` goes through the existing read-only git module. Using
`existsSync` to decide whether the active directory is gone would reproduce the precise blind spot
this control closes — the local battery passed `057d457` because it trusted the filesystem. Because
`objectAtPath` resolves a directory to its tree object, the check probes
`openspec/changes/<id>` directly rather than guessing at a tracked child.

### D5 — The mutation probe is mandatory

Per the checker's own diagnostics contract, "every control in this checker is reachable by a named
id that a mutation test can demand". Since no registry validates diagnostic ids, a typo in
`archive-relocation-incomplete` would produce a control that silently never matches an assertion.
The test suite therefore includes a case that removes the call site and requires the red case to
pass, proving the control is wired rather than merely present.

## Risks / Trade-offs

- **An incomplete relocation that already landed is invisible** → accepted under D1. Nothing is in
  that state today: `git ls-tree HEAD openspec/changes/` lists only `archive`, and all 16 archived
  ids have no active counterpart. If it ever happens the remedy is a one-off sweep, not a redesign.
- **The working-tree fold stays** → out of scope, and not the root cause: removing it would not have
  caught `057d457`, because CI ran with no working tree at all and passed anyway. Narrowing the
  `final` phase to judge `HEAD` only is a separate governance-core change whose blast radius would
  make this change's red/green proof ambiguous.
- **A green R25 could be misread as a well-formed archive** → the proposal and the documentation
  both state the bound explicitly. R25 answers one question: did the commit contain both halves of
  the move.
- **The motivating commit is unreachable from every ref** → captured as a patch, but the durable
  proof is the fixture, which reproduces the identical committed end state without depending on any
  historical object. If the patch fails to replay, the report says so rather than substituting an
  improvised reconstruction.
- **The control first runs live on this change's own archive commit** → that commit performs exactly
  the relocation R25 governs, so it must pass. The task list verifies the commit tree directly with
  `git show --name-status` before the archive is called ready.
