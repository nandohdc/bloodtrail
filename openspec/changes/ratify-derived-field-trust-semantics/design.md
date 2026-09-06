# Design — ratify-derived-field-trust-semantics

## Context

`contracts/security-audit/registries/registries.json` defines seven trust levels:

```
authoritative_server, verified_assertion, observed_transport,
derived_server, downstream_enrichment, client_claim, unknown
```

Every field in `contract.source.json` carries one. `session.age_seconds`, `session.assurance_level`,
and the whole `risk.*` family are `derived_server`; the field policy already says `risk.*` may be
`derived_server or downstream_enrichment` with `allowed_source: "identified inputs and algorithm
version"`. So the contract already asserts that these fields *have* identified inputs — it just has
no governed way to say which, or what those inputs imply about the output.

The decision below fixes that model. It deliberately decides the strict option at every fork, for one
reason: each lenient option is individually defensible and all of them fail in the same direction,
toward a derived field carrying more assurance than its inputs support.

## Decision

### 1. Trust is a total order, and `unknown` is the floor

```
authoritative_server > verified_assertion > observed_transport
                     > derived_server > downstream_enrichment > client_claim > unknown
```

`unknown` sits at the bottom, not outside the order. An input whose trust cannot be established must
pull the output down, because the alternative — treating it as unordered and therefore skippable —
makes ignorance the cheapest way to keep a high trust level.

### 2. Materiality is a counterfactual, not a category

An input is **material** to a derivation exactly when the derived value could differ had that input
differed, holding the others fixed. This is deliberately a property of the derivation, not a list of
field kinds: it does not need maintaining as the contract grows, and it has a single unambiguous
answer for any given transformation.

Consequences: the algorithm version, static configuration, and constants are not material (they are
not inputs that vary per event); a field consulted only to decide whether to derive at all *is*
material, because the output differs — by existing or not — with it. A non-material input must not be
listed, because listing it would lower the computed floor without cause and make provenance a place
to record unrelated context.

### 3. `derived_from` is a set

Order carries no meaning. A consumer must not infer precedence, weight, recency, or evaluation order
from position. To make that both mechanical and byte-stable, the canonical serialization is sorted by
code point — the same rule the repository's generators already follow deliberately, rather than
`localeCompare`, so the ordering is locale-independent.

### 4. Malformed provenance is rejected, never normalized

| Condition | Outcome |
|---|---|
| The same path listed twice | reject — `derived_from_duplicate_input` |
| A path resolving to no field of the contract version in force, and to no registered extension namespace | reject — `derived_from_unresolvable_input` |
| A path that resolves but is absent from this event instance | reject — `derived_from_absent_input` |
| A derivation graph containing a cycle | reject — `derived_from_cyclic_derivation` |
| An empty set on a field whose trust is a derived level | reject — `derived_from_empty_input_set` |

Each is a distinct outcome because each calls for a different fix, and because a normalization —
deduplicating, or mapping an unresolvable path to `unknown` — makes two different producer states
indistinguishable to the consumer. Rejecting an unresolvable path rather than scoring it `unknown`
also removes the asymmetry where a typo naming a nonexistent *high*-trust field would otherwise be
unfalsifiable.

### 5. One hop of provenance, transitive trust

A field records its **immediate** material inputs only. Trust is evaluated over the **transitive
closure** of those inputs within the same event.

Recording the closure instead would duplicate information already present, and would go stale
against the very field it duplicates. Computing trust over one hop instead would let a two-step
derivation launder a `client_claim` through an intermediate `derived_server` field. Splitting the two
concerns keeps provenance local and keeps trust honest.

### 6. Maximum output trust

```
max_output_trust(f) = min( min{ trust(i) : i ∈ closure(f) },  authority_ceiling(f) )
```

where `authority_ceiling(f)` is `derived_server` for a derivation performed by the producer under
server authority, and `downstream_enrichment` for one performed by a registered downstream
enrichment namespace. A declared trust exceeding `max_output_trust(f)` is rejected as
`derived_trust_exceeds_floor`.

Two clauses, because two different things can be wrong. The first says a derivation is never more
trustworthy than its least trustworthy material input. The second says a transformation cannot
exceed its own authority even when every input is `authoritative_server` — a downstream enricher
reading only authoritative fields still produces `downstream_enrichment`, because what it wrote is
its own claim about them.

### 7. Compatibility treatment

The contract is frozen at `1.0.0`, so this is two version moves and not one:

1. **Additive (minor).** `derived_from` is introduced as an optional field. Existing producers stay
   valid; consumers that do not read it are unaffected.
2. **Breaking (major).** `derived_from` becomes required for every field carrying a derived trust
   level, and the floor is enforced. Producers that omitted it become invalid — which is the point,
   since an absent declaration is exactly the omission the semantics exist to catch.

Each step is a canonical contract version move, and each therefore carries an SDK package version
step with it: an SDK package version supports exactly one contract version across one indivisible
compatibility surface. Neither step is performed by this change.

### 8. Worked examples

**Invalid provenance.** `session.assurance_level` (`derived_server`) declares
`derived_from: ["session.age_seconds", "session.age_seconds"]`. Outcome: rejected,
`derived_from_duplicate_input`, deterministically, before any trust computation.

**Excessive output trust.** A derived field declares `verified_assertion` while its closure contains
one `client_claim` input. The input floor is `client_claim`; the transformation ceiling is
`derived_server`; `max_output_trust` is therefore `client_claim`. The declared `verified_assertion`
exceeds it. Outcome: rejected, `derived_trust_exceeds_floor`, naming the input that set the floor.

## Alternatives considered

**Deduplicate repeated inputs and continue.** Rejected. It makes a producer defect invisible and
makes "listed once" and "listed twice" the same event, which is the class of silent normalization
this repository refuses elsewhere.

**Score an unresolvable path as `unknown`.** Rejected. It is fail-safe for the *typo naming a
low-trust field* case and fail-open for the *typo naming a high-trust field that does not exist*
case, and it converts a producer bug into a permanent, silent trust degradation.

**Record the full transitive closure in `derived_from`.** Rejected. It duplicates information the
graph already carries, grows quadratically in derivation depth, and can disagree with the one-hop
records it duplicates, with no rule for which wins.

**Compute the floor over one hop only.** Rejected. It lets a `client_claim` be laundered into a
`derived_server` output through one intermediate derivation, which is precisely the escalation the
requirement forbids.

## Assurance limitations

This decision bounds what a **declared** input set implies. It does not, and cannot, establish that a
producer enumerated its material inputs honestly, or that the transformation is correct. A producer
that omits a material `client_claim` input produces an event that is internally consistent and wrong.
That residual is stated here rather than papered over: closing it would need attestation of the
derivation itself, which is a different capability and is not authorized.

## Revisit conditions

- A trust level is added to or removed from the registry, which changes the total order.
- A derivation is authorized that crosses events, since the closure here is resolved within one event.
- Enforcement is authorized, at which point the rejection outcomes above need mechanical arms with
  null controls before they can be relied on.
