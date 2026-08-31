## Context

See `proposal.md` for motivation. Two mechanisms constrain the shape of this change.

`check-governance-history.mjs` resolves every declared record: `governedCommits` must resolve, `boundCommits` must be ancestors of HEAD, declared merges must have their stated parent count, and each `reviewedContent` entry must be a tree that resolves under the declared `candidateRoot` and that some commit reachable from HEAD carries at that path. No reviewed path may contain `packages/security-audit-sdk-core/verification-lifecycle.json`, because signing would then change the reviewed content.

`governance-history-mutations.test.mjs` holds `EXPECTED_RECORD_IDS` and `MINIMUM_REVIEWED_PATHS`, an inventory deliberately not derived from the manifest. Its G-01 and G-02 controls exist because the checker's own totals recompute from whatever the manifest holds, so deleting a record or narrowing a binding normalizes the expected result instead of failing it. The inventory is what rejects that, and it only moves through an explicit edit. A record therefore cannot be stored until the inventory names it.

## Goals / Non-Goals

**Goals:**

- Bind the owner decision to content objects that survive squash, rebase, and relocation, not to a claim about a commit.
- Bind exactly what #217 changed, so the record's scope and the change's changed-path set are the same set.
- State every property the binding does not establish, in the record itself rather than only in this packet.

**Non-Goals:**

- Do not modify the archived change, its tasks, or its reconciliation note.
- Do not assert that the owner decision gated the merge, or that tasks 4.3 and 4.4 are now satisfied.
- Do not extend the record to the `docs/agents` commit the same pull request carried.

## Decisions

### Bind technical commit `877d77f`, not the commit that registers the record

`reviewedCommit` is `877d77f1b3fef8dcbbf292cb91c495ea3a179547` and `candidateRoot` is that commit's root tree. What the owner authorized is #217's technical content, and `877d77f` is the commit that carries it.

**Alternative considered: bind the registration commit, following `ratify-contract-version-support-policy`.** That record binds its own T2 on the reasoning that the inventory registration is part of the reviewed scope, because storing the record requires it. The reasoning held there because T2 belonged to the same change being signed. Here the registration belongs to *this* change, so binding it would make the record for `fix-generated-required-context-reason` cite a commit that change never contained. Rejected, and the residual — that the owner's #217 instruction does not itself cover the registration edit — is disclosed in the record's assurance limitations rather than argued away.

### Bind the four subtrees `877d77f` changed, and no others

The entries are `openspec/changes/fix-generated-required-context-reason`, `packages/security-audit-sdk-core/scripts`, `packages/security-audit-sdk-core/src/generated`, and `packages/security-audit-sdk-core/tests/types`. That is exactly the changed-path set of the technical commit. `MINIMUM_REVIEWED_PATHS` names the same four, so a later narrowing fails the inventory.

**Alternative considered: also bind `packages/security-audit-sdk-core/tests/verification`,** as the two most recent records do. Rejected: #217 never touched it. Binding it would assert a review that did not happen, which is the failure mode the content binding exists to prevent.

The pre-archive change path is used because that is what resolves under `candidateRoot`. The archive relocation was byte-identical, so the object the record names is the object the archive carries.

### Accept that R15 freshness does not order this record

`verifySignedReviewFreshness` runs `verifyBinding` only over active changes. `fix-generated-required-context-reason` is archived, so no staleness scan orders this record against the commits that followed `877d77f`. Its dangling-record check does run and passes, because the archive directory carries the exact objects history carried at the active change path.

The gap is stated as a limitation rather than assumed away, and measured instead of asserted: `packages/security-audit-sdk-core/scripts`, `src/generated`, and `tests/types` are byte-identical between `877d77f` and `main`, so nothing normative touched the reviewed implementation scope after the commit the record binds. The change directory's tree does differ — `968978e` added the reconciliation note after `877d77f` — and the record names the object as it stood at the commit it binds.

## Risks / Trade-offs

- [The record reads as retroactive approval of a merge it did not gate] → The record's `signatureDecision` and assurance limitations state that the decision followed both the merge and the archive, and that tasks 4.3 and 4.4 remain unsatisfied as written.
- [The binding is read as covering everything the pull request merged] → `c8c6e9f` also carried `64af271`, the `docs/agents` orchestration contract, which is outside #217's scope. It is named in `governedCommits` so the merge's real content is visible, and excluded from `reviewedContent` so the binding does not claim it.
- [The registration commit leaves the tree failing] → By construction: at T2 the inventory expects a record the manifest does not yet hold, so the SDK chain is red until S lands. Both commits ship in the same pull request, and the gate chain is run on the final state.
- [A future record narrows this binding while claiming the same commit] → `MINIMUM_REVIEWED_PATHS` names all four reviewed paths, and `checkNoNarrowing` rejects re-binding the same `reviewedCommit` with fewer content objects.

## Migration Plan

1. Commit the proposal artifacts alone, after strict OpenSpec and assessment validation.
2. Commit the inventory registration (T2). The SDK chain is expected to fail here at the inventory assertion; that failure is the property being established, not a defect.
3. Commit the signed record (S), which turns the inventory assertion green.
4. Run the gate chains on the final state, open the pull request, and close #217 only once the record is reachable from `main`.

A revert removes the stored record and the inventory entry together. Nothing else depends on either, no runtime or generated artifact moves, and the archived change is unaffected in both directions.
