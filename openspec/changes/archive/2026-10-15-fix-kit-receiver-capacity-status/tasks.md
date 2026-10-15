# Tasks — issue #798

Check only executed work; no personal owner approval, CI, merge, fold or archive is claimed. Group 6 records the later merge and fold as they land; the archive follows in a separate PR.

## 1. Planning

- [x] 1.1 Author six planning files, delegated R1–R10 provenance, ADDED-only requirement and exact full assessment ownership.
- [x] 1.2 Execute assessment governance and strict OpenSpec validation before the planning-only commit.

### Observed planning verification — 2026-10-14

- `node openspec/scripts/check-design-pattern-governance.mjs --phase assessment --change fix-kit-receiver-capacity-status` — exit 0: `design-pattern governance passed in assessment phase: enforcement active`.
- Initial strict validation exited 1 for `Requirement text is very long (>500 characters).` Moved documentation/unchanged-bound details into a scenario, retaining exactly one requirement. Re-executed both planning gates successfully before commit 1.
- `openspec validate fix-kit-receiver-capacity-status --strict` — exit 0: `Change 'fix-kit-receiver-capacity-status' is valid`.

## 2. Runtime

- [x] 2.1 Match capacity by diagnostic code, returning 429/fixed reason/no Retry-After while preserving conflict, duplicates and unknown fallback.

## 3. Regression

- [x] 3.1 Add an isolated installed-kit receiver proving 32 × 200, 33–34 × named 429, healthy HTTP 200 and an acknowledged byte-identical duplicate without another admission; extend the gate summary and assertion.
- [x] 3.2 Add and execute the single measured capacity-to-500 receiver control with a capacity-specific failure at loopback-example-exchange, retaining disabled-check fail-closed controls.

## 4. Documentation

- [x] 4.1 Add the wire capacity row and note, preserving the planned-retry line and general rate-limit row.

## 5. Verification and evidence

- [x] 5.1 Execute the supplied build and exact TEST_CMD chain, recording individual exit statuses, named gate output, positive observations and measured negative failure.
- [x] 5.2 Close invariant evidence, run strict OpenSpec/final governance/Git whitespace checks with empty index, inspect ordered commit subjects and owned path boundary before the evidence commit.

### Observed verification — 2026-10-14, before evidence commit

The supplied exact `tamandua-test` wrapper executed the complete ten-command `&&` sequence on the clean four-commit runtime/test/docs tree, with an empty index. It returned exit 0 (executed, not cached). Each conjunct below therefore executed and exited 0. Logs stayed in securely created external temporary files; no log or transport file was added to the worktree. No remote CI result or personal owner approval is claimed.

| Command / gate | Exit | Observed stdout |
| --- | --- | --- |
| `npm run validate --prefix packages/security-audit-sdk-node` | 0 | `ℹ tests 162`; `ℹ pass 162`; `ℹ fail 0`; `package exports verified: 19 value exports, 44 type-only exports, frozen surface matches exactly, no collision with core's frozen surface` |
| `npm run validate --prefix packages/security-audit-collector` | 0 | `ℹ tests 92`; `ℹ pass 92`; `ℹ fail 0` |
| `npm run validate --prefix contracts/security-audit` | 0 | `ℹ tests 17`; `ℹ pass 17`; `ℹ fail 0` |
| `npm run check:generated --prefix packages/security-audit-sdk-core` | 0 | `generated SDK contract artifacts are current` |
| `npm run test:changed-paths --prefix packages/security-audit-sdk-core` | 0 | `changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1506 visible records; {"unrelated-history-or-worktree":1294,"local-instruction-unrelated":1,"event-contract":85,"archived-remediation":8,"active-remediation":6,"sdk-capability":1,"sdk-package":113,"unrelated-deletion":1}; ignored files excluded by standard Git semantics` |
| `openspec validate fix-kit-receiver-capacity-status --strict` | 0 | `Change 'fix-kit-receiver-capacity-status' is valid` |
| `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base origin/main` | 0 | `design-pattern governance passed in final phase: enforcement active; inspected 4 commit(s) and 12 path(s) from origin/main` |
| `node packages/security-audit-sdk-core/scripts/check-git-state.mjs` | 0 | `Git whitespace/final-newline checks passed and index is empty` |
| `make test` | 0 | `Product test loop passed across every declared workspace (~45s local, 2026-09-10).` Core 338, Node 162, browser 71, collector 92, contract 17, envelope 18 and research 11 tests passed; Node kit gate and controls ran again |
| Supplied `cs53-check.sh delta "$PWD"` (CodeScene CLI 1.0.53) | 0 | `no findings` and `cs delta exit=0` |

The supplied build chain also executed before the full suite: `npm run build --prefix packages/security-audit-sdk-core && npm run build --prefix packages/security-audit-sdk-node && npm run build --prefix packages/client-evidence-browser && npm run build --prefix packages/security-audit-collector` — exit 0, all four conjuncts exit 0. Node validate's `typecheck` and installed-kit strict TypeScript matrix passed; the gate reported `examples, document blocks, and failure-path program type-checked under strict consumer settings with TypeScript 5.9.2, 6.0.3, and 7.0.2`.

#### Positive capacity observations

The successful `loopback-example-exchange` summary contained verbatim:

> on a separate fresh receiver, 32 distinct identities were acknowledged with 200, identities 33 and 34 received 429 deduplication_capacity without Retry-After, health remained 200/healthy, and an admitted duplicate was acknowledged with 200 without another admission

The executed probe asserted the fixed response text `{"error":"deduplication_capacity"}`, an absent `retry-after` header on both refusals, exactly one matching accepted acknowledgment on every admitted event and duplicate, and health counts `(acceptedCount, duplicateCount, rejectedCount)` of `(32, 0, 2)` before the duplicate and `(32, 1, 2)` after it. The duplicate used the first admission's identical JSON bytes. Other probes used the original receiver and continued to pass conflict, SDK validation, authentication, routing, body bounds and abort cases. Child cleanup remained in finally around readiness and assertions.

#### Measured negative observation

`test:kit-controls` reported verbatim:

> receiver control verified at loopback-example-exchange: deduplication capacity: expected 429, got 500 (one measured plant)

Its aggregate reported `evaluation kit negative controls passed: 90 measured plants across 81 of 81 controls, and each failed closed at its declared identity:` including `receiver disguising deduplication capacity as 500 [loopback-example-exchange]` once. The string anchor matched once and changed bytes in a disposable resealed kit; the gate rejected at the required check identity and its cause contained the capacity-specific failure. The infrastructure and disabled-check proofs passed, so a missing check does not masquerade as a passing control. This is a measured rejection, not an unrelated typecheck/integrity failure.

#### Corrections observed during verification

Earlier exact-wrapper attempts exited 1 within Node validation, before later commands executed:

- `planned-feature-documentation` rejected the added retry prose for lacking planned markers (`violates sentence marker rule`). The documentation now explicitly labels automatic delivery retry planned; the existing `No delivery retry (planned)` line remains unchanged.
- `test:kit-controls` reported `the control table must declare every expected control` / `81 !== 80`. Updated the existing exact-count assertion to include the new control once.
- The symlink null control reported `a symlinked --kit-dir gate must print its verification summary` because a new observation log preceded the summary. Removed that extra probe log, preserving the existing stdout contract; the truthful gate summary records the proof instead.

All corrections were incorporated into their respective required test/docs commits, not extra commits. The final exact wrapper reran every command successfully. A separate pre-suite CodeScene invocation also exited 0 with `no findings` and `cs delta exit=0`.

#### Pre-evidence-commit closure

After editing the evidence, re-executed `openspec validate fix-kit-receiver-capacity-status --strict`, final design-pattern governance with `--base origin/main`, `check-git-state.mjs` and `git diff --check`: each exit 0. Outputs remained `Change 'fix-kit-receiver-capacity-status' is valid`, `design-pattern governance passed in final phase: enforcement active; inspected 4 commit(s) and 12 path(s) from origin/main`, and `Git whitespace/final-newline checks passed and index is empty`.

The pre-evidence history/path/byte inspection exited 0 and printed:

> Pre-evidence inspection passed: four exact ordered commits, standalone Refs/co-author footers, planning-only six paths, receiver-only commit, exactly 12 owned paths; unchanged canonical specs/collector/Core/contracts and retry/rate-limit lines; empty index; no CR/trailing whitespace/missing final newlines.

The fifth commit is limited to this change's evidence. No post-commit check result is recorded here; any such result belongs only in the external completion report.

## 6. Landing (outside this story)

- [x] 6.1 Merge. PR #820 was merged into `main` by the maintainer as merge commit `958e7ebb4b162d1a1423140b510bf1037cb6e1df`.
- [x] 6.2 Fold into canonical specs. Folded into `openspec/specs/security-audit-sdk-node/spec.md` while the change is active, in this dedicated fold PR (ADR 0001).
- [x] 6.3 Archive. Evidence: relocated to `openspec/changes/archive/2026-10-15-fix-kit-receiver-capacity-status/` in this commit, after fold PR #823 merged as `006d1e99b662f467c78c1ecf3ae4d8a054ca95a0`.

## Observed fold evidence — 2026-10-15, run 139, Node v26.11.1

The supplied exact `tamandua-test` TEST_CMD executed the complete nine-command `&&` sequence before this fold commit, with an empty index, and exited 0. The documented `TAMANDUA_TSTX=0` passthrough was enabled for the uncommitted fold edits: every gate ran, without caching or ledger attribution. Each conjunct therefore executed and exited 0. Logs and mechanical regression assertions stayed in securely created external temporary files; no committed test or transport file was added.

| Gate / exact command | Exit | Observed result |
| --- | --- | --- |
| Generated artifacts: `npm run check:generated --prefix packages/security-audit-sdk-core` | 0 | `generated SDK contract artifacts are current` |
| Coherence: `npm run test:coherence --prefix packages/security-audit-sdk-core` | 0 | `cross-artifact coherence passed in archived mode for remediate-security-audit-sdk-adversarial-review`: contract 2.1.0, 24 catalog events/24 named APIs, 0 runtime dependencies, 91/91 current-change tasks complete. That historical mode does not archive this active change. |
| Changed paths: `npm run test:changed-paths --prefix packages/security-audit-sdk-core` | 0 | `changed-path policy passed in archived mode for remediate-security-audit-sdk-adversarial-review: 1529 visible records`; ignored files excluded by standard Git semantics. |
| Contract: `npm run validate --prefix contracts/security-audit` | 0 | `Security audit contract validation passed.`; 17 tests passed, 0 failed. |
| Active change: `openspec validate fix-kit-receiver-capacity-status --strict` | 0 | `Change 'fix-kit-receiver-capacity-status' is valid` |
| Canonical spec: `openspec validate security-audit-sdk-node --type spec` | 0 | `Specification 'security-audit-sdk-node' is valid`; zero ERRORs and exactly 26 WARNINGs, all `Requirement text is very long (>500 characters)`, unchanged from the pinned-base baseline. No new warning. |
| Final governance: `node openspec/scripts/check-design-pattern-governance.mjs --phase final --base 0936e745744c3a2d2b5204b98a7e2d9d7977b1a6` | 0 | `design-pattern governance passed in final phase: enforcement active; inspected 0 commit(s) and 0 path(s) from 0936e745744c`. Expected and vacuous by design: this gate inspects committed ranges only, and HEAD still equals the pinned base. This is not material coverage of the uncommitted fold; the post-commit result belongs only in the external report. |
| Git state: `node packages/security-audit-sdk-core/scripts/check-git-state.mjs` | 0 | `Git whitespace/final-newline checks passed and index is empty` |
| Product loop: `make test` | 0 | `Product test loop passed across every declared workspace (~45s local, 2026-09-10).` Core 674, Node 162, browser 71, collector 92, contract 17, envelope 18 and research 11 tests passed, with zero failures. Kit verification and 90 measured plants across 81 of 81 negative controls passed. Full governance-gate chains were not run. |

The supplied build command also executed before this commit: `npm run build --prefix packages/security-audit-sdk-core && npm run build --prefix packages/security-audit-sdk-node && npm run build --prefix packages/client-evidence-browser && npm run build --prefix packages/security-audit-collector` — exit 0, all four conjuncts exit 0. The product loop's Core and Node typechecks passed; the installed-kit strict consumer matrix passed with TypeScript 5.9.2, 6.0.3 and 7.0.2.

Pre-commit mechanical regression assertions exited 0: the pinned-base canonical bytes remain an unchanged prefix; the careful-ingress requirement is byte-identical; the appended requirement equals the delta block byte for byte; its heading and all four scenario headings occur exactly once; no operation header enters the canonical spec; a second append-if-absent fold produces identical bytes; the canonical diff has zero deletions; exactly the two allowed paths changed; all other active-change files remain byte-identical. The empty-index, CR-byte, trailing-whitespace and final-newline assertions and `git diff --check` also passed. No approval, remote CI, fold merge or archive completion is claimed. No post-commit result is recorded here.
