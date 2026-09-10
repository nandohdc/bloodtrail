# Security Policy

This document is the **vulnerability reporting process** for the Bloodtrail repository.

It is not the SDK's threat model. The trust boundaries, prohibited patterns, authority-provider
responsibilities, and misuse guidance for `@bloodtrail/security-audit-sdk-core` live in
[`packages/security-audit-sdk-core/SECURITY.md`](packages/security-audit-sdk-core/SECURITY.md).
Read that file to learn what the SDK does and does not guarantee; read this one to report a flaw.

## Supported versions

| Version | Supported |
| ------- | --------- |
| latest `0.x` of the SDK core | :white_check_mark: |
| earlier `0.x` | :x: |
| `main` branch | best-effort (pre-release, no backports) |

Only the most recent `0.x` release receives security fixes. Once `1.0.0` ships, the `0.x` series
will be unsupported.

The canonical contract at `contracts/security-audit/` is frozen at version `1.1.0` and is
versioned independently of the SDK. A defect in canonical semantics is not a patch — it requires
a separately governed contract version. See
[`packages/security-audit-sdk-core/MIGRATION.md`](packages/security-audit-sdk-core/MIGRATION.md).

## Reporting a vulnerability

**Please do not file public issues for security vulnerabilities.**

This repository is currently private. To report a vulnerability:

1. Go to the repository **Security** tab → **Advisories** → **New draft security advisory**.
   If *Private Vulnerability Reporting* is not yet enabled, an admin must enable it in
   **Settings → Code security & analysis → Private vulnerability reporting**.
2. Describe the vulnerability, including steps to reproduce, affected versions, and any known
   workarounds. For SDK reports, state which trust boundary you believe is crossed, using the
   vocabulary in the SDK's `SECURITY.md`.
3. We will acknowledge receipt within **5 business days** and aim to triage (confirm/close)
   within **10 business days**.
4. Once a fix is ready, we will publish the advisory coordinated with the release.

These response targets are operational guidelines, not contractual SLAs.

### After the repo goes public

The same GitHub Advisory flow applies. Additionally, you may request a CVE through the advisory
form if the vulnerability meets the
[GitHub CVE criteria](https://docs.github.com/en/code-security/security-advisories/working-with-repository-security-advisories/about-repository-security-advisories#cve-identification-number).

## Scope

This policy covers the canonical security audit event contract, the SDK core, and the repository's
own verification and release tooling.

**In scope**, and treated as security-relevant by default:

- a way to construct a branded authority value (authoritative actor, tenant, resource,
  authentication or authorization evidence) without going through its sanctioned constructor;
- a way to record a terminal success for an operation that did not reach it, or to defeat the
  same-instance duplicate-success reservation;
- prohibited data (secrets, credentials, tokens, payment values, full bodies) reaching a sink,
  hook, error, or diagnostic despite the scanner;
- generated output diverging from the frozen contract without `check:generated` failing;
- any bypass of the scope, contract-immutability, or coherence gates;
- a supply-chain or workflow-permission weakness in `.github/`.

**Out of scope:**

- The SDK's *documented* limitations. Producer truthfulness, delivery, durability, non-repudiation,
  and ingestion acceptance are explicitly not guaranteed; see "Production and legal limits" in the
  SDK's `SECURITY.md`. A report that the SDK cannot detect a lying trusted producer is a
  restatement of the design, not a vulnerability.
- Misconfiguration of a deployment environment. There is no authorized deployment.
- Anything reachable only by trusted application code that already has the capability — for
  example mutating a caller-owned sink you injected yourself.
- Vulnerabilities in third-party dependencies, which are tracked by Dependabot and `npm audit` in
  CI. Report those upstream, unless the impact is specific to our usage.
- `research/browser-telemetry/`, which is an investigation artifact and not shipping code.

## Disclosure

We follow coordinated disclosure: the reporter and the maintainers agree on a disclosure date, and
the advisory is published alongside the fix release.
