## Context

See `proposal.md` for motivation. Under `openspec/governance/design-pattern-policy.json` and `openspec/governance/schemas/assessment.schema.json`, every OpenSpec change records `assessment.json`. A full assessment requires 113–136 lines, and an abbreviated assessment under schema 1.1 requires ~106 lines. 45 of those lines are the 15 security dimension justifications when `security_sensitive: false`. The repository already uses deterministic code generation with byte-for-byte `check:generated` validation for SDK and contract projections.

## Goals / Non-Goals

**Goals:**
- Provide `openspec/scripts/generate-assessment.mjs` with `--scaffold`, generation, and `--check` modes.
- Allow authors to write an `assessment.source.json` containing only fields that encode genuine judgment (~30–45 lines).
- Emit deterministic `assessment.json` conforming strictly to `assessment.schema.json` version 1.1.
- Provide byte-for-byte drift checking (`--check`) analogous to `check:generated`.
- Wire drift checking into governance testing and checking without breaking backward compatibility for changes without `assessment.source.json`.

**Non-Goals:**
- Fabricating human judgment or defaulting architectural forces, candidate approaches, or invariant evidence.
- Altering the closed schema `assessment.schema.json` or weakening any governance rule in `rules.mjs`.
- Modifying SDK runtime code or frozen contract definitions.

## Decisions

- **Decision 1: Authored artifact named `assessment.source.json`**
  - *Rationale*: Mirrors `contract.source.json`, establishing that the source is canonical and `assessment.json` is the generated artifact.
  - *Alternative considered*: Putting metadata directly in `.openspec.yaml`. Rejected because `.openspec.yaml` is reserved for OpenSpec CLI workflow metadata, not design pattern governance evidence.
  - *Alternative considered*: Separate generator tool outside repository. Rejected because governance tooling must be reproducible, version-controlled, and self-contained with 0 runtime dependencies.

- **Decision 2: Deterministic derivation of mechanical fields**
  - `schema_version`: "1.1"
  - `change_id`: derived from directory name
  - `ordering.proposal_baseline_commit`: derived from `git merge-base HEAD origin/main` or current `HEAD` if not provided in source
  - `applicability.capabilities`: extracted from `proposal.md`
  - `applicability.material_capability_modification`: false (unless specified)
  - `security_justification`: When `security_sensitive: false`, emit the 15 standard negative justifications for the bounded change.
  - `verification_task_ids`: extracted from `tasks.md` or defaulted from `invariant_evidence` task IDs.

- **Decision 3: Byte-for-byte drift check (`--check`)**
  - Emitted `assessment.json` must exactly match generator output.
  - Catches hand edits to generated sections and stale assessments.

## Risks / Trade-offs

- [Risk: Generated assessment does not pass schema validation] → Mitigation: Generator output validates against `assessment.schema.json` and `rules.mjs` in automated tests.
- [Risk: A change needs custom security justifications even when false] → Mitigation: Author can override any dimension in `assessment.source.json`.
- [Risk: Git baseline commit resolution fails in shallow clones] → Mitigation: Generator accepts explicit `proposal_baseline_commit` in `assessment.source.json` or falls back gracefully.
