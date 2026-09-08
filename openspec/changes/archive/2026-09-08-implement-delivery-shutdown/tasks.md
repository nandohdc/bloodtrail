## 1. Assessment and deterministic test boundary

- [x] 1.1 Create the governance assessment covering the new shutdown module, exports, tests, documentation, and this change; record the explicit proposal baseline and all 15 security dimensions, then verify the assessment phase passes.
- [x] 1.2 Add deterministic tests using a fake, manually-fired deadline timer: empty/fully-drained shutdown completes without waiting, admitted operations that settle before the deadline are drained and counted completed, operations still outstanding at deadline expiry are counted abandoned with exact accounting, an abandoned operation's own submit call still resolves once it eventually settles, new admission after shutdown (including a synchronous follow-on call) is rejected deterministically, repeated/concurrent shutdown calls are idempotent, and construction-time deadline validation.

## 2. Deadline-bounded delivery shutdown module

- [x] 2.1 Implement `createDeliveryShutdown` with a synchronous admission boundary (`submit()` checks the shutdown flag before any `await`) and construction-time deadline validation; verify the new-admission-rejected and synchronous-boundary tests pass.
- [x] 2.2 Track admitted operations in a `Set` of promises and drain them via `Promise.race` against a cancellable deadline timer, reusing the `{ promise, cancel() }` shape already established by `security-audit-sdk-core`'s `createShutdownTimeout`; verify the empty-drain, successful-drain, and deadline-expiry tests pass, including that the timer is cancelled on the winning drain path.
- [x] 2.3 Make `shutdown()` idempotent via a memoized report promise, and ensure an abandoned operation's own `submit()` call still resolves once it settles rather than being lost; verify the idempotency and never-silently-dropped tests pass.
- [x] 2.4 Export the additive provisional API (`createDeliveryShutdown` and its types) and document it in the package README; verify package typecheck, scope, dependency, and packed-package checks pass, updating the scope-mutation baseline file/reference counts for the new source file.

## 3. Verification and delivery

- [x] 3.1 Run the Node package validation chain (`npm run validate --prefix packages/security-audit-sdk-node`), the full product loop (`make`), strict OpenSpec validation, `cs delta` against `origin/main`, and `git diff --check`.
- [x] 3.2 Commit, open the #106 PR with the complete governance posture, and merge only after exact-head CI has no failures.
