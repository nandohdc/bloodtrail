## 1. Planning and governance records

- [x] 1.1 Record the P1 purpose decision, bound to the 2026-07-31 outcome it supersedes for P1 only (#117), with the delegated `decision_source`.
- [x] 1.2 Record success, stop, baseline, rollback, non-expansion, and decision-authority criteria for P1 (#118).
- [x] 1.3 Record the technical privacy and threat-model review with outcome APPROVE FOR PROPOSAL, stating that the qualified privacy/legal review remains outstanding (#119).
- [x] 1.4 Write the proposal, design, `client-evidence` capability, and task graph; validate strictly; generate the full assessment (#120).
- [x] 1.5 Merge this proposal in its own PR with all ten required checks green on the exact head.

## 2. Owner authorization

- [x] 2.1 Record the implementation authorization (#121) against the exact merged versions of the purpose, criteria, review, and proposal artifacts, stating platforms, data categories, environments, and task scope, with production, publication, and deployment separately unauthorized.

## 3. Correlation field decision

- [x] 3.1 Record the canonical correlation field decision (#122): name, semantics, generation authority, lifetime, format, cardinality, collision handling, cross-origin and cross-device behaviour, server mapping, retention, compatibility, and rejected alternatives.

## 4. ClientEvidenceEnvelope v1

- [x] 4.1 Author the envelope source, generate its schema and validator, and add canonical and negative fixtures for unknown version, oversized collection, malformed provenance, and forbidden claim (#123).

## 5. Browser package

- [x] 5.1 Create `packages/client-evidence-browser/` with Web APIs only, no Core dependency, no storage, and no transport; wire it into CI, `make`, package discovery, coverage, and Sonar; add supported, missing-capability, malicious-host, bounds, and serialization tests (#124).

## 6. Audit contract extension

- [x] 6.1 Add the optional, bounded `client_evidence` reference to the security-audit contract at
  `client_claim` trust as the governed `2.0.0` → `2.1.0` minor move, with every exact-version pin
  advanced and compatibility fixtures for absence, the v1 reference, invalid provenance, and unknown
  envelope version (#125). — Technical commit `342711fc284a3c1a94e0e1197c9bda0775e7fec0`, bound as
  the cumulative governed candidate over range base `cdecd7f3` (84 protected paths). Six negative
  fixtures cover invalid provenance, trust escalation, unknown envelope version, missing provenance,
  an oversized identifier, and a server-owned member; each rejection is asserted in both the
  canonical validator and the generated schema.

## 7. Backend ingress

- [x] 7.1 Add the fail-closed envelope stage to collector ingress, with replay, fabrication, bounds, and version rejection and privacy-safe counters (#126). — `ClientEvidenceIngress` and `InteractionNonceLedger` in the collector: eight stable rejection classes, code-for-code parity with the envelope contract's validator over every fixture (CE2), and arms for every class, replay, expiry, substitution, and the nonce-free `unbound` case (CE1–CE11). The envelope contract's own tests now run in CI (#495).

## 8. Mapping

- [x] 8.1 Map validated claims to the audit record, preserving `client_claim` trust and never writing a server-owned field, with missing, ambiguous, conflicting, and fabrication tests (#127). — `InteractionClaimMapper` builds the reference from the audit contract's own platform set and fixed provenance; absent, ambiguous, unadmitted, unsupported-platform, conflicting, and capacity outcomes map nothing (CM1–CM7). The Core carries a mapped reference and refuses a relabelled one, and the trust floor refuses a `derived_server` result over it.

## 9. Mode A proof of concept

- [x] 9.1 Run the synthetic Mode A proof of concept against every #118 metric and stop criterion, attempting replay, substitution, collision, and fabrication, and record GO, NO-GO, or REVISE (#128). — **REVISE**. 1,112 interactions: U1 1.0000, U2 0.3552 over a best-case baseline of 0.6448, C1 1.0000, V1 1.0000, V2 0, L2 0.049 ms p95, no inventory or linkage violation, and every adversarial attempt deterministically refused. L1 is unmet at 357 B and unreachable as written; filed as #498 rather than revised here.

## 10. Mode B

- [x] 10.1 Record the Mode B device-trust decision (#129). — **NO-GO for P1**: `decisions/129-mode-b-device-trust.md` inventories four platform mechanisms and records why none serves P1, and what a future GO would have to satisfy.
- [x] 10.2 Implement the approved Mode B path only if 10.1 is GO; otherwise close #130 without implementation. — 10.1 is NO-GO, so #130 closes without implementation and no Mode B code exists.

## 11. React Native

- [x] 11.1 Implement the React Native adapter over the platform-neutral Core within the approved platform matrix (#131). — **Not implemented in this wave.** With Mode B closed, an adapter would emit envelopes on a platform the audit contract does not admit, so #127's mapping refuses `react_native` as `unsupported_platform`. It needs its own contract move, a supported version matrix, and mobile CI targets this repository does not have; the disposition is recorded in `decisions/129-mode-b-device-trust.md` and on #132.

## 12. Fold and archive

- [ ] 12.1 Fold the `client-evidence` capability in its own PR.
- [ ] 12.2 Archive the change in its own PR, then record each wave issue's disposition on #132.
