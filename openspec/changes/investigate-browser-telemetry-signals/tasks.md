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

Governance migration note: the technical evidence and completion state of task 2.5 are unchanged. Its former external-governance disposition is superseded for this personal project by the project-owner dependency and license acceptance in task 3.6, with the assurance limitation stated there.

## 3. Project-Owner Governance Records

- [x] 3.1 Fernando Homem da Costa (`nandohdc`) records a project-owner security architecture self-review covering browser trust assumptions; correlation versus identity; authenticity versus truthfulness; integrity versus completeness; FingerprintJS, BotD, and server-challenge limitations; client manipulation; enforcement risk; production exclusions; and support for deferral. The record must state that it is a project-owner self-review and does not constitute independent security assurance.
- [x] 3.2 Fernando Homem da Costa (`nandohdc`) records the binding project-owner privacy restriction: **No production or real-user browser telemetry is authorized. A qualified privacy/legal review is mandatory before any future continuation involving real-user collection.** The record must state that it is not legal advice, asserts no privacy-law compliance conclusion, and applies before experiments, shadow collection, pilots, analytics, or enforcement involving real-user telemetry.
- [x] 3.3 Fernando Homem da Costa (`nandohdc`) records a project-owner technical self-review covering browser/Web API assumptions, PoC reproducibility, exact-origin egress, monitoring blocking, sanitization, credential/token rejection, dependency isolation, local binding, automation scenarios, performance and bundle evidence, production isolation, and validation results. The record must state that it does not constitute independent technical assurance.
- [x] 3.5 Fernando Homem da Costa (`nandohdc`) records the project-owner product decision among no further browser-telemetry work, a bounded continuation PoC, or production implementation, preserving that current evidence authorizes no production implementation, demonstrates no incremental lift or acceptable real-user privacy basis, keeps behavior and commercial outcomes primary, and names only `continue-browser-telemetry-poc` as a possible successor.
- [x] 3.6 Fernando Homem da Costa (`nandohdc`) records project-owner dependency and license acceptance covering inventory, exact lockfile and integrity, notices, CycloneDX SBOM, npm audit, bundle evidence, reuse classifications, and development-only scope. The record must state that it is not formal legal advice or external open-source governance approval.

Task 3.4 was consolidated into the project-owner technical self-review in task 3.3. Existing numbering is retained so completed task 2.5 continues to reference dependency and license acceptance under task 3.6.

## 4. Decision Record and Validation

- [ ] 4.1 Fernando Homem da Costa (`nandohdc`) records the final project-owner outcome consolidating the security self-review, privacy restriction, technical self-review, dependency/license acceptance, product decision, remaining limitations, unresolved concerns, follow-up actions, reconsideration requirements, and explicit production and real-user authorization status. Unless his written evidence supports a stricter decision, the expected outcome is no adoption at this time, browser telemetry deferred, production authorization none, real-user collection authorization none, and only a separately approved bounded continuation PoC through `continue-browser-telemetry-poc`.
- [x] 4.2 If the outcome is `bounded continuation PoC` or `small internal sensor`, require a separate OpenSpec proposal and explicitly prohibit using this research change to modify `bootstrap-risk-service`, storefront code, risk scoring, enforcement, or production dependencies.
- [x] 4.3 Confirm with repository and dependency diffs that no production browser telemetry, runtime application behavior, public/internal API field, Kong behavior, Go risk-service behavior, Redis state, deployment resource, or customer-facing control was introduced.
- [x] 4.4 Run the permanent PoC and its egress, sanitization, and reproducibility checks; record real command output and investigate every difference from the preserved baseline without silently replacing it.
- [x] 4.5 Run strict OpenSpec validation for `investigate-browser-telemetry-signals`, resolve all artifact errors, and confirm that specs remain skipped because there is no capability delta.

## 5. Unresolved Evidence Gaps — Not Production Implementation Tasks

The following gaps block a future adoption claim. They do not authorize browser collection or runtime work under this change. They may be resolved only by a separately approved research protocol. A qualified privacy/legal review is mandatory before any protocol involving real-user collection, including experiments, shadow collection, pilots, analytics, or enforcement.

- Physical high-end and low-end Android plus iOS Safari performance, compatibility, battery, memory, and failure evidence.
- WhatsApp, Instagram, Facebook, Telegram, and other embedded-browser/WebView evidence.
- Private browsing, Brave, Firefox protections, content blockers, corporate policy, accessibility tools, PDF/plugin settings, and representative extension false-positive evidence.
- Selenium, Puppeteer, stealth tooling, undetected ChromeDriver, patched CDP, headed real-browser automation, profile/session rotation, fabricated/replayed telemetry, and distributed low-and-slow attacker evidence.
- Longitudinal identifier stability across browser and operating-system updates, setting changes, and WebView lifecycle changes.
- Labeled shadow traffic comparing behavior-only decisions with behavior-plus-browser-signal decisions, including false-positive, false-negative, conversion, and incremental-lift analysis.
- Evidence that any measured lift is greater than investing equivalent effort in Redis-backed cross-store correlation and commercial-outcome feedback.

Until a separately approved process resolves the relevant gaps and the required project-owner records accept the result, the decision remains **defer browser telemetry**. Production authorization and real-user collection authorization remain **none**.
