# Tasks — #811

Decision source: owner decision, 2026-10-13, via grilling and triage in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

## 1. Planning
- [x] 1.1 Author six planning artifacts, Q1–Q12, ADDED-only requirement and full security assessment with exact ownership.
- [x] 1.2 Run assessment governance and strict validation before the planning-only commit.

## 2. Runtime
- [x] 2.1 Contain identifiers, clock, context and schema faults with exact provider attribution and sanitizer.
- [x] 2.2 Contain arming/unref/cancellation faults with terminal shutdown and earlier-failure precedence.
- [x] 2.3 Count every exact mutation anchor once externally and run unchanged F08/F10/F11 suites before runtime commit.

## 3. Tests
- [x] 3.1 Add explicit site matrix with spies, exact count and no throw/rejection/leak/emission assertions.
- [x] 3.2 Add shutdown, sanitizer and legacy/healthy controls; run build, typecheck and focused tests.

## 4. Documentation
- [x] 4.1 Add API, migration, glossary, ADR-SDK-015 and Node diagnostic explanations; update only two ADR coherence rules.

## 5. Verification and evidence
- [x] 5.1 Execute the exact supplied TEST_CMD, including CodeScene delta; record observed commands/results in tasks and invariant evidence.
- [x] 5.2 Run strict validation, whitespace, exact ownership/subjects and index checks before evidence commit; report committed-head results externally.

## 6. Merge, fold and archive
- [ ] 6.1 Merge after independent review and required checks.
- [ ] 6.2 Fold the added requirement in a separate governed change.
- [ ] 6.3 Archive only after fold lands.

## Observed evidence — 2026-10-14, Node v26.11.1

These are pre-fifth-commit observations, not claims about the future evidence commit. The fixed baseline is `6ee6f57037466ac80fd0b9b181f6e881cde62520`. The provisioned feature branch has no upstream, so no pull or baseline move was performed. No approval, independent old-code sensitivity, remote CI, release, production authorization or merge claim is made. Logs and transport/audit scripts stayed outside the worktree.

### Planning (1.2)

Both executed before the planning-only commit, exit 0:
- `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-core-provider-fault-containment`: `design-pattern governance passed in assessment phase: enforcement active`.
- `openspec validate fix-core-provider-fault-containment --strict`: `Change 'fix-core-provider-fault-containment' is valid`.

### Runtime and focused verification (2.1–3.2)

- `npm run build --prefix packages/security-audit-sdk-core`: exit 0; `generated SDK contract artifacts written`; tracked generated artifacts remained unchanged.
- `npm run typecheck --prefix packages/security-audit-sdk-core`: exit 0 (`tsc -p tsconfig.json --noEmit`).
- From Core: `./node_modules/.bin/tsc -p tsconfig.test.json && node --test dist-tests/provider-fault-containment.test.js`: exit 0; `ℹ tests 52`, `ℹ pass 52`, `ℹ fail 0`, `ℹ cancelled 0`, `ℹ skipped 0`. Includes 25 exact matrix rows and 27 count/sanitizer/shutdown/legacy/healthy controls. Initial focused compilation needed the required empty correlation context; initial sanitizer assertion used the wrong bound, corrected to the existing 160-character bound before this passing run.
- External exact-occurrence script counted all 13 distinct F08/F11 oldText anchors plus the F10 runtime guard (14 total after deduplication), including complete named-redelivery/SDK redeliver blocks, with count 1 each: `all exact anchors occur once`. Executed before runtime commit and rechecked before evidence. No verification test or mutant was committed.
- `bash -c 'cd packages/security-audit-sdk-core && node --test tests/verification/f08-mutations.test.mjs tests/verification/f10-mutations.test.mjs tests/verification/f11-mutations.test.mjs'`: exit 0 before runtime commit; `ℹ tests 21`, `ℹ pass 21`, `ℹ fail 0`; compile-valid mutants rejected by their existing guards.
- The external source comparison confirms the default cjsSchemaRuntime body is byte-identical to baseline; the new default invalid-event control asserts the baseline `{ ok: false, error: { code: "SDK_MISSING_EVENT_FIELD", category: "validation", path: "/event" } }`.
- `bash /private/tmp/claude-501/-Users-fernando-costa-Git-bloodtrail/1cc06ce2-3b01-443f-b2f3-a249a0f65c8f/scratchpad/scripts/cs53-check.sh review "$PWD" packages/security-audit-sdk-core/tests/provider-fault-containment.test.ts`: exit 0; `file score 10.0` on the final test file.

### Full supplied TEST_CMD (5.1)

Executed verbatim on the clean four-commit tree before evidence edits, exit 0; not cached. The wrapper ran every conjunct; the final output was `no findings` and `cs delta exit=0`.

```bash
tamandua-test --repo '/Users/fernando.costa/.tamandua/worktrees/bloodtrail-5311402e/127-e1a44e4d' --run 'e1a44e4d-9b0c-4b90-8271-7c0a63698f7b' --step 'fe747594-9b83-4431-bf01-dd0973ffb245' -- 'npm run check:generated --prefix packages/security-audit-sdk-core && npm run test:matrix --prefix packages/security-audit-sdk-core && npm run test:coherence --prefix packages/security-audit-sdk-core && npm run test:changed-paths --prefix packages/security-audit-sdk-core && npm run validate --prefix contracts/security-audit && npm run validate --prefix packages/security-audit-sdk-node && bash -c '\''cd packages/security-audit-sdk-core && node --test tests/verification/f08-mutations.test.mjs tests/verification/f10-mutations.test.mjs tests/verification/f11-mutations.test.mjs'\'' && node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main && node packages/security-audit-sdk-core/scripts/check-git-state.mjs && make test && bash /private/tmp/claude-501/-Users-fernando-costa-Git-bloodtrail/1cc06ce2-3b01-443f-b2f3-a249a0f65c8f/scratchpad/scripts/cs53-check.sh delta "$PWD"'
```

Each command below exited 0 in that run:

- `npm run check:generated --prefix packages/security-audit-sdk-core`: `generated SDK contract artifacts are current`.
- `npm run test:matrix --prefix packages/security-audit-sdk-core`: `ℹ tests 390`, `ℹ pass 390`, `ℹ fail 0`; build/typecheck, type tests, documentation examples, compatibility, scope and dependencies passed. `package exports verified: 61 value exports, 92 type-only exports, frozen surface matches exactly`.
- `npm run test:coherence --prefix packages/security-audit-sdk-core`: `cross-artifact coherence passed in archived mode for remediate-security-audit-sdk-adversarial-review: contract 2.1.0, 24 catalog events/24 named APIs, 0 runtime dependencies, 91/91 current-change tasks complete`. The archived mode refers to the historical remediation, not this active change; the ADR rules now require 001..015.
- `npm run test:changed-paths --prefix packages/security-audit-sdk-core`: `changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1508 visible records; {"unrelated-history-or-worktree":1294,"local-instruction-unrelated":1,"event-contract":85,"archived-remediation":8,"active-remediation":6,"sdk-capability":1,"sdk-package":115,"unrelated-deletion":1}; ignored files excluded by standard Git semantics`.
- `npm run validate --prefix contracts/security-audit`: `ℹ tests 17`, `ℹ pass 17`, `ℹ fail 0` and deterministic generated artifacts passed.
- `npm run validate --prefix packages/security-audit-sdk-node`: `ℹ tests 162`, `ℹ pass 162`, `ℹ fail 0`; typecheck/build, frozen exports, scope, compatibility, dependency/package and evaluation-kit checks passed. Deliberate failing plants ended in the passing negative-control summary.
- `bash -c 'cd packages/security-audit-sdk-core && node --test tests/verification/f08-mutations.test.mjs tests/verification/f10-mutations.test.mjs tests/verification/f11-mutations.test.mjs'`: `ℹ tests 21`, `ℹ pass 21`, `ℹ fail 0`.
- `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main`: `design-pattern governance passed in final phase: enforcement active; inspected 4 commit(s) and 17 path(s) from origin/main`.
- `node packages/security-audit-sdk-core/scripts/check-git-state.mjs`: `Git whitespace/final-newline checks passed and index is empty`.
- `make test`: Core 390, Node 162, browser 71, collector 92, contract 17, envelope 18 and research 11 tests passed. `Product test loop passed across every declared workspace (~45s local, 2026-09-10).` Its notice explicitly says full governance-gate chains were NOT run; no complete Core validate or make governance-gates claim is made.
- `bash /private/tmp/claude-501/-Users-fernando-costa-Git-bloodtrail/1cc06ce2-3b01-443f-b2f3-a249a0f65c8f/scratchpad/scripts/cs53-check.sh delta "$PWD"`: `no findings`, `cs delta exit=0` (CLI 1.0.53).

### Pre-evidence closure (5.2)

Build/typecheck, strict validation, final governance, Git-state and `git diff --check` reran successfully after the full sequence. Strict validation printed `Change 'fix-core-provider-fault-containment' is valid`; final governance inspected four commits and 17 paths, and Git-state again reported an empty index.

External structural audit, exit 0: `ownership/subjects/path-groups/Refs/co-author/whitespace/index passed: 4 commits, 17 exact paths; default runtime body unchanged`. This checked the four executed exact subjects and their exclusive path groups, standalone Refs #811 and co-author footers, exact assessment ownership equality with the complete diff, LF/final newlines/no trailing whitespace, empty index and unchanged default-runtime implementation. Only this tasks file and assessment.json are updated for the fifth evidence commit. Committed-head checks will be executed and reported externally, not retroactively recorded as pre-commit evidence.
