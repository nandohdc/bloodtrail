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
its coupling/coherence checks, regression tests, API documentation, ADR, and this change's planning
artifacts may change. No public export, provider interface, event format, canonical spec folding,
version pin, or runtime dependency changes are proposed. Hosts without callable `crypto.randomUUID`
will need to inject an identifier provider instead of receiving insecure defaults.

## Scope and Non-goals

Preserve all `governance_core` paths (including AGENTS.md, CLAUDE.md, .hermes.md and CONTRIBUTING.md),
`contracts/security-audit/`, generated source, and frozen public exports. Do not change Node binding
identifiers, collector deduplication, bounded SDK reuse histories, retry/redelivery semantics, or
contract interpretation. UUID collision resistance is not a guarantee of absolute lifetime-global
uniqueness, durability, authentication, or authorization. No production integration, release,
signed governance record, or deployment is authorized by this proposal.

## Prospective Ordering

Pre-proposal baseline: `5d931ad695fb10db3fe51e6b151352447e21d822`.
US-001 commits only these planning artifacts before any governed implementation changes. Preserve
that ancestry; do not retrofit approval or replace the baseline with a run-local implementation ID.
