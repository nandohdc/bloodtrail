# ADR 0002: Verify the governance perimeter after committing the candidate

- Status: Accepted
- Date: 2026-08-20
- Decision owners: Project owner

## Context

The repository requires verification before staging. `CLAUDE.md:110-112` states that `test:git` requires an empty index, verification runs before `git add`, and `check:generated` must precede the write-mode validation chain. That rule protects the semantic candidate from staged-state coupling and catches generated drift before `validate` rewrites generated output.

The design-pattern governance perimeter has a different input requirement. It evaluates a commit range from a baseline to `HEAD`, then folds working-tree and untracked paths into that range (`openspec/scripts/design-pattern-governance/perimeter.mjs:85-116`). However, `openspec/scripts/check-design-pattern-governance.mjs:311-325` returns before collecting the range when the resolved baseline equals `HEAD`.

This is the ordinary state of a fresh branch with uncommitted edits: both the branch tip and `origin/main` identify the same commit. In that state, final-phase or implementation-phase verification exits zero and prints a pass even though it inspected no path. Issue #191 records the defect and its differential reproduction: an untracked unclassified probe fails against a different baseline, but silently passes when `base === head`.

The issue #69 fold plan initially prescribed a pre-commit final-phase run against `origin/main` and treated its pass as evidence over two governed paths. The result was vacuous. The corrected execution committed the candidate first and then ran the perimeter against the unchanged baseline, producing a non-empty one-commit range and an explicit inspected-path count.

The empty-index verification rule and the non-empty governance-range requirement therefore cannot be satisfied by one invocation at one Git state.

## Decision

Candidate verification SHALL use two stages:

1. **Pre-stage semantic verification with an empty index.** Run generated-drift checks first, then the relevant OpenSpec validations, tests, workspace validation chains, and whitespace checks. Confirm the exact working-tree scope before staging.
2. **Post-commit governance verification.** Commit only the explicit allowlist, then run the final governance phase and candidate/baseline dual check against the frozen mainline baseline. Require a non-empty range and output that reports the expected commit and path counts before pushing.

A pre-commit run for which `base === head` SHALL NOT be recorded as governance evidence, regardless of its exit code or pass text. A post-commit pass that reports no inspected scope is likewise void.

If post-commit governance fails, the commit is not frozen or push-ready. Move the branch back to the pre-commit candidate state, fix the diagnosed contract, generator, evidence, or implementation error, and repeat both relevant verification stages. Do not loosen the gate.

Once the post-commit stage passes and the exact candidate is pushed, preserve it byte-for-byte. Do not regenerate, reformat, amend, rerun local write-mode validation, or tidy the candidate. Remote required checks must bind to that exact pushed head.

## Relationship to the empty-index rule

This decision supplements rather than overturns `CLAUDE.md`.

- The full semantic validation chain still runs before `git add`, with an empty index.
- `test:git` remains authoritative for staged-state cleanliness and text hygiene.
- Only the range-dependent governance perimeter and its dual check are deferred until an actual candidate commit exists.
- The post-commit stage is read-only. It does not authorize modifying a candidate that already passed the pre-stage semantic chain.

## Consequences

- Governance evidence cannot mistake an empty range for a clean inspected range.
- PR bodies and task ledgers distinguish pre-stage semantic results from post-commit range-governance results.
- Every pushed candidate has a concrete commit identity before the perimeter judges its material range.
- A red post-commit result may require replacing the local, unpushed commit and repeating verification. That cost is preferable to preserving false evidence.
- Issue #191 remains the tracked defect for making the equal-baseline case distinguishable. Even after it is fixed, exact inspected scope remains required evidence for range-dependent claims.
- Untracked documentation can increase the perimeter's visible path count. Isolate unrelated untracked files for the exact-scope post-commit run, restore them byte-for-byte, and record that isolation; never stage them incidentally.
- AI analysis, pass text, and a zero exit code are not approval or assurance, especially when the inspected range is not demonstrated.

## Alternatives considered

### Run final-phase governance only before staging

Rejected. On a branch created at the baseline, `base === head` short-circuits the perimeter before working-tree paths are collected.

### Stage the files and run the full validation chain

Rejected. `test:git` requires an empty index, so this weakens or bypasses an existing gate rather than reconciling the two inputs.

### Treat an equal-baseline pass as sufficient until issue #191 is fixed

Rejected. The pass is known to be vacuous and cannot support a claim about path classification, association, hidden implementation, schema evolution, or archive completeness.

### Use only remote CI

Rejected. CI supplies a real range, but relying on it as the first semantic discovery point wastes the local preflight and does not justify false pre-commit evidence. Local post-commit governance and exact-head CI provide complementary checks.
