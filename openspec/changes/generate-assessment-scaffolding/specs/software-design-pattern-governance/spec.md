## ADDED Requirements

### Requirement: R16 — Assessment scaffolding is derivable and drift-checked
Assessment evidence scaffolding MAY be generated from declared change metadata and authored sources. Generated assessment evidence SHALL be deterministic, satisfy assessment schema 1.1, and be verified against drift byte-for-byte.

#### Scenario: Assessment generated from authored source
- **WHEN** an assessment is derived from `assessment.source.json` and change metadata
- **THEN** emitted `assessment.json` SHALL satisfy the closed schema, require no hand-transcription of mechanical dimensions, and match generator output byte-for-byte

#### Scenario: Emitted assessment drifts from source declaration
- **WHEN** emitted `assessment.json` drifts from its source declaration or generator output
- **THEN** drift verification SHALL reject the unregenerated assessment
