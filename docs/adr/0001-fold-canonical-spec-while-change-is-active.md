# ADR 0001: Fold canonical capability specs while the OpenSpec change is active

- Status: Accepted
- Date: 2026-08-20
- Decision owners: Project owner

## Context

A capability-bearing OpenSpec change carries a delta specification under its change directory. Completing the implementation does not itself place that delta in the canonical capability specification. The lifecycle must therefore fold the delta into `openspec/specs/<capability>/spec.md` and later relocate the completed change into `openspec/changes/archive/`.

The design-pattern governance perimeter gives an active change coverage for its active directory, declared owned paths, and every canonical capability path named by its assessment. `openspec/scripts/design-pattern-governance/perimeter.mjs:261-271` deliberately narrows that coverage after relocation: an archived change keeps only its active and recognised archive prefixes. Its capability declaration no longer covers the canonical spec, and its former owned paths no longer apply.

The perimeter evaluates the material commit range as a whole (`perimeter.mjs:85-116`). Combining a canonical fold and relocation in one range means the change is relocated at the range head, so canonical-spec coverage has already disappeared when association is checked.

This was reproduced for `bundle-validator-runtime-helpers` in a disposable worktree at `6056ded9bfcf6e945ae21491a5cb71ac85c3e622`. Folding its SDK requirement in the archive range failed with exactly `openspec-association-unrelated` on the canonical SDK spec. The recovery used `cover-bundle-archive-spec-fold`, an active documentation-only keeper change declaring the same capability. The keeper provided coverage while the already-relocated sibling change folded its delta; it was then archived as a pure relocation.

For `reject-undeclared-shipped-imports`, the lifecycle was still active when its implementation merged, so the fold could be separated from the archive without a keeper.

## Decision

A capability-bearing change SHALL fold its delta into the canonical capability specification in a dedicated commit and pull request while the change remains active. Only after that fold is merged may a separate commit and pull request relocate the change into the dated archive.

The normal normative sequence is therefore three identity-preserving owner-merged pull requests:

1. implementation;
2. canonical spec fold while active;
3. complete archive relocation.

The fold SHALL be an intelligent merge: operation headers such as `## ADDED Requirements` do not enter a canonical spec, existing canonical content is preserved, and a second semantic application would make no change. The archive SHALL NOT repeat the sync or touch `openspec/specs/**` after coverage has narrowed.

A keeper change is a recovery mechanism, not the default. Use one only when the original change has already been relocated before its canonical delta was folded. The keeper remains active, declares the affected capability without modifying it, covers the sibling fold, and is then archived as a pure relocation.

Do not weaken the perimeter merely to make a combined archive-and-fold range convenient. The rejected checker-change alternative would let relocated changes retain canonical-spec coverage, erasing the deliberate rule that later canonical work requires a new active change.

## Lifecycle vocabulary

- **Change**: the OpenSpec planning and evidence object, active or archived. It is not the same thing as a Git candidate.
- **Candidate**: exact proposed Git bytes at a commit, subject to verification and identity-preserving merge.
- **Fold**: the lifecycle act of merging a change's delta into the canonical specification. This document uses “fold” for the semantic act and “sync” for the OpenSpec workflow or command that performs it.
- **Archive**: either the `openspec/changes/archive/` directory or the act of relocating a completed change into it. State which meaning applies when ambiguity matters.
- **Coverage**: the governed paths an active or recognised relocated change may associate with under the perimeter.
- **Freeze**: the point after exact candidate bytes and verification are accepted for push; after freezing, do not regenerate, reformat, amend, or tidy the candidate.
- **Identity-preserving merge**: a two-parent merge whose second parent is the exact reviewed PR head and whose merge tree equals that head's tree; squash and rebase do not preserve identity.
- **Keeper change**: a temporary active, capability-declaring change used only to cover a canonical fold owed by an already-relocated sibling change.

## Consequences

- Canonical specifications cannot silently miss completed capability behavior when a change is archived.
- Fold and archive candidates have independently reviewable scopes and governance ranges.
- Capability-bearing work normally incurs three normative pull requests. This is intentional evidence separation, not procedural ceremony.
- The archive becomes self-covering when its assessment and proposal retain the objects carried at the active path; no keeper is needed for a correctly ordered lifecycle.
- A change archived before its fold requires a keeper recovery instead of an incidental perimeter exception.
- Proposal, implementation, fold, and archive evidence retain exact commit identities; AI analysis and green automation do not substitute for human approval.

## Alternatives considered

### Fold inside the archive range

Rejected. The range head sees the change as relocated, canonical-spec coverage is gone, and association fails closed.

### Archive first, then edit the canonical spec directly

Rejected. The relocated change no longer owns that path, and direct editing would omit an active owning change.

### Retain canonical-spec coverage after relocation

Rejected. It weakens the perimeter and permits later normative edits to rely on a completed historical change.

### Use a keeper for every fold

Rejected as the default. A keeper is unnecessary when the original change remains active and adds an extra lifecycle solely to recover from incorrect ordering.
