# Spec Delta

## ADDED Requirements

### Requirement: One business application may build live PoC events with the SDK core

Exactly one business application MAY use the SDK core in production, packed from the exact commit recorded on the change's tracking issue, to build `authentication.succeeded`, `authentication.failed` and `session.created` events for the live PoC that `add-collector-live-poc-deployment` authorizes. Each such event SHALL set `data.retention_class` to `operational_short`. The SDK core's code SHALL NOT change for this.

#### Scenario: The authorization binds one commit
- **WHEN** the business application's SDK core tarball is built from a commit other than the one recorded on the tracking issue
- **THEN** that use is unauthorized until the new commit is recorded there

#### Scenario: Live PoC events declare the 30-day class
- **WHEN** the business application builds one of the three authorized events
- **THEN** the event's `data.retention_class` is `operational_short`, a recorded deviation from the catalog's `security_standard`

#### Scenario: No other use is authorized
- **WHEN** the SDK core is used to build any other event, by any other application, or for any destination other than the collector server
- **THEN** that use remains unauthorized for production and real-user data, as before this change

#### Scenario: The package is not published
- **WHEN** the business application obtains the SDK core
- **THEN** it installs a tarball packed from the recorded commit, and no package is published to any registry
