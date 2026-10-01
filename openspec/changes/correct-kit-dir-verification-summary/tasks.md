## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks and design-pattern assessment for
  `correct-kit-dir-verification-summary`. Verify `openspec validate correct-kit-dir-verification-summary --strict`,
  `node openspec/scripts/generate-assessment.mjs --change correct-kit-dir-verification-summary --check` and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment` pass.

## 2. Success line

- [x] 2.1 Make `checkEvaluationKit` return its success line and the command-line entry point print it. Add
  the `--kit-dir` null control to `check-evaluation-kit-controls.mjs`. Verify the null control fails against
  the current line.
- [x] 2.2 Make the success line name only checks that ran. Verify the following:
  - the null control passes;
  - a run that builds its own kit prints the same line as before;
  - the null control fails again when a `--kit-dir` run is made to claim the rebuild.

## 3. Verify

- [x] 3.1 Run `npm run validate --prefix packages/security-audit-sdk-node` on Node 26.5.0, and
  `npm test --prefix packages/security-audit-sdk-node` on Node 24.2.0. Verify both pass, and that every
  planted-defect control is applied exactly once.
- [x] 3.2 Run these, and verify each passes:
  - `npx --yes @fission-ai/openspec@latest validate --all --strict`;
  - sdk-core `test:git` and `test:changed-paths`;
  - `git diff --check`;
  - the final design-pattern governance phase and both dual-check arms;
  - the contract reuse check for every active change;
  - the merge-stage normative precedence check.

## 4. Archive

- [ ] 4.1 After the implementation merges, archive `correct-kit-dir-verification-summary` in a separate pull
  request.
