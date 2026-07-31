# Browser Telemetry Evidence

All committed measurement evidence is sanitized and research-only.

- `baseline-2026-07-30.sanitized.json` is the preserved baseline from the completed local PoC. Do not overwrite it.
- `baseline-metadata.json` records the baseline host and method supplied to the sanitizer.
- `bundle-sizes.json` is regenerated deterministically from locked package assets.
- `licenses.json`, `sbom.cdx.json`, and `npm-audit.json` are point-in-time supply-chain evidence.
- `upstream-licenses/` contains package license notices.
- `runs/` is ignored. New local reproduction runs are timestamped and never overwrite the baseline.

The raw baseline is intentionally not committed because it contains high-entropy environment outputs and unnecessary detailed browser data. `npm run evidence:validate` checks the committed baseline. The tests exercise both successful sanitization and rejection of forbidden data.

Allowed external-origin evidence is narrowly scoped: ordinary scenarios must contain no external origin, while `monitoring_enabled_negative_control` must contain only `https://m1.openfpcdn.io`. Requests in that control are observed and aborted.

Evidence files are not customer data and must not be repurposed as telemetry, analytics, identity, authentication, trust, or enforcement inputs.
