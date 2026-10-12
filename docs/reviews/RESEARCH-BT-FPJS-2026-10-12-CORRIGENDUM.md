# Corrigendum and Evidence Reconciliation: RESEARCH-BT-FPJS-2026-10-12

**Document Identity:** `CORRIGENDUM-RESEARCH-BT-FPJS-2026-10-12`
**Parent Report:** `RESEARCH-BT-FPJS-2026-10-12` ("Reverse Engineering FingerprintJS and Evaluating Its Reuse in Bloodtrail")
**Date:** 2026-10-12
**Status:** Complete / Read-Only Verification
**Primary Recommendation Status:** **Provisionally accepted; confirmed unchanged (Alternative D: No Adoption)**.

---

## Executive Corrigendum Statement

An independent evidence-quality audit of research report `RESEARCH-BT-FPJS-2026-10-12` was executed across pinned repositories:
- **FingerprintJS:** Tag `v5.3.0`, commit `dac5ae59409669f09aa09c0b2f44b7615b0520da`
- **Bloodtrail:** Branch `main`, commit `e011a710b008fad981fe3804812a425daadc1032`

The audit identified eight areas requiring evidence reconciliation, precision reduction, and governance bounding.

**Architectural Recommendation Effect:** **Zero impact**. None of the corrections weaken or invalidate the primary architectural recommendation (**Alternative D: No Adoption of FingerprintJS in Bloodtrail**). Rather, the corrections place the recommendation on a strictly verified, mathematically defensible, and governance-compliant evidentiary foundation.

---

## Itemized Evidence Audit and Corrections

### Correction 1: Entropy Source Count in FingerprintJS v5.3.0

- **Original Claim:** The report repeatedly asserted that FingerprintJS generates a visitor identifier over a canonical concatenation of **38** browser-derived components (e.g., Executive Summary §1, Section 3.1 Step 2, Section 3.2 heading, Section 4.1, Section 4.2).
- **Evidence Examined:** Pinned source file [`src/sources/index.ts`](https://github.com/fingerprintjs/fingerprintjs/blob/dac5ae59409669f09aa09c0b2f44b7615b0520da/src/sources/index.ts#L61-L107) in FingerprintJS v5.3.0 (`dac5ae5`).
- **Verified Finding:** The actual source registry exported as `sources` contains exactly **42** entropy sources:
  1. *6 asynchronous parallel sources (lines 61–66):* `userAgentData`, `fonts`, `domBlockers`, `fontPreferences`, `audio`, `screenFrame`.
  2. *34 sequential synchronous sources (lines 68–101):* `canvas`, `osCpu`, `languages`, `colorDepth`, `deviceMemory`, `screenResolution`, `hardwareConcurrency`, `timezone`, `sessionStorage`, `localStorage`, `indexedDB`, `openDatabase`, `cpuClass`, `platform`, `plugins`, `touchSupport`, `vendor`, `vendorFlavors`, `cookiesEnabled`, `colorGamut`, `invertedColors`, `forcedColors`, `monochrome`, `contrast`, `reducedMotion`, `reducedTransparency`, `hdr`, `math`, `pdfViewerEnabled`, `architecture`, `applePay`, `privateClickMeasurement`, `audioBaseLatency`, `dateTimeLocale`.
  3. *2 trailing GPU context sources (lines 105–106):* `webGlBasics`, `webGlExtensions`.
  *(Note: The taxonomic table in Section 3.2 of the original report actually listed all 42 entries, but the table title and narrative text incorrectly cited "38 sources").*
- **Classification:** **Corrected**.
- **Exact Source and Version:** FingerprintJS v5.3.0 (`dac5ae5`), `src/sources/index.ts:61-107`.
- **Effect on Final Recommendation:** None. An inventory of 42 high-entropy collectors reinforces the rationale for rejection due to excessive client surface area, privacy exposure, and maintenance overhead.

---

### Correction 2: Reconciliation of REA Target Versions and Missing Distribution Verification

- **Original Claim:** Section 2 presented REA MCP analysis as examining the research target without explicitly noting that the analyzed artifact was the Bloodtrail harness's FingerprintJS **5.2.0** installation rather than **5.3.0**.
- **Evidence Examined:**
  - Bloodtrail research harness: `research/browser-telemetry/package-lock.json` and `node_modules/@fingerprintjs/fingerprintjs/package.json` (pinned version: **5.2.0**).
  - Prior REA analysis record: Operation `analyze_javascript_application` (detail: `summary`) on `/Users/fernando.costa/Git/bloodtrail/research/browser-telemetry/node_modules/@fingerprintjs/fingerprintjs`, Artifact SHA-256 `0f82694cd2090a0d5c9bdca216862a24b9835d9f6245892b10d8386c4ff27ce4`, Evidence ID `ev_00201276ae205bda54363e886ffc46996a6f3c39a483a86def8966419eff58b2`.
  - Fresh REA analysis on FingerprintJS v5.3.0 repository: Operation `analyze_javascript_application` (detail: `summary`) on `/Users/fernando.costa/Git/fingerprintjs`, Artifact SHA-256 `eb28fb5e9b6e3528a3965b3ea310580aafb59bb63aacdc523e3e17d64360cc54`, Evidence ID `ev_aab689a0c2769b7dcef3d98150e8b16bc853584105c69a7b50db884f190d5347` (summary projection: `ev_4b04daeabe02365efea092102f07017fcf5a086368de5ecdd14f1d123b1a3f36`).
- **Verified Finding:**
  1. The initial REA bundle analysis applied exclusively to the **5.2.0** npm distribution in Bloodtrail's research harness.
  2. The v5.3.0 Git repository (`dac5ae5`) contains TypeScript source files but no checked-in `dist/` directory or distribution tarball. REA static analysis of the 5.3.0 source tree recovered 122 relevant files, 117 parsed JS/TS files, 30,883 AST nodes, 0 Electron APIs, and 0 native add-on bindings, confirming the purely browser/JavaScript target.
  3. *Classification of Missing Verification:* Formal `compare_source_to_bundle` between the 5.3.0 source and a 5.3.0 compiled distribution bundle is classified as **unperformed / unresolved**. Compiling or fetching a 5.3.0 distribution bundle would require package manager installation and build execution outside read-only verification boundaries.
- **Classification:** **Corrected** (version attribution) and **Unresolved** (formal 5.3.0 source-to-bundle comparison unperformed).
- **Exact Source and Version:**
  - Harness artifact: FingerprintJS v5.2.0 (`node_modules/@fingerprintjs/fingerprintjs`)
  - Source repository: FingerprintJS v5.3.0 (`dac5ae5`)
- **REA Limitations Disclosed:** Static AST analysis on inert source text; bundle code was never executed; static syntax relations do not prove runtime execution; graph coverage is partial.
- **Effect on Final Recommendation:** None. The architectural delta between 5.2.0 and 5.3.0 is limited to maintenance updates and minor collation adjustments; the fundamental design mismatch with Bloodtrail is identical.

---

### Correction 3: Accurate Description of Delegated Decision #117 Governance Boundaries

- **Original Claim:** The report cited Decision `#117` as "Delegated Decision #117: GO for one purpose only" and referenced "Ratified Code Bounds", which could be misconstrued as an authoritative human project-owner approval or a production authorization.
- **Evidence Examined:** Bloodtrail governance record [`openspec/changes/archive/2026-09-11-add-client-evidence-capability/decisions/117-client-evidence-purpose.md`](https://github.com/fernandohdc/bloodtrail/blob/e011a710b008fad981fe3804812a425daadc1032/openspec/changes/archive/2026-09-11-add-client-evidence-capability/decisions/117-client-evidence-purpose.md).
- **Verified Finding:**
  1. **AI-Delegated Authority:** Decision `#117` was explicitly taken by an AI model (`claude-opus-5`), under broad verbal delegation ("I dont have time to make decisions, you must do for me").
  2. **Absence of Human Owner Review:** The project owner (Fernando Homem da Costa) has **not personally reviewed** decision `#117`. The record explicitly states: `decision_source = "delegated to Claude by the owner, 2026-09-10; not a human owner decision"` and warns: *"It is not an exact-commit owner authorization, and it must not be cited as one."*
  3. **Strict Non-Production Boundary:** Decision `#117` confers **zero production authorization** and **zero real-user collection authorization**. All work authorized under `#117–#131` is strictly synthetic and non-production.
  4. **Governance Limitation & Reversal:** The record acknowledges that because it was taken under delegation, it is weaker governance than the human owner's 2026-07-31 decision. A subsequent NO-GO from the owner triggers full reversal of wave `#118–#131`.
- **Classification:** **Corrected**.
- **Exact Source and Version:** Bloodtrail `117-client-evidence-purpose.md`, commit `e011a71`.
- **Effect on Final Recommendation:** None. Accurately characterizing `#117` as an unreviewed AI delegation strictly confined to non-production synthetic experimentation makes adopting a heavy tracking library like FingerprintJS even more unacceptable under project governance.

---

### Correction 4: Audit of Quantitative Statements and Removal of Unsubstantiated Precision

- **Original Claim:** The report presented exact millisecond latency estimates for individual collectors (e.g. `fonts` ~30–80ms, `audio` ~50–200ms, `userAgentData` ~5–20ms, `math` ~1ms, `canvas` ~10–30ms), estimated Bloodtrail browser package latency as "<0.1ms", and estimated its bundle size as "~4 KB raw / <1.5 KB gzip".
- **Evidence Examined:**
  - Bloodtrail historical measurements: [`research/browser-telemetry/evidence/bundle-sizes.json`](https://github.com/fernandohdc/bloodtrail/blob/e011a710b008fad981fe3804812a425daadc1032/research/browser-telemetry/evidence/bundle-sizes.json) and [`research/browser-telemetry/evidence/baseline-2026-07-30.sanitized.json`](https://github.com/fernandohdc/bloodtrail/blob/e011a710b008fad981fe3804812a425daadc1032/research/browser-telemetry/evidence/baseline-2026-07-30.sanitized.json).
  - Bloodtrail client package build files: `packages/client-evidence-browser/dist/`.
- **Verified Finding:**
  1. *Historical Measured Bundle Values (Confirmed):*
     - FingerprintJS v5.2.0 ESM (`dist/fp.esm.js`): 129,311 raw bytes / 37,548 gzip bytes (level 9) / 31,484 brotli bytes.
     - FingerprintJS v5.2.0 Minified ESM (`dist/fp.min.js`): 36,746 raw bytes / 16,178 gzip bytes / 14,239 brotli bytes.
  2. *Historical Measured Baseline Timings (Confirmed, Single-Host Only):*
     - Normal headless Chrome: `load` median 17.3ms (p95 45.7ms); `collect` median 0.7ms (p95 48.0ms). Slowest components in sample: `userAgentData` (38–46ms), `fonts` (37–45ms), `fontPreferences` (31–41ms), `domBlockers` (30–39ms), `plugins` (27–33ms), `canvas` (11–20ms).
     - Headless Chrome cold pages: `load` median 39.5ms (p95 49.0ms); `collect` median 51.9ms (p95 61.4ms).
     - 6x CPU throttled cold pages: `load` median 117.8ms (p95 122.3ms); `collect` median 173.0ms (p95 183.5ms). Slowest components: `userAgentData` (121ms), `fonts` (117ms), `webGlExtensions` (41ms), `canvas` (35ms), `audio` (8ms).
  3. *Unsubstantiated Estimates Removed / Corrected:*
     - The per-source timing ranges in Section 3.2 (e.g. `audio` ~50–200ms, `userAgentData` ~5–20ms, `math` ~1ms) were unsubstantiated analytical estimates; in the actual recorded baseline, `audio` completed in 8ms while `userAgentData` took 38–121ms. These isolated ranges are removed and replaced by architectural cost classifications ("Asynchronous DOM/layout reflow", "GPU context allocation", "Synchronous property access").
     - Bloodtrail's "<0.1ms" latency was an analytical hypothesis based on synchronous `crypto.randomUUID()`, not a formal benchmark.
     - Bloodtrail's "~4 KB raw / <1.5 KB gzip" was an estimate; the actual unbundled JavaScript in `dist/` totals 10,269 raw bytes across separate ESM modules.
- **Classification:** **Corrected**.
- **Exact Source and Version:** Bloodtrail `bundle-sizes.json`, `baseline-2026-07-30.sanitized.json`, commit `e011a71`.
- **Effect on Final Recommendation:** None. Removing unsubstantiated precision eliminates misleading figures while preserving the verified architectural reality: high-overhead DOM/WebGL probing vs lightweight synchronous UUID creation.

---

### Correction 5: Correction of Categorical Technical, Cryptographic, and Legal Assertions

- **Original Claims:**
  - Categorical claim that UUID v4 is "collision-free".
  - Categorical claim that MurmurHash3 has "zero cryptographic collision resistance" and that its use is an architectural flaw.
  - Categorical claim that 6x CPU throttling and private browsing "cause" fingerprint drift, and that enterprise fleets produce "identical visitorIds".
  - Categorical assertions that adopting FingerprintJS "directly violates GDPR/ePrivacy" and "creates legal liability".
- **Evidence Examined:** RFC 4122 / RFC 9562; MurmurHash3 algorithmic specifications; Bloodtrail `research/browser-telemetry/source-evidence.md` (entries `GDPR`, `EPRIVACY`, `EDPB`, `POC-STABILITY`).
- **Verified Finding:**
  1. *UUID v4 Collisions:* UUID v4 contains 122 random bits. The collision probability is not zero ($p \approx 2^{-122}$ for two IDs; $p \approx 10^{-18}$ for $10^9$ generated IDs). For interaction-scoped correlation, collisions are **probabilistically negligible**, but not mathematically impossible.
  2. *MurmurHash3 Properties:* MurmurHash3 is explicitly an unkeyed non-cryptographic hash function optimized for speed and hash table distribution. It lacks cryptographic collision resistance and preimage resistance against active adversaries. However, FingerprintJS uses it as an identifier format, not as an authentication token or MAC. Criticizing MurmurHash3 for lacking cryptographic properties misstates its intended purpose, although it remains true that the resulting hash cannot serve as an adversarial security boundary.
  3. *Fingerprint Stability & Fleet Behavior:* Observing 2 distinct hashes across 10 cold runs under 6x CPU throttling demonstrates environment-dependent instability under synthetic conditions on a single host; it does not prove general causality across browser versions. Stating that enterprise fleets produce "identical visitorIds" is an unverified hypothesis; variations in minor build versions, peripherals, or user preferences may prevent full convergence.
  4. *Regulatory Assertions:* Engineering reports must distinguish technical risk analysis from formal legal conclusions. As recorded in `source-evidence.md`, statutory provisions (GDPR Art. 4/5/6/25/35, ePrivacy Art. 5(3), EDPB Guidelines 2/2023) classify device fingerprinting as terminal equipment access and personal data processing, requiring a valid lawful basis (typically prior consent) and DPIA screening. Whether an implementation "violates law" or "creates liability" depends on organizational deployment, jurisdiction, and consent mechanisms, which requires qualified legal counsel rather than engineering assertion.
- **Classification:** **Corrected**.
- **Exact Source and Version:** RFC 9562, Bloodtrail `source-evidence.md`, FingerprintJS `src/utils/hashing.ts`.
- **Effect on Final Recommendation:** None. Replacing categorical assertions with precise probabilistic, cryptographic, and legal-risk formulations strengthens the report's professional defensibility.

---

### Correction 6: Verification of Actual Bloodtrail `ClientEvidenceEnvelope` Types and Structure

- **Original Claim:** The report stated that the envelope reference contains only `interaction_id` (UUID v4), `interaction_kind`, `envelope_version: 1`, and fixed provenance (`client_reported`, `client_claim`, `web_browser`, `interaction_ephemeral`).
- **Evidence Examined:**
  - Pinned TypeScript definitions: [`packages/client-evidence-browser/src/types.ts`](https://github.com/fernandohdc/bloodtrail/blob/e011a710b008fad981fe3804812a425daadc1032/packages/client-evidence-browser/src/types.ts#L32-L41).
  - Interaction builder: [`packages/client-evidence-browser/src/interaction.ts`](https://github.com/fernandohdc/bloodtrail/blob/e011a710b008fad981fe3804812a425daadc1032/packages/client-evidence-browser/src/interaction.ts).
  - Ingress validation: [`packages/security-audit-collector/src/envelope-ingress.ts`](https://github.com/fernandohdc/bloodtrail/blob/e011a710b008fad981fe3804812a425daadc1032/packages/security-audit-collector/src/envelope-ingress.ts).
  - Contract schema: [`contracts/security-audit/source/contract.source.json:2029-2124`](https://github.com/fernandohdc/bloodtrail/blob/e011a710b008fad981fe3804812a425daadc1032/contracts/security-audit/source/contract.source.json#L2029-L2124).
- **Verified Finding:** The report conflated the server-side audit log's flattened ingested fields with the actual wire `ClientEvidenceEnvelope` type. The true TypeScript interface is:
  ```ts
  export interface ClientEvidenceEnvelope {
    readonly envelope_version: 1;
    readonly interaction_id: string;
    readonly interaction_kind: InteractionKind;
    readonly client_timestamp: number;
    readonly provenance: ClientEvidenceProvenance;
    readonly nonce?: string | undefined;
    readonly claims?: readonly ClientClaim[] | undefined;
    readonly transform_history?: readonly TransformRecord[] | undefined;
  }
  ```
  - **Mandatory Fields:**
    - `envelope_version`: Literal `1`.
    - `interaction_id`: String (UUID v4 format).
    - `interaction_kind`: One of 8 closed vocabulary values (`navigation`, `form_submit`, `button_click`, `input`, `dialog_action`, `tab_switch`, `refresh`, `custom`).
    - `client_timestamp`: Unix epoch milliseconds (defaulted to `Date.now()`).
    - `provenance`: `{ source: "client_reported", trust_level: "client_claim", platform: ClientPlatform, capture_scope: "interaction_ephemeral" }`, where `platform` is `"web_browser"`, `"react_native"`, or `"unattested_client"`.
  - **Optional Fields:**
    - `nonce`: Optional 32–64 byte hex string (Mode A challenge response).
    - `claims`: Optional array of `{ name: string, trust_level: "client_claim", value: string | number | boolean }`, capped at `BOUNDS.maxClaims = 8`, strictly proscribing names in `FORBIDDEN_CLAIM_NAMES`.
    - `transform_history`: Optional array of `{ transform: string, timestamp: number }`.
- **Classification:** **Corrected**.
- **Exact Source and Version:** Bloodtrail `packages/client-evidence-browser/src/types.ts:32-41`, commit `e011a71`.
- **Effect on Final Recommendation:** None. The complete envelope contract confirms that device fingerprints and persistent hardware identifiers cannot be accommodated without breaking the schema and violating `FORBIDDEN_CLAIM_NAMES`.

---

### Correction 7: Replacement of Machine-Local Links with Portable Provenance References

- **Original Claim:** The report included numerous machine-local paths (`file:///Users/fernando.costa/...`) and corrupted local paths (`file:///Users/fingerprintjs/...`).
- **Evidence Examined:** All hyperlink targets across `RESEARCH-BT-FPJS-2026-10-12`.
- **Verified Finding:** All machine-local file paths have been reconciled and replaced with portable repository-relative links or pinned GitHub URLs:
  - FingerprintJS upstream (pinned tag `v5.3.0`, commit `dac5ae59409669f09aa09c0b2f44b7615b0520da`): `https://github.com/fingerprintjs/fingerprintjs/blob/dac5ae59409669f09aa09c0b2f44b7615b0520da/...`
  - Bloodtrail repository (pinned commit `e011a710b008fad981fe3804812a425daadc1032`): `https://github.com/fernandohdc/bloodtrail/blob/e011a710b008fad981fe3804812a425daadc1032/...`
- **Classification:** **Corrected**.
- **Effect on Final Recommendation:** None. Improves artifact portability and citation integrity.

---

### Correction 8: Proper Framing of the 2026-07-30 Experimental Baseline

- **Original Claim:** The report cited the 2026-07-30 baseline as "proving" that simple property overrides completely bypass bot detection, that 6x CPU throttling "causes" visitorId drift, and treated baseline diagnostic timings as general production performance.
- **Evidence Examined:** Bloodtrail [`research/browser-telemetry/source-evidence.md`](https://github.com/fernandohdc/bloodtrail/blob/e011a710b008fad981fe3804812a425daadc1032/research/browser-telemetry/source-evidence.md), entries `POC-ENV`, `POC-RESULT`, `POC-STABILITY`, `POC-PERF`, `BOTD-FP/BYPASS`, `BOTD-SOURCES`.
- **Verified Finding:** `source-evidence.md` explicitly documents the narrow scope and limitations of the 2026-07-30 baseline:
  1. *Single Host Only (`POC-ENV`):* The experiment was executed on a single host (macOS 26.5.2, Chrome 150.0.7871.188, Node 26.5.0, Playwright 1.62.1).
  2. *Specific Test Script Bypass (`POC-RESULT`, `BOTD-FP/BYPASS`):* The WebDriver property override produced a BotD-negative outcome on that specific Playwright harness; it does *not* demonstrate broad attacker coverage or general stealth across diverse bot detection engines.
  3. *Synthetic Throttle Observation (`POC-STABILITY`):* Observing two distinct hash outputs under 6x CPU throttling across 10 cold runs is a local diagnostic observation under synthetic load; it does *not* prove longitudinal population drift or identify a general root cause.
  4. *Local Diagnostic Metrics (`POC-PERF`):* Timing and bundle byte measurements were local diagnostic benchmarks; they do *not* constitute production performance or end-user latency figures.
- **Classification:** **Corrected**.
- **Exact Source and Version:** Bloodtrail `research/browser-telemetry/source-evidence.md`, commit `e011a71`.
- **Effect on Final Recommendation:** None. Bounding the baseline to its actual experimental scope removes overstated evidentiary claims while preserving its legitimate conclusion: client-side telemetry is vulnerable to local tampering and exhibits environment-sensitive behavior.

---

## Reconciliation Summary Matrix

| # | Item Audited | Original Stance | Verified Reality | Classification | Effect on Recommendation |
|---|---|---|---|---|---|
| **1** | Entropy Sources | 38 sources | Exactly 42 sources in `src/sources/index.ts` | **Corrected** | None (reinforces rejection) |
| **2** | REA Target Version | Evaluated as 5.3.0 | Analyzed 5.2.0 bundle; 5.3.0 bundle verification unperformed | **Corrected / Unresolved** | None (architectural delta is trivial) |
| **3** | Decision #117 | Presented as standard decision | AI-delegated (`claude-opus-5`), unreviewed by owner, non-production | **Corrected** | None (reinforces governance rejection) |
| **4** | Quantitative Precision | Fake ms ranges for collectors, derived SDK size/latency | Measured bundle bytes & baseline timings only; removed fake ms precision | **Corrected** | None (DOM/WebGL overhead remains large) |
| **5** | Categorical Claims | Collision-free UUIDs, zero Murmur3 resistance, legal violations | Probabilistic UUIDs, non-crypto Murmur3 role, regulatory legal risks | **Corrected** | None (arguments grounded mathematically) |
| **6** | Envelope Structure | Interaction ID + kind + version + provenance only | Includes mandatory `client_timestamp`, optional `nonce`, `claims`, `transform_history` | **Corrected** | None (schema confirms bounds) |
| **7** | Reference Links | Local `file://` URIs and typos | Portable GitHub commit URLs and repo paths | **Corrected** | None (improves portability) |
| **8** | 2026-07-30 Baseline | Treated as proving causality & broad attacker bypass | Local single-host diagnostic observation; no broad coverage claimed | **Corrected** | None (untrusted client model preserved) |

---

## Corrected Research Conclusions

1. **FingerprintJS Architecture:** FingerprintJS v5.3.0 is a 42-source client-side environment hashing library. It hashes browser characteristics using MurmurHash3 (128-bit) to construct a point-in-time `visitorId`. It includes a hardcoded OS heuristic `confidence.score`, and defaults `monitoring: true` (0.1% sampling) to a third-party CDN. It possesses zero cryptographic attestation capabilities.
2. **Bloodtrail Alignment:** Bloodtrail's `@bloodtrail/client-evidence-browser` operates within the non-production synthetic bounds established under AI-delegated Decision `#117` for Purpose P1 (interaction-scoped audit correlation). Its data contract requires an ephemeral UUID v4 interaction identifier, an 8-kind closed vocabulary, a mandatory timestamp, fixed provenance, and explicitly proscribes environmental fingerprinting via `FORBIDDEN_CLAIM_NAMES`.
3. **Governance and Legal Posture:** Introducing high-entropy browser fingerprinting into Bloodtrail would violate project-owner governance (2026-07-31 outcome), exceed the non-production synthetic boundary of Decision `#117`, violate schema bounds, and introduce terminal equipment tracking risks under ePrivacy Art. 5(3) and GDPR.
4. **Final Recommendation:** **Alternative D (No Adoption) is confirmed**. Bloodtrail must not add FingerprintJS as a dependency or copy its browser signals. Bloodtrail's existing architecture satisfies Purpose P1 with zero dependencies, minimal payload overhead, and zero client tracking.
