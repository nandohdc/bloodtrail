## ADDED Requirements

### Requirement: Release changelog de-duplication fails closed and is enforced on every release

The changelog de-duplication step SHALL recognise a release entry whether or not Release Please
appends an issue-reference suffix after the entry's commit link. It SHALL compare entries by subject
without that suffix, and a retained entry SHALL keep its suffix unchanged. An entry that carries no
commit link SHALL remain outside de-duplication.

The step SHALL fail closed in both its cleaning mode and its check mode. An entry that links a
commit but matches no recognised entry shape SHALL stop the run with a non-zero exit code that names
the entry. So SHALL an entry whose linked commit cannot be resolved; the step SHALL NOT skip such an
entry or treat its commit as a non-merge commit.

The release workflow SHALL fail when it cannot read or update the release pull request description.
In that case it SHALL NOT push a de-duplicated changelog.

A required status check SHALL run check mode on every pull request that changes `version.txt`. It
SHALL check the changelog section for the new version and that pull request's description, and SHALL
re-run whenever the description is edited. A pull request that leaves `version.txt` unchanged SHALL
NOT be checked against any changelog section or description, so a published section cannot fail
unrelated work.

#### Scenario: An entry with an issue-reference suffix is de-duplicated
- **WHEN** a release section contains a branch commit entry that ends in an issue-reference suffix,
  such as `, closes [#N](…)`, together with the merge commit entry that duplicates it
- **THEN** the step recognises the branch commit entry, drops the merge commit entry, and keeps the
  branch commit entry with its suffix unchanged

#### Scenario: An unrecognised entry fails the run
- **WHEN** a release section contains an entry that links a commit but matches no recognised entry
  shape
- **THEN** the step exits with a non-zero exit code and names that entry, in both cleaning mode and
  check mode

#### Scenario: An unresolvable commit fails the run
- **WHEN** an entry links a commit that cannot be resolved in the history available to the step
- **THEN** the step exits with a non-zero exit code and names that entry, instead of treating the
  commit as a non-merge commit

#### Scenario: An entry without a commit link is left alone
- **WHEN** a release section contains an entry that carries no commit link, such as a
  breaking-change note
- **THEN** the step neither de-duplicates nor rejects that entry

#### Scenario: The release workflow fails when the description cannot be updated
- **WHEN** the release workflow cannot read or update the release pull request description
- **THEN** the workflow step fails, and the de-duplicated changelog is not pushed

#### Scenario: A release pull request is checked by a required status check
- **WHEN** a pull request changes `version.txt`
- **THEN** a required status check runs check mode against the changelog section for the new
  version and against the pull request's description
- **AND** the check fails when that section is missing or when either one contains a duplicate entry

#### Scenario: An edited release description is re-checked
- **WHEN** the description of a pull request that changes `version.txt` is edited
- **THEN** the required status check runs again against the edited description

#### Scenario: A pull request that leaves the version unchanged checks nothing
- **WHEN** a pull request leaves `version.txt` unchanged
- **THEN** the required status check evaluates no changelog section and no description, so no
  published section can fail it
