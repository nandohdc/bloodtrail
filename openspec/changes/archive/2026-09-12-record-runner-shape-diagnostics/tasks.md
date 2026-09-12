## 1. Governed Planning and Proposal Delivery

- [x] 1.1 Author proposal, design, and assessment for `record-runner-shape-diagnostics` declaring `governance_core_path` trigger, full 15-dimension security justification, and closed path inventory.
- [x] 1.2 Validate change artifacts with `npx --yes @fission-ai/openspec@latest validate record-runner-shape-diagnostics --strict` and `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment`.
- [x] 1.3 Push dedicated proposal branch `openspec/propose-record-runner-shape-diagnostics`, create PR, verify all CI checks pass, and merge with `--admin --merge`.

## 2. Diagnostics & Workspace Hygiene Implementation

- [x] 2.1 Add `packages/client-evidence-browser/.gitignore` to ignore build artifacts (`dist/`, `dist-tests/`, `coverage/`, `*.tgz`).
- [x] 2.2 Add `Runner shape diagnostics` step in `.github/workflows/ci.yml` under `sdk` job reporting runner hostname, CPU count, `availableParallelism()`, and `RUNNER_TOOL_CACHE`.
- [x] 2.3 Verify repository runtime gates with `make runtime-gates`.

## 3. Implementation Verification & Delivery

- [x] 3.1 Verify implementation governance with `node openspec/scripts/check-design-pattern-governance.mjs --phase implementation`.
- [x] 3.2 Push implementation branch, open PR with complete PULL_REQUEST_TEMPLATE.md, verify all CI checks pass on the updated runner shape (recording `availableParallelism() = 4` and cache hits for `setup-node`).
- [x] 3.3 Merge implementation PR via `--admin --merge` after all CI checks pass.

## 4. Lifecycle Completion: Archival & Issue Closure

- [x] 4.1 Archive change `record-runner-shape-diagnostics` to `openspec/changes/archive/`.
- [x] 4.2 Verify final governance and OpenSpec validation (`node openspec/scripts/check-design-pattern-governance.mjs --phase final`).
- [x] 4.3 Merge archive PR, post verification results and comparative metrics to GitHub Issue #306, and close Issue #306.
