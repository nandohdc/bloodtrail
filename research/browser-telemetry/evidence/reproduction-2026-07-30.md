# Local Reproduction Record — 2026-07-30

This record documents an objective rerun of the repository-backed research harness. It is not a production benchmark, approval, or replacement for the immutable baseline.

## Environment

- macOS 26.5.2, build 25F84
- Google Chrome 150.0.7871.188
- Node.js 26.5.0
- npm 11.17.0
- Playwright 1.62.1
- FingerprintJS 5.2.0
- BotD 2.0.0
- Browser launch configuration: Playwright channel `chrome`
- Measured at: `2026-07-30T18:35:53.008Z`

The detailed rerun JSON was written to the ignored, non-overwriting path `evidence/runs/apply-2026-07-30.sanitized.json`. It passed `scripts/validate-evidence.mjs`; it is intentionally not committed because the preserved baseline is the review artifact.

## Commands and observed results

```sh
npm run lint
npm test
npm run poc -- --output evidence/runs/apply-2026-07-30.sanitized.json
node scripts/validate-evidence.mjs evidence/runs/apply-2026-07-30.sanitized.json
```

Results:

- Syntax check: 12 JavaScript module files passed.
- Node test runner: 6 tests passed, 0 failed, 0 skipped.
- Egress control with `monitoring:false`: no third-party attempt.
- Negative control: both known `m1.openfpcdn.io` requests were observed and aborted.
- PoC: 10 scenarios completed, including both headed scenarios.
- Evidence validation: passed.
- No external origin appeared outside `monitoring_enabled_negative_control`.

## Semantic comparison to the preserved baseline

Nine baseline scenarios were reproduced with the same sample counts. Across all nine, the rerun matched the baseline for:

- WebDriver exposure status;
- BotD positive/negative result and bot kind;
- positive detector names;
- BotD component-error source names;
- approved external-origin set;
- FingerprintJS environment-cluster count, except for the synthetic 6x CPU scenario noted below.

The new `headless_chrome_patched_ua` control was not part of the original baseline. It remained BotD-positive solely through `detectWebDriver`, while the combined user-agent plus WebDriver patch scenario remained BotD-negative. This is consistent with the documented local bypass finding; it does not characterize advanced automation generally.

### Investigated semantic difference

`headless_chrome_6x_cpu_cold_pages` produced two distinct environment-derived FingerprintJS outputs in the baseline but one in the rerun. Browser, OS, package versions, sample count, screen configuration, and CPU throttle rate were unchanged. The collected values themselves are intentionally unavailable after sanitization, so a component-level causal claim cannot be made.

Disposition: retain both observations and do not replace the baseline. The difference reinforces that the environment-derived output is not stable device identity and that a ten-sample synthetic CPU run cannot establish a stability rate. It does not justify collection or enforcement.

## Timing comparison

Rounded median milliseconds; delta is rerun minus baseline.

| Scenario | FP load baseline → rerun (delta) | FP collect baseline → rerun (delta) | BotD load baseline → rerun (delta) | BotD detect baseline → rerun (delta) |
|---|---:|---:|---:|---:|
| headed cold | 37.9 → 38.7 (+0.8) | 51.4 → 48.8 (-2.6) | 2.9 → 3.1 (+0.2) | 0.2 → 0.2 (0.0) |
| headed patched-WebDriver cold | 38.5 → 39.7 (+1.2) | 51.7 → 55.4 (+3.7) | 2.8 → 3.2 (+0.4) | 0.2 → 0.2 (0.0) |
| headless 6x CPU cold | 117.8 → 110.5 (-7.3) | 173.0 → 135.2 (-37.8) | 11.9 → 12.3 (+0.4) | 1.3 → 0.3 (-1.0) |
| headless warm baseline | 17.3 → 17.5 (+0.2) | 0.7 → 0.7 (0.0) | 50.2 → 47.3 (-2.9) | 0.0 → 0.1 (+0.1) |
| headless basic stealth cold | 38.7 → 37.2 (-1.5) | 51.2 → 54.9 (+3.7) | 2.9 → 3.2 (+0.3) | 0.2 → 0.2 (0.0) |
| headless cold | 39.5 → 38.8 (-0.7) | 51.9 → 53.5 (+1.6) | 2.8 → 3.1 (+0.3) | 0.1 → 0.2 (+0.1) |
| different screen, warm | 17.6 → 17.6 (0.0) | 0.8 → 0.8 (0.0) | 50.1 → 45.5 (-4.6) | 0.0 → 0.0 (0.0) |
| patched WebDriver, warm | 17.2 → 17.7 (+0.5) | 0.8 → 0.8 (0.0) | 50.5 → 49.0 (-1.5) | 0.0 → 0.0 (0.0) |
| monitoring negative control | 50.0 → 39.8 (-10.2) | 54.7 → 57.8 (+3.1) | 3.6 → 3.4 (-0.2) | 0.2 → 0.2 (0.0) |

Disposition: timing drift is expected in this small, non-isolated local benchmark. The largest absolute median change was the synthetic 6x CPU FingerprintJS collection phase. Sub-millisecond BotD detection percentages are dominated by timer quantization. No production performance threshold, customer device claim, or regression conclusion is supported.

## Supply-chain commands

The same apply session also ran:

```sh
npm run evidence:bundles
npm run evidence:licenses
npm run evidence:sbom
npm run evidence:audit
```

Observed technical evidence:

- Bundle evidence generated for three inspected assets.
- Five locked package/license entries recorded.
- CycloneDX 1.5 SBOM generated for four non-optional components.
- npm audit: zero vulnerabilities at every severity on 2026-07-30.

Dependency/license governance approval remains pending.

## Clean-install confirmation

A final clean-install run removed `node_modules`, executed `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 npm ci --ignore-scripts`, and repeated lint, all six tests, evidence validation/regeneration, license/SBOM/audit generation, all ten PoC scenarios, and validation of the new ignored run. Every command exited zero. The final PoC run measured at `2026-07-30T18:41:38.611Z` reproduced the same BotD outcomes, detector sets, one-cluster counts, and external-origin policy as the comparison run above. This confirmation remains local single-host evidence, not a canonical production-suite or customer-population result.

## Repository validation

The apply session also confirmed:

- `openspec status --change investigate-browser-telemetry-signals`: all three required planning artifacts complete; specs skipped by `skip_specs: true`.
- `openspec validate investigate-browser-telemetry-signals --strict`: valid.
- `git diff --cached --check main`: passed.
- Complete diff relative to canonical `main`: 37 files, all under `openspec/changes/investigate-browser-telemetry-signals/` or `research/browser-telemetry/`.
- No production runtime, Go, Kong, Redis, API, deployment, storefront, authentication, authorization, scoring, or customer-control path changed.
- Content safety inspection found no staged `node_modules`, recognized credential pattern, raw standalone 32-hex environment value, or user-home path in evidence.

These apply changes remain uncommitted pending review, as requested.
