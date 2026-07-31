## Context

See `proposal.md` for the research question and business motivation. This change is documentation and research only: there is no production browser sensor, no browser-telemetry API, and no externally observable behavior to specify, so `.openspec.yaml` sets `skip_specs: true`.

The current anti-scraping direction keeps Kong as a thin enforcement point, the Go risk service as the future decision authority, and Redis/Valkey as short-lived behavioral state. Cross-store traversal, extraction volume, session history, network hints, cart activity, checkout, and order outcomes are server-observed primary evidence. Browser telemetry, if ever reconsidered, is optional untrusted input to that model.

Evidence in this document is labeled by origin:

- **Source review**: inspected FingerprintJS 5.2.0 and BotD 2.0.0 package/source behavior.
- **Local measurement**: PoC executed on one macOS/Chrome host on 2026-07-30.
- **Upstream issue evidence**: a reported behavior, not an independently reproduced population rate.
- **Recommendation**: a design choice based on the available evidence and stated constraints.
- **Evidence gap**: a required measurement or approval that remains unresolved.

## Goals / Non-Goals

**Goals:**

- Preserve the research reasoning, measurements, caveats, and provisional deferral decision.
- Define a reproducible, pinned, first-party PoC that can be rerun without enabling production collection.
- Make browser trust boundaries, replay limits, privacy constraints, egress behavior, and reuse choices explicit.
- Establish objective gates for any future reconsideration.

**Non-Goals:**

- Design or implement a production telemetry endpoint, schema, score, collector, or enforcement rule.
- Calibrate risk weights or permanent performance thresholds.
- Treat one desktop PoC as physical-mobile, compatibility, conversion, or labeled-production evidence.
- Establish a legal basis or provide legal advice.
- Modify `bootstrap-risk-service` or authorize any production browser-telemetry implementation change.

## Decisions

### 1. Defer browser telemetry and keep server-observed behavior primary

**Decision:** FingerprintJS is reference material only, BotD is not an enforcement authority, neither repository will be forked, and no full browser collector will run synchronously on every initial menu visit. Redis-backed behavioral correlation and commercial outcomes remain primary.

**Rationale:** The PoC proves that basic automation can be detected and minimally patched. It does not prove incremental detection against the target abuse population, lower false positives, or acceptable customer cost. Deferral preserves the option to invest first in behavior that directly represents cross-store extraction and remains visible when JavaScript is suppressed or fabricated.

**Alternatives considered:**

- Adopt both packages: rejected because the evidence does not justify the combined privacy, latency, bypass, and maintenance surface.
- Adopt FingerprintJS as device identity: rejected because the aggregate is an environment-derived hash with collisions and instability, not identity or authentication.
- Adopt BotD as a block decision: rejected because negative results do not attest humanity and basic patching bypassed the tested result.
- Maintain forks: rejected because continuous browser-adversary research would become internal ownership without demonstrated value.
- Build a small internal sensor immediately: deferred until labeled lift and representative compatibility evidence exist.

### 2. FingerprintJS 5.2.0 is environment-clustering reference material

#### Source-review findings

The inspected package exposes 42 built-in sources. They cover:

- high-entropy rendering/environment values: fonts, font preferences, canvas, audio, WebGL basics/extensions, math behavior, and architecture;
- device/display hints: screen resolution/frame, color depth/gamut, HDR, device memory, hardware concurrency, and touch support;
- browser/OS hints: platform, OS CPU, vendor/flavors, UA client hints, plugins, PDF viewer, locale/languages, timezone, and date-time locale;
- browser capability and policy state: cookies, session/local storage, IndexedDB, WebSQL, Apple Pay, private-click measurement, audio base latency, DOM blockers, forced/inverted colors, monochrome, contrast, reduced motion, and reduced transparency.

Each component is represented as either `{ value, duration }` or `{ error, duration }`. Component names are sorted; successful values are JSON-serialized; a failed component contributes the literal `error`; and the canonical string is hashed using MurmurHash3 x64 128-bit. One changed component can therefore change `visitorId`. Component status and duration are operationally more interpretable than the aggregate identifier, although the values remain attacker-controlled.

The open-source confidence value is a coarse platform-class heuristic rather than a calibrated anti-abuse probability. The inspected implementation uses fixed categories such as Android `0.4`, Safari/WebKit approximately `0.3` to `0.5`, Windows `0.6`, macOS `0.5`, and other platforms `0.7`. It does not establish device uniqueness, a genuine browser, or human control and must not be incorporated as trust evidence.

The upstream version policy says identifier stability is attempted within a minor version but may still change for stability fixes; comparison across incompatible versions can be unknown. Upstream issues also document examples of private-mode changes, Safari component instability, WebView/language changes, and collisions across different iOS devices. These reports reinforce the model:

```text
visitorId = short-lived browser_environment_cluster hint
visitorId != person
visitorId != physical device
visitorId != authentication or trust
```

Deleting stored values alone is not equivalent to deleting a persisted FingerprintJS ID because the open-source ID is recomputed from environment components. Privacy mode, storage/API availability, browser/OS updates, browser settings, extensions, accessibility/privacy preferences, and WebView context can still change the component set or values.

#### Operational finding

The npm build defaults `monitoring` to enabled and samples an installation-statistics request. The PoC observed no package-generated third-party requests with `monitoring: false`; when `Math.random()` was forced into the sampled branch and monitoring was enabled, it observed requests to:

- `https://m1.openfpcdn.io/fingerprintjs/v5.2.0/npm-monitoring`
- `https://m1.openfpcdn.io/botd/v2.0.0/npm-monitoring`

Any research rerun must explicitly disable monitoring and fail on unexpected egress. A possible future sensor must use pinned, self-hosted first-party assets plus CSP and network controls; relying on a public CDN is rejected.

### 3. BotD 2.0.0 is positive-indicator reference material, not proof of humanity

#### Source-review findings

The inspected package has 23 collected sources and 18 detectors. Its techniques include:

- `navigator.webdriver`, headless/user-agent markers, language state, product-sub, plugins, MIME types, connection RTT, and outer-window size;
- Selenium/WebDriver document attributes and distinctive global properties;
- browser-specific inconsistencies in notifications, `eval` length, function binding, plugin prototypes, and runtime/API shape;
- WebGL renderer strings and error-stack artifacts;
- Electron/NW.js process data and legacy artifacts for tools such as PhantomJS, SlimerJS, Awesomium, CefSharp, FMiner, NightmareJS, Phantomas, Rhino, Sequentum, and WebDriverIO;
- indirect detection of default Playwright/Puppeteer/Selenium through common WebDriver or headless artifacts rather than authoritative tool attestation.

The public top-level result is either `{ bot: false }` or `{ bot: true, botKind }`; it has no top-level `unknown`, `failed`, or `unsupported` state. Individual source states and detector results are more detailed, and a failed source can coexist with `bot: false`. A safe adapter would therefore preserve collection and per-signal status rather than flattening failure into “not a bot.” When multiple detectors are positive, aggregation order can determine the final `botKind`; this is not a calibrated ensemble score.

Higher-value research candidates are narrow positive artifacts such as an explicit WebDriver marker, an explicit headless UA marker, or a highly specific automation global. Brittle candidates include plugin count/type, MIME prototypes, notification-permission mismatches, RTT, zero outer-window dimensions, eval/function-string lengths, product-sub checks, and legacy browser inconsistencies. Upstream issue reports show extension, PDF/plugin setting, privacy tool, uncommon browser, WebView, and Samsung Internet false-positive cases. These are issue reports, not measured storefront rates, but they define mandatory legitimate-user tests.

Repository activity alone is not detector freshness. In the inspected source history, the newest detector/source-path change was dated 2024-10-23, while the 2.0.0 package was released later. Adopting or forking the project would require explicit ongoing browser-research ownership.

#### Interpretation rules

```text
specific BotD positive -> may increase a future shadow risk feature
BotD negative          -> no evidence that the visitor is human
BotD failure/unknown   -> coverage and availability information
missing JavaScript     -> not automatic abuse for an ordinary first-store visitor
```

Neither a detector result nor its absence may independently choose `allow`, `throttle`, `challenge`, or `block`.

### 4. Preserve the PoC as bounded evidence, not a production prototype

#### Environment

The local run used:

- macOS 26.5.2, build 25F84;
- Google Chrome 150.0.7871.188;
- Node.js 26.5.0 and npm 11.17.0;
- Playwright 1.62.1;
- `@fingerprintjs/fingerprintjs` 5.2.0;
- `@fingerprintjs/botd` 2.0.0;
- a local first-party HTTP server at `127.0.0.1`;
- unpacked npm ESM bundles, with raw component values excluded from normal results.

The harness collected per-phase timings, component status/duration, BotD detector-level results, request URLs, and limited heap information. Playwright routing allowed only the local origin and aborted external requests. The sampled monitoring branch was exercised deterministically by overriding `Math.random`.

#### Scenarios and automation results

| Scenario | Relevant patch | BotD result | Evidence interpretation |
|---|---|---|---|
| Default headless Chrome | None | `bot: true`; app version, UA, and WebDriver positive | Detects commodity/default automation |
| Headless Chrome | `navigator.webdriver = false` | `bot: true`; headless app version and UA remained | One patch was insufficient while UA exposed headless mode |
| Headless Chrome “basic stealth” | WebDriver patched and normal Chrome UA | `bot: false` | Minimal public-artifact patch bypassed the tested result |
| Headed Playwright | None | `bot: true`; only WebDriver positive | No distinct proof of Playwright; result depended on one generic property |
| Headed Playwright | WebDriver patched | `bot: false` | Real/interactive Chromium automation remains a gap |

The PoC did not attempt to conceal the public implementation, attest the harness, or model a determined adversary. An attacker can omit the script, fabricate results, patch APIs, replay captured payloads unless server controls prevent replay, or create a fresh profile per store.

#### Performance measurements

The following are local Chrome measurements, not mobile-device benchmarks. “Sequential median” is the sum of the separately measured phase medians, not a percentile of an independently measured end-to-end duration.

| Scenario | Samples | FingerprintJS load median | FingerprintJS get median | Sequential median | BotD load+detect median |
|---|---:|---:|---:|---:|---:|
| Headless cold pages | 10 | 39.5 ms | 51.9 ms | 91.4 ms | 2.9 ms |
| Headless cold pages, 6x CPU throttle | 10 | 117.8 ms | 173.0 ms | 290.8 ms | 13.2 ms |
| Headed Playwright cold pages | 5 | 37.9 ms | 51.4 ms | 89.3 ms | 3.1 ms |
| Headed Playwright, WebDriver patched | 5 | 38.5 ms | 51.7 ms | 90.2 ms | 3.0 ms |

Two unique FingerprintJS IDs appeared across the ten 6x-CPU cold-page samples in the same synthetic scenario. This is an observed instability signal requiring diagnosis, not a population stability rate. Warm-page timing was collected but is not used for customer-impact conclusions because repeated loads and browser caches make it unlike a first storefront visit.

No conclusion can be drawn about battery, real low-end CPU, Safari/WebKit, Android WebViews, in-app browsers, content blockers, accessibility tools, or conversion.

#### Bundle-size measurements

Sizes were measured from the exact unpacked package assets with gzip level 9:

| Asset | Raw bytes | Gzip bytes | Note |
|---|---:|---:|---|
| FingerprintJS `dist/fp.min.js` | 36,746 | 16,188 | Pre-minified browser build |
| FingerprintJS `dist/fp.esm.js` | 129,311 | 37,558 | ESM asset imported by the PoC |
| BotD `dist/botd.esm.js` | 27,519 | 6,608 | ESM asset imported by the PoC |

A future application bundler could produce different output, so these are package-asset observations, not a production bundle budget. Both inspected packages declare MIT licenses and no runtime package dependencies; transitive development/build tooling, copied source, notices, and the eventual application SBOM still require formal review.

### 5. Browser trust model separates freshness, integrity, authenticity, and truth

| Property | What it means here | What can provide it | What it does not prove |
|---|---|---|---|
| Freshness | Payload is tied to a recent server challenge | Short expiry, nonce, issuance time, one-time use | Browser state is genuine |
| Transport integrity | Bytes were not changed after entering the protected transport | TLS | Bytes were truthful before transport |
| Stored-event integrity | Stored canonical bytes have not changed after a server trust boundary | Server-side hash/MAC/signature and controlled storage | Client collection was complete or honest |
| Workload authenticity | The receiving service issued/validated the challenge | Server signature, audience, service identity | A human or approved script produced the telemetry |
| Browser authenticity | Approved code ran in an untampered browser | Not established by ordinary JavaScript | Cannot be inferred from a signed client payload |
| Correlation | Two observations appear environment-similar within a bounded period | Coarsened features and rotating server-side keyed digest | Same person or physical device |
| Automation indication | A known automation artifact was observed | Specific positive detector | All automation is detected, or negatives are human |

The browser and all JavaScript-visible values are attacker-controlled, optional, suppressible, spoofable, patchable, and replayable. A payload signature generated in attacker-controlled JavaScript has no durable secret-based authority. A server-delivered key becomes available to the attacker. A server signature can protect the challenge fields or evidence after receipt, not make client statements true.

### 6. A server-issued challenge can reduce replay but cannot attest the browser

A possible future model, not authorized for implementation by this change, is:

```text
Browser                     First-party telemetry endpoint           Redis
   |                                   |                                |
   | request short-lived challenge     |                                |
   |---------------------------------->|                                |
   | signed {nonce, exp, session,      |                                |
   | origin, audience, scope, key_id}  |                                |
   |<----------------------------------|                                |
   | collect optional minimal signals |                                |
   | submit challenge + envelope       |                                |
   |---------------------------------->| verify signature and binding    |
   |                                   | atomically consume nonce ------>|
   |                                   | validate size/schema/time        |
   |                                   | derive server-side hint          |
```

The challenge may protect recent issuance, intended origin, anonymous session, audience, API scope, expiry, and one-time consumption. It cannot prove that approved JavaScript ran, that selected APIs returned the submitted values, that BotD was not modified, or that a human controlled the browser. An adversary can request a new challenge and fabricate a new payload.

A future envelope would need a version, challenge token/nonce, collection timestamp, status, first-party origin, intended audience/scope, anonymous-session binding, collector versions, selected normalized signals, detector-level status, execution duration, and strict size limits. There must be no permanent browser secret. Detailed detection reasons must not be returned to the requester.

### 7. Missing or failed telemetry remains diagnostic, not guilt

A future service must distinguish:

- `collected`: supported subset returned within budget;
- `partial`: one or more approved signals failed or were unavailable;
- `blocked`: collection or submission was prevented when observable;
- `timeout`: local budget expired;
- `unsupported`: required API unavailable;
- `malformed`, `stale`, `replayed`, or `binding_failed`: server validation outcomes;
- `missing`: no telemetry arrived.

These states measure coverage and abuse attempts only in context. None automatically proves scraping. Ordinary first-store access must remain available when JavaScript is disabled, blocked, slow, or unsupported. A stable match must not create permanent trust, and a changed fingerprint must not create an automatic block.

### 8. Apply privacy minimization before any continuation PoC

Browser fingerprints and probabilistic identifiers can constitute personal data or online identifiers and can implicate terminal-device access rules. First-party delivery and self-hosting reduce third-party exposure but do not remove legal obligations. The relevant review includes, at minimum:

- GDPR definitions and principles, including online identifiers, purpose limitation, data minimization, storage limitation, lawful basis, and privacy by design;
- ePrivacy Directive Article 5(3) and EDPB Guidelines 2/2023 on its technical scope, including device fingerprinting;
- applicable security/strict-necessity exemptions, consent requirements, disclosure, DPIA/LIA, and jurisdiction-specific rules;
- California and other applicable definitions of probabilistic identifiers and internet activity;
- cross-restaurant correlation, controller/processor roles, tenant access, deletion/DSR handling, retention, residency, and purpose governance.

Legal applicability and any exemption are review questions, not conclusions in this technical design.

**Recommended minimization if a bounded PoC is approved:**

- Do not retain raw `visitorId`, canvas, audio, font lists, exact WebGL data, detailed accessibility preferences, or unbounded component/error values.
- Prefer a very small allowlist of coarse, purpose-specific positive automation indicators plus collection status and timing.
- Normalize and validate on the server; derive any short-lived correlation hint as a rotating keyed digest on the server, scoped to the anti-abuse purpose.
- Use short, approved TTLs and prohibit advertising, analytics, personalization, or unrelated profiling reuse through policy and access control.
- Prevent tenant-facing access to cross-restaurant identifiers; expose only approved aggregate security outcomes.
- Document notice, deletion semantics, access logging, key rotation, retention, and decommissioning before collection.

### 9. Reuse only through explicit classification

| Candidate | Classification | Decision and conditions |
|---|---|---|
| FingerprintJS package in production | **REFERENCE** | Study source, version policy, collectors, tests, and failure handling; do not ship the full package under this decision. |
| FingerprintJS `visitorId` and confidence | **REJECT** | Not identity, authentication, trust, device identity, or enforcement input. |
| FingerprintJS collection orchestration, per-source status, duration, and yielding patterns | **REIMPLEMENT** | May inform a smaller independently versioned first-party sensor after approval; do not copy the full high-entropy source set. |
| High-entropy font/canvas/audio/WebGL/accessibility collectors | **REJECT** | Default rejection; reconsider individual data only with necessity and measured incremental lift. |
| BotD package in production | **REFERENCE** | Use detector taxonomy, source behavior, tests, and issue history as research. |
| BotD final `bot` result as a decision | **REJECT** | It collapses important coverage semantics and is bypassable; never an enforcement authority. |
| Narrow explicit WebDriver/headless/specific automation artifacts | **REIMPLEMENT** | Positive-only research candidates for a small sensor, contingent on legitimate-browser and adversarial evidence. |
| Plugin, MIME, permissions, RTT, window-size, eval-length, and similar inconsistency detectors | **REJECT** | Brittle and false-positive-sensitive absent strong new evidence. |
| Upstream packages inside the isolated PoC | **WRAP** | Pin exact versions, disable monitoring, hide APIs behind the harness, and prohibit promotion into runtime dependencies. |
| Internal fork of either project | **REJECT** | Maintenance cost and adversarial churn are not justified. |

### 10. Reproducibility is repository-owned and egress-denying

When this change is applied, the temporary harness must be recreated under a permanent research-only path such as:

```text
research/browser-telemetry/
├── README.md
├── source-evidence.md
├── package.json
├── package-lock.json
├── poc/
│   ├── index.html
│   └── run.js
└── evidence/
    └── results.sanitized.json
```

The permanent README must document:

1. Required Node, npm, Playwright, Chrome, and OS versions.
2. `npm ci` from a committed lockfile with exact FingerprintJS, BotD, and Playwright versions.
3. A configurable `CHROME_PATH`; no developer-specific absolute path in checked-in code.
4. A local first-party HTTP server and a command that runs all headed/headless scenarios.
5. A deterministic no-egress test that forces sampled monitoring branches and fails on every non-allowlisted origin while both libraries receive `monitoring: false`.
6. A separate negative-control test proving that the harness would observe the known monitoring URLs when monitoring is enabled.
7. Sanitization that removes visitor IDs, raw component values, host/user paths, and unnecessary user-agent detail while retaining versions, scenario names, statuses, timings, detector names, and request origins.
8. Exact raw/gzip size commands and evidence-generation timestamps.
9. A clear banner that the harness is research-only and not a production telemetry implementation.

The original local procedure unpacked exact npm packages, imported their ESM assets from the local origin, served the directory over HTTP, and ran `node poc/run.js`. The permanent harness must replace ad hoc package extraction and `--no-save` installation with `npm ci` and checked-in integrity locks. Reproduction on a different browser/host must create a new evidence file rather than overwrite the baseline.

### 11. Key primary and upstream sources

The permanent source/evidence matrix must pin source files, tags or package integrity, retrieval date, claim type, and evidence status. Initial sources include:

- FingerprintJS repository and package: https://github.com/fingerprintjs/fingerprintjs and https://www.npmjs.com/package/@fingerprintjs/fingerprintjs
- FingerprintJS version policy: https://github.com/fingerprintjs/fingerprintjs/blob/v5.2.0/docs/version_policy.md
- FingerprintJS browser support: https://github.com/fingerprintjs/fingerprintjs/blob/v5.2.0/docs/browser_support.md
- BotD repository and package: https://github.com/fingerprintjs/BotD and https://www.npmjs.com/package/@fingerprintjs/botd
- FingerprintJS issue examples: https://github.com/fingerprintjs/fingerprintjs/issues/809, https://github.com/fingerprintjs/fingerprintjs/issues/1019, https://github.com/fingerprintjs/fingerprintjs/issues/1130, and https://github.com/fingerprintjs/fingerprintjs/issues/1193
- BotD issue examples: https://github.com/fingerprintjs/BotD/issues/135, https://github.com/fingerprintjs/BotD/issues/139, https://github.com/fingerprintjs/BotD/issues/157, https://github.com/fingerprintjs/BotD/issues/166, https://github.com/fingerprintjs/BotD/issues/171, https://github.com/fingerprintjs/BotD/issues/185, and https://github.com/fingerprintjs/BotD/issues/208
- GDPR: https://eur-lex.europa.eu/eli/reg/2016/679/oj
- ePrivacy Directive consolidated text: https://eur-lex.europa.eu/legal-content/EN/TXT/?uri=CELEX:02002L0058-20091219
- EDPB Guidelines 2/2023: https://www.edpb.europa.eu/our-work-tools/our-documents/guidelines/guidelines-22023-technical-scope-art-53-eprivacy-directive_en
- California Civil Code section 1798.140: https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?sectionNum=1798.140.&lawCode=CIV

## Risks / Trade-offs

- **[Risk] Research code is copied into the storefront later without gates.** → Keep it under a clearly named research path, exclude it from runtime dependency manifests/builds, add an explicit non-production banner, and require a separate OpenSpec implementation change.
- **[Risk] A future team interprets freshness as browser authenticity.** → Preserve the trust-property table and challenge limitations in every review; do not use “attestation” for this mechanism.
- **[Risk] Sanitization removes evidence needed for debugging.** → Retain approved aggregate timing/status/detector data and generation metadata; rerun locally for raw debugging rather than commit high-entropy values.
- **[Risk] Sanitized evidence remains linkable.** → Remove `visitorId`, raw components, host paths, and unnecessary full UA strings; privacy-review the final artifact before commit.
- **[Risk] Package monitoring returns after an upstream upgrade.** → Pin versions, enforce deterministic egress tests and CSP/network deny rules, and treat any version change as a new evidence run.
- **[Risk] Deferral misses easy automation detections.** → Continue server-observed behavior work; revisit only if measured incremental lift exceeds the customer/privacy/maintenance cost.
- **[Trade-off] A small internal sensor reduces package surface but transfers detector maintenance to the team.** → Require named ownership and decommission criteria before choosing that final outcome.
- **[Trade-off] Triggered collection reduces initial-load cost but gives suspicious clients notice and an opportunity to suppress telemetry.** → Treat suppression as coverage data and keep behavior primary; do not solve this by gating normal menu access.

## Migration Plan

There is no runtime deployment or data migration.

1. Apply only the research/documentation tasks in `tasks.md`.
2. Verify that the repository diff contains no storefront, Go service, Kong, API, deployment, or production dependency change.
3. Run the permanent PoC and sanitization in an isolated environment.
4. Obtain the named cross-functional reviews and record one allowed final outcome.
5. Run strict OpenSpec validation and archive the research change when its documentation tasks are complete.

Rollback consists of reverting the repository-owned research artifacts. No production rollback, customer migration, or data cleanup should be necessary because this change authorizes no collection.

## Limitations and Unresolved Evidence Gaps

These gaps block production reconsideration and must not be reframed as implementation work already approved:

- No physical low-end/high-end Android or iOS Safari measurements.
- No WhatsApp, Instagram, Facebook, Telegram, or other embedded WebView matrix.
- No Brave, Firefox enhanced protections, content-blocker, private-mode, corporate-policy, accessibility, or representative extension matrix.
- No battery, robust memory, long-task, page-usability, cart/checkout conversion, or slow-network evidence.
- No Selenium, Puppeteer, stealth-plugin, undetected-ChromeDriver, patched-CDP, profile-rotation, replay/fabrication, or distributed low-and-slow matrix beyond the simple Playwright patches recorded above.
- No longitudinal identifier-stability study across browser/OS updates and setting changes.
- No labeled storefront dataset comparing behavior-only decisions with behavior-plus-browser-signal decisions.
- No measured false-positive or false-negative rate for the target customer and attacker populations.
- No proof that the incremental value exceeds equivalent investment in Redis correlation and outcome feedback.
- Technical dependency evidence now exists: dependency inventory, preserved license notices, a CycloneDX SBOM, and point-in-time npm audit results. Organizational dependency/license or open-source governance approval remains pending, as do security architecture, privacy/legal, frontend/platform, and product approval.

Until these gaps are resolved, the formal decision remains **defer browser telemetry**.
