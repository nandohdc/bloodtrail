## 1. Proposal

- [x] 1.1 Land the proposal PR against `origin/main`: the complete packet (`proposal.md`, `design.md`, the `change-governance` delta spec, `tasks.md`, `assessment.source.json` and its generated `assessment.json`), `openspec validate reconcile-tracker-and-workspace-docs --strict` passing, the required CI contexts green, and every task unchecked.
- [x] 1.2 Verify the change is a dedicated batched documentation change under `change-governance`'s decoupling requirement: it bundles no unrelated implementation, and it touches `governance_core` paths as its substance rather than incidentally.

## 2. Workspace coverage

- [x] 2.1 Add `packages/security-audit-collector` to `runtime-gates` and `governance-gates` in the `Makefile`, and remove the hand-maintained workspace count from every success and help message so no literal can disagree with the recipe.
- [x] 2.2 Add `assertMakefileCoverage` and `makeRecipeFor` to `.github/scripts/check-package-discovery.mjs`, asserting that every covering target invokes every declared package, with a distinct named failure for an uncovered workspace and for an absent covering target.
- [x] 2.3 Add the failing arms to `.github/scripts/check-package-discovery.test.mjs`: recipe extraction stopping at the next block, the real Makefile passing, an uncovered workspace failing in #412's exact shape, an absent covering target failing, and a newly declared package failing while the real list still passes.
- [x] 2.4 Verify the gate runs in CI without a workflow edit — `design-pattern-governance` already executes `check-package-discovery.mjs` and `node --test .github/scripts/*.test.mjs`.
- [x] 2.5 Run `make` and confirm the loop now exercises the collector and passes across every declared workspace.
- [x] 2.6 Replace, rather than append to, the two `ci-topology` requirements that fix the root command surface and the documented product loop, so the canonical specification names every declared package and no contradictory SHALL survives the fold; confirm strict validation reports no scenario dropped from either requirement.

## 3. Tracker and triage documentation

- [x] 3.1 Rewrite `docs/agents/issue-tracker.md` to name GitHub Issues as the execution tracker, state that Hermes Kanban is retained but not authoritative, forbid inferring completion from a card, keep the `kanban_*` tool rule for fleet workers, and record both the measurements that withdrew the previous statement and the reversal path.
- [x] 3.2 Rewrite `docs/agents/triage-labels.md` to map the five canonical roles onto the GitHub labels of the same name, record the measured label usage that withdrew the old claim, keep `needs-info` and `ready-for-human` distinguishable, carry closure on issue state rather than a label, and retain the Kanban block kinds scoped to fleet runs.
- [x] 3.3 Verify every role in the new mapping resolves to a label that exists in the repository's label set, and that no two roles map to the same state.

## 4. Governance-core reconciliation

- [x] 4.1 Update `CLAUDE.md`: the workspace table lists all five workspaces, the command block runs each of them, the stated workspace count matches the repository, and the tracker and triage sections match `docs/agents/`.
- [x] 4.2 Update `AGENTS.md` to the same workspace set, command list, tracker statement, and triage mapping, keeping it consistent with `CLAUDE.md`.
- [x] 4.3 Verify no other tracked file still asserts the withdrawn claims — three workspaces, Hermes Kanban as canonical execution tracker, or the five roles as non-GitHub-labels.
- [x] 4.4 Update `README.md`: the layout table lists all three packages, the `sdk` row names every package that job validates, and the `coverage` row states that it is required and covers every code workspace — it claimed `no` while branch protection requires it.

## 5. Verification and governance

- [x] 5.1 Run `node .github/scripts/check-package-discovery.mjs` and `node --test .github/scripts/check-package-discovery.test.mjs` and confirm both pass, with every failing arm asserting its own named diagnostic.
- [x] 5.2 Run `openspec validate --all --strict`, `check-design-pattern-governance.mjs --phase assessment` and `--phase final`, `run-governance-dual-check.mjs`, and the contract-reuse loop over every active change.
- [x] 5.3 Run `test:changed-paths` and `test:git` and confirm the staged scope carries no protected-prefix write and the index is empty before commit.

## 6. Fold and archive

- [x] 6.1 Fold the `change-governance` delta into `openspec/specs/change-governance/spec.md` in a dedicated commit and PR while this change is active; verify each requirement and scenario occurs exactly once, that no delta header reaches the canonical spec, and that a second application of the delta is a no-op.
- [x] 6.2 Archive the active change after merge in a separate byte-preserving relocation commit that does not repeat the fold and does not touch `openspec/specs/**`; verify strict OpenSpec validation and that the relocation changes no contract, package, or workflow path.
