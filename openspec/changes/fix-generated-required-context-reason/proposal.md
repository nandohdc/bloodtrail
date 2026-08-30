## Why

The canonical catalog already requires `reason` for events such as `role_assigned`, and runtime semantic validation rejects a missing `event.outcome_reason.code`. The generated named input type omits that requirement, allowing an invalid call to compile and creating developer-feedback drift from the canonical contract.

## What Changes

- Add a compile-time negative regression showing that a cataloged `reason` event cannot omit `event.outcome_reason`, alongside a positive call with the canonical reason shape.
- Extend the deterministic named-input generator so `required_context: ["reason"]` produces the required `event.outcome_reason` property.
- Regenerate the derived SDK type projection and verify generated drift, type checks, runtime behavior, and contract immutability remain intact.
- Preserve runtime semantic validation as the authoritative enforcement boundary.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

None. This change does not alter a canonical requirement or runtime observable behavior: it corrects the generated TypeScript developer-feedback projection of the existing catalog requirement. `.openspec.yaml` therefore declares `skip_specs: true`.

## Impact

- `packages/security-audit-sdk-core/scripts/generate-contract.mjs`
- `packages/security-audit-sdk-core/src/generated/contract.generated.ts` (regenerated only)
- `packages/security-audit-sdk-core/tests/types/index.ts`
- `openspec/changes/fix-generated-required-context-reason/`
- Tracking issue: #217

No contract source, schema/catalog content, runtime validation behavior, public runtime API, compatibility policy, package metadata, dependency, transport, delivery, storage, production integration, or real-user processing changes.