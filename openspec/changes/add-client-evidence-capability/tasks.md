## 1. Planning and governance records

- [x] 1.1 Record the P1 purpose decision, bound to the 2026-07-31 outcome it supersedes for P1 only (#117), with the delegated `decision_source`.
- [x] 1.2 Record success, stop, baseline, rollback, non-expansion, and decision-authority criteria for P1 (#118).
- [x] 1.3 Record the technical privacy and threat-model review with outcome APPROVE FOR PROPOSAL, stating that the qualified privacy/legal review remains outstanding (#119).
- [x] 1.4 Write the proposal, design, `client-evidence` capability, and task graph; validate strictly; generate the full assessment (#120).
- [ ] 1.5 Merge this proposal in its own PR with all ten required checks green on the exact head.

## 2. Owner authorization

- [ ] 2.1 Record the implementation authorization (#121) against the exact merged versions of the purpose, criteria, review, and proposal artifacts, stating platforms, data categories, environments, and task scope, with production, publication, and deployment separately unauthorized.

## 3. Correlation field decision

- [ ] 3.1 Record the canonical correlation field decision (#122): name, semantics, generation authority, lifetime, format, cardinality, collision handling, cross-origin and cross-device behaviour, server mapping, retention, compatibility, and rejected alternatives.

## 4. ClientEvidenceEnvelope v1

- [ ] 4.1 Author the envelope source, generate its schema and validator, and add canonical and negative fixtures for unknown version, oversized collection, malformed provenance, and forbidden claim (#123).

## 5. Browser package

- [ ] 5.1 Create `packages/client-evidence-browser/` with Web APIs only, no Core dependency, no storage, and no transport; wire it into CI, `make`, package discovery, coverage, and Sonar; add supported, missing-capability, malicious-host, bounds, and serialization tests (#124).

## 6. Audit contract extension

- [ ] 6.1 Add the bounded client-evidence reference to the security-audit contract at `client_claim` trust as a governed minor move, with every pin advanced and compatibility fixtures (#125).

## 7. Backend ingress

- [ ] 7.1 Add the fail-closed envelope stage to collector ingress, with replay, fabrication, bounds, and version rejection and privacy-safe counters (#126).

## 8. Mapping

- [ ] 8.1 Map validated claims to the audit record, preserving `client_claim` trust and never writing a server-owned field, with missing, ambiguous, conflicting, and fabrication tests (#127).

## 9. Mode A proof of concept

- [ ] 9.1 Run the synthetic Mode A proof of concept against every #118 metric and stop criterion, attempting replay, substitution, collision, and fabrication, and record GO, NO-GO, or REVISE (#128).

## 10. Mode B

- [ ] 10.1 Record the Mode B device-trust decision (#129).
- [ ] 10.2 Implement the approved Mode B path only if 10.1 is GO; otherwise close #130 without implementation.

## 11. React Native

- [ ] 11.1 Implement the React Native adapter over the platform-neutral Core within the approved platform matrix (#131).

## 12. Fold and archive

- [ ] 12.1 Fold the `client-evidence` capability in its own PR.
- [ ] 12.2 Archive the change in its own PR, then record each wave issue's disposition on #132.
