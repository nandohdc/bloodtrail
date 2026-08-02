## Context

See `proposal.md` for motivation and scope. Bloodtrail currently uses the OpenSpec `spec-driven` schema and repository-managed Hermes skills under `.hermes/skills/`. The implementation workflow in `.hermes/skills/openspec-apply-change/SKILL.md` reads proposal, design, specs, and tasks before applying a change, but it does not require a design-pattern assessment or final implementation-correspondence review.

The repository has no root package manifest or general-purpose root script convention. Runtime and verification scripts are currently scoped to their owning package or contract. Because this policy governs OpenSpec changes repository-wide and must not be coupled to the Security Audit SDK, its dependency-free tooling will live under `openspec/`, while human architectural guidance will live under a new `docs/architecture/` directory.

Strict OpenSpec validation establishes artifact structure, not architectural judgment or cross-artifact coherence. The design therefore separates:

- human architectural reasoning;
- deterministic schema and reference checks;
- behavioral implementation evidence;
- exact-commit technical review;
- project-owner approval and lifecycle authorization.

The active `remediate-security-audit-sdk-adversarial-review` change, canonical SDK/event-contract capabilities, SDK source, contract artifacts, and archived OpenSpec evidence are protected inputs, not implementation targets for this change.

## Goals / Non-Goals

**Goals:**

- Make pattern evaluation mandatory and named-pattern adoption optional.
- Give authors one stable assessment structure and a bounded trivial-correction path.
- Tie selected patterns to observable forces, documented invariants, implementation tasks, behavioral tests, and final correspondence evidence.
- Reject ceremonial abstractions and incoherent governance evidence deterministically where objective checks are possible.
- Integrate the sequence into the repository-managed Hermes apply workflow that implementation agents actually read.
- Preserve exact-commit and human-approval boundaries.

**Non-Goals:**

- Build a classifier that decides which pattern is objectively correct.
- Parse arbitrary source languages to infer every abstraction or architectural intent.
- Refactor existing production, SDK, contract, or research code to demonstrate catalog entries.
- Introduce a root package, framework, runtime dependency, or publishable governance package.
- Rewrite historical OpenSpec archives or their review bindings.
- Treat metadata validation, AI review, or a pattern name as substantive approval.

## Design Pattern Assessment

### Governance metadata

The bootstrap assessment for this governance change uses the same shape proposed for future applicable changes. The apply phase will formalize the schema and checker; this proposal-stage block is reviewable evidence, not a claim that the unimplemented checker has passed.

```json
{
  "schema_version": 1,
  "assessment_level": "full",
  "decision": "direct_implementation",
  "security_sensitive": true,
  "force_ids": [
    "force-versioned-policy",
    "force-deterministic-evidence",
    "force-human-judgment-boundary",
    "force-exact-commit-governance",
    "force-cross-workflow-coherence",
    "force-deterministic-activation"
  ],
  "constraint_ids": [
    "constraint-no-root-package",
    "constraint-no-production-refactor",
    "constraint-no-history-rewrite",
    "constraint-no-automatic-pattern-selection",
    "constraint-no-temporal-classification"
  ],
  "variation_point_ids": [
    "variation-assessment-phase",
    "variation-repository-language"
  ],
  "candidate_ids": [
    "candidate-direct-functions",
    "candidate-specification",
    "candidate-strategy",
    "candidate-state",
    "candidate-adapter",
    "candidate-builder-factory",
    "candidate-repository"
  ],
  "selected_pattern_ids": [],
  "invariant_ids": [
    "invariant-deterministic-relations",
    "invariant-no-pattern-selection",
    "invariant-phase-order",
    "invariant-history-preservation",
    "invariant-approval-separation",
    "invariant-grandfathering-boundary"
  ],
  "introduced_abstraction_ids": [
    "abstraction-assessment-metadata-contract",
    "abstraction-correspondence-record"
  ],
  "verification_task_ids": [
    "5.4",
    "6.2",
    "6.3",
    "7.1",
    "7.2",
    "9.1",
    "9.2"
  ],
  "re_evaluation_trigger_ids": [
    "trigger-pluggable-rule-packs",
    "trigger-second-metadata-format",
    "trigger-phase-lifecycle-complexity",
    "trigger-language-specific-analysis"
  ],
  "correspondence_review_task_id": "10.2"
}
```

### Problem

The repository needs durable, testable architectural-decision governance without requiring a named design pattern for simple code and without asking a deterministic script to make subjective architecture choices.

### Architectural forces

- **`force-versioned-policy`:** Agent prompts and model context vary, while repository policy must remain reviewable and versioned.
- **`force-deterministic-evidence`:** CI must reject objectively incomplete or internally inconsistent assessments without subjective model scoring.
- **`force-human-judgment-boundary`:** Pattern applicability and adequacy remain architectural judgments that require substantive review.
- **`force-exact-commit-governance`:** Final correspondence and owner decisions must bind the exact implementation reviewed without self-reference.
- **`force-cross-workflow-coherence`:** Capability text, templates, Hermes instructions, metadata, tasks, fixtures, and checker behavior must express the same contract.
- **`force-deterministic-activation`:** Adoption must distinguish pre-activation evidence from later changes reproducibly across clones without relying on directory names or machine-local time.

### Constraints

- **`constraint-no-root-package`:** The repository has no root Node package and this change must not introduce one merely for the checker.
- **`constraint-no-production-refactor`:** Existing runtime and SDK implementation are out of scope.
- **`constraint-no-history-rewrite`:** Archived OpenSpec evidence and exact-commit bindings are immutable inputs.
- **`constraint-no-automatic-pattern-selection`:** Deterministic verification may validate evidence relationships but cannot select or rank architecture.
- **`constraint-no-temporal-classification`:** Wall-clock time, file modification time, Git author date alone, local environment variables, and unprovenanced manual exemptions cannot determine applicability.

### Candidate patterns

- **`candidate-direct-functions`:** Dependency-free Node.js modules with explicit validation functions and typed-by-schema JSON relationships.
- **`candidate-specification`:** A Specification object model composing independent governance predicates.
- **`candidate-strategy`:** Strategies for assessment, implementation, and final verification phases.
- **`candidate-state`:** A state machine governing assessment-to-implementation-to-final progression.
- **`candidate-adapter`:** An adapter abstraction around OpenSpec Markdown and embedded JSON metadata.
- **`candidate-builder-factory`:** Builders or factories for assessment and correspondence records.
- **`candidate-repository`:** A repository abstraction for loading governance evidence.

### Selected approach

Select `direct_implementation`. Use small pure validation functions over a versioned JSON metadata contract, explicit phase arguments, direct filesystem reads, and deterministic diagnostics. This provides the required correctness and testability without creating a class hierarchy or pluggable abstraction whose variation does not yet exist.

The two introduced governance concepts are data contracts, not class-pattern demonstrations:

- **`abstraction-assessment-metadata-contract`:** structured references embedded in the required human assessment;
- **`abstraction-correspondence-record`:** a separate final record binding implementation evidence to the previously approved assessment and exact reviewed commit.

### Rejected alternatives

- **Specification:** rejected for initial implementation because one fixed rule set and ordinary predicate composition do not require a named object-pattern API. Re-evaluate if independently owned or pluggable rule packs appear.
- **Strategy:** rejected because the three fixed checker phases share one validation pipeline with phase-gated requirements; they are not interchangeable algorithms selected by clients.
- **State:** rejected because the checker validates snapshots and does not own a long-lived mutable lifecycle. OpenSpec task state and governance records remain authoritative.
- **Adapter:** rejected because one repository-owned Markdown-plus-JSON representation exists; a translation boundary would be ceremonial. Re-evaluate if a second metadata format is supported.
- **Builder/Factory:** rejected because JSON records are template-driven and schema-validated, with no staged object construction or runtime construction invariants.
- **Repository:** rejected because the checker reads repository files and Git objects directly and has no domain persistence boundary.

### Simplicity check

The selected design adds two evidence shapes, one dependency-free checker, fixtures/tests, three documentation templates/catalog artifacts, one scoped workflow update, and CI wiring. It avoids a framework, package manager edge, plugin mechanism, class hierarchy, pattern-selection engine, or source-language semantic analyzer. Each concept maps directly to a required force. Anything more would be speculative at initial adoption.

### Security and correctness implications

- Treat assessment metadata and correspondence records as untrusted repository input: parse bounded files, reject duplicate markers/keys where applicable, reject path traversal, resolve only repository-relative normalized paths, and emit bounded diagnostics that do not print arbitrary file contents.
- Fail closed for applicable changes when metadata is malformed, required relations are absent, a security-sensitive decision lacks misuse evidence, a changed implementation path is unmapped, or correspondence does not bind a full commit hash.
- Do not fail closed on subjective disagreement about the selected pattern; that remains a technical-review finding rather than a checker verdict.
- Keep exact-commit technical review distinct from the later commit that stores its record. Project-owner approval remains a separate decision and is not inferred from checker success.
- Read-only validation must leave the Git index and governed files unchanged.

### Pattern invariants

- **`invariant-deterministic-relations`:** identical repository bytes and arguments produce identical pass/fail results and diagnostics; all IDs resolve exactly once.
- **`invariant-no-pattern-selection`:** the checker never recommends, ranks, or rejects a structurally coherent approach because of its pattern choice.
- **`invariant-phase-order`:** implementation evidence cannot satisfy a missing prior assessment, and final evidence must bind the exact implementation commit reviewed.
- **`invariant-history-preservation`:** adoption does not alter archived OpenSpec evidence or the current adversarial-remediation change.
- **`invariant-approval-separation`:** technical verification never marks or implies project-owner approval, merge authorization, production authorization, or archive readiness.
- **`invariant-grandfathering-boundary`:** only active changes backed by the committed activation baseline retain pre-activation status; rename, move, recreation, optional-metadata omission, and false-triviality claims cannot confer or remove that status.

### Verification strategy

- Validate the metadata JSON schema and every ID/reference relation.
- Exercise valid direct-implementation and named-pattern fixtures.
- Exercise invalid fixtures for missing sections, missing forces, missing invariants, reasonless alternatives, invalid abbreviated classification, security-sensitive evidence gaps, unmapped abstractions, divergence, stale correspondence, and fake keyword-only compliance.
- Use disposable-copy mutation tests that delete or contradict each required relation and prove the checker fails for the intended reason.
- Run strict change and repository OpenSpec validation, task-format checks, direct whitespace/final-newline checks, protected-history object comparisons, and exact changed-path review independently from the new checker.
- During final apply verification, compare the implementation tree and behavioral tests with this assessment and record correspondence against the exact technical commit.

### Re-evaluation triggers

- **`trigger-pluggable-rule-packs`:** independently owned or selectable rule sets may justify Specification or Strategy.
- **`trigger-second-metadata-format`:** another accepted representation may justify Adapter.
- **`trigger-phase-lifecycle-complexity`:** persisted, mutable, or transition-rich verification state may justify State.
- **`trigger-language-specific-analysis`:** multiple source-language analyzers may justify an analyzer interface or Strategy, but only after concrete implementations exist.

## Decisions

### 1. Keep human reasoning and machine evidence in one assessment without duplicating prose

Every applicable `design.md` contains one level-two `Design Pattern Assessment` heading and these level-three headings in order: `Problem`, `Architectural forces`, `Constraints`, `Candidate patterns`, `Selected approach`, `Rejected alternatives`, `Simplicity check`, `Security and correctness implications`, `Pattern invariants`, `Verification strategy`, and `Re-evaluation triggers`.

A single fenced JSON block under `### Governance metadata` provides machine-readable IDs and links. The checker parses JSON with Node.js built-ins and resolves IDs against explicitly marked human entries. It does not attempt natural-language scoring. The assessment template will state that prose is authoritative for architectural reasoning and metadata is authoritative only for deterministic identity and traceability.

Alternatives rejected:

- A separate assessment sidecar duplicates decision state and creates drift.
- YAML requires either a new parser dependency or a fragile custom parser.
- Heading-only checks are easy to satisfy ceremonially and cannot prove task/test relationships.

### 2. Use two assessment levels with non-bypassable triggers

`full` is mandatory for any abstraction, lifecycle/state, concurrency, integration, persistence/transaction, public API, or security-sensitive change. `abbreviated` is limited to a bounded trivial correction and still records a direct decision, simplicity rationale, focused verification, and re-evaluation trigger when relevant.

The checker validates the declared level against deterministic evidence available in the change and changed-path manifest. It rejects `abbreviated` when metadata declares an abstraction or security sensitivity, tasks/specs declare a trigger, or final changed-path evidence crosses configured trigger classes. Human review remains responsible for detecting an omitted trigger that cannot be inferred mechanically.

Alternatives rejected:

- Requiring a full assessment for typo-level corrections creates ceremony and incentivizes low-quality boilerplate.
- Allowing authors to mark anything “trivial” without cross-checks creates a bypass.

### 3. Define a repository-level metadata contract under OpenSpec ownership

Apply will add:

- `openspec/schemas/design-pattern-assessment.schema.json` for assessment metadata;
- `openspec/schemas/design-pattern-correspondence.schema.json` for final-review metadata;
- `openspec/design-pattern-governance.json` for policy version, activation evidence, provenance-backed active-change baselines, path classifications, required catalog IDs, and protected-history roots.

The configuration will use repository-relative POSIX paths, explicit schema versions, closed object shapes, bounded arrays/strings, unique IDs, and controlled decision/phase values. At activation it will record the activation parent tree and exact proposal commit/tree/blob evidence for every grandfathered active change, including `remediate-security-audit-sdk-adversarial-review` when its proposal baseline predates activation. The unique activation commit is the first protected-mainline commit that atomically introduces both the canonical capability and this baseline record; its hash is derived from Git history rather than self-referenced inside its own contents. It will not contain subjective pattern scores.

The exact metadata vocabulary is:

- assessment levels: `full`, `abbreviated`;
- decisions: `direct_implementation`, `named_pattern`;
- checker phases: `assessment`, `implementation`, `final`;
- identifier collections: forces, constraints, variation points, candidates, selected patterns, rejected alternatives, invariants, introduced abstractions, verification tasks, and re-evaluation triggers.

A `named_pattern` decision requires at least one selected pattern, force, and invariant relation. A `direct_implementation` decision requires an empty selected-pattern set plus explicit rejected or inapplicable abstraction reasoning. Both require verification and simplicity evidence.

### 4. Implement one dependency-free, phase-aware checker

The checker will be `openspec/scripts/check-design-pattern-governance.mjs`. Supporting modules may be added under `openspec/scripts/lib/` only when they remove repeated parsing or validation logic; no plugin or class framework is authorized.

CLI modes:

- `--change <name> --phase assessment`: validate assessment structure, applicability, force/candidate/decision relations, alternatives, invariants, and task-plan references before code work.
- `--change <name> --phase implementation --base <commit>`: add changed-path mapping, abstraction/test references, and security misuse evidence while implementation is in progress.
- `--change <name> --phase final --review-target <commit>`: require the separate correspondence record, exact commit binding, complete invariant evidence, no unexplained divergence, and no unassessed abstraction.
- `--all-applicable --base <commit>`: CI entry point for Phase 1 and later Phase 2 scope, deriving the canonical activation commit and applying provenance, ancestry, proposal-fingerprint, anti-bypass, and path rules from repository configuration.

Diagnostics use stable codes and repository-relative paths, are sorted, and remain bounded. Read-only mode is the only mode. The process exits nonzero for objective contract failures and zero for a structurally coherent assessment regardless of which pattern was selected.

The checker validates:

- exactly one assessment section and one metadata block;
- candidate patterns or an explicit direct decision;
- force and constraint evidence;
- selected-pattern-to-force/invariant relations;
- rejected-alternative reasons;
- task references for implementation, invariant tests, security misuse/bypass tests, abstraction behavior, deterministic checks, and final correspondence;
- final correspondence mapping from assessment IDs to exact changed paths and test evidence;
- full 40-hex review target and Git object identity;
- phase-appropriate state without treating future final evidence as required during assessment.

The checker does not validate prose quality, select a pattern, or claim that source code semantically implements a pattern. Exact-commit technical review owns those judgments.

### 5. Store final implementation correspondence separately

Applicable changes will add `design-pattern-correspondence.md` during the final technical phase, not at proposal time. It contains human review plus a fenced JSON record identifying:

- assessment schema version and digest;
- exact implementation commit reviewed;
- selected approach and patterns;
- implementation participants and changed-path mapping;
- introduced abstractions;
- invariant-to-test evidence;
- security misuse/bypass evidence;
- divergences and their disposition;
- unresolved architectural risks and over-engineering concerns;
- reviewer identity, review type, assurance limitation, and date.

The record binds the preceding technical commit. The later commit that stores the record does not claim to review itself. A subsequent normative implementation or assessment change invalidates the correspondence until reconfirmed. Project-owner approval is stored and governed separately; a technical correspondence record does not imply it.

Alternative rejected: appending final evidence directly to the approved assessment would mix decision-time and review-time state and make exact-commit binding harder to reason about.

### 6. Build a practical catalog, not a pattern textbook

Apply will create:

- `docs/architecture/design-pattern-catalog.md`;
- `docs/architecture/design-pattern-assessment-template.md`;
- `docs/architecture/adr-design-pattern-template.md`.

The catalog groups 23 initial entries:

1. **Core design:** Adapter, Strategy, State, Command, Factory, Builder, Facade, Decorator, Specification.
2. **Domain and persistence:** Repository, Unit of Work, Domain Service, Immutable Value Object.
3. **Security and authority:** Capability, Explicit Trust Boundary, Fail Closed, Authority Provenance.
4. **Concurrency and resilience:** Idempotency Key, Atomic Reservation, Transactional Outbox, Circuit Breaker, Bulkhead, Bounded Retry.

Each entry contains intent, use when, avoid when, required invariants, practical TypeScript/Node.js shape, security implications, concurrency implications, minimum verification, common misuse, and related patterns. Examples remain small and non-production. The catalog explicitly says it is non-exhaustive and that concrete forces control selection.

The ADR template is used when a decision crosses capability boundaries, changes a durable public or trust boundary, creates a major compatibility commitment, or cannot be fully explained within the change design. It does not force an ADR for every assessment.

### 7. Integrate only the repository-managed Hermes implementation workflow

Apply will update `.hermes/skills/openspec-apply-change/SKILL.md` because this is the checked-in workflow that implementation agents read. It will require this sequence after loading OpenSpec context files and before the implementation loop:

1. Read `openspec/specs/software-design-pattern-governance/spec.md` when canonical; during this change's bootstrap review, read the active delta spec explicitly.
2. Inspect the requested change and relevant repository architecture.
3. Complete or verify the required Design Pattern Assessment.
4. Select a named pattern or `direct_implementation`.
5. Run the checker in `assessment` phase.
6. Implement only the validated design.
7. Add behavioral tests for selected invariants and misuse/bypass tests where required.
8. Pause and update the assessment before introducing an unassessed abstraction or material divergence.
9. Run final exact-scope correspondence review.
10. Report pattern decisions, evidence, residual risks, and over-engineering concerns.

No user-home, profile-specific, ignored, or unrelated local instruction file is modified. The workflow will preserve existing OpenSpec status, context, task, and pause guardrails rather than replacing them.

### 8. Prove enforcement with valid, invalid, and mutation fixtures

Fixtures will live under `openspec/fixtures/design-pattern-governance/` and use minimal self-contained OpenSpec change trees. At minimum:

- valid direct simple bug fix;
- valid Strategy with multiple algorithms;
- valid State lifecycle;
- valid Adapter vendor boundary;
- valid Capability authority token;
- valid Atomic Reservation concurrency case;
- invalid one-implementation Strategy;
- invalid simple Builder;
- invalid persistence-free Repository;
- invalid security-sensitive decision without misuse tests;
- invalid implementation divergence;
- invalid unassessed abstraction;
- valid final invariant correspondence;
- valid re-evaluation after a second algorithm.
- valid grandfathered active change whose proposal fingerprint is recorded before activation;
- valid explicit opt-in by a grandfathered active change;
- valid material post-activation change to a pre-existing canonical capability;
- valid immutable archived historical change;
- invalid renamed or recreated post-activation change attempting to claim grandfathering;
- invalid abbreviated claims for public-API and concurrency changes;
- clean-clone controls proving repository-evidence classification and wall-clock independence.

Tests will live at `openspec/tests/design-pattern-governance.test.mjs` and use Node's built-in test runner. Mutation tests operate on disposable copies and remove, duplicate, contradict, or stale-bind one evidence relation at a time. Each mutation must fail for the expected stable diagnostic, while controls pass before and after mutation. Tests must prove zero discovered tests is a failure condition in the canonical wrapper.

### 9. Add a dedicated CI gate without coupling governance to SDK validation

Apply will add a separate CI job or step in `.github/workflows/ci.yml` using a supported Node runtime and direct `node` commands. It will not add governance scripts to `packages/security-audit-sdk-core/package.json`, because repository-wide policy must not depend on or mutate SDK verification ownership.

The CI gate will run:

- Node built-in tests for checker, fixtures, and mutations;
- the checker over applicable changed OpenSpec changes using the pull-request merge base;
- strict OpenSpec change and repository validation;
- task-format and direct whitespace/final-newline checks for governed files.

Protected-history and exact-scope assertions remain explicit acceptance checks. The implementation must determine whether the installed OpenSpec CLI is available in CI and pin or document setup without silently assuming a global developer tool.

### 10. Adopt in phases and preserve protected history

Phase 1 activates for every non-trivial change absent from the provenance-backed active-change set recorded at activation. The activation commit is identified as the first protected-mainline commit that introduces both the canonical capability and the baseline record; the record binds its parent tree and exact proposal commit/tree/blob evidence. A clean clone can therefore reproduce classification without wall-clock time, file modification time, Git author date alone, environment variables, or an unprovenanced exemption list.

An active change recorded in that baseline retains its grandfathered status across directory rename or movement by proposal content identity and Git lineage. Its approved planning artifacts are not retroactively rejected or rewritten. It may opt in explicitly; absent opt-in, later design decisions should follow the policy where practical, but existing artifacts become mandatory only through a recorded migration decision. `remediate-security-audit-sdk-adversarial-review` is handled by this rule and must be recorded as grandfathered if its proposal baseline predates activation.

A change absent from the activation baseline is post-activation even if it is created on an old branch, renamed, moved, recreated under another identifier, or omits optional metadata. A materially new OpenSpec change extending a pre-existing canonical capability must comply. Claims of triviality fail when evidence introduces a public API, integration, lifecycle/state, concurrency, persistence/transaction, or security-sensitive boundary. Phase 3 remains explicit opt-in assessment of existing architecture. Archived changes are immutable inputs and never receive retroactive artifacts.

Apply verification records Git object IDs for protected active and archived paths before changes and proves they are unchanged afterward. The only permitted paths are the active governance change, the eventual canonical capability at archive time, the three architecture documents, OpenSpec governance schemas/config/scripts/tests/fixtures, the repository-managed apply skill, and explicit CI wiring. SDK, contract, research, production, current adversarial-remediation, and historical archive paths are denied.

Rollback before merge removes the new governance artifacts and restores the workflow/CI edits. After merge but before archive, rollback reverts the governance commits without rewriting history. After archival, changes to the capability require a new OpenSpec change; the archive remains immutable.

### 11. Keep technical and human governance gates separate

The apply plan uses separate stages and commits for implementation/materialization, exact-commit technical correspondence, explicit project-owner decision, merge, and archive. Every record identifies its reviewed commit and assurance limits. Project-owner self-review is valid project governance but not independent assurance, certification, legal advice, privacy approval, or organizational approval.

No implementation task is checked during proposal creation. Completing and validating the four proposal artifacts means only that the apply plan is available for owner consideration.

## Risks / Trade-offs

- **[Embedded JSON can drift from prose]** → Validate every referenced ID against marked prose and require exact-commit substantive review; metadata is traceability, not truth.
- **[Authors can omit a trigger the checker cannot infer]** → Combine configured changed-path checks with required reviewer correspondence and report the checker’s assurance limit.
- **[Path classification can become stale]** → Version configuration, add fixtures for new source roots, and make changed implementation paths fail closed when unclassified.
- **[The checker becomes a pattern-selection oracle]** → Test two different structurally valid decisions for the same stated forces and require both to pass objective validation.
- **[Governance becomes ceremonial]** → Require force/invariant/task/test relations, mutation tests, and final exact-commit mapping rather than heading presence.
- **[Trivial path becomes a bypass]** → Reject abbreviated assessments when deterministic triggers or introduced abstractions are present; require human review for semantic omissions.
- **[Workflow update conflicts with generated OpenSpec skill changes]** → Patch the existing repository-managed skill minimally and preserve upstream generated metadata and core behavior; document the local governance extension.
- **[CI lacks OpenSpec CLI]** → Determine and pin the setup during apply; do not report repository strict validation as automated until the real CI command executes.
- **[Final review record self-references]** → Bind the record to the preceding implementation commit and store it in a later governance commit.
- **[Policy displaces domain controls]** → State and test that domain-specific requirements control all conflicts.
- **[Activation classification depends on names or clocks]** → Derive the canonical activation commit from protected history, bind grandfathered proposals by committed object evidence and content lineage, and test rename/recreation, old-branch, clean-clone, and perturbed-clock cases.

## Migration Plan

1. Materialize the assessment/ADR templates and 23-entry catalog.
2. Materialize versioned metadata schemas and repository governance configuration, including the activation parent tree and provenance-backed proposal fingerprints for every grandfathered active change.
3. Implement the dependency-free checker and stable diagnostic contract.
4. Add valid/invalid fixtures, disposable mutation tests, and direct documentation checks.
5. Patch the repository-managed Hermes apply skill with the governed sequence.
6. Add and execute the dedicated CI gate without changing SDK validation ownership.
7. Run compatibility checks proving current canonical specs, the active adversarial-remediation change, and all archived evidence are unchanged and still strictly valid; prove the remediation is grandfathered when its proposal baseline predates activation.
8. Run full strict, semantic, task-format, whitespace/final-newline, protected-history, exact-path, fixture, mutation, and correspondence verification.
9. Freeze the technical implementation commit and obtain exact-commit technical review.
10. Obtain an explicit project-owner decision in a separate record/commit. No AI output supplies this decision.
11. Merge only after all required checks and decisions are complete.
12. Archive in a separate commit so the canonical capability is created at `openspec/specs/software-design-pattern-governance/spec.md`; verify the archived packet and canonical spec byte semantics.

## Open Questions

None. Path placement, metadata format, applicability rules, workflow target, test strategy, adoption boundaries, and governance sequencing are resolved in this design. Material changes to those decisions require an OpenSpec artifact update and revalidation before apply.
