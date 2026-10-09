## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks and abbreviated design-pattern
  assessment for `isolate-verification-clones-from-git-maintenance`. Verify
  `openspec validate isolate-verification-clones-from-git-maintenance
  --strict`, `node openspec/scripts/generate-assessment.mjs --change
  isolate-verification-clones-from-git-maintenance --check` and `node
  openspec/scripts/check-design-pattern-governance.mjs --phase assessment
  --change isolate-verification-clones-from-git-maintenance` pass.

## 2. Verification helper

- [ ] 2.1 Add `-c maintenance.auto=false -c gc.auto=0` to the shared
  disposable-git helper's `boundedConfig` so every command it runs carries
  them, `clone` and `commit` included, and document the #772 detached-repack
  removal race without changing removal.

## 3. Verify

- [ ] 3.1 Run `npm run validate --prefix packages/security-audit-sdk-core` on
  Node 26 and
  `env PATH="$HOME/.local/share/fnm/node-versions/v24.2.0/installation/bin:$PATH" npm run test:matrix --prefix packages/security-audit-sdk-core`
  on Node 24.2.0, both without the Git-maintenance environment workaround,
  with the `test:verification` count equal to the base's.
- [ ] 3.2 Run the governance chain: generated-artifact and changed-path
  checks, OpenSpec validation, assessment drift, final design-pattern
  governance, dual checks, contract reuse, normative precedence, `make`, and
  `git diff --check`.
- [ ] 3.3 Record Trace2 probes from disposable clones for the fixed helper,
  the reverted helper, and the fixed helper under an ambient maintenance
  override.

## 4. Archive

- [ ] 4.1 After the implementation merges, archive
  `isolate-verification-clones-from-git-maintenance` in a separate pull
  request.
