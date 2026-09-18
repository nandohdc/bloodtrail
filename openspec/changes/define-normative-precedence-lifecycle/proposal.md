## Why

Revision 3 made a correct fold possible but deliberately preserved one blocker. The authored source
`contracts/security-audit/source/contract.source.json` declares `schema_version` `2.1.0`, while the
current canonical `security-audit-event-contract` capability never states it. The archived change
`2026-09-11-add-client-evidence-capability` performed the governed additive `2.0.0` to `2.1.0` move
and carried three contract requirements that were never materialized into the canonical capability.
The resulting `candidate-a-current-capability-version-drift` debt blocks activation and release,
and at merge stage it blocks every change outside the governance-only path scope, including release
PR #537.

Materializing the missing text alone cannot clear the block. Revision 3's debt-continuity guard
fails closed when the historical contract-version debt disappears, and the closed pin-set schema
cannot record a retired debt. The active `software-design-pattern-governance` delta already states
that resolved debt is absent from the new current pin set, so the delta and its enforcement disagree
today. CB-018 is therefore a governed revision of this change that materializes the already-operative
`2.1.0` semantics and adds an authorized, substantiated, pinned debt-retirement transition to the
Revision 3 mechanism, without creating a new contract version.

This corrected revision is bound to the owner-reviewed CB-018 Revision 2 planning package plus the
sequencing-defect ruling that supersedes its impossible verification order:

```text
PROGRAM_ISSUE=CB-018
CHANGE_ID=define-normative-precedence-lifecycle
REVISION_PURPOSE=fold-operative-decisions-into-coherent-current-2.1-plus-specifications

BASE_HEAD=e1cc9f770160bb1f3d6c8e41b40260cab8fea3ad
BASE_TREE=054c5170c1630d343ca7292b9c7c0eabe652b53e
PACKAGE_SET_SHA256=fc9acef3002dbe0a41b5092f0494c00d002a60a7700d680591c0de1d92576ce4
MANIFEST_SHA256=5e866b74f4b19ffb740a084cc3a27a565ff41303676b60717b72bcf56f74862f
```

The correction package is stored in
`bloodtrail-assurance/candidate-b-remediation-program/cb-018-planning-package-r3/`. It preserves the
Revision 2 package as immutable predecessor evidence, records the abandoned authorization/process
identities `8daa2426…` and `d35cc744…`, names the exact three expected T2 stale-overlap bindings,
and mechanically re-derives the same 19 implementation scope paths with no T3-only twentieth path.
The package-set digest is the SHA-256 of the UTF-8 lines `<sha256>  <filename>\n` for its two numbered
artifacts in byte order. The manifest digest is the SHA-256 of `cb-018-artifact-manifest.json`.

The project-owner sequencing ruling confirms that the old order was internally inconsistent and
authorizes this planning correction only. It withdraws implementation authority from `d35cc744…`.
It is not a signed implementation or debt-resolution authorization and grants no governed-candidate
handover, fold, merge, activation, release, archive, CB-002, or CB-019 authority.

## What Changes

- Materialize four already-operative `2.1.0` decisions into the canonical
  `security-audit-event-contract` capability: OD-1 the governed `2.0.0` to `2.1.0` current-version
  statement, and OD-2 through OD-4 the three archived client-evidence requirements copied
  byte-for-byte. The exact resolving canonical object is frozen as blob
  `487a4f066afa74696411ee782b0008673fd6ca14`. This is materialization, not a new contract version.
- Add the canonical debt-resolution grant `resolve-contract-version-semantic-drift` and a distinct
  `RESOLVE_DEBT` operation. It is independent of merge, fold, activation, release, and archive
  authority, and no one of those implies another. The closed policy schema gains the grant as a
  required property so the policy stays schema-valid; nothing else in that schema changes.
- Extend the closed pin-set schema with an optional closed `retired_debts` record. A debt is retired
  only when its exact lineage, prior and resolving objects, substantiated re-evaluation, and current
  signed `RESOLVE_DEBT` authorization are all mechanically established and carried by a new pin.
  Otherwise `contract-version-boundary-violation` or a more specific retirement diagnostic still
  fails closed.
- Hand the SDK Core `contract.governedCandidate` from `add-client-evidence-capability` to this change
  under the existing cumulative protected-path model, and advance the contract immutability baseline
  to the exact materialization commit. Contract source, generated contract artifacts, and SDK
  generated output stay byte-identical.
- Treat T2 as the frozen authorization-input identity. Permit exactly three named stale-overlap
  diagnostics there, stop for a separately owner-signed `RESOLVE_DEBT` authorization, create the
  retirement and current pre-fold pin at T3, and perform final verification only after T3 removes
  every stale-overlap diagnostic.
- Re-anchor `MUT-R3-008` without changing its purpose, and add eleven CB-018 mutants with eleven
  property-matched negative controls, for 33 mutants and 33 controls. Add one SDK Core protected-path
  control in the suite that reaches `check-changed-paths.mjs`.
- Leave all three active deltas unfolded. Fold, activation, and release remain separately governed.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `change-governance`: Unchanged by CB-018. Its authority-separation, immutable-pin, per-change
  authorization, and fold-transition requirements are consumed as written.
- `software-design-pattern-governance`: Add one requirement making retirement of blocking semantic
  debt an authorized, exact-object-bound, lineage-continuous, substantiated, and pinned transition.
- `security-audit-event-contract`: The active delta is unchanged. CB-018 separately materializes the
  archived `2.1.0` requirements into the canonical capability under the protected-path handover,
  classified by the existing contract-reuse assessment as `reuse` of `security-audit@2.1.0` with no
  compatibility classification.

## Impact

- Planning only. This proposal identity changes no canonical capability, policy, schema, checker,
  pin set, authorization record, lifecycle state, SDK Core file, contract artifact, or generated
  output.
- Future implementation touches governance-core policy, schemas, checker modules, pins, and tests
  under `openspec/`, the protected canonical contract capability, and four SDK Core handover files.
  Every path, stage, class, and reason is enumerated in `design.md`; mechanical re-derivation confirms
  T3 uses the same 19 authorization scope paths and introduces no twentieth path.
- The later canonical fold of the three active deltas will write the protected contract capability
  again and will need its own governed-candidate advance. That is outside this revision.
- Release PR #537 is not part of CB-018. `version.txt`, `CHANGELOG.md`, and
  `.release-please-manifest.json` are not modified, and the inherited merge allowlist is not widened.
  If legitimate debt resolution later unblocks #537, it is reviewed again as its own state.
- OD-5, the assessment-scaffolding requirement lost to an `R16` identifier collision, is excluded
  and tracked as a separate defect.

Refs #531, #533.
