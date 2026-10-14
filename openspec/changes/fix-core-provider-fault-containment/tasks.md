# Tasks — #811

Decision source: owner decision, 2026-10-13, via grilling and triage in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

## 1. Planning
- [x] 1.1 Author six planning artifacts, Q1–Q12, ADDED-only requirement and full security assessment with exact ownership.
- [x] 1.2 Run assessment governance and strict validation before the planning-only commit.

## 2. Runtime
- [ ] 2.1 Contain identifiers, clock, context and schema faults with exact provider attribution and sanitizer.
- [ ] 2.2 Contain arming/unref/cancellation faults with terminal shutdown and earlier-failure precedence.
- [ ] 2.3 Count every exact mutation anchor once externally and run unchanged F08/F10/F11 suites before runtime commit.

## 3. Tests
- [ ] 3.1 Add explicit site matrix with spies, exact count and no throw/rejection/leak/emission assertions.
- [ ] 3.2 Add shutdown, sanitizer and legacy/healthy controls; run build, typecheck and focused tests.

## 4. Documentation
- [ ] 4.1 Add API, migration, glossary, ADR-SDK-015 and Node diagnostic explanations; update only two ADR coherence rules.

## 5. Verification and evidence
- [ ] 5.1 Execute the exact supplied TEST_CMD, including CodeScene delta; record observed commands/results in tasks and invariant evidence.
- [ ] 5.2 Run strict validation, whitespace, exact ownership/subjects and index checks before evidence commit; report committed-head results externally.

## 6. Merge, fold and archive
- [ ] 6.1 Merge after independent review and required checks.
- [ ] 6.2 Fold the added requirement in a separate governed change.
- [ ] 6.3 Archive only after fold lands.

## Evidence

Planning gates executed before Commit 1:
- `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-core-provider-fault-containment` — exit 0; `design-pattern governance passed in assessment phase: enforcement active`.
- `openspec validate fix-core-provider-fault-containment --strict` — exit 0; `Change 'fix-core-provider-fault-containment' is valid`.

No runtime execution evidence is claimed yet. The fixed baseline is 6ee6f57037466ac80fd0b9b181f6e881cde62520. The provisioned feature branch has no upstream, so no pull or baseline move is performed. No approval, independent sensitivity, CI, release or merge claim is made.
