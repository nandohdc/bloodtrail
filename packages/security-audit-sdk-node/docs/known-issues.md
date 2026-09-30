# Known Issues and Limitations

This document enumerates known issues, operational limitations, and pending architectural resolutions in the `@bloodtrail/security-audit-sdk-node` evaluation alpha.

---

## 1. Collector Validates Structure Only

- **Description:** The reference audit event collector (`@bloodtrail/security-audit-collector`) included with the evaluation suite validates incoming HTTP payloads against the JSON schema definitions of Contract 2.1.0 events. It checks schema shape, required properties, and field type constraints.
- **Impact:** Semantic rules, authoritative tenant ownership consistency, cryptographic signature checks, and fine-grained cross-field invariant enforcement are not executed by the evaluation collector. Evaluators must rely on SDK-side semantic validation (`@bloodtrail/security-audit-sdk-core`) to catch cross-field invariant violations.
- **Status:** Expected evaluation alpha limitation. Server-side deep semantic validation is planned for the collector production release.

---

## 2. The Prohibited-Data Value Scan is Heuristic

- **Description:** The SDK's pre-emission safety check (`validateNoProhibitedData`) inspects event payload keys and string values against heuristic regular expressions (such as `BEGIN PRIVATE KEY`, `Bearer `, `sk-`, and common credential terms like `password` and `secret`).
- **Impact:** The scan is strictly heuristic and **will not catch every secret**. It cannot identify custom high-entropy tokens, unconventional API key prefixes, ciphertext, or unformatted personal identifiable information (PII). Calling applications must sanitize all data before passing it into SDK recording methods.
- **Guidance:** See `docs/privacy.md` for complete privacy guidance and transformation hook setup.

---

## 3. Contract Clock-Skew Bound is Not Enforced for Complete Events

- **Description:** Contract 2.1.0 defines acceptable clock-skew limits (maximum acceptable drift between the event's recorded `occurred_at` timestamp and processing time). However, when pre-constructed or complete events are passed directly through generic emission pathways, clock skew is not actively validated against host time.
- **Impact:** Synthesized test events or historical replayed events with timestamps significantly in the past or future are accepted without clock-skew validation errors.
- **Status:** Planned for strict enforcement once distributed synchronization policies are formalized.

---

## 4. Installing the Node Binding on Its Own Breaks Silently

- **Description:** `@bloodtrail/security-audit-sdk-node` depends directly on `@bloodtrail/security-audit-sdk-core`. In the evaluation alpha, packages are distributed via local tarballs rather than published npm registry artifacts. If an evaluator attempts to install `@bloodtrail/security-audit-sdk-node` in isolation without configuring package overrides or local tarball paths for `@bloodtrail/security-audit-sdk-core`, the package manager will fail to resolve the core dependency or fail silently with resolution conflicts.
- **Status & Priority:** Claiming and configuring the `@bloodtrail` npm scope on the public registry is a **P1 priority** prior to public releases. During evaluation, evaluators must follow the installation instructions in `docs/quickstart.md` using the evaluation kit tarballs, whose core pin is in the generated `package.json` `overrides` for npm and in the generated `pnpm-workspace.yaml` for pnpm.

---

## 5. Yarn is Unsupported

- **Description:** The evaluation kit and offline install harnesses are validated specifically for npm, as bundled with Node 24 and Node 26, and pnpm 10, 11 and 12. Yarn (both Yarn v1 Classic and Yarn v2+ Berry / Plug'n'Play) is unsupported.
- **Reason:** Yarn handles local tarball resolution, peer dependencies, and workspace override hoisting differently from npm and pnpm, leading to unresolvable package graph cycles or missing tarball links during offline evaluation installs.
- **Requirement:** Evaluators must use `npm` or `pnpm` as documented in `docs/quickstart.md`.
