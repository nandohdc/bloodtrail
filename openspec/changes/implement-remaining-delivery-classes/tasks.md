## 1. Proposal

- [ ] 1.1 Land the proposal PR for issue #112 against `origin/main`: the complete packet (`proposal.md`, `design.md`, the `security-audit-sdk-node` delta spec, `tasks.md`, `assessment.source.json` and its generated `assessment.json`), `openspec validate implement-remaining-delivery-classes --strict` passing, the required CI contexts green, and every task unchecked. The diff SHALL modify only paths under `openspec/changes/implement-remaining-delivery-classes/`.
- [ ] 1.2 Verify the proposal records the contested reading of #112's "no frozen core/Node API surface is modified" criterion, the three reasons for taking the additive reading, the rejected stricter reading, and the exact revert that would apply the stricter one.

## 2. Implementation

- [ ] 2.1 Add `packages/security-audit-sdk-node/src/delivery-classes.ts` implementing the three bindings, with exact-match class binding refusing a foreign class and an uncatalogued event name through distinct outcomes, before any delivery attempt.
- [ ] 2.2 Implement `best_effort`: exactly one attempt with no retry scheduling, drop on any non-acknowledgment, a saturating bounded loss counter whose ceiling is itself observable, a declared guarantee that it does not provide the `security_significant` guarantees, and an immediate shutdown emitting a health signal in which the delivery claim is structurally absent.
- [ ] 2.3 Implement `transaction_critical`: the fixed probe → commit gate → durability point order, deduplication on event id **and** transaction id together, refusal of an absent transaction id before any probe or gate runs, distinct outcomes recording whether the commit gate was invoked and whether durability was attempted, and a failed delivery remaining retryable rather than deduplicated.
- [ ] 2.6 Decide admission — the duplicate check and its reservation — in one synchronous step before any `await`, so a concurrently reachable duplicate is refused with its own outcome rather than reported delivered or put through a second commit gate, and release the reservation on success and on failure alike.
- [ ] 2.4 Implement `policy_critical`: deterministic construction failure without a complete policy-owner decision record naming an enumerated behaviour, a policy owner, and a review reference; an immutable recorded decision; and a policy-applied result that never reports delivery.
- [ ] 2.5 Add the parameterized conformance suite reading `delivery_class_contracts` from the authored contract source and occurrences from the contract's positive example set, with `security_significant` present as the already-satisfied control, and at least one deterministic negative fixture per implemented class.

## 3. Frozen surface

- [ ] 3.1 Update `scripts/check-exports.mjs`'s frozen value and type lists in this same change, adding only and removing or renaming nothing, and confirm `npm run test:exports` passes and reports no collision with the core's frozen surface.
- [ ] 3.2 Add `adr/002-governed-widening-for-remaining-delivery-classes.md` recording the reading taken, its three reasons, the rejected alternative, and the exact revert that applies the stricter reading.
- [ ] 3.3 Record the widening in `compatibility.json` as an amendment beside the existing `freezeRecord` rather than by rewriting it, so what #111 froze at its evidence commit stays legible.
- [ ] 3.4 Update the pinned source-file counts and baseline coupling inventory in `tests/scope-mutations.test.ts` to match the one added source file, and confirm the null control and positive control both pass.

## 4. Verification and governance

- [ ] 4.1 Run `npm run validate --prefix packages/security-audit-sdk-node` and confirm typecheck, build, runtime tests, scope, exports, dependencies, and package contents all pass.
- [ ] 4.2 Run `make` and confirm the product loop is green across every workspace, and run `npm run validate --prefix packages/security-audit-sdk-core` and `--prefix contracts/security-audit` to confirm no cross-package regression.
- [ ] 4.3 Verify the change touches no `contracts/` path, no generated artifact, no workflow, and no `security-audit-sdk-core` or `security-audit-collector` source, and that `npm run test:scope` still rejects the forbidden production integration tokens.
- [ ] 4.4 Run `openspec validate --all --strict`, `check-design-pattern-governance.mjs --phase assessment` and `--phase final`, `run-governance-dual-check.mjs`, and the contract-reuse loop over every active change.
- [ ] 4.5 Run `test:changed-paths` and `test:git` and confirm the staged scope carries no protected-prefix write and the index is empty before commit.

## 5. Fold and archive

- [ ] 5.1 Fold the `security-audit-sdk-node` delta into `openspec/specs/security-audit-sdk-node/spec.md` in a dedicated commit and PR while this change is active; verify each requirement and scenario occurs exactly once, that no delta header reaches the canonical spec, and that a second application of the delta is a no-op.
- [ ] 5.2 Archive the active change after merge in a separate byte-preserving relocation commit that does not repeat the fold and does not touch `openspec/specs/**`; verify strict OpenSpec validation and that the relocation changes no contract, package, or workflow path.
