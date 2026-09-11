## MODIFIED Requirements

### Requirement: The Core candidate advances atomically with its exact contract projection

When the governed canonical contract advances, the private unpublished Core candidate SHALL take the
compatibility-major step of the project's pre-1.0 policy in the same change — `0.1.0` → `0.2.0` for
`1.1.0`, and `0.2.0` → `0.3.0` for `2.0.0`. Its package manifest, package lock, compatibility manifest,
contract provenance, generated public types, generated validator, construction-time contract check,
and event-validation semantics SHALL all bind exactly the new contract version, as recorded by
`compatibility.json` `contractVersion`. The package SHALL reject every superseded and every other
unsupported contract version before readiness and SHALL NOT offer a multi-version fallback.

#### Scenario: Core is constructed for the new exact version
- **WHEN** a consumer constructs the Core candidate with the contract version its compatibility
  manifest records
- **THEN** construction succeeds and every generated and runtime compatibility surface identifies
  the same contract version

#### Scenario: Core is constructed for the superseded version
- **WHEN** a consumer constructs the Core candidate with a contract version a governed move
  superseded
- **THEN** construction fails with the established safe unsupported-contract-version error before
  any sink handoff or version fallback

#### Scenario: Candidate identity and projection drift
- **WHEN** any one of the Core package version, compatibility manifest, generated projection, or
  contract provenance differs from the governed candidate and contract binding
- **THEN** the coherence or compatibility gate fails
