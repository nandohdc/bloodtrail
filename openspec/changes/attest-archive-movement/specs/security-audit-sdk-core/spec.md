## ADDED Requirements

### Requirement: Archive movement verification survives history rewriting

Archive-movement verification SHALL NOT depend on the movement baseline remaining present in
branch history. The repository's normal merge workflow may replay a branch as a single commit, which
removes the intermediate state that a re-derived comparison requires.

Movement exactness SHALL be recorded as an attestation identifying the source revision it was
verified against and, for every archived path, the expected file mode and content object. The
attestation SHALL be recorded at the point the movement is verified, while the source revision is
still reachable.

Verification SHALL resolve its comparison baseline by a two-path strategy. When the attested source
revision is resolvable and still contains the active change, verification SHALL re-derive the
comparison from history. When that revision is unreachable, verification SHALL compare the archive
against the attestation. Verification SHALL report which path it used.

Fallback to the attestation SHALL be triggered only by an unresolvable source revision. A resolvable
source revision whose content differs from the archive SHALL fail, and SHALL NOT be treated as a
reason to use the attestation, so that tampering cannot downgrade the check.

Under either path, verification SHALL continue to reject an altered archived file, a changed file
mode, an added or removed archived path, and a `tasks.md` differing from its source by more than the
permitted merge-and-archive checkbox transitions. [F-04]

#### Scenario: Movement baseline is squashed away
- **WHEN** the commit that carried the active change has been replaced by a squash merge and is no
  longer an ancestor of the branch head
- **THEN** verification compares the archive against the attestation, passes for an unmodified
  archive, and reports that it used the attested path

#### Scenario: Movement baseline is still present
- **WHEN** the attested source revision is resolvable and still contains the active change
- **THEN** verification re-derives the comparison from history, and reports that it used the
  re-derived path

#### Scenario: Archive is altered after attestation
- **WHEN** any archived file's content or mode differs from the attestation, or an archived path is
  added or removed
- **THEN** verification fails and names the differing path, under either resolution path

#### Scenario: Resolvable source disagrees with the archive
- **WHEN** the attested source revision is resolvable but its content differs from the archive
- **THEN** verification fails rather than falling back to the attestation

#### Scenario: Archived task state exceeds the permitted transitions
- **WHEN** the archived `tasks.md` differs from its source by anything beyond the permitted
  merge-and-archive checkbox transitions
- **THEN** verification fails, under either resolution path

#### Scenario: Attestation is absent for an archive being created
- **WHEN** an archive is created without a recorded movement attestation
- **THEN** verification fails and requires the attestation to be recorded while the source revision
  is still reachable
