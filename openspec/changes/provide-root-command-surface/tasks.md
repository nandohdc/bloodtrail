## 1. Classification and Glossary Promotion

- [x] 1.1 Add `Makefile` to `governance_core` patterns in `openspec/governance/design-pattern-policy.json` and verify `node openspec/scripts/check-design-pattern-governance.mjs --phase candidate` passes R26
- [x] 1.2 Promote the ratified gate vocabulary (**runtime gates**, **repository-level gates**, **product test loop**, and **governance-gate chain**) into `openspec/CONTEXT.md`

## 2. Root Command Surface Implementation

- [x] 2.1 Author root `Makefile` with `.DEFAULT_GOAL := test`, `test` and `runtime-gates` running the ~18s product loop across all three workspaces, `governance-gates` stating its cost before running full validation chains, and per-workspace targets (`sdk`, `contract`, `research`) declaring partial run status
- [x] 2.2 Update repository guidelines in `AGENTS.md` and `CLAUDE.md` to document the root `make` targets alongside the direct npm commands

## 3. Verification and Dual Check

- [x] 3.1 Execute `make` bare invocation and verify it runs the product test loop across all three workspaces cleanly
- [x] 3.2 Execute `make sdk` and verify it reports partial execution naming unexecuted workspaces
- [x] 3.3 Validate OpenSpec artifacts with `npx --yes @fission-ai/openspec@latest validate --all --strict`
- [x] 3.4 Run governance dual check (`node openspec/scripts/run-governance-dual-check.mjs --base origin/main`) and verify baseline and candidate pass
