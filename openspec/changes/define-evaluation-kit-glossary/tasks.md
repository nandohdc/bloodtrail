## 1. Proposal

- [x] 1.1 Author the proposal, design, tasks and design-pattern assessment for
  `define-evaluation-kit-glossary`. Verify `openspec validate define-evaluation-kit-glossary --strict`,
  `node openspec/scripts/generate-assessment.mjs --change define-evaluation-kit-glossary --check` and
  `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment` pass.

## 2. Glossary

- [ ] 2.1 Add the evaluation terms and the sink and handoff terms to
  `packages/security-audit-sdk-node/CONTEXT.md`, and update the Node binding's line in `CONTEXT-MAP.md`.
  Verify that each definition agrees with the kit documents and the code it names, and that no general
  programming term is defined.

## 3. Verify

- [ ] 3.1 Run `npx --yes @fission-ai/openspec@latest validate --all --strict`, sdk-core `test:git` and
  `test:changed-paths`, and `git diff --check`. Verify each passes.
- [ ] 3.2 Run the final design-pattern governance phase, both dual-check arms, the contract reuse check
  for every active change and the merge-stage normative precedence check. Verify each passes.

## 4. Archive

- [ ] 4.1 After the implementation merges, archive `define-evaluation-kit-glossary` in a separate pull
  request.
