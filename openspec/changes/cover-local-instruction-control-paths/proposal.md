## Why

`correct-local-instruction-verification-premise` corrects a verification control that lives in
`packages/security-audit-sdk-core/tests/verification/`. Those are governed implementation paths, and
the design-pattern perimeter requires each one to be owned by an **active** change whose assessment
declares the capability. That change is grandfathered (`class: mainline_present`) and carries no
assessment, so it declares no capabilities and owns only its own directory. Reproduced at
`72a39e54001079434f3b7ad9f518287d59369ff0` with the correction applied: the final governance phase
fails closed with `openspec-association-unrelated` on both control files.

Giving the correction its own assessment is not available to it. It carries a `## ADDED Requirements`
delta, so an honest assessment declares `canonical_capability_requirement` — as every spec-carrying
change in this repository does — and that trigger is on the provenance schema's
`scope_expansion_triggers`, so its grandfathering entry then fails with `grandfathered-scope-expanded`.
Dropping the delta is not available either: the entry pins the exact blob of a `proposal.md` that
declares a modified capability, so the proposal cannot be edited to match a delta-less change.

## What Changes

- Hold an active `security-audit-sdk-core` capability declaration that owns the two verification-control
  paths, so the correction's implementation is covered while it lands.
- Keep that declaration active through the correction's archive, whose spec fold into
  `openspec/specs/security-audit-sdk-core/spec.md` needs the same coverage for the same reason. This
  discharges the prerequisite the correction records as its task 6.5.
- After that archive merges, archive this change as a pure relocation: it carries no `specs/` delta, so
  its own archive needs no spec-fold coverage and creates no recursion.
- No specification content, no code, no checker, and no policy file changes.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change modifies no requirement of `security-audit-sdk-core`; its `.openspec.yaml` sets
`skip_specs: true`. The assessment declares the capability solely so the governance perimeter covers
the sibling correction's control paths and, later, its spec fold.

## Impact

- **Scope**: `openspec/changes/cover-local-instruction-control-paths/` and, through `owned_paths`, the
  two named control files. Nothing else.
- **Code**: none.
- **Dependencies**: none.
- **Non-goals**: this change does not author or alter any spec requirement, does not amend the
  governance perimeter, any checker, or the provenance record that grandfathers the correction (the
  rejected alternative), does not modify or archive the correction itself, and grants no production or
  publication authorization.
