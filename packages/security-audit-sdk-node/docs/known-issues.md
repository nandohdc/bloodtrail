# Known Issues and Limitations

This document enumerates known issues, operational limitations, and pending architectural resolutions in the `@bloodtrail/security-audit-sdk-node` evaluation alpha.

---

## 1. The Collector Ingress Checks Structure Only

- **Description:** The collector ingress (`CollectorIngress` in `@bloodtrail/security-audit-collector`), which the example receiver wraps, checks an event's structure against the JSON schema generated from Contract 2.1.0, and checks its contract version. It runs none of the SDK's semantic checks: tenant-scope policy, causality, authority, and the field rules beyond shape.
- **Impact:** Acceptance at the ingress is admission, not validity. For example, the ingress admits an event whose `schema.name` is wrong, because any string of the right shape passes. That is why the example receiver runs SDK validation (`validateSecurityAuditEvent`) before it submits an event to the ingress.
- **Status:** A known limitation of the evaluation alpha.

---

## 2. The Prohibited-Data Value Scan is Heuristic

- **Description:** The SDK's pre-emission safety check (`validateNoProhibitedData`) inspects event payload keys and string values against heuristic regular expressions (such as `BEGIN PRIVATE KEY`, `Bearer `, `sk-`, and common credential terms like `password` and `secret`).
- **Impact:** The scan is strictly heuristic and **will not catch every secret**. It cannot identify custom high-entropy tokens, unconventional API key prefixes, ciphertext, or unformatted personal identifiable information (PII). Calling applications must sanitize all data before passing it into SDK recording methods.
- **Guidance:** See `docs/privacy.md` for complete privacy guidance and transformation hook setup.

---

## 3. Contract Clock-Skew Bound is Not Enforced for Complete Events

- **Description:** Contract 2.1.0 defines acceptable clock-skew limits: the maximum acceptable drift between the event's recorded `event.timestamp` and the time it was observed, `event.observed_at`. However, when pre-constructed or complete events are passed directly through generic emission pathways, clock skew is not actively validated against host time.
- **Impact:** Synthesized test events or historical replayed events with timestamps significantly in the past or future are accepted without clock-skew validation errors.
- **Status:** Planned for strict enforcement once distributed synchronization policies are formalized.

---

## 4. Installing the Node Binding on Its Own Breaks Silently

- **Description:** `@bloodtrail/security-audit-sdk-node` depends directly on `@bloodtrail/security-audit-sdk-core`. In the evaluation alpha, packages are distributed via local tarballs rather than published npm registry artifacts. If an evaluator attempts to install `@bloodtrail/security-audit-sdk-node` in isolation without configuring package overrides or local tarball paths for `@bloodtrail/security-audit-sdk-core`, the package manager will fail to resolve the core dependency or fail silently with resolution conflicts.
- **Status:** Installing the Node binding on its own is unsupported. Install the complete evaluation kit as `docs/quickstart.md` describes, or add both packages and the core pin to your own service as `docs/integration-and-testing.md` describes. The kit's core pin is in the generated `package.json` `overrides` for npm, and in the generated `pnpm-workspace.yaml` for pnpm.

---

## 5. Yarn is Unsupported

- **Description:** The evaluation kit and offline install harnesses are validated specifically for npm, as bundled with Node 24 and Node 26, and pnpm 10, 11 and 12. Yarn (both Yarn v1 Classic and Yarn v2+ Berry / Plug'n'Play) is unsupported.
- **Reason:** Yarn handles local tarball resolution, peer dependencies, and workspace override hoisting differently from npm and pnpm, leading to unresolvable package graph cycles or missing tarball links during offline evaluation installs.
- **Requirement:** Evaluators must use `npm` or `pnpm` as documented in `docs/quickstart.md`.

---

## 6. The Named-Method Input Types Require Context the Runtime Can Supply

- **Description:** Each named method's input type requires its event's context: 23 of the 24 methods require `actor`, 20 require `tenant`, and 7, such as `accountRegistrationAttempted` and `authenticationFailed`, also require `correlation`. The types require these even where the runtime supplies them: an active context scope (`sdk.runWithContext`) or the configuration's `authoritativeContext` can supply `actor` and `tenant`, and the SDK generates the correlation identifier.
- **Impact:** A call inside a context scope still has to pass `actor`, `tenant` and, for those 7 methods, `correlation`, or it does not type-check. `docs/quickstart.md` shows a call reading them back from the active scope.
- **Status:** Disclosed, not fixed. Whether to relax these types is a question for this evaluation.
