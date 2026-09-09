## Context

The current canonical source has one derived server result: the `risk` result whose model
provenance declares `risk.model.provenance.trust_level`. It has no representation of the inputs
material to that result. The derived-field semantics capability has already ratified materiality,
set semantics, code-point ordering, strict rejection, and the two version steps. See
`proposal.md` and the `derived-field-trust-semantics` capability for the normative rationale.

The contract is generated from `contracts/security-audit/source/contract.source.json`; its schema,
catalog, registries, policy, documentation, examples, and SDK generated surfaces are committed
projections. The SDK version-support policy permits exactly one canonical contract version for an
SDK package version. The existing immutability and changed-path gates deliberately pin `1.0.0` and
therefore must move as part of the same governed change rather than be bypassed.

## Goals / Non-Goals

**Goals:**

- Represent bounded, optional, canonical material-input paths for the existing derived risk result.
- Reject every invalid declared provenance shape deterministically and without normalization.
- Make the `1.1.0` contract move, generated projections, private SDK compatibility-major package
  moves, and gate bindings one coherent candidate.

**Non-Goals:**

- Make provenance mandatory, calculate a derived trust floor, or enforce a field's output trust.
- Add a general graph language, cross-event inputs, a new extension, delivery behavior, persistence,
  browser evidence, package publication, or production authorization.

## Decisions

### D1 — Scope provenance to the existing derived risk result

`risk.model.provenance.derived_from` is the only new authored field. It sits beside the existing
derived-trust declaration rather than introducing a free-floating event-wide provenance registry.
That gives one unambiguous subject for the `derived_from` paths and lets the contract validate the
entire graph within a single event.

The alternative, an event-wide map keyed by arbitrary field path, would nominally serve future
derived values but creates an open address space, unclear ownership for absent fields, and a larger
cycle surface without a current producer. The alternative of making each risk subfield carry an
independent list duplicates one model's input set and permits contradictory declarations.

### D2 — Validate declared paths in the canonical runtime boundary

The generator will add the optional array's structural schema and emit the same bounded field
metadata into every projection. The canonical validator will additionally perform the semantic
checks JSON Schema cannot express: code-point order, duplicates, field/registered-extension
resolution, in-instance presence, `derived_server` association, non-empty declared sets, and
self/cycle exclusion. It will emit one closed error code per rejected condition.

The alternative of schema-only validation cannot distinguish a known-but-absent field from an
unknown one, enforce canonical ordering, or detect a cycle. The alternative of normalizing input
lists would collapse materially different producer states and violates the ratified fail-closed
semantics.

### D3 — Preserve optionality now; defer enforcement to #96

`derived_from` is optional in `1.1.0`, including for current derived risk events. When supplied it
must be complete and valid; when absent it is not fabricated. This isolates the additive contract
representation from the next breaking move that will require it and calculate/enforce trust floors.

The alternative of requiring it now makes old valid derived events invalid and is therefore the
major move explicitly assigned to #96. The alternative of accepting malformed declarations as
unknown quietly manufactures a trust result from an invalid producer claim.

### D4 — Replace the exact SDK support baseline

The canonical contract moves to `1.1.0`; each private SDK package moves from `0.1.0` to `0.2.0`
under the project's pre-1.0 compatibility-major policy, and the Core package supports exactly
`1.1.0`. Contract minor and SDK compatibility-major are distinct axes: the optional field is
backward compatible at the contract level, while replacing a public SDK contract-version literal
makes the SDK's prior configuration incompatible.

The alternative of accepting both versions in one SDK violates the ratified exact-one policy and
would require multiple generated projections or a union public API. The alternative of changing
only metadata lets runtime version checks and generated artifacts drift.

### D5 — Rebind, do not disable, the frozen-contract gates

After the proposal packet is merged, the governed implementation will update
`contract-provenance.json` with `1.1.0`, the new canonical target, and the proposal baseline, then
update the matching literals in the immutability checker. The changed-path lifecycle record will
bind a closed inventory of protected paths to the exact technical candidate content. The checker
will accept those paths only while their current blobs match that named candidate and will retain
rejection for any undeclared or byte-different protected write.

The alternative of removing the literal or protected prefix creates a generic escape from the
frozen-contract boundary. The alternative of leaving the old bindings makes the authorized change
impossible and gives no binding for the new contract.

### D6 — Resolve Contract Reuse Assessment mechanisms at the reviewed baseline

An `extend` CRA establishes that a proposed change relates to the contract presented for review.
Its mechanism references therefore resolve from the exact PR range baseline, not from the mutable
candidate source that the change is intentionally allowed to version. The CRA checker will read the
authoritative source blob at that baseline and continue to require the closed `security-audit@1.0.0`
record and resolvable mechanism references. Regression controls will prove both that an authorized
`1.0.0` to `1.1.0` transition remains CRA-valid and that a non-authoritative baseline fails closed.

The alternative of evaluating the candidate source makes every contract-version transition
self-invalidating. The alternative of skipping CRA for versioned changes removes the independent
reuse/extend decision and would create an unbounded exception.

## Risks / Trade-offs

- [An optional field is mistaken for a completed trust-floor guarantee] → Generated docs, fixtures,
  and the capability state that absence has no inferred provenance and #96 remains unimplemented.
- [A path leaks unbounded caller input in diagnostics] → Validators return only closed error codes
  and bounded field paths; tests assert unsafe input is never echoed.
- [One source version drifts from an SDK or generated artifact] → Generation, drift, compatibility,
  contract, core, node, and governance-gate validation run against the exact candidate head.
- [The gate rebinding becomes a broad exception] → The lifecycle record binds the named candidate
  and exact content inventory; tests retain negative cases for unrelated or byte-different contract
  edits.
- [A version transition invalidates its own CRA] → Mechanism resolution reads the exact reviewed
  baseline blob, while regression controls preserve baseline-authority rejection.

## Migration Plan

Before merge, the change is wholly reversible by dropping its branch. Once merged, consumers move
by selecting the SDK `0.2.0` package candidate and declaring contract `1.1.0`; a producer that does
not use provenance remains valid under the `1.1.0` contract. A consumer that must remain on `1.0.0`
uses its existing `0.1.0` SDK projection; the new projection does not negotiate a downgrade.

The next move that makes provenance mandatory or calculates trust floors is not a rollback and must
be proposed as #96 with its own major contract version, migration guidance, and authorization.
