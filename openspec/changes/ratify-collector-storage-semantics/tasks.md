## 1. Proposal

- [ ] 1.1 Land the proposal PR for issue #114 against `origin/main`: the complete packet (`proposal.md`, `design.md`, the `collector-storage-semantics` delta spec, `tasks.md`, `assessment.source.json` and its generated `assessment.json`), `openspec validate ratify-collector-storage-semantics --strict` passing, the required CI contexts green, and every task unchecked. The diff SHALL modify only paths under `openspec/changes/ratify-collector-storage-semantics/` — no `contracts/` path, no `packages/` path, no generated artifact, no workflow.
- [ ] 1.2 Verify the decision is complete against #114's acceptance criteria: storage abstraction, durability target, encryption and key ownership, retention and deletion, tenancy, indexing, and failure behaviour are each stated normatively, and the acknowledgment point relative to persistence is fixed.
- [ ] 1.3 Verify the decision identifies the data owner, the retention and deletion authority, and the key owner as named roles a deployment must fill, and states that this delegated decision does not fill them.
- [ ] 1.4 Verify at least one write-failure scenario and one partial-outage scenario each have a single deterministic collector outcome, and that the two outcomes are distinct from one another.
- [ ] 1.5 Verify migration and recovery boundaries are explicit: a stored record's schema version governs readability with an unsupported-version outcome distinguishable from absence, and recovery restores records without reissuing or revoking any acknowledgment.
- [ ] 1.6 Verify the provenance string `delegated to Claude by the owner, 2026-09-09; not a human owner decision` appears verbatim in the capability, and that the capability states in its own text that it authorizes no implementation.

## 2. Scope boundary

- [ ] 2.1 Verify the change touches no `packages/` path: `packages/security-audit-collector/` is unchanged, `npm run test:scope` still rejects `storage` as a filename, import, and export token, and no storage code is added anywhere.
- [ ] 2.2 Verify the change performs no contract move: `contracts/security-audit/` is untouched, the frozen `1.0.0` is unchanged, and `check:generated` reports no drift.
- [ ] 2.3 Verify the capability records that cryptographic audit-log chaining is NOT designed and remains unauthorized, and that any future integrity computation is defined over a retention-stable projection so field-level expiry cannot invalidate a retained record.
- [ ] 2.4 Verify the assurance limitation is recorded: the semantics bound what the collector may claim and establish nothing about a durability, confidentiality, or deletion goal of any future deployment.
- [ ] 2.5 Verify the capability records that #115 and #116 remain blocked, and that closing #114 authorizes no implementation, no backend selection, no deployment, and no pilot.

## 3. Verification and governance

- [ ] 3.1 Run `openspec validate --all --strict` and confirm the new change and every existing capability validate.
- [ ] 3.2 Run `check-design-pattern-governance.mjs --phase assessment` and `--phase final`, and `run-governance-dual-check.mjs`, and run the contract-reuse loop over every active change rather than this one alone.
- [ ] 3.3 Run `test:changed-paths` and `test:git` and confirm the staged scope carries no protected-prefix write and the index is empty before commit.

## 4. Fold and archive

- [ ] 4.1 Fold the `collector-storage-semantics` delta into `openspec/specs/collector-storage-semantics/spec.md` in a dedicated commit and PR while this change is active; verify each requirement and scenario occurs exactly once, that no delta header reaches the canonical spec, and that a second application of the delta is a no-op.
- [ ] 4.2 Archive the active change after merge in a separate byte-preserving relocation commit that does not repeat the fold and does not touch `openspec/specs/**`; verify strict OpenSpec validation and that the relocation changes no contract, package, or workflow path.
