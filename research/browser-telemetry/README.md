# Browser Telemetry Research

Status: **research-only; pending external review**

Provisional decision: **DEFER BROWSER TELEMETRY**

Production authorization: none.

This directory materializes the completed FingerprintJS/BotD research, its sanitized local PoC evidence, a reproducible first-party harness, supply-chain evidence, and the packet needed for real human review. It is not imported by any storefront or service and does not modify production behavior.

The governing OpenSpec change is `openspec/changes/investigate-browser-telemetry-signals/`. Review `proposal.md`, `design.md`, and `tasks.md` before using this material.

## Decision boundary

The evidence does not show material detection improvement against the relevant distributed or evasive attackers. Major compatibility, privacy, performance, false-positive, and labeled-traffic gaps remain. Therefore:

- FingerprintJS is reference material only.
- FingerprintJS `visitorId` is not identity, device identity, authentication evidence, trust, or enforcement evidence. It is an environment-derived correlation output whose value can change or collide.
- BotD is not an enforcement authority. A positive may add risk only when corroborated; a negative does not prove that a human is present and must not lower risk as human attestation.
- Neither project should be forked.
- Browser-reported data is optional, attacker-controlled, suppressible, spoofable, and replayable.
- Missing, blocked, malformed, or failed collection is diagnostic/availability information, not automatic abuse evidence.
- No ordinary customer may be blocked or challenged solely because telemetry is missing or suspicious.
- Browser telemetry must not gate menu rendering, and full collectors must not run synchronously on every initial menu visit.
- A signed or challenge-bound payload is not authoritative. A server challenge may constrain freshness, origin, audience, session, expiry, and basic replay. A signature or MAC may constrain transport integrity or prove possession of a browser-visible value. Neither establishes truthful client measurement.
- No permanent credential belongs in browser JavaScript.
- Redis-backed cross-store behavior and server-side commercial outcomes remain the primary anti-scraping detector.

Any future bounded research would require a separate reviewed OpenSpec change, such as `continue-browser-telemetry-poc`, and must be small, first-party, privacy-reviewed, independently versioned, asynchronous/fail-open, and justified by labeled incremental value. A production implementation change may be considered only after that continuation demonstrates measurable incremental value and receives every required review; production adoption is not planned or authorized by this change. This research must not be folded into `bootstrap-risk-service` and authorizes no customer-facing enforcement.

## What is in this directory

- `poc/`: local first-party page and scenario runner. Raw environment-cluster values exist only transiently in browser/Node memory so the runner can count distinct outputs; they are never written.
- `tests/`: deterministic egress and evidence-safety tests.
- `lib/` and `scripts/`: allowlisted local server, browser configuration, sanitization, validation, bundle measurement, and dependency evidence.
- `evidence/baseline-2026-07-30.sanitized.json`: immutable sanitized evidence from the completed local PoC.
- `evidence/baseline-metadata.json`: exact environment and methodology metadata used during baseline sanitization.
- `evidence/bundle-sizes.json`: reproducible package-asset size measurements.
- `evidence/licenses.json`, `evidence/sbom.cdx.json`, and `evidence/npm-audit.json`: technical supply-chain evidence, not governance approval.
- `evidence/upstream-licenses/`: preserved license notices for every locked package entry.
- `source-evidence.md`: claim-to-source matrix.
- `DEPENDENCIES.md`: dependency, license, SBOM, audit, and update posture.
- `reviews/README.md`: pending external-review decisions, checklists, and reviewer record template.

## Reproducibility

### Prerequisites

Baseline host:

- macOS 26.5.2, build 25F84
- Google Chrome 150.0.7871.188
- Node.js 26.5.0
- npm 11.17.0
- Playwright 1.62.1
- FingerprintJS 5.2.0
- BotD 2.0.0

The committed lockfile pins exact package versions and registry integrity. The harness defaults to Playwright's installed `chrome` channel. Override configuration without committing a local path:

```sh
export BROWSER_CHANNEL=chrome
# Or, only when channel discovery is unavailable:
export CHROME_PATH="/absolute/path/to/a/chromium-compatible-browser"
```

The path value is used for launch and is not retained in evidence.

### Install and canonical checks

From this directory:

```sh
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
npm ci --ignore-scripts
npm run lint
npm test
npm run evidence:validate
npm run evidence:bundles
npm run evidence:licenses
npm run evidence:sbom
npm run evidence:audit
```

There was no pre-existing repository lint, test, security, documentation, license, or SBOM command. The commands above are the canonical checks for this isolated research harness. The repository-level canonical planning check remains strict OpenSpec validation.

`npm ci --ignore-scripts` deliberately prevents dependency lifecycle scripts. The system Chrome configuration avoids downloading a Playwright-managed browser. A reviewer may choose a separately controlled browser installation, but must record the exact version and configuration.

### Run the PoC

Run every preserved scenario, including headed and headless modes:

```sh
npm run poc
```

For a non-GUI environment:

```sh
npm run poc:headless
```

Run one named scenario:

```sh
npm run poc -- --only headless_chrome_basic_stealth
```

Use `--output <new-file>` to select a destination. Without it, the runner writes a timestamped, non-overwriting, sanitized file under `evidence/runs/`; that directory is ignored to prevent accidental evidence churn. The runner fails rather than overwriting an existing output.

Scenarios include warm and cold pages, headed/headless Chrome, patched WebDriver, patched user agent, a basic two-patch bypass, a different screen, 6x CDP CPU throttling, and an isolated monitoring negative control. The negative control records the known external origin and aborts both requests before completion. All other scenarios fail evidence validation if an external origin is recorded.

### Recreate the sanitized baseline

The committed baseline was created from the completed local raw result with:

```sh
npm run evidence:sanitize -- \
  --input <uncommitted-raw-result.json> \
  --metadata evidence/baseline-metadata.json \
  --output <new-sanitized-output.json>
node scripts/validate-evidence.mjs <new-sanitized-output.json>
```

Do not overwrite the committed baseline. The raw result is intentionally not committed. Sanitization removes raw environment-cluster outputs, full user agents, component/error values, developer paths, and request paths. It retains scenario-level counts, coarsened timings, detector names, error source names, and approved request origins. The validation layer rejects forbidden keys, likely raw 128-bit hexadecimal values, full user agents, developer-home paths, JWT-like values, secret/token fields, and unapproved origins.

## Baseline methodology

The baseline was measured at `2026-07-30T16:49:58.299Z` from a local first-party HTTP origin. The harness ran FingerprintJS before BotD. Sample counts were 15 for warm repeated-page scenarios, 10 for cold-page and synthetic-throttle scenarios, 5 for headed cold-page scenarios, and 1 for the isolated monitoring negative control. `Math.random` was forced to zero in the monitoring control. CDP `Emulation.setCPUThrottlingRate` with `rate=6` provided synthetic CPU throttling.

The exact baseline is in `evidence/baseline-2026-07-30.sanitized.json`. Rounded medians below are milliseconds:

| Scenario | n | Environment clusters | FP load | FP collect | BotD load | BotD detect | BotD positive | Positive detector names |
|---|---:|---:|---:|---:|---:|---:|---|---|
| `headless_chrome_baseline` | 15 | 1 | 17.3 | 0.7 | 50.2 | 0.0 | yes | app version, user agent, WebDriver |
| `headless_chrome_cold_pages` | 10 | 1 | 39.5 | 51.9 | 2.8 | 0.1 | yes | app version, user agent, WebDriver |
| `headless_chrome_webdriver_patched` | 15 | 1 | 17.2 | 0.8 | 50.5 | 0.0 | yes | app version, user agent |
| `headless_chrome_basic_stealth` | 10 | 1 | 38.7 | 51.2 | 2.9 | 0.2 | no | none |
| `headless_chrome_6x_cpu_cold_pages` | 10 | 2 | 117.8 | 173.0 | 11.9 | 1.3 | yes | app version, user agent, WebDriver |
| `monitoring_enabled_negative_control` | 1 | 1 | 50.0 | 54.7 | 3.6 | 0.2 | yes | app version, user agent, WebDriver |
| `headless_chrome_different_screen` | 15 | 1 | 17.6 | 0.8 | 50.1 | 0.0 | yes | app version, user agent |
| `headed_chrome_playwright_cold_pages` | 5 | 1 | 37.9 | 51.4 | 2.9 | 0.2 | yes | WebDriver |
| `headed_chrome_playwright_webdriver_patched_cold_pages` | 5 | 1 | 38.5 | 51.7 | 2.8 | 0.2 | no | none |

Interpretation:

- Basic WebDriver and user-agent patching bypassed all BotD positives in this local setup. This is bypass evidence, not a claim that every attacker bypasses BotD.
- Headed Playwright still produced a BotD positive until WebDriver was patched. Headed rendering alone is not proof of a human.
- Two distinct FingerprintJS environment outputs appeared across ten 6x-throttled cold pages. This is synthetic single-host instability evidence, not a population stability estimate.
- Screen and headed/headless changes altered environment-derived outputs in this setup. Correlation is not device identity.
- BotD source collection reported a `process` source error in these Chrome scenarios while detection still returned positive or negative. Collection failure is not equivalent to abuse.
- Warm and cold timing phases have materially different shapes; do not combine them into a production latency claim.

## Package asset sizes

`npm run evidence:bundles` measures the exact locked assets with Node.js `readFile`, gzip level 9, and Brotli default settings:

| Asset | Raw bytes | gzip bytes | Brotli bytes |
|---|---:|---:|---:|
| FingerprintJS ESM | 129,311 | 37,548 | 31,484 |
| FingerprintJS minified ESM | 36,746 | 16,178 | 14,239 |
| BotD ESM | 27,519 | 6,596 | 5,750 |

The original report's CLI gzip measurements were 37,558, 16,188, and 6,608 bytes because gzip stream headers differ by invocation. Raw bytes match. These are package-asset sizes, not measured application-bundle deltas; bundler behavior, shared code, and compression configuration can differ.

## Egress behavior

Source review showed that both npm packages default `monitoring` to true and may issue requests to `m1.openfpcdn.io`. The harness always passes `monitoring: false` except in the explicitly named negative control. Tests force the packages' sampled monitoring branch with `Math.random = () => 0`:

- With `monitoring: false`, no package-generated third-party request may be attempted.
- With monitoring enabled in the isolated control, both known URLs must be observed and blocked.
- Any unknown third-party attempt fails the test.

This is a regression guard for the pinned packages, not proof that future versions or unrelated code are egress-free.

## Trust and challenge model

A hypothetical future server challenge could contain a random nonce, issue and expiry times, origin, audience, scope, a server-side session binding, and key identifier, protected by a server signature. The server would verify the signature, binding, lifetime, and one-time consumption. TLS protects transport; server-side nonce consumption limits replay of the same envelope.

It still cannot establish that browser measurements are truthful. An attacker can alter JavaScript, synthesize fields, suppress APIs, replay allowed values under a fresh challenge, or automate a real browser. A MAC key delivered to JavaScript is browser-visible and therefore not a permanent trust anchor. Server-side signing after receipt can protect downstream storage integrity, not retroactively authenticate the measurement.

## Privacy and legal posture

Fingerprint-like outputs and network activity may be personal information, personal data, online identifiers, or unique identifiers. Access to browser APIs may implicate ePrivacy terminal-equipment rules even without writing a traditional cookie. Any future bounded research requires jurisdiction-specific privacy/legal review of necessity, proportionality, purpose, lawful basis or exemption, transparency, consent where applicable, DPIA/LIA screening, retention, deletion/DSR, residency, tenant isolation, and cross-restaurant correlation.

Prefer coarsened, short-lived, derived features and decision outcomes over raw component values or long-lived high-entropy identifiers. Advertising, unrelated analytics, or profile enrichment reuse is prohibited by this research decision.

This is technical risk analysis, not legal advice. Primary sources are indexed in `source-evidence.md`.

## Unsupported conclusions and unresolved evidence

The current evidence does not support claims of material detection lift, lower false positives, durable identity, calibrated human probability, conversion safety, or superiority to server-observed behavior.

Future reconsideration gates—not tasks required to close this documentation change—include:

- Physical low/high-end Android and iOS Safari performance, battery, memory, compatibility, and failures.
- WhatsApp, Instagram, Facebook, Telegram, and other in-app browsers/WebViews.
- Private mode, Brave, Firefox protections, blockers, corporate policy, accessibility tools, plugin/PDF settings, and representative extensions.
- Selenium, Puppeteer, stealth tools, undetected ChromeDriver, patched CDP, profile rotation, fabricated/replayed payloads, and distributed low-and-slow attackers.
- Longitudinal stability across browser/OS updates, settings changes, and WebView lifecycle changes.
- Privacy-approved labeled shadow traffic comparing behavior-only and behavior-plus-browser-signal decisions, including false positives, false negatives, conversion, and incremental lift.
- Evidence that any lift exceeds equivalent investment in Redis correlation and commercial-outcome feedback.

No production or customer-data experiment is authorized by this repository material.

## Review state

Security architecture, privacy/legal, frontend, platform, product, and dependency/license governance reviews remain pending. Their tasks must stay unchecked until real reviewer records exist. The final reviewed outcome also remains pending; the allowed outcomes are `no adoption`, `bounded continuation PoC`, or `small internal sensor`.

Until actual reviewers record an outcome, the provisional decision remains **DEFER BROWSER TELEMETRY**.
