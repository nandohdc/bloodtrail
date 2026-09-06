## 1. Plan and assess the change

- [x] 1.1 Propose change `enforce-r14-path-widening` with design, tasks, and full design-pattern assessment.

## 2. Implement the widening rule

- [x] 2.1 Add `openspec/scripts/design-pattern-governance/path-widening.mjs` implementing event detection (path reclassification into `documentation_only`, benign pattern growth) and acknowledgement resolution with the six distinct diagnostics.
- [x] 2.2 Wire the rule into `checkPerimeter` in `openspec/scripts/check-design-pattern-governance.mjs`.
- [x] 2.3 Verify both dual-check checker runs resolve the same comparison base without extra plumbing: the rule reuses the range base `checkPerimeter` already resolved, and both runs derive the same merge base from the same candidate policy and protected-mainline reference.

## 3. Describe the rule for humans

- [x] 3.1 Add the widening rule, its diagnostics, and the acknowledgement field to `docs/design-pattern-governance.md`.

## 4. Mutation controls

- [x] 4.1 Add self-governance fixtures: unacknowledged path widening fails with `path-class-widening-unacknowledged`; benign pattern growth fails the same way.
- [x] 4.2 Add fixtures: an exactly-bound acknowledgement passes; a stale baseline, a wrong path set, an ambiguous record, and a false `acknowledged` all still fail with their distinct ids.
- [x] 4.3 Add fixtures: a narrowing and an unrelated policy edit do not fire the rule.

## 5. Governance and verification

- [x] 5.1 Generate the design-pattern assessment from the authored source and verify byte-identical regeneration with `--check`.
- [x] 5.2 Validate OpenSpec changes with `openspec validate --all --strict`.
- [x] 5.3 Run the governance test suite, the checker (final phase), the dual check against the proposal baseline, and the contract reuse assessment.
- [x] 5.4 Run `git diff --check` and confirm the change touches only the declared owned paths.
