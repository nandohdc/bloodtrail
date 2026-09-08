## 1. Assessment and deterministic test boundary

- [x] 1.1 Create a full governance assessment covering the Node handoff module, exports, tests, documentation, and this change; record the explicit proposal baseline and all security dimensions, then verify the assessment phase passes.
- [x] 1.2 Add deterministic RED tests using injected in-memory exchanges for accepted, retryable response, permanent response, timeout, malformed acknowledgment, transport failure, stable identity, bounded request rejection, and no live-network access; verify the focused test fails before implementation.

## 2. Single-attempt handoff implementation

- [x] 2.1 Implement the closed public descriptor/exchange/disposition types and immutable handoff factory; verify the focused deterministic test compiles and passes without `node:http`, `fetch`, or a third-party dependency.
- [x] 2.2 Implement bounded request projection and fail-closed acknowledgment classification; verify every conformance result class, stable `event.id`, zero-based attempt ordinal, and non-disclosure assertion passes.
- [x] 2.3 Export the additive provisional API and document its injected one-attempt boundary and exclusions; verify package typecheck, scope, dependency, and packed-package checks pass.

## 3. Verification and delivery

- [x] 3.1 Run the Node package validation chain, focused handoff tests, strict OpenSpec validation, baseline/candidate governance checks, and `git diff --check`.
- [x] 3.2 Commit, open the #103 PR with the complete governance posture, and merge only after exact-head CI has no failures.
