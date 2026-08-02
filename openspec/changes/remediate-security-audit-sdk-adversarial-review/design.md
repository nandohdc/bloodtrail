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

Forbidden source-name matching is performed against path segments and delimiter-separated filename tokens, including the first segment beneath `src/`; it is not dependent on a preceding slash. Root-level and nested forbidden names fail, while words that merely contain a token without a boundary remain allowed.

The implementation object structurally satisfies `SecurityAuditSdk & NamedSecurityAuditApi` without an unchecked cast that can hide omitted methods. Verification enumerates generated `EVENT_METHODS`, constructs an SDK, and asserts each of the 24 methods exists and is callable. Mutation tests delete one method or introduce each forbidden boundary class and require a non-zero gate result.

Alternative: compare only generated catalog/method counts. Rejected because generated metadata can remain complete while the callable implementation is incomplete.

### 7. Shutdown timers are disposable and non-retaining

The bounded shutdown race owns a timer handle. The timer is `unref()`'d when the runtime supports it so it cannot retain process exit, and it is cleared in a `finally` path after either race branch settles. The timeout branch still returns the documented bounded unknown/failure result when in-flight work genuinely stalls. Tests use child-process exit observation for retention and a controllable stalled sink for timeout behavior rather than relying only on fragile wall-clock assertions.

### 8. Identity and deduplication state is bounded

Terminal reservation/completion moves to private weakly keyed operation-handle state, so entries do not retain handles after callers release them and duplicate terminal protection lasts for the lifetime of the issued handle.

Generated event-ID and issued operation-ID reuse detection use bounded insertion-ordered stores with a default 24-hour horizon and a maximum of 100,000 live entries per store. Both values become validated immutable configuration with documented limits. Entries older than the horizon are expired before lookup/insertion. If the count limit is reached while all entries are still inside the horizon, the SDK fails closed with bounded `SDK_IDENTITY_CAPACITY_EXCEEDED`; it does not evict protected entries early. Within the horizon, reuse is always rejected. After expiry, a reused identifier is treated deterministically as outside SDK-local duplicate knowledge and may proceed if all other validation succeeds; documentation states that this is not lifetime-global uniqueness.

Alternative: least-recently-used eviction at capacity. Rejected because it silently weakens duplicate protection inside the promised horizon. Alternative: unlimited sets. Rejected because sustained use causes unbounded process growth.

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
- **Capacity exhaustion under extreme throughput** → fail closed with a distinct bounded error, expose documented sizing configuration, and test sustained generation without silent eviction.
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
