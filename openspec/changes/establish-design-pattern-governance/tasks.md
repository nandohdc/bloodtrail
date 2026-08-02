## 1. Authorization gate and policy baseline

- [ ] 1.1 Obtain and record explicit project-owner authorization to apply the exact proposal commit, including the permitted governance/documentation/workflow/checker scope, production exclusions, and stop conditions; do not begin tasks 1.2 through 9.7 without this authorization.
- [ ] 1.2 Capture the exact pre-apply Git tree and object IDs for the active `remediate-security-audit-sdk-adversarial-review` change, canonical OpenSpec specs, all archived OpenSpec evidence, SDK paths, contract paths, research paths, and repository-managed Hermes skill baseline.
- [ ] 1.3 Finalize one controlled vocabulary for assessment levels, decisions, checker phases, force IDs, pattern IDs, invariant IDs, abstraction IDs, evidence references, and re-evaluation triggers across capability, design, templates, schemas, checker, fixtures, tests, and reports.
- [ ] 1.4 Materialize `openspec/design-pattern-governance.json` with policy version, activation parent tree, provenance-backed active-change proposal commit/tree/blob fingerprints, phased-adoption state, required catalog IDs, governed path classifications, protected-history roots, and bounded repository-relative path rules.
- [ ] 1.5 Confirm the repository-level placement of OpenSpec-owned schemas, scripts, tests, and fixtures without introducing a root package or coupling governance to `packages/security-audit-sdk-core`.
- [ ] 1.6 Record and test the non-goals prohibiting production deployment, publication, framework/vendor integration, broad implementation refactoring, archived-evidence rewriting, and replacement of domain-specific requirements.

## 2. Assessment and ADR templates

- [ ] 2.1 Create `docs/architecture/design-pattern-assessment-template.md` with the required Problem, Architectural forces, Constraints, Candidate patterns, Selected approach, Rejected alternatives, Simplicity check, Security and correctness implications, Pattern invariants, Verification strategy, and Re-evaluation triggers sections.
- [ ] 2.2 Add the versioned embedded-JSON governance metadata block to the assessment template, including all controlled IDs, decision relations, security sensitivity, introduced abstractions, verification-task references, and final-correspondence task reference.
- [ ] 2.3 Define the bounded `abbreviated` template for one-behavior trivial corrections, requiring an explicit `direct_implementation` decision, simplicity reason, focused test, and proof that no full-assessment trigger applies.
- [ ] 2.4 Add an applicability rubric that requires `full` assessment for abstractions, lifecycle/state, concurrency, integrations, persistence/transactions, public APIs, or security-sensitive behavior and rejects unbounded self-classification as trivial.
- [ ] 2.5 Create `docs/architecture/adr-design-pattern-template.md` with decision forces, selected/rejected patterns, invariants, consequences, compatibility, security, concurrency, verification, re-evaluation, owner, date, and exact reviewed-commit fields.
- [ ] 2.6 Add compact fictional examples for a valid no-pattern decision and a justified named-pattern decision without introducing or claiming production implementation.
- [ ] 2.7 Add deterministic template checks proving required headings occur exactly once outside fenced examples and that metadata and human-readable IDs remain coherent.

## 3. Practical TypeScript and Node.js pattern catalog

- [ ] 3.1 Create `docs/architecture/design-pattern-catalog.md` with a non-exhaustive scope statement, evidence-before-abstraction rules, direct-implementation guidance, category index, and stable pattern IDs.
- [ ] 3.2 Document Adapter, Strategy, State, Command, Factory, Builder, Facade, Decorator, and Specification under Core design patterns.
- [ ] 3.3 Document Repository, Unit of Work, Domain Service, and Immutable Value Object under Domain and persistence patterns.
- [ ] 3.4 Document Capability, Explicit Trust Boundary, Fail Closed, and Authority Provenance under Security and authority patterns.
- [ ] 3.5 Document Idempotency Key, Atomic Reservation, Transactional Outbox, Circuit Breaker, Bulkhead, and Bounded Retry under Concurrency and resilience patterns.
- [ ] 3.6 For each of the 23 entries, provide intent, use when, avoid when, required invariants, practical TypeScript/Node.js shape, security implications, concurrency implications, minimum verification, common misuse, and related patterns.
- [ ] 3.7 Add force-to-candidate guidance and explicit misuse examples for persistence-free Repository, one-implementation Strategy, simple-construction Builder/Factory, obscuring wrapper chains, ceremonial interfaces, and pattern names without invariants.

## 4. Repository-managed Hermes workflow integration

- [ ] 4.1 Re-read and minimally patch `.hermes/skills/openspec-apply-change/SKILL.md`, preserving its generated metadata, OpenSpec status/context handling, task loop, pause behavior, and existing guardrails.
- [ ] 4.2 Require the apply workflow to read the canonical `software-design-pattern-governance` capability and the target change assessment, with an explicit active-delta bootstrap path only while this governance change itself is unarchived.
- [ ] 4.3 Insert the governed sequence: inspect repository architecture, complete or verify assessment, select named pattern or `direct_implementation`, run assessment validation, implement, add invariant and misuse tests, and run final correspondence review.
- [ ] 4.4 Require Hermes to pause and update or request update of the assessment before introducing an unassessed abstraction or materially diverging from the validated participants, ownership, boundaries, lifecycle, concurrency, or failure behavior.
- [ ] 4.5 Require implementation reports to state decision, forces, reasons, rejected alternatives, introduced abstractions, implementation correspondence, invariant tests, unresolved risks, and potential over-engineering concerns.
- [ ] 4.6 Verify the workflow does not treat pattern names, checker success, AI review, PR assignment, or informal messages as correctness proof or project-owner approval, and prove no user-home, profile-specific, ignored, or unrelated local instruction file changed.

## 5. Deterministic governance checker

- [ ] 5.1 Create a closed, versioned JSON Schema at `openspec/schemas/design-pattern-assessment.schema.json` for full and abbreviated assessment metadata, controlled values, bounded strings/arrays, unique IDs, and conditional decision relations.
- [ ] 5.2 Create a closed, versioned JSON Schema at `openspec/schemas/design-pattern-correspondence.schema.json` for assessment digest, exact implementation commit, participants, path mappings, abstractions, invariants, test evidence, security misuse evidence, divergences, risks, reviewer identity, and assurance limitations.
- [ ] 5.3 Implement `openspec/scripts/check-design-pattern-governance.mjs` as a dependency-free, read-only Node.js CLI with stable sorted diagnostics, normalized repository-relative paths, traversal rejection, bounded file/diagnostic handling, and nonzero objective-failure status.
- [ ] 5.4 Implement relational assessment checks for exactly one assessment/metadata block, applicable assessment level, force/constraint/candidate IDs, named-pattern or `direct_implementation` decision, selected force/invariant links, rejected-alternative reasons, simplicity evidence, and re-evaluation triggers.
- [ ] 5.5 Implement explicit `assessment`, `implementation`, and `final` phases plus `--change`, `--base`, `--review-target`, and `--all-applicable` argument validation without persistent mutable lifecycle state.
- [ ] 5.6 Implement deterministic full-versus-abbreviated trigger checks using metadata, task/spec declarations, configured path classes, changed-path evidence, and fail-closed handling for unclassified implementation paths.
- [ ] 5.7 Implement security-sensitive checks for trust, authority/provenance, mutation, failure posture, concurrency, misuse, bypass, and controlling domain-requirement references.
- [ ] 5.8 Implement task, catalog, template, workflow, abstraction, invariant-test, security-test, and final-correspondence reference checks without natural-language scoring or pattern keyword counting.
- [ ] 5.9 Implement final exact-commit correspondence checks for a full 40-hex Git object, assessment digest, changed-path mappings, selected participants/invariants, introduced abstractions, behavioral evidence, divergence disposition, and stale-review invalidation.
- [ ] 5.10 Prove the checker is read-only, deterministic for identical bytes/arguments, safe against malformed JSON and path traversal, bounded in diagnostics, and incapable of ranking or selecting an architectural pattern.

## 6. Valid, invalid, and mutation fixtures

- [ ] 6.1 Create a self-contained fixture harness under `openspec/fixtures/design-pattern-governance/` and disposable-copy test helpers that never mutate governed repository evidence.
- [ ] 6.2 Add valid fixtures for a simple bug fix choosing no pattern, multiple algorithms choosing Strategy, lifecycle transitions choosing State, an external vendor boundary choosing Adapter, an authority token choosing Capability, concurrent completion choosing Atomic Reservation, final invariant correspondence, and future variation triggering re-evaluation.
- [ ] 6.3 Add invalid fixtures for unnecessary single-implementation Strategy, unnecessary simple-construction Builder, Repository without persistence, security-sensitive change without misuse tests, implementation divergence, unassessed new abstraction, missing selected invariant, and keyword-only pattern claims.
- [ ] 6.4 Add malformed and incoherent fixtures for absent/duplicate assessment sections, invalid metadata schema, unresolved IDs, reasonless rejected alternatives, false abbreviated classification, missing task references, unsafe paths, and contradictory decision fields.
- [ ] 6.5 Add final-phase fixtures for an invalid or stale review target, assessment digest drift, unmapped changed path, removed invariant, absent behavioral evidence, and a valid record stored after the exact technical commit it reviews.
- [ ] 6.6 Add disposable mutation tests that remove, duplicate, contradict, or stale-bind each required relationship one at a time and assert the exact stable diagnostic while preserving a passing control.
- [ ] 6.7 Add a non-oracle test in which two structurally coherent assessments choose different approaches for stated forces and prove the checker validates both without architectural ranking.
- [ ] 6.8 Add a canonical Node built-in test wrapper that fails when zero tests are discovered and proves all valid controls pass before and after invalid/mutation cases.

## 7. Behavioral, documentation, workflow, and CI verification

- [ ] 7.1 Add behavioral tests for the assessment-metadata contract covering decision conditionality, ID uniqueness, exact reference resolution, bounded abbreviated use, selected-pattern invariants, and explicit no-pattern validity.
- [ ] 7.2 Add behavioral tests for the correspondence-record contract covering exact-commit binding, participant/path mapping, invariant and bypass evidence, new-abstraction disclosure, divergence handling, review invalidation, and self-reference avoidance.
- [ ] 7.3 Add catalog and template tests proving exactly 23 unique initial entries, every required entry field, exact assessment headings, ADR fields, non-exhaustive language, and direct-implementation safeguards.
- [ ] 7.4 Add repository-managed workflow tests proving capability/assessment read order, pre-implementation validation, unassessed-abstraction pause, final correspondence review, reporting fields, and preservation of existing OpenSpec apply guardrails.
- [ ] 7.5 Add security misuse tests for malformed metadata, path traversal, unbounded diagnostics, forged authority evidence, missing fail posture, missing bypass tests, and attempts to use generic pattern guidance to weaken a domain requirement.
- [ ] 7.6 Add end-to-end final-phase tests proving selected-pattern absence, material divergence, removed invariants, documentation-only pattern claims, and unassessed abstractions are rejected while exact correspondence passes.
- [ ] 7.7 Add a dedicated `.github/workflows/ci.yml` governance job or step that runs direct Node checker/tests and strict OpenSpec validation without changing SDK package scripts or assuming an uninstalled global OpenSpec CLI.

## 8. Compatibility analysis and phased adoption

- [ ] 8.1 Implement Phase 1 activation for non-trivial OpenSpec changes absent from the committed activation baseline, deriving the unique canonical activation commit and classification solely from protected Git history, object identity, ancestry, and proposal fingerprints.
- [ ] 8.2 Capture the activation parent tree and exact proposal commit/tree/blob provenance for every grandfathered active change; include `remediate-security-audit-sdk-adversarial-review` when its proposal baseline predates activation and reject any exemption entry without repository provenance.
- [ ] 8.3 Implement grandfathering so recorded pre-activation active changes remain valid without rewriting approved planning evidence, may opt in explicitly, and require retroactive conformance only through an explicit recorded migration decision.
- [ ] 8.4 Implement Phase 2 activation for every materially new post-activation OpenSpec change that modifies an existing capability, requiring assessment of affected inherited and new abstractions without unrelated refactoring even when the capability predates activation.
- [ ] 8.5 Implement anti-bypass classification that preserves identity across rename or move and rejects recreation under another identifier, optional-metadata omission, old-branch creation, or false-triviality claims involving public API, integration, lifecycle/state, concurrency, persistence/transactions, or security-sensitive behavior.
- [ ] 8.6 Document Phase 3 explicit opt-in assessment of important existing architecture without forcing retroactive pattern adoption, renaming, refactoring, or archived-evidence changes.
- [ ] 8.7 Add clean-clone activation tests plus perturbed wall-clock, file-time, author-date, and environment controls proving classification depends only on committed repository evidence.
- [ ] 8.8 Produce a compatibility matrix covering grandfathered and opted-in active changes, future changes, materially modified capabilities, canonical specs, archived changes, local developer invocation, CI invocation, and bootstrap-to-canonical transition.
- [ ] 8.9 Add protected-history checks that compare captured Git object IDs for all archived OpenSpec evidence and exact-commit bindings, reject any rewrite during adoption, and never require archived changes to acquire assessment artifacts.
- [ ] 8.10 Add exact-scope checks proving the active `remediate-security-audit-sdk-adversarial-review` change, SDK source/tests/scripts/package metadata, contract artifacts, research artifacts, and production/integration paths remain unchanged; document pre-merge rollback, post-merge revert, post-archive successor-change procedures, configuration evolution, and path-classification re-evaluation.

## 9. Read-only technical validation and adoption evidence

- [ ] 9.1 Run strict validation for `establish-design-pattern-governance` and strict repository-wide OpenSpec validation, then run semantic assertions for exact capability naming, 16 normative requirements, 67 four-hash scenarios, required activation/grandfathering and design-pattern scenario coverage, controlled vocabulary, and cross-artifact coherence.
- [ ] 9.2 Run task-format checks proving all 81 tasks use `- [ ] N.N`, all proposal-time tasks remain unchecked, IDs are unique and sequential; run Git whitespace/final-newline, empty-index, exact changed-path, protected-history, and forbidden-production-path checks.
- [ ] 9.3 Run the dependency-free checker and Node built-in test suite on every supported governance runtime selected during apply, require nonzero test discovery, and record exact commands and outputs.
- [ ] 9.4 Run every valid, invalid, malformed, security, phase, correspondence, non-oracle, and disposable mutation fixture and prove each fails or passes only for its intended stable reason.
- [ ] 9.5 Run documentation verification for all assessment/ADR headings, 23 catalog entries and fields, TypeScript/Node.js considerations, security/concurrency implications, minimum tests, common misuse, related patterns, and non-exhaustive/direct-implementation safeguards.
- [ ] 9.6 Compare pre-apply and post-apply object IDs and changed paths to prove no current SDK/production implementation, contract, research, active adversarial-remediation artifact, canonical unrelated spec, or archived evidence changed.
- [ ] 9.7 Produce a read-only technical evidence report separating structural validation, semantic verification, checker assurance limits, proposal/apply completion, technical commit readiness, owner approval, production authorization, merge readiness, and archive readiness.

## 10. Exact-commit review and project-owner decision

- [ ] 10.1 After read-only commit readiness is `yes`, stage only the explicit governance allowlist, inspect the complete staged diff and task state, create and push a separate implementation/materialization commit, and prove local, remote, and pull-request head identity without altering the proposal baseline commit.
- [ ] 10.2 Perform final implementation-correspondence review against the exact technical commit, map implementation participants and paths to the approved direct approach, verify every invariant and misuse/bypass test, identify all introduced abstractions and divergences, and record assurance limitations without claiming owner approval.
- [ ] 10.3 If technical review finds normative divergence or missing evidence, return to the applicable technical tasks, create a new technical commit, rerun all read-only gates, and reconfirm review against the new exact commit rather than reusing stale approval.
- [ ] 10.4 Prepare the project-owner decision packet with the exact technically reviewed commit, correspondence record, commands/evidence, residual risks, over-engineering concerns, compatibility results, production exclusions, and explicit permitted next actions; leave all decision fields pending.
- [ ] 10.5 Obtain the project owner's explicit written approve/reject/conditional decision bound to the exact reviewed commit; do not infer it from authorship, AI review, PR assignment, requested wording, or informal messages, and state that owner self-review is not independent assurance.
- [ ] 10.6 Store the owner decision in a separate governance commit that distinguishes the technical commit reviewed from the later record-storage commit, then re-run lifecycle-status coherence, strict validation, protected-path, and exact local/remote/PR identity checks.
- [ ] 10.7 Report technical completion, exact review binding, project-owner decision, production authorization, commit readiness, merge readiness, and archive readiness as independent states.

## 11. Merge and archive

- [ ] 11.1 Before merge, run a final read-only lifecycle-status sweep across planning artifacts, schemas/configuration, templates, workflow instructions, checker/tests/fixtures, CI, correspondence, owner decision, and pull-request metadata; resolve stale or contradictory status without changing reviewed technical substance.
- [ ] 11.2 Verify the live pull-request head equals the exact approved governance commit, all required checks pass, mergeability is stable, no protected path drift exists, and explicit project-owner merge authorization is recorded.
- [ ] 11.3 Merge without rebasing, squashing, amending, force-pushing, or otherwise changing exact reviewed commit identities unless the owner explicitly authorizes a different governed strategy and review is reconfirmed.
- [ ] 11.4 Archive `establish-design-pattern-governance` in a separate archive commit without `--skip-specs`, preserving the active packet byte semantics and creating `openspec/specs/software-design-pattern-governance/spec.md` as the canonical capability.
- [ ] 11.5 Run strict repository validation, semantic capability checks, checker bootstrap-to-canonical tests, task-count and review-binding checks, Git whitespace/final-newline checks, protected-history checks, and exact archive/canonical changed-path inspection.
- [ ] 11.6 Push the archive commit only after archive readiness is `yes`, wait for required checks, and report merge identity, archive identity, canonical capability path, historical evidence preservation, and the continuing absence of production deployment or package-publication authorization.
