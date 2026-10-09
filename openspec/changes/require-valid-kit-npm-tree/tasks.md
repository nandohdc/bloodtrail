## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks and abbreviated design-pattern
  assessment for `require-valid-kit-npm-tree`. Verify `openspec validate
  require-valid-kit-npm-tree --strict`, `node
  openspec/scripts/generate-assessment.mjs --change require-valid-kit-npm-tree
  --check` and `node
  openspec/scripts/check-design-pattern-governance.mjs --phase assessment
  --change require-valid-kit-npm-tree` pass.

## 2. Implementation

- [x] 2.1 Extract the shared npm dependency-tree helper from the own-service
  installer assertion while preserving its failure text.
- [x] 2.2 Add the `npm-dependency-tree` kit-gate check immediately after npm
  installation in both build and existing-kit modes.
- [x] 2.3 Add the missing-core-override planted-defect control and update the
  identity and clause bookkeeping for both gate modes.

## 3. Verify

- [x] 3.1 Run `npm run validate --prefix packages/security-audit-sdk-node` on
  Node 26 and `npm test --prefix packages/security-audit-sdk-node` on Node
  24.2.0.
- [x] 3.2 Run the governance chain: generated-artifact and changed-path checks,
  OpenSpec validation, assessment drift, final design-pattern governance, dual
  checks, contract reuse, normative precedence, `make`, and `git diff --check`.
- [x] 3.3 Record the two-control sweep, including the disabled
  `npm-dependency-tree` fail-closed assertion and the wrong-override contrast.
- [x] 3.4 Record the disposable-clone distributable-kit build and existing-kit
  gate summary, including the digest and archive path.

## 4. Archive

- [ ] 4.1 After the implementation merges, archive
  `require-valid-kit-npm-tree` in a separate pull request.
