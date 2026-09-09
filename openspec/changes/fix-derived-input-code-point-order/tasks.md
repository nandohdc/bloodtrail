## 1. Governed planning and proposal delivery

- [x] 1.1 Generate and validate the design-pattern assessment for this security-sensitive validator correction; verify its classification, proposal baseline, closed owned-path inventory, and all required security dimensions cover both validator implementations, generated evidence, and no schema-version move.
- [x] 1.2 Record the required Contract Reuse Assessment against `security-audit@1.1.0` as reuse of the existing code-point-order mechanism; verify the current baseline passes and wrong-version/non-authoritative baseline controls still fail closed.
- [x] 1.3 Run `openspec validate fix-derived-input-code-point-order --strict`, assessment-phase design-pattern governance, and `git diff --check`; then commit only the active OpenSpec proposal packet with a Conventional Commit and verify the staged path allowlist and empty index after commit.
- [ ] 1.4 Push and merge a dedicated proposal PR for #423 only after all ten required contexts report success on its exact head; verify `origin/main` contains the unchanged proposal packet before implementation is committed.

## 2. Code-point conformance repair

- [ ] 2.1 Add focused canonical-validator controls for the UTF-16/code-point disagreement pair; verify code-point-descending `[U+10000, U+FF01]` reports `DERIVED_FROM_NONCANONICAL_ORDER` and the inverse reaches `DERIVED_FROM_UNRESOLVABLE_INPUT` without an order error.
- [ ] 2.2 Replace the canonical validator's relational comparison with bounded lexicographic code-point sequence comparison, generate the astral negative fixture and precise validation prose from the declared order, then run contract generation/checks and verify no generated artifact was hand-edited.
- [ ] 2.3 Add the same disagreement-pair controls through the SDK Core public validation boundary and implement the equivalent local comparator; verify both validators return identical outcomes while duplicate/order/resolution precedence remains unchanged.
- [ ] 2.4 Verify the canonical source, schema version `1.1.0`, public APIs, error vocabulary, dependency manifests, and unrelated generated projections are byte-unchanged; confirm this remains a patch-compatible implementation correction with no normalization or locale-dependent comparison.

## 3. Technical and governance verification

- [ ] 3.1 Run `npm run validate --prefix contracts/security-audit`, `npm run check:generated --prefix packages/security-audit-sdk-core`, and `npm run validate --prefix packages/security-audit-sdk-core`; verify all contract, generated-drift, runtime, compatibility, package, and fail-closed governance tests pass.
- [ ] 3.2 Run `make`, `openspec validate fix-derived-input-code-point-order --strict`, `openspec validate --all --strict`, implementation/final design-pattern governance, the governance dual check, and `git diff --check`; verify all five product workspaces and repository governance pass.
- [ ] 3.3 Reconstruct or mutate each validator independently to use UTF-16 relational comparison and verify the astral regression controls fail for the planted reason; record the exact candidate head/tree and bounded evidence without treating self-authored tests or green CI as independent review.

## 4. Governed delivery and lifecycle closure

- [ ] 4.1 Commit only the verified technical allowlist with a Conventional Commit, push the rebased implementation branch, and open a focused #423 PR using every required template section; verify the live PR path set and exact head match the frozen local candidate.
- [ ] 4.2 Merge the implementation PR with `--admin` only after rechecking the exact head, base, mergeability, ten-of-ten required contexts, and zero failing checks; verify the merge commit is reachable from `origin/main` before changing lifecycle artifacts.
- [ ] 4.3 Archive the completed `skip_specs` change by byte-preserving relocation in a dedicated PR, validate the archive and exact-head CI, then merge only when all required contexts succeed and close #423 with final evidence.
