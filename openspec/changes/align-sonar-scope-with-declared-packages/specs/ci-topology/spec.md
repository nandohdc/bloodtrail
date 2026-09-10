## ADDED Requirements

### Requirement: The required quality gate analyses every declared package

The analysis scope of the required static-analysis gate SHALL cover every declared package — the set held by `DECLARED_PACKAGES` in `.github/scripts/check-package-discovery.mjs`. A declared package absent from that scope SHALL be a failure, and a scope entry that lies under no declared package and is not an explicitly recorded exception SHALL also be a failure, so the assertion fails closed in both directions. The scope SHALL NOT be a hand-maintained list whose completeness rests on a comment: `sonar-project.properties` asserted that it "scans every workspace" while omitting two of the five, and no gate could see the difference.

Generated output SHALL be excluded from the analysis scope, because it is regenerated from the canonical contract and never hand-edited, so a finding in it is not actionable — the fix belongs in the generator, which is itself analysed. Coverage reports SHALL be supplied for every analysed package that produces one, so a package is not analysed for issues while its measured coverage is discarded.

Repository tooling that is not a declared package MAY be outside the scope, but its exclusion SHALL be recorded with the reason rather than left as an omission.

#### Scenario: Every declared package is in the analysis scope
- **WHEN** the analysis scope is compared against `DECLARED_PACKAGES`
- **THEN** each declared package is present, and the assertion passes

#### Scenario: A declared package missing from the scope fails
- **WHEN** a declared package does not appear in the analysis scope
- **THEN** the assertion fails, naming the uncovered package

#### Scenario: A scope entry under no declared package fails
- **WHEN** the analysis scope names a path that lies under no declared package and is not a recorded exception
- **THEN** the assertion fails, naming the stray entry

#### Scenario: Adding a package without adding it to the scope fails
- **WHEN** a package is added to `DECLARED_PACKAGES` and not to the analysis scope
- **THEN** the assertion fails, the same way a covering `make` target that skips it fails

#### Scenario: Generated output is excluded and the generator is not
- **WHEN** the analysis scope is inspected for generated directories
- **THEN** generated output is excluded and the generator that produces it remains analysed

#### Scenario: An analysed package's coverage report is supplied
- **WHEN** a declared package in the analysis scope produces a coverage report
- **THEN** that report is among the ones the gate reads, rather than produced and discarded

#### Scenario: Tooling outside the scope is recorded, not merely absent
- **WHEN** repository tooling that is not a declared package sits outside the analysis scope
- **THEN** the reason for its exclusion is recorded rather than left implicit
