## 1. Planning and regression baseline

- [x] 1.1 Re-read the proposal, design, canonical retry/re-execution requirement, ADR-SDK-007, current F-11 tests, and `terminalSuccessAttemptEvent`; verify `skip_specs: true` remains justified because the canonical behavior already requires re-execution semantics and this change adds no requirement.
- [x] 1.2 Add one public F-11 deterministic regression for accepted terminal completion followed by a positive input-level named retry; run the compiled focused test and verify it fails specifically with `SDK_DUPLICATE_SUCCESS` at `/operation/state` before any implementation change.
- [x] 1.3 Verify the active design-pattern assessment against the proposal baseline and record why this security-sensitive causality correction is direct implementation without asserting owner approval.

## 2. Minimal terminal-retry correction

- [x] 2.1 Extend the narrow untrusted precheck input shape with `retry.retry_attempt`, prioritize a positive safe integer within the frozen contract 1.0.0 maximum ahead of input correlation and inherited context, and run the focused F-11 test to verify the explicit retry emits a distinct event with retry/original-event/operation links.
- [x] 2.2 Extend the same F-11 controls to verify a later terminal success with no positive retry relationship and zero, negative, non-numeric, non-finite, non-integer, or over-bound retry attempts remain `SDK_DUPLICATE_SUCCESS` at `/operation/state`; verify existing named retry, redelivery, causality, failure-release, and completion-reservation tests stay green.
- [x] 2.3 Verify the precheck adds no causality parsing, identifier allocation, timestamp resolution, transformation, sink retry, operation-state reset, public API, package, contract, or dependency change; reconcile the platform-coupling null control for the intentional standard-language `Number` reference while preserving its authored-artifact and host-coupling inventory.

## 3. Technical verification and frozen candidate evidence

- [x] 3.1 Run `npm run test:runtime --prefix packages/security-audit-sdk-core`, `npm run test:verification --prefix packages/security-audit-sdk-core`, and `npm run check:generated --prefix packages/security-audit-sdk-core`; verify the focused correction and all runtime/mutation controls pass.
- [x] 3.2 Run `npm run test:matrix --prefix packages/security-audit-sdk-core`, `npm run validate --prefix contracts/security-audit`, `openspec validate fix-terminal-named-retry --strict`, `openspec validate --all --strict`, and implementation-phase design-pattern governance; verify no contract drift, generated drift, scope violation, or unrelated change is introduced.
- [x] 3.3 Reconstruct the exact unstaged candidate in an isolated disposable clone and run `npm run validate --prefix packages/security-audit-sdk-core`; record the full 19-gate result, exact candidate tree/hash, and empty-index proof, while retaining exact-head CodeScene CI as a merge prerequisite rather than local evidence.

## 4. Governed delivery and lifecycle completion

- [x] 4.1 Commit the proposal artifact allowlist separately after proposal-only strict validation; verify its parent, staged paths, and working-tree/index blob equality.
- [ ] 4.2 Commit the verified technical allowlist separately; bind any subsequent human review and governance record to that exact technical commit, without treating AI review, CI, issue state, or this task list as approval.
- [ ] 4.3 Open a focused #215 PR, verify the live head/path set and all required checks, then obtain the required exact-commit owner/reviewer decision before any identity-preserving merge.
- [ ] 4.4 After merge, confirm the technical and decision commits are reachable from `main`; archive the `skip_specs` change with byte-preserving relocation only when every implementation/governance task is genuinely complete, and close #215 only after archive evidence is recorded.
