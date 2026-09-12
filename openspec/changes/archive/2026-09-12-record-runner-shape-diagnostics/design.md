## Context

See `proposal.md` for motivation. The self-hosted runner scale set `arc-runners-bloodtrail` runs under Kubernetes (kind). Under doks-platform#320, runner pods receive:
- Toolchains Node 26.5.0 and 24.2.0 pre-populated under `/opt/hostedtoolcache/node/<version>/<arch>` with `.complete` markers.
- `RUNNER_TOOL_CACHE=/opt/hostedtoolcache`.
- CPU resource limit raised from 2 to 4 cores, memory raised from 3Gi to 6Gi, with `maxRunners` reduced from 3 to 2 (total committed CPU = 8 cores, fitting the single Docker Desktop VM).

In `bloodtrail`, we need:
1. Direct mechanical observation of runner shape (`availableParallelism()`, CPU count, hostname, `RUNNER_TOOL_CACHE`) in CI logs.
2. Verification of `actions/setup-node` hitting `/opt/hostedtoolcache` rather than downloading from the network.
3. Verification that verification-suite concurrency exceeds 1.
4. Addition of `.gitignore` in `packages/client-evidence-browser`.

## Goals / Non-Goals

**Goals:**
- Provide clear, low-overhead diagnostic logging in the `sdk` CI job that prints observed host parallelism, runner hostname, and tool cache environment.
- Confirm zero downloads during `actions/setup-node` steps across CI jobs on self-hosted runners.
- Prevent workspace pollution in `packages/client-evidence-browser` by ignoring compiler and coverage outputs.
- Keep changes isolated without modifying canonical capability specifications (`skip_specs: true`).

**Non-Goals:**
- Modifying SDK production code or public APIs.
- Modifying test assertion logic or altering governance gate policies.
- Re-baselining normative documents (`CLAUDE.md`, `AGENTS.md`) in this bounded change; per repository guidelines, routine documentation updates must be batched separately.

## Decisions

### Decision: Dedicated lightweight diagnostic step in `ci.yml`
- **Choice:** Add a dedicated `Runner shape diagnostics` step right after the primary `setup-node` step in the `sdk` job.
- **Rationale:** Using standard `node -e` with Node's built-in `node:os` module introduces zero dependencies, executes in under 20ms, and explicitly logs `os.hostname()`, `os.cpus().length`, `os.availableParallelism()`, and `process.env.RUNNER_TOOL_CACHE`.
- **Alternatives Considered:**
  - *Add diagnostics to an existing test*: Rejected because test output is structured/reporter-formatted and runner environment facts belong at the CI step level before long-running validations execute.
  - *Rely solely on Helm values or Kubernetes pod descriptions*: Rejected because issue #306 explicitly specifies: "demonstrated by measurement rather than configuration; record os.availableParallelism() as observed on the runner, not inferred from the Helm values."

### Decision: Add standard package-level `.gitignore`
- **Choice:** Add `.gitignore` to `packages/client-evidence-browser/` matching the pattern used in sibling packages (`security-audit-sdk-node`, `security-audit-collector`).
- **Rationale:** Local runs of `make` compile TypeScript and run coverage, populating `dist/` and `dist-tests/`. Ignoring them keeps git status clean.

## Risks / Trade-offs

- **[Risk]** The diagnostic step fails if Node is not available in PATH.
  → **Mitigation:** The diagnostic step runs after `actions/setup-node`, which guarantees Node is in PATH.
- **[Risk]** Overcommitting host CPU if multiple scale sets spin up runners simultaneously.
  → **Mitigation:** `maxRunners: 2` with `limits.cpu: 4` commits exactly 8 CPUs, matching the VM host capacity. Other repo scale sets have `maxRunners: 1` with `minRunners: 0` and stay idle unless active jobs queue.
