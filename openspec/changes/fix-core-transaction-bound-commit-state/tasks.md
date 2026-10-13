# Tasks — issue #797

Issue: https://github.com/nandohdc/bloodtrail/issues/797

Check tasks only after execution. Preserve planning-before-implementation ordering and the proposal baseline. No approval, production authorization or remote CI result is claimed.

## 1. Planning

- [x] 1.1 Author the six planning artifacts, owner provenance, ADDED-only requirement and full security assessment with exact owned paths.
- [x] 1.2 Run assessment governance and strict OpenSpec validation before committing only this change's planning artifacts.

## 2. Runtime

- [ ] 2.1 Replace the handle-less fallback with unconditional bounded refusal, retaining not_applicable, direct/operation branches and F10/F11 anchors.

## 3. Tests

- [ ] 3.1 Add catalog partition, 35-case non-success refusal matrix, delivery-class non-vacuity and handle-less success control with exact diagnostic and zero emissions.
- [ ] 3.2 Pair all 35 inputs with sanctioned method-bound handles and replay every not_applicable fixture; run build, typecheck and focused tests.

## 4. Documentation

- [ ] 4.1 Document API rule, migration, exact glossary and accepted ADR-SDK-014 refining unchanged ADR-SDK-007.
- [ ] 4.2 Update only ADR count/sequence and Node PREMATURE_SUCCESS explanation.

## 5. Verification and evidence

- [ ] 5.1 Execute the complete supplied TEST_CMD including CodeScene delta; record exact commands and observed results in tasks and invariant evidence.
- [ ] 5.2 Run strict OpenSpec, git diff --check and exact four-commit/path inspection; record evidence without invented mutation or approval claims.

## 6. Merge and archive

- [ ] 6.1 Merge through the separately authorized repository process (not performed in this run).
- [ ] 6.2 Fold and archive after separately authorized merge (not performed in this run).

## Executed evidence

### Planning — 2026-10-13, Node v26.11.1

- `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-core-transaction-bound-commit-state`: exit 0, `design-pattern governance passed in assessment phase: enforcement active`.
- `openspec validate fix-core-transaction-bound-commit-state --strict`: exit 0, `Change 'fix-core-transaction-bound-commit-state' is valid`.
- Initial strict validation exited 1 with the >500-character requirement warning. Shortened the same single requirement without losing its rule, then both commands above passed before the planning commit.
- Clean initial HEAD and fetched origin/main both equal `02ce833c4e02f83441d086ed47aed1306d4217cc`; the provisioned branch has no upstream, so no unrelated pull or baseline move was performed.

Runtime, analyzer and final verification results are pending.
