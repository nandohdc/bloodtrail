## 1. Proposal and authorization

- [x] 1.1 Materialize proposal, design, and three capability deltas and verify `openspec status --change define-normative-precedence-lifecycle` reports every planning artifact done.
- [x] 1.2 Create a full security-sensitive design-governance assessment covering governance-core paths and verify the generated assessment is byte-stable.
- [x] 1.3 Run strict OpenSpec validation and record a zero exit before committing the proposal/assessment baseline.
- [x] 1.4 Record bounded project-owner apply authorization for groups 2 through 5 against the exact proposal commit/tree; keep review, merge, activation, fold, archive, production, and publication withheld.

## 2. Authority and lifecycle policy

- [x] 2.1 Add the closed normative-precedence policy and schema covering source classes, semantic dimensions, requirement ownership, applicability, conflict rules, and exact Candidate A baseline debt; verify schema and relational validation pass.
- [x] 2.2 Add independent change-record and contract-candidate lifecycle transition tables and verify illegal cross-machine and undeclared transitions fail.
- [x] 2.3 Define exact freeze/review binding and dedicated activation authority/evidence rules and verify partial, stale, floating, and self-authorizing bindings fail.
- [x] 2.4 Record resolved OpenSpec governance vocabulary in `openspec/CONTEXT.md` and verify no implementation detail is placed in the glossary.

## 3. Repository-aware enforcement

- [x] 3.1 Implement the dependency-free read-only precedence checker with deterministic diagnostics and verify it resolves actual capabilities, requirements, source pointers, active deltas, and archives.
- [x] 3.2 Implement semantic assertion, source ownership, overlap, changed-source compatibility, lifecycle, freeze/review, and activation checks and verify each arm has an observable stable diagnostic.
- [x] 3.3 Add stage-aware exact-baseline debt behavior and verify unchanged Candidate A debt may not activate or release and cannot excuse a new or changed conflict.
- [x] 3.4 Integrate the candidate checker into the existing required governance CI job while preserving the separate trusted-baseline design-governance run.

## 4. Failure-sensitive evidence

- [x] 4.1 Preserve all 26 policy-model cases in repository tests and verify 7 valid cases pass and 19 invalid cases fail for their declared policy reason.
- [x] 4.2 Add repository enforcement cases for delegation, delta classification, applicability, review/freeze binding, compatibility presence, activation authority, and lifecycle legality using disposable Git repositories.
- [x] 4.3 Prove negative controls NC-001 through NC-008 are detected, including source-only semantics, post-review mutation, activation self-authorization, and unclassified compatibility change.
- [ ] 4.4 Run the trusted baseline checker and candidate checker separately and record their exact commands, exits, and diagnostics without treating either as owner approval.

## 5. Technical verification and Revision 2 evidence

- [ ] 5.1 Run strict OpenSpec validation, policy-model tests, repository enforcement tests, the candidate checker, the trusted/candidate dual check, and `git diff --check`; record exact results.
- [ ] 5.2 Produce the external CB-001 Revision 2 evidence package, blocker-closure table, artifact hashes, and exact technical commit/tree without modifying Candidate A.

## 6. Review and governed landing

- [ ] 6.1 Obtain project-owner review bound to the exact technical commit/tree, complete governed objects, scope, and policy/checker hashes; keep `NORMATIVE_PRECEDENCE_DECISION_STATUS=NEEDS_REVIEW` until granted.
- [ ] 6.2 After approval only, create the signed governance record, re-run exact-head required checks, and establish merge readiness without starting CB-002.
- [ ] 6.3 Land through identity-preserving merge and the separately authorized dedicated activation record; verify the activation record is the merge's direct child and cannot self-authorize.
- [ ] 6.4 Fold all three capability deltas while the change remains active, validate the fold independently, then archive the byte-identical completed change in a separate governed step.
