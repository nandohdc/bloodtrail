## 1. Permanent Research Artifacts

- [x] 1.1 Move the completed research report into `research/browser-telemetry/README.md`, preserving the provisional deferral decision, trust limits, measurements, reuse classifications, and evidence caveats from `design.md`.
- [x] 1.2 Recreate the temporary PoC under `research/browser-telemetry/poc/` with a prominent research-only/non-production notice and no import from any storefront or runtime build.
- [x] 1.3 Add a research-only `package.json` and committed lockfile that pin FingerprintJS 5.2.0, BotD 2.0.0, Playwright 1.62.1, and package integrity; make the harness reproducible with `npm ci`.
- [x] 1.4 Replace the developer-specific Chrome path and `/tmp` output path with documented configuration and repository-relative evidence output without changing runtime application configuration.
- [x] 1.5 Sanitize the existing PoC output and preserve it as immutable baseline evidence under `research/browser-telemetry/evidence/`, removing visitor IDs, raw component values, user-home paths, and unnecessary full user-agent detail.
- [x] 1.6 Document the measured package versions, Node/npm/Chrome/macOS versions, sample counts, cold/warm distinction, CPU-throttling method, bundle-size commands, evidence timestamp, and known reproducibility limits.
- [x] 1.7 Produce `research/browser-telemetry/source-evidence.md` mapping each material finding to an exact package tag/file, package integrity, upstream issue or primary legal source, retrieval date, evidence type, and confidence/limitation.

## 2. Reproducibility, Egress, and Supply Chain

- [x] 2.1 Add an automated Playwright test that forces the packages' sampled monitoring branch, passes `monitoring: false` to both packages, rejects every unexpected non-first-party request, and fails if any third-party URL is attempted.
- [x] 2.2 Add an isolated negative-control test proving the harness detects the known FingerprintJS and BotD monitoring URLs when monitoring is explicitly enabled, without allowing the requests to complete.
- [x] 2.3 Add deterministic commands to run headed, headless, patched-WebDriver, patched-UA, cold-page, and CPU-throttled scenarios and to write a new evidence file without overwriting the baseline.
- [x] 2.4 Add and test a sanitization/validation step that rejects evidence containing `visitorId`, raw component values, developer paths, secrets, tokens, or unapproved request URLs.
- [x] 2.5 Complete dependency-license and SBOM technical evidence review for the research harness, recording MIT obligations, development dependencies, copied-source status, package integrity, notices, vulnerability results, and a disposition that remains pending external governance approval under task 3.6.

## 3. Research Review

- [ ] 3.1 Obtain security architecture review of the attacker-controlled browser trust model, freshness-versus-authenticity distinction, replay controls, fail-open semantics, bypass findings, supply-chain controls, and prohibition on enforcement authority.
- [ ] 3.2 Obtain privacy/legal review of necessity and proportionality, terminal-device-access rules, lawful basis or exemption, notice, DPIA/LIA needs, data minimization, retention, deletion, tenant access, cross-restaurant correlation, jurisdictions, and prohibition on advertising or unrelated analytics reuse.
- [ ] 3.3 Obtain frontend review of collection timing, main-thread work, bundle impact, browser compatibility, failure isolation, menu-usability risk, and the prohibition on synchronous full collection during initial menu rendering.
- [ ] 3.4 Obtain platform review of first-party asset delivery, version pinning, CSP/egress restrictions, test reproducibility, CI isolation, observability, ownership, rollback, and confirmation that the harness cannot enter production builds.
- [ ] 3.5 Obtain product review of customer-experience risk, conversion evidence gaps, behavioral-detector priority, challenge principles, and the requirement for measured incremental value before reconsideration.
- [ ] 3.6 Obtain dependency/license or open-source governance review of the exact lock integrity, license notices and obligations, SBOM, vulnerability evidence, package egress, copied-source status, and research-only disposition.

## 4. Decision Record and Validation

- [ ] 4.1 Record exactly one reviewed final outcome in the permanent research report: `no adoption`, `bounded continuation PoC`, or `small internal sensor`, including owners, review dates, evidence relied on, unresolved gaps, and reconsideration/expiry conditions.
- [x] 4.2 If the outcome is `bounded continuation PoC` or `small internal sensor`, require a separate OpenSpec proposal and explicitly prohibit using this research change to modify `bootstrap-risk-service`, storefront code, risk scoring, enforcement, or production dependencies.
- [x] 4.3 Confirm with repository and dependency diffs that no production browser telemetry, runtime application behavior, public/internal API field, Kong behavior, Go risk-service behavior, Redis state, deployment resource, or customer-facing control was introduced.
- [x] 4.4 Run the permanent PoC and its egress, sanitization, and reproducibility checks; record real command output and investigate every difference from the preserved baseline without silently replacing it.
- [x] 4.5 Run strict OpenSpec validation for `investigate-browser-telemetry-signals`, resolve all artifact errors, and confirm that specs remain skipped because there is no capability delta.

## 5. Unresolved Evidence Gaps — Not Production Implementation Tasks

The following gaps block a future adoption claim. They do not authorize browser collection or runtime work under this change. They may be resolved only by an approved research protocol and, where applicable, prior privacy/legal review:

- Physical high-end and low-end Android plus iOS Safari performance, compatibility, battery, memory, and failure evidence.
- WhatsApp, Instagram, Facebook, Telegram, and other embedded-browser/WebView evidence.
- Private browsing, Brave, Firefox protections, content blockers, corporate policy, accessibility tools, PDF/plugin settings, and representative extension false-positive evidence.
- Selenium, Puppeteer, stealth tooling, undetected ChromeDriver, patched CDP, headed real-browser automation, profile/session rotation, fabricated/replayed telemetry, and distributed low-and-slow attacker evidence.
- Longitudinal identifier stability across browser and operating-system updates, setting changes, and WebView lifecycle changes.
- Labeled shadow traffic comparing behavior-only decisions with behavior-plus-browser-signal decisions, including false-positive, false-negative, conversion, and incremental-lift analysis.
- Evidence that any measured lift is greater than investing equivalent effort in Redis-backed cross-store correlation and commercial-outcome feedback.

Until a separately approved process resolves the relevant gaps and the reviews accept the result, the decision remains **defer browser telemetry**.
