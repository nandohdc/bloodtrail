## Why

A post-approval adversarial review of the isolated Security Audit SDK core found twelve reproducible defects: one Critical, three High, four Medium, and four Low. F-01 through F-04 are blockers because the sanctioned named API can accept forged transactional success, concurrent terminal success can be emitted twice, caller-owned providers can be disabled by recursive freezing, and the canonical verification gate is not reproducible after the prior change was archived.

The prior SDK-core approval remains historical evidence bound to its reviewed commit, but these later findings mean it cannot support further release, integration, or reuse decisions. A new exact-commit technical review and explicit project-owner decision are required after remediation.

## What Changes

- Require unforgeable SDK-issued operation evidence for transaction-critical terminal success; plain or copied `GeneratedOperationContext` values cannot establish trusted commit state.
- Make terminal-success reservation atomic before asynchronous sink handoff and define deterministic release and retry behavior for non-accepted sink outcomes.
- Preserve caller ownership and mutability of sink, clock, identifier, and related provider objects while retaining an immutable SDK-owned configuration snapshot.
- Restore lifecycle-aware canonical verification for both active changes and archived/canonical state, with differential mutation tests for real drift.
- Normalize hostile cloning, getter, proxy, and serialization failures into bounded documented SDK errors that never echo rejected values.
- Strengthen forbidden-path and public named-API completeness guardrails, including mutation tests proving every generated method is callable.
- Correct shutdown timer cleanup and process-retention behavior.
- Bound event identity, issued-operation identity, and terminal-deduplication state using explicit SDK-instance-local count-bounded FIFO horizons.
- Validate transformation-path compatibility at SDK initialization rather than allowing a per-event outage.
- Enforce the semantic distinction among pure redelivery, retry, and re-execution without silently weakening the canonical requirement.
- Preserve contract version `1.0.0`; the canonical event contract is not changed by this remediation.
- Require clean verification on exact supported Node.js 24 and 26 runtimes, a renewed exact-commit technical review, and an explicit project-owner decision before reliance on the remediated SDK basis.

## Scope

This change covers the SDK-core implementation, tests, generated API completeness checks, package documentation and compatibility records, canonical verification scripts, and governance artifacts needed to resolve F-01 through F-12. F-01, F-02, F-03, and F-04 remain release blockers until executable evidence satisfies their scenarios.

## Non-Goals

- Production deployment, package publication, framework integration, instrumentation, delivery infrastructure, collectors, transports, queues, storage, SIEM integration, analytics, or real-user collection.
- Reopening or editing `openspec/changes/archive/2026-07-31-implement-security-audit-sdk-core/`.
- Rewriting historical approvals or treating AI review, issue state, or test success as renewed owner approval.
- Changing `security-audit-event-contract` unless a genuine canonical contract defect is separately demonstrated and governed.
- Implementing rejected hypotheses, disproved attack paths, speculative style concerns, the unverified dual-package/multi-realm concern, or network availability of `npm audit`.

## Affected Users

- SDK consumers relying on transaction-aware named methods, deterministic providers, transformation hooks, redelivery, or shutdown.
- SDK maintainers running the canonical verification and compatibility gates.
- Project reviewers who need reproducible evidence and an exact-commit governance target.

## Alternatives

- **Patch defects without governance:** rejected because the findings change security, lifecycle, compatibility, and verification requirements.
- **Reopen the archived SDK change:** rejected because the previous lifecycle is complete and must remain immutable historical evidence.
- **Create a replacement capability or change the event contract:** rejected because the defects are in SDK behavior and verification, not demonstrated defects in contract `1.0.0`.
- **Downgrade blockers based on documentation:** rejected because F-01 through F-04 require executable counterevidence and remediation.

## Risks

- The operation-evidence restriction is source-level breaking for callers that relied on permissive structural operation inputs. F-11 keeps the public `emit(event)` and `redeliver(event)` signatures unchanged while tightening named-redelivery validation and binding behavior.
- Bounded identity retention introduces a documented local count horizon after which duplicate handling must remain deterministic but cannot imply time-based, durable, cross-process, restart-resistant, or lifetime-global protection.
- Atomic reservations can suppress valid retry if release rules are wrong; sink outcomes therefore need explicit state transitions and concurrency tests.
- Lifecycle-aware verification can become permissive if active, archived, and package-local scope are not separately mutation-tested.
- New error codes or reclassification can affect consumers that exhaustively match current diagnostics.

## Success Criteria

- Every confirmed finding F-01 through F-12 maps to normative scenarios, unchecked implementation tasks, a GitHub implementation issue, and reproducible expected evidence.
- Forged or copied operation objects never produce committed terminal success or invoke the sink.
- Concurrent terminal completion produces at most one accepted event with deterministic duplicate and retry behavior.
- Caller-owned providers remain unfrozen and unchanged.
- Canonical verification passes from a clean archived-main checkout and still rejects real package, contract, capability, and governance drift.
- SDK state is bounded, shutdown does not retain process exit, transformation incompatibility fails at initialization, all 24 named methods are structurally complete and callable, redelivery semantics are enforced, and validation diagnostics classify serialization failures correctly.
- Exact Node.js 24 and 26 verification passes on the final technical commit.
- A renewed exact-commit owner review is recorded before any renewed reliance on the SDK-core basis.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `security-audit-sdk-core`: Strengthen operation evidence, terminal concurrency, caller-owned provider handling, verification lifecycle, safe errors, bounded state, public API completeness, transformation configuration, redelivery semantics, shutdown, compatibility, and renewed governance requirements.

The `security-audit-event-contract` capability remains unchanged unless a separate governed change proves a canonical contract defect.

## Impact

Expected implementation work is limited to `packages/security-audit-sdk-core/` and this new active OpenSpec change, with the canonical SDK capability updated only when this change is later archived. The archived prior SDK change and `openspec/specs/security-audit-event-contract/spec.md` remain protected. No new runtime dependency, transport, framework, production sink, or contract version is authorized.

Production deployment remains unauthorized. Package publication remains unauthorized. Framework integration remains unauthorized. Delivery infrastructure remains unauthorized. Proposal completion and issue creation do not authorize implementation; implementation may begin only after explicit project-owner authorization.
