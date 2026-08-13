# Design Pattern Catalog

**Catalog version:** 1.0.0 · **Entries:** 24 · **Invariant registry:** `openspec/governance/invariant-registry.json`

This catalog is **not exhaustive**. It is a set of named patterns whose invariants this repository can
check mechanically. A design that fits none of them is not thereby wrong: `direct_implementation` is a
first-class decision, and a full assessment is satisfied by comparing direct implementation with at
least one materially plausible alternative. Selecting an entry here is never required, and listing
entries that do not match the observed forces does not satisfy candidate comparison.

Selecting an entry *does* bind it. A named-pattern assessment records the pattern ID, the catalog
version, every required invariant ID, the conditional invariant IDs it claims, any conditional ID it
declares non-applicable with a force-based reason, the implementation tasks, and the verification
evidence. Every required invariant must be accounted for.

Invariant IDs are immutable and are never reused for a new meaning. Renames go through the registry's
alias and migration mapping; removals require a replacement, a deactivation record, and a migration
for every governed reference.

---

### 1. Adapter

- **Pattern ID:** `pattern-adapter` · **Category:** Boundary · **Catalog version:** 1.0.0
- **Invariants:** `pattern-adapter-boundary-isolation` (required), `pattern-adapter-error-translation` (required), `pattern-adapter-no-leaked-lifecycle` (required), `pattern-adapter-bidirectional-fidelity` (conditional)

**Intent.** Present a foreign interface in local vocabulary so the rest of the system never learns the foreign shape.

**Use when.** An external library, protocol, or service must be consumed, and its types, errors, or lifecycle would otherwise spread through the codebase.

**Avoid when.** The foreign interface is already the local vocabulary, or there is exactly one call site that will never be replaced — an adapter there adds indirection without isolating anything.

**TypeScript / Node.js shape.** A class or closure holding the adaptee privately, exposing only local types; foreign errors caught and re-thrown as local error objects; no adaptee type in any exported signature.

**Security implications.** The adapter is a trust boundary. Data arriving from the adaptee is untrusted until normalised, and an adapter that forwards a foreign error object can leak internal paths, hostnames, or credentials in its message.

**Concurrency implications.** If the adaptee is not re-entrant, the adapter owns the serialisation; callers must not have to know. Shared adaptee connections need explicit ownership.

**Minimum verification.** A test proving no foreign type appears in the exported surface; a test proving a foreign error is translated; a test proving disposal releases the adaptee.

**Misuse.** A pass-through wrapper that re-exports the adaptee's types is not an Adapter — it is an alias that adds a layer and isolates nothing.

**Related patterns.** Facade, Explicit Trust Boundary, Repository.

---

### 2. Strategy

- **Pattern ID:** `pattern-strategy` · **Category:** Behavioural · **Catalog version:** 1.0.0
- **Invariants:** `pattern-strategy-stable-contract` (required), `pattern-strategy-observable-variation` (required), `pattern-strategy-no-shared-mutable-state` (required), `pattern-strategy-selection-is-explicit` (conditional)

**Intent.** Make a genuinely varying algorithm interchangeable behind one stable contract.

**Use when.** Two or more realistic implementations exist now, differ observably, and must be substitutable without the caller changing.

**Avoid when.** Only one implementation exists and the second is speculative. A Strategy with one implementation is an interface tax.

**TypeScript / Node.js shape.** An interface or function type with the varying operation; implementations as plain functions or small objects; selection passed in, not looked up.

**Security implications.** If strategies differ in how strictly they validate, substitution becomes a downgrade path. Any strategy that relaxes a check must be authorized separately.

**Concurrency implications.** Strategies must be safe to invoke concurrently; shared mutable state between them breaks substitutability under load in ways single-threaded tests miss.

**Minimum verification.** A contract test run against every implementation; a test proving the second implementation differs observably; a test proving no cross-strategy state.

**Misuse.** Naming a single function "Strategy" to justify an interface; using Strategy where a plain conditional over two literal branches is clearer.

**Related patterns.** Specification, Decorator, Domain Service.

---

### 3. State

- **Pattern ID:** `pattern-state` · **Category:** Lifecycle · **Catalog version:** 1.0.0
- **Invariants:** `pattern-state-explicit-transition-table` (required), `pattern-state-invalid-transition-rejected` (required), `pattern-state-transition-ownership` (required), `pattern-state-terminal-states-absorbing` (required), `pattern-state-concurrent-transition-safety` (conditional)

**Intent.** Make lifecycle explicit so invalid transitions are impossible rather than merely unlikely.

**Use when.** Behaviour depends on a discrete lifecycle, and reaching a state out of order would be a correctness or security failure.

**Avoid when.** There are two states and one transition — a boolean with a guarded setter is clearer than a machine.

**TypeScript / Node.js shape.** A union of literal state names, a transition table mapping state and event to the next state, and a single owner performing transitions; the state field is private and readonly to everything else.

**Security implications.** A missing terminal-state guard is a replay: a second `commit` on an already-committed operation is a double effect. Transition ownership prevents a caller from asserting a state it did not reach.

**Concurrency implications.** Where transitions can race, exactly one attempt must win and the losers must observe the rejection. Check-then-set across an await is where this breaks.

**Minimum verification.** A test per invalid transition proving rejection and an unchanged prior state; a test proving a terminal state absorbs a repeat; where applicable, a concurrent-transition test.

**Misuse.** A `status` string mutated from several call sites; enumerating states without enumerating transitions.

**Related patterns.** Atomic Reservation, Command, Fail Closed.

---

### 4. Command

- **Pattern ID:** `pattern-command` · **Category:** Behavioural · **Catalog version:** 1.0.0
- **Invariants:** `pattern-command-immutable-payload` (required), `pattern-command-explicit-outcome` (required), `pattern-command-no-hidden-side-channel` (required), `pattern-command-undo-symmetry` (conditional)

**Intent.** Reify an operation as a value so it can be validated, queued, audited, or replayed.

**Use when.** An operation must be inspected before execution, recorded after it, or transported between components.

**Avoid when.** The operation is executed immediately at its only call site — a function call carries the same meaning with less machinery.

**TypeScript / Node.js shape.** A frozen discriminated-union payload plus an executor returning an explicit result type; no execution state stored on the command.

**Security implications.** Because commands are transportable, their payloads cross trust boundaries. A command whose payload is mutable after validation is a time-of-check-to-time-of-use bug.

**Concurrency implications.** Immutability makes commands safe to hold across awaits. An executor holding per-command state is not.

**Minimum verification.** A test proving the payload is frozen; a test proving execution reports failure as a value; where undo exists, a round-trip test.

**Misuse.** A "command" that mutates itself during execution; using commands purely to add a layer over direct calls.

**Related patterns.** Idempotency Key, Transactional Outbox, Immutable Value Object.

---

### 5. Factory

- **Pattern ID:** `pattern-factory` · **Category:** Construction · **Catalog version:** 1.0.0
- **Invariants:** `pattern-factory-validates-before-construction` (required), `pattern-factory-returns-fully-initialised` (required), `pattern-factory-failure-is-explicit` (required)

**Intent.** Make invalid instances unconstructable by validating before anything exists.

**Use when.** Construction requires validation, derivation, or a choice among concrete types that callers should not make.

**Avoid when.** A constructor with typed parameters already makes invalid states unrepresentable.

**TypeScript / Node.js shape.** A module function returning either the instance or a result type; the class constructor kept private or the type kept unexported so the factory is the only path.

**Security implications.** The factory is where authority is granted. If a caller can bypass it and construct directly, every check it performs is optional.

**Concurrency implications.** Factories that memoise must be safe against concurrent first calls; a half-built cached instance is worse than none.

**Minimum verification.** A test per rejected input proving no instance is produced; a test proving the returned instance needs no further initialisation.

**Misuse.** A factory that returns a partially built object for the caller to finish; a factory that throws a bare string.

**Related patterns.** Builder, Immutable Value Object, Capability.

---

### 6. Builder

- **Pattern ID:** `pattern-builder` · **Category:** Construction · **Catalog version:** 1.0.0
- **Invariants:** `pattern-builder-terminal-validation` (required), `pattern-builder-no-partial-escape` (required), `pattern-builder-single-use-or-reset` (required)

**Intent.** Assemble a value with many optional parts while validating it only when it is complete.

**Use when.** Construction has many optional inputs whose validity depends on each other, so per-setter validation cannot decide.

**Avoid when.** An options object passed to a factory expresses the same thing without a mutable intermediate.

**TypeScript / Node.js shape.** A builder object whose setters return `this`, with all cross-field validation in `build()`; the product type is not exported in a partial form.

**Security implications.** A partially configured product that escapes is a value that skipped validation. Reused builders leak the previous configuration into the next product.

**Concurrency implications.** Builders are mutable and are not safe to share across concurrent flows; each flow needs its own.

**Minimum verification.** A test proving cross-field validation fires at build; a test proving a second build does not inherit the first's state.

**Misuse.** Validating in each setter and calling it a builder; exposing the partially built object for "advanced" use.

**Related patterns.** Factory, Immutable Value Object.

---

### 7. Facade

- **Pattern ID:** `pattern-facade` · **Category:** Boundary · **Catalog version:** 1.0.0
- **Invariants:** `pattern-facade-no-subsystem-leakage` (required), `pattern-facade-adds-no-hidden-policy` (required), `pattern-facade-error-aggregation-is-explicit` (required)

**Intent.** Offer one coherent entry point to a subsystem without becoming a second place where policy lives.

**Use when.** A subsystem has several collaborating parts and callers should depend on one narrow surface.

**Avoid when.** The subsystem is one module — a facade over it is a rename.

**TypeScript / Node.js shape.** A module exporting a small set of functions over privately held subsystem parts; no subsystem type in any signature.

**Security implications.** A facade that quietly adds retry, caching, or authorization creates policy nobody reviewed. Whatever policy it adds must be declared at the boundary.

**Concurrency implications.** The facade owns any ordering guarantee it implies. If it fans out to parts concurrently, partial failure semantics must be declared, not discovered.

**Minimum verification.** A test proving no subsystem type is exported; a test proving the declared aggregation rule on partial failure.

**Misuse.** A "facade" that grows business rules; one that forwards subsystem errors unchanged.

**Related patterns.** Adapter, Domain Service, Fail Closed.

---

### 8. Decorator

- **Pattern ID:** `pattern-decorator` · **Category:** Structural · **Catalog version:** 1.0.0
- **Invariants:** `pattern-decorator-contract-preservation` (required), `pattern-decorator-order-documented` (required), `pattern-decorator-no-identity-forgery` (required)

**Intent.** Add behaviour around an existing contract without changing that contract.

**Use when.** A cross-cutting concern applies to several implementations of one interface and composes cleanly.

**Avoid when.** The added behaviour changes the contract — then it is a different operation, not a decoration.

**TypeScript / Node.js shape.** A function taking the decorated value and returning the same type; no widening of failures and no narrowing of accepted inputs.

**Security implications.** A decorator presenting itself as the decorated instance for identity or authority purposes is a confused deputy. Authorization decorators must not be bypassable by holding the inner instance.

**Concurrency implications.** Stacked decorators that each hold state multiply the state to reason about; ordering becomes observable under concurrency even when it is not sequentially.

**Minimum verification.** The decorated contract test run through the decorator; a test proving order dependence where it exists; a test proving the decorator is not accepted where the raw instance's identity is required.

**Misuse.** Decorators that silently swallow failures; unbounded decorator stacks assembled at runtime.

**Related patterns.** Strategy, Bounded Retry, Circuit Breaker.

---

### 9. Specification

- **Pattern ID:** `pattern-specification` · **Category:** Behavioural · **Catalog version:** 1.0.0
- **Invariants:** `pattern-specification-pure-predicate` (required), `pattern-specification-composition-is-total` (required), `pattern-specification-no-side-effects` (required)

**Intent.** Represent a business rule as a composable value so rules can be combined, named, and tested independently.

**Use when.** Rules are independently owned, combined at runtime, or need to be named and reused across contexts.

**Avoid when.** There is one rule system with one owner — small predicate functions are simpler and just as testable.

**TypeScript / Node.js shape.** `(candidate: T) => boolean` or a result-returning variant, plus total `and`/`or`/`not` combinators.

**Security implications.** A specification that performs I/O turns a predicate into a request, which makes authorization checks timing-dependent and cacheable in ways nobody planned.

**Concurrency implications.** Purity makes specifications trivially safe to evaluate concurrently; any hidden memoisation reintroduces shared state.

**Minimum verification.** A test proving the same input yields the same verdict; a composition test over every combinator; a test proving no I/O.

**Misuse.** Specification objects wrapping a single `if`; combinators that are partial and throw on some combinations.

**Related patterns.** Strategy, Domain Service.

---

### 10. Repository

- **Pattern ID:** `pattern-repository` · **Category:** Persistence · **Catalog version:** 1.0.0
- **Invariants:** `pattern-repository-persistence-ownership` (required), `pattern-repository-semantics-declared` (required), `pattern-repository-no-leaked-query-language` (required), `pattern-repository-identity-stability` (required), `pattern-repository-transaction-participation` (conditional)

**Intent.** Own an aggregate's storage so persistence semantics are stated in one place rather than assumed everywhere.

**Use when.** An aggregate has a lifecycle in storage and several callers need it without learning the store.

**Avoid when.** A single module already owns the access and no second caller exists.

**TypeScript / Node.js shape.** An interface in domain terms — `findById`, `save` — returning domain types; no cursor, connection, or query string in any signature.

**Security implications.** The repository is the choke point for tenant scoping. A query built from caller input without scoping is a cross-tenant read; ownership is what makes that check unmissable.

**Concurrency implications.** Read-your-writes, staleness, and ordering are load-bearing under concurrency and must be declared rather than inherited from whatever the store happens to do today.

**Minimum verification.** A test proving no store type escapes; a test per declared semantic; a test proving identity survives save and reload.

**Misuse.** A repository exposing a query builder; several components writing the same table.

**Related patterns.** Unit of Work, Adapter, Transactional Outbox.

---

### 11. Unit of Work

- **Pattern ID:** `pattern-unit-of-work` · **Category:** Persistence · **Catalog version:** 1.0.0
- **Invariants:** `pattern-unit-of-work-atomic-commit` (required), `pattern-unit-of-work-explicit-rollback` (required), `pattern-unit-of-work-no-partial-visibility` (required)

**Intent.** Make a set of changes commit or fail as one.

**Use when.** Several writes must be atomic and a partial application would leave an invalid state.

**Avoid when.** There is one write — the store's own atomicity already covers it.

**TypeScript / Node.js shape.** A scope object tracking pending changes, with `commit()` and `rollback()`; repositories enlist rather than writing directly.

**Security implications.** Partial visibility is an information leak and an authorization gap: an observer can act on a half-applied state that no policy was written for.

**Concurrency implications.** Concurrent units of work over the same aggregate need a declared conflict policy; last-write-wins is a choice, not a default.

**Minimum verification.** A test proving a mid-sequence failure applies nothing; a test proving no observer sees a subset before commit.

**Misuse.** Calling a batch of writes a unit of work without atomicity; a rollback that reverts some changes.

**Related patterns.** Repository, Transactional Outbox, Atomic Reservation.

---

### 12. Domain Service

- **Pattern ID:** `pattern-domain-service` · **Category:** Behavioural · **Catalog version:** 1.0.0
- **Invariants:** `pattern-domain-service-stateless` (required), `pattern-domain-service-owns-no-persistence` (required), `pattern-domain-service-explicit-inputs` (required)

**Intent.** Hold domain logic that belongs to no single entity, without acquiring state or storage.

**Use when.** An operation spans several aggregates and placing it on either would distort that aggregate's responsibility.

**Avoid when.** The logic clearly belongs to one entity — moving it out creates an anaemic model.

**TypeScript / Node.js shape.** Exported pure functions taking every dependency as a parameter; no module-level mutable state.

**Security implications.** Explicit inputs are what make authorization reviewable: a service that reads ambient context can be invoked with an authority the caller did not intend to pass.

**Concurrency implications.** Statelessness makes concurrent invocation safe; module-level caches quietly remove that property.

**Minimum verification.** A test proving repeated invocation is independent; a test proving no storage access; a review that every input is a parameter.

**Misuse.** A "service" that accumulates caches; a service that reaches into a repository it was not given.

**Related patterns.** Specification, Ambient Context / Context Propagation, Repository.

---

### 13. Immutable Value Object

- **Pattern ID:** `pattern-immutable-value-object` · **Category:** Data · **Catalog version:** 1.0.0
- **Invariants:** `pattern-immutable-value-object-deep-freeze` (required), `pattern-immutable-value-object-structural-equality` (required), `pattern-immutable-value-object-validated-at-construction` (required), `pattern-immutable-value-object-no-identity-semantics` (required)

**Intent.** Represent a value whose contents are its meaning, and which cannot change after it exists.

**Use when.** A value is shared, cached, transported, or held across awaits, and a later mutation would be a bug at a distance.

**Avoid when.** The thing has identity and a lifecycle — that is an entity, not a value.

**TypeScript / Node.js shape.** A frozen plain object or class with `readonly` fields, deep-frozen on construction, validated in the factory, compared structurally.

**Security implications.** Deep freezing is what makes a validated value stay validated. A shallow freeze over a nested array is a mutable payload behind a validated façade.

**Concurrency implications.** Immutable values are safe to share across concurrent flows without copying; this is usually the reason to choose them.

**Minimum verification.** A test proving nested containers are frozen; a test proving structural equality; a test proving invalid inputs never construct.

**Misuse.** `Object.freeze` on the top level only; values with an `id` that callers compare by reference.

**Related patterns.** Factory, Builder, Command.

---

### 14. Capability

- **Pattern ID:** `pattern-capability` · **Category:** Security · **Catalog version:** 1.0.0
- **Invariants:** `pattern-capability-unforgeable-runtime-authority` (required), `pattern-capability-no-ambient-fallback` (required), `pattern-capability-explicit-attenuation` (required), `pattern-capability-revocation-is-observable` (conditional)

**Intent.** Make holding a value *be* the authority, so authority cannot be asserted by a caller who does not hold it.

**Use when.** An operation must be restricted and the restriction must survive a caller who controls the arguments.

**Avoid when.** The decision is a plain business rule with no adversary — a boolean parameter is honest and cheaper.

**TypeScript / Node.js shape.** A branded value whose brand lives in a module-private `WeakMap` registry, inserted only by the module's own constructors. In this repository, `packages/security-audit-sdk-core/src/context.ts` is the reference shape: symbols were abandoned because `structuredClone` silently drops non-enumerable symbols, which would have let a cloned value lose its brand without anyone noticing.

**Security implications.** A type-level brand is not a capability: a cast forges it. Unforgeability must hold at runtime. An ambient fallback path defeats the whole construction.

**Concurrency implications.** A `WeakMap`-keyed registry is safe under concurrency because it keys on object identity; a registry keyed on a mutable field is not.

**Minimum verification.** A test proving a hand-rolled or cast object is rejected; a test proving a clone does not carry authority; a test proving absence denies; a test proving attenuation returns a new weaker capability.

**Misuse.** Branding with a symbol and assuming it survives serialisation; treating the presence of ambient context as a capability.

**Related patterns.** Authority Provenance, Explicit Trust Boundary, Ambient Context / Context Propagation, Fail Closed.

---

### 15. Explicit Trust Boundary

- **Pattern ID:** `pattern-explicit-trust-boundary` · **Category:** Security · **Catalog version:** 1.0.0
- **Invariants:** `pattern-explicit-trust-boundary-input-classification` (required), `pattern-explicit-trust-boundary-normalisation-before-use` (required), `pattern-explicit-trust-boundary-claims-distinguished-from-authority` (required)

**Intent.** Name the place where untrusted input becomes trusted, so the check cannot be scattered or skipped.

**Use when.** Input crosses from a caller, a network, a file, or a repository into logic that assumes well-formed data.

**Avoid when.** Everything on both sides is already produced by this module — a boundary that separates nothing adds a false assurance.

**TypeScript / Node.js shape.** One entry function per boundary that normalises and validates, returning a distinct validated type; client claims typed differently from server-authoritative values so they cannot be substituted.

**Security implications.** This is the pattern the others rest on. Normalising after use — logging a raw path, building a filename, then validating — is a boundary in name only.

**Concurrency implications.** Validation followed by an await followed by use reopens the boundary: the validated value must be immutable, or revalidated at use.

**Minimum verification.** A test per malformed input class; a test proving a client claim cannot be passed where an authoritative value is required; a test proving normalisation precedes every use.

**Misuse.** Validating in some call paths; a single `unknown`-to-`any` cast at the boundary.

**Related patterns.** Capability, Authority Provenance, Fail Closed, Adapter.

---

### 16. Fail Closed

- **Pattern ID:** `pattern-fail-closed` · **Category:** Security · **Catalog version:** 1.0.0
- **Invariants:** `pattern-fail-closed-absent-evidence-denies` (required), `pattern-fail-closed-error-path-denies` (required), `pattern-fail-closed-diagnostic-is-distinct` (required)

**Intent.** Make absence of evidence deny rather than permit.

**Use when.** A check can be unavailable, incomplete, or corrupt, and proceeding without it would grant something.

**Avoid when.** Denial is more harmful than permission and no security decision rides on the check — say so explicitly rather than defaulting.

**TypeScript / Node.js shape.** Exhaustive switches with a rejecting default; `try` blocks whose `catch` denies; a distinct diagnostic identifier per denial reason.

**Security implications.** The failure mode this prevents is the quiet one: a missing policy file read as "no applicable rules", an empty list read as "nothing to check". Both are permission granted by omission.

**Concurrency implications.** Timeouts are an evidence-absent case. A check that times out must deny, not fall through to the permissive branch.

**Minimum verification.** A test per absent, empty, truncated, and malformed evidence case, each asserting its own distinct diagnostic — not merely a non-zero exit.

**Misuse.** A `catch` that logs and continues; treating an empty result set as success.

**Related patterns.** Explicit Trust Boundary, Capability, Bounded Retry.

---

### 17. Authority Provenance

- **Pattern ID:** `pattern-authority-provenance` · **Category:** Security · **Catalog version:** 1.0.0
- **Invariants:** `pattern-authority-provenance-source-recorded` (required), `pattern-authority-provenance-client-claims-not-authoritative` (required), `pattern-authority-provenance-survives-serialisation` (required)

**Intent.** Keep track of where an authoritative value came from, so a claim can never be mistaken for a fact.

**Use when.** Values from different trust levels — client-supplied, server-derived, operator-configured — flow through the same structures.

**Avoid when.** Every value in the structure has one source and cannot acquire another.

**TypeScript / Node.js shape.** Distinct types per provenance, produced only by their own constructors; provenance carried in a private registry rather than a field a caller can set.

**Security implications.** Confused-deputy prevention. If a client can supply `actor` and the system treats it as authoritative, every downstream authorization is decided by the attacker.

**Concurrency implications.** Provenance must survive being held across awaits and passed between tasks; a marker stored in a mutable ambient slot does not.

**Minimum verification.** A test proving a client-supplied value cannot be used where an authoritative one is required; a test proving a cloned or serialised value either keeps provenance or fails closed.

**Misuse.** A boolean `trusted` flag; recording provenance only in logs.

**Related patterns.** Capability, Explicit Trust Boundary, Immutable Value Object.

---

### 18. Idempotency Key

- **Pattern ID:** `pattern-idempotency-key` · **Category:** Delivery · **Catalog version:** 1.0.0
- **Invariants:** `pattern-idempotency-key-deterministic-derivation` (required), `pattern-idempotency-key-replay-returns-first-outcome` (required), `pattern-idempotency-key-scope-is-bounded` (required)

**Intent.** Make a repeated request produce the first outcome instead of a second effect.

**Use when.** A caller may retry, a transport may redeliver, or a user may double-submit, and the effect is not naturally idempotent.

**Avoid when.** The operation is already idempotent — a key adds storage and a new failure mode.

**TypeScript / Node.js shape.** A key derived deterministically from identifying content; a store mapping key to the recorded first outcome; a declared uniqueness scope and retention.

**Security implications.** A key derived from attacker-controlled content lets an attacker collide with someone else's operation and read its recorded outcome. Scope must include the tenant.

**Concurrency implications.** Two concurrent first attempts must resolve to one effect; this needs an atomic reserve on the key, not a read-then-write.

**Minimum verification.** A test proving a replay returns the first outcome without a second effect; a concurrent-first-attempt test; a test proving cross-scope keys cannot collide.

**Misuse.** Keys derived from a timestamp or a random value; unbounded key retention presented as correctness.

**Related patterns.** Atomic Reservation, Transactional Outbox, Bounded Retry.

---

### 19. Atomic Reservation

- **Pattern ID:** `pattern-atomic-reservation` · **Category:** Concurrency · **Catalog version:** 1.0.0
- **Invariants:** `pattern-atomic-reservation-pre-await-reservation` (required), `pattern-atomic-reservation-release-on-failure` (required), `pattern-atomic-reservation-single-terminal-completion` (required), `pattern-atomic-reservation-no-double-commit` (required)

**Intent.** Claim the right to perform an effect before doing anything that can be interleaved.

**Use when.** An effect must happen at most once and the path to it contains an await, an I/O call, or any yield point.

**Avoid when.** The whole operation is synchronous and no interleaving is possible.

**TypeScript / Node.js shape.** A synchronous `reserve()` returning a handle before the first `await`, a `complete()` and a `release()`, and a handle whose real state lives in a module-private `WeakMap` so it cannot be forged. `packages/security-audit-sdk-core/src/operations.ts` is the reference shape.

**Security implications.** Reserving after an await is a race that produces double effects — a double emit, a double charge, a double grant. The pre-await requirement is the whole pattern; without it the rest is decoration.

**Concurrency implications.** This *is* the concurrency pattern. The check and the claim must be one indivisible step in the event loop, meaning no `await` between them.

**Minimum verification.** A test launching two concurrent attempts and proving exactly one commit and one explicit rejection; a test proving a rejected promise releases the reservation; a test proving a second terminal completion is rejected.

**Misuse.** `if (!inFlight) { await check(); inFlight = true; }` — the classic form of the bug. Releasing only on the happy path.

**Related patterns.** State, Idempotency Key, Unit of Work, Fail Closed.

---

### 20. Transactional Outbox

- **Pattern ID:** `pattern-transactional-outbox` · **Category:** Delivery · **Catalog version:** 1.0.0
- **Invariants:** `pattern-transactional-outbox-same-transaction-write` (required), `pattern-transactional-outbox-at-least-once-delivery-declared` (required), `pattern-transactional-outbox-consumer-idempotency-required` (required)

**Intent.** Make a state change and its announcement atomic, without a distributed transaction.

**Use when.** A state change must be published, and losing the publication or publishing without the change would both be wrong.

**Avoid when.** The publication is advisory and loss is acceptable — say that, rather than building an outbox that implies a guarantee you do not need.

> **Authorization note.** Transports, exporters, collectors, queues, and outboxes are unauthorized in this repository. This entry exists as catalog guidance; materialising one requires its own OpenSpec change and explicit authorization.

**TypeScript / Node.js shape.** An outbox row written in the same transaction as the state change, plus a separate relay that reads, publishes, and marks.

**Security implications.** The outbox holds a copy of the event payload, so it inherits its confidentiality class and its retention obligations. A relay that logs failures verbatim leaks that payload.

**Concurrency implications.** Multiple relays must not double-publish; the relay needs a reservation on each row. At-least-once is the honest guarantee — exactly-once across a boundary is not achievable and must not be claimed.

**Minimum verification.** A test proving a rolled-back state change leaves no outbox row; a test proving a redelivered message is absorbed idempotently by the consumer.

**Misuse.** Publishing after commit and calling it an outbox; claiming exactly-once.

**Related patterns.** Unit of Work, Idempotency Key, Bounded Retry.

---

### 21. Circuit Breaker

- **Pattern ID:** `pattern-circuit-breaker` · **Category:** Resilience · **Catalog version:** 1.0.0
- **Invariants:** `pattern-circuit-breaker-explicit-states` (required), `pattern-circuit-breaker-half-open-probe-bounded` (required), `pattern-circuit-breaker-open-fails-fast` (required)

**Intent.** Stop calling a dependency that is failing, and find out when it recovers without a stampede.

**Use when.** A dependency's failures are correlated and continued calls make things worse for it and for the caller.

**Avoid when.** Failures are independent — a breaker then denies calls that would have succeeded.

**TypeScript / Node.js shape.** An explicit closed/open/half-open state machine with declared thresholds; a bounded set of half-open probes; immediate rejection while open.

**Security implications.** A breaker on an authorization dependency turns an outage into an availability decision. Whether open means deny or allow must be an explicit, reviewed choice — and for authorization it must be deny.

**Concurrency implications.** The half-open transition is a reservation problem: without a bound, every waiting caller probes at once and re-opens the breaker immediately.

**Minimum verification.** A test per transition threshold; a test proving bounded concurrent probes in half-open; a test proving open rejects without waiting.

**Misuse.** A breaker that counts failures without a time window; half-open admitting all traffic.

**Related patterns.** Bounded Retry, Bulkhead, State, Fail Closed.

---

### 22. Bulkhead

- **Pattern ID:** `pattern-bulkhead` · **Category:** Resilience · **Catalog version:** 1.0.0
- **Invariants:** `pattern-bulkhead-bounded-partition` (required), `pattern-bulkhead-rejection-is-explicit` (required), `pattern-bulkhead-no-shared-exhaustible-resource` (required)

**Intent.** Partition resources so exhaustion in one flow cannot starve another.

**Use when.** Independent workloads share a pool and one can saturate it.

**Avoid when.** There is one workload — partitioning it lowers utilisation for no isolation.

**TypeScript / Node.js shape.** Per-partition concurrency limits with explicit rejection when full; separate pools rather than one shared pool with priorities.

**Security implications.** Without bulkheads, an unauthenticated flow can exhaust the capacity an authenticated one needs. Partitioning by trust level is a denial-of-service control.

**Concurrency implications.** The bound must be enforced at admission, before the resource is taken; enforcing it afterwards is not a bound.

**Minimum verification.** A test proving one partition's saturation leaves another serving; a test proving admission rejection is explicit rather than an unbounded queue.

**Misuse.** A shared queue with per-tenant counters — the queue itself is the shared exhaustible resource.

**Related patterns.** Circuit Breaker, Bounded Retry, Fail Closed.

---

### 23. Bounded Retry

- **Pattern ID:** `pattern-bounded-retry` · **Category:** Resilience · **Catalog version:** 1.0.0
- **Invariants:** `pattern-bounded-retry-finite-attempts` (required), `pattern-bounded-retry-only-retryable-failures` (required), `pattern-bounded-retry-jittered-backoff` (required), `pattern-bounded-retry-idempotent-operation-required` (required)

**Intent.** Recover from transient failure without amplifying a systemic one.

**Use when.** Failures are genuinely transient and the operation is idempotent.

**Avoid when.** The operation is not idempotent, or the failure is deterministic — retrying a validation failure just repeats it.

**TypeScript / Node.js shape.** A declared attempt cap, a retryable-failure classifier, exponential backoff with jitter, and the underlying failure surfaced on exhaustion.

**Security implications.** Retrying an authorization failure is a brute-force loop. Retrying a non-idempotent effect is a multiplication of that effect.

**Concurrency implications.** Unjittered backoff synchronises clients into waves; combined with a recovering dependency this is the classic thundering herd.

**Minimum verification.** A test proving the attempt cap; a test proving a non-retryable failure is not retried; a test proving jitter is applied.

**Misuse.** Retry loops without a cap; retrying everything that throws.

**Related patterns.** Circuit Breaker, Bulkhead, Idempotency Key.

---

### 24. Ambient Context / Context Propagation

- **Pattern ID:** `pattern-ambient-context` · **Category:** Runtime / Execution Context · **Catalog version:** 1.0.0
- **Invariants:** `pattern-ambient-context-immutable-frame` (required), `pattern-ambient-context-explicit-run-scope-ownership` (required), `pattern-ambient-context-no-global-authority-fallback` (required), `pattern-ambient-context-concurrent-isolation` (required), `pattern-ambient-context-no-cross-request-leakage` (required), `pattern-ambient-context-no-retention-after-scope-exit` (required), `pattern-ambient-context-authority-not-inferred-from-presence` (required), `pattern-ambient-context-explicit-missing-context-behavior` (required)

**Intent.** Carry request-scoped data through a call tree without threading it through every signature, while keeping authority explicit.

**Use when.** A value is genuinely request-scoped — a correlation identifier, a tenant scope, a deadline — and threading it would touch every intermediate function that has no interest in it.

**Avoid when.** The value is a dependency rather than a scope, or when only one or two frames need it. Ambient context makes data flow invisible; that cost is only worth paying for values that really are ambient.

**TypeScript / Node.js shape.** `AsyncLocalStorage` from `node:async_hooks`, entered with `run()` so scope entry and exit are owned by the runtime; the stored frame deep-frozen; nested scopes creating a new frame rather than mutating; a declared behaviour when `getStore()` returns `undefined`.

**Security implications.** The hazard is **hidden authority**. If a component grants an operation because a context frame exists, any caller who can enter a scope can grant that authority — a confused deputy with no visible call-site evidence. Presence of a frame must grant nothing; authorization comes from an explicit capability or an explicitly authoritative value carried *inside* the frame, and those must stay type-distinguishable from client-supplied claims. A global default frame is the same failure with a wider blast radius: it turns "no context" into "some context", silently.

Leakage is the second hazard. A frame that outlives its scope — captured in a closure, cached in a module, or retained by a pending timer — can be observed by a later, unrelated request. That is a cross-tenant read.

**Concurrency implications.** Concurrent runs must be isolated: two scopes running interleaved on the same event loop must each observe only their own frame. Nested scopes must restore the outer frame exactly on exit. Both exception and promise-rejection paths must exit the scope and retain nothing — a `try` without the equivalent of a `finally` leaves the frame reachable on the failure path, which is precisely the path least covered by tests.

**Minimum verification.** Four tests are the floor: two concurrent runs with distinct frames, each asserting it cannot observe the other's; a nested scope asserting the outer frame is restored and the nested frame is unreachable; a scope whose body rejects, asserting cleanup and no later leakage; and an absent-context test asserting the declared explicit behaviour rather than an implicit empty frame. Add a test proving that presence alone grants nothing.

**Misuse.** This pattern is distinguishable from three neighbours it is often confused with:

- **Service locator.** A locator resolves *dependencies* by name at any time. Ambient context carries *scope-bound data* for the duration of a run. Using context to fetch collaborators hides the dependency graph and defeats testability.
- **Global mutable state.** A global is process-wide and mutable by anyone. A context frame is scope-bound and immutable. A mutable context frame is a global with extra steps and no isolation guarantee.
- **Implicit ambient authorization.** Granting because a frame exists. Authority must be held, not inferred.

**Related patterns.** Capability, Explicit Trust Boundary, Immutable Value Object, Authority Provenance, Domain Service.
