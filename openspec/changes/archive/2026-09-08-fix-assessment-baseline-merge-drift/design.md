## Context

The generated assessment currently falls back to the checkout `HEAD` when its source omits `ordering.proposal_baseline_commit`. This creates post-merge drift even when neither source nor generated artifact changed.

## Goals / Non-Goals

**Goals:** make ordering evidence immutable across descendants; fail closed for new incomplete sources; cover the real merge-boundary failure with a fast fixture test.

**Non-Goals:** alter ancestry semantics, relax drift checking, rewrite archived artifacts, or infer an owner approval.

## Decisions

- Require `ordering.proposal_baseline_commit` in the source for generated assessments. The authored source is the only stable record suitable for ancestry evidence.
- Preserve existing strict byte-for-byte generation checks. A fallback to a merge-base was rejected because rebasing or merging would still change the generated result; accepting drift was rejected because it would weaken tamper detection.
- Update the active collector source with its already-recorded pre-merge baseline and regenerate its artifact once. Add a fixture that commits the generated artifact, creates a descendant merge commit, and reruns the checker successfully.

## Risks / Trade-offs

- Existing active sources lacking the field fail closed until migrated → update every active generated assessment source in the same bounded change.
- A wrong authored SHA could make ordering unverifiable → retain ancestry validation and its unresolvable-baseline diagnostic.
