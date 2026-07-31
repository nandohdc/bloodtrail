# Final Project-Owner Outcome

Status: **complete; explicit final project-owner decision recorded**.

## Review record

- **Reviewer:** Fernando Homem da Costa
- **GitHub handle:** `nandohdc`
- **Role:** Project owner and maintainer
- **Review type:** project-owner decision
- **Date:** 2026-07-31
- **Commit reviewed:** `e3f2f1f323a94a9fffe0f7ddfc6fcf8ec8bbd26f`
- **Material reviewed:** Commit B (`e3f2f1f323a94a9fffe0f7ddfc6fcf8ec8bbd26f`), including `openspec/changes/investigate-browser-telemetry-signals/tasks.md`, `research/browser-telemetry/reviews/privacy-restriction.md`, `research/browser-telemetry/reviews/security-architecture-self-review.md`, `research/browser-telemetry/reviews/technical-self-review.md`, `research/browser-telemetry/reviews/dependency-license-acceptance.md`, and `research/browser-telemetry/reviews/product-decision.md`, together with the research and governance baseline in Commit A (`b6bb577b1fda865610ef93ec8ef31527046c3c44`)
- **Decision:** no adoption at this time
- **Status:** browser telemetry deferred
- **Production authorization:** none
- **Real-user collection authorization:** none
- **Primary approach:** server-observed behavioral correlation and commercial outcomes
- **Permitted future work:** separately approved bounded continuation PoC
- **Possible successor:** `continue-browser-telemetry-poc`
- **Conditions:** No production implementation or real-user collection is authorized. Any bounded continuation must use a separate OpenSpec change, and qualified privacy/legal review is mandatory before real-user experiments, shadow collection, pilots, analytics, enforcement, or other real-user browser telemetry.
- **Concerns:** Browser-controlled signals can be fabricated, suppressed, replayed, or modified and do not establish identity, humanity, or truthful browser state. Browser-derived identifiers may increase privacy and correlation risks. Existing measurements are desktop and synthetic, and no incremental detection lift, false-positive improvement, conversion benefit, or advantage over further behavioral-detector investment has been demonstrated. Dependency acceptance remains project-owner acceptance rather than formal legal advice or external open-source governance approval.
- **Follow-up owner:** Fernando Homem da Costa
- **Reconsideration requirements:** A separately approved `continue-browser-telemetry-poc` OpenSpec change must define measurable detection lift, false-positive limits, performance and conversion-impact limits, success and kill criteria, physical-device coverage, misuse resistance, dependency and outbound-network review, and privacy restrictions. Qualified privacy/legal review, documented purpose and legal basis, data-flow mapping, minimization, retention, deletion handling, tenant boundaries, and explicit authorization are required before any bounded real-user experiment.
- **Assurance limitation:** This final project-owner outcome provides documented governance for a personal open-source project; it is not independent assurance, formal certification, legal advice, or organizational approval.

## Consolidated outcome

The project-owner security architecture and technical self-reviews approve research closure while preserving their non-independent-assurance limitations. The privacy restriction is approved and authorizes no production or real-user collection. Dependency and license acceptance applies only to the isolated research harness. The product decision is no adoption at this time.

Browser telemetry remains deferred. Redis-backed server-observed behavioral correlation and commercial outcomes remain the primary approach. No production implementation, identity attribution, authentication use, risk-scoring input, customer enforcement, or real-user collection is authorized by this outcome.
