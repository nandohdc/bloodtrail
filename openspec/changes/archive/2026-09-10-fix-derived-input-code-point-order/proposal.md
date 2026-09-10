## Why

The `1.1.0` contract and its ratified requirement define `derived_from` ordering by Unicode code
point, but the canonical and SDK validators compare JavaScript UTF-16 code units. The mismatch is
observable for astral characters and lets the reference implementations reject a conforming
producer while accepting the reverse order, so issue #423 needs a coordinated conformance repair.

## What Changes

- Replace UTF-16 relational string comparisons in both semantic validators with deterministic,
  locale-independent lexicographic comparison over Unicode code points.
- Generate an astral-character negative fixture that fails only when the wrong ordering is admitted,
  and exercise the inverse, conforming order as a positive control in both validator suites.
- Generate precise reimplementation guidance in `docs/validation.md` from the canonical source's
  declared order, failing generation if the declaration lacks matching documentation.
- Rebind the frozen-contract provenance, compatibility, checker literals, and lifecycle inventory to
  the exact technical correction commit by extending the existing cumulative candidate history,
  without weakening the protected-path boundary or obscuring the six-path correction delta.
- Re-derive, rather than relax, every package gate constant the comparator moves, including the
  pinned platform-coupling reference count, and declare each such control in the owned-path
  inventory.
- Treat this as a patch-compatible implementation correction: the published `1.1.0` meaning and
  accepted-data contract do not change, and no schema-version move is made.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. `security-audit-event-contract` already requires unique, code-point-sorted paths and rejection
of lists outside code-point order. This change makes the two implementations and generated evidence
conform to that requirement; `.openspec.yaml` therefore declares `skip_specs: true` rather than
inventing a redundant requirement delta.

## Impact

- Canonical generator and validator under `contracts/security-audit/scripts/`.
- Generated contract validation documentation and negative fixtures under
  `contracts/security-audit/docs/` and `contracts/security-audit/examples/negative/`.
- SDK Core semantic validation under `packages/security-audit-sdk-core/src/validation/` and focused
  runtime tests in both affected workspaces.
- SDK Core contract-provenance, compatibility, coherence, immutability, changed-path, lifecycle, and
  explanatory binding metadata needed to admit only the named protected-contract candidate.
- No public field, type, event, error code, dependency, package boundary, schema version, delivery
  behavior, persistence behavior, production deployment, or real-user processing changes.
