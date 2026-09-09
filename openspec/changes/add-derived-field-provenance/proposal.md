## Why

Derived values currently carry a declared trust level but no machine-readable account of the fields
that materially determined them. That makes an independently reproducible trust-floor calculation
impossible and lets a consumer distinguish neither a truthful derivation from an incomplete one nor
an intentionally unprovenanced value from a non-derived value.

The ratified `derived-field-trust-semantics` capability defines the closed semantics. The owner has
now authorized the narrowly additive contract move required to encode those semantics: contract
`1.0.0` to `1.1.0`. This change is the first of the two planned version steps; it does not make
provenance mandatory or enforce the derived-field trust floor.

## What Changes

- Add optional `derived_from` material-input provenance for declared derived fields to the sole
  authored security-audit contract source, with the ratified set, canonical-order, resolution, and
  rejection semantics.
- **BREAKING for exact-version consumers:** advance the canonical contract from `1.0.0` to `1.1.0`
  and replace each private SDK's sole supported-contract baseline with `1.1.0`, taking the
  compatibility-major package version step required by the exact-one support policy.
- Regenerate every committed contract, schema, registry, documentation, and SDK projection from
  canonical sources; do not hand-edit generated artifacts.
- Add deterministic compatibility fixtures covering valid, absent, malformed, duplicate, unknown,
  unresolved, and unordered provenance input lists, and update contract-provenance and
  changed-path governance bindings in the same governed change.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-event-contract`: represent optional material-input provenance for derived fields,
  validate its closed structural and semantic rules, and declare the `1.1.0` compatibility boundary.
- `security-audit-sdk-core`: replace its exact contract baseline and candidate identity with the
  governed `1.1.0` projection.
- `security-audit-sdk-node`: keep its private candidate identity and first-party Core projection
  aligned with the governed contract-version transition without changing its frozen export surface.

## Impact

- Affected canonical source and generated artifacts: `contracts/security-audit/`.
- Affected private SDK projections and compatibility bindings:
  `packages/security-audit-sdk-core/` and `packages/security-audit-sdk-node/`.
- Affected governance record: the narrowly scoped contract immutability and changed-path binding in
  `packages/security-audit-sdk-core/verification-lifecycle.json`.
- No runtime delivery, persistence, browser evidence, trust-floor enforcement, package publication,
  production deployment, or real-user collection is authorized by this change.
