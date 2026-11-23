# Proposal

## Why

Bloodtrail's immutable authorization records cannot currently express a later bounded authorization
for the same change and operation without leaving two embedded `CURRENT` records and failing closed
with `authorization-current-conflict`. The post-T3 CB-018 repair exposed that the schema can describe
the intended successor but authorization discovery cannot make it effective without mutating signed
history or pretending that a legacy index overrides schema-record bytes.

This planning decision was first bound to evidence package set
`19fcf60430d37aa13d752620cf17b8b17533037bbc257db7795b5c05000ae128` and manifest
`d5378b6e60319dfb5103edae70e17aa26cb15f121e59f22969fb6bfe0d809c2e` under
`bloodtrail-assurance/candidate-b-remediation-program/cb-018-planning-package-r5/`, against base `e1cc9f7`.

It is re-frozen against `main` at `691aa69` and is now bound to package set
`a865a92bb46c68456adbc7616ff1a85cfac2338f706326515bfa54374392e410` and manifest
`d6ce8cc3f3b0e1fca0c670502cae75bcb75a0f98f2b38437f39c2695a82a2cae` under
`bloodtrail-assurance/candidate-b-remediation-program/cb-018-sequential-authorization-refreeze-r2/`. That
package records the owner's decisions of 2026-11-22 on workstream F (#972) and the merge-gate verifier they chose.

## What Changes

- Define a signed, immutable predecessor-to-successor authorization chain whose effective leaf is
  derived from exact history rather than from later mutation of an earlier record's `status`.
- Require a signed successor authorization to carry a closed `supersession` binding for the exact
  predecessor identifier, path, blob, and introducing commit. The successor's own dedicated signed
  introducing commit binds its path, blob, and authorizing identity; its exact parent commit/tree is
  the effective boundary. No separate floating transition artifact is introduced, and neither
  authorization record is edited.
- Validate every signed authorization record, including historical predecessors, before selecting
  an effective authority. Changing a historical record or its status cannot remove it from
  provenance validation.
- Assign each valid authorization a half-open effective interval: $(C_A, P_B]$ for predecessor and
  $(C_B, \text{HEAD}]$ for successor. Dedicated authorization commits modify strictly one path and
  are verified for cryptographic signatures.
- Enforce operation-aware path attribution so that debt retirement commits authorized under
  `RESOLVE_DEBT` (such as T3) are immune from `IMPLEMENT` scope checking. Production scope evaluation
  uses the attribution and the interval evaluator themselves; no path-prefix exemption stands in for them.
- Integrate the mechanism from a branch cut from current `main`, landed by a merge commit. T3
  (`1021b776331f9268578ea1fd21727521be353182`) has been an ancestor of `main` since #543, so its ancestry is
  preserved by construction and asserted mechanically. The earlier plan of a merge whose first parent is T3 is
  withdrawn, because it can no longer be built without rewinding `main`.
- Fail closed on unsigned or invalid successors, wrong bindings, forks, self-supersession, cycles,
  multiple leaves, gaps, and paths outside the authorization effective for the commit that changed
  them.
- Preserve existing root authorizations and legacy indexed evidence without rewriting their signed
  bytes. The unsigned CB-018 post-T3 draft remains external diagnostic evidence and is not made
  operative by this proposal.
- Add 25 disaggregated negative controls and the 14 repository tests in a dedicated controls module.
  Re-derive the mutant catalog from the bytes actually implemented, including mutants for the production
  wiring of attribution and intervals. The campaign holds at least 47 mutants, each paired one-to-one with
  its killing control in the fixture, and every one must be killed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-governance`: Define immutable sequential operation authorization, exact successor binding,
  unique effective-leaf selection, historical verification, and commit-bounded scope intervals.

## Impact

- Planning changes are confined to this OpenSpec change directory.
- Future mechanism implementation is locked to exactly eight paths: the authorization schema, the
  dedicated sequential authorization module, authorization discovery, governed-range scope
  evaluation, focused repository controls, mutation runner, negative control fixtures, and mutant
  fixtures. The sequential authorization module and the controls module are new against `main`.
- The owner's signed root `IMPLEMENT` authority for this change lands first, as its own dedicated one-path
  commit, before the implementation branch is cut.
- No CB-018 T3 object, contract source, generated contract artifact, pin, debt state, fold state,
  activation evidence, release metadata, CB-002 artifact, or CB-019 artifact is changed.
- The post-T3 fixture repair has already landed, in #572, under the signed Option A restoration
  authority, so no successor authorization is planned for it. The unsigned post-T3 draft stays
  historical and is not grandfathered.
