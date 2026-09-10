## ADDED Requirements

### Requirement: A superseded canonical contract version may not appear in a current-tense assertion

A statement that describes present behaviour SHALL name the current canonical contract version. The
current version SHALL be read from the canonical contract source, and the set of superseded versions
SHALL be derived from the repository's existing record of every contract version that has existed;
neither SHALL be restated by the gate that checks them. A current version absent from that record
SHALL be a failure, because a version move that updates the contract and not the record leaves the
superseded set wrong.

The checked set SHALL cover every declared package — its documents, its architecture decision records
and its sources — derived from the declared-package set rather than enumerated, so a newly declared
package is covered without being taught. Repository documents that are not part of a package SHALL be
named explicitly and asserted to exist, so the list fails rather than silently shrinking.

An occurrence of a superseded version SHALL fail unless it is a recorded exception carrying its
reason, and a recorded exception that matches no occurrence SHALL also fail, so the exception set
cannot outlive the text it excuses.

Trees excluded from the checked set SHALL be recorded with their reason rather than left absent. In
particular, ratified specification text SHALL NOT be checked: it states what was decided, correcting
it is a governed specification change, and a gate demanding that correction would require the change
it forbids.

#### Scenario: A superseded version in a current-tense statement fails
- **WHEN** a checked file asserts present behaviour using a superseded canonical contract version
- **THEN** the check fails, naming the file and the line

#### Scenario: A recorded historical reference passes
- **WHEN** an occurrence of a superseded version is a recorded exception carrying its reason
- **THEN** the check passes and the reference is left unchanged

#### Scenario: A recorded exception that matches nothing fails
- **WHEN** a recorded exception no longer matches any occurrence
- **THEN** the check fails, so the exception set cannot outlive the text it excuses

#### Scenario: The current version is read from the canonical source
- **WHEN** the canonical contract version changes at its source
- **THEN** the check follows it with no second copy to update

#### Scenario: A current version missing from the version record fails
- **WHEN** the current canonical version is absent from the repository's record of contract versions
- **THEN** the check fails rather than validating against an incomplete superseded set

#### Scenario: Every declared package is covered without being taught
- **WHEN** a package is added to the declared-package set
- **THEN** its documents, decision records and sources are checked with no further edit

#### Scenario: A named repository document that no longer exists fails
- **WHEN** a named non-package document is renamed or removed
- **THEN** the check fails rather than silently checking one document fewer

#### Scenario: Ratified specification text is excluded, and the exclusion is recorded
- **WHEN** the excluded trees are inspected
- **THEN** ratified specification text is among them and its reason is recorded rather than implicit
