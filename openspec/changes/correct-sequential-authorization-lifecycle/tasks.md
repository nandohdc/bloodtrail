# Tasks: Sequential Authorization Lifecycle Correction (R5)

This task breakdown was first bound to external evidence package set
`19fcf60430d37aa13d752620cf17b8b17533037bbc257db7795b5c05000ae128` and manifest
`d5378b6e60319dfb5103edae70e17aa26cb15f121e59f22969fb6bfe0d809c2e` under
`bloodtrail-assurance/candidate-b-remediation-program/cb-018-planning-package-r5/`. It is now bound to the
re-frozen package set `a865a92bb46c68456adbc7616ff1a85cfac2338f706326515bfa54374392e410` and manifest
`d6ce8cc3f3b0e1fca0c670502cae75bcb75a0f98f2b38437f39c2695a82a2cae` under
`bloodtrail-assurance/candidate-b-remediation-program/cb-018-sequential-authorization-refreeze-r2/`
(re-frozen against `main` at `691aa69`; owner decisions on #972).

## 1. Planning Freeze & Owner Proposal Authorization (Current Phase)

- [x] 1.1 Complete and verify the 16 planning evidence artifacts, `artifact-manifest.json`, and dual-stack checksums.
- [x] 1.2 Author the OpenSpec change delta artifacts (`.openspec.yaml`, `proposal.md`, `design.md`, `spec.md`, `tasks.md`, `assessment.json`).
- [ ] 1.3 Validate pre-R5 discovery bootstrap compatibility on the owner-signed root record, and run OpenSpec validation: `openspec validate --all` passes and `openspec validate --all --strict` reports no ERROR-level issue (its long-requirement warnings fail strict mode on `main` today).
- [x] 1.4 Present the complete R5 Freeze Report for project owner exact-content review and halt for authorization. Superseded by 1.5: the R5 report itself was never reviewed; the owner decided on the re-frozen plan instead.
- [x] 1.5 Re-freeze the plan against current `main`, record the owner's decisions of 2026-11-22 on #972, and rebind this change to the re-frozen package. The former group-5 tasks for a successor authorization, its dedicated commit and the post-T3 fixture repair are discharged: the repair landed in #572 under the signed Option A restoration authority.
- [ ] 1.6 Land the owner's signed root `IMPLEMENT` authority for this change as a dedicated one-path commit through its own PR, after this planning revision and before the implementation branch is cut. The record binds `change-governance` in `authorized_capabilities` and `authorized_delta_objects`, together with the base, proposal and change-subtree identities. A dry run shows this change's delta authorized before the owner signs. The PR lands by merge commit with the signed commit unchanged (no squash, rebase-merge or rebase; if `main` moves first, rebuild and re-sign), and it passes the merge-gate verifier, extended to check those bindings.

## 2. Implement Sequential Authorization Mechanism (Locked 8 Paths)

- [ ] 2.1 Update `openspec/governance/schemas/change-authorization.schema.json` to define optional closed `supersession` object; verify zero-byte impact on existing historical authorizations.
- [ ] 2.2 Implement dedicated sequential authorization module `openspec/scripts/normative-precedence/sequential-authorization.mjs` handling graph traversal, cycle/fork detection, 11 supersession preconditions, and unique leaf derivation.
- [ ] 2.3 Integrate sequential authorization engine into `openspec/scripts/normative-precedence/authorization-discovery.mjs` to derive effective terminal leaf across repository authorizations.
- [ ] 2.4 Update `openspec/scripts/normative-precedence/model.mjs` to implement discrete half-open intervals $(C_A, P_B]$ and $(C_B, \text{HEAD}]$, dedicated 1-path commit exemptions, and operation-aware commit attribution (`RESOLVE_DEBT` immunity), with production scope evaluation calling the attribution and the interval evaluator themselves and no path-prefix exemption (correction C1).

## 3. Implement Verification Controls & Mutants

- [ ] 3.1 Implement all 14 repository tests, `SEQ-T004` included (correction C2), and 25 negative controls in `openspec/tests/design-pattern-governance/normative-precedence-sequential-authorization-controls.mjs`.
- [ ] 3.2 Update `openspec/tests/design-pattern-governance/fixtures/normative-precedence/revision-3-negative-controls.json` with one killing control row per new mutant, keeping the runner's one-to-one pairing (correction C3).
- [ ] 3.3 Update `openspec/tests/design-pattern-governance/fixtures/normative-precedence/revision-3-mutants.json` with the mutant catalog re-derived from the implemented bytes, including mutants for the C1 wiring, keeping `MUT-R3-005` and `MUT-R3-008` on `main`'s current anchors (correction C4).
- [ ] 3.4 Integrate new controls and mutants into `openspec/tests/design-pattern-governance/mutation-assurance.test.mjs`.

## 4. Mechanism Verification & Exact-Content Review

- [ ] 4.1 Run full governance test suites and OpenSpec validation against the mechanism implementation, plus a checker-level differential: the pre-implementation checker against the implemented checker over a fixed set of historical ranges (T3, the four Option A restoration PRs and current `main`), showing that no reading changes except those correction C1 intends.
- [ ] 4.2 Execute the complete re-derived campaign of N ≥ 47 mutants, requiring `EXPECTED=N`, `APPLIED=N`, `KILLED=N`, `NOT_APPLIED=0`, `SURVIVED=0`, with `R3-T031`, `R3-T033` and `R3-T034` asserting N.
- [ ] 4.3 Freeze mechanism commit and obtain project owner exact-byte review.

## 5. Integration

- [ ] 5.1 Land the implementation from a branch cut from current `main` through a merge commit, rebuilding and re-reviewing the head if `main` moves after the exact-content review, and assert `git merge-base --is-ancestor 1021b776331f9268578ea1fd21727521be353182` against the integrated head.
- [ ] 5.2 Run the final verification suite and the merge-gate verifier on the integrated `main`, proving every gate passes.
