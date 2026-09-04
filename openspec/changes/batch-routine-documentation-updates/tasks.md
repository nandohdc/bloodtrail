## 1. Governance Documentation Updates

- [x] 1.1 Document the routine documentation batching convention in AGENTS.md under repository guidelines and verify with git diff
- [x] 1.2 Document the routine documentation batching convention in CLAUDE.md under workflow and verify with git diff
- [x] 1.3 Document the routine documentation batching convention in docs/agents/orchestration.md under repository preflight and pull-request rules and verify with git diff
- [x] 1.4 Harmonize agent working instructions in .hermes.md with the batching convention and verify with git diff

## 2. Verification and Governance Assessment

- [x] 2.1 Author full assessment.json for batch-routine-documentation-updates and verify schema and relational validity
- [x] 2.2 Run openspec validate --all --strict and verify clean specification pass
- [x] 2.3 Run check-design-pattern-governance.mjs --phase final and run-governance-dual-check.mjs to verify governance compliance
