# ADR 0007: Support exactly one contract version per SDK package version

- Status: Accepted
- Date: 2026-08-23
- Decision owners: Project owner

## Context

The SDK candidate already projects and validates one exact canonical Security Audit Event Contract version. Its compatibility manifest names contract `1.0.0`, generated public types and the generated validator are exact projections of that contract, and construction rejects every other version before readiness. The canonical SDK capability did not yet make that cardinality an enduring policy, and the migration guide instructed a future adaptation to reopen whether one package version could support two contract versions.

Two policies were available:

- `EXACT_ONE`: each SDK package version supports exactly one canonical contract version across the complete compatibility surface.
- `EXPLICIT_SET`: each SDK package version supports a finite declared set of canonical contract versions, requiring multi-version generated projections or a weaker union/discriminated public API plus generator, compatibility, and runtime changes.

The package is private and unpublished, no second canonical contract version exists, and no collector exists or is authorized. `EXPLICIT_SET` would therefore add immediate implementation and verification complexity without a current migration need.

## Decision

Adopt `EXACT_ONE`. Each SDK package version has exactly one outgoing support relation to a canonical contract version. The relation is many-to-one rather than bijective: several SDK package versions may support the same canonical contract version, but one SDK package version does not support several canonical contract versions.

The support relation owns one indivisible compatibility surface:

- the compatibility manifest;
- generated public types;
- the generated validator projection;
- the construction-time contract-version check; and
- event-validation semantics.

Exact-version instance binding is a construction invariant. A producer SDK instance can become ready only for the contract version supported by its package version. Every other version fails before readiness; the SDK does not negotiate, coerce, downgrade, fall back, apply a best-effort interpretation, or switch versions after construction.

Replacing the sole supported-contract baseline is SDK compatibility-major even when the canonical change is additive and contract-minor. These are separate version axes. Generated type incompatibility is an additional breaking trigger when it occurs, not the universal rationale. While the package remains private and unpublished in `0.x` initial development, any separately authorized release expresses the major classification through the project's `0.x` policy rather than forcing `1.0.0`; the first published release inherits the classification, and from `1.0.0` onward baseline replacement requires an SDK major. This decision does not authorize a release, version bump, or publication.

A separately authorized collector MAY support an explicitly enumerated finite set of canonical contract versions for migration. That allowance does not broaden producer package support or producer-instance binding. It creates no collector, transport, storage, queue, production integration, publication, or real-user processing authority.

Reconsider `EXPLICIT_SET` only when both a second canonical contract version and an authorized collector exist. Either condition alone is insufficient, and reconsideration requires a new governed change.

## Consequences

- Current runtime behavior, generated output, compatibility values, package version, and the frozen contract remain unchanged.
- Future producer adaptations replace one supported baseline with another instead of retaining both in one package version.
- An additive contract-minor adaptation remains contract-minor for the contract and is compatibility-major for the SDK package.
- `compatibility.json`, generated projections, construction, validation, ADR-SDK-009, and migration guidance must remain coherent about the one supported version.
- Dependent issue #76 can be evaluated against exact-one behavior rather than opening a multi-version implementation.
- Collector migration remains an optional future asymmetry under separate authorization, not part of this implementation.

## Alternatives considered

### Adopt `EXPLICIT_SET` now

Rejected. It would require multiple generated type and validator projections or a weaker public union, plus generator, compatibility, runtime, and verification changes. The package has no present second-version migration to serve, so those costs and ambiguity would be immediate while their benefit is hypothetical.

### Record the choice only in ADRs

Rejected. ADRs explain the decision but do not close the normative capability gap. The SDK capability must own the rule, and migration guidance must apply rather than reopen it.

### Require collectors to support multiple versions

Rejected. No collector exists or is authorized. A collector `MUST` would claim implementation scope and production authority this decision does not grant.

## Assurance limitations

This ADR ratifies package compatibility policy for an isolated technical candidate. It does not approve a new contract version, package release, production deployment, application integration, collector, transport, storage, SIEM integration, analytics, detection, framework instrumentation, browser telemetry, real-user processing, or legal compliance.
