## ADDED Requirements

### Requirement: Changed-path verification distinguishes ignored from tracked local instruction files

Changed-path verification SHALL classify local agent-instruction files as unrelated to the governed
change surface, and SHALL NOT fail solely because such a file is tracked in the repository.

A local instruction file that Git ignores SHALL contribute no changed-path record, by standard Git
semantics. A local instruction file that Git tracks SHALL be reported under the unrelated
classification and SHALL NOT be treated as a governed-scope violation.

Verification controls for this behavior SHALL assert the contribution of the file under test rather
than the global absence of a classification. A control SHALL remain able to fail deterministically
if ignore semantics regress, and SHALL NOT be satisfied by suppressing or removing the
classification itself.

#### Scenario: Ignored local instruction file contributes no record

- **WHEN** changed-path verification runs against a repository in which a local instruction file is
  present but excluded by Git ignore rules
- **THEN** the ignored file contributes no changed-path record, and the count of unrelated
  local-instruction records is unchanged from the same repository without that file

#### Scenario: Tracked local instruction file is reported and does not fail verification

- **WHEN** changed-path verification runs against a repository in which a local instruction file is
  tracked
- **THEN** the file is reported under the unrelated local-instruction classification, and
  changed-path verification passes

#### Scenario: Regressed ignore semantics are detected

- **WHEN** a mutation causes an ignored local instruction file to contribute a changed-path record
- **THEN** the verification control fails deterministically and identifies the unexpected record

#### Scenario: Removing the classification does not satisfy the control

- **WHEN** a mutation removes the local-instruction classification so that no such record can ever
  be emitted
- **THEN** the verification control fails, because a tracked local instruction file is no longer
  reported
