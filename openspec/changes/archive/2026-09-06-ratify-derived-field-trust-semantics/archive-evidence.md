# Archive Evidence — ratify-derived-field-trust-semantics

Explicit archive validation record (R24) for the archive relocation of the `ratify-derived-field-trust-semantics` change into `openspec/changes/archive/2026-09-06-ratify-derived-field-trust-semantics/`.

Archive validation is explicit and is not assumed from `openspec validate --all --strict` (R24).

## Task completeness

- **1.1** (Proposal) — checked. Proposal PR #347 merged at commit `c1c6936`; the packet (`proposal.md`, `design.md`, the `derived-field-trust-semantics` delta spec, `tasks.md`, `assessment.source.json` and generated `assessment.json`) touched only paths under `openspec/changes/ratify-derived-field-trust-semantics/` — no `contracts/` path, no `packages/` path, no generated artifact, no workflow.
- **1.2** (Decision completeness) — checked. Materiality (counterfactual definition), ordering (total order, `unknown` as floor), duplicate, unknown-field, and transitive rules are each stated normatively in the delta spec; the maximum-output-trust function is deterministic and worked through (`min( input floor, transformation ceiling )`, design section 6); the compatibility and version treatment is recorded (two contract version moves, design section 7); one invalid-provenance and one excessive-output-trust example each carry a single named deterministic outcome (design section 8).
- **1.3** (Decision provenance) — checked. The verbatim provenance string `delegated to Claude by the owner, 2026-09-06; not a human owner decision` is recorded in the capability, and the capability states in its own text that it authorizes no implementation.
- **2.1** (Scope boundary) — checked. No contract version move: `contracts/security-audit/` untouched, the frozen `1.0.0` unchanged, no generated artifact under `packages/security-audit-sdk-core/src/generated/` moved, and `check:generated` reports no drift.
- **2.2** (Compatibility consequence recorded, not performed) — checked. The two-step consequence (additive optional introduction at a minor contract version; mandatory enforcement at a major one, each carrying an SDK package version step) is recorded in the capability and neither step is taken by this change.
- **2.3** (Assurance limitation) — checked. The capability records that the semantics bound what a declared input set implies and do not establish that a producer enumerated its material inputs honestly.
- **3.1** (Validation) — checked. `openspec validate --all --strict` passed 12/12 at proposal and 13/13 after the canonical fold.
- **3.2** (Governance checks) — checked. `check-design-pattern-governance.mjs --phase assessment` passed; `run-governance-dual-check.mjs` passed; the contract-reuse loop passed over every active change (`ratify-derived-field-trust-semantics`, `version-the-sanctioned-merge-gate`) with approved skips.
- **4.1** (Canonical fold) — checked. Fold PR #350 applied the delta into the new canonical capability `openspec/specs/derived-field-trust-semantics/spec.md` while the change was still active, at commit `925a8b1`; requirement bodies verified byte-identical to the delta, no delta header reached the canonical spec, and a second application of the delta is a no-op.
- **4.2** (Archive) — checked. Byte-preserving archive relocation commit into `openspec/changes/archive/2026-09-06-ratify-derived-field-trust-semantics/`; does not repeat the fold and does not touch `openspec/specs/**`.
- Issue #94 closure is a separate reconcile step performed after archive completion.

## Lifecycle bindings

| Phase | PR | Merged Commit | Notes |
| --- | --- | --- | --- |
| Proposal | #347 | `c1c6936` | `docs(openspec): propose ratify-derived-field-trust-semantics (#94)` |
| Canonical fold | #350 | Pending | `docs(openspec): fold ratify-derived-field-trust-semantics delta into derived-field-trust-semantics (#94)` at content commit `925a8b1` |
| Archive | Pending PR | Pending | Byte-preserving archive relocation |

## Canonical capability materialization

The canonical capability specification carries this change's requirements, materialized by fold PR #350 at commit `925a8b1`:

- `openspec/specs/derived-field-trust-semantics/spec.md` — new canonical capability with nine requirements: total trust order with `unknown` as floor; counterfactual material-input definition with exhaustive listing; provenance as a set with code-point-sorted canonical serialization; malformed provenance rejected with distinct named outcomes rather than normalized; one-hop provenance with transitive trust evaluation; deterministic maximum-output-trust floor (input floor and transformation ceiling); two contract version moves recorded but not performed; decision provenance and assurance limitation recorded; revisit conditions.

This archive relocation commit does not touch `openspec/specs/**`.

## Production and publication restrictions

This archive commit touches no implementation, package manifest, CI workflow, release configuration, or generated artifact. It does not authorize package publication, production deployment, production collection, real-user processing, or enforcement of the ratified semantics.

## Immutable archive contents

Byte-identical from the active change into the archive:

- `.openspec.yaml`
- `proposal.md`
- `assessment.json`
- `assessment.source.json`
- `design.md`
- `specs/derived-field-trust-semantics/spec.md`
- `tasks.md`

`archive-evidence.md` is added.
