## 1. Plan and assess the change

- [ ] 1.1 Propose change `enforce-r14-path-widening` with design, tasks, and full design-pattern assessment.

## 2. Implement the widening rule

- [ ] 2.1 Add `openspec/scripts/design-pattern-governance/path-widening.mjs` implementing event detection (path reclassification into `documentation_only`, benign pattern growth) and acknowledgement resolution with the six distinct diagnostics.
- [ ] 2.2 Wire the rule into `checkPerimeter` in `openspec/scripts/check-design-pattern-governance.mjs`.
- [ ] 2.3 Pass the explicit `--base` into both checker runs in `openspec/scripts/run-governance-dual-check.mjs`.

## 3. Describe the rule for humans

- [ ] 3.1 Add the widening rule, its diagnostics, and the acknowledgement field to `docs/design-pattern-governance.md`.

## 4. Mutation controls

- [ ] 4.1 Add self-governance fixtures: unacknowledged path widening fails with `path-class-widening-unacknowledged`; benign pattern growth fails the same way.
- [ ] 4.2 Add fixtures: an exactly-bound acknowledgement passes; a stale baseline, a wrong path set, an ambiguous record, and a false `acknowledged` all still fail with their distinct ids.
- [ ] 4.3 Add fixtures: a narrowing and an unrelated policy edit do not fire the rule.

## 5. Governance and verification

- [ ] 5.1 Generate the design-pattern assessment from the authored source and verify byte-identical regeneration with `--check`.
- [ ] 5.2 Validate OpenSpec changes with `openspec validate --all --strict`.
- [ ] 5.3 Run the governance test suite, the checker (final phase), the dual check against the proposal baseline, and the contract reuse assessment.
- [ ] 5.4 Run `git diff --check` and confirm the change touches only the declared owned paths.
