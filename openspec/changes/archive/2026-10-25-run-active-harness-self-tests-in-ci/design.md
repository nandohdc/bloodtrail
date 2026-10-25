## Context

See proposal.md for motivation. The existing `design-pattern-governance` job runs dependency-free repository tooling on Node 26.5.0. Harnesses live outside the declared package list and are intentionally separate from governed probe execution.

## Goals / Non-Goals

The runner covers active harness fixture suites through its command result and reported discovery. It changes no package discovery, required context name, Stage 2 authorization, archived harness, or product API.

## Decisions

- Enumerate immediate directories under `openspec/changes`, excluding `archive`; inspect each `harness/tests` tree recursively for `.test.mjs` files. Every existing harness needs at least one test. Metadata is not a skip filter, because an orphan harness must not disappear from coverage. Reject symbolic links in the discovered harness/test path rather than follow an escaping tree.
- Execute the sorted discovered test files with the current Node executable and propagate nonzero exits or launch failures. The CLI has no root override; an exported runner accepts a fixture root for subprocess-based regression tests.
- Add one step to the existing required governance job. A new job would require a branch-protection edit and a hard-coded Stage 2 path would miss the next harness.
- A repository with no active harness reports an explicit not-applicable result. An existing empty or malformed harness fails, including during scaffolding once that harness is committed.
- CI only runs fixture tests. Review and the active suites enforce the distinction from exact-head, approval-gated probe execution; discovery alone cannot prove assertions meaningful or arbitrary test code harmless.
- The owner confirmed the #877 prerequisite and delegated its review, all-green merge, fold/archive and closure on 2026-10-24 while approving the #838 implementation plan. Codex authors; AGY reviews with `gemini-3.8-flash-high` in sandboxed plan mode; build changes also receive the two-axis high code review. Review never substitutes for exact-head S1.

## Risks / Trade-offs

- A test process can hang → bound the runner's child execution and fail on termination; retain its output.
- Missing or unreadable paths can resemble no tests → only absent harnesses are inapplicable; all discovery errors and existing empty suites fail.
- Filename discovery cannot establish semantic test coverage → retain independent review and planted failure/null tests.

## Migration Plan

Land the assessed runner and CI step first, then fold the delta into `ci-topology` in a separate PR, then archive in another PR. #838 waits for this prerequisite and the external #884 fix. Reverting the implementation is an explicit governed change; no skip switch is introduced.
