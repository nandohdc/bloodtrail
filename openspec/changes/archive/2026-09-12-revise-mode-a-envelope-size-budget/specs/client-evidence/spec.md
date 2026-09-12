## MODIFIED Requirements

### Requirement: A Mode A proof of concept decides whether the wave continues

A synthetic, non-production Mode A proof of concept SHALL measure every metric and stop criterion in
`decisions/118-success-and-stop-criteria.md` (as revised by decision #498: L1 serialized envelope size
budget ≤ 384 B per request) against its stated baseline, attempt replay, claim substitution, correlation
collision, and server-field fabrication, and record GO, NO-GO, or REVISE. A NO-GO, or any stop criterion
firing, SHALL end the wave.

#### Scenario: Trace context alone groups interactions as well
- **WHEN** the proof of concept measures an incremental utility below the #118 threshold
- **THEN** the outcome is NO-GO and later task groups do not proceed

#### Scenario: Mode A envelope meets the revised L1 size budget
- **WHEN** the proof of concept or client-evidence test suite evaluates the serialized envelope size of Mode A interactions
- **THEN** max serialized envelope bytes is ≤ 384 B and the L1 metric is satisfied
