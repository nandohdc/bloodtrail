## 1. Restore lifecycle-aware canonical verification [F-04]

GitHub issue: [#24](https://github.com/nandohdc/bloodtrail/issues/24)

- [x] 1.1 Implement explicit active and archived verification modes with lifecycle metadata and no hard-coded deleted active-change path. [F-04]
- [x] 1.2 Update coherence rules to validate the active remediation change in active mode and canonical capability plus immutable dated evidence in archived mode. [F-04]
- [x] 1.3 Replace original-proposal-history scope evaluation with remediation-baseline and package-local comparisons while preserving contract, package, capability, provenance, and governance drift detection. [F-04]
- [x] 1.4 Add unit tests for lifecycle resolution, active task state, archived governed task state, and bounded rule diagnostics. [F-04]
- [x] 1.5 Add disposable differential mutation tests for missing active evidence, corrupted archive evidence, SDK drift, contract drift, task-state contradiction, and unrelated-history non-regression. [F-04]
- [x] 1.6 Make the canonical verification entry point reproducible from a clean current-main checkout without stale build or deleted-path dependencies. [F-04]
- [x] 1.7 Update verification documentation, ADR/coherence references, and compatibility notes without editing the archived prior SDK change. [F-04]
- [x] 1.8 Record clean active-mode and archived-mode command evidence for exact Node.js 24 and 26 verification. [F-04]

## 2. Reject forged operation commit evidence [F-01]

GitHub issue: [#21](https://github.com/nandohdc/bloodtrail/issues/21)

- [x] 2.1 Remove plain `GeneratedOperationContext` as accepted trusted operation input from named SDK methods while retaining it for canonical representation and observational snapshots. [F-01]
- [x] 2.2 Implement SDK-instance-bound, non-copyable private operation evidence for identity, transaction state, and allowed event binding. [F-01]
- [x] 2.3 Route commit and terminal state transitions exclusively through sanctioned operation-handle methods and reject foreign handles. [F-01]
- [x] 2.4 Add runtime tests for forged committed objects, copied snapshots, modified snapshots, removed `bound_event`, mismatched events, foreign handles, and caller-selected identifiers. [F-01]
- [x] 2.5 Add tests proving premature and rejected operation evidence never invokes the sink. [F-01]
- [x] 2.6 Add strict compile-time tests that named transactional methods require the trusted operation-handle API and reject structural snapshots. [F-01]
- [x] 2.7 Assess breaking API and package-version impact and document migration from structural operation inputs. [F-01]
- [x] 2.8 Verify all transaction-critical catalog events use the same evidence path rather than fixing only one named method. [F-01]

## 3. Make terminal-operation deduplication concurrency-safe [F-02]

GitHub issue: [#22](https://github.com/nandohdc/bloodtrail/issues/22)

- [x] 3.1 Implement the per-operation `idle`/`reserved`/`completed` terminal state machine and reserve synchronously before sink handoff. [F-02]
- [x] 3.2 Finalize reservations only on accepted sink results and release them on rejected, unknown, thrown, or rejected-promise outcomes without automatic retry. [F-02]
- [x] 3.3 Add deterministic concurrent tests with controllable sink promises proving at most one sink invocation and one potentially accepted result. [F-02]
- [x] 3.4 Add sequential duplicate, concurrent duplicate, sink-failure release, explicit retry, and shutdown-interleaving regression tests. [F-02]
- [x] 3.5 Verify duplicate results are bounded, stable, secret-free, and contain no event payload. [F-02]
- [x] 3.6 Coordinate the reservation key and lifecycle exclusively with SDK-issued operation evidence from F-01. [F-01, F-02]
- [x] 3.7 Document deterministic failure/retry semantics and compatibility impact without claiming core retry or delivery durability. [F-02]

## 4. Preserve caller-owned sinks and providers [F-03]

GitHub issue: [#23](https://github.com/nandohdc/bloodtrail/issues/23)

- [x] 4.1 Refactor configuration normalization so caller-provided sink, clock, identifier, and related providers are validated and referenced without clone, freeze, decoration, replacement, or mutation. [F-03]
- [x] 4.2 Preserve immutable cloned SDK-owned scalar and plain-data configuration separately from provider references. [F-03]
- [x] 4.3 Add unit tests for class-based providers, enumerable nested mutable state, receiver-sensitive methods, identity preservation, and unchanged caller objects. [F-03]
- [x] 4.4 Add a regression sink with a mutable queue and prove construction plus delivery leaves the queue operational and unfrozen. [F-03]
- [x] 4.5 Verify post-initialization mutation of original plain-data configuration cannot replace SDK behavior while legitimate provider state changes still work. [F-03]
- [x] 4.6 Document provider ownership and configuration immutability boundaries and assess compatibility. [F-03]

## 5. Normalize hostile constructor and serialization failures [F-05, F-12]

GitHub issue: [#25](https://github.com/nandohdc/bloodtrail/issues/25)

- [x] 5.1 Add trust-boundary helpers that normalize property-access, cloning, getter, proxy, and non-cloneable failures into bounded public SDK diagnostics. [F-05]
- [x] 5.2 Apply safe normalization consistently across every public authority and configuration constructor rather than only the reported path. [F-05]
- [x] 5.3 Add `SDK_INVALID_INPUT` or the approved documented equivalent without retaining raw names, messages, stacks, causes, or rejected values. [F-05]
- [x] 5.4 Separate serialization failure from successful byte measurement and return `FIELD_SERIALIZATION_FAILED` or the approved documented equivalent for `BigInt` and similar values. [F-12]
- [x] 5.5 Add unit tests for function, symbol, hostile getter, proxy, cyclic/non-cloneable input, `BigInt`, and distinctive secret-marker non-disclosure. [F-05, F-12]
- [x] 5.6 Add tests proving genuine serializable size violations remain `FIELD_LIMIT_EXCEEDED`. [F-12]
- [x] 5.7 Add compile-time/public error-registry tests and update API, security, compatibility, and migration documentation for added or reclassified codes. [F-05, F-12]
- [x] 5.8 Assess package-version impact for public error additions and reclassification. [F-05, F-12]

## 6. Enforce forbidden scope and public API completeness [F-06, F-09]

GitHub issue: [#26](https://github.com/nandohdc/bloodtrail/issues/26)

- [x] 6.1 Correct forbidden source-name matching for root-level, nested, path-segment, and dot/underscore/hyphen delimiter boundaries without substring false positives. [F-06]
- [x] 6.2 Add scope unit fixtures for root-level `transport`, `browser`, `collector`, `exporter`, and `siem` names plus nested and allowed near-match names. [F-06]
- [x] 6.3 Remove unchecked implementation casts that hide named-API structural incompleteness and make the concrete SDK satisfy the full public generated interface. [F-09]
- [x] 6.4 Add runtime verification that constructs the SDK and proves all 24 generated `EVENT_METHODS` entries resolve to callable methods. [F-09]
- [x] 6.5 Add compile-time tests for concrete implementation completeness and public API compatibility. [F-09]
- [x] 6.6 Add differential mutation tests that introduce each forbidden filename class and require the scope gate to fail. [F-06]
- [x] 6.7 Add differential mutation tests that delete any one named method while generated metadata remains unchanged and require compilation or verification failure. [F-09]
- [x] 6.8 Update guardrail documentation and canonical coherence evidence for the strengthened controls. [F-06, F-09]

## 7. Prevent shutdown timeout from retaining process exit [F-07]

GitHub issue: [#27](https://github.com/nandohdc/bloodtrail/issues/27)

- [x] 7.1 Refactor shutdown timeout ownership so the timer is unreferenced where supported and cleared after either race outcome. [F-07]
- [x] 7.2 Preserve bounded timeout behavior and at-most-once sink flush/shutdown semantics when work genuinely stalls. [F-07]
- [x] 7.3 Add unit tests with controllable timers for clean settlement, timeout settlement, near-boundary races, and cleanup. [F-07]
- [x] 7.4 Add a bounded child-process regression proving clean shutdown does not wait for the configured timeout before process exit. [F-07]
- [x] 7.5 Verify timing tests have explicit generous bounds and deterministic synchronization rather than flaky sleeps. [F-07]
- [x] 7.6 Update lifecycle/API documentation and compatibility assessment. [F-07]

## 8. Bound operation and event identity retention [F-08]

GitHub issue: [#28](https://github.com/nandohdc/bloodtrail/issues/28)

- [x] 8.1 Replace strong terminal-operation completion retention with weakly keyed state attached to live SDK-issued operation handles. [F-08]
- [x] 8.2 Add validated immutable nested retention configuration with separate 4,096-entry defaults and 100,000-entry hard maxima for recent generated event IDs and recent issued operation IDs. [F-08]
- [x] 8.3 Implement deterministic insertion-order FIFO collision windows whose reads and duplicate insertions do not refresh age and whose oldest historical value is evicted at capacity. [F-08]
- [x] 8.4 Preserve exact-handle authority, event binding, private commit state, active reservation atomicity, and accepted terminal duplicate protection for the legitimate handle lifetime independent of collision-window churn. [F-08]
- [x] 8.5 Add sustained-generation and testing-only structural-size tests proving primitive histories remain at or below capacity and post-eviction behavior matches the documented horizon. [F-08]
- [x] 8.6 Add deterministic tests for duplicates inside each retained FIFO window, oldest-first eviction, no read refresh, duplicate insertion, invalid configuration, defaults, hard maxima, and rejection above maxima. [F-08]
- [x] 8.7 Add structural and isolated weak-ownership evidence proving discarded operation handles are not stored in a strong SDK collection and active reservations are never evicted. [F-08]
- [x] 8.8 Document each retention/deduplication horizon, weak ownership, FIFO behavior, post-eviction behavior, sizing, active-work limitations, migration, and package-version impact. [F-08]

## 9. Validate privacy transformation paths during initialization [F-10]

GitHub issue: [#29](https://github.com/nandohdc/bloodtrail/issues/29)

- [x] 9.1 Derive the intersection of policy-eligible and SDK-transformable paths during configuration normalization. [F-10]
- [x] 9.2 Reject unsupported transformation paths during SDK construction with bounded safe configuration diagnostics. [F-10]
- [x] 9.3 Add unit tests for every supported path class and representative policy-eligible but runtime-unsupported paths. [F-10]
- [x] 9.4 Add regression tests proving invalid configuration returns no SDK instance and cannot cause a later all-event `SDK_HOOK_FAILURE` outage. [F-10]
- [x] 9.5 Preserve valid hook, prohibited-data, key-version metadata, and post-hook validation behavior. [F-10]
- [x] 9.6 Update configuration/API documentation and compatibility assessment. [F-10]

## 10. Enforce redelivery identity semantics [F-11]

GitHub issue: [#30](https://github.com/nandohdc/bloodtrail/issues/30)

- [x] 10.1 Preserve the four explicit internal delivery intents (`generic_emit`, `pure_redelivery`, `named_execution`, and `named_redelivery`) without changing public signatures or root exports. [F-11]
- [x] 10.2 Require `redeliver(event)` to revalidate a complete canonical event, preserve identity, timestamps, and all canonical metadata, avoid caller mutation plus clock/identifier/hook/history/completion side effects, and invoke the sink once per valid explicit call. [F-08, F-10, F-11]
- [x] 10.3 Correct the named `redelivery.event` early return by enforcing complete canonical validation, fixed catalog/schema metadata, exact operation-handle method/event authority, and operation/transaction/correlation binding with the existing documented error taxonomy. [F-01, F-11]
- [x] 10.4 Prove named retry/re-execution remains ordinary named execution with a new event identity, required original-event and causation links, self-reference and attempt-limit rejection, transformations, and F-01/F-02 authority plus terminal reservation semantics. [F-01, F-02, F-10, F-11]
- [x] 10.5 Add focused runtime, compile-time, lifecycle, sink-diagnostic, and differential mutation evidence for complete-event redelivery, repeated calls, invalid canonical input, named binding, new retry identity, and all four delivery intents without adding non-F-11 tests. [F-11]
- [x] 10.6 Reconcile API, security, canonical-requirement interpretation, ADR, compatibility, and migration documentation with the complete-canonical-event model and explicitly disclaim same-instance event provenance, automatic retry, persistence, and durable delivery guarantees. [F-11]
- [x] 10.7 Classify F-11 as unchanged public signatures/exports, contract `1.0.0`, package version, and runtime dependencies with tightened named-redelivery behavior in a private unpublished candidate; add no event brand, retained ledger, error code, delivery infrastructure, publication, or production authorization. [F-08, F-11]

## 11. Cross-cutting remediation verification and documentation [F-01 through F-12]

Tracking issue: [#20](https://github.com/nandohdc/bloodtrail/issues/20)

- [x] 11.1 Build the SDK from a clean dependency installation and run strict source typecheck, runtime unit tests, compile-time tests, examples, package-content tests, dependency checks, export checks, compatibility checks, scope checks, and generated drift checks. [F-01 through F-12]
- [x] 11.2 Run all concurrency and child-process lifecycle regressions with non-zero test discovery and retain bounded command evidence. [F-02, F-07]
- [x] 11.3 Run all differential mutation tests and prove each intended mutation fails for the expected rule while the unmodified control passes. [F-04, F-06, F-09]
- [x] 11.4 Run the complete clean-state adversarial regression suite on the exact supported Node.js 24 runtime. [F-01 through F-12]
- [x] 11.5 Run the complete clean-state adversarial regression suite on the exact supported Node.js 26 runtime. [F-01 through F-12]
- [x] 11.6 Confirm approved contract `1.0.0` fixtures and canonical meaning are unchanged and `security-audit-event-contract` has no diff. [F-01 through F-12]
- [x] 11.7 Update README, API, SECURITY, MIGRATION, compatibility metadata, ADRs, and canonical verification documentation coherently for all remediated behavior. [F-01 through F-12]
- [x] 11.8 Complete package semantic-version, public API, error-code, configuration, and migration compatibility assessment. [F-01, F-05, F-08, F-09, F-10, F-11, F-12]
- [x] 11.9 Confirm no runtime dependency, production transport, framework, collector, queue, storage, SIEM, analytics, browser telemetry, or publication/deployment authorization was introduced. [F-01 through F-12]

## 12. Renewed review, owner decision, merge, and archive [F-01 through F-12]

Tracking issue: [#20](https://github.com/nandohdc/bloodtrail/issues/20)

> **Out-of-order merge notice (2026-08-06).** The F-08 specification correction
> `66bf3b721e604e715dbaae2a98888ddc1e6ff7fe` was merged into `main` via pull request #41 as
> merge commit `2f5787bb6120aa72d2cbd063fd963c5e23435e88`, before tasks 12.4 and 12.5 were
> completed. The merge used a true merge commit and rewrote no governed history, but 12.8
> requires merging an *approved* remediation and no approval was recorded at merge time, so
> 12.8 remains unchecked. Renewed technical review (12.4) and a renewed project-owner
> exact-commit decision (12.5) remain required and must now be bound to the merged content.
> No approval is inferred from the merge or from its passing checks. See the "Merge execution
> record" section of `technical-review-packet.md`.

> **Governance amendment (2026-08-06).** Tasks 12.4 and 12.5 previously required renewed
> independent technical review while simultaneously disqualifying project-owner self-review as
> independent assurance. Bloodtrail is a single-maintainer repository, so the pair was
> unsatisfiable as written: it could only stall the change indefinitely or be checked
> dishonestly. 12.4 now defines independence as independence *from the implementing pass*
> rather than as a second human reviewer, and requires the reviewer, exact reviewed commit, and
> assurance limitations to be recorded. 12.5 now requires the owner decision to state explicitly
> that independent third-party assurance was not obtained, and accepts that residual risk only
> while production deployment and package publication remain unauthorized; the stronger
> independent-assurance gate is reinstated as a precondition before either authorization is
> granted. This amends task wording only — the task count remains 91, task IDs and phase
> groupings are unchanged, and no box is checked. The canonical requirement *Adversarial
> remediation verification and approval are exact-commit governed* is unchanged: its
> "Owner decision binds exact commit" scenario already requires the record to identify assurance
> limitations. See section 12 of `design.md`.

- [x] 12.1 Reconcile every finding row with implementation commit, passing evidence, task IDs, GitHub issue closure, and final disposition. [F-01 through F-12]
- [x] 12.2 Prove F-01, F-02, F-03, and F-04 have executable passing blocker evidence and have not been closed or downgraded by prose alone. [F-01, F-02, F-03, F-04]
- [x] 12.3 Identify the final technical commit and prepare a bounded technical review packet covering API, security behavior, validation, verification, compatibility, dependencies, tests, and assurance limitations. [F-01 through F-12]
- [x] 12.4 Obtain renewed technical review explicitly bound to the exact final technical commit and performed independently of the implementing pass; record the reviewer, the exact reviewed commit, and the review's assurance limitations. Do not infer approval from AI review, issue state, PR assignment, or test success. [F-01 through F-12]
- [ ] 12.5 Obtain and record the project owner's explicit exact-commit decision and conditions, including an explicit statement that independent third-party assurance was not obtained and that the residual risk is accepted only while production deployment and package publication remain unauthorized; reinstate independent technical assurance as a precondition before either authorization is granted. [F-01 through F-12]
- [ ] 12.6 Confirm production deployment, package publication, framework integration, delivery infrastructure, and real-user processing remain unauthorized. [F-01 through F-12]
- [ ] 12.7 Re-run strict repository OpenSpec validation, canonical verification, Git whitespace/index checks, exact changed-path checks, and lifecycle semantic sweep after decision records. [F-01 through F-12]
- [ ] 12.8 Merge the approved remediation without rebase, squash, amendment, force-push, or rewriting governed history. [F-01 through F-12]
- [ ] 12.9 Synchronize clean `main`, verify the merged exact commit and checks, and archive `remediate-security-audit-sdk-adversarial-review` with its SDK capability delta in a separate commit. [F-01 through F-12]
- [ ] 12.10 Validate the archived repository in strict archived mode and report final production/publication non-authorization and archive evidence. [F-01 through F-12]
