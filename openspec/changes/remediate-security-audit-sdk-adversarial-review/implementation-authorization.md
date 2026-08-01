# Project-owner authorization to apply the adversarial remediation

- **Decision:** Authorize implementation of the objectively verifiable tasks in OpenSpec change `remediate-security-audit-sdk-adversarial-review`.
- **Project owner:** Fernando Homem da Costa
- **GitHub handle:** `nandohdc`
- **Date:** August 1, 2026
- **Authoritative proposal baseline:** `b4206f92fc92c7355efaa80d9f878353cf794452`
- **Authoritative issue-traceability commit:** `71cabfe50e18af9f242ec9cd8b4aee33632e5792`
- **Authoritative contract:** Bloodtrail Security Audit Event Contract version `1.0.0`

## Authorized implementation

Implementation is authorized for confirmed adversarial-review findings F-01 through F-12 through tracking issue #20 and implementation issues #21 through #30, in the required issue order recorded by the proposal and task plan.

The implementation may include SDK-core source corrections, verification-tool corrections, generated-type corrections when required, runtime/concurrent/compile-time/mutation/compatibility tests, documentation and migration updates, exact Node.js 24 and 26 verification, package-level verification tooling, and remediation review and traceability records.

Each issue must be implemented and verified against its OpenSpec requirements and scenarios. The first pass is restricted to issue #24 / F-04 and must not implement SDK behavior changes assigned to issues #21–#23 or #25–#30.

## Authorization exclusions

This authorization does not permit:

- package publication or production deployment;
- production event collection or real-user data processing;
- framework instrumentation, OpenTelemetry, or OTLP export;
- production transports, collectors, brokers, queues, transactional outboxes, storage, or SIEM integration;
- analytics, detection rules, browser telemetry, or cryptographic audit-log chaining;
- weakening canonical requirements merely to make tests pass;
- modifying archived historical records except for a genuine historical correction; or
- silently changing the Security Audit Event Contract.

The approved SDK-core implementation remains historical governance evidence, but the adversarial-review verdict blocks reliance on it for release or integration decisions until this remediation change completes renewed exact-commit review.

Implementation must stop before final owner approval, merge, production authorization, or archival.

This project-owner authorization is project governance; it is not independent assurance.
