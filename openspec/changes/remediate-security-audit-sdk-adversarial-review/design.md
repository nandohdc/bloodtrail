## Context

See `proposal.md` for the adversarial-review motivation. The SDK is an isolated ESM TypeScript package implementing canonical Security Audit Event Contract `1.0.0`; it has no production transport, retry queue, persistence, framework integration, or runtime dependencies. The prior `implement-security-audit-sdk-core` change is complete under `openspec/changes/archive/2026-07-31-implement-security-audit-sdk-core/` and is immutable historical evidence.

The current runtime structurally accepts `GeneratedOperationContext` at named methods, performs terminal deduplication after awaiting the sink, recursively freezes normalized provider objects, retains several identifier `Set`s for the SDK lifetime, and treats `redeliver()` like generic validation and emission. Verification scripts retain active-change and proposal-baseline assumptions that no longer match the archived lifecycle.

## Goals / Non-Goals

**Goals:**

- Resolve F-01 through F-12 without changing canonical event meaning or contract version `1.0.0`.
- Make security-critical behavior explicit, deterministic, and testable under concurrency and hostile input.
- Restore a clean-checkout canonical verification path for active remediation work and post-archive main.
- Preserve the no-runtime-dependency and no-production-integration boundaries.
- Produce a final technical commit suitable for renewed exact-commit owner review.

**Non-Goals:**

- Production deployment, publication, real-user processing, framework instrumentation, delivery infrastructure, retries, queues, persistence, SIEM integration, or analytics.
- Reopening the archived prior SDK change or rewriting its approvals.
- General cross-realm support, rejected adversarial hypotheses, or unrelated style refactoring.
- Changing `security-audit-event-contract`; any demonstrated contract defect requires a separate governed change.

## Decisions

### 1. Transactional completion accepts only SDK-issued operation handles

Plain `GeneratedOperationContext` remains a generated contract shape for event representation and read-only snapshots, but named SDK methods SHALL NOT accept it as trusted transaction evidence. Transaction-critical named methods accept only an `AuditOperationHandle` issued by `beginOperation()` from the same SDK instance. Runtime evidence is held in SDK-private `WeakMap`/`WeakSet` state keyed by the handle, not in enumerable fields or a copyable symbol.

A handle is bound at issuance to its immutable operation ID, transaction ID, correlation ID, SDK instance, and allowed event binding. `markCommitted()` and other state transitions update only SDK-private state. `snapshot()` remains observational; copying or modifying a snapshot cannot recreate evidence. Removing, omitting, or changing `bound_event` in caller data cannot change the private binding. Premature or foreign-handle success returns a bounded lifecycle/authority error and never invokes the sink.

Alternative: continue accepting structural contexts and add a marker field. Rejected because fields and copied snapshots remain forgeable. Alternative: globally brand objects by shape. Rejected because it does not bind evidence to the issuing SDK instance or sanctioned state transitions.

### 2. Terminal completion uses a per-handle atomic state machine

Each SDK-issued operation has private terminal-emission state: `idle`, `reserved`, or `completed`. A terminal-success call performs a synchronous compare-and-reserve transition from `idle` to `reserved` before any sink promise is awaited. A concurrent call observing `reserved` or `completed` returns `SDK_DUPLICATE_SUCCESS` with bounded metadata and does not invoke the sink.

An accepted sink result commits `reserved` to `completed`. A rejected, unknown, thrown, or rejected-promise sink outcome releases `reserved` back to `idle`, permitting an explicit later retry with the same trusted handle. The core performs no automatic retry. Cancellation during shutdown follows the actual sink result: no accepted result means no permanent completion reservation. Tests SHALL cover interleavings with controllable promises.

Alternative: reserve a string key in a global `Set`. Rejected because it duplicates handle identity state and complicates bounded retention. Alternative: keep reservations after sink failure. Rejected because it permanently blocks a valid caller-controlled retry despite no accepted terminal record.

### 3. Caller-owned providers are referenced, not recursively frozen

The reproduced root cause is ownership-blind recursion: `normalizeConfiguration()` creates one record containing both copied values and external collaborators, then `deepFreeze()` walks `Object.values()` across the entire graph. Class sinks, clocks, and identifier providers therefore become frozen together with enumerable queues and state records. Transformation hooks currently escape that traversal only because they are structurally replaced with `{ path, transform }`; that replacement changes the method receiver and breaks class/private-field semantics.

#### Architectural forces and ownership rules

- The SDK needs a stable normalized snapshot of primitive and value configuration, but configuration immutability is not ownership transfer.
- Sink delivery, clock reads, identifier generation, transformation execution, and optional sink lifecycle methods are dependency-injected capabilities with caller-owned lifecycle and state.
- Collaborator identity, prototypes, property descriptors, own-key order, native private fields, and receiver-sensitive methods must remain intact. Normalization must not traverse collaborator internals merely to enforce SDK invariants.
- The package must retain zero runtime dependencies, preserve contract `1.0.0`, and avoid broad hostile-getter/proxy/clone normalization reserved for F-05/F-12.

Configuration fields are classified as follows:

| Ownership category | Fields and examples | Normalization and mutability rule |
| --- | --- | --- |
| SDK-owned value data | `contractVersion`, copied `producer`/`service`/`environment`/`deployment` records, normalized authoritative context, `shutdownTimeoutMs`, copied transformation registration paths, and the normalized outer envelope | Validate, copy where value semantics are supported, freeze each SDK-created record, and shallow-freeze the SDK-created envelope. Later caller mutation of source records or the top-level configuration cannot replace these values. |
| Caller-owned collaborators | `sink` including optional lifecycle methods, `clock`, `identifiers`, and each transformation hook object | Validate the required callable surface, retain the exact object reference, and never clone, freeze, decorate, rewrite, bind, proxy, or recursively inspect its nested state. Invoke methods through the retained object so `this`, prototypes, private fields, and mutable state keep caller-defined semantics. |
| Caller-provided plain value data | Producer/service/environment/deployment records, authoritative-context plain slots, the transformations array as registration input | Make a field-specific copy into SDK-owned value records. Copy the transformations array and each primitive `path`, but retain the corresponding hook capability by reference. Do not apply one recursive operation to all fields. |

The normalized transformation entry is an SDK-owned value descriptor containing the copied path plus the retained hook reference. It is not a behavioral wrapper: invocation still targets the original hook object. The outer normalized record is shallow-frozen, and only SDK-owned nested value records are recursively protected. Caller-owned maps, sets, arrays, queues, counters, symbols, accessors, and other state remain live and caller-controlled. Callers are responsible for collaborator concurrency safety and for any freezing they perform before injection.

#### Design-pattern assessment

- **Ownership Boundary — selected.** Field-aware normalization explicitly separates SDK-created immutable values from external capabilities; this directly addresses the defect.
- **Dependency Injection — selected.** Sink, clock, identifier provider, and transformation hooks remain supplied dependencies with external state and lifecycle ownership.
- **Capability Object — selected.** The SDK receives only the behavioral authority it invokes and does not claim structural ownership of the provider object graph.
- **Shallow Immutable Configuration — selected.** `Object.freeze()` protects the SDK-created normalized envelope without traversing references; separately created value records are copied and frozen according to their value semantics.
- **Defensive Copy — selected only for plain value data.** It is appropriate for bounded primitive/string records and registration paths. It is rejected for stateful collaborators because structural copies lose prototypes and private fields, can change method identity/receiver behavior, and disconnect mutable state.
- **Facade or Adapter — rejected for this pass.** No repository evidence requires a behavioral wrapper. A direct ownership-aware normalizer is smaller and preserves identity. The internal transformation descriptor carries copied metadata only and does not impersonate the hook.
- **Proxy — rejected.** Proxy enforcement would change identity and debugging behavior, add trap/error surfaces relevant to later findings, and impose unnecessary runtime complexity and overhead.

Testing SHALL combine direct normalized-record assertions with public behavioral tests: before/after frozen-state checks; accepted named delivery through mutable class sinks; sequential queue/map/counter mutation; class/private-field clock, identifier, and hook receivers; identity/prototype/descriptor/key preservation; benign accessor non-traversal; pre-frozen and non-extensible supported collaborators; top-level/plain-value mutation isolation; generic emission, redelivery, F-01 evidence rejection, and F-02 concurrent reservation regression. The over-engineering risk is introducing wrappers, proxies, generalized graph classification, or new public provider abstractions when one field-aware shallow envelope and explicit owned descriptors are sufficient.

### 4. Verification is lifecycle-aware and anchored to relevant state

The canonical verifier gains explicit `active` and `archived` modes, with deterministic auto-selection allowed only when it produces the same result as the explicit mode:

- `active` validates the named active remediation change, its unchecked/apply task state, capability delta, and package scope against the remediation proposal baseline.
- `archived` validates the canonical `security-audit-sdk-core` capability plus the dated archived evidence and accepts governed post-approval task states.

Coherence rules read paths resolved from lifecycle metadata rather than a deleted hard-coded active path. Scope comparison is merge-base/package-local for remediation-owned paths and separately protects the canonical contract and archived history; unrelated commits before the remediation branch point do not fail the package gate. Real package, contract, capability, provenance, or governance drift remains fatal.

Mutation tests operate in disposable copies and prove that active-path removal, archived-evidence corruption, package drift, contract drift, forbidden scope, task-state contradiction, and missing named APIs are detected. Canonical verification never edits governed files.

Alternative: repoint all checks to the archived path. Rejected because it breaks active-change verification. Alternative: retain the original proposal baseline for all future scope checks. Rejected because unrelated repository history becomes permanent false-positive input.

### 5. Hostile constructor input is normalized at trust boundaries

Architectural forces are: JavaScript values may execute caller behavior during access, cloning, or serialization; the contract is JSON-shaped and version `1.0.0` is immutable; public event operations already return bounded `AuditResult` values; authority/configuration factories intentionally throw SDK-owned errors for construction misuse; F-01 authority, F-02 reservation atomicity, and F-03 collaborator ownership must remain unchanged; and the package must retain zero runtime dependencies.

The selected design combines four deliberately small patterns:

- **Exception Translation.** One direct input-boundary helper owns supported-value inspection, snapshot creation, canonical serialization, and byte measurement. Public result APIs translate governed caller-input failures to stable results. Intentionally throwing authority/configuration factories translate them to `SecurityAuditSdkError`, never a host error.
- **Validation Pipeline.** The order is safe descriptor-based structural inspection, supported-type classification, one `structuredClone()` snapshot, successful `JSON.stringify()` serialization, deterministic UTF-8 byte measurement, field/event limit comparison, schema and semantic validation, event construction, and finally sink handoff. Accessors are rejected from descriptors without invocation. Proxy traps and cloning are caught only within this governed caller-input path.
- **Anti-Corruption Boundary.** Runtime names, messages, causes, stacks, values, property names, and `DOMException`/`DataCloneError` details are discarded. Diagnostics contain only SDK-owned code, category, and a bounded governed root path.
- **Result Type and Direct Implementation.** Expected event-input failures preserve `AuditResult`; factory compatibility preserves stable SDK-owned throws. No generalized exception framework, visitor hierarchy, object-graph library, or dependency is introduced.

The supported canonical value set is finite numbers, strings, booleans, null, dense arrays, and plain records containing the same values. Undefined object members remain compatible with existing optional-input construction and are omitted by canonical serialization; a root value that serializes to no representation fails serialization. `BigInt` and cycles are classified as `FIELD_SERIALIZATION_FAILED`. Functions, symbols, accessors, sparse arrays, custom prototypes, Date, RegExp, Map, Set, typed arrays, ArrayBuffer, Error, URL, and other host objects are `SDK_INVALID_INPUT`; configuration translates the same boundary to `SDK_INVALID_CONFIGURATION`. `toJSON()` is not a conversion hook and is never invoked to smuggle a value into the supported set. Callers must explicitly convert domain values before submission.

Exception ownership is narrow: caller graph inspection, cloning, and canonical serialization own translated input failures; schema/semantic validation retains its existing codes; transformation and sink boundaries retain their existing safe policies; internal invariant failures remain test failures rather than being routed through a generalized catch-all framework. Field limits are evaluated only after serialization succeeds. `FIELD_LIMIT_EXCEEDED` therefore remains reserved for objectively oversized supported values, while `SDK_INVALID_INPUT` means unsupported or unsafe access/normalization and `FIELD_SERIALIZATION_FAILED` means a traversed value has no canonical serialized form.

Security tests use fixed hostile and supported corpora, explicit sink counters, getter/trap counters, bounded diagnostics, valid retry, genuine string/collection oversize controls, error-registry/type assertions, and existing F-01/F-02/F-03 regressions. Over-engineering risks were a generalized recursive visitor, Proxy membrane, repeated traversal, arbitrary `structuredClone()` support, or silent coercion/stringification; each was rejected because it would broaden semantics, invoke caller behavior, or hide classification.

Alternatives rejected: translating every exception at the outer SDK method would hide internal bugs; treating all failures as schema or size failures is misleading; JSON-stringifying first invokes `toJSON()` and conflates failure with size; supporting every structured-clone type conflicts with the canonical event model; and a new contract error or field would violate contract immutability.

### 6. Scope and public API guardrails are differential

**Architectural forces.** The production-scope policy is lexical rather than substring-based: it must recognize forbidden integration tokens at real filesystem separators and at dot, underscore, and hyphen delimiters without rejecting unrelated words. The public generated API has two independent sources of drift: the TypeScript interface can diverge from the concrete class, and generated descriptors can diverge from the object returned at runtime. Verification must remain deterministic, repository-relative, clean-clone safe, dependency-free at runtime, and independent of the immutable event contract and current task count.

**Selected direct implementation.** The existing scope expression treats `/` as both a leading and trailing token boundary in addition to the existing punctuation delimiters. Matching the repository-relative path therefore rejects a complete filename stem, complete directory segment, nested segment, or the first token beneath `src/`. It continues to permit boundary-free substrings such as `transportation`, `browserify`, `collection`, `analytical`, and `exportable`.

The concrete class declares `implements SecurityAuditSdk`; the factory returns the frozen instance through ordinary structural checking and contains no `as SecurityAuditSdk` assertion. This is the Compiler-Enforced Interface Conformance control: deleting or renaming any required event, lifecycle, context, operation, `emit`, `redeliver`, `flush`, or `shutdown` member makes normal source typecheck fail.

Compatibility verification is also an Executable Specification. It constructs a valid SDK instance, requires nonzero descriptor discovery, rejects duplicate generated event names or method names, proves generated event names and catalog names are one-to-one, resolves every `EVENT_METHODS` descriptor against the concrete instance, requires a function, and invokes it with the normal instance receiver. Stable diagnostics name the missing, duplicate, non-callable, or unbound method. The assertion verifies the frozen-instance policy and the non-generated public operations as well. It derives coverage from the generated descriptors rather than relying only on the expected count of 24.

**Defense in Depth and differential strategy.** TypeScript implementation/interface conformance, generated-surface executable verification, full runtime behavior tests, exports/compatibility checks, and production-scope checks remain separate controls. Disposable mutation repositories prove the claims directly: root and nested forbidden paths fail scope; benign substrings pass; deleting or renaming a concrete method fails source typecheck; a missing or duplicate generated descriptor and a concrete non-function fail executable verification. Every fixture has nonzero discovery, is discarded after execution, and cannot modify the governed candidate.

**Rejected alternatives.** Comparing only generated catalog/method counts was rejected because metadata can remain complete while the callable implementation is incomplete. Another assertion, `unknown` bridge, broad `satisfies`, index signature, dynamic method assignment, generated proxy, reflection framework, AST parser, plugin system, or generalized filesystem-policy engine would either suppress compiler evidence or add complexity and dependencies without improving this bounded correction. Production-constructor validation was rejected because verification-time construction proves correspondence without adding initialization behavior. Weakening or optionalizing the public interface and changing generated contract artifacts were rejected as contract violations.

**Invariants, risks, and compatibility.** Existing source-content, import, runtime-dependency, and production-integration controls remain unchanged. False positives are bounded by requiring a delimiter on both token sides; false negatives are bounded by treating both sides of `/` as lexical boundaries and testing root, nested filename, and directory cases. Public exports, signatures, generic methods, event contract `1.0.0`, package version `0.1.0`, zero runtime dependencies, F-01 operation authority, F-02 atomic terminal reservation, F-03 caller ownership, and F-05/F-12 hostile-input behavior are unchanged. The correction is compile-time internal hardening plus verification-only strengthening: no public API addition/removal or event-contract change, and patch-level compatible for the private unpublished package.

### 7. Shutdown timers are disposable and non-retaining

**Forces and ownership.** The shutdown timeout bounds waiting for SDK-owned in-flight sink promises, but the code that creates that timeout also owns its handle, event-loop reference policy, cancellation, and cleanup. The timer must remain logically effective when another referenced handle keeps Node.js active, while an otherwise idle process must not be retained merely to wait for the timeout. Existing `ready -> shutting_down -> shut_down` transitions, concurrent-shutdown promise sharing, repeated-shutdown results, in-flight waiting, F-02 reservation cleanup, optional sink lifecycle at-most-once behavior, and the configured millisecond range remain unchanged.

**Selected approach.** A private direct helper returns only `{ promise, cancel }`. It retains one Node.js timeout handle, immediately calls `unref()` on that handle, and exposes an idempotent `cancel()` that calls `clearTimeout()` at most once. `#performShutdown()` owns that helper for exactly one shutdown race and calls `cancel()` from an outer `finally`, covering in-flight-first settlement, timeout-first settlement, normalized sink lifecycle failure, and every return path. Clearing an already-fired timeout is intentional and harmless. No timer handle is stored in long-lived SDK state; concurrent callers join the existing shutdown promise and create no additional timer.

This is Resource Ownership plus Structured Cleanup: the creator owns reference policy and deterministic release. It is also bounded Structured Concurrency: the timer exists only to bound the owned in-flight wait and cannot become detached work after shutdown settles. The resulting RAII-like invariant is that the timer lifetime is no longer than the shutdown lifecycle that requires it. The implementation is a small local helper rather than two disconnected expressions, so creation, `unref()`, cancellation, and cleanup cannot drift into separate unowned paths.

**Timeout, exit, and cleanup semantics.** If in-flight work settles first, shutdown cancels the timer, invokes optional sink `flush` and `shutdown` at most once, and reaches `shut_down`. If the timeout wins while the process remains active, shutdown still returns `SDK_SHUTDOWN_TIMEOUT`, skips sink lifecycle invocation, reaches `shut_down`, and clears the fired handle. If sink lifecycle throws, the existing bounded `SDK_SINK_FAILURE` result and state transition are preserved and the timer is still cleared. If no referenced work remains, the unreferenced timeout cannot retain process exit; this changes process lifetime, not the public API, sink acceptance meaning, or durability guarantees.

**Rejected alternatives.** A timer registry, global timer manager, third-party timeout package, framework shutdown hook, process signal handler, periodic interval, generalized cancellation framework, and public timer-injection API add ownership surfaces or dependencies without improving this single-resource lifecycle. An anonymous uncancellable `Promise.race()` timer preserves the defect. `AbortSignal.timeout()` was rejected because it does not directly prove identical handle ownership, `unref()`, and deterministic cancellation semantics. Cancelling before the race can settle would disable the configured logical bound.

**Invariants, compatibility, and test strategy.** Exactly one owner and one retained handle exist per started shutdown lifecycle; the real Node handle is unreferenced; cleanup is deterministic and idempotent; repeated and concurrent shutdown do not accumulate timers; no interval or signal handler is installed; no public type, configuration field, timeout unit, event contract, sink contract, runtime dependency, F-08 retention policy, or generated surface changes. Node.js 24.2.0 and 26.5.0 both provide the typed Node timeout handle with `unref()`, so no browser timer abstraction is added. This is a patch-level observable process-lifecycle correction for private unpublished `0.1.0`.

Tests combine a real child-process exit probe with an 8000 ms configured timeout and a conservative sub-timeout safety ceiling, real-handle `unref()`/`hasRef()` observation, isolated controllable timer instrumentation, a referenced-process logical-timeout control, lifecycle state and sink-call assertions, and disposable differential mutations. M-F07-A removes `unref()` and is caught by the real Node-handle/process-exit guard; M-F07-B removes cancellation and is caught by clear-count instrumentation; M-F07-C bypasses the structured `finally` path and is caught by cleanup-path assertions; M-F07-D prevents timeout resolution and is caught by the referenced-process bounded-timeout guard. Child safety limits kill stuck processes, wrappers are restored in `finally`, and disposable mutation copies are removed.

### 8. Identity and deduplication state is bounded

**Current-state inventory at baseline `d9f07b88aa5f62e2b400dbf383971b5482ea7c52`.** The SDK-instance collections were: `src/sdk.ts:43` `#inFlight: Set<Promise<unknown>>`, inserted at line 254 and deleted in `finally` at line 268; it strongly and enumerably owns only unresolved sink promises, grows with active work rather than completed history, and remains unchanged. `src/sdk.ts:44` `#generatedEventIds: Set<string>`, inserted at line 227 and never deleted, strongly and enumerably retained every generated event ID for the SDK lifetime, and required F-08 correction. `src/sdk.ts:45` `#operationCompletions: Map<string, "reserved" | "completed">`, reserved at line 228, promoted at line 231, and deleted at lines 234–235 only while still reserved; accepted completions therefore grew for the SDK lifetime and required F-08 correction. `src/sdk.ts:46` `#issuedOperationIds: Set<string>`, inserted at line 80 and never deleted, strongly and enumerably retained issued operation IDs and required F-08 correction. `src/sdk.ts:47` held the operation-authority facade whose `src/operations.ts:63` `WeakMap<object, AuditOperationEvidence>` was populated at line 125; it was non-enumerable, did not keep discarded handles alive, and was already the correct authority owner.

Other mutable or retaining structures were explicitly excluded. `#shutdownPromise` and the SDK state scalar are one-lifecycle bounded. The F-07 one-shot timeout is locally owned, unreferenced, and cancelled; no retention timer is added. Module-private context branding is a `WeakMap` keyed by caller-held branded values. Generated catalog/semantic maps and sets are finite module-level projections of contract `1.0.0`. Configuration-normalization sets are call-local. Testing sinks retain caller-selected event arrays and are not SDK production history. No transaction-ID, correlation-ID, retry, redelivery, or durable completion-history collection exists on the SDK baseline. Shutdown state, sink references, authoritative context, and normalized configuration are fixed-size lifecycle/configuration ownership, not historical traffic growth.

**Measured baseline evidence.** A disposable exact-baseline Node.js `26.5.1` / npm `11.17.0` probe used `--expose-gc`, a deterministic valid identifier provider, a non-capturing accepting sink, and post-GC samples. For 7,000 accepted generated events, heap samples at 500/1,000/2,000/4,000/6,000/7,000 were 7,015,176 / 7,083,440 / 7,169,568 / 7,337,592 / 7,536,448 / 7,602,216 bytes; ordinary least-squares growth was about 89.88 heap bytes/event after warm-up. For 7,000 created and released operations, the corresponding heap samples were 5,949,688 / 6,029,296 / 6,128,416 / 6,285,528 / 6,500,888 / 6,533,880 bytes, about 90.24 bytes/operation. For 6,000 accepted completions, samples at 500/1,000/2,000/4,000/5,000/6,000 were 7,168,312 / 7,339,264 / 7,641,024 / 8,219,096 / 8,717,152 / 8,943,808 bytes, about 326.96 bytes/completion. RSS was allocator-noisy and stepped rather than tracking individual entries. The exact prior 574-byte/event figure did not reproduce, but all three strong histories and continued positive post-GC slopes were confirmed. Immediate and post-6,000-traffic ID reuse both failed at baseline because collision knowledge was lifetime-retained. A retained live handle remained authoritative, bound, private, cross-instance isolated, and duplicate-protected.

**Pattern assessment and selected ownership model.** Weak Ownership controls operation authority, transition state, active terminal reservation, and accepted terminal completion. Each exact unforgeable handle remains the key in the existing module-private `WeakMap`; its evidence record now owns a finite catalog-event completion map. Retaining the SDK alone does not retain a discarded handle. Retaining a legitimate handle preserves authority, event binding, commit state, reservation, and accepted-completion protection for that handle's lifetime, regardless of unrelated traffic. Copied, spread, cloned, serialized, fabricated, and foreign-instance values remain unauthorized. A bounded operation-ID cache is never an authority source.

Bounded FIFO History controls primitive collision knowledge that cannot be weakly keyed: recent generated event IDs and recent issued operation IDs. Each instance uses a small internal insertion-ordered set with a hard capacity. Membership reads do not refresh age; duplicate insertion does not reorder; a new distinct insertion at capacity evicts exactly the oldest historical value; size is at or below capacity after every insertion. This is FIFO rather than LRU because collision checks are observations, not renewed ownership, and reads must not extend retention unpredictably. After eviction, reuse is outside SDK-local collision knowledge and may proceed if all other validation and authority checks pass. This horizon is not global or lifetime uniqueness.

Active and historical state are separate. `reserved` is live operation lifecycle state in the weak handle record and is never selected for capacity eviction. Acceptance changes it to `completed` in the same weak record. Rejected, unknown, synchronously thrown, and rejected-promise outcomes release only the active reservation so an explicit retry can succeed. Completed state remains for the legitimate handle's lifetime and is not weakened by unrelated completion traffic. Active unresolved sink promises remain separately tracked by `#inFlight` until settlement.

**Configuration and limits.** Optional `retention.recentGeneratedEventIds` and `retention.recentIssuedOperationIds` capacities default independently to 4,096 and have a hard maximum of 100,000. The default provides a useful local collision window while bounding ordinary instance history to thousands rather than process-lifetime traffic; the hard maximum permits deliberately larger workloads without allowing `Number.MAX_SAFE_INTEGER` or practical unboundedness. Both values must be finite positive safe integers. Zero, negatives, fractions, strings, `BigInt`, `NaN`, infinity, values above 100,000, accessors, arrays, custom-prototype objects, symbols, and unknown nested keys fail construction with existing `SDK_INVALID_CONFIGURATION` and a bounded `/retention` path. Values are rejected, never clamped. The normalized nested record is SDK-owned and frozen; caller-owned providers, sinks, hooks, and sources are not frozen.

Reference queues, `FinalizationRegistry`, and explicit weak-reference cleanup were rejected because `WeakMap` directly expresses handle lifetime and finalizers cannot be correctness mechanisms. Capacity backpressure was rejected for historical primitive IDs because deterministic eviction gives an explicit bounded collision horizon without a new public error code; backpressure remains appropriate only for non-evictable active work, which this design keeps outside the historical windows. Time-based expiry, LRU packages, cache frameworks, global registries, sweep timers, intervals, process handlers, persistence, Redis, storage adapters, and production telemetry were rejected as unnecessary or unauthorized. The implementation is dependency-free and direct.

The resulting guarantees are precise: generated event-ID reuse is detected among the most recent configured N generated event IDs for that SDK instance; issued operation-ID reuse is detected among the most recent configured N issued IDs but authority never depends on that history; terminal duplicate completion remains enforced for the lifetime of the legitimate operation handle. Active work and caller-retained handles still consume resources, configured windows consume bounded memory, and the SDK is not a durable global or cross-process deduplication database.

### 9. Transformation compatibility is validated at initialization

Configuration normalization derives the set of SDK-transformable field-policy paths and rejects registered hooks outside that intersection. Policy eligibility alone is insufficient. Unsupported paths return `SDK_INVALID_CONFIGURATION` with a bounded canonical path before an SDK instance is created. Valid paths retain existing hook and post-hook validation behavior.

Alternative: discover incompatibility during each event. Rejected because one invalid configuration can cause a total per-event outage after successful initialization.

### 10. Redelivery is an SDK-issued immutable-event operation

`redeliver()` accepts only the identical immutable validated event object previously produced by the same SDK instance and tracked in private weak branding state. It preserves the event ID and canonical content and invokes only the sink boundary; it does not rebuild, retry automatically, or claim downstream delivery. A structurally equal clone, caller-constructed event, mutated object, or event from another SDK instance returns a bounded `SDK_INVALID_REDELIVERY` result.

A retry/re-execution uses a named method, receives a new event ID, and supplies the contract-required positive retry/original-event relationships. This narrows the SDK API to behavior it can prove while preserving the canonical requirement that pure redelivery retains identity. Cross-process transport redelivery remains outside this core because the package has no persistence or delivery infrastructure.

Alternative: hash arbitrary caller events. Rejected because equality to a prior SDK-issued immutable occurrence cannot be established without trusted retained provenance. Alternative: remove the distinction from the canonical capability. Rejected as a silent weakening.

### 11. Compatibility is explicit

Rejecting plain operation contexts and arbitrary `redeliver()` values is a deliberate breaking API/runtime correction and requires the package-version impact to be assessed before implementation merge. New configuration fields receive backward-compatible defaults. New safe error codes are additive, while F-12 reclassifies a previously incorrect error; migration documentation lists exhaustive-match and test updates. Contract `1.0.0` event shapes and semantics remain unchanged.

### 12. Renewed governance binds the final technical commit

The remediation remains unapproved until all executable evidence passes on exact Node.js 24 and 26, the final technical commit is identified, and the project owner records an explicit exact-commit decision. Historical approval remains preserved but cannot authorize reliance on the remediated basis. Any substantive commit after review requires reconfirmation. Project-owner self-review is project governance, not independent assurance.

Production deployment, package publication, framework integration, and delivery infrastructure remain unauthorized regardless of technical success. Merge and archive are separate lifecycle steps after renewed approval.

## Risks / Trade-offs

- **Breaking operation/redelivery inputs** → document migration, compile-time failures, runtime safe failures, and package-version impact before merge.
- **Collision-window eviction under sustained throughput** → document deterministic FIFO horizons, size capacities for local detection needs, and never use collision history as operation authority or live-handle completion state.
- **Weakly keyed terminal state becomes unreachable after handle loss** → this is intentional; only the live unforgeable handle can authorize or retry terminal success.
- **Provider methods depend on mutable `this` state** → preserve object identity and invocation receiver in regression tests.
- **Timer tests become flaky** → combine controllable timers/unit tests with bounded child-process exit tests.
- **Lifecycle modes drift apart** → share invariant checks and require mutation coverage for both modes.
- **New error codes disrupt exhaustive consumers** → record compatibility classification and migration guidance.
- **Same-instance redelivery is narrower than some callers expect** → state that cross-process redelivery belongs to separately governed delivery infrastructure, not this core.

## Migration Plan

1. Restore lifecycle-aware verification first so subsequent remediation has a reproducible gate.
2. Land operation evidence and atomic terminal reservation together enough to keep transaction tests coherent, then address provider ownership.
3. Apply error/serialization and verification guardrail groups, followed by shutdown and bounded-state work.
4. Apply transformation and redelivery changes, update public API/error/compatibility/migration documentation, and run full adversarial regression.
5. Verify from clean checkouts on exact supported Node.js 24 and 26 runtimes; preserve the canonical contract and archived prior change byte-for-byte.
6. Bind the final technical commit to renewed technical review and an explicit project-owner decision.
7. Merge without rewriting governed history, then archive the OpenSpec change in a separate lifecycle commit.

Rollback before renewed approval is branch deletion or reversion of the remediation commits; the archived historical basis remains unchanged but blocked for further reliance. No production rollback applies because production and publication are unauthorized.
