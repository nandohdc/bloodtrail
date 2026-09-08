## 1. Authorization, assessment, and RED baseline

- [x] 1.1 Record #108's dependency on closed #107, the away-window implementation/merge grant, and the synthetic-only/non-production boundary; verify the proposal, design, and delta state the five-minute/32-record decision without claiming a production retention policy or exactly-once delivery.
- [x] 1.2 Create the full design-pattern assessment source and generated assessment for the exact collector-owned path allowlist; compare nested in-memory records against delimiter keys, non-cryptographic fingerprints, and durable adapters, and verify all 15 security dimensions are justified before any implementation commit.
- [x] 1.3 Add RED runtime arms for first-seen, byte-identical duplicate, same-sender conflict, sender isolation, validation-before-deduplication, re-entrant duplicate, exact-expiry, 32-live-record capacity, and secret-free results/metrics; run `npm run test:runtime --prefix packages/security-audit-collector` and observe the unimplemented behaviors fail.

## 2. Bounded ledger and ingress outcomes

- [x] 2.1 Implement the relative-only `DeduplicationLedger` with nested sender/event maps, a 300000 ms lazy-expiry window, a maximum of 32 live records, exact-body comparison, immediate first-seen reservation, and no timer, host import, external adapter, queue, or durable state; verify focused ledger tests cover expiry and full capacity.
- [x] 2.2 Extend the public ingress result union with a distinct duplicate result and add bounded deduplication conflict/capacity diagnostics plus closed numeric counters; verify no result, diagnostic, metric key, or metric value exposes a submission body, credential, sender identity beyond the existing result surface, or unbounded data.
- [x] 2.3 Insert the deduplication decision only after authentication, size, parse, schema, and version success and before admission; verify a re-entrant validation seam yields one admission and one duplicate, while every earlier failure leaves the ledger and admission count unchanged.
- [x] 2.4 Update the collector README and package tests to state instance-local, synthetic-only, non-durable behavior and the absence of an exactly-once claim; verify scope, dependency, and package-content gates retain zero authored runtime imports and zero runtime dependencies.

## 3. GREEN verification and governance

- [x] 3.1 Run every duplicate arm green through the public `submit()` surface, including first/duplicate/conflict/sender-isolation/re-entrancy/expiry/capacity/null-control behavior; verify `npm run validate --prefix packages/security-audit-collector` passes.
- [x] 3.2 Run `npx --yes @fission-ai/openspec@latest validate --all --strict`, the assessment and implementation design-pattern-governance phases, the candidate/baseline dual check, and `git diff --check` with an empty index; resolve any scope, secret-disclosure, or classification failure before staging.
- [x] 3.3 Stage only the collector source/tests/docs and this change's declared OpenSpec artifacts; commit with Conventional Commits, then verify the committed head passes final governance and the dual check.

## 4. Delivery, fold, archive, and closure

- [x] 4.1 Open the implementation PR with the complete authorization posture, explicit five-minute/32-record synthetic bound, full-security assessment, AI-not-approval statement, topology-ratification status, and no-production/no-exactly-once boundary; merge only when all required CI checks are green on the exact head under the away-window grant.
- [x] 4.2 Fold the `security-audit-collector` delta into its canonical specification in a dedicated fold PR, proving each requirement block is byte-identical and a second application is a no-op; merge only after its exact-head CI is green.
- [x] 4.3 Archive the completed change with byte-preserving relocation and `archive-evidence.md`; verify strict OpenSpec validation, staged rename identity for immutable artifacts, committed-head final governance, candidate/baseline dual verification, and the complete repository governance-gate chain.
- [x] 4.4 Close #108 with first/duplicate/conflict/re-entrancy/expiry/capacity and scope-boundary evidence, then tick only #108 in #132's Wave 4 checklist after the archive PR is merged.
