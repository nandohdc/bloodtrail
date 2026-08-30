## Context

See `proposal.md` for motivation. ADR-SDK-002 requires named input metadata to be generated from catalog `required_context` while retaining runtime validation as the authoritative enforcement boundary. The current generator maps other tokens but omits `reason`; runtime semantic validation already rejects an emitted event without `event.outcome_reason.code`.

## Goals / Non-Goals

**Goals:**

- Make generated named input types require the canonical non-nullable `event.outcome_reason` shape whenever the catalog requires `reason`.
- Prove the behavior at the public TypeScript API seam with a negative `@ts-expect-error` control and an adjacent valid call.
- Preserve byte-checked generator ownership of `src/generated/contract.generated.ts`.

**Non-Goals:**

- Do not alter the contract source, catalog, schema, required-context vocabulary, runtime semantic validation, compatibility policy, or package version.
- Do not add a runtime API, event field, dependency, transport, delivery behavior, storage, production integration, or real-user data processing.
- Do not create a handwritten event-specific input override or a second metadata table for reason-required events.

## Decisions

### Add one `reason` branch to the existing required-context projection

`RequiredContextProperty` will map `reason` to a required `event` property whose `outcome_reason` uses `NonNullable<SecurityAuditEvent["event"]["outcome_reason"]>`. The existing intersection with `EventBuilderBaseInput` composes this narrow requirement with each event's generated phase/outcome/operation constraints.

**Alternative considered: handwritten per-event type overrides.** Rejected because it duplicates catalog membership outside the deterministic generator, so newly cataloged reason-required events can drift from the type projection.

### Use `roleAssigned` as the public compile-time regression seam

The frozen catalog declares `reason` in `role_assigned.required_context`; the current type fixture has a valid call containing `event.outcome_reason`. An adjacent call omitting that field will carry `@ts-expect-error`, which must be unused before the generator change and consumed after it.

**Alternative considered: test the emitted generated conditional type directly.** Rejected because it would prove private generator text rather than the public named-method API developers compile against.

### Keep runtime and contract controls unchanged

The generator supplies developer feedback only. Existing semantic validation continues to issue `SDK_MISSING_EVENT_FIELD` at `/event/outcome_reason/code` for malformed runtime input, and `test:contract-immutability` continues to prove no frozen contract mutation.

**Alternative considered: add a parallel runtime check.** Rejected because it duplicates an existing enforcement path and would alter error ownership without addressing the compile-time projection gap.

## Risks / Trade-offs

- [A broad event requirement affects methods without cataloged `reason`] → The type-level negative control targets `roleAssigned`; the adjacent positive call and complete type suite prove existing method inputs remain valid.
- [A handwritten generated edit masks a generator/projection mismatch] → Change only the generator, regenerate, and require `check:generated` before freezing the candidate.
- [The compile-time repair is mistaken for a contract change] → Proposal, tasks, changed-path allowlist, and contract-immutability verification exclude contract source/catalog/schema changes.
- [Runtime behavior inadvertently changes] → Run the runtime suite and retain semantic validation source unchanged in the exact candidate scope.

## Migration Plan

1. Add the failing public type-level omission control to the current fixture and run `test:types` to establish the unused-expect-error RED state.
2. Add the narrow generator mapping, regenerate derived output, and rerun `test:types` plus `check:generated`.
3. Complete the scoped runtime, contract, OpenSpec, governance, and isolated full-SDK validation evidence before the separate technical commit.
4. A revert removes the generated type requirement and restores the prior developer-feedback behavior; no persisted data, runtime protocol, or compatibility migration exists.
