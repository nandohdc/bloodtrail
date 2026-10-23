# Align the SDK core with the catalog's tenant and failed-authentication rules: #861 and #862

## Why

Stage P run 3 (P-attr, system ADR 0014) recorded two places where the SDK core and the frozen contract can be read
two ways.

- **#861.** The SDK refuses an event whose claimed tenant conflicts with its effective tenant
  (`TENANT_RESOURCE_CONFLICT` at `/tenant/claimed_tenant_id`). The contract scenario "Client claims a different
  tenant" retains such a claim "only as an untrusted claim if policy permits".
  - The SDK's canonical spec already requires the refusal ("Claimed tenant conflicts with authenticated scope").
  - What is missing is a record that the refusal is the SDK's policy, and the host path that keeps the claim.
- **#862.** The SDK accepts a failed authentication that names an **account** as its target. Its catalog
  resource rule is "credential type only when safe".
  - P-attr recorded these as accepted misrepresenting carriers: an account `subject` (AF-C4, AF-C5), a
    typeless display-only `subject` (AF-C3s), a credential plus an account `subject` (AF-C6s), and an
    account-typed `resource` (AF-CR).
  - The contract's own approved example carries a **credential** `subject`, `credential.reference`,
    `credential.key_id` and a credential `resource.id`. So the rule must judge the target's type, not the
    presence of a field.

## What Changes

- **#861, record only.** New ADR-SDK-018 records the refusal as SDK policy, under the contract's "if policy
  permits", and documents the host path: drop the claim from the original event, and carry it on
  `tenant.context_violation.detected`, which already keeps the claimed and authoritative tenants side by side.
  - There is no code change.
  - Existing `tests/pass2.test.ts` tests cover both halves.
- **#862, one SDK-only semantic rule** in `src/validation/semantic.ts`, run after every other semantic check. On
  `bloodtrail.audit.authentication.failed` it refuses:
  - a `subject` typed other than `credential`, or carrying an `id` or `tenant_id` without a type, at `/subject/type`;
  - a `subject` carrying a `display_name`, at `/subject/display_name`;
  - a `resource` typed other than `credential`, or one carrying an `id` without a type, at `/resource/type`;
  - a `resource` naming a parent, at `/resource/parent_type` or `/resource/parent_id`;
  - an `authorization.resource_context` naming something other than the credential, at
    `/authorization/resource_context/type`.

  The SDK's own derived resource (`{ operation_type: "execute" }`) and the approved example stay accepted. The
  refusal is `SDK_SEMANTIC_VALIDATION_FAILED` / `validation`, with no sink call, on named methods, `emit()`,
  `redeliver()` and free `validateSecurityAuditEvent()`. Old events get no `redeliver()` exemption.
- **Records:**
  - ADR-SDK-019;
  - an ADDED `security-audit-sdk-core` requirement;
  - a MIGRATION entry;
  - API and SECURITY guidance;
  - the glossary term "Target-bearing field";
  - a widened Node error-catalog entry;
  - coherence ADR pins through 019.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: add "Failed authentication carries only a credential target". The existing
  canonical requirements stay byte-identical, and the delta is ADDED only.

## Impact

- **Classification:**
  - #862 is a non-breaking `fix(sdk-core)` with migration guidance, following the #812 precedent.
  - #861 changes no behaviour.
- **Unchanged:**
  - public types, exports and error codes;
  - frozen contract `2.1.0`, collector admission and generated artifacts;
  - every other event and the actor fields.
- **Not judged:** a keyed `credential.reference` (AF-C6) and a credential-typed `resource.id` (AF-CR's credential
  half) stay accepted. They are structurally identical to the approved example, and the SDK cannot establish
  where a value came from (P-D). The fraud-evidence profile and host conformance remain their controls.

## Decided authority

Decision source: owner decision, 2026-10-22, via AskUserQuestion and grilling in Claude Code session
https://claude.ai/code/session_012Y6oT9KjPZ1BMvT63hU3ay. The owner accepted every recommended option, then revised
#862's rule to a type rule after the approved example was found to carry credential fields.

- #861 triage: https://github.com/nandohdc/bloodtrail/issues/861#issuecomment-6346905800
- #862 triage: https://github.com/nandohdc/bloodtrail/issues/862#issuecomment-6346907319
- #862 revision: https://github.com/nandohdc/bloodtrail/issues/862#issuecomment-6352407345
- Authoring lane and merges (G45): https://github.com/nandohdc/bloodtrail/issues/795#issuecomment-6346915049

## Non-goals

- No contract change, contract follow-up issue or tenant-claim retention.
- No enforcement on other event families, on actor fields, or on provenance, which the SDK cannot establish.
- No new error code, export or source file.
