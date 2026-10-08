## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks and abbreviated design-pattern
  assessment for `refuse-existing-kit-output`. Verify `openspec validate
  refuse-existing-kit-output --strict`, `node
  openspec/scripts/generate-assessment.mjs --change refuse-existing-kit-output
  --check` and `node
  openspec/scripts/check-design-pattern-governance.mjs --phase assessment
  --change refuse-existing-kit-output` pass.

## 2. Builder and gate

- [ ] 2.1 Refuse every existing kit destination after the unchanged
  inside-repository guard and every existing distributable archive before
  creation, derive the archive path in one unexported helper, and limit cleanup
  to output created by the build.
- [ ] 2.2 Add `existing-output-refusal` between `destination-refusal` and
  `dirty-tree-refusal`, with independent clone probes proving existing
  destination and archive bytes remain unchanged and prohibited output is not
  created.
- [ ] 2.3 Add the two measured `existing-output-refusal` planted-defect
  controls and update their expected identities, verification-summary clause,
  and control-count bookkeeping.
- [ ] 2.4 Add the Kit destination glossary entry and index `kit destination`
  in the Node binding vocabulary map.

## 3. Verify

- [ ] 3.1 Run `npm run validate --prefix packages/security-audit-sdk-node` on
  Node 26 and `npm test --prefix packages/security-audit-sdk-node` on Node
  24.2.0.
- [ ] 3.2 Run the governance chain: generated-artifact and changed-path checks,
  OpenSpec validation, assessment drift, final design-pattern governance, dual
  checks, contract reuse, normative precedence, `make`, and `git diff --check`.
- [ ] 3.3 Record the existing empty destination, foreign-file and symlink,
  existing file and dangling symlink, existing archive, new-destination, and
  repository-root disposable-clone probes with commands and complete output.

## 4. Archive

- [ ] 4.1 After the implementation merges, archive
  `refuse-existing-kit-output` in a separate pull request.
