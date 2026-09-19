# Tasks: Sequential Authorization Lifecycle Correction (R5)

This task breakdown is bound to external evidence package set
`19fcf60430d37aa13d752620cf17b8b17533037bbc257db7795b5c05000ae128` and manifest
`d5378b6e60319dfb5103edae70e17aa26cb15f121e59f22969fb6bfe0d809c2e` under
`bloodtrail-assurance/candidate-b-remediation-program/cb-018-planning-package-r5/`.

## 1. Planning Freeze & Owner Proposal Authorization (Current Phase)

- [ ] 1.1 Complete and verify the 16 planning evidence artifacts, `artifact-manifest.json`, and dual-stack checksums.
- [ ] 1.2 Author the OpenSpec change delta artifacts (`.openspec.yaml`, `proposal.md`, `design.md`, `spec.md`, `tasks.md`, `assessment.json`).
- [ ] 1.3 Validate pre-R5 discovery bootstrap compatibility and run strict OpenSpec validation (`openspec validate --all --strict`).
- [ ] 1.4 Present the complete R5 Freeze Report for project owner exact-content review and halt for authorization.

## 2. Implement Sequential Authorization Mechanism (Locked 8 Paths)

- [ ] 2.1 Update `openspec/governance/schemas/change-authorization.schema.json` to define optional closed `supersession` object; verify zero-byte impact on existing historical authorizations.
- [ ] 2.2 Implement dedicated sequential authorization module `openspec/scripts/normative-precedence/sequential-authorization.mjs` handling graph traversal, cycle/fork detection, 11 supersession preconditions, and unique leaf derivation.
- [ ] 2.3 Integrate sequential authorization engine into `openspec/scripts/normative-precedence/authorization-discovery.mjs` to derive effective terminal leaf across repository authorizations.
- [ ] 2.4 Update `openspec/scripts/normative-precedence/model.mjs` to implement discrete half-open intervals $(C_A, P_B]$ and $(C_B, \text{HEAD}]$, dedicated 1-path commit exemptions, and operation-aware commit attribution (`RESOLVE_DEBT` immunity).

## 3. Implement Verification Controls & Mutants

- [ ] 3.1 Implement 14 repository tests and 25 negative controls in `openspec/tests/design-pattern-governance/normative-precedence-sequential-authorization-controls.mjs`.
- [ ] 3.2 Update `openspec/tests/design-pattern-governance/fixtures/normative-precedence/revision-3-negative-controls.json` with `NC-SEQ-001` through `NC-SEQ-025`.
- [ ] 3.3 Update `openspec/tests/design-pattern-governance/fixtures/normative-precedence/revision-3-mutants.json` with `MUT-SEQ-001` through `MUT-SEQ-014`.
- [ ] 3.4 Integrate new controls and mutants into `openspec/tests/design-pattern-governance/mutation-assurance.test.mjs`.

## 4. Mechanism Verification & Exact-Content Review

- [ ] 4.1 Run full governance test suites and strict OpenSpec validation against the mechanism implementation.
- [ ] 4.2 Execute complete 47-mutant campaign requiring `EXPECTED=47`, `APPLIED=47`, `KILLED=47`, `NOT_APPLIED=0`, `SURVIVED=0`.
- [ ] 4.3 Freeze mechanism commit and obtain project owner exact-byte review.

## 5. T3 Integration & Post-T3 Fixture Repair

- [ ] 5.1 Execute clean two-parent merge commit $M_{\text{int}}$ (`Parent 1 = T3`, `Parent 2 = Mechanism Head`) preserving T3 first-parent lineage.
- [ ] 5.2 Draft newly bound successor authorization for CB-018 post-T3 repair, perform exact-byte review, and obtain owner SSH signature.
- [ ] 5.3 Commit signed successor authorization in dedicated 1-path commit $C_B$.
- [ ] 5.4 Apply the rehearsed 2-file fixture repair in the successor interval $(C_B, \text{HEAD}]$.
- [ ] 5.5 Execute final CB-018 verification suite proving all gates pass closed-to-open.
