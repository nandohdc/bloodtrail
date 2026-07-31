## Why

### Research question

Can optional browser-side telemetry from FingerprintJS or BotD add measurable detection value for cross-store digital-menu scraping beyond Redis-backed behavioral correlation and server-observed commercial outcomes, without unacceptable privacy, compatibility, latency, customer-experience, supply-chain, or maintenance cost?

### Business motivation

The storefront must remain fast and broadly available across mobile Safari, Android Chrome, QR-code journeys, private browsing, and embedded browsers such as WhatsApp, Instagram, and Facebook. Browser signals may detect some basic automation or correlate short-lived browser environments, but they are controlled by the requester and may add collection and legal risk. The completed source review and desktop PoC need a durable, reviewable home so future teams do not mistake package popularity or a basic bot-detection result for evidence that production adoption is safe or useful.

## What Changes

### Scope

- Materialize the FingerprintJS 5.2.0 and BotD 2.0.0 source review, threat analysis, privacy findings, local PoC measurements, bypass evidence, and evidence limitations as repository-owned research artifacts.
- Recreate the PoC with pinned dependencies, a lockfile, sanitized evidence, and deterministic checks for unexpected third-party requests.
- Record a provisional decision to **defer browser telemetry**.
- Define proportionate project-owner governance for this personal open-source project and the evidence and qualified external review required before real-user work may be reconsidered.
- Keep this research independent from `bootstrap-risk-service` and every production implementation change.

### Non-goals

- No production browser telemetry collection or endpoint.
- No storefront JavaScript, Go risk-service, Kong, Redis, OpenAPI, Helm, or runtime configuration change.
- No customer-visible enforcement, scoring, throttling, challenge, or blocking behavior.
- No claim that browser telemetry improves detection, reduces false positives, or outperforms investment in behavioral correlation.
- No adoption or fork of FingerprintJS or BotD.

### Existing alternatives

The platform can prioritize server-observed controls that do not depend on cooperative JavaScript: cross-store traversal, catalog volume and sequencing, session rotation, network-prefix activity, cart and checkout behavior, completed orders, short-lived restrictions, and later ALTCHA friction. A future bounded PoC may compare a small first-party browser sensor against this behavior-only baseline, but it is not authorized by this change.

### Provisional decision

- FingerprintJS is **reference material only**. Its `visitorId` must not be treated as identity, authentication evidence, device identity, trust, or an enforcement input.
- BotD must not be used as an enforcement authority. A positive detector may be researched as a weak additive signal; a negative result is not proof that a user is human.
- Neither project should be forked.
- Full browser collectors must not run synchronously on every initial menu visit.
- Redis-backed behavioral correlation and server-side commercial outcomes remain the primary detector.
- Any future browser sensor must be small, first-party, independently versioned, reversible, and justified by measurable incremental value; qualified privacy/legal review is mandatory before any continuation involving real-user collection.
- Browser telemetry does not become authoritative merely because its payload is signed or bound to a server-issued challenge. Binding can improve freshness and replay control, not truthfulness.

This change does **not** authorize or plan production adoption. The current evidence supports only a separately approved bounded research continuation, such as `continue-browser-telemetry-poc`. A production implementation change may be considered only if that continuation demonstrates measurable incremental value and receives every required review.

### Project ownership and assurance boundary

Bloodtrail is a personal open-source project owned and maintained by Fernando Homem da Costa (`nandohdc`), acting as project owner and maintainer. Fernando may perform and record the project-owner reviews for this change. Each such review must be labeled as a project-owner self-review or project-owner decision and must not be described as independent review, third-party assurance, formal certification, legal advice, or organizational approval.

Project-owner self-reviews provide documented project governance but not independent assurance. Hermes may prepare templates and verify that required fields are present, but it may not sign for Fernando, invent his decisions, mark owner-review tasks complete without his written decision, represent AI verification as Fernando's approval, or represent the privacy restriction as legal advice.

This governance update does not alter the decision boundary:

- **Provisional decision:** `DEFER BROWSER TELEMETRY`
- **Production authorization:** `none`
- **Real-user collection authorization:** `none`

### Decision rationale

The local PoC found that BotD detects default headless and headed Playwright through obvious markers, but a normal Chrome user agent plus a patched `navigator.webdriver` produced `bot: false`. FingerprintJS added non-trivial collection work and an unstable environment-derived identifier without authenticating a person or device. Representative physical-mobile, in-app-browser, privacy-tool, accessibility, advanced-automation, conversion, and labeled-production evidence is still missing. The available evidence therefore supports deferral, not adoption.

### Risks

- Future teams may over-trust a correlation identifier or detector-negative result.
- High-entropy collection may create disproportionate privacy and terminal-device-access obligations.
- Extensions, privacy settings, WebViews, and browser changes may create instability or false positives.
- Public detector logic is easy for adversaries to inspect and patch.
- Package defaults can create third-party monitoring requests unless disabled and continuously tested.
- A full collector can consume main-thread time on low-end devices and jeopardize menu conversion.
- Deferral may leave some basic automation indicators unused; server-side behavior remains the compensating and primary control.

### Decision gates

Reconsideration requires all applicable evidence gates and the following proportionate governance records:

1. A representative physical-device and browser matrix, including low-end Android, iOS Safari, private modes, in-app browsers, privacy tools, extensions, and accessibility configurations.
2. An adversarial matrix covering plain HTTP clients, default and stealth Selenium/Playwright/Puppeteer, headed Chromium, patched properties, profile/session rotation, real-browser automation, and distributed low-and-slow collection.
3. Labeled shadow data demonstrating incremental detection or false-positive reduction against a behavior-only baseline; absence of measured lift is a stop condition.
4. A project-owner security architecture self-review covering the attacker-controlled trust model, correlation versus identity, authenticity versus truthfulness, integrity versus completeness, package and challenge limitations, manipulation risk, enforcement risk, production exclusions, and support for deferral.
5. A binding project-owner privacy safeguard: **No production or real-user browser telemetry is authorized. A qualified privacy/legal review is mandatory before any future continuation involving real-user collection.** This restriction is not legal advice and asserts no privacy-law compliance conclusion.
6. A project-owner technical self-review covering browser assumptions, reproducibility, exact-origin egress, monitoring blocking, sanitization, credential rejection, dependency isolation, local binding, automation scenarios, performance evidence, production isolation, and validation results.
7. Project-owner dependency and license acceptance covering the inventory, exact lockfile and integrity, preserved notices, CycloneDX SBOM, npm audit, bundle evidence, reuse classifications, and development-only scope. This is not legal advice or external open-source governance approval.
8. A project-owner product decision choosing among no further browser-telemetry work, a bounded continuation PoC, or production implementation. Current evidence leaves production unauthorized, behavior and commercial outcomes primary, incremental lift unproven, and `continue-browser-telemetry-poc` as the only named possible successor.
9. A final project-owner outcome consolidating all owner records, limitations, unresolved concerns, follow-up actions, reconsideration requirements, and explicit production and real-user authorization status.

### Relationship to `bootstrap-risk-service`

`bootstrap-risk-service` remains an independent service-foundation change. This research neither modifies nor depends on its runtime implementation, decision API, OpenAPI schema, configuration, deployment, or initial shadow-mode ALLOW behavior. Browser telemetry must not be added to that change to bypass the gates above. Any approved implementation must be proposed later as a separate, reversible change.

## Capabilities

### New Capabilities

None. This is a research and documentation change with `skip_specs: true`; it introduces no externally observable system behavior.

### Modified Capabilities

None. No existing capability requirement changes.

## Impact

Only OpenSpec planning artifacts and, when the tasks are applied, repository-owned research documentation, PoC tooling, sanitized evidence, dependency locks, and validation checks are affected. Runtime application code, public or internal APIs, infrastructure, customer traffic, and production dependencies remain unchanged.
