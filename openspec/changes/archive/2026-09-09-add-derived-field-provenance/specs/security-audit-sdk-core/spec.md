## ADDED Requirements

### Requirement: The Core candidate advances atomically with its exact contract projection

When the governed canonical contract advances to `1.1.0` for optional derived-field provenance,
the private unpublished Core candidate SHALL advance from `0.1.0` to `0.2.0` under the project's
pre-1.0 compatibility-major policy. Its package manifest, package lock, compatibility manifest,
contract provenance, generated public types, generated validator, construction-time contract check,
and event-validation semantics SHALL all bind exactly `1.1.0` in the same change. The package SHALL
reject `1.0.0` and every other unsupported contract version before readiness and SHALL not offer a
multi-version fallback.

#### Scenario: Core is constructed for the new exact version
- **WHEN** a consumer constructs the `0.2.0` Core candidate with contract version `1.1.0`
- **THEN** construction succeeds and every generated and runtime compatibility surface identifies
  the same contract version

#### Scenario: Core is constructed for the superseded version
- **WHEN** a consumer constructs the `0.2.0` Core candidate with contract version `1.0.0`
- **THEN** construction fails with the established safe unsupported-contract-version error before
  any sink handoff or version fallback

#### Scenario: Candidate identity and projection drift
- **WHEN** any one of the Core package version, compatibility manifest, generated projection, or
  contract provenance differs from the governed `0.2.0` / `1.1.0` binding
- **THEN** the coherence or compatibility gate fails
