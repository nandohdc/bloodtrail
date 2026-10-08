# Tasks

## 1. Proposal

- [x] 1.1 Author the full assessment, proposal, design, tasks, and complete two-requirement delta for
  `document-own-service-kit-install`.

## 2. Documented own-service install and gate

- [ ] 2.1 Add the standalone own-service section to the integration guide, including the exact JSON, YAML,
  npm, and pnpm snippets.
- [ ] 2.2 Point the quickstart and known issues at the own-service section without relaxing the rule against
  installing the Node binding on its own.
- [ ] 2.3 Make the kit gate install the guide's own-service snippets verbatim with npm and every pinned pnpm
  release, including dependency, installer-warning, npm-tree, and one-core-copy checks.
- [ ] 2.4 Add the npm-pin, pnpm-pin, and core-dependency planted-defect controls and their control-bookkeeping
  evidence.
- [ ] 2.5 Add the own-service glossary entry and the Node binding context-map vocabulary reference.

## 3. Verification and evaluator walk

- [ ] 3.1 Run Node 26 `validate` and Node 24.2.0 `npm test` for the Node binding.
- [ ] 3.2 Run the implementation governance chain.
- [ ] 3.3 Record the external-clone evaluator walk for the distributable kit, its gate, npm, pnpm 12.8.1, and
  both missing-pin cases.

## 4. Canonical fold

- [ ] 4.1 Fold both complete modified requirements into the canonical Node binding specification after the
  implementation and evaluator walk.

## 5. Archive

- [ ] 5.1 Archive the change after the fold merges in a separate pull request.
