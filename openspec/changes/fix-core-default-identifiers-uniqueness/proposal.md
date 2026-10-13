## Why

Issue [#796](https://github.com/nandohdc/bloodtrail/issues/796): Core's default identifier
provider starts a fixed-seed Mulberry32 sequence in every process. Distinct producers can
therefore emit identical event IDs, causing collector `DUPLICATE_CONFLICT` and SDK
`SDK_SINK_REJECTED`. Per-instance bounded reuse detection cannot prevent cross-process collisions.

## What Changes

- Replace the seeded generator in `src/providers.ts` with lazy host `crypto.randomUUID()`
  calls for all seven `systemAuditIdentifiers` methods, yielding unpredictable, lowercase
  RFC 4122 UUID v4 identifiers with probabilistic collision resistance.
- Validate callable host `crypto.randomUUID` during `resolveProviders` for both implicit
  defaults and an explicitly supplied `systemAuditIdentifiers`. Fail construction with
  `SecurityAuditSdkError("SDK_INVALID_CONFIGURATION", "configuration", "/identifiers")`
  before readiness or sink emission when unavailable; never fall back to weaker randomness.
- Leave custom injected providers host-independent, preserving their identity and receiver
  behavior without probing crypto or invoking identifier methods at construction.
- Declare a `src/providers.ts`-only host crypto boundary in the coupling policy; retain
  zero host built-in imports and zero third-party runtime dependencies.
- Add method, configuration, custom-provider, concurrent-process, and coupling-mutation
  regressions; document the host requirement in API.md and ADR-SDK-013, and advance both
  coherence ADR count and sequence to 13.

## Capabilities

### Modified Capabilities

- `security-audit-sdk-core`: make default collision resistance cryptographic and construction
  fail closed, while explicitly bounding the portable host Web Crypto exception to providers.

## Impact

The owned paths are enumerated exactly in `assessment.json`. Only Core's provider implementation,
its coupling/coherence checks, regression tests (including top-level
`tests/cross-process-identifiers-negative-control.test.ts` and `tests/cross-process-harness.ts`),
API documentation, `MIGRATION.md`, `CONTEXT.md`, ADR, and this change's planning artifacts may change. No public export, provider interface, event format, canonical spec folding,
version pin, or runtime dependency changes are proposed. Hosts without callable `crypto.randomUUID`
will need to inject an identifier provider instead of receiving insecure defaults.

## Scope and Non-goals

Follow-up scope adds Core `MIGRATION.md`, `CONTEXT.md`,
`tests/cross-process-identifiers-negative-control.test.ts` and `tests/cross-process-harness.ts`
to the existing ownership; declare them prospectively without changing the runtime design.

Preserve all `governance_core` paths (including AGENTS.md, CLAUDE.md, .hermes.md and CONTRIBUTING.md),
`contracts/security-audit/`, generated source, and frozen public exports. Do not change Node binding
identifiers, collector deduplication, bounded SDK reuse histories, retry/redelivery semantics, or
contract interpretation. UUID collision resistance is not a guarantee of absolute lifetime-global
uniqueness, durability, authentication, or authorization. No production integration, release,
signed governance record, or deployment authority is conferred by this proposal.

The former delta requirement "Default identifier remediation preserves frozen and governance boundaries"
and its "Remediation verification retains all protected boundaries" scenario govern
this change process, not permanent capability behavior. Their constraints belong here: retain
provider interfaces, frozen public exports, Node binding and collector behavior, and zero third-party
runtime dependencies; API.md and ADR-SDK-013 document host requirements, construction failure,
custom-provider exemption and probabilistic collision resistance; coherence requires exactly 13
sequential ADRs numbered 001 through 013. Protected paths remain unchanged against the proposal
baseline. These boundaries are enforced by `test:changed-paths`, `test:scope`,
`test:contract-immutability` and the governance gate, with `test:coherence` checking ADR/API consistency.

## Owner decisions

Decision source: owner decision, 2026-10-13, via grilling in Claude Code session https://claude.ai/code/session_01BaG4eugfB66EmeehpsFN2E

The earlier issue brief's "Approved desired behavior" predated any owner decision. It is not
owner provenance; neither AI review nor passing tests provide authorization.

| # | Decision |
| --- | --- |
| A | Keep a secure DEFAULT identifier provider. Do not make an explicit provider mandatory. |
| B | Source is host Web Crypto `crypto.randomUUID()`, with a coupling declared for `src/providers.ts` only. Rejected alternatives: a `node:crypto` import, `crypto.getRandomValues` with hand formatting, and Math.random, time, PID or any seeded fallback. |
| C | Fail closed at construction for both the implicit default and an explicit `systemAuditIdentifiers`, with `SDK_INVALID_CONFIGURATION` / `configuration` / `/identifiers`. The check never invokes an identifier method. Custom providers stay host-independent. Rejected: failing lazily at the first ID. |
| D | Classify as `fix(sdk-core)`, non-breaking. API.md and MIGRATION.md record the host requirement and the injection alternative. |
| E | The guarantee is probabilistic collision resistance: 122 CSPRNG bits per UUID v4. Never claim absolute uniqueness. |
| G | Commit a re-runnable negative control. A prose record of a one-off disposable-copy run is not evidence. |

## Prospective Ordering

Pre-proposal baseline: `5d931ad695fb10db3fe51e6b151352447e21d822`.
US-001 commits only these planning artifacts before any governed implementation changes. Preserve
that ancestry; do not retrofit approval or replace the baseline with a run-local implementation ID.
The run-119 planning-only amendment declares the four follow-up paths before any edits to them;
it preserves the inherited implementation and does not change runtime behavior.
