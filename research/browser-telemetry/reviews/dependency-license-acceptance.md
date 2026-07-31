# Project-Owner Dependency and License Acceptance

Status: **complete; explicit project-owner acceptance recorded**.

## Review record

- **Reviewer:** Fernando Homem da Costa
- **GitHub handle:** `nandohdc`
- **Role:** Project owner and maintainer
- **Review type:** project-owner decision
- **Date:** 2026-07-31
- **Commit reviewed:** `b6bb577b1fda865610ef93ec8ef31527046c3c44`
- **Material reviewed:** `research/browser-telemetry/DEPENDENCIES.md`, `research/browser-telemetry/package.json`, `research/browser-telemetry/package-lock.json`, `research/browser-telemetry/evidence/upstream-licenses/`, `research/browser-telemetry/evidence/licenses.json`, `research/browser-telemetry/evidence/sbom.cdx.json`, `research/browser-telemetry/evidence/npm-audit.json`, `research/browser-telemetry/evidence/bundle-sizes.json`, and the reuse classifications documented in `research/browser-telemetry/DEPENDENCIES.md` and `research/browser-telemetry/source-evidence.md`
- **Decision:** Accepted for the isolated research harness.
- **Conditions:** Dependencies remain development-only and isolated from production. No internal fork of FingerprintJS or BotD is authorized.
- **Concerns:** This is project-owner acceptance based on the recorded technical evidence and is not formal legal advice or external open-source governance approval.
- **Follow-up owner:** Fernando Homem da Costa
- **Reconsideration requirements:** Repeat dependency, vulnerability, license, SBOM, outbound-network, maintenance, and reuse review before changing versions or introducing any package into a production dependency graph.
- **Assurance limitation:** This is project-owner dependency and license acceptance, not formal legal advice or external open-source governance approval.
