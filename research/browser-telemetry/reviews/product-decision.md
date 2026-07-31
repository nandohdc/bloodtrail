# Project-Owner Product Decision

Status: **complete; explicit project-owner decision recorded**.

## Review record

- **Reviewer:** Fernando Homem da Costa
- **GitHub handle:** `nandohdc`
- **Role:** Project owner and maintainer
- **Review type:** project-owner decision
- **Date:** 2026-07-31
- **Commit reviewed:** `b6bb577b1fda865610ef93ec8ef31527046c3c44`
- **Material reviewed:** `openspec/changes/investigate-browser-telemetry-signals/proposal.md`, `openspec/changes/investigate-browser-telemetry-signals/design.md`, `openspec/changes/investigate-browser-telemetry-signals/tasks.md`, `research/browser-telemetry/README.md`, `research/browser-telemetry/source-evidence.md`, `research/browser-telemetry/DEPENDENCIES.md`, `research/browser-telemetry/evidence/baseline-2026-07-30.sanitized.json`, and `research/browser-telemetry/evidence/bundle-sizes.json`
- **Decision:** No adoption at this time.
- **Conditions:** Continue prioritizing server-observed behavioral correlation, Redis-backed cross-store detection, and commercial-outcome feedback.
- **Concerns:** No measurable incremental detection lift, false-positive improvement, conversion impact, or advantage over further behavioral-detector investment has been demonstrated.
- **Follow-up owner:** Fernando Homem da Costa
- **Reconsideration requirements:** A future continuation must use the separate OpenSpec change `continue-browser-telemetry-poc` and define measurable detection lift, false-positive limits, performance limits, privacy approval, conversion-impact limits, success criteria, and kill criteria.
- **Assurance limitation:** This is a project-owner product decision for a personal open-source project, not independent product assurance or organizational approval.

## Decision boundary

Browser telemetry remains deferred. Production implementation and real-user collection are not authorized.
