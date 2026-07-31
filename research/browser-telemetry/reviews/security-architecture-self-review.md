# Project-Owner Security Architecture Self-Review

Status: **complete; explicit project-owner self-review recorded**.

## Review record

- **Reviewer:** Fernando Homem da Costa
- **GitHub handle:** `nandohdc`
- **Role:** Project owner and maintainer
- **Review type:** project-owner self-review
- **Date:** 2026-07-31
- **Commit reviewed:** `b6bb577b1fda865610ef93ec8ef31527046c3c44`
- **Material reviewed:** `openspec/changes/investigate-browser-telemetry-signals/proposal.md`, `openspec/changes/investigate-browser-telemetry-signals/design.md`, `openspec/changes/investigate-browser-telemetry-signals/tasks.md`, `research/browser-telemetry/README.md`, `research/browser-telemetry/source-evidence.md`, `research/browser-telemetry/evidence/baseline-2026-07-30.sanitized.json`, and `research/browser-telemetry/tests/egress.test.mjs`
- **Decision:** Approved for research closure with browser telemetry deferred.
- **Conditions:** Production authorization remains none. Redis-backed behavioral correlation and commercial outcomes remain the primary detection mechanism.
- **Concerns:** A compromised or automated browser can fabricate, suppress, replay, or modify client-generated signals. Challenge binding can provide freshness and replay control but cannot establish truthful browser state.
- **Follow-up owner:** Fernando Homem da Costa
- **Reconsideration requirements:** A separate bounded PoC must demonstrate measurable incremental detection value, acceptable false-positive impact, misuse resistance, privacy approval, and no material degradation to customer experience.
- **Assurance limitation:**
  - This review was performed by the project owner and implementer. It provides documented project governance but not independent assurance.
  - This is a project-owner self-review and does not constitute independent security assurance.

## Assessment

The current evidence does not support treating FingerprintJS, BotD, or other browser-controlled signals as identity, authentication evidence, proof of humanity, trustworthy device identity, or an authoritative enforcement input.
