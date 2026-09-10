## ADDED Requirements

### Requirement: Coverage reports handed to the required quality gate describe only analysed components

Every record in a coverage report supplied to the required quality gate SHALL name a file that the
gate analyses. A record naming a path outside the declared analysis scope, or matched by a declared
exclusion, SHALL be removed from the report before the report is handed over, so the analyser is
never given coverage for a component it was told not to index.

Record paths SHALL be normalised to repository-relative paths, with any parent-directory segments
resolved, before they are classified. The scope used for that classification SHALL be read from the
same declaration the gate itself reads, rather than restated: a second copy of the source roots, the
test roots, the exclusion globs, or the report list is the stale-list defect this repository has
already recorded four times.

A record whose normalised path does not exist SHALL fail the job that produces the report, naming the
path. A missing declared report, and a report left with no records after filtering, SHALL also fail.
An unresolvable coverage record SHALL NOT be reported only as a warning in the job that consumes the
report, because a warning that is always present cannot distinguish a new defect from the standing
one.

Removing a record SHALL NOT change the coverage figure of any analysed component: only records that
name no indexed component are removed, and a record that resolves to an analysed component is
retained even when the report that carries it belongs to a different package.

The reason reports legitimately carry such records SHALL be recorded beside the report declaration
rather than left to be rediscovered from an analyser log.

#### Scenario: A record for an excluded path is removed before the gate reads it
- **WHEN** a coverage report carries a record whose normalised path is matched by a declared exclusion
- **THEN** that record is removed from the report, and the removal is reported with its reason

#### Scenario: A record outside every source and test root is removed
- **WHEN** a coverage report carries a record whose normalised path lies under no declared source or test root
- **THEN** that record is removed from the report, and the removal is reported with its reason

#### Scenario: A record for an analysed component is retained
- **WHEN** a coverage report carries a record whose normalised path is an analysed component
- **THEN** that record is retained, including when the report belongs to a different package

#### Scenario: Parent-directory segments are resolved before classification
- **WHEN** a record's path reaches another package through parent-directory segments
- **THEN** it is classified by its normalised repository-relative path, not by the unresolved one

#### Scenario: A record naming a path that does not exist fails the producing job
- **WHEN** a record's normalised path does not exist on disk
- **THEN** the job that produces the report fails, naming the path, rather than filtering it away

#### Scenario: A missing declared report fails
- **WHEN** a report named in the gate's report declaration is absent
- **THEN** the job fails, naming the report

#### Scenario: A report emptied by filtering fails
- **WHEN** filtering would leave a report with no records at all
- **THEN** the job fails, because a report that describes nothing is indistinguishable from one that was never produced

#### Scenario: The analysis scope is read, not restated
- **WHEN** the source roots, test roots, exclusion globs, or report list change in the gate's own declaration
- **THEN** the filtering follows them with no second copy to update
