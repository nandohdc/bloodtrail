## Context

Bloodtrail is a multi-workspace TypeScript monorepo with three distinct code areas:

| Workspace | Path | Nature |
|---|---|---|
| SDK core | `packages/security-audit-sdk-core/` | Shipping code, contract-bound, strict validation gates |
| Contract | `contracts/security-audit/` | Canonical event contract + generators |
| Browser telemetry | `research/browser-telemetry/` | Investigation, not shipping code |

CI is a single `ci.yml` workflow with jobs for each workspace plus coverage (Codecov) and static analysis (SonarQube). All run on `pull_request` and `push: main`.

CodeScene is a SaaS platform (codescene.io) that analyzes Git history. It offers:
- **PR Integration**: webhook-driven automated code health reviews posted as GitHub Check Runs. Configured in the CodeScene UI; reads `.codescene/custom-quality-gates.json` from the repo for per-path quality profiles.
- **CLI (`cs`)**: a binary for local and CI use. `cs delta` compares two refs and reports only newly introduced code health issues — the right signal for a PR gate.
- **Status badges**: embeddable in README for public visibility.

The `CODESCENE_TOKEN` (a personal access token generated in the CodeScene UI) is already stored as a GitHub repository secret.

## Goals / Non-Goals

**Goals:**
- Gate every PR with behavioral code health analysis via `cs delta`, alongside existing Sonar and Codecov gates.
- Apply per-workspace quality profiles so the SDK is held to a stricter standard than research code.
- Surface CodeScene status in the README.

**Non-Goals:**
- The CodeScene SaaS project setup (creating the project, enabling PR integration in the UI) is out of scope — that's a one-time manual step in the CodeScene dashboard.
- The `cs` CLI is not installed locally as part of this change; only the CI runner installs it.
- Custom code health rule tuning (`.codescene/code-health-rules.json`) is deferred — start with the built-in profiles.

## Decisions

### Decision 1: `cs delta` in CI vs. webhook-only PR integration

**Choice**: Run both. The webhook PR integration provides rich Check Run annotations (line-level findings, explanations) and is the primary review aid. `cs delta` in CI provides a binary pass/fail gate the workflow controls directly — it fails the check when new issues appear, independent of the webhook's quality profile configuration.

**Alternatives considered**:
- Webhook only: loses the explicit CI gate; the PR integration's Check Run is informational unless configured as a required status check in GitHub branch protection, which requires GitHub App installation.
- CLI only: loses the rich PR annotations and the historical trend analysis CodeScene provides on its dashboard.

### Decision 2: Quality profile assignment per workspace

| Workspace | Profile | Rationale |
|---|---|---|
| `packages/security-audit-sdk-core/**` | `clean_code_collective` | Security-sensitive shipping code; advisory rules are appropriate |
| `contracts/security-audit/**` | `clean_code_collective` | Canonical contract; generated output must be traceable |
| `research/browser-telemetry/**` | `bare_minimum` | Investigation code; critical rules only |
| `*/**` (catch-all) | `bare_minimum` | Default for config files, scripts, docs |

**Alternative**: Uniform `bare_minimum` everywhere. Rejected — the SDK warrants stricter enforcement.

### Decision 3: CI job placement

Add a new `codescene-delta` job to the existing `ci.yml` rather than a separate workflow file. Rationale:
- The existing `ci.yml` already runs per-PR and gates on all jobs passing.
- A new workflow file would require separate branch protection configuration.
- The job is lightweight (install binary + run delta), not a full build.

### Decision 4: `cs delta` invocation

Use `cs delta "origin/${{ github.base_ref }}"` which compares the PR head against the merge target. The `--output-format json` flag gives machine-readable output; the CLI exits non-zero when it finds issues, which naturally fails the CI step.

### Decision 5: README badges

Add CodeScene's project-level code health and knowledge distribution badges. These are static image URLs generated in the CodeScene UI after project creation.

## Risks / Trade-offs

- **[Risk] `cs delta` is a new binary dependency fetched at runtime** → Mitigation: the install script is from CodeScene's official downloads domain; CI jobs use `--output-format json` which suppresses interactive prompts.
- **[Risk] Student account may have rate/analysis limits** → Mitigation: the `cs delta` CI job runs only on PRs, not every push; the SaaS project analysis runs on its own schedule.
- **[Trade-off] The PR integration webhook and `cs delta` CI job report overlapping information** → Acceptable: they serve different purposes (review aid vs. gate).
