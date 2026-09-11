## 1. Governed planning and assessment

- [x] 1.1 Record the owner's 2026-09-10 instruction as the authorization for #96 and every enforcement choice as delegated to Claude with `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"`; verify no artifact states or implies a human owner decision or an exact-commit authorization.
- [x] 1.2 Generate the full design-pattern assessment with exact owned paths and every security dimension justified, and record the Contract Reuse Assessment as an `extend` classified `major`; validate the packet with `openspec validate enforce-derived-field-trust-floors --strict`.
- [x] 1.3 Merge this proposal in its own PR with an exact green head before any governed implementation commit. — PR #476 merged as `57814810a902538003e2df46e3e30bc02b73633b` with all ten required contexts green on head `dc937576a62997ec9a7c1b11ccd3bdb24a9830e5`.

## 2. Canonical contract and enforcement

- [x] 2.1 Update only `contracts/security-audit/source/contract.source.json`: `2.0.0` metadata, the derived-output trigger, the transformation ceiling, the missing and trust-floor outcomes, and `derived_from` as conditional; verify no generated artifact is hand-edited.
- [x] 2.2 Implement the mandatory, ceiling, cycle, and floor rules in the contract validator and the SDK semantic kernel from the generated provenance block, with input trust read from the contract; add positive, boundary, and mutation arms for every outcome, including lowering one input's trust under an unchanged claim.
- [x] 2.3 Regenerate every contract artifact and fixture with provenance on every risk-bearing example, add negative fixtures for the missing, ceiling, floor, and risk-cycle outcomes, and verify contract validation and drift checks.

## 3. Exact SDK, collector, and gate transition

- [x] 3.1 Regenerate the Core projection; move Core and Node from `0.2.0` to `0.3.0` and bind both to exact `2.0.0`; verify `1.1.0` fails before readiness.
- [x] 3.2 Advance every pin in the version-move inventory, including the collector's supported set, packed probe, and compatibility manifest, and every current-tense statement the currency gate names.
- [ ] 3.3 Rebind `contract-provenance.json`, `check-contract-immutability.mjs`, and the cumulative governed candidate in `verification-lifecycle.json` and `check-changed-paths.mjs` to this change's technical commit.

## 4. Verification and delivery

- [ ] 4.1 Run `npm run validate` for the contract, Core, Node, and collector workspaces, the Core generated and compatibility checks, and record each result, naming any step delegated to CI.
- [ ] 4.2 Run strict OpenSpec validation, the assessment and final governance phases, the CRA loop over every active change, and `git diff --check`.
- [ ] 4.3 Open the implementation PR with the provenance and AI-not-approval statements; merge with a merge commit only when all ten required checks are green on the exact head.

## 5. Canonicalization and closure

- [ ] 5.1 Fold the four deltas into their canonical specifications in a dedicated PR, rebinding the governed candidate to the fold commit and moving the CRA pin to `security-audit@2.0.0`; verify the pin fails against a `1.1.0` baseline and passes against `2.0.0`.
- [ ] 5.2 Archive the change by byte-preserving relocation in its own PR; close #96 and tick it in #132 only after the archive merges.
