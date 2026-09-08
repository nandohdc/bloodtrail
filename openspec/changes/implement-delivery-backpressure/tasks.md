## 1. Assessment and deterministic test boundary

- [x] 1.1 Create the governance assessment covering the new backpressure module, exports, tests, documentation, and this change; record the explicit proposal baseline and all 15 security dimensions, then verify the assessment phase passes.
- [x] 1.2 Add deterministic tests for admission below capacity, overload rejection at capacity without invoking the wrapped operation, capacity release without drift on both success and failure, concurrent admission never exceeding capacity, never silently dropping admitted work, observability counters excluding operation content, and construction-time capacity validation.

## 2. Bounded delivery backpressure module

- [x] 2.1 Implement `createBoundedDeliveryBackpressure` with a synchronous check-then-increment admission gate (no locks needed under Node's run-to-completion semantics) and construction-time capacity validation; verify the admission, overload-rejection, and invalid-construction tests pass.
- [x] 2.2 Release the in-flight slot via `try/finally` around the wrapped operation so a rejection still releases capacity with no drift; verify the release-on-success, release-on-failure, and concurrent-admission tests pass.
- [x] 2.3 Add the optional `observability` hook (`onAdmitted`, `onRejectedOverload`, `onReleased`) carrying only numeric depth/capacity; verify the observability test asserts no operation content leaks through.
- [x] 2.4 Export the additive provisional API (`createBoundedDeliveryBackpressure` and its types) and document it in the package README; verify package typecheck, scope, dependency, and packed-package checks pass, updating the scope-mutation baseline file/reference counts for the new source file.

## 3. Verification and delivery

- [x] 3.1 Run the Node package validation chain (`npm run validate --prefix packages/security-audit-sdk-node`), the full product loop (`make`), strict OpenSpec validation, `cs delta` against `origin/main`, and `git diff --check`.
- [x] 3.2 Commit, open the #105 PR with the complete governance posture, and merge only after exact-head CI has no failures.
