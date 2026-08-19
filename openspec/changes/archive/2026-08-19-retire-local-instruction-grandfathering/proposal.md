## Why

`correct-local-instruction-verification-premise` is the first grandfathered change this repository
has ever archived, and archiving it necessarily fails the required `design-pattern-governance`
check. Its grandfathering entry's `bounded_paths` stop at the active change directory, so every file
under the dated archive directory reads as out of recorded scope (`grandfathered-scope-expanded`),
and a change with no assessment declares no capabilities, so it contributes no association coverage —
not even of its own relocation (`openspec-association-unrelated`). Reproduced in a disposable-clone
dry run at `e176bce9164addbecac863e1491d46e50f6b58bd`: fold + move + reconciliation, committed, then
`--phase final` produces exactly 10 diagnostics — five `grandfathered-scope-expanded` and five
`openspec-association-unrelated`, one of each per file under
`openspec/changes/archive/2026-08-19-correct-local-instruction-verification-premise/`
(`.openspec.yaml`, `design.md`, `proposal.md`, `specs/security-audit-sdk-core/spec.md`, `tasks.md`).

Neither widening `bounded_paths` nor giving the correction an assessment is available: both edit
this governance-core policy, and an honest assessment for a spec-carrying change declares
`canonical_capability_requirement`, which the provenance schema lists under
`scope_expansion_triggers`. The policy itself records the precedented basis for retirement, in
`grandfathering_notes.sdk_remediation`: *"archived on 2026-08-11 and is no longer an active change,
so it needs no grandfathering entry."* Once the correction is archived it is no longer an active
change, and the same basis applies.

## What Changes

- Retire the single `grandfathering` entry in `openspec/governance/design-pattern-policy.json`
  (set the array to `[]`) so the correction can archive as a recognized relocation.
- This change stays active — declaring `software-design-pattern-governance` and owning the policy
  file plus the correction's dated archive directory — until the correction's archive commit has
  merged, so the relocation the retirement enables is itself covered.
- After that archive merges, this change is archived as a pure relocation with no spec fold.
- No specification content, no code, no checker changes. The correction and the keeper change stay
  untouched throughout.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change modifies no requirement of any capability; its `.openspec.yaml` sets
`skip_specs: true`. The assessment declares `software-design-pattern-governance` solely so the
governance perimeter covers the policy file edit and the correction's dated archive directory while
they land. With no spec delta there is no `canonical_capability_requirement` trigger, so this change
does not recurse into the problem it solves.

## Impact

- **Scope**: `openspec/changes/retire-local-instruction-grandfathering/` and, through `owned_paths`,
  `openspec/governance/design-pattern-policy.json` and
  `openspec/changes/archive/2026-08-19-correct-local-instruction-verification-premise/`. Nothing else.
- **Code**: none.
- **Dependencies**: none.
- **Non-goals**: this change does not author or alter any spec requirement, does not amend any
  checker or the perimeter rules, does not modify the correction's or the keeper's artifacts, does
  not widen or otherwise edit the entry's `bounded_paths` (the rejected alternative), and grants no
  production or publication authorization. The retired entry's `bounded_scope` prose is quoted into
  the correction's `archive-evidence.md` before removal so the provenance reasoning survives in the
  archive.
