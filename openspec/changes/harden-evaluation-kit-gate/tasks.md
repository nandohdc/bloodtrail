# Tasks

Each group maps to exactly one issue and remains unchecked until that issue's own pull request supplies its
evidence. Groups are in native `blockedBy` order. The proposal does not tick a task for #701.

## 1. #702 — Kit-gate verification summary prefactor

- [ ] 1.1 Give every executed kit-gate check a stable identity and assemble the verification summary from
  only the checks that ran in both build and existing-kit modes. Make the gate, builder, and controls run
  through a symlink, and prove the matching planted-defect controls fail closed.

## 2. #717 — Run planted-defect controls on every supported Node version

- [ ] 2.1 Add the kit controls to the Node binding's `test` script and prove their summary appears on every
  supported Node version. Do not edit `.github/workflows/ci.yml`.

## 3. #703 — Isolate every planted-defect control

- [ ] 3.1 Make each control alter one measured condition, fail only at its named check identity, and fail
  itself when disabling that check permits its plant. Reseal disposable copies where removal would otherwise
  trigger identity verification first.

## 4. #704 — Bind format 3 identity material

- [ ] 4.1 Create and verify format 3 identity material: include `identity.json` in `checksums.sha256`, write
  the outside-list SHA-256 of that list to `kit-digest.sha256` in `shasum -c` format, and refuse format 2 by
  name. Prove changed identity values fail their named controls.

## 5. #705 — Build and compare a distributable kit

- [ ] 5.1 Build the distributable kit from a disposable clean clone and prove it matches the verification
  kit for the same tree. Prove a dropped source path and a real dirty tree fail the respective controls without
  writing inside the live repository.

## 6. #706 — Make a distributable kit depend only on its commit

- [ ] 6.1 Prove local attributes, filters, line endings, umask, and non-regular files cannot alter the
  distributable kit. Preserve npm's measured-stable entry order within artifacts and record the measurement.

## 7. #707 — Stop reading past the receiver bound

- [ ] 7.1 Make the receiver read an in-bound body before answering, but once past the bound answer, close,
  and read nothing more for 401, 413, and wrong-path cases. Prove the post-answer read control fails closed.

## 8. #708 — Prove receiver SDK validation

- [ ] 8.1 Drive a structurally valid but SDK-invalid event through the receiver, prove it is not admitted,
  and prove a corrected event with the same identity is accepted. A receiver that skips SDK validation must
  fail its planted-defect control.

## 9. #709 — Route and authenticate the example receiver strictly

- [ ] 9.1 Require a case-insensitive Bearer scheme, return 404 for a POST to another path, return 405 with
  `Allow: POST` for every other method, and classify client aborts without a 500 or rejection count. Prove the
  wire-protocol and gate cases.

## 10. #710 — Type-check and exclude the facilitator answer key

- [ ] 10.1 Type-check every answer-key fix and fail when the key is absent or invalid. Scan every kit file
  and every artifact text entry for each fix code and each expected code-and-path pair, with controls for
  renamed, marker-free, and copied key content.

## 11. #711 — Check and run document fences

- [ ] 11.1 Recognize TypeScript fence names case-insensitively with optional info strings, require an
  allowlisted language on every fence, type-check every TypeScript block, and run each block without `declare`.
  Prove fence and runnable-block defects fail.

## 12. #712 — Resolve document identifier spans

- [ ] 12.1 Resolve every identifier-shaped document span against installed declarations except reviewed
  exceptions, replace `occurred_at` with `event.timestamp` and `event.observed_at`, and prove invented APIs
  fail the gate.

## 13. #713 — Mark planned features as planned

- [ ] 13.1 Require glossary-named planned features in every planned row, flag any unmarked planned-feature
  sentence in any verb form, preserve only reviewed Node-README frozen-primitive and Core-README re-execution
  sections, and use `re-execution` rather than `retry` in kit prose.

## 14. #714 — Reject installer warnings about shipped settings

- [ ] 14.1 Fail an installation whose output names a shipped setting as unknown, ignored, or no longer read,
  and prove the pnpm-only-setting controls fail at that check.

## 15. #715 — Require synthetic document and example values

- [ ] 15.1 Stop shipping the root README and scan every document, example, and link for hosts, emails, IPs,
  and environment names that are not synthetic or on the reviewed list, initially empty. Prove planted
  non-synthetic values fail.

## 16. #716 — Classify response-body failures as transport failures

- [ ] 16.1 Map every non-deadline response-body read error to `transport_failure`, retain deadline and
  malformed-acknowledgment behavior, and prove the existing delivery retry retries reset, short-body, and
  malformed-chunk cases.

## 17. #718 — Fold the five deltas

- [ ] 17.1 After #702 through #717 are complete, replace the five canonical Node binding requirement blocks
  with the complete deltas, prove heading and scenario uniqueness, and leave no delta header or contradictory
  SHALL.

## 18. #719 — Archive the hardening change

- [ ] 18.1 After the fold has merged, archive `harden-evaluation-kit-gate` in its own pull request and keep
  the archive task unchecked until that archive work is ready.
