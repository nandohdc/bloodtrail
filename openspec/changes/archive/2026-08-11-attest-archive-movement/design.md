## Context

See `proposal.md` — Why. The mechanics that matter:

`resolveMovementSource` in `check-changed-paths.mjs` returns `HEAD` when the active change still
exists there. Otherwise it runs `git log --diff-filter=A -- <archive>/`, and for each commit that
added the archive directory it takes the first parent, requiring that parent to contain the active
change. That parent becomes the comparison baseline.

The logic is correct for a merge-commit workflow: the parent on the branch side is the pre-archive
commit, whose active change is exactly what was moved. It is wrong for a squash workflow, where the
only parent is the target branch's tip and its copy of the active change is whatever was there
before the branch existed.

`CONTRIBUTING.md` documents squash-merge as this repository's normal practice, so the workflow the
check assumes is not the workflow the repository uses. That mismatch, not the archive, is the defect.

## Goals / Non-Goals

**Goals:**

- Restore a green `sdk` job on `main` without weakening tamper detection.
- Keep the stronger re-derived comparison wherever history still supports it.
- Make the assurance change explicit in the spec and in the gate's own output.

**Non-Goals:**

- Rewriting `main`'s history, reverting the squash, or re-merging the branch. Both produce two
  archive-adding commits and fail with `archive-movement-source-baseline`.
- Re-verifying the 2026-08-11 movement from scratch. It was verified before the squash; that
  evidence is what the attestation records.
- The broader governance right-sizing, which is proposed separately.

## Decisions

**Attest the movement rather than re-derive it forever.** The manifest records the source revision
and, per archived path, the expected mode and blob object. Movement exactness is a property of a
one-time event; re-deriving it on every run only adds value while the baseline survives, which the
repository's own merge workflow does not guarantee.
*Alternative considered:* requiring archive pull requests to use merge commits. Zero code, and it
preserves full re-derivation — but one forgotten flag re-breaks `main`, and it constrains the
workflow to protect a check rather than adapting the check to the workflow. Kept as complementary
guidance in `CONTRIBUTING.md`, not as the fix.

**Two paths, and fallback keyed strictly on reachability.** A resolvable source revision containing
the active change means re-derive; an unreachable revision means compare against the attestation.
Content mismatch is never a fallback trigger. If mismatch could route to the attested path, an
attacker who altered both the archive and the attestation would face a weaker check than one who
altered only the archive — the check would degrade exactly when it is most needed.
*Alternative considered:* always using the attestation for simplicity. Rejected because it discards
a stronger check that costs nothing when history still supports it, and because future archives
merged as merge commits should get full re-derivation.

**The gate reports which path it used.** A run that silently switched to the weaker check would
misrepresent its own assurance, which is the failure mode this whole sequence has been about. The
output names the path and, on the attested path, the source revision it could not reach.

**The manifest lives in `verification-lifecycle.json`.** That file is already the structured home
for governed commits, protected prefixes, and task-group phases, and the scripts already read it. A
second metadata file would create two sources of truth for one lifecycle.

**Attestation is mandatory for a new archive.** An archive created without one fails, so the gap
cannot silently reappear. The attestation must be written while the source revision is reachable,
which is the same commit that performs the movement.

## Risks / Trade-offs

- **A self-attested manifest proves less than a re-derived comparison** → True, and stated in the
  spec rather than glossed. Under the attested path the guarantee is: the movement was verified when
  it could be, and the archive has not changed since. Ongoing tamper detection is preserved in full;
  original move-exactness becomes historical evidence rather than a live derivation.
- **Whoever writes the attestation could write it to match a bad archive** → The attestation is
  written in the same commit as the movement, when re-derivation is still possible and still runs.
  A wrong attestation therefore fails at the moment it is created. It can only become
  unverifiable later, not wrong later.
- **The recorded source revision may be garbage-collected** → Accepted, and the reason the manifest
  records blob objects rather than only a revision. The attested path depends on nothing surviving.
- **Two paths mean two behaviours to test** → Mitigated by requiring the differential controls to
  exercise both, so neither path can regress unnoticed.

## Migration Plan

1. Add the attestation for the existing 2026-08-11 archive, recording source revision `f03d98b` and
   the blob objects currently in the archive. These are verifiable now: `f03d98b` is still reachable
   through `docs/complete-and-archive-sdk-remediation`, and the blobs match byte-for-byte.
2. Land the two-path resolution and the differential controls.
3. Confirm `npm run validate` passes on `main`.

Rollback is reverting the script change; the manifest is inert data without it.

**Do not delete `docs/complete-and-archive-sdk-remediation` until step 1 lands.** It is the only
remaining reachable source for `f03d98b`, which the attestation must be verified against as it is
written.
