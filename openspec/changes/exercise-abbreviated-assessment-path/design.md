# Design: Exercise Abbreviated Assessment Path

## Context and Scope

The repository governance framework (`openspec/governance/design-pattern-policy.json`) provides two assessment levels:
- `full`: Required when any of the 8 `full_assessment_triggers` matches.
- `abbreviated`: Eligible when all 5 `abbreviated_criteria` are met and `full_trigger_absence_proof` is provided.

This change exercises the abbreviated assessment level by executing a strictly bounded test hardening within `packages/security-audit-sdk-core/tests/pass1.test.ts`.

## Five Criteria Verification

1. **One bounded correction:** Adds boundary and invalid-configuration validation test assertions for `createInMemoryAuditSink` in `packages/security-audit-sdk-core/tests/pass1.test.ts`.
2. **Introduces no new abstraction:** Reuses existing test infrastructure and testing sink functions.
3. **Adds no new module, class, or interface:** No new files, modules, classes, or types are declared.
4. **Changes no public API surface:** Public exports in `src/index.ts` and `API.md` are unmodified.
5. **Proves that no full_assessment_trigger applies:**
   - `public_api`: False.
   - `integration`: False.
   - `lifecycle_or_state`: False.
   - `concurrency`: False.
   - `persistence`: False.
   - `security_sensitive_behavior`: False (`security_sensitive: false`).
   - `governance_core_path`: False (touches only `packages/security-audit-sdk-core/tests/pass1.test.ts` and change artifacts).
   - `canonical_capability_requirement`: False (`skip_specs: true`).

## Assessment Design

- `assessment_level`: `abbreviated`
- `decision`: `direct_implementation`
- `triggers_matched`: `[]`
- `full_trigger_absence_proof`: Recorded with explicit justification across all triggers.
- `security_sensitive`: `false` with 15-dimension justification.
