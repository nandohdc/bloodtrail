# Research Harness Dependency and Supply-Chain Evidence

Status: technical evidence complete; project-owner dependency and license acceptance **pending**.

This directory is isolated research tooling. All packages are development dependencies in a private package, and no repository production manifest depends on them. `npm ci --ignore-scripts` is the required installation mode.

## Direct package pins

| Package | Version | License | npm integrity |
|---|---:|---|---|
| `@fingerprintjs/fingerprintjs` | 5.2.0 | MIT | `sha512-j+2nInkwCQNTJcNhOjvkGM/nLRTuGJTC6xai4quqvUpjob2ssrGwBZjS7k55nOmKvge7qvJT2nS3i/IRvQSTQA==` |
| `@fingerprintjs/botd` | 2.0.0 | MIT | `sha512-yhuz23NKEcBDTHmGz/ULrXlGnbHenO+xZmVwuBkuqHUkqvaZ5TAA0kAgcRy4Wyo5dIBdkIf57UXX8/c9UlMLJg==` |
| `playwright` | 1.62.1 | Apache-2.0 | `sha512-0M+L3LAD8/nm554LOla9Ayx0j0tmFZ0FBcoQ7F1VuVHpM/XpiC8RcDzBQB8W5+hA8L22THxELzeF+2WcUzvcLg==` |

The lockfile also pins `playwright-core@1.62.1` and optional `fsevents@2.3.2` with integrity. Exact machine-readable evidence is in `package-lock.json` and `evidence/licenses.json`.

## License obligations and notices

- FingerprintJS and BotD declare MIT licenses.
- Playwright and Playwright Core declare Apache-2.0 licenses.
- Optional fsevents declares MIT.
- Upstream license texts are preserved under `evidence/upstream-licenses/`; repository line endings are normalized without changing the text.
- No upstream implementation source is copied into this repository. The harness imports exact npm package assets after `npm ci`.
- Neither FingerprintJS nor BotD is forked.
- Distribution or production-use obligations require a new project-owner acceptance decision and qualified advice where applicable; this document is evidence, not legal approval.

## SBOM and vulnerability evidence

Commands:

```sh
npm run evidence:licenses
npm run evidence:sbom
npm run evidence:audit
```

Evidence generated on 2026-07-30:

- CycloneDX 1.5 SBOM, generated with npm's built-in `npm sbom --omit=optional`; four non-optional components are represented.
- License inventory contains five locked package entries, including optional fsevents.
- `npm audit --json` reported zero info, low, moderate, high, critical, and total vulnerabilities.

The audit result is point-in-time registry evidence, not a guarantee of package safety. Reviewers must rerun it. The SBOM omits the optional component by command design; the license inventory and lockfile preserve it.

## Egress and install posture

Both inspected npm packages default monitoring on in their `load` API and may attempt package-use monitoring requests. Research code must pass `monitoring: false`. The deterministic egress test forces the sampling branch and fails on any third-party attempt when monitoring is disabled. The negative control observes and aborts the two known monitoring requests.

- Use `npm ci --ignore-scripts`.
- Use system-controlled Chrome through `BROWSER_CHANNEL` or an operator-supplied `CHROME_PATH` that is not retained.
- Do not run this package as part of production builds.
- Do not publish this private package.
- Do not update dependencies without refreshing lock integrity, source review, egress tests, licenses, SBOM, audit evidence, and PoC baseline comparison.

## Disposition

The dependencies remain confined to isolated repository research pending written project-owner dependency and license acceptance by Fernando Homem da Costa (`nandohdc`). That acceptance is not formal legal advice or external open-source governance approval. No conclusion here authorizes production adoption, real-user browser collection, or redistribution.
