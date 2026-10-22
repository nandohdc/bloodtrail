# Tasks: align the SDK core with the catalog's tenant and failed-authentication rules (#861, #862)

Groups complete in order. Merge, fold and archive stay unchecked while the change is active.

## 1. Proposal

- [x] 1.1 Author the change artifacts: proposal, design, full assessment with exact ownership, tasks, and the
  ADDED `security-audit-sdk-core` delta.
- [x] 1.2 Run assessment-phase governance and strict OpenSpec validation before the proposal-only commit.

## 2. Claimed-tenant policy (#861)

- [x] 2.1 Add ADR-SDK-018 and the host guidance to sdk-core `SECURITY.md` and `API.md`, moving the coherence ADR
  pins to 018. Change no code; cite the existing `tests/pass2.test.ts` coverage.

## 3. Failed-authentication target rule (#862)

- [x] 3.1 Add the SDK-only rule to `src/validation/semantic.ts`, called last in `validateBaseSemantics`.
- [x] 3.2 Run typecheck, build and the existing runtime tests before the rule-only commit.

## 4. Tests (#862)

- [ ] 4.1 Add the top-level `tests/failed-authentication-target.test.ts`:
  - every refused shape on named methods, `emit()`, `redeliver()` and free validation, with zero sink calls;
  - the approved example and the derived resource accepted;
  - precedence;
  - other events unaffected.

  Show that the tests fail against `main`'s `semantic.ts`.

## 5. Documentation (#862)

- [ ] 5.1 Add:
  - ADR-SDK-019, moving the coherence pins to 019;
  - the MIGRATION entry;
  - API and SECURITY sections;
  - the "Target-bearing field" glossary term;
  - the Node error-catalog cause.

## 6. Verification

- [ ] 6.1 Run the verification chain on the candidate and record each exit status:
  - strict validation;
  - assessment- and final-phase governance;
  - the dual check;
  - contract reuse;
  - Git state;
  - generated and changed-path gates;
  - coherence;
  - contract-version currency;
  - sdk-core `npm run validate`;
  - `make test`;
  - the CodeScene delta.

## 7. Merge, fold and archive

- [ ] 7.1 Obtain every required CI context plus DeepScan green, and the AGY and `/code-review high` reviews, on the
  pull request head.
- [ ] 7.2 Merge as a merge commit after the checks pass.
- [ ] 7.3 Fold the ADDED requirement into the canonical spec in a separate PR.
- [ ] 7.4 Archive the change in a separate PR, after the fold lands.
