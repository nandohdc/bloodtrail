# Proposal

## Why

Bloodtrail's immutable authorization records cannot currently express a later bounded authorization
for the same change and operation without leaving two embedded `CURRENT` records and failing closed
with `authorization-current-conflict`. The post-T3 CB-018 repair exposed that the schema can describe
the intended successor but authorization discovery cannot make it effective without mutating signed
history or pretending that a legacy index overrides schema-record bytes.

This planning decision is bound to evidence package set
`19fcf60430d37aa13d752620cf17b8b17533037bbc257db7795b5c05000ae128` and manifest
`d5378b6e60319dfb5103edae70e17aa26cb15f121e59f22969fb6bfe0d809c2e` under
`bloodtrail-assurance/candidate-b-remediation-program/cb-018-planning-package-r5/`.

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
  `RESOLVE_DEBT` (such as T3) are immune from `IMPLEMENT` scope checking.
- Integrate the mechanism into the T3 lineage via a dedicated clean two-parent merge commit
  (`Parent 1 = T3`, `Parent 2 = Mechanism Head`), preserving T3 as an unbroken ancestor.
- Fail closed on unsigned or invalid successors, wrong bindings, forks, self-supersession, cycles,
  multiple leaves, gaps, and paths outside the authorization effective for the commit that changed
  them.
- Preserve existing root authorizations and legacy indexed evidence without rewriting their signed
  bytes. The unsigned CB-018 post-T3 draft remains external diagnostic evidence and is not made
  operative by this proposal.
- Add 25 disaggregated negative controls and 14 dedicated mutants (47 total campaign) across
  isolated test seams.

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
  fixtures.
- No CB-018 T3 object, contract source, generated contract artifact, pin, debt state, fold state,
  activation evidence, release metadata, CB-002 artifact, or CB-019 artifact is changed.
- After this mechanism is separately implemented, reviewed, and integrated, the post-T3 repair
  requires a newly drafted and exact-byte-reviewed authorization; the current unsigned draft is not
  grandfathered.
