## ADDED Requirements

### Requirement: Disposable CRA CI witness remains non-canonical

The never-merged CRA CI witness SHALL exercise the change-local security-audit contract trigger without modifying the canonical security-audit contract, its generated projections, or any production surface.

#### Scenario: Valid witness reaches CRA semantic validation

- **WHEN** the witness change carries a valid assessment-form CRA that references `registries.trust_levels`
- **THEN** the CRA checker reports a CRA-validated pass for `cra-ci-witness`

#### Scenario: Missing record fails closed

- **WHEN** the same witness trigger remains but `contract-reuse.json` is absent
- **THEN** the CRA checker rejects the selected change with the stable missing-record diagnostic
