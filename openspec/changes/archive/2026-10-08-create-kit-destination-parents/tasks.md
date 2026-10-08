## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks and abbreviated design-pattern
  assessment for `create-kit-destination-parents`. Verify `openspec validate
  create-kit-destination-parents --strict`, `node
  openspec/scripts/generate-assessment.mjs --change
  create-kit-destination-parents --check` and `node
  openspec/scripts/check-design-pattern-governance.mjs --phase assessment
  --change create-kit-destination-parents` pass.

## 2. Builder and gate

- [x] 2.1 Change the builder to guard the nearest existing destination path
  before recursive creation, retain the default temporary-parent diagnostic,
  give `--dest` the destination-specific refusal, and clean up only paths the
  build created.
- [x] 2.2 Build the distributable clone kit below missing parents and add the
  `destination-refusal` clone check between distributable matching and
  dirty-tree refusal, including its stable verification-summary clause.
- [x] 2.3 Add the measured `destination-refusal` planted-defect control and
  update the controls' expected identities, count, and distributable-clone
  clause.

## 3. Verify

- [x] 3.1 Run `npm run validate --prefix packages/security-audit-sdk-node` on
  Node 26 and `npm test --prefix packages/security-audit-sdk-node` on Node
  24.2.0.
- [x] 3.2 Run the governance chain: generated-artifact and changed-path checks,
  OpenSpec validation, assessment drift, final design-pattern governance, dual
  checks, contract reuse, normative precedence, `make`, and `git diff --check`.
- [x] 3.3 Record the missing-parent, existing-parent, clone destination-refusal,
  repository-root refusal, and failed-build-cleanup probes with their commands
  and complete output.

## 4. Archive

- [x] 4.1 After the implementation merges, archive
  `create-kit-destination-parents` in a separate pull request.
