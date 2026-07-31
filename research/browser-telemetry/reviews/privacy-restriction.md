# Project-Owner Privacy Restriction

Status: **complete; explicit project-owner decision recorded**.

## Review record

- **Reviewer:** Fernando Homem da Costa
- **GitHub handle:** `nandohdc`
- **Role:** Project owner and maintainer
- **Review type:** project-owner decision
- **Date:** 2026-07-31
- **Commit reviewed:** `b6bb577b1fda865610ef93ec8ef31527046c3c44`
- **Material reviewed:** `openspec/changes/investigate-browser-telemetry-signals/proposal.md`, `openspec/changes/investigate-browser-telemetry-signals/design.md`, `openspec/changes/investigate-browser-telemetry-signals/tasks.md`, `research/browser-telemetry/README.md`, `research/browser-telemetry/source-evidence.md`, and `research/browser-telemetry/evidence/baseline-2026-07-30.sanitized.json`
- **Decision:** Approved.
- **Conditions:** No real-user experiments, shadow collection, pilots, analytics, enforcement, or production browser telemetry may occur without a separate OpenSpec change and qualified privacy/legal review.
- **Concerns:** Browser-derived identifiers and environment signals may constitute personal data or increase privacy and correlation risks. No legal-compliance conclusion is made by this project-owner restriction.
- **Follow-up owner:** Fernando Homem da Costa
- **Reconsideration requirements:** Qualified privacy/legal review, documented purpose and legal basis, data-flow mapping, minimization policy, retention policy, deletion handling, tenant boundaries, and explicit authorization for a bounded experiment.
- **Assurance limitation:** This project-owner restriction documents project governance; it is not legal advice, a privacy-law compliance conclusion, or independent privacy assurance.

## Approved restriction

> No production or real-user browser telemetry is authorized. A qualified privacy/legal review is mandatory before any future continuation involving real-user collection.

This decision authorizes no real-user experiment and no production collection. It applies before shadow collection, pilots, analytics, enforcement, or any other real-user browser telemetry. It is not legal advice and asserts no privacy-law compliance conclusion.
