## Why

On 2026-08-19, commit `057d457` archived `cover-local-instruction-control-paths` by **addition
only**: it added `openspec/changes/archive/2026-08-19-cover-local-instruction-control-paths/` and
never staged the removal of the active directory. `git show --stat` reads `5 files changed, 246
insertions(+)` with no deletion line, and `git ls-tree HEAD openspec/changes/` listed the change
twice — once active, once archived. It passed the entire local battery **and** all 18 required CI
checks. It was caught by a human reading the tree, and repaired in `71aa458`.

Both gates were individually correct, and neither could see it:

- **Locally**, `collectRangePaths` folds `changedPaths(base, null)` — the *working tree*
  (`perimeter.mjs:113`) — and `untrackedPaths()` (`:114`) into the inspected range, and
  `activeChangeIds()` seeds active ids with `readdirSync` over `openspec/changes`
  (`check-design-pattern-governance.mjs:425`). The unstaged deletions were inside the range and the
  active directory was gone from disk, so the checker validated the move that was *performed*, not
  the one that was *committed*. `openspec list` and `openspec validate` read the filesystem too.
- **In CI**, only the pushed commit exists, and its five added paths are legitimately covered: the
  archived directory carries an `assessment.json` with a non-empty `applicability.capabilities`, so
  `carriesRelocatedArtifact` recognises the relocation and `ownedPathsFor` (`perimeter.mjs:261-272`)
  grants it. The active directory is present on disk, so `activeChangeIds()` returns it — but
  nothing cross-references *an archive was introduced* against *the active directory is still here*.

R24 already requires the governed archive step to verify "exact changed paths", so `057d457`
violated a requirement that was already on the books. The gap is not a missing rule: it is that
R24's obligations are prose discharged by a human writing `archive-evidence.md`, and PR #185's
evidence file asserted that "changed paths are exactly the active-directory removal and the
dated-archive addition" while the commit in the same PR contradicted it. Evidence prose is not
enforcement.

## What Changes

- Add a governance control that fails closed when a range **introduces** a recognised archive
  relocation of change `<id>` and `openspec/changes/<id>/` still resolves at `HEAD`.
- Completeness is judged from the **commit tree**, never the working tree. Reading the filesystem
  here would reproduce the exact blind spot being closed.
- The control fires only on relocations the range introduces, not on later edits to an existing
  archive directory, so re-opening an archived change id cannot produce a false rejection.
- New module `openspec/scripts/design-pattern-governance/archive-completeness.mjs`, consuming the
  map `collectRelocatedChangeIds` (`perimeter.mjs:210`) already computes; one call site in
  `check-design-pattern-governance.mjs`; one new test file carrying a mutation probe.
- Add **R25** to the `software-design-pattern-governance` capability. R24 is untouched: it governs
  what archive *evidence* must assert, R25 governs what the *commit* must contain.
- No **BREAKING** change. The control adds a rejection that no correct archive commit can trigger;
  the four existing R15 relocation fixtures are expected to stay green unchanged.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `software-design-pattern-governance`: gains **R25 — Archive relocation is complete in the
  commit**, requiring that a range introducing a recognised relocation leave no active directory for
  the relocated change at `HEAD`, judged from the commit tree and verified for every relocation the
  range introduces.

## Impact

- **Scope**: `openspec/scripts/design-pattern-governance/archive-completeness.mjs` (new),
  `openspec/scripts/check-design-pattern-governance.mjs` (one import, one call),
  `openspec/tests/design-pattern-governance/archive-completeness.test.mjs` (new), and
  `docs/design-pattern-governance.md`.
- **Governance classification**: governance-core (`openspec/scripts/design-pattern-governance/` and
  `docs/design-pattern-governance.md` are both `governance_core_artifacts`) and
  canonical-capability-bearing, so the assessment is full and declares both triggers.
- **Code**: no `packages/`, no `contracts/`, no policy file, no `verification-lifecycle.json`, no
  `ci.yml` — the governance job already runs the checker, the dual check, and the test suite
  unchanged.
- **Dependencies**: none. The control uses `objectAtPath` from the existing read-only git module.
- **Evidence residual**: the motivating commit `057d457` is unreachable from every ref — not an
  ancestor of `main`, contained by no branch local or remote — and survives only in one
  workstation's reflog. It has been captured as a patch, but the durable proof of this control is
  the fixture in the new test file, which reproduces the identical committed end state and is
  re-runnable in CI forever.
- **Non-goals**: this change does not verify that an archive move is byte-identical, that
  `tasks.md` reconciliation is honest, or that `archive-evidence.md` claims match the commit — those
  remain human obligations under R24, and a green R25 is not proof of a well-formed archive. It does
  not narrow the working-tree fold in `collectRangePaths`, which stays as a known residual: removing
  it would not have caught `057d457`, since CI ran with no working tree at all and passed anyway. It
  does not detect an incomplete relocation that landed before the control existed. It grants no
  production or publication authorization.
