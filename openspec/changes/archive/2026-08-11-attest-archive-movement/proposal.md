## Why

`main` is currently red. `npm run test:changed-paths` fails on `706dd93`, which fails the `sdk`
job, which blocks every subsequent pull request.

PR #146 was squash-merged. Archive-movement validation re-derives its comparison baseline from
history — it locates the commit that added the archive directory and treats that commit's parent as
the movement source. After a squash the parent is `251b855`, main's pre-merge tip, whose copy of the
active change predates the tasks 12.4–12.8 governance records. The archive legitimately differs from
it, so the byte comparison fails:

```
[archive-movement-byte-substitution] technical-review-packet.md
    source blob caa5e904…  differs from  archive blob bbf9b8e2…
[archive-movement-unauthorized-task-difference] tasks.md differs by more
    than exact 12.8-12.10 checkbox transitions
```

**The movement was valid.** At `f03d98b`, the pre-archive commit on the branch, the packet blob is
`bbf9b8e2` — byte-identical to the archive. The check passed locally and on the PR. The squash did
not reveal a bad archive; it destroyed the intermediate state that proved the archive was good.

This is the third instance of one failure class. `a7ac3177` was orphaned by a squash and is not an
ancestor of `main`. `71dbd953` was recorded as a merge commit and has one parent. Now the archive's
own movement proof is unreachable. Each time, governance depended on a property of history that the
repository's normal squash-merge workflow does not preserve.

## What Changes

- Record the archive movement as an **attested manifest** in `verification-lifecycle.json`: the
  source revision it was verified against, and the expected mode and blob object for each archived
  path.
- Change movement source resolution to a two-path strategy. When the attested source revision is
  resolvable and still contains the active change, re-derive the comparison from history as today —
  the stronger check, unchanged. When that revision is unreachable, compare the archive against the
  attested manifest instead, and say which path ran in the gate output.
- **Never fall back because content mismatched.** Fallback is triggered only by an unresolvable
  source revision. A resolvable source whose content differs is a failure, as it is today, so real
  tampering can never silently downgrade to the weaker path.
- Add differential controls proving the gate still fails when an archived file is altered, when a
  mode changes, when a file is added or removed, and when `tasks.md` differs by more than the
  permitted 12.8–12.10 transitions — under both resolution paths.
- **BREAKING** for verification assurance, and stated rather than hidden: for an archive whose
  source revision has been squashed away, movement exactness becomes a one-time attestation made
  when it could still be verified, plus continuous tamper detection thereafter. It is no longer
  continuously re-derived from history.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: adds a requirement covering archive-movement attestation and the
  resolution strategy. The existing requirement *"Canonical verification is lifecycle-aware and
  reproducible"* is not modified — its scenarios remain true — but it does not describe what happens
  when the movement baseline is no longer present in history, which is the gap this change closes.

## Impact

- **Modified:** `packages/security-audit-sdk-core/verification-lifecycle.json` gains a movement
  attestation block; `scripts/check-changed-paths.mjs` gains the two-path resolution;
  `tests/verification/mutations.test.mjs` gains controls for both paths.
- **Modified:** `CONTRIBUTING.md` records that an archive pull request is merged with a merge commit
  where practical, so the stronger re-derivation path stays available. This is complementary
  guidance, not the fix — the attestation must hold when the guidance is not followed.
- **Unchanged:** the SDK runtime, the contract, the package manifest, the authorization boundary,
  and every other gate. No SDK source file changes.
- **Not addressed here:** the broader governance right-sizing proposed in
  `right-size-change-governance`; this change fixes the immediate breakage only.
