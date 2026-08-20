## 1. Mutation Controls

- [ ] 1.1 Add a stable package-copy harness with an unmutated control that runs the real package gate and passes.
- [ ] 1.2 Add an incomplete-inventory mutation that omits `dist/validation/`, preserves every individually required path, and fails with a bounded diagnostic naming the entry point and missing module.
- [ ] 1.3 Add an incomplete-artifact mutation that references an undefined bundled helper and fails with a bounded diagnostic naming the failing entry point.
- [ ] 1.4 Add a deterministic outside-consumer resolution mutation that reaches and fails the provenance assertion; if it cannot be deterministic, remove provenance from the change and refile PLAN-091 rather than weakening the assertion.
- [ ] 1.5 Prove passing and failing runs remove the reported tarball and consumer roots, escape control characters, bound total output, and disclose no planted source marker.

## 2. Packed Completeness Implementation

- [ ] 2.1 Add one shared packed-completeness module that creates temporary roots outside the package, packs exactly once, installs the exact tarball production-only and offline, and cleans up in a `finally`.
- [ ] 2.2 Derive every package specifier from the export map, import each from a probe inside the disposable consumer, fail closed on outside-consumer resolution, and validate one canonical event.
- [ ] 2.3 Route `check-package-contents.mjs` through the shared module while preserving its manifest assertions and inventory allowlist over the returned real-pack inventory.
- [ ] 2.4 Route `packed-consumer-closure.test.mjs` through the shared installed-consumer hook while preserving all existing export, validation, format, and self-containment assertions.
- [ ] 2.5 Run the null control and all three mutations against the wired gate and record deterministic pass/fail signals.

## 3. Documentation and Verification

- [ ] 3.1 Add the SDK package glossary distinguishing complete, self-contained, and legacy closure naming.
- [ ] 3.2 Record the package-gate install decision in root ADR 0003 and update the README verification description without changing package metadata or npm scripts.
- [ ] 3.3 Run the full SDK and contract validation chains, strict active and archived OpenSpec validation, governance tests, targeted positive and mutation controls, and a two-axis code review with an empty index.
- [ ] 3.4 Commit and push the verified implementation candidate, then require non-vacuous post-commit final-phase and dual governance checks before opening the implementation pull request.

## 4. Canonical Fold and Archive

- [ ] 4.1 After the implementation pull request is owner-merged, fold the ADDED requirement into the canonical SDK capability spec in a separate pull request while this change remains active.
- [ ] 4.2 After the fold pull request is owner-merged, close issue #70 with exact evidence and mark lifecycle completion tasks supported by that event.
- [ ] 4.3 Relocate the complete active change into the dated archive with archive evidence in a third pull request, without repeating the canonical fold.
