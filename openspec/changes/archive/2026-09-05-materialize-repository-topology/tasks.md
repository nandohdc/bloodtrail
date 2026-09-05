## 1. Proposal

- [x] 1.1 Author the complete proposal packet for issue #83 under `openspec/changes/materialize-repository-topology/`: `proposal.md`, `design.md`, the `repository-topology` delta spec (`specs/repository-topology/spec.md`, requirements R1-R4 with normative SHALL language and deterministic WHEN/THEN scenarios), `tasks.md`, and `assessment.json`. Verify `openspec validate materialize-repository-topology --strict` and `openspec validate --all --strict` pass, and `check-design-pattern-governance` passes at the proposal commit. Commit ONLY the explicit allowlist `openspec/changes/materialize-repository-topology/**`; push the branch; open the proposal PR citing GitHub #83, the Hermes task id, and the change id. Verify the PR is OPEN and the head SHA equals the local commit. Do not merge.
- [x] 1.2 Obtain an independent exact-commit technical review bound to the proposal commit; record the review as evidence, not approval.

## 2. Implementation — documentation and evidence

- [x] 2.1 Author `docs/topology-materialization.md` (path class `documentation_only`) with the layout fixed in `design.md`: the materialization record, the workspace inventory (each current workspace with its package-local `--prefix` commands and its exact `engines` range), the migration/rollback plan with the packed-install control outside any workspace root, the no-restructuring boundary with the vacuous pinned-constant statement, and the four-arm evidence protocol.
- [x] 2.2 Produce and record arm (a) — package discovery from a clean clone at the recorded head; record tool versions, exit codes, and key output lines.
- [x] 2.3 Produce and record arm (b) — per-package lockfile install and validation for `contracts/security-audit`, `packages/security-audit-sdk-core`, and `research/browser-telemetry`; record tool versions, exit codes, and key output lines per package.
- [x] 2.4 Produce and record arm (c) — the hoisting mutation plus its null control against the packed-install control run in a clean consumer directory outside any workspace root; record tool versions, exit codes, and key output lines. The control SHALL NOT be relocated inside any workspace root.
- [x] 2.5 Produce and record arm (d) — existing contract and SDK validation green at the recorded head, with the output diff against the pre-change head recorded.
- [x] 2.6 Commit ONLY the explicit allowlist `docs/topology-materialization.md`; push; open the implementation PR; verify the required CI checks are green at the exact head. Do not merge.

## 3. Review and governance

- [x] 3.1 Obtain an independent exact-commit technical review bound to the implementation commit; record the review as evidence, not approval.
- [x] 3.2 Obtain the project owner's authorization bound to the exact commit being merged, and merge only after every required CI check is green at that exact head; verify the merge is identity-preserving.

## 4. Fold

- [x] 4.1 Fold the `materialize-repository-topology` delta into `openspec/specs/repository-topology/spec.md` in a dedicated commit and PR while the change is still active; verify each requirement and scenario occurs exactly once, no delta header reaches the canonical spec, and a second semantic application of the delta is a no-op.

## 5. Archive and closure

- [ ] 5.1 Archive the active change in a separate byte-preserving relocation commit (byte identity for `proposal.md`, `assessment.json`, `design.md`, the delta spec, and metadata) with `archive-evidence.md`; verify strict OpenSpec validation, archive attestations, and that the relocation changes no implementation path; do not touch `openspec/specs/**` in the relocation commit.
- [ ] 5.2 Close GitHub #83 naming the materialization, the documentation path, and the recorded evidence; tick #83 in #132's Wave 2 checklist.
