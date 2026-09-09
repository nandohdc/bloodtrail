## Context

`packages/security-audit-sdk-node` implements the producer boundary (`createHttpDeliveryHandoff`, `createBoundedDeliveryRetry`, `createBoundedDeliveryBackpressure`, `createDeadlineBoundedDeliveryShutdown`) against the delivery-conformance-contract. `packages/security-audit-collector` implements the ingress boundary (`CollectorIngress`, `SyntheticFixtureAuthenticator`). Both are unit-tested in isolation; nothing exercises them wired together. There is no root workspace (`package.json`) — each package builds and tests standalone — so a cross-package harness cannot become a dependency of either package without violating their zero-runtime-dependency invariants. See proposal.md for why this evidence is needed now.

## Goals / Non-Goals

**Goals:**
- Prove one producer→collector slice for the `security_significant` delivery class against the nine arms in the repository's own prior plan for this issue (`.hermes/plans/2026-08-23_114000-issue-109-verify-delivery-vertical-slice.md`, finding F3): happy path, timeout, retry exhaustion, overload, shutdown-at-deadline, invalid authentication, unsupported version, duplicate, and a null control.
- Make the harness re-runnable from a clean clone with one documented command.
- State the evidence's limitations plainly (fakes, one topology, one class, non-independent pass).

**Non-Goals:**
- Not changing `security-audit-sdk-node` or `security-audit-collector` source, even if an arm produces an unexpected result — that is a finding, recorded and left for a separate fix.
- Not freezing any API (#110, #111 do that).
- Not exercising `best_effort`, `transaction_critical`, or `policy_critical` — none has an implementation yet (#112, #113 are still open). Their scenarios are recorded as **not exercised**, not PASS.
- Not adding a workspace, a root `package.json`, or any cross-package runtime/dev dependency.

## Decisions

**The harness lives inside this OpenSpec change's own directory**, not as a new permanent package or workspace. It imports each package's built `dist/` output via relative file paths (`../../../packages/security-audit-sdk-node/dist/index.js` and the collector equivalent), so it needs both packages built first (`npm run build --prefix packages/security-audit-sdk-node && npm run build --prefix packages/security-audit-collector`) and then runs as a plain Node script — no new `package.json`, no new devDependency on either package, no change to either package's dependency graph or CI wiring. On archive, the harness and its evidence relocate with the rest of the change directory, matching this repo's convention that verification evidence lives in the OpenSpec change, not a standalone plan file.

**A fake, deterministic network peer stands in for a live HTTP transport.** The producer's `createHttpDeliveryHandoff` takes an `exchange` function (see its existing unit tests) — the harness supplies one that routes the request directly into a real, in-process `CollectorIngress` instance (the same pattern #391's own reproduction used to discover that defect), translating the collector's `IngressResult` into the handoff's expected response shape. This proves the producer and collector's real logic interoperate; it does not exercise a real socket, TLS, or network failure mode — that limitation is stated in the evidence, not hidden.

**Injection is a per-arm configuration of the fake peer and the harness's own timers/clock**, not a mode flag inside production code:
- *Timeout*: the fake exchange never resolves within the retry's configured attempt timeout.
- *Retry exhaustion*: the fake exchange always returns a retryable failure until the retry budget is spent.
- *Overload*: the backpressure component is driven to capacity before the arm's occurrence is admitted.
- *Shutdown at deadline*: the arm starts shutdown with an in-flight occurrence whose exchange never resolves before the deadline.
- *Invalid authentication*: the fake exchange submits with a credential the collector's `SyntheticFixtureAuthenticator` does not accept.
- *Unsupported version*: the submitted body declares a contract version outside the collector's supported set.
- *Duplicate*: the same occurrence is delivered twice — once to admission, then again as a genuine retry (only `correlation.retry_attempt` differs) — proving #391's fix.
- *Null control*: the happy path re-run with every injection switch off, to prove a PASS is not a harness artifact (this repo's own recurring lesson — see `codescene delta`'s history and the collector's own D2 null-control test).

**Determinism check**: each arm runs three times; a result that varies across runs is recorded as a harness/arm failure in its own right, not retried until green.

**Scoring is per the repository's prior plan's resolved open question**: only `security_significant` scenarios from the delivery-conformance-contract are scored PASS/FAIL. Scenarios naming `best_effort`, `transaction_critical`, or `policy_critical` are listed as **not exercised**, since none has an implementation to test.

## Risks / Trade-offs

- **[Risk]** A fake network peer cannot prove real-transport failure modes (partial writes, TCP resets, DNS failures). → **Mitigation:** state this plainly in the evidence as an assurance limitation, matching #109's own acceptance criteria.
- **[Risk]** This pass is not independently actored — the same category of automated session performing this verification could share blind spots with whatever implemented #103–#108. → **Mitigation:** state this plainly (see the F6 comment posted on #109) rather than claim an independence the chain has no mechanism for.
- **[Risk]** Scoring only `security_significant` could understate the matrix's coverage if a reader expects all four classes. → **Mitigation:** the evidence names exactly which scenarios were not exercised and why, rather than omitting them silently.

## Open Questions

None — the repository's own prior plan for this issue already resolved the class-scoping question (score `security_significant` only, record the rest as not exercised), and the independence question is answered by stating the limitation rather than inventing a mechanism.
