# Tasks — issue #798

Check only executed work; no personal owner approval, CI, merge, fold or archive is claimed.

## 1. Planning

- [x] 1.1 Author six planning files, delegated R1–R10 provenance, ADDED-only requirement and exact full assessment ownership.
- [x] 1.2 Execute assessment governance and strict OpenSpec validation before the planning-only commit.

### Observed planning verification — 2026-10-14

- `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-kit-receiver-capacity-status` — exit 0: `design-pattern governance passed in assessment phase: enforcement active`.
- Initial strict validation exited 1 for `Requirement text is very long (>500 characters).` Moved documentation/unchanged-bound details into a scenario, retaining exactly one requirement. Re-executed both planning gates successfully before commit 1.
- `openspec validate fix-kit-receiver-capacity-status --strict` — exit 0: `Change 'fix-kit-receiver-capacity-status' is valid`.

## 2. Runtime

- [ ] 2.1 Match capacity by diagnostic code, returning 429/fixed reason/no Retry-After while preserving conflict, duplicates and unknown fallback.

## 3. Regression

- [ ] 3.1 Add an isolated installed-kit receiver proving 32 × 200, 33–34 × named 429, healthy HTTP 200 and an acknowledged byte-identical duplicate without another admission; extend the gate summary and assertion.
- [ ] 3.2 Add and execute the single measured capacity-to-500 receiver control with a capacity-specific failure at loopback-example-exchange, retaining disabled-check fail-closed controls.

## 4. Documentation

- [ ] 4.1 Add the wire capacity row and note, preserving the planned-retry line and general rate-limit row.

## 5. Verification and evidence

- [ ] 5.1 Execute the supplied build and exact TEST_CMD chain, recording individual exit statuses, named gate output, positive observations and measured negative failure.
- [ ] 5.2 Close invariant evidence, run strict OpenSpec/final governance/Git whitespace checks with empty index, inspect ordered commit subjects and owned path boundary before the evidence commit.

## 6. Landing (outside this story)

- [ ] 6.1 Merge.
- [ ] 6.2 Fold into canonical specs.
- [ ] 6.3 Archive.
