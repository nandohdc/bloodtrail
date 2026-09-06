## 1. Proposal

- [ ] 1.1 Land the proposal PR for issue #94 against `origin/main`: the complete packet (`proposal.md`, `design.md`, the `derived-field-trust-semantics` delta spec, `tasks.md`, `assessment.source.json` and its generated `assessment.json`), `openspec validate ratify-derived-field-trust-semantics --strict` passing, the required CI contexts green, and every task unchecked. The diff SHALL modify only paths under `openspec/changes/ratify-derived-field-trust-semantics/` — no `contracts/` path, no `packages/` path, no generated artifact, no workflow.
- [ ] 1.2 Verify the decision is complete against #94's acceptance criteria: materiality, ordering, duplicate, unknown-field and transitive rules are each stated normatively; the maximum-output-trust function is deterministic and worked through; the compatibility and version treatment is recorded; and one invalid-provenance and one excessive-output-trust example each have a single named deterministic outcome.
- [ ] 1.3 Verify the provenance string `delegated to Claude by the owner, 2026-09-06; not a human owner decision` appears verbatim in the capability, and that the capability states in its own text that it authorizes no implementation.

## 2. Scope boundary

- [ ] 2.1 Verify the change performs no contract version move: `contracts/security-audit/` is untouched, the frozen `1.0.0` is unchanged, no generated artifact under `packages/security-audit-sdk-core/src/generated/` moves, and `check:generated` reports no drift.
- [ ] 2.2 Verify that the two-step compatibility consequence is recorded rather than performed — additive introduction at a minor contract version, mandatory enforcement at a major one, each carrying an SDK package version step — and that neither step is taken here.
- [ ] 2.3 Verify the assurance limitation is recorded: the semantics bound what a declared input set implies and do not establish that a producer enumerated its material inputs honestly.

## 3. Verification and governance

- [ ] 3.1 Run `openspec validate --all --strict` and confirm the new change and every existing capability validate.
- [ ] 3.2 Run `check-design-pattern-governance.mjs --phase assessment` and `--phase final`, and `run-governance-dual-check.mjs`, and run the contract-reuse loop over every active change rather than this one alone.
- [ ] 3.3 Run `test:changed-paths` and `test:git` and confirm the staged scope carries no protected-prefix write and the index is empty before commit.

## 4. Fold and archive

- [ ] 4.1 Fold the `derived-field-trust-semantics` delta into `openspec/specs/derived-field-trust-semantics/spec.md` in a dedicated commit and PR while this change is active; verify each requirement and scenario occurs exactly once, that no delta header reaches the canonical spec, and that a second application of the delta is a no-op.
- [ ] 4.2 Archive the active change after merge in a separate byte-preserving relocation commit that does not repeat the fold and does not touch `openspec/specs/**`; verify strict OpenSpec validation and that the relocation changes no contract, package, or workflow path.
