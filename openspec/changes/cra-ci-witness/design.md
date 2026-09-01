## Context

The CRA checker is invoked inside the existing `design-pattern-governance` job for every active change. A live positive witness must reach that step, modify one closed CRA trigger path, be attributable to exactly one selected change, and resolve a mechanism against the canonical contract source.

## Goals / Non-Goals

**Goals:**

- Exercise the change-local `security-audit-event-contract` trigger through the real pull-request workflow.
- Produce the distinguishable `CRA-validated pass for cra-ci-witness` result.
- Keep every fixture artifact under one disposable change root.

**Non-Goals:**

- Do not modify the canonical security-audit contract or any generated projection.
- Do not add runtime behavior, dependencies, production integration, publication, or delivery infrastructure.
- Do not merge or archive this witness change.

## Decisions

### Use a change-local contract delta as the trigger

The witness adds `specs/security-audit-event-contract/spec.md` under its own change root. The CRA trigger recognizes that exact selected-change path, while OpenSpec ownership associates the whole change root with only `cra-ci-witness`.

### Reuse the canonical trust-level registry

The assessment-form CRA selects `reuse` and references `registries.trust_levels`. This is a known resolvable mechanism and therefore exercises semantic resolution rather than only structural acceptance.

### Preserve a failing second witness on the same never-merged PR

After the green run completes, a second commit removes only `contract-reuse.json`. The trigger remains, so the same job must fail with `cra-record-missing`. Neither witness commit is eligible to reach `main`.

## Risks / Trade-offs

- A preceding governance step could prevent the CRA step from running. The fixture therefore carries a complete full assessment and complete OpenSpec packet and is preflighted through every preceding local command.
- A new push could cancel an in-progress run. The deletion commit is not pushed until the green run has completed.
