## 1. Authoring and validation

- [x] 1.1 Author the `delivery-conformance-contract` capability delta, proposal, and design strictly from the frozen `delivery_class_contracts` rows; verify every class statement uses the contract's exact vocabulary (class names, `fail_open` / `fail_closed` / `blocked_pending_qualified_review` postures, durability / idempotency / retry / backpressure / shutdown / outage wording) and that no frozen row is redefined, extended, or weakened.
- [x] 1.2 Verify the nine-state model is complete and every transition has a deterministic externally observable outcome; verify the six canonical scenario families from #102 (retry, overflow/capacity, timeout, shutdown deadlines, validation rejection, downstream failure) each map to at least one scenario, each scenario is single-outcome, and no scenario silently applies to all four classes.
- [x] 1.3 Verify the at-most-once / at-least-once classification per class, the explicit exactly-once prohibition scenario, and the platform-neutral boundary with no transport runtime dependencies; verify the out-of-scope statements (no HTTP transport, queues, collector validation, storage implementation, no exactly-once, no production deployment selection) and the settled exact-one version dimension are recorded.
- [x] 1.4 Run `openspec validate specify-delivery-conformance-contract --strict`, `git diff --check`, and a trailing-whitespace / final-newline check on every new file; verify capability-to-spec naming, required proposal sections, exact scenario-per-requirement coverage, and vocabulary consistency across design, spec, and tasks.

## 2. Governed proposal landing

- [ ] 2.1 Commit the proposal artifacts with subject `docs(openspec): specify the delivery conformance contract (#102)` on a fresh branch from `origin/main`, staging an explicit allowlist of only `openspec/changes/specify-delivery-conformance-contract/**`; push without force and open the PR referencing issue #102 and Hermes task id.
- [ ] 2.2 Wait until all required CI checks are green and the branch is up to date; verify the design-pattern-governance final phase, governance dual check, and the contract-reuse check's approved-skip outcome all pass without weakening any gate.
- [ ] 2.3 Obtain an exact-commit technical review bound to the PR head; record the reviewer verdict and reviewed commit; never merge while a required check is pending, failing, or incomplete. The project owner merges; the integrator uses the gate script only.

## 3. Canonical fold

- [ ] 3.1 After the identity-preserving merge, fold the delta into `openspec/specs/delivery-conformance-contract/spec.md` in a dedicated commit; verify the canonical requirement and every scenario occur exactly once without a delta operation header, and that a second semantic application of the delta is a no-op.
- [ ] 3.2 Run strict OpenSpec validation and the repository validation chains read-only against the folded tree; verify no file under `packages/*/src/`, no contract source, and no generated artifact changed; stage an explicit allowlist naming only the canonical spec and task state.

## 4. Archive relocation

- [ ] 4.1 Move the active change into a dated `openspec/changes/archive/` directory in a separate archive-relocation commit; verify proposal, design, delta spec, and `.openspec.yaml` retain byte identity and `openspec/specs/**` is absent from the archive diff.
- [ ] 4.2 Run strict all-change validation and archive-attestation checks; verify the active path is absent, the archive path exists, and archive readiness is reported separately from technical and merge readiness.

## 5. Downstream reconciliation

- [ ] 5.1 After the canonical fold lands, comment on issues #103, #104, #105, #106, #107, #109, #113, and #126 naming the canonical spec path; do not promote or close them.
- [ ] 5.2 Leave issue #102 open for the pipeline orchestrator to close with the chain evidence; do not close it from this change.
