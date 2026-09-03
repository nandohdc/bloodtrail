## 1. Proposal

- [x] 1.1 Land the proposal PR for issue #82 against `origin/main`: the complete packet (`proposal.md`, `assessment.json`, `design.md`, the `ci-topology` delta spec, `tasks.md`), `openspec validate ratify-ci-topology --strict` passing, the required CI contexts green, conventional commit `docs(openspec): propose ratify-ci-topology`, and every task unchecked. The diff SHALL modify only paths under `openspec/changes/ratify-ci-topology/` — no `.github/workflows/`, no `.github/scripts/`, no `ci.yml`, no `contracts/` path. Do not merge.
- [x] 1.2 Run the strict and semantic verification of the change: every requirement uses normative SHALL language with deterministic WHEN/THEN scenarios; the decision's five sub-decisions, the both-directions completeness amendment, the three rules, the mandatory per-package check set (build, typecheck, runtime tests, production-only packed install, at least one deterministic mutation control), and the failure-not-skip semantics are each present; the provenance string `delegated to Claude by the owner, 2026-09-03; not a human owner decision` appears verbatim; the assessment passes `check-design-pattern-governance` at the proposal commit; and no task is checked.

## 2. Review and authorization

- [x] 2.1 Obtain an independent exact-commit technical review bound to the proposal commit. Record the review as evidence, not approval; the delegated 2026-09-03 decision is recorded provenance and does not substitute for any review.
- [ ] 2.2 Obtain the project owner's exact-commit decision bound to the proposal commit before merge. The delegated decision does not satisfy this task: any gate requiring a genuine human owner decision still requires one. Merge only after the owner's recorded decision and every required CI check are green at the exact head.

## 3. Downstream implementation (#85)

- [ ] 3.1 Verify that #85, the later governed change, materializes the ratified topology — per-concern jobs with stable context names, the explicit list with the both-directions completeness assertion, the per-package Node matrix, the runtime-per-leg/repository-once split, the three rules, and the mandatory check set — under its own review and required gates. The `ci-topology` delta requirements are the conformance target; this change performs no workflow edit itself.

## 4. Fold and archive

- [x] 4.1 Fold the `ci-topology` delta into `openspec/specs/ci-topology/spec.md` in a dedicated commit and PR while this change is active; verify each requirement and scenario occurs exactly once, no delta header reaches the canonical spec, and a second semantic application of the delta is a no-op.
- [x] 4.2 Archive the active change after merge in a separate byte-preserving relocation commit that does not repeat the fold and does not touch `openspec/specs/**`; verify strict OpenSpec validation and that the relocation changes no workflow, contract, or package path.
