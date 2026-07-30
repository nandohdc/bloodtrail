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
- Define the evidence and cross-functional approvals required before that decision may be reconsidered.
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
- Any future browser sensor must be small, first-party, privacy-reviewed, independently versioned, reversible, and justified by measurable incremental value.
- Browser telemetry does not become authoritative merely because its payload is signed or bound to a server-issued challenge. Binding can improve freshness and replay control, not truthfulness.

This change does **not** authorize production adoption. A later implementation would require a separately reviewed OpenSpec change, such as `add-browser-telemetry-signals`, after all decision gates are met.

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

Reconsideration requires all of the following:

1. A representative physical-device and browser matrix, including low-end Android, iOS Safari, private modes, in-app browsers, privacy tools, extensions, and accessibility configurations.
2. An adversarial matrix covering plain HTTP clients, default and stealth Selenium/Playwright/Puppeteer, headed Chromium, patched properties, profile/session rotation, real-browser automation, and distributed low-and-slow collection.
3. Labeled shadow data demonstrating incremental detection or false-positive reduction against a behavior-only baseline; absence of measured lift is a stop condition.
4. Frontend and product approval of explicit bundle, main-thread, failure-rate, menu-usability, battery, and conversion budgets.
5. Security approval of the untrusted-client threat model, replay controls, fail-open semantics, abuse resistance, and operational kill switch.
6. Privacy/legal approval of necessity, proportionality, purpose, lawful basis or applicable terminal-device exemption, notice, retention, deletion, cross-restaurant correlation, and jurisdictional obligations.
7. A first-party delivery model with pinned assets, license/SBOM review, monitoring disabled, CSP/egress controls, and an automated no-unexpected-outbound-request test.
8. Named maintenance ownership, independent sensor versioning, telemetry schema governance, observability, rollback, and decommission criteria.
9. A recorded final decision of `no adoption`, `bounded continuation PoC`, or `small internal sensor`.

### Relationship to `bootstrap-risk-service`

`bootstrap-risk-service` remains an independent service-foundation change. This research neither modifies nor depends on its runtime implementation, decision API, OpenAPI schema, configuration, deployment, or initial shadow-mode ALLOW behavior. Browser telemetry must not be added to that change to bypass the gates above. Any approved implementation must be proposed later as a separate, reversible change.

## Capabilities

### New Capabilities

None. This is a research and documentation change with `skip_specs: true`; it introduces no externally observable system behavior.

### Modified Capabilities

None. No existing capability requirement changes.

## Impact

Only OpenSpec planning artifacts and, when the tasks are applied, repository-owned research documentation, PoC tooling, sanitized evidence, dependency locks, and validation checks are affected. Runtime application code, public or internal APIs, infrastructure, customer traffic, and production dependencies remain unchanged.
