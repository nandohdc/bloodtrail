# Archive Evidence — add-derived-field-provenance

Explicit archive validation record (R24) for relocation of
`add-derived-field-provenance` to
`openspec/changes/archive/2026-09-09-add-derived-field-provenance/`.

Archive validation is explicit and is not implied by strict OpenSpec validation
alone.

## Completion record

- **1.1–1.4** were completed by the proposal, PR #420, merged as
  `cdecd7f3f2804517d9aa25ee4322b6486fd7a5bb`. That merge commit is also this
  change's `rangeBase` and `proposalBaseline`, so the governed range begins
  exactly where the proposal landed.
- **2.1–4.3** were completed by the implementation, PR #422 at head
  `736f721135adeb489aeccc27d61789117d82640b`, merged as
  `49eaead4481f6e160257ad582b65669dc210149b`. It moved the canonical contract
  from `1.0.0` to `1.1.0`, added the optional bounded
  `risk.model.provenance.derived_from` representation, and advanced both private
  SDK candidates to `0.2.0`.
- **5.1** is completed: the canonical fold, PR #425 at head `c6779ad`, merged
  as `e5a83f4589485b4d33adfd45a1cfa92fdddce964`. PR #427 then repaired the
  coherence gate that this relocation would otherwise have broken. It materialized two requirements and eight scenarios in
  `openspec/specs/security-audit-event-contract/spec.md`, one requirement in
  `openspec/specs/security-audit-sdk-core/spec.md`, and one in
  `openspec/specs/security-audit-sdk-node/spec.md`, with no name collision.

## Defects this change created and then repaired

Recorded because the change's own verification did not catch them, and each was
found by a gate rather than by the change:

- **The collector was never realigned.** The version move regenerated the sdk-core
  projections but left `packages/security-audit-collector/` on `1.0.0`, failing the
  bounds byte-identity gate, the vendored-validator drift gate, every ingress
  admission arm, and the packed-consumer probe. The change's `owned_paths` claimed
  no collector path at all, so nothing in its recorded verification would have run
  those gates. Repaired in PR #422 before merge.
- **The CRA pin was left on `security-audit@1.0.0`** while every SDK pin advanced.
  Because the CRA checker validates the *reviewed range baseline*, it passed for
  this change — whose base was still `1.0.0` — and failed for the first PR opened
  afterwards. Repaired in PR #425; see #426.
- **The canonical capability could not be written at all** until the contract
  baseline advanced past the fold, because it is both a `protectedPrefix` for
  `check-changed-paths.mjs` and the `canonicalCapability` that
  `check-contract-immutability.mjs` diffs against the recorded baseline. Repaired
  in PR #425 by rebinding twelve pinned SHA occurrences across nine files.
- **Coherence could not resolve this change once archived.**
  `check-coherence.mjs` resolved `contract.governedCandidate.change` only under
  `openspec/changes/`, so the relocation reported four present files as missing
  and the contract binding as broken. It failed *open*, not closed: an
  unresolvable candidate fell back to the active change's own OpenSpec text,
  which mentions the contract version, so a missing binding would have read as
  satisfied. Repaired in PR #427, which had to precede this archive — a
  relocated change no longer owns the path and could not carry its own fix.

The common shape: a downstream projection of the canonical contract that the
version move did not reach, in an area the change's `owned_paths` already partly
claimed. Ownership is not coverage.

## Decision provenance

The `1.0.0` → `1.1.0` move was **not** authorized by the repository owner. It was
selected under the owner's 2026-09-09 unattended-execution delegation and is
recorded as
`decision_source = "delegated to Claude by the owner, 2026-09-09; not a human owner decision"`.
It is not an exact-commit owner authorization and must not be cited as one.

An earlier revision of `proposal.md` stated that "the owner has now authorized"
the move. That statement was false and was corrected before merge. No gate reads
prose for a fabricated authorization; this one was caught by reading the record
against the issue's own history.

No human has reviewed this change. Green required checks are not review.

## What remains

- **#96** — making provenance mandatory and enforcing the derived-field trust
  floor is the *breaking major* step and is not authorized by anything here.
- **#423** — the contract declares `canonical_order: "code_point_ascending"` but
  both validators compare by UTF-16 code unit. The ratified requirement text says
  "code-point-sorted", so the implementations, not the specification, are the ones
  out of conformance.
- **#426** — a single documented list of the pins a contract version move must
  advance, so a fourth instance of the defect above is not discovered by CI.
