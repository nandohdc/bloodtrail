# Proposal — ratify-derived-field-trust-semantics

Ratify the material-input and trust-floor semantics for derived contract fields, as a decision.

## Why

The canonical contract already carries a seven-level `trust_levels` registry and assigns a `trust`
to every field, including `derived_server` for fields a producer computes rather than observes. What
it does not carry is a governed answer to the question those levels imply: **when a field is derived,
what may its trust be?**

The roadmap requires `derived_from` provenance (PLAN-043) and a trust ordering and floor over
material derivation inputs (PLAN-044), and leaves materiality, ordering, duplicates, unknown fields,
and transitive derivation as explicit open decisions (#94). Until they are decided, every one of them
has a plausible-looking default that is wrong in the same direction:

- Deduplicating a repeated input silently hides a producer defect.
- Treating an unresolvable input as `unknown` lets a typo change a field's trust.
- Reading `derived_from` as an ordered list invites consumers to infer a precedence that no producer
  promised.
- Computing output trust from anything but the least-trusted material input lets a derivation
  manufacture assurance it does not have.

The last one is the security property the whole feature exists for: **omitting a material low-trust
input must not be a way to raise trust.** A decision is what makes that mechanical later; without it,
enforcement would be written against an unstated model.

This change is a **decision only**. It changes no schema, no generated validator, and no field. It
records what the semantics will be, and what moving to them will cost.

`decision_source = "delegated to Claude by the owner, 2026-09-06; not a human owner decision"`. It is
a delegated technical decision, not a human owner sign-off, and it is not exact-commit owner
authorization for any implementation.

## What Changes

Adds one capability, `derived-field-trust-semantics`, recording:

- **A total trust order** over the existing seven registry values, with `unknown` as the floor rather
  than a middle value, so that an unclassifiable input degrades the output rather than being ignored.
- **Materiality by counterfactual**: an input is material exactly when the derived value could differ
  had that input differed. Every material input is listed; a non-material one is not.
- **`derived_from` is a set, not a sequence.** Order carries no meaning and is canonically serialized
  sorted by code point, matching the repository's existing determinism rule.
- **Duplicates, unresolvable paths, absent paths, cycles, and an empty set on a derived field are
  each rejected**, with a distinct outcome for each — never normalized away.
- **One-hop provenance, transitive trust**: a field records its immediate material inputs, and the
  floor is computed over the transitive closure resolved inside the same event.
- **A deterministic maximum-output-trust function**: the minimum of the least-trusted material input
  in the closure and the ceiling the transformation's own authority supports. No transformation
  raises trust.
- **The compatibility consequence**: the contract is frozen at `1.0.0`, so introducing `derived_from`
  is an additive minor move and making it mandatory for derived fields is a breaking major move —
  two version steps, not one, each carrying an SDK package version step with it.
- **What the decision does not establish**: that producers enumerate their inputs honestly. The
  semantics bound what a *declared* set implies; they cannot prove the declaration complete.

## Capabilities

- `derived-field-trust-semantics`: the ratified materiality, ordering, duplicate, unknown-field,
  transitive-derivation, and trust-floor semantics for derived contract fields, with the decision
  provenance, the compatibility treatment, the worked examples, and the revisit conditions.

## Impact

- Affected code: none. This change adds `openspec/specs/derived-field-trust-semantics/spec.md` by
  fold and its own change directory; it touches no package, no contract artifact, and no workflow.
- The contract stays frozen at `1.0.0`. Nothing here moves a version, and closing #94 authorizes no
  implementation: #95 and #96 remain blocked on their own prerequisites and owner authorization.
- Out of scope: changing contract schemas or generated validators, implementing trust-floor
  enforcement, and authorizing work before prerequisite governance is complete.
