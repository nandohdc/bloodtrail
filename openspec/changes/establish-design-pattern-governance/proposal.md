## Why

Ad hoc model judgment and one-time prompting cannot reliably preserve repository-wide architectural discipline across agents, sessions, and implementation changes. Bloodtrail needs a canonical, reviewable OpenSpec capability plus deterministic evidence checks so implementation agents evaluate design patterns against concrete forces without treating a named pattern as a mandatory outcome or a substitute for correctness.

OpenSpec is preferable to prompt-only guidance because it makes the policy versioned, change-controlled, testable, and available to every governed implementation workflow. The policy must counter both under-analysis and pattern cargo culting: a direct implementation is the preferred decision when an abstraction would add more concepts than it removes or when future variation is merely speculative.

## What Changes

- Add the repository-wide `software-design-pattern-governance` capability requiring an applicability assessment before non-trivial implementation.
- Require each assessment to record the problem, architectural forces, constraints, expected variation points, candidate and rejected patterns, selected pattern or explicit no-pattern decision, simplicity analysis, security/correctness implications, invariants, verification strategy, and re-evaluation triggers.
- Define a bounded abbreviated assessment for trivial corrections while making the full assessment mandatory for implementation, abstraction, lifecycle/state, concurrency, integration, persistence, public-API, and security-sensitive changes.
- Establish evidence rules that tie any selected pattern to observable forces and explicitly reject “best practice,” speculative extensibility, popularity, or a pattern name alone as sufficient justification.
- Establish anti-pattern checks for speculative abstraction, unnecessary factories, service locators, global mutable state, inheritance-only reuse, god objects, misleading or fragmented interfaces, persistence-free repositories, one-strategy Strategy abstractions, obscuring wrapper chains, and pattern terminology without invariants.
- Require security-sensitive assessments to cover trust, authority, mutation, failure posture, concurrency, misuse, and bypass resistance.
- Require final implementation-correspondence review and agent reporting so selected invariants, unassessed abstractions, divergence, residual risks, and over-engineering concerns are visible.
- Add a practical, non-exhaustive TypeScript/Node.js pattern catalog and reusable assessment and ADR templates under `docs/architecture/` during apply.
- Integrate the capability into the repository-managed Hermes apply workflow at `.hermes/skills/openspec-apply-change/SKILL.md`; no unrelated local-only instruction file is in scope.
- Add a deterministic repository-level checker, valid/invalid fixtures, and mutation tests during apply. The checker will validate structured evidence and cross-references, not choose a pattern or claim that architectural judgment can be reduced to keywords.
- Adopt the policy at a deterministic committed activation boundary: new non-trivial changes not present in the provenance-backed activation baseline must comply; baseline-listed active changes remain valid unless they opt in or record an explicit migration decision; materially new changes to existing capabilities must comply; and archived evidence remains immutable.

## Scope

This governance change covers:

- OpenSpec requirements and scenarios for design-pattern applicability, selection, invariants, correspondence, reporting, and re-evaluation;
- repository documentation for practical TypeScript/Node.js pattern decisions;
- repository-managed Hermes implementation workflow integration;
- deterministic structural and coherence verification, fixtures, and mutation coverage;
- compatibility and adoption guidance for active, future, and archived OpenSpec material;
- exact-commit technical review, explicit project-owner approval, merge, and archive gates.

## Non-Goals

This change does not authorize or perform:

- production deployment or production instrumentation;
- package publication;
- framework, vendor, persistence, transport, queue, or other production integration;
- broad refactoring of existing production, contract, research, or SDK code merely to demonstrate patterns;
- retroactive rewriting of archived OpenSpec changes, review evidence, or exact-commit bindings;
- replacing domain-specific security, privacy, lifecycle, concurrency, compatibility, or correctness requirements with generic pattern guidance;
- automatic selection of Strategy, Factory, State, or any other named pattern;
- a claim that the pattern catalog is exhaustive or that pattern terminology proves implementation quality.

Creation and validation of these proposal artifacts is planning only. It does not authorize apply work, repository workflow edits, checker implementation, documentation materialization, production use, merge, or archive. Apply requires a separately recorded explicit project-owner authorization.

## Affected Workflows

- Authors of non-trivial OpenSpec implementation changes must complete the governed assessment before implementation begins.
- Hermes and other repository-managed implementation agents must read the canonical capability, inspect repository architecture, complete and validate the assessment, implement the approved approach, test selected invariants, compare final implementation to the decision, and report residual risks.
- Technical reviewers must verify assessment evidence and implementation correspondence against an exact commit; AI analysis is technical evidence, not human or organizational approval.
- The project owner retains the explicit approval gate for applying, merging, and archiving this governance capability.

## Compatibility Considerations

- No existing public API, runtime behavior, event-contract meaning, SDK implementation, package dependency, or production path changes at proposal time.
- Phase 1 applies to new non-trivial OpenSpec changes absent from the committed activation baseline; classification uses Git object identity, ancestry, and proposal fingerprints rather than wall-clock time, file times, author dates, or local configuration.
- An active change with a provenance-backed proposal baseline predating activation remains valid and is not forced to rewrite approved planning evidence. It may opt in explicitly; otherwise new design decisions should follow the policy where practical without retroactively invalidating existing artifacts unless an explicit migration decision is recorded.
- Phase 2 applies to every materially new OpenSpec change that modifies an existing capability after activation, even when that canonical capability predates activation, so unchanged capabilities do not incur retroactive work.
- Renaming, moving, recreating, omitting optional metadata, or falsely claiming triviality cannot convert a post-activation change into a grandfathered one. Public-API, integration, lifecycle, concurrency, persistence, and security-sensitive work always triggers the full assessment path.
- Archived changes remain immutable and never acquire retroactive assessment artifacts.
- Trivial corrections may use an abbreviated assessment with an explicit applicability reason; changes that introduce an abstraction or affect lifecycle, state, concurrency, integration, persistence, public APIs, or security-sensitive behavior cannot use the trivial path.
- Existing repository-managed workflows will require a coordinated versioned update during apply. Local-only or unrelated agent instruction files remain untouched.

## Migration and Adoption Strategy

1. **Phase 1 — New changes:** enforce the capability for new non-trivial code-changing OpenSpec changes and provide templates, catalog guidance, checker fixtures, and workflow instructions.
2. **Phase 2 — Material modifications:** require an assessment when an existing capability is materially modified, including explicit evaluation of inherited and newly introduced abstractions.
3. **Phase 3 — Optional architecture review:** allow important existing architecture to be assessed opportunistically without forcing refactoring, renaming, or historical evidence changes.

Adoption must be fail-safe for governed code changes while remaining proportionate for trivial corrections. The activation commit will atomically introduce the canonical capability and a committed activation-baseline record containing its parent tree plus provenance-bearing identifiers and proposal object fingerprints for qualifying active changes. The checker derives the unique activation commit from repository history and classifies changes from that record, Git ancestry, and content identity; results must be reproducible from a clean clone and independent of wall-clock time. Migration evidence must demonstrate that current archived changes validate unchanged and that the active `remediate-security-audit-sdk-adversarial-review` change is not modified and is grandfathered when its recorded proposal baseline predates activation.

## Enforcement Strategy

- Human-readable assessment sections explain architectural judgment and trade-offs.
- Versioned machine-readable metadata identifies applicability, decision type, force IDs, selected-pattern IDs, invariant IDs, security sensitivity, abstraction IDs, verification-task IDs, and re-evaluation triggers.
- The deterministic checker validates schema, required relationships, task references, security-sensitive misuse coverage, and final correspondence evidence.
- Valid, invalid, and mutation fixtures prove missing, contradictory, bypassed, or stale evidence is rejected.
- The checker does not score prose, infer whether a particular pattern is objectively correct, or accept pattern-name keyword matching as architectural evidence.
- Strict OpenSpec validation, semantic checks, task-format checks, Git whitespace/final-newline checks, protected-history checks, and exact changed-path review remain independent gates.

## Risks

- **Pattern cargo culting:** Agents may introduce ceremonial abstractions to satisfy governance. Mitigation: direct implementation is explicitly valid and preferred unless a concrete force and testable invariant justify a pattern.
- **Speculative abstraction:** Forecast-only variation may be mistaken for an architectural force. Mitigation: speculative extensibility is insufficient evidence, and simplicity plus re-evaluation triggers defer abstraction until observable conditions arise.
- **Checklist compliance without judgment:** Metadata may be filled mechanically. Mitigation: structured fields establish traceability while human-readable reasoning and exact-commit review assess substance; the checker never claims semantic approval.
- **Keyword-driven enforcement:** A checker could reward pattern names rather than coherence. Mitigation: validate typed relationships and fixture behavior, not pattern-name frequency or subjective selection.
- **Governance burden for small fixes:** Full assessments could slow trivial corrections. Mitigation: permit a bounded abbreviated path that becomes invalid when risk or abstraction triggers are present.
- **Generic policy displacing domain requirements:** Pattern guidance could obscure Bloodtrail-specific security or lifecycle rules. Mitigation: domain requirements remain controlling and may only be strengthened, not replaced, by pattern analysis.
- **Workflow drift:** Templates, capability text, Hermes instructions, checker behavior, and CI could diverge. Mitigation: deterministic correspondence fixtures, mutation tests, and a final cross-artifact review.
- **Activation ambiguity or bypass:** Directory names, branch timing, or local clocks could inconsistently classify a change. Mitigation: bind activation to the canonical-capability commit and a committed provenance-bearing baseline, compare proposal object identity and lineage, and reject rename, recreation, optional-metadata omission, and false-triviality bypasses.

## Success Criteria

- Every applicable new non-trivial implementation records an evidence-based assessment before implementation.
- Every assessment selects a justified named pattern or explicitly records a valid direct/no-pattern decision.
- Selected patterns identify observable forces and testable invariants; material rejected alternatives include reasons.
- Security-sensitive assessments include trust, authority, failure, concurrency, misuse, and bypass analysis.
- New abstractions cannot pass governance without evaluation and behavioral verification.
- Final review detects material divergence between the approved assessment and the implementation.
- Repository-managed Hermes reports the decision, reasons, rejected alternatives, implementation correspondence, invariant tests, introduced abstractions, residual risks, and over-engineering concerns.
- Valid fixtures pass; invalid and mutated evidence fails deterministically without a checker selecting the architecture.
- Existing SDK and production implementation paths and archived OpenSpec evidence remain unchanged.
- A clean clone deterministically reproduces activation and grandfathering classifications, including the pre-activation status of `remediate-security-audit-sdk-adversarial-review`, without consulting wall-clock time or mutable local state.

## Capabilities

### New Capabilities

- `software-design-pattern-governance`: Defines evidence-based design-pattern applicability assessment, valid direct-implementation decisions, invariant and anti-pattern controls, security-sensitive analysis, implementation correspondence, re-evaluation, deterministic evidence checking, and implementation-agent reporting.

### Modified Capabilities

None.

## Impact

The apply phase is expected to add the eventual canonical specification at `openspec/specs/software-design-pattern-governance/spec.md`; documentation under `docs/architecture/`; a dependency-free deterministic Node.js checker and fixtures under a repository-level governance tooling path selected in design; and a scoped update to `.hermes/skills/openspec-apply-change/SKILL.md` plus CI wiring if approved. Existing runtime packages, SDK source, contract artifacts, research code, archived OpenSpec evidence, and the active adversarial-remediation change are protected from modification.
