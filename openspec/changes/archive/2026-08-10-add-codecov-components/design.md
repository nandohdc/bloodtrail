## Context

See `proposal.md` for motivation. The coverage job produces one SDK LCOV report and one research LCOV report, rewrites both to repository-relative paths, and uploads them together with the existing `sdk` and `research` flags. Codecov components are defined entirely in `codecov.yml`; no workflow upload changes are required.

## Goals / Non-Goals

**Goals:**

- Isolate the two covered workspaces with path-based virtual components.
- Surface component coverage in pull-request comments and non-blocking statuses.
- Preserve current flags, badges, uploads, and historical views.

**Non-Goals:**

- Changing test execution, report generation, or upload topology.
- Introducing coverage thresholds or required status checks.
- Adding a component for the contract workspace, which does not currently produce an uploaded coverage report.

## Decisions

### Use path-only components

Define one component for `packages/security-audit-sdk-core/**` and one for `research/browser-telemetry/**`. These filters match the repository-relative paths already written into LCOV reports. Do not add `flag_regexes`: Codecov combines path and flag filters with AND semantics, while the current combined upload carries both flags.

Alternative considered: split uploads and model each workspace only with flags. That would change the established CI upload topology and is unnecessary because components are explicitly designed to filter a combined report.

### Use stable, descriptive component IDs

Use `sdk_core` and `browser_telemetry_research` as immutable identifiers, with human-readable display names. This avoids coupling component identity to short upload flag names or mutable labels.

Alternative considered: reuse `sdk` and `research` as IDs. The longer IDs better distinguish component identity from the retained flags and document each component's exact boundary.

### Keep component statuses informational

Give all components project and patch statuses with `target: auto` and `informational: true`. This mirrors the repository's existing permissive Codecov posture while exposing both whole-component and changed-line signals.

Alternative considered: omit statuses and show components only in the PR comment. Explicit informational statuses provide the requested component visibility without creating an unreviewed merge gate.

### Retain flags and expose both views in PR comments

Keep existing flags unchanged for upload grouping, badges, and history. Add `components` to the existing comment layout alongside flags.

## Risks / Trade-offs

- **Additional informational checks may add PR UI noise.** → Limit components to the two workspaces that actually upload coverage and use shared default rules.
- **A component path can silently stop matching after a workspace move.** → Keep paths aligned with the coverage job's repository-relative LCOV prefixes and validate the parsed Codecov configuration.
- **Codecov component analytics history may require a one-time UI backfill.** → Treat analytics enablement as an external operator action; it is not required for component PR comments or statuses.

## Migration Plan

1. Validate `codecov.yml` with Codecov's configuration endpoint before commit.
2. Open a pull request so Codecov evaluates the branch configuration and publishes component output.
3. If Codecov behavior is unexpected, revert the `component_management` block and comment-layout token; retained flags make rollback lossless.
