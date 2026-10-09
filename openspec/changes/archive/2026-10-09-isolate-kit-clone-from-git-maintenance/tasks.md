## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks and abbreviated design-pattern
  assessment for `isolate-kit-clone-from-git-maintenance`. Verify `openspec
  validate isolate-kit-clone-from-git-maintenance --strict`, `node
  openspec/scripts/generate-assessment.mjs --change
  isolate-kit-clone-from-git-maintenance --check` and `node
  openspec/scripts/check-design-pattern-governance.mjs --phase assessment
  --change isolate-kit-clone-from-git-maintenance` pass.

## 2. Disposable clone

- [x] 2.1 Configure every kit-tree clone with `maintenance.auto=false` and
  `gc.auto=0` before later clone commands run, pass both settings directly to
  the clone commit against ambient Git configuration, and document the #734
  detached-repack removal race without changing removal.

## 3. Verify

- [x] 3.1 Run `npm run validate --prefix packages/security-audit-sdk-node` on
  Node 26 and `npm test --prefix packages/security-audit-sdk-node` on Node
  24.2.0, both without the Git-maintenance environment workaround.
- [x] 3.2 Run the governance chain: generated-artifact and changed-path checks,
  OpenSpec validation, assessment drift, final design-pattern governance, dual
  checks, contract reuse, normative precedence, `make`, and `git diff --check`.
- [x] 3.3 Record Trace2 probes from disposable clones for the fixed clone, the
  reverted clone, and the fixed clone under an ambient maintenance override.

## 4. Archive

- [x] 4.1 After the implementation merges, archive
  `isolate-kit-clone-from-git-maintenance` in a separate pull request.
