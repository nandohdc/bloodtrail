## 1. ADR 0009 materialization

- [x] 1.1 Write `docs/adr/0009-repository-and-package-manager-topology.md` recording: the standalone selection; the four-package target set (`contracts/security-audit`, `packages/security-audit-sdk-core`, the planned Node binding (#87), `research/browser-telemetry`); lockfile and package ownership; root-package presence; the narrowed undeclared-import visibility argument; the plan-only migration/rollback owned by #83; the revisit conditions; and the non-goals. Verify the ADR names browser (#124) and React Native (#131) as excluded while #117 is undecided and records no restructuring, release, CI, or publication authorization.
- [x] 1.2 Verify the ADR cites the measured evidence exactly: both null development arms printed `development:null`; both null packed consumers printed `packed-import:pass`; both mutated development arms printed `development:shared` with exit status 0; both mutated production-only packed consumers failed with exit status 1 and `ERR_MODULE_NOT_FOUND`; tools Node `v26.8.1`, npm `11.19.0`, disposable pnpm `10.17.0`. Verify the ADR claims nothing beyond the two measured configurations, keeps the packed-install control outside any workspace root, preserves per-workspace engine ranges (`>=24 <25 || >=26 <27` for the SDK, `>=26.5.0` for contract and research), and introduces no root `engines`.
- [x] 1.3 Commit the materialization allowlist in a separate `docs(openspec): ...` commit containing only `docs/adr/0009-repository-and-package-manager-topology.md`; verify the commit does not modify `check-coherence.mjs` or `compatibility.json`; push the branch and open the materialization PR; verify required CI checks pass on it.
- [ ] 1.4 Obtain an independent exact-commit technical review bound to the materialization commit; record that the review is evidence and not approval; keep the owner-approval task pending until the owner records the decision.

## 2. Proposal verification and governance

- [ ] 2.1 Run `openspec validate ratify-repository-topology --strict` and the semantic verification of every requirement, scenario, and task; verify every requirement uses normative SHALL language with deterministic WHEN/THEN scenarios, controlled values match byte-for-byte across proposal, design, spec, and tasks, and no hoisting claim exceeds the two measured configurations. Verify the proposal commit modifies only the proposal allowlist under `openspec/changes/ratify-repository-topology/` and does not modify `check-coherence.mjs` or `compatibility.json`.
- [ ] 2.2 Obtain an independent exact-commit technical review bound to the proposal commit; record that the review is evidence and not approval.
- [ ] 2.3 Obtain the project owner's approval bound to the exact commit being merged; verify the approval is a recorded owner decision and not inferred from review evidence, PR assignment, or AI analysis.

## 3. Merge and downstream gates

- [ ] 3.1 Merge the proposal and materialization PRs only after every required CI check is green and the owner approval binds the commit being merged; verify no required check is pending, failing, or cancelled at merge time and the integrator merges through the gate script.
- [ ] 3.2 Comment on #81 and #82 that their gate is open because the topology decision is recorded; verify the comments name the ADR path `docs/adr/0009-repository-and-package-manager-topology.md`.

## 4. Fold and archive

- [ ] 4.1 Fold this change's `repository-topology` delta into `openspec/specs/repository-topology/spec.md` in a dedicated commit while the change is still active; verify a second semantic application of the delta is a no-op and the fold does not modify `check-coherence.mjs` or `compatibility.json`.
- [ ] 4.2 Archive the active change in a separate archive-relocation commit with byte identity for proposal, design, delta spec, and metadata; verify strict OpenSpec validation, archive attestations, and that the relocation changes no implementation path.
- [ ] 4.3 Close #80 naming the topology and the ADR path; tick #80 in #132's Wave 2 checklist and note the decision surface shrank.
